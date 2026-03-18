# TenantAdvocate — Product Requirements Document

**Version:** 1.0  
**Date:** March 2026  
**Status:** Active Development

---

## 1. Executive Summary

TenantAdvocate is an AI-powered legal technology platform that helps US residential tenants recover security deposits that have been withheld unfairly or returned past statutory deadlines. The platform combines a 51-jurisdiction statutory database, a 4-agent Gemini AI pipeline, USPS Certified Mail delivery via Lob.com, and a SHA-256 hashed Evidence Vault to give tenants a complete self-service legal tool — from intake to a signed, mailed demand letter — at a fraction of the cost of hiring an attorney.

**Core value proposition:** A tenant can go from knowing nothing about their legal rights to having a professionally drafted, signed, and mailed demand letter in under 15 minutes for $29–$41.

---

## 2. Problem Statement

### The Gap

Each year, US landlords collect an estimated $45 billion in security deposits. Studies consistently show that 40–50% of tenants do not receive their full deposit back, and the majority of those who are wrongly denied never pursue it — not because they lack a valid claim, but because:

- They don't know their state's specific statutes, deadlines, or penalties
- Hiring a lawyer costs more than the deposit is worth
- The legal letter-writing process is intimidating and time-consuming
- Sending certified mail and documenting everything properly feels complex

### The Opportunity

Every state has tenant-protection statutes with strict return deadlines and automatic penalty multipliers for landlords who violate them. In many states, a landlord who fails to return a deposit on time owes **2–3× the withheld amount** in statutory penalties — making many cases highly winnable. TenantAdvocate makes those rights accessible without a law degree.

---

## 3. Target Users

### Primary Persona — The Wronged Renter
- **Age:** 22–40
- **Situation:** Recently moved out; landlord has not returned deposit or returned less than expected
- **Tech comfort:** Moderate — comfortable with web apps, mobile-first
- **Legal knowledge:** Little to none about state security deposit statutes
- **Motivation:** Recover money they believe is rightfully theirs
- **Barrier:** Doesn't know where to start; assumes lawyers are required

### Secondary Persona — The Documented Disputer
- **Situation:** Landlord sent an itemized deduction list; tenant disagrees with line items
- **Need:** A formal letter disputing specific deductions with legal citations
- **Additional value:** Evidence Vault to attach move-out photos and inspection reports

### Out of Scope (v1)
- Commercial tenants
- International users
- Landlords (the opposing party)
- Tenants in active eviction proceedings

---

## 4. Goals & Success Metrics

| Goal | Key Metric | Target |
|---|---|---|
| Tenant conversion | % of visitors who start a case | > 15% |
| Payment conversion | % of case-starters who pay $29 | > 25% |
| Certified mail attach rate | % of letter buyers who add $12 mail | > 40% |
| Letter quality | User satisfaction rating | > 4.5 / 5 |
| Time to letter | Minutes from intake to generated letter | < 10 min |
| Repeat usage | Cases per user token | — (v1 single-use) |
| Support volume | Tickets per 100 cases | < 5 |

---

## 5. Product Features

### 5.1 Case Intake (Free)

**3-step wizard:**

**Step 1 — Deposit Details**
- State selector (all 50 states + DC)
- Deposit amount paid
- Amount returned by landlord (can be $0)
- Move-out date
- Tenancy start date (optional, needed for interest calculation)
- Itemized deductions landlord claims (description, amount, dispute reason)

**Step 2 — Tenant Information**
- Full legal name
- Current mailing address (used as the "From" address on certified mail)

**Step 3 — Landlord Information**
- Landlord or property management company name
- Mailing address (used as the "To" address on certified mail and demand letter)
- Rental property address

**Acceptance criteria:**
- All required fields validated before proceeding
- Case saved to DB immediately on submit; access token stored in localStorage
- Token-based access — no account required

---

### 5.2 Case Dashboard (Free)

The central hub for a case. Always accessible with the case token.

**Violation Detection Panel**
- Automatically determines if landlord missed the state return deadline
- Shows days past deadline
- Displays the applicable statute citation
- Color-coded status: on-time / approaching deadline / violated

