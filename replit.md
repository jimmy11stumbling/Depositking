# The Deposit Retriever

## Overview
AI-powered legal technology platform that helps residential tenants recover security deposits withheld unfairly or returned past statutory deadlines. Uses a 50-state statutory database, a 4-agent AI team powered by Google Gemini, to deliver an end-to-end solution from case intake to signed demand letters.

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

## Key Files
- `shared/schema.ts` - Database schema and types
- `shared/stateLaws.ts` - 50-state security deposit law database
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
3. Case dashboard (violation detection, penalty calculator, deduction disputes)
4. Pay $29 via Stripe Checkout
5. AI letter generation (4-agent pipeline with SSE progress)
6. Letter preview + electronic signature
7. Case finalized (signed status)

## Features
- **PDF Download**: Signed demand letters can be downloaded as PDF via html2canvas + jsPDF
- **Dark Mode**: Class-based dark mode with ThemeProvider, localStorage persistence, system preference detection
- **Per-Page SEO Titles**: Dynamic document.title via usePageTitle hook on every page
- **Theme Toggle**: Moon/Sun icon button in every page header (`client/src/components/theme-provider.tsx`)

## Design Theme
- Slate Navy (#1E3A5F), Authority Blue (#2E5FAA), Gold (#C9A84C)
- Professional legal tech aesthetic
- Font: serif for headings, sans-serif for body
- Dark mode support via CSS variables in `:root` and `.dark` classes

## API Routes
- All POST routes use Zod validation via drizzle-zod insert schemas
- POST `/api/cases` - Create case (insertCaseSchema)
- POST `/api/cases/:id/deductions` - Add deduction (insertDeductionSchema)
- POST `/api/cases/:id/checkout` - Create Stripe checkout session ($29)
- POST `/api/cases/:id/verify-payment` - Verify Stripe payment status
- GET `/api/cases/:id/generate` - SSE stream for AI letter generation (requires payment)
- POST `/api/cases/:id/sign` - Sign letter (custom Zod schema)

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` pushes schema to database
