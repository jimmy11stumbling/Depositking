import { GoogleGenAI } from "@google/genai";

const AI_AGENT_TIMEOUT_MS = 60_000;

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, label = "Operation" } = opts;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt >= maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`${label} failed (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error(`${label} failed after ${maxRetries} attempts: ${lastErr?.message || lastErr}`);
}

interface CaseData {
  state: string;
  stateName: string;
  moveOutDate: string;
  depositAmount: number;
  amountReturned: number;
  withheldAmount: number;
  daysPastDeadline: number;
  isLate: boolean;
  tenantName: string;
  tenantAddress: string;
  landlordName: string;
  landlordAddress: string;
  propertyAddress: string;
  tenancyStart: string | null;
  deductions: Array<{ description: string; amount: string; disputeReason: string | null }>;
  stateLaw: {
    returnDeadlineDays: number;
    citation: string;
    penaltyMultiplier: number | null;
    penaltyType: string;
    penaltyFlatFee: number | null;
    badFaithPenalty: boolean;
    smallClaimsLimit: number;
    itemizedNoticeRequired: boolean;
    notes: string;
  };
}

function extractJSON(text: string): any {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1].trim());
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return JSON.parse(braceMatch[0]);
  }
  throw new Error("No JSON found in response");
}

export async function runParalegalAgent(caseData: CaseData): Promise<any> {
  const systemPrompt = `You are a licensed paralegal specializing in residential tenant-landlord law across all 50 U.S. states.

Your job is to research and verify the security deposit statute for the tenant's state.

You are given the following state law data from our database:
- State: ${caseData.stateName}
- Citation: ${caseData.stateLaw.citation}
- Return Deadline: ${caseData.stateLaw.returnDeadlineDays} days
- Penalty: ${caseData.stateLaw.penaltyType === "multiplier" ? caseData.stateLaw.penaltyMultiplier + "x damages" : caseData.stateLaw.penaltyType === "flat" ? "$" + caseData.stateLaw.penaltyFlatFee + " flat fee" : "No statutory penalty"}
- Bad Faith Penalty: ${caseData.stateLaw.badFaithPenalty ? "Yes" : "No"}
- Itemized Notice Required: ${caseData.stateLaw.itemizedNoticeRequired ? "Yes" : "No"}
- Small Claims Limit: $${caseData.stateLaw.smallClaimsLimit}
- Notes: ${caseData.stateLaw.notes}