**Penalty Calculator**
- Calculates maximum statutory claim:
  - Withheld deposit amount
  - Statutory penalty (flat fee, multiplier, or percentage by state)
  - Interest (simple or compound where applicable)
  - Bad faith penalty where state law provides it
  - Special rules (e.g., Texas: $100 + 3× withheld)
- Shows a formatted financial breakdown table

**Case Strength Score (Free)**
- Deterministic 1–10 score computed from: deadline violation, penalty type, bad faith indicators, disputed deduction count
- Displayed as a circular badge with color coding: Strong (green) / Moderate (amber) / Weak (red)
- Includes a plain-language verdict sentence
- No API cost — computed locally on the server

**Violation Report PDF (Free)**
- Downloadable PDF generated client-side via jsPDF
- Contains: case parties, violation status, financial breakdown table, disputed deductions list, state law reference, legal disclaimer
- Branded with TenantAdvocate navy/gold color scheme

**Deduction Management**
- Add / remove disputed deductions before generating the letter
- Each deduction has: description, amount, dispute reason
- All deductions are included in the AI letter generation prompt

**Evidence Vault (Free)**
- Upload images (JPG, PNG, WebP, HEIC, HEIF, GIF) and PDFs up to 10MB each
- Files stored as base64 in PostgreSQL with SHA-256 hash fingerprint
- Tamper-proof manifest download (JSON) showing hash chain for all uploaded files
- Download or delete individual evidence items

---

### 5.3 AI Letter Generation ($29 one-time)

**Payment gate:** Stripe Checkout ($29, one-time, no subscription)

**4-Agent Gemini Pipeline** (real-time progress via Server-Sent Events):

| Agent | Role | Output |
|---|---|---|
| Paralegal Researcher | Verifies state statutes, deadlines, and penalties from the 51-jurisdiction database | Structured case research |
| Strategy Attorney | Assesses case strength, identifies strongest legal arguments, recommends penalty claims | Legal strategy memo |
| Demand Letter Drafter | Writes the complete demand letter in proper legal format with citations | Full HTML letter |
| Quality Reviewer | Reviews for legal accuracy, tone, and completeness | Final approved letter |

**Letter content includes:**
- Date and "Via USPS Certified Mail" header
- Tenant and landlord address blocks
- RE: line with property address
- Opening citing applicable statute and deadline
- Factual timeline of deposit and move-out
- Disputed deductions with legal basis for dispute
- Exact dollar demand (deposit + statutory penalties + interest)
- Demand for response within 10 business days
- Notice of intent to file in small claims court
- Professional closing

**Letter Preview & Edit:**
- Full rendered preview of the letter with professional legal styling
- Inline editor for manual corrections before signing
- HTML sanitized before saving

**Electronic Signature:**
- Canvas-based signature drawing pad
- Signature stored as base64 PNG
- Embedded in PDF and in the Lob.com print file
- Case status set to "signed" on completion — cannot be undone

**PDF Download:**
- html2canvas renders the letter to canvas
- jsPDF compiles into a multi-page PDF
- Downloaded locally; not stored server-side

---

### 5.4 USPS Certified Mail Delivery ($12 add-on)

Available after the letter is signed.

**What the tenant gets:**
- Letter printed, stuffed, and mailed by Lob.com within 1 business day
- USPS First Class mail with Certified Mail extra service
- Return receipt (green card) — legal proof of delivery
- Tracking number shown in the app
- Expected delivery date (typically 3–5 business days)

**Technical flow:**
1. Parse tenant and landlord addresses using robust US address parser (handles multi-word cities, apartment numbers, newline-delimited addresses)
2. Pre-flight validation: ensures street, city, and ZIP are present for both parties with specific error messages if not
3. Submit to Lob.com `/v1/letters` API with styled print HTML (Times New Roman 12pt, 1-inch margins)
4. Store tracking number, Lob letter ID, expected delivery date, and status in `deliveries` table
5. Display delivery card on both letter page and dashboard

**Failure handling:**
- Address validation errors surface specific field-level messages to the user
- Lob API errors return the Lob error message to the user
- Duplicate send prevention (one delivery per case)

---

