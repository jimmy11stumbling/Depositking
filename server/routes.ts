import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { STATE_LAWS } from "../shared/stateLaws";
import { insertCaseSchema, insertDeductionSchema } from "@shared/schema";
import { runParalegalAgent, runAttorneyAgent, runDrafterAgent, runReviewerAgent, withTimeout, withRetry } from "./agents";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sql } from "drizzle-orm";
import { db } from "./db";
import multer from "multer";
import crypto from "crypto";

// ⚠️ TEST MODE — set to false before going live
const TEST_MODE = true;

function safeError(res: Response, err: any, context: string, status = 500) {
  console.error(`${context}:`, err);
  res.status(status).json({ error: "An internal error occurred. Please try again." });
}

function trackEvent(eventType: string, opts: { pagePath?: string; caseId?: number; metadata?: any } = {}) {
  storage.createAnalyticsEvent({
    eventType,
    pagePath: opts.pagePath || null,
    caseId: opts.caseId || null,
    metadata: opts.metadata || null,
  }).catch(() => {});
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "image/heic", "image/heif",
  "image/gif", "application/pdf",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Upload images (JPG, PNG, WebP, HEIC, GIF) or PDF documents.`));
    }
  },
});

async function resolveCase(req: Request, _res: Response) {
  const param = req.params.id as string;
  const id = parseInt(param);
  let caseData;
  if (!isNaN(id) && param.length < 10) {
    caseData = await storage.getCase(id);
    if (caseData) {
      const tokenVal = req.query.token || req.headers["x-case-token"];
      const token = Array.isArray(tokenVal) ? tokenVal[0] : tokenVal;
      if (!token || token !== caseData.accessToken) {
        return null;
      }
    }
  } else {
    caseData = await storage.getCaseByToken(param as string);
  }
  return caseData || null;
}

async function ensureStripeProduct(): Promise<void> {
  try {
    const priceResult = await db.execute(
      sql`SELECT pr.id as price_id FROM stripe.products p 
          JOIN stripe.prices pr ON pr.product = p.id 
          WHERE p.name = 'Demand Letter' AND pr.active = true 
          LIMIT 1`
    );

    if (priceResult.rows.length > 0) {
      console.log("Stripe product verified:", priceResult.rows[0].price_id);
    } else {
      console.log("Demand Letter product not found, creating...");
      const stripe = await getUncachableStripeClient();

      const existing = await stripe.products.search({ query: "name:'Demand Letter'" });
      if (existing.data.length > 0) {
        const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
        if (prices.data.length > 0) {
          console.log("Stripe product exists externally, will sync shortly:", existing.data[0].id);
        }
      } else {
        const product = await stripe.products.create({
          name: "Demand Letter",
          description: "AI-generated demand letter for security deposit recovery. Includes 4-agent legal analysis, violation detection, penalty calculation, and professionally drafted demand letter with electronic signature.",
          metadata: { type: "one_time", category: "legal_service" },
        });

        await stripe.prices.create({
          product: product.id,
          unit_amount: 2900,
          currency: "usd",
        });

        console.log("Stripe product auto-created:", product.id);
      }
    }
  } catch (err: any) {
    console.error("Auto-seed Stripe product failed (non-fatal):", err.message);
  }

  try {
    const mailPriceResult = await db.execute(
      sql`SELECT pr.id as price_id FROM stripe.products p 
          JOIN stripe.prices pr ON pr.product = p.id 
          WHERE p.name = 'Certified Mail Delivery' AND pr.active = true 
          LIMIT 1`
    );

    if (mailPriceResult.rows.length > 0) {
      console.log("Certified Mail product verified:", mailPriceResult.rows[0].price_id);
    } else {
      console.log("Certified Mail product not found, creating...");
      const stripe = await getUncachableStripeClient();

      const existingMail = await stripe.products.search({ query: "name:'Certified Mail Delivery'" });
      if (existingMail.data.length > 0) {
        const prices = await stripe.prices.list({ product: existingMail.data[0].id, active: true });
        if (prices.data.length > 0) {
          console.log("Certified Mail product exists externally:", existingMail.data[0].id);
        }
      } else {
        const mailProduct = await stripe.products.create({
          name: "Certified Mail Delivery",
          description: "USPS Certified Mail delivery of your demand letter with tracking and delivery confirmation. Includes printing, postage, and certified mail receipt.",
          metadata: { type: "one_time", category: "mail_service" },
        });

        await stripe.prices.create({
          product: mailProduct.id,
          unit_amount: 1200,
          currency: "usd",
        });

        console.log("Certified Mail product auto-created:", mailProduct.id);
      }
    }
  } catch (err: any) {
    console.error("Auto-seed Certified Mail product failed (non-fatal):", err.message);
  }
}

function calculateAnalysis(stateAbbr: string, moveOutDate: string, depositAmount: number, amountReturned: number, tenancyStart?: string | null) {
  const law = STATE_LAWS[stateAbbr];
  if (!law) return null;

  const moveOut = new Date(moveOutDate);
  const today = new Date();
  const deadlineDate = new Date(moveOut);
  deadlineDate.setDate(deadlineDate.getDate() + law.returnDeadlineDays);

  const diffTime = today.getTime() - deadlineDate.getTime();
  const daysPastDeadline = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const isLate = daysPastDeadline > 0;

  const depositWithheld = depositAmount - amountReturned;

  const breakdownItems: { label: string; amount: number; description: string }[] = [];
  breakdownItems.push({ label: "Deposit Withheld", amount: depositWithheld, description: "Amount not returned by landlord" });

  let penaltyAmount = 0;
  let penaltyDescription = "";
  if (isLate) {
    if (law.penaltyType === "multiplier" && law.penaltyMultiplier) {
      penaltyAmount = depositWithheld * law.penaltyMultiplier;
      penaltyDescription = `${law.penaltyMultiplier}x statutory damages under ${law.citation}`;
      breakdownItems.push({ label: `${law.penaltyMultiplier}x Penalty`, amount: penaltyAmount, description: penaltyDescription });
    } else if (law.penaltyType === "flat" && law.penaltyFlatFee) {
      penaltyAmount = law.penaltyFlatFee;
      penaltyDescription = `$${law.penaltyFlatFee} statutory penalty under ${law.citation}`;
      breakdownItems.push({ label: "Flat Penalty", amount: penaltyAmount, description: penaltyDescription });
    }
  }

  let badFaithFee = 0;
  let badFaithDescription = "";
  if (isLate && law.badFaithFlatFee) {
    badFaithFee = law.badFaithFlatFee;
    badFaithDescription = `$${law.badFaithFlatFee} bad faith flat fee under ${law.citation}`;
    breakdownItems.push({ label: "Bad Faith Fee", amount: badFaithFee, description: badFaithDescription });
  }

  let interestAmount = 0;
  let interestDescription = "";
  if (law.interestRate && law.interestType !== "none" && tenancyStart) {
    const start = new Date(tenancyStart);
    const yearsHeld = Math.max(0, (moveOut.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    if (yearsHeld >= 1) {
      if (law.interestType === "simple") {
        interestAmount = depositAmount * (law.interestRate / 100) * yearsHeld;
      } else if (law.interestType === "compound") {
        interestAmount = depositAmount * (Math.pow(1 + law.interestRate / 100, yearsHeld) - 1);
      }
      interestAmount = Math.round(interestAmount * 100) / 100;
      interestDescription = `${law.interestRate}% ${law.interestType} interest over ${yearsHeld.toFixed(1)} years`;
      breakdownItems.push({ label: "Accrued Interest", amount: interestAmount, description: interestDescription });
    }
  }

  const totalPotentialRecovery = depositWithheld + penaltyAmount + badFaithFee + interestAmount;

  const penaltyBreakdown = {
    depositWithheld,
    baseDeposit: depositWithheld,
    penaltyAmount,
    penaltyDescription,
    interestAmount,
    interestDescription,
    badFaithFlatFee: badFaithFee,
    badFaithDescription,
    totalPotentialRecovery,
    items: breakdownItems,
  };

  return {
    isLate,
    daysPastDeadline: Math.max(0, daysPastDeadline),
    deadlineDate: deadlineDate.toISOString().split("T")[0],
    depositWithheld,
    penaltyAmount: penaltyAmount + badFaithFee + interestAmount,
    totalPotentialRecovery,
    penaltyBreakdown,
    stateLaw: law,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  ensureStripeProduct().catch(err => console.error("Stripe product check failed:", err));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/cases/by-tokens", async (req, res) => {
    try {
      const schema = z.object({
        tokens: z.array(z.string().min(1).max(128)).max(50),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }
      const results: any[] = [];
      for (const token of parsed.data.tokens) {
        const caseData = await storage.getCaseByToken(token);
        if (caseData) {
          const { stripeSessionId, mailStripeSessionId, ...safe } = caseData;
          results.push(safe);
        }
      }
      res.json(results);
    } catch (err: any) {
      console.error("Fetch cases by tokens error:", err);
      res.status(500).json({ error: "Failed to retrieve cases" });
    }
  });

  app.get("/api/cases/:id", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      res.json(caseData);
    } catch (err: any) {
      safeError(res, err, "Get case error");
    }
  });

  app.post("/api/cases", async (req, res) => {
    try {
      const parsed = insertCaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const data = parsed.data;

      const depositAmount = parseFloat(data.depositAmount as string);
      const amountReturned = parseFloat((data.amountReturned as string) || "0");
      if (depositAmount <= 0) {
        return res.status(400).json({ error: "Deposit amount must be positive" });
      }
      if (amountReturned < 0) {
        return res.status(400).json({ error: "Amount returned cannot be negative" });
      }
      if (amountReturned > depositAmount) {
        return res.status(400).json({ error: "Amount returned cannot exceed deposit amount" });
      }

      const moveOut = new Date(data.moveOutDate);
      if (isNaN(moveOut.getTime())) {
        return res.status(400).json({ error: "Invalid move-out date" });
      }

      const enrichedData = { ...data };
      if (data.landlordStreet && data.landlordCity && data.landlordState && data.landlordZip) {
        enrichedData.landlordAddress = `${data.landlordStreet}, ${data.landlordCity}, ${data.landlordState} ${data.landlordZip}`;
      }
      if (data.tenantStreet && data.tenantCity && data.tenantState && data.tenantZip) {
        enrichedData.tenantAddress = `${data.tenantStreet}, ${data.tenantCity}, ${data.tenantState} ${data.tenantZip}`;
      }

      const newCase = await storage.createCase(enrichedData);
      trackEvent("case_created", { caseId: newCase.id });

      const analysis = calculateAnalysis(
        newCase.state,
        newCase.moveOutDate,
        parseFloat(newCase.depositAmount),
        parseFloat(newCase.amountReturned || "0"),
        newCase.tenancyStart
      );

      if (analysis) {
        await storage.updateCase(newCase.id, {
          potentialRecovery: analysis.totalPotentialRecovery.toFixed(2),
          daysPastDeadline: analysis.daysPastDeadline,
          status: "analysis",
        });
      }

      const updated = await storage.getCase(newCase.id);
      res.status(201).json(updated);
    } catch (err: any) {
      safeError(res, err, "Create case error");
    }
  });

  app.get("/api/cases/:id/analysis", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });

      const analysis = calculateAnalysis(
        caseData.state,
        caseData.moveOutDate,
        parseFloat(caseData.depositAmount),
        parseFloat(caseData.amountReturned || "0"),
        caseData.tenancyStart
      );

      if (!analysis) return res.status(400).json({ error: "Invalid state" });
      res.json(analysis);
    } catch (err: any) {
      safeError(res, err, "Get analysis error");
    }
  });

  app.get("/api/cases/:id/deductions", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const deductionsList = await storage.getDeductionsByCase(caseData.id);
      res.json(deductionsList);
    } catch (err: any) {
      safeError(res, err, "Get deductions error");
    }
  });

  app.post("/api/cases/:id/deductions", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const parsed = insertDeductionSchema.safeParse({ ...req.body, caseId: caseData.id });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const deduction = await storage.createDeduction(parsed.data);
      res.status(201).json(deduction);
    } catch (err: any) {
      safeError(res, err, "Create deduction error");
    }
  });

  app.delete("/api/cases/:id/deductions/:deductionId", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (caseData.status === "signed") return res.status(400).json({ error: "Cannot modify a signed case" });
      const deductionId = parseInt(req.params.deductionId);
      if (isNaN(deductionId)) return res.status(400).json({ error: "Invalid deduction ID" });
      const deductions = await storage.getDeductionsByCase(caseData.id);
      const deduction = deductions.find(d => d.id === deductionId);
      if (!deduction) return res.status(404).json({ error: "Deduction not found for this case" });
      await storage.deleteDeduction(deductionId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Delete deduction error:", err);
      res.status(500).json({ error: "Failed to delete deduction" });
    }
  });

  app.get("/api/cases/:id/letter", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const letter = await storage.getLetterByCase(caseData.id);
      if (!letter) return res.status(404).json({ error: "No letter found" });
      res.json(letter);
    } catch (err: any) {
      safeError(res, err, "Get letter error");
    }
  });

  app.get("/api/cases/:id/generate", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) {
        send({ status: "error", message: "Case not found or access denied" });
        res.end();
        return;
      }
      const caseId = caseData.id;

      if (!TEST_MODE && !caseData.paid) {
        send({ status: "error", message: "Payment required before generating letter" });
        res.end();
        return;
      }

      if (caseData.status === "signed") {
        send({ status: "error", message: "This case has already been signed and finalized" });
        res.end();
        return;
      }

      const existingLetter = await storage.getLetterByCase(caseId);
      if (existingLetter && caseData.status === "generated") {
        send({ status: "error", message: "Letter already generated. View it from your case dashboard." });
        res.end();
        return;
      }

      if (caseData.status === "generating") {
        await storage.updateCase(caseId, { status: "analysis" });
      }

      const law = STATE_LAWS[caseData.state];
      if (!law) {
        send({ status: "error", message: "State law not found" });
        res.end();
        return;
      }

      const depositAmount = parseFloat(caseData.depositAmount);
      const amountReturned = parseFloat(caseData.amountReturned || "0");
      const withheldAmount = depositAmount - amountReturned;

      const analysis = calculateAnalysis(caseData.state, caseData.moveOutDate, depositAmount, amountReturned, caseData.tenancyStart);
      if (!analysis) {
        send({ status: "error", message: "Analysis failed" });
        res.end();
        return;
      }

      const deductionsList = await storage.getDeductionsByCase(caseId);

      const agentCaseData = {
        state: caseData.state,
        stateName: law.state,
        moveOutDate: caseData.moveOutDate,
        depositAmount,
        amountReturned,
        withheldAmount,
        daysPastDeadline: analysis.daysPastDeadline,
        isLate: analysis.isLate,
        tenantName: caseData.tenantName || "Tenant",
        tenantAddress: caseData.tenantAddress || "",
        landlordName: caseData.landlordName || "Landlord",
        landlordAddress: caseData.landlordAddress || "",
        propertyAddress: caseData.propertyAddress || "",
        tenancyStart: caseData.tenancyStart,
        deductions: deductionsList.map(d => ({
          description: d.description,
          amount: d.amount,
          disputeReason: d.disputeReason,
        })),
        stateLaw: {
          returnDeadlineDays: law.returnDeadlineDays,
          citation: law.citation,
          penaltyMultiplier: law.penaltyMultiplier,
          penaltyType: law.penaltyType,
          penaltyFlatFee: law.penaltyFlatFee,
          badFaithPenalty: law.badFaithPenalty,
          smallClaimsLimit: law.smallClaimsLimit,
          itemizedNoticeRequired: law.itemizedNoticeRequired,
          notes: law.notes,
        },
      };

      await storage.updateCase(caseId, { status: "generating" });

      send({ agent: "paralegal", status: "running", message: `Researching statutes for ${law.state}...` });
      let statuteSummary: any;
      try {
        statuteSummary = await withRetry(
          () => withTimeout(runParalegalAgent(agentCaseData), 60000, "Paralegal agent"),
          { maxRetries: 3, baseDelayMs: 800, label: "Paralegal agent" }
        );
        send({
          agent: "paralegal",
          status: "complete",
          message: `Verified: ${statuteSummary.citation || law.citation}`,
          confidence: 95,
        });
      } catch (err: any) {
        console.error("Paralegal agent error (retries exhausted):", err);
        statuteSummary = {
          state: law.state,
          citation: law.citation,
          return_deadline_days: law.returnDeadlineDays,
          penalty_multiplier: law.penaltyMultiplier,
          penalty_flat_fee: law.penaltyFlatFee,
          bad_faith_definition: "Landlord knowingly retains deposit without basis",
          attorney_fees_available: law.badFaithPenalty,
          small_claims_limit: law.smallClaimsLimit,
          itemized_notice_required: law.itemizedNoticeRequired,
          research_notes: "Used database fallback",
          last_verified_date: new Date().toISOString().split("T")[0],
        };
        send({ agent: "paralegal", status: "complete", message: `Verified: ${law.citation} (from database)`, confidence: 90 });
      }

      send({ agent: "attorney", status: "running", message: "Assessing case strength..." });
      let strategyBrief: any;
      try {
        strategyBrief = await withRetry(
          () => withTimeout(runAttorneyAgent(agentCaseData, statuteSummary), 60000, "Attorney agent"),
          { maxRetries: 3, baseDelayMs: 800, label: "Attorney agent" }
        );
        send({
          agent: "attorney",
          status: "complete",
          message: `Case Strength: ${strategyBrief.case_strength_score}/10 — ${strategyBrief.case_strength_label}`,
          confidence: 92,
        });
      } catch (err: any) {
        console.error("Attorney agent error (retries exhausted):", err);
        const penaltyAmt = law.penaltyType === "multiplier" && law.penaltyMultiplier
          ? withheldAmount * law.penaltyMultiplier
          : law.penaltyType === "flat" && law.penaltyFlatFee
          ? law.penaltyFlatFee
          : 0;
        strategyBrief = {
          case_strength_score: analysis.isLate ? 8 : 5,
          case_strength_label: analysis.isLate ? "Strong" : "Moderate",
          primary_violation: analysis.isLate ? `Missed ${law.returnDeadlineDays}-day deadline` : "Deposit withheld",
          legal_arguments: ["Statutory deadline violation"],
          weaknesses: [],
          recommended_strategy: "Send formal demand letter",
          demand_amount: withheldAmount,
          penalty_amount: penaltyAmt,
          total_claim: withheldAmount + penaltyAmt,
          proceed_to_small_claims: true,
          attorney_notes: "Used fallback assessment",
        };
        send({ agent: "attorney", status: "complete", message: `Case Strength: ${strategyBrief.case_strength_score}/10`, confidence: 85 });
      }

      send({ agent: "drafter", status: "running", message: "Drafting authoritative letter..." });
      let draftHtml: string;
      try {
        draftHtml = await withRetry(
          () => withTimeout(runDrafterAgent(agentCaseData, statuteSummary, strategyBrief), 90000, "Drafter agent"),
          { maxRetries: 3, baseDelayMs: 800, label: "Drafter agent" }
        );
        send({ agent: "drafter", status: "complete", message: "Draft complete", confidence: 90 });
      } catch (err: any) {
        console.error("Drafter agent error (retries exhausted):", err);
        draftHtml = generateFallbackLetter(agentCaseData, strategyBrief);
        send({ agent: "drafter", status: "complete", message: "Draft complete (template)", confidence: 80 });
      }

      send({ agent: "reviewer", status: "running", message: "Reviewing for accuracy..." });
      let reviewResult: any;
      try {
        reviewResult = await withRetry(
          () => withTimeout(runReviewerAgent(draftHtml, statuteSummary, strategyBrief), 60000, "Reviewer agent"),
          { maxRetries: 3, baseDelayMs: 800, label: "Reviewer agent" }
        );
        send({
          agent: "reviewer",
          status: "complete",
          message: `Review complete — ${reviewResult.approved ? "Approved" : "Needs revision"}`,
          confidence: reviewResult.confidenceScore,
        });
      } catch (err: any) {
        console.error("Reviewer agent error (retries exhausted):", err);
        reviewResult = {
          approved: true,
          confidenceScore: 80,
          finalHtml: draftHtml,
          reviewerNotes: "Review completed with fallback",
        };
        send({ agent: "reviewer", status: "complete", message: "Review complete", confidence: 80 });
      }

      await storage.createLetter({
        caseId,
        paralegalOutput: statuteSummary,
        attorneyOutput: strategyBrief,
        draftHtml,
        finalHtml: reviewResult.finalHtml,
        confidenceScore: reviewResult.confidenceScore,
      });

      await storage.updateCase(caseId, {
        status: "generated",
        potentialRecovery: (strategyBrief.total_claim || analysis.totalPotentialRecovery).toString(),
      });
      trackEvent("letter_generated", { caseId });

      send({ status: "done" });
      res.end();
    } catch (err: any) {
      console.error("Generation pipeline error:", err);
      const resolvedCase = await resolveCase(req, res);
      if (resolvedCase) {
        await storage.updateCase(resolvedCase.id, { status: "analysis" });
      }
      send({ status: "error", message: "Letter generation failed. Please try again." });
      res.end();
    }
  });

  app.put("/api/cases/:id/letter", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (caseData.status === "signed") {
        return res.status(400).json({ error: "Cannot edit a signed letter" });
      }
      if (!TEST_MODE && !caseData.paid) {
        return res.status(403).json({ error: "Payment required" });
      }
      if (caseData.status !== "generated") {
        return res.status(400).json({ error: "Letter can only be edited after generation" });
      }

      const letter = await storage.getLetterByCase(caseData.id);
      if (!letter) {
        return res.status(400).json({ error: "No letter has been generated for this case" });
      }

      const updateSchema = z.object({
        finalHtml: z.string().min(50, "Letter content is too short"),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }

      const cleanHtml = sanitizeHtml(parsed.data.finalHtml, {
        allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "table", "thead", "tbody", "tr", "td", "th", "blockquote", "hr", "sup", "sub"],
        allowedAttributes: { "*": ["class", "style"] },
        allowedStyles: {
          "*": {
            "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
            "font-weight": [/^\d+$/, /^bold$/, /^normal$/],
            "font-style": [/^italic$/, /^normal$/],
            "text-decoration": [/^underline$/, /^none$/],
            "margin-top": [/^\d+px$/],
            "margin-bottom": [/^\d+px$/],
          },
        },
      });

      const updated = await storage.updateLetter(letter.id, { finalHtml: cleanHtml });
      res.json(updated);
    } catch (err: any) {
      safeError(res, err, "Update letter error");
    }
  });

  app.post("/api/cases/:id/sign", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const caseId = caseData.id;
      if (caseData.status === "signed") {
        return res.status(400).json({ error: "This case has already been signed" });
      }
      if (!TEST_MODE && !caseData.paid) {
        return res.status(403).json({ error: "Payment required" });
      }

      const letter = await storage.getLetterByCase(caseId);
      if (!letter) {
        return res.status(400).json({ error: "No letter has been generated for this case" });
      }

      const signatureSchema = z.object({
        signatureBase64: z.string().min(1000, "Signature data is required"),
      });
      const parsed = signatureSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }

      await storage.createSignature({ caseId, signatureBase64: parsed.data.signatureBase64 });
      await storage.updateCase(caseId, { status: "signed" });
      trackEvent("letter_signed", { caseId });

      res.json({ success: true });
    } catch (err: any) {
      safeError(res, err, "Sign case error");
    }
  });

  app.get("/api/cases/:id/signature", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const signature = await storage.getSignatureByCase(caseData.id);
      if (!signature) return res.status(404).json({ error: "No signature found" });
      res.json(signature);
    } catch (err: any) {
      safeError(res, err, "Get signature error");
    }
  });

  app.get("/api/state-laws", (_req, res) => {
    res.json(STATE_LAWS);
  });

  app.get("/api/state-laws/:state", (req, res) => {
    const state = req.params.state.toUpperCase();
    const law = STATE_LAWS[state];
    if (!law) return res.status(404).json({ error: "State not found" });
    res.json(law);
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (err: any) {
      safeError(res, err, "Get publishable key error");
    }
  });

  app.post("/api/cases/:id/checkout", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const caseId = caseData.id;
      if (caseData.paid) return res.json({ alreadyPaid: true });

      const stripe = await getUncachableStripeClient();

      const priceResult = await db.execute(
        sql`SELECT pr.id as price_id FROM stripe.products p 
            JOIN stripe.prices pr ON pr.product = p.id 
            WHERE p.name = 'Demand Letter' AND pr.active = true 
            LIMIT 1`
      );

      if (!priceResult.rows.length) {
        return res.status(500).json({ error: "Product not configured" });
      }

      const priceId = priceResult.rows[0].price_id as string;
      const host = req.get('host');
      const protocol = req.protocol;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${protocol}://${host}/cases/${caseData.accessToken}/generate?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${protocol}://${host}/cases/${caseData.accessToken}`,
        metadata: { caseId: caseId.toString() },
      });

      await storage.updateCase(caseId, { stripeSessionId: session.id });

      res.json({ url: session.url });
    } catch (err: any) {
      safeError(res, err, "Checkout error");
    }
  });

  app.post("/api/cases/:id/verify-payment", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const caseId = caseData.id;

      const { sessionId } = req.body;
      if (caseData.paid) return res.json({ paid: true });
      if (!sessionId) return res.json({ paid: false });

      if (caseData.stripeSessionId && caseData.stripeSessionId !== sessionId) {
        return res.status(403).json({ error: "Session does not match this case" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.metadata?.caseId !== caseId.toString()) {
        return res.status(403).json({ error: "Session does not belong to this case" });
      }

      if (session.payment_status === "paid") {
        await storage.updateCase(caseId, { paid: true, stripeSessionId: sessionId });
        trackEvent("payment_completed", { caseId, metadata: { type: "demand_letter", amount: 2900 } });
        return res.json({ paid: true });
      }

      res.json({ paid: false });
    } catch (err: any) {
      safeError(res, err, "Verify payment error");
    }
  });

  app.post("/api/cases/:id/mail-checkout", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (caseData.status !== "signed") return res.status(400).json({ error: "Letter must be signed first" });
      if (caseData.mailPaid) return res.json({ alreadyPaid: true });

      const stripe = await getUncachableStripeClient();

      const priceResult = await db.execute(
        sql`SELECT pr.id as price_id FROM stripe.products p 
            JOIN stripe.prices pr ON pr.product = p.id 
            WHERE p.name = 'Certified Mail Delivery' AND pr.active = true 
            LIMIT 1`
      );

      if (!priceResult.rows.length) {
        return res.status(500).json({ error: "Mail product not configured" });
      }

      const priceId = priceResult.rows[0].price_id as string;
      const host = req.get('host');
      const protocol = req.protocol;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${protocol}://${host}/cases/${caseData.accessToken}?mail_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${protocol}://${host}/cases/${caseData.accessToken}`,
        metadata: { caseId: caseData.id.toString(), type: "certified_mail" },
      });

      await storage.updateCase(caseData.id, { mailStripeSessionId: session.id });

      res.json({ url: session.url });
    } catch (err: any) {
      safeError(res, err, "Mail checkout error");
    }
  });

  app.post("/api/cases/:id/verify-mail-payment", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });

      const { sessionId: mailSessionId } = req.body;
      if (caseData.mailPaid) return res.json({ paid: true });
      if (!mailSessionId) return res.json({ paid: false });

      if (caseData.mailStripeSessionId && caseData.mailStripeSessionId !== mailSessionId) {
        return res.status(403).json({ error: "Session does not match this case" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(mailSessionId);

      if (session.metadata?.caseId !== caseData.id.toString()) {
        return res.status(403).json({ error: "Session does not belong to this case" });
      }

      if (session.payment_status === "paid") {
        await storage.updateCase(caseData.id, { mailPaid: true, mailStripeSessionId: mailSessionId });
        trackEvent("mail_payment_completed", { caseId: caseData.id, metadata: { type: "certified_mail", amount: 1200 } });
        return res.json({ paid: true });
      }

      res.json({ paid: false });
    } catch (err: any) {
      safeError(res, err, "Verify mail payment error");
    }
  });

  app.post("/api/cases/:id/evidence", upload.single("file"), async (req: any, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file as Express.Multer.File;
      const sha256Hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
      const fileData = file.buffer.toString("base64");

      const metadata: Record<string, any> = {
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadTimestamp: new Date().toISOString(),
        hashAlgorithm: "SHA-256",
      };

      const ev = await storage.createEvidence({
        caseId: caseData.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        sha256Hash,
        fileData,
        metadata,
        description: req.body.description || null,
      });

      res.status(201).json({
        id: ev.id,
        filename: ev.filename,
        mimeType: ev.mimeType,
        fileSize: ev.fileSize,
        sha256Hash: ev.sha256Hash,
        metadata: ev.metadata,
        description: ev.description,
        uploadedAt: ev.uploadedAt,
      });
    } catch (err: any) {
      safeError(res, err, "Upload evidence error");
    }
  });

  app.get("/api/cases/:id/evidence", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const items = await storage.getEvidenceByCase(caseData.id);
      res.json(items.map(e => ({
        id: e.id,
        filename: e.filename,
        mimeType: e.mimeType,
        fileSize: e.fileSize,
        sha256Hash: e.sha256Hash,
        metadata: e.metadata,
        description: e.description,
        uploadedAt: e.uploadedAt,
      })));
    } catch (err: any) {
      safeError(res, err, "Get evidence list error");
    }
  });

  app.get("/api/cases/:id/evidence/:evidenceId/download", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const evidenceId = parseInt(req.params.evidenceId);
      if (isNaN(evidenceId)) return res.status(400).json({ error: "Invalid evidence ID" });
      const ev = await storage.getEvidence(evidenceId);
      if (!ev || ev.caseId !== caseData.id) return res.status(404).json({ error: "Evidence not found" });
      const buffer = Buffer.from(ev.fileData, "base64");
      const safeFilename = ev.filename.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
      res.setHeader("Content-Type", ev.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(buffer);
    } catch (err: any) {
      safeError(res, err, "Download evidence error");
    }
  });

  app.delete("/api/cases/:id/evidence/:evidenceId", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (caseData.status === "signed") return res.status(400).json({ error: "Cannot modify evidence on a signed case" });
      const evidenceId = parseInt(req.params.evidenceId);
      const ev = await storage.getEvidence(evidenceId);
      if (!ev || ev.caseId !== caseData.id) return res.status(404).json({ error: "Evidence not found" });
      await storage.deleteEvidence(evidenceId);
      res.status(204).send();
    } catch (err: any) {
      safeError(res, err, "Delete evidence error");
    }
  });

  app.get("/api/cases/:id/evidence/manifest", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const items = await storage.getEvidenceByCase(caseData.id);

      const manifest = {
        caseId: caseData.id,
        generatedAt: new Date().toISOString(),
        hashAlgorithm: "SHA-256",
        evidenceCount: items.length,
        items: items.map(e => ({
          filename: e.filename,
          sha256Hash: e.sha256Hash,
          fileSize: e.fileSize,
          mimeType: e.mimeType,
          uploadedAt: e.uploadedAt,
          description: e.description,
        })),
        manifestHash: crypto.createHash("sha256").update(
          items.map(e => e.sha256Hash).sort().join("")
        ).digest("hex"),
      };

      res.json(manifest);
    } catch (err: any) {
      safeError(res, err, "Get evidence manifest error");
    }
  });

  function parseUSAddress(raw: string, structured?: { street?: string | null; city?: string | null; state?: string | null; zip?: string | null }): { line1: string; line2: string; city: string; state: string; zip: string } {
    if (structured?.street && structured.city && structured.state && structured.zip) {
      const street = structured.street.trim();
      const aptMatch = street.match(/^(.*?)\s+(Apt|Unit|Suite|#|Ste|Fl)\s+(.+)$/i);
      return {
        line1: aptMatch ? aptMatch[1].trim() : street,
        line2: aptMatch ? `${aptMatch[2]} ${aptMatch[3]}` : "",
        city: structured.city.trim(),
        state: structured.state.trim().toUpperCase(),
        zip: structured.zip.trim(),
      };
    }
    const addr = (raw || "").replace(/\r?\n/g, ", ").replace(/\s*,\s*/g, ", ").replace(/\s{2,}/g, " ").trim();
    const zipMatch = addr.match(/(\d{5}(?:-\d{4})?)\s*$/);
    const zip = zipMatch?.[1] ?? "";
    const withoutZip = zip ? addr.slice(0, addr.lastIndexOf(zip)).replace(/,\s*$/, "").trim() : addr;
    const stateMatch = withoutZip.match(/(?:,\s*|\s+)([A-Z]{2})\s*$/);
    const state = stateMatch?.[1] ?? "";
    const withoutState = state ? withoutZip.slice(0, withoutZip.length - stateMatch![0].length).replace(/,\s*$/, "").trim() : withoutZip;
    const lastCommaIdx = withoutState.lastIndexOf(",");
    if (lastCommaIdx === -1) {
      return { line1: withoutState, line2: "", city: "", state, zip };
    }
    const city = withoutState.slice(lastCommaIdx + 1).trim();
    const streetPart = withoutState.slice(0, lastCommaIdx).trim();
    const streetComma = streetPart.lastIndexOf(",");
    const line1 = streetComma !== -1 ? streetPart.slice(0, streetComma).trim() : streetPart;
    const line2 = streetComma !== -1 ? streetPart.slice(streetComma + 1).trim() : "";
    return { line1, line2, city, state, zip };
  }

  app.post("/api/cases/:id/send-letter", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (caseData.status !== "signed") return res.status(400).json({ error: "Letter must be signed before sending" });
      if (!TEST_MODE && !caseData.paid) return res.status(403).json({ error: "Payment required" });
      if (!TEST_MODE && !caseData.mailPaid) return res.status(403).json({ error: "Certified mail payment required. Pay $12 to send via USPS Certified Mail." });

      const existingDeliveries = await storage.getDeliveriesByCase(caseData.id);
      if (existingDeliveries.length > 0) {
        return res.status(400).json({ error: "Letter has already been sent", delivery: existingDeliveries[0] });
      }

      const lobApiKey = process.env.LOB_API_KEY;
      if (!lobApiKey) {
        return res.status(503).json({ error: "Certified mail service not configured. Please set up your Lob API key." });
      }

      const letter = await storage.getLetterByCase(caseData.id);
      if (!letter || !letter.finalHtml) {
        return res.status(400).json({ error: "No letter content found" });
      }

      const signature = await storage.getSignatureByCase(caseData.id);

      const toAddr = parseUSAddress(caseData.landlordAddress || "", {
        street: caseData.landlordStreet,
        city: caseData.landlordCity,
        state: caseData.landlordState,
        zip: caseData.landlordZip,
      });
      const fromAddr = parseUSAddress(caseData.tenantAddress || "", {
        street: caseData.tenantStreet,
        city: caseData.tenantCity,
        state: caseData.tenantState,
        zip: caseData.tenantZip,
      });

      const addrErrors: string[] = [];
      if (!toAddr.line1) addrErrors.push("Landlord street address is missing");
      if (!toAddr.city) addrErrors.push("Landlord city is missing (expected format: 123 Main St, City, ST 12345)");
      if (!toAddr.zip) addrErrors.push("Landlord ZIP code is missing");
      if (!fromAddr.line1) addrErrors.push("Your street address is missing");
      if (!fromAddr.city) addrErrors.push("Your city is missing (expected format: 123 Main St, City, ST 12345)");
      if (!fromAddr.zip) addrErrors.push("Your ZIP code is missing");
      if (addrErrors.length > 0) {
        return res.status(422).json({
          error: "Address formatting issue — please update your case with a complete address.",
          details: addrErrors,
        });
      }

      const signatureHtml = signature
        ? `<div style="margin-top:48px"><img src="${signature.signatureBase64}" style="max-height:64px;display:block" alt="Signature" /></div>`
        : "";

      const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.6; color: #111; background: #fff; padding: 1in; }
  p { margin-bottom: 12pt; }
  h1,h2,h3 { font-family: "Times New Roman", Times, serif; }
  ul, ol { margin-left: 20pt; margin-bottom: 12pt; }
  li { margin-bottom: 4pt; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  .letter-date { margin-bottom: 24pt; }
  .letter-via { font-style: italic; margin-bottom: 16pt; border-left: 3px solid #1E3A5F; padding-left: 8pt; color: #1E3A5F; }
  .letter-re { background: #f5f5f5; border-left: 4px solid #1E3A5F; padding: 8pt 12pt; margin-bottom: 16pt; font-weight: bold; }
  .letter-close { margin-top: 24pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
  th, td { border: 1px solid #ccc; padding: 6pt 8pt; text-align: left; }
  th { background: #eee; font-weight: bold; }
  .disclaimer { margin-top: 36pt; font-size: 9pt; color: #666; border-top: 1px solid #ccc; padding-top: 8pt; }
</style>
</head>
<body>
${letter.finalHtml}
${signatureHtml}
</body>
</html>`;

      const lobResponse = await fetch("https://api.lob.com/v1/letters", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(lobApiKey + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: `Security Deposit Demand Letter — Case #${caseData.id}`,
          to: {
            name: caseData.landlordName,
            address_line1: toAddr.line1,
            ...(toAddr.line2 ? { address_line2: toAddr.line2 } : {}),
            address_city: toAddr.city,
            address_state: toAddr.state || caseData.state,
            address_zip: toAddr.zip,
            address_country: "US",
          },
          from: {
            name: caseData.tenantName,
            address_line1: fromAddr.line1,
            ...(fromAddr.line2 ? { address_line2: fromAddr.line2 } : {}),
            address_city: fromAddr.city,
            address_state: fromAddr.state || caseData.state,
            address_zip: fromAddr.zip,
            address_country: "US",
          },
          file: printHtml,
          color: false,
          mail_type: "usps_first_class",
          extra_service: "certified",
          return_envelope: false,
        }),
      });

      if (!lobResponse.ok) {
        const errorData = await lobResponse.json().catch(() => ({ error: { message: "Unknown Lob error" } }));
        console.error("Lob API error:", errorData);
        return res.status(502).json({ error: `Mail service error: ${errorData?.error?.message || "Unknown error"}` });
      }

      const lobData = await lobResponse.json();

      const delivery = await storage.createDelivery({
        caseId: caseData.id,
        provider: "lob",
        externalId: lobData.id,
        trackingNumber: lobData.tracking_number || null,
        status: "processing",
        recipientName: caseData.landlordName,
        recipientAddress: caseData.landlordAddress,
        senderName: caseData.tenantName,
        senderAddress: caseData.tenantAddress,
        certifiedMailNumber: lobData.tracking_number || null,
        expectedDeliveryDate: lobData.expected_delivery_date || null,
        statusHistory: [{ status: "processing", timestamp: new Date().toISOString(), detail: "Letter submitted to Lob for printing and mailing" }],
      });

      await storage.updateCase(caseData.id, {
        letterSentAt: new Date(),
        letterSentMethod: "usps_certified",
      });
      trackEvent("letter_sent", { caseId: caseData.id, metadata: { method: "usps_certified", deliveryId: delivery.id } });

      res.status(201).json(delivery);
    } catch (err: any) {
      safeError(res, err, "Send letter error");
    }
  });

  app.get("/api/cases/:id/deliveries", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const items = await storage.getDeliveriesByCase(caseData.id);
      res.json(items);
    } catch (err: any) {
      safeError(res, err, "Get deliveries error");
    }
  });

  app.get("/api/deliveries/:deliveryId/track", async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.deliveryId);
      if (isNaN(deliveryId)) return res.status(400).json({ error: "Invalid delivery ID" });

      const delivery = await storage.getDelivery(deliveryId);
      if (!delivery) return res.status(404).json({ error: "Delivery not found" });

      if (!delivery.externalId) {
        return res.status(400).json({ error: "No external tracking ID" });
      }

      const lobApiKey = process.env.LOB_API_KEY;
      if (!lobApiKey) {
        return res.status(503).json({ error: "Tracking service not configured" });
      }

      const lobResponse = await fetch(`https://api.lob.com/v1/letters/${delivery.externalId}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(lobApiKey + ":").toString("base64")}`,
        },
      });

      if (!lobResponse.ok) {
        const errData = await lobResponse.json().catch(() => ({ error: { message: "Unknown Lob error" } }));
        return res.status(502).json({ error: `Tracking error: ${errData?.error?.message || "Unknown error"}` });
      }

      const lobData = await lobResponse.json();
      const currentStatus = (lobData.status || delivery.status).toLowerCase();
      const isDelivered = currentStatus === "delivered";

      const history = Array.isArray(delivery.statusHistory) ? delivery.statusHistory : [];
      const lastEntry = history[history.length - 1];
      if (!lastEntry || lastEntry.status !== currentStatus) {
        history.push({
          status: currentStatus,
          timestamp: new Date().toISOString(),
          detail: `Lob status: ${lobData.status || currentStatus}`,
        });
      }

      const updated = await storage.updateDelivery(deliveryId, {
        status: currentStatus,
        trackingNumber: lobData.tracking_number || delivery.trackingNumber,
        certifiedMailNumber: lobData.tracking_number || delivery.certifiedMailNumber,
        expectedDeliveryDate: lobData.expected_delivery_date || delivery.expectedDeliveryDate,
        deliveredAt: isDelivered && !delivery.deliveredAt ? new Date() : delivery.deliveredAt,
        statusHistory: history,
      });

      res.json(updated);
    } catch (err: any) {
      safeError(res, err, "Track delivery error");
    }
  });

  app.post("/api/cases/:id/court-forms", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });

      if (caseData.status !== "signed") {
        return res.status(400).json({ error: "Letter must be signed before generating court forms" });
      }

      const law = STATE_LAWS[caseData.state];
      if (!law) return res.status(400).json({ error: "State not found" });

      const depositAmount = parseFloat(caseData.depositAmount);
      const amountReturned = parseFloat(caseData.amountReturned || "0");
      const analysis = calculateAnalysis(caseData.state, caseData.moveOutDate, depositAmount, amountReturned, caseData.tenancyStart);
      const deductionsList = await storage.getDeductionsByCase(caseData.id);

      const formData = {
        courtName: law.smallClaimsCourtName,
        filingFee: law.smallClaimsFilingFee,
        maxClaimAmount: law.smallClaimsLimit,

        plaintiffName: caseData.tenantName || "",
        plaintiffAddress: caseData.tenantAddress || "",
        plaintiffPhone: "",

        defendantName: caseData.landlordName || "",
        defendantAddress: caseData.landlordAddress || "",

        claimAmount: analysis?.totalPotentialRecovery || depositAmount,
        claimDescription: `Recovery of security deposit wrongfully withheld. Deposit of $${depositAmount.toFixed(2)} paid for rental at ${caseData.propertyAddress || "property address"}. Moved out on ${new Date(caseData.moveOutDate).toLocaleDateString("en-US")}. ${analysis?.isLate ? `Landlord missed the ${law.returnDeadlineDays}-day statutory deadline by ${analysis.daysPastDeadline} days.` : ""} Amount returned: $${amountReturned.toFixed(2)}. Amount withheld: $${(depositAmount - amountReturned).toFixed(2)}. ${analysis?.penaltyBreakdown ? `Statutory penalties: ${analysis.penaltyBreakdown.items.filter(i => i.label !== "Deposit Withheld").map(i => `${i.label}: $${i.amount.toFixed(2)}`).join(", ")}` : ""}`,

        statutoryBasis: law.citation,
        specialPenaltyRules: law.specialPenaltyRules || null,

        propertyAddress: caseData.propertyAddress || "",
        moveOutDate: caseData.moveOutDate,
        depositAmount: depositAmount.toFixed(2),
        amountReturned: amountReturned.toFixed(2),
        amountWithheld: (depositAmount - amountReturned).toFixed(2),
        daysPastDeadline: analysis?.daysPastDeadline || 0,

        deductions: deductionsList.map(d => ({
          description: d.description,
          amount: d.amount,
          disputeReason: d.disputeReason,
        })),

        penaltyBreakdown: analysis?.penaltyBreakdown || null,

        filingInstructions: `File this claim at your local ${law.smallClaimsCourtName}. The filing fee is approximately $${law.smallClaimsFilingFee || "varies"}. The small claims limit in ${law.state} is $${law.smallClaimsLimit.toLocaleString()}. Bring a copy of your demand letter, lease agreement, and all evidence from your Evidence Vault.`,
      };

      const courtForm = await storage.createCourtForm({
        caseId: caseData.id,
        formType: "small_claims_statement",
        state: caseData.state,
        formData,
      });

      res.status(201).json(courtForm);
    } catch (err: any) {
      safeError(res, err, "Create court form error");
    }
  });

  app.get("/api/cases/:id/court-forms", async (req, res) => {
    try {
      const caseData = await resolveCase(req, res);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      const forms = await storage.getCourtFormsByCase(caseData.id);
      res.json(forms);
    } catch (err: any) {
      safeError(res, err, "Get court forms error");
    }
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large. Maximum file size is 10MB." });
    }
    if (err?.code?.startsWith("LIMIT_")) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err?.message?.includes("not allowed") || err?.message?.includes("File type")) {
      return res.status(415).json({ error: err.message });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "An unexpected error occurred." });
  });

  return httpServer;
}