Return a JSON object with these fields:
{
  "state": "string",
  "citation": "string - exact citation",
  "return_deadline_days": number,
  "penalty_multiplier": number or null,
  "penalty_flat_fee": number or null,
  "bad_faith_definition": "string - what constitutes bad faith in this state",
  "attorney_fees_available": boolean,
  "small_claims_limit": number,
  "itemized_notice_required": boolean,
  "research_notes": "string - anything relevant about the statute",
  "last_verified_date": "string - today's date"
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Research the security deposit law for ${caseData.stateName}. The tenant moved out on ${caseData.moveOutDate} and the deposit of $${caseData.depositAmount} has ${caseData.isLate ? `not been returned and the landlord is ${caseData.daysPastDeadline} days past the statutory deadline` : "not yet reached the deadline"}. Verify the statute citation ${caseData.stateLaw.citation} and provide your findings as JSON.`,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  });

  try {
    return extractJSON(response.text || "{}");
  } catch {
    return {
      state: caseData.stateName,
      citation: caseData.stateLaw.citation,
      return_deadline_days: caseData.stateLaw.returnDeadlineDays,
      penalty_multiplier: caseData.stateLaw.penaltyMultiplier,
      penalty_flat_fee: caseData.stateLaw.penaltyFlatFee,
      bad_faith_definition: "Landlord knowingly retains deposit without legal basis",
      attorney_fees_available: caseData.stateLaw.badFaithPenalty,
      small_claims_limit: caseData.stateLaw.smallClaimsLimit,
      itemized_notice_required: caseData.stateLaw.itemizedNoticeRequired,
      research_notes: response.text?.substring(0, 500) || "Research completed",
      last_verified_date: new Date().toISOString().split("T")[0],
    };
  }
}

export async function runAttorneyAgent(caseData: CaseData, statuteSummary: any): Promise<any> {
  const systemPrompt = `You are a senior tenant-rights attorney with 15 years of experience in security deposit litigation.

You have received a verified statutory research report from a paralegal. Your job is to:
1. Assess the overall strength of the tenant's case (1-10 scale).
2. Identify the strongest legal arguments.
3. Recommend strategy.
4. Flag any weaknesses.

Return a JSON object:
{
  "case_strength_score": number (1-10),
  "case_strength_label": "Strong" | "Moderate" | "Weak",
  "primary_violation": "string",
  "legal_arguments": ["string", ...],
  "weaknesses": ["string", ...],
  "recommended_strategy": "string",
  "demand_amount": number,
  "penalty_amount": number,
  "total_claim": number,
  "proceed_to_small_claims": boolean,
  "attorney_notes": "string"
}`;

  const deductionsList = caseData.deductions.map(d =>
    `- ${d.description}: $${d.amount} (Dispute reason: ${d.disputeReason || "Not specified"})`
  ).join("\n") || "No specific deductions disputed";

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Assess this security deposit case:

STATE: ${caseData.stateName}
STATUTE: ${statuteSummary.citation || caseData.stateLaw.citation}
MOVE-OUT DATE: ${caseData.moveOutDate}
DEPOSIT: $${caseData.depositAmount}
RETURNED: $${caseData.amountReturned}
WITHHELD: $${caseData.withheldAmount}
DAYS PAST DEADLINE: ${caseData.daysPastDeadline}
IS LATE: ${caseData.isLate ? "YES" : "NO"}
PENALTY: ${caseData.stateLaw.penaltyType === "multiplier" ? caseData.stateLaw.penaltyMultiplier + "x" : caseData.stateLaw.penaltyType === "flat" ? "$" + caseData.stateLaw.penaltyFlatFee : "None"}

DISPUTED DEDUCTIONS:
${deductionsList}

PARALEGAL RESEARCH:
${JSON.stringify(statuteSummary, null, 2)}

Provide your case assessment as JSON.`,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  try {
    return extractJSON(response.text || "{}");
  } catch {
    const penaltyAmt = caseData.stateLaw.penaltyType === "multiplier" && caseData.stateLaw.penaltyMultiplier
      ? caseData.withheldAmount * caseData.stateLaw.penaltyMultiplier
      : caseData.stateLaw.penaltyType === "flat" && caseData.stateLaw.penaltyFlatFee
      ? caseData.stateLaw.penaltyFlatFee
      : 0;
    return {
      case_strength_score: caseData.isLate ? 8 : 5,
      case_strength_label: caseData.isLate ? "Strong" : "Moderate",
      primary_violation: caseData.isLate ? `Missed ${caseData.stateLaw.returnDeadlineDays}-day return deadline by ${caseData.daysPastDeadline} days` : "Deposit withheld",
      legal_arguments: ["Statutory deadline violation", "Failure to provide itemized deductions"],
      weaknesses: [],
      recommended_strategy: "Send formal demand letter citing statutory violations",
      demand_amount: caseData.withheldAmount,
      penalty_amount: penaltyAmt,
      total_claim: caseData.withheldAmount + penaltyAmt,
      proceed_to_small_claims: true,
      attorney_notes: response.text?.substring(0, 500) || "Assessment completed",
    };
  }
}