### 5.5 Small Claims Court Filing Prep (Free after signing)

After the letter is signed, auto-populated court filing data is generated:

- State small claims court name
- Court filing fee
- Small claims dollar limit for the state
- Plaintiff and defendant information pre-filled
- Claim amount and breakdown
- Cause of action text citing applicable statute
- Filing instructions tailored to state

Displayed in a structured card on the dashboard. Intended as a reference for the tenant if the landlord does not respond.

---

## 6. User Flow

```
Landing Page
    │
    ▼
Start Case (3-step intake wizard)
    │
    ▼
Case Dashboard ──────────────────────────────────────────────┐
    │                                                         │
    │  [Free]                                                 │
    ├── View Violation Status                                  │
    ├── View Penalty Calculation                              │
    ├── View Case Strength Score                              │
    ├── Download Violation Report PDF                         │
    ├── Add/Remove Disputed Deductions                        │
    └── Upload Evidence Files                                 │
                                                              │
    ▼  [Pay $29]                                              │
Generate Letter (Stripe Checkout)                             │
    │                                                         │
    ▼                                                         │
AI Generation Page (SSE progress)                            │
    │  → Paralegal Research                                    │
    │  → Attorney Strategy                                    │
    │  → Draft Letter                                         │
    │  → Quality Review                                       │
    │                                                         │
    ▼                                                         │
Letter Preview Page                                           │
    │                                                         │
    ├── Edit letter (optional)                                │
    ├── Sign letter (canvas signature)                        │
    │       │                                                 │
    │       ▼  [After signing]                               │
    │  ┌────────────────────────────────────────────┐        │
    │  │  Send via USPS Certified Mail [$12 add-on] │        │
    │  │  → Lob.com prints & mails                 │        │
    │  │  → Tracking number displayed              │        │
    │  └────────────────────────────────────────────┘        │
    │                                                         │
    ├── Download PDF                                          │
    └── Back to Dashboard ────────────────────────────────────┘
            │
            └── Small Claims Court Filing Prep
```

---

## 7. 51-Jurisdiction Statutory Database

The `stateLaws.ts` file contains structured law data for all 50 states plus DC:

| Field | Description |
|---|---|
| `returnDeadlineDays` | Days landlord has to return deposit after move-out |
| `penaltyType` | `"multiplier"`, `"flat"`, `"percentage"`, `"none"` |
| `penaltyMultiplier` | e.g., `2` for 2× withheld, `3` for 3× |
| `badFaithPenalty` | Whether state provides additional bad faith damages |
| `interestRequired` | Whether interest must accrue on deposit |
| `interestRate` | Annual interest rate (where applicable) |
| `interestType` | `"simple"` or `"compound"` |
| `citation` | Full statute citation (e.g., "Cal. Civ. Code § 1950.5") |
| `smallClaimsLimit` | Maximum claim in small claims court |
| `smallClaimsCourtName` | Jurisdiction-specific court name |
| `smallClaimsFilingFee` | Typical filing fee |

---

## 8. Pricing Model

| Product | Price | Notes |
|---|---|---|
| Case Analysis & Dashboard | Free | No payment required |
| Violation Report PDF | Free | No payment required |
| Case Strength Score | Free | No payment required |
| Evidence Vault | Free | No payment required |
| AI Demand Letter | $29 | One-time, includes generation + signature + PDF |
| USPS Certified Mail | $12 | Add-on after signing; covers print, postage, and certified mail |

**Total maximum spend per case: $41**

**Revenue model:** Transactional. No subscriptions, no recurring charges. Each case is independent.

---

## 9. Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query v5, Wouter |
| Backend | Express.js, TypeScript, tsx (dev), Node.js 20 |
| Database | PostgreSQL (Neon) via Drizzle ORM |
| AI | Google Gemini 1.5 Pro via Replit AI Integration |
| Payments | Stripe via Replit Stripe connector |
| Certified Mail | Lob.com REST API |
| PDF (client) | jsPDF + html2canvas |
| File Upload | Multer (memory storage, 10MB limit) |
| Real-time | Server-Sent Events (SSE) for AI generation progress |

### Database Schema