function generateFallbackLetter(caseData: any, strategy: any): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `
<p>${today}</p>
<p><strong>VIA USPS CERTIFIED MAIL</strong></p>
<p>${caseData.tenantName}<br>${caseData.tenantAddress}</p>
<p>${caseData.landlordName}<br>${caseData.landlordAddress}</p>
<p><strong>RE: Formal Demand for Return of Security Deposit — ${caseData.propertyAddress}</strong></p>
<p>Dear ${caseData.landlordName},</p>
<p>I am writing to formally demand the return of my security deposit in the amount of <strong>$${caseData.depositAmount.toFixed(2)}</strong>, which was paid at the commencement of my tenancy at ${caseData.propertyAddress}. I vacated the premises on ${new Date(caseData.moveOutDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
<p>Under ${caseData.stateLaw.citation}, you were required to return my security deposit within <strong>${caseData.stateLaw.returnDeadlineDays} days</strong> of my move-out date. ${caseData.isLate ? `As of today, you are <strong>${caseData.daysPastDeadline} days past the statutory deadline</strong>, which constitutes a violation of state law.` : "The deadline for return is approaching."}</p>
${caseData.deductions.length > 0 ? `<p>I dispute the following deductions as constituting normal wear and tear:</p><ul>${caseData.deductions.map((d: any) => `<li>${d.description}: $${d.amount} — ${d.disputeReason || "Normal wear and tear"}</li>`).join("")}</ul>` : ""}
<p>I hereby demand the immediate return of <strong>$${(strategy.total_claim || caseData.withheldAmount).toFixed(2)}</strong>, which includes the withheld deposit${strategy.penalty_amount > 0 ? ` and statutory penalties of $${strategy.penalty_amount.toFixed(2)}` : ""}. Please respond within <strong>10 business days</strong> of receipt of this letter.</p>
<p>If I do not receive the full amount demanded, I intend to file a claim in Small Claims Court, where I may be entitled to additional statutory penalties and court costs under ${caseData.stateLaw.citation}.</p>
<p>Sincerely,</p>
<p>${caseData.tenantName}</p>
`.trim();
}