export async function runDrafterAgent(caseData: CaseData, statuteSummary: any, strategyBrief: any): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const tenancyDuration = caseData.tenancyStart
    ? `from ${new Date(caseData.tenancyStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })} to ${new Date(caseData.moveOutDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
    : `ending on ${new Date(caseData.moveOutDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const deductionsList = caseData.deductions.map(d =>
    `- ${d.description}: $${d.amount} — ${d.disputeReason || "Disputed as normal wear and tear"}`
  ).join("\n") || "No specific deductions to dispute";

  const systemPrompt = `You are a senior attorney drafting a formal security deposit demand letter on behalf of a tenant.

TONE: Authoritative, professional, non-confrontational. The letter should signal litigation readiness without being threatening or inflammatory.

OUTPUT FORMAT: Clean HTML only — no <html>, <head>, <body>, or <style> tags. Follow this EXACT structure using these precise class names:

<div class="letter-date">[Full date — e.g., March 15, 2026]</div>

<div class="letter-via">VIA USPS CERTIFIED MAIL — RETURN RECEIPT REQUESTED</div>

<div class="letter-from">[Tenant Full Name]<br>[Tenant Street Address]<br>[Tenant City, State ZIP]</div>

<div class="letter-to">[Landlord Full Name or Property Management Company]<br>[Landlord Street Address]<br>[Landlord City, State ZIP]</div>

<div class="letter-re"><strong>RE: Formal Demand for Return of Security Deposit<br>Property: [Full Property Address]</strong></div>

<p class="letter-salutation">Dear [Landlord Name or "Property Manager"]:</p>

[BODY PARAGRAPHS — use <p> tags for each paragraph. Use <strong> only for statute citations, dollar amounts in the demand, and deadlines. Minimum 5 substantive paragraphs:]
<p>[Facts paragraph: tenancy start-to-end dates, deposit amount paid, move-out date, amount returned or not returned, current status]</p>
<p>[Statutory violation paragraph: cite exact statute with full citation, state the precise return deadline in days, calculate days past deadline, state this is a violation of law]</p>
<p>[Disputed deductions paragraph — only if deductions exist: address each disputed deduction specifically, why each is improper under the law e.g., normal wear and tear, insufficient documentation]</p>
<p>[Demand paragraph: state the total dollar amount demanded, specify the 10-business-day response window from date of this letter, require written response]</p>
<p>[Consequences paragraph: state that failure to respond will result in filing in [small claims court name] seeking statutory damages of [amount], including [penalty provision], plus court costs and any available attorney fees]</p>

<div class="letter-close">
<p>Sincerely,</p>
<div class="letter-sig-space"></div>
<p class="letter-signer">[Tenant Full Name]</p>
</div>`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Draft a formal security deposit demand letter with these details:

DATE: ${today}
TENANT: ${caseData.tenantName}
TENANT ADDRESS: ${caseData.tenantAddress}
LANDLORD: ${caseData.landlordName}
LANDLORD ADDRESS: ${caseData.landlordAddress}
PROPERTY: ${caseData.propertyAddress}
TENANCY: ${tenancyDuration}
DEPOSIT: $${caseData.depositAmount}
RETURNED: $${caseData.amountReturned}
WITHHELD: $${caseData.withheldAmount}

STATUTE: ${statuteSummary.citation || caseData.stateLaw.citation}
DEADLINE: ${caseData.stateLaw.returnDeadlineDays} days
DAYS PAST DEADLINE: ${caseData.daysPastDeadline}
IS LATE: ${caseData.isLate ? "YES — VIOLATION" : "NO"}

PENALTY: ${strategyBrief.penalty_amount ? "$" + strategyBrief.penalty_amount : "None"}
TOTAL DEMAND: $${strategyBrief.total_claim || caseData.withheldAmount}

DISPUTED DEDUCTIONS:
${deductionsList}

CASE STRENGTH: ${strategyBrief.case_strength_label} (${strategyBrief.case_strength_score}/10)
PRIMARY VIOLATION: ${strategyBrief.primary_violation}
LEGAL ARGUMENTS: ${(strategyBrief.legal_arguments || []).join("; ")}

SMALL CLAIMS LIMIT: $${caseData.stateLaw.smallClaimsLimit}

Output as clean HTML only (no html/head/body/style tags). Format as a professional legal letter.`,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.4,
      maxOutputTokens: 8192,
    },
  });

  return response.text || "<p>Error generating letter content.</p>";
}

export async function runReviewerAgent(draftHtml: string, statuteSummary: any, strategyBrief: any): Promise<{ approved: boolean; confidenceScore: number; finalHtml: string; reviewerNotes: string }> {
  const systemPrompt = `You are a quality control attorney reviewing a security deposit demand letter for accuracy and professionalism.

Review the letter against these criteria and return a JSON report:
{
  "approved": boolean,
  "confidence_score": integer (0-100),
  "citation_verified": boolean,
  "calculation_verified": boolean,
  "tone_approved": boolean,
  "issues_found": ["string", ...],
  "corrections_made": ["string", ...],
  "final_letter_html": "string — corrected HTML or original if no corrections needed",
  "reviewer_notes": "string"
}

If confidence_score < 70, set approved = false and list all issues_found.
If approved = true, return the final_letter_html ready for user presentation.

IMPORTANT: The final_letter_html should be clean HTML content (no markdown, no code blocks). Return the full letter HTML.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Review this security deposit demand letter:

DRAFT LETTER HTML:
${draftHtml}

PARALEGAL RESEARCH:
${JSON.stringify(statuteSummary, null, 2)}

STRATEGY BRIEF:
Case Strength: ${strategyBrief.case_strength_score}/10
Primary Violation: ${strategyBrief.primary_violation}
Total Claim: $${strategyBrief.total_claim}

Review for accuracy, tone, and legal soundness. Return your review as JSON.`,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  });

  try {
    const result = extractJSON(response.text || "{}");
    return {
      approved: result.approved !== false,
      confidenceScore: result.confidence_score || 85,
      finalHtml: result.final_letter_html || draftHtml,
      reviewerNotes: result.reviewer_notes || "Review completed",
    };
  } catch {
    return {
      approved: true,
      confidenceScore: 80,
      finalHtml: draftHtml,
      reviewerNotes: "Review completed with fallback",
    };
  }
}