| Table | Purpose |
|---|---|
| `cases` | Core case data (parties, deposit, status, payment flags) |
| `deductions` | Disputed deduction line items |
| `letters` | Generated letter HTML (draft and final) |
| `signatures` | Base64 signature image + timestamp |
| `evidence` | SHA-256 hashed file uploads (base64 stored) |
| `deliveries` | Lob.com mail delivery records with tracking |
| `court_forms` | Auto-populated small claims filing data |

### Access Control

- No user accounts in v1
- Each case gets a UUID access token on creation
- Token stored in browser `localStorage`
- All case API routes validate the token (path param or `x-case-token` header)
- No public listing of cases — access is token-only

### Security Hardening

- Content Security Policy headers
- HSTS
- CORS origin validation
- Rate limiting per endpoint class (uploads: 20/15min, generate: 5/hr, checkout: 10/15min, sign: 10/15min)
- Express body size limit: 1MB (JSON), 10MB (multipart via Multer)
- Filename sanitization on evidence downloads
- `Content-Disposition: attachment` on all file downloads
- HTML sanitization via DOMPurify (client) and sanitize-html (server) before letter storage
- Payment bypass prevention: `mailPaid` omitted from insert schema
- Generic server error messages (no stack traces in production)
- Deduction ownership verified before delete

---

## 10. Pages & Routes

| Route | Page | Auth |
|---|---|---|
| `/` | Landing page | Public |
| `/new-case` | 3-step intake wizard | Public |
| `/cases` | Cases list (localStorage tokens) | Token |
| `/cases/:id` | Case dashboard | Token |
| `/cases/:id/generate` | AI generation progress | Token + paid |
| `/cases/:id/letter` | Letter preview, edit, sign | Token + paid |
| `/privacy` | Privacy Policy | Public |
| `/terms` | Terms of Service | Public |

---

## 11. Out of Scope — v1

- User accounts / login / email verification
- Case history synced across devices (token-loss = case-loss)
- Email receipts or notifications
- Lob.com webhook for delivery status updates (currently polling not implemented)
- Landlord response tracking
- Mediation or negotiation tools
- Attorney referral network
- Mobile native apps (iOS / Android)
- International jurisdiction support
- Batch/bulk case management

---

## 12. Known Limitations (Current)

| Limitation | Severity | Notes |
|---|---|---|
| No cross-device case access | Medium | Token in localStorage; lost if browser data cleared |
| No email receipt | Medium | User must bookmark their case URL |
| No delivery status webhooks | Low | Lob tracking number shown; user must check USPS.com |
| Base64 file storage | Low | Not ideal for scale; should migrate to S3 or equivalent |
| Single case per flow | Low | No UI to manage multiple cases simultaneously |
| No attorney review option | Low | Purely self-service |

---

## 13. Future Roadmap

### Near-term (v1.1–v1.2)
- Email case access link (no account required — just a magic link)
- Lob.com delivery status webhooks → real-time tracking in app
- Landlord response tracking ("They responded" flow)
- Multi-case dashboard (manage multiple cases from one browser)

### Medium-term (v2)
- User accounts with email/password or Google OAuth
- Cross-device case sync
- Attorney referral network for complex cases
- File storage migration to S3 (presigned URLs for uploads/downloads)
- Stripe subscription tier for property managers (bulk access)

### Long-term (v3+)
- Settlement negotiation assistant
- Small claims court e-filing integration (where available)
- Landlord reputation database (aggregate public outcomes)
- Tenant community and peer support
- Spanish-language support

---

## 14. Legal & Compliance

- **Not a law firm.** TenantAdvocate is a legal technology platform, not legal advice. All generated letters include a mandatory disclaimer.
- **Terms of Service** covers user representations (accuracy of information, lawful use)
- **Privacy Policy** covers data sharing with Google (Gemini), Stripe, and Lob.com
- **Refund policy:** Full refund before generation; no refund after letter is generated; no refund after certified mail submitted to Lob.com
- **Data retention:** Cases retained for as long as the tenant holds their access token; no automated purge in v1

---

## 15. Support

- Contact: support@tenantadvocate.com
- Linked from footer on all pages
- No in-app chat in v1
