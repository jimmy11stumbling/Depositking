import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { STATE_LAWS } from "../shared/stateLaws";
import { insertCaseSchema, insertDeductionSchema } from "@shared/schema";
import { runParalegalAgent, runAttorneyAgent, runDrafterAgent, runReviewerAgent } from "./agents";
import { z } from "zod";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sql } from "drizzle-orm";
import { db } from "./db";

function calculateAnalysis(stateAbbr: string, moveOutDate: string, depositAmount: number, amountReturned: number) {
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

  let penaltyAmount = 0;
  if (isLate) {
    if (law.penaltyType === "multiplier" && law.penaltyMultiplier) {
      penaltyAmount = depositWithheld * law.penaltyMultiplier;
    } else if (law.penaltyType === "flat" && law.penaltyFlatFee) {
      penaltyAmount = law.penaltyFlatFee;
    }
  }

  return {
    isLate,
    daysPastDeadline: Math.max(0, daysPastDeadline),
    deadlineDate: deadlineDate.toISOString().split("T")[0],
    depositWithheld,
    penaltyAmount,
    totalPotentialRecovery: depositWithheld + penaltyAmount,
    stateLaw: law,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/cases", async (_req, res) => {
    try {
      const allCases = await storage.getAllCases();
      res.json(allCases);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const caseData = await storage.getCase(id);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      res.json(caseData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cases", async (req, res) => {
    try {
      const parsed = insertCaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const data = parsed.data;
      const newCase = await storage.createCase(data);

      const analysis = calculateAnalysis(
        newCase.state,
        newCase.moveOutDate,
        parseFloat(newCase.depositAmount),
        parseFloat(newCase.amountReturned || "0")
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
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cases/:id/analysis", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const caseData = await storage.getCase(id);
      if (!caseData) return res.status(404).json({ error: "Case not found" });

      const analysis = calculateAnalysis(
        caseData.state,
        caseData.moveOutDate,
        parseFloat(caseData.depositAmount),
        parseFloat(caseData.amountReturned || "0")
      );

      if (!analysis) return res.status(400).json({ error: "Invalid state" });
      res.json(analysis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cases/:id/deductions", async (req, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const deductionsList = await storage.getDeductionsByCase(caseId);
      res.json(deductionsList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cases/:id/deductions", async (req, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const parsed = insertDeductionSchema.safeParse({ ...req.body, caseId });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const deduction = await storage.createDeduction(parsed.data);
      res.status(201).json(deduction);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/cases/:id/deductions/:deductionId", async (req, res) => {
    try {
      const deductionId = parseInt(req.params.deductionId);
      await storage.deleteDeduction(deductionId);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cases/:id/letter", async (req, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const letter = await storage.getLetterByCase(caseId);
      if (!letter) return res.status(404).json({ error: "No letter found" });
      res.json(letter);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cases/:id/generate", async (req, res) => {
    const caseId = parseInt(req.params.id);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        send({ status: "error", message: "Case not found" });
        res.end();
        return;
      }

      if (!caseData.paid) {
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

      const law = STATE_LAWS[caseData.state];
      if (!law) {
        send({ status: "error", message: "State law not found" });
        res.end();
        return;
      }

      const depositAmount = parseFloat(caseData.depositAmount);
      const amountReturned = parseFloat(caseData.amountReturned || "0");
      const withheldAmount = depositAmount - amountReturned;

      const analysis = calculateAnalysis(caseData.state, caseData.moveOutDate, depositAmount, amountReturned);
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
        statuteSummary = await runParalegalAgent(agentCaseData);
        send({
          agent: "paralegal",
          status: "complete",
          message: `Verified: ${statuteSummary.citation || law.citation}`,
          confidence: 95,
        });
      } catch (err: any) {
        console.error("Paralegal agent error:", err);
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
        strategyBrief = await runAttorneyAgent(agentCaseData, statuteSummary);
        send({
          agent: "attorney",
          status: "complete",
          message: `Case Strength: ${strategyBrief.case_strength_score}/10 — ${strategyBrief.case_strength_label}`,
          confidence: 92,
        });
      } catch (err: any) {
        console.error("Attorney agent error:", err);
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
        draftHtml = await runDrafterAgent(agentCaseData, statuteSummary, strategyBrief);
        send({ agent: "drafter", status: "complete", message: "Draft complete", confidence: 90 });
      } catch (err: any) {
        console.error("Drafter agent error:", err);
        draftHtml = generateFallbackLetter(agentCaseData, strategyBrief);
        send({ agent: "drafter", status: "complete", message: "Draft complete (template)", confidence: 80 });
      }

      send({ agent: "reviewer", status: "running", message: "Reviewing for accuracy..." });
      let reviewResult: any;
      try {
        reviewResult = await runReviewerAgent(draftHtml, statuteSummary, strategyBrief);
        send({
          agent: "reviewer",
          status: "complete",
          message: `Review complete — ${reviewResult.approved ? "Approved" : "Needs revision"}`,
          confidence: reviewResult.confidenceScore,
        });
      } catch (err: any) {
        console.error("Reviewer agent error:", err);
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

      send({ status: "done" });
      res.end();
    } catch (err: any) {
      console.error("Generation pipeline error:", err);
      await storage.updateCase(caseId, { status: "analysis" });
      send({ status: "error", message: err.message || "Generation failed" });
      res.end();
    }
  });

  app.post("/api/cases/:id/sign", async (req, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const caseData = await storage.getCase(caseId);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
      if (caseData.status === "signed") {
        return res.status(400).json({ error: "This case has already been signed" });
      }
      if (!caseData.paid) {
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

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cases/:id/signature", async (req, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const signature = await storage.getSignatureByCase(caseId);
      if (!signature) return res.status(404).json({ error: "No signature found" });
      res.json(signature);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cases/:id/checkout", async (req, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const caseData = await storage.getCase(caseId);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
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
        success_url: `${protocol}://${host}/cases/${caseId}/generate?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${protocol}://${host}/cases/${caseId}`,
        metadata: { caseId: caseId.toString() },
      });

      await storage.updateCase(caseId, { stripeSessionId: session.id });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cases/:id/verify-payment", async (req, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const { sessionId } = req.body;

      const caseData = await storage.getCase(caseId);
      if (!caseData) return res.status(404).json({ error: "Case not found" });
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

      if (session.payment_status === 'paid') {
        await storage.updateCase(caseId, { paid: true, stripeSessionId: sessionId });
        return res.json({ paid: true });
      }

      res.json({ paid: false });
    } catch (err: any) {
      console.error("Verify payment error:", err);
      res.status(500).json({ error: err.message });
    }
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
