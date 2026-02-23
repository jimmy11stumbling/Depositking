# The Deposit Retriever

## Overview
AI-powered legal technology platform that helps residential tenants recover security deposits withheld unfairly or returned past statutory deadlines. Uses a 50-state statutory database, a 4-agent AI team powered by Google Gemini, to deliver an end-to-end solution from case intake to signed demand letters with electronic signature and PDF download. Comprehensive "all-in-one" solution including Evidence Vault, Enhanced Statutory Intelligence, USPS Certified Mail, and Small Claims Court form auto-population.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Express.js with REST API
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Payments**: Stripe (via Replit Stripe Integration) - $29 one-time payment for demand letter
- **AI**: Google Gemini (via Replit AI Integrations) with 4-agent pipeline:
  1. Paralegal Researcher - verifies state statutes
  2. Strategy Attorney - assesses case strength
  3. Demand Letter Drafter - generates professional legal letter
  4. Quality Reviewer - reviews for accuracy and tone
- **Real-time**: Server-Sent Events (SSE) for AI generation progress
- **Certified Mail**: Lob.com API for USPS certified mail delivery (requires LOB_API_KEY)

## Key Files
- `shared/schema.ts` - Database schema and types (cases, deductions, letters, signatures, evidence, deliveries, courtForms)
- `shared/stateLaws.ts` - 50-state security deposit law database with interest rates, special penalties, court info
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database storage layer
- `server/agents.ts` - 4-agent Gemini AI pipeline
- `server/stripeClient.ts` - Stripe client setup (Replit connector)
- `server/webhookHandlers.ts` - Stripe webhook processing
- `server/seed-products.ts` - Script to create Stripe product ($29 Demand Letter)
- `client/src/pages/` - All frontend pages

## User Flow
1. Landing page → Start case
2. 3-step intake form (deposit info, tenant info, landlord info)
3. Case dashboard (violation detection, penalty calculator, deduction disputes, evidence upload)
4. Pay $29 via Stripe Checkout
5. AI letter generation (4-agent pipeline with SSE progress)
6. Letter preview + electronic signature
7. Case finalized → certified mail + court filing prep

## Features
- **Evidence Vault**: SHA-256 hashed file uploads (images + PDF, 10MB max), tamper-proof manifest download
- **Enhanced Penalty Calculator**: Interest calculations (simple/compound), bad faith flat fees, special penalty rules (TX $100+3x)
- **Certified Mail**: USPS certified mail delivery via Lob.com API with tracking
- **Court Forms**: Auto-populated small claims court filing data from case info
- **PDF Download**: Signed demand letters can be downloaded as PDF via html2canvas + jsPDF
- **Dark Mode**: Class-based dark mode with ThemeProvider, localStorage persistence, system preference detection
- **Per-Page SEO Titles**: Dynamic document.title via usePageTitle hook on every page
- **Theme Toggle**: Moon/Sun icon button in every page header (`client/src/components/theme-provider.tsx`)
- **Letter Editing**: Editable letter content with HTML sanitization before signing

## Design Theme
- Slate Navy (#1E3A5F), Authority Blue (#2E5FAA), Gold (#C9A84C)
- Professional legal tech aesthetic
- Font: serif for headings, sans-serif for body
- Dark mode support via CSS variables in `:root` and `.dark` classes

## API Routes
- All POST routes use Zod validation via drizzle-zod insert schemas
- POST `/api/cases` - Create case (insertCaseSchema)
- POST `/api/cases/:id/deductions` - Add deduction (insertDeductionSchema)
- DELETE `/api/cases/:id/deductions/:deductionId` - Remove deduction
- POST `/api/cases/:id/checkout` - Create Stripe checkout session ($29)
- POST `/api/cases/:id/verify-payment` - Verify Stripe payment status
- GET `/api/cases/:id/generate` - SSE stream for AI letter generation (requires payment)
- POST `/api/cases/:id/sign` - Sign letter (custom Zod schema)
- POST `/api/cases/:id/evidence` - Upload evidence file (multipart/form-data)
- GET `/api/cases/:id/evidence` - List evidence files
- GET `/api/cases/:id/evidence/:evidenceId/download` - Download evidence file
- DELETE `/api/cases/:id/evidence/:evidenceId` - Delete evidence file
- GET `/api/cases/:id/evidence/manifest` - Download evidence manifest (SHA-256 chain)
- POST `/api/cases/:id/send-letter` - Send via USPS certified mail (Lob API)
- GET `/api/cases/:id/deliveries` - Get delivery tracking info
- POST `/api/cases/:id/court-forms` - Generate small claims court filing data
- GET `/api/cases/:id/court-forms` - Get generated court forms

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` pushes schema to database
