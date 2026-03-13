import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { usePageTitle } from "@/hooks/use-page-title";

export default function TermsOfServicePage() {
  usePageTitle("Terms of Service — TenantAdvocate", "Read TenantAdvocate's Terms of Service governing your use of our AI-powered security deposit recovery platform.");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <Logo size="sm" showText={false} />
            <span className="font-serif text-sm font-bold text-foreground">TenantAdvocate</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 13, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using TenantAdvocate ("Service," "we," "our," or "us") at tenantadvocate.com, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. We reserve the right to modify these Terms at any time; continued use of the Service constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">2. Not a Law Firm — No Attorney-Client Relationship</h2>
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 mb-3">
              <p className="text-amber-800 dark:text-amber-200 font-medium">
                IMPORTANT: TenantAdvocate is not a law firm and does not provide legal advice. Use of this Service does not create an attorney-client relationship. The AI-generated demand letters, legal analysis, and statutory information provided are informational tools for tenant self-representation only, based on publicly available statutes and the facts you provide.
              </p>
            </div>
            <p className="text-muted-foreground">
              For complex legal matters, disputes involving significant sums, or situations involving potential counterclaims, we strongly recommend consulting a licensed attorney in your jurisdiction. Laws vary by state and locality and may change. We make reasonable efforts to keep our statutory database current but cannot guarantee complete accuracy at all times.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">3. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 18 years of age and a legal resident of the United States to use this Service. By using the Service, you represent and warrant that you meet these requirements. The Service is intended for personal, non-commercial use by residential tenants to assist with security deposit recovery disputes.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">4. Description of Service</h2>
            <p className="text-muted-foreground mb-3">TenantAdvocate provides:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>AI-powered analysis of security deposit disputes based on state-specific statutes</li>
              <li>Automated drafting of demand letters citing applicable laws and penalty provisions</li>
              <li>An Evidence Vault for uploading and managing supporting documentation</li>
              <li>Electronic signature capability for finalizing demand letters</li>
              <li>PDF download of signed demand letters</li>
              <li>USPS Certified Mail delivery of demand letters (as an add-on service)</li>
              <li>Small claims court filing preparation data</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">5. Payments and Refunds</h2>
            <h3 className="font-semibold mb-2 text-base">Pricing</h3>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground mb-4">
              <li><strong>Demand Letter Generation:</strong> $29 one-time payment per case</li>
              <li><strong>USPS Certified Mail Delivery:</strong> $12 add-on per letter</li>
            </ul>
            <h3 className="font-semibold mb-2 text-base">Refund Policy</h3>
            <p className="text-muted-foreground mb-3">
              Because our service involves AI generation that consumes computational resources, refunds are handled as follows:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Before generation begins:</strong> Full refund available within 24 hours of payment.</li>
              <li><strong>After generation completes:</strong> No refund, as the computational work has been performed and the letter delivered.</li>
              <li><strong>Certified mail ($12):</strong> No refund once the letter has been submitted to Lob.com for printing.</li>
              <li><strong>Technical failures:</strong> If our Service fails to generate your letter due to a technical error on our end, you are entitled to a full refund or a retry at no additional charge.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              To request a refund, contact <a href="mailto:support@tenantadvocate.com" className="text-[#2E5FAA] hover:underline">support@tenantadvocate.com</a> within 7 days of payment.
            </p>
            <p className="text-muted-foreground mt-2">
              All payments are processed by Stripe. By making a payment, you agree to Stripe's Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">6. User Responsibilities and Representations</h2>
            <p className="text-muted-foreground mb-3">By using the Service, you represent and warrant that:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>All information you provide is accurate, complete, and truthful</li>
              <li>You are the tenant named in the rental agreement referenced in your case</li>
              <li>You have the right to use any evidence files you upload (you took the photos, own the documents, etc.)</li>
              <li>You will not use the Service to harass, threaten, or make false claims against landlords or any other party</li>
              <li>You understand the demand letter is a starting point for a dispute and does not guarantee recovery of your deposit</li>
              <li>You will review the generated letter for accuracy before signing and sending it</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">7. Accuracy of AI-Generated Content</h2>
            <p className="text-muted-foreground">
              Our AI system is designed to produce accurate demand letters based on current state statutes, but AI-generated content may contain errors, omissions, or outdated information. You are responsible for reviewing your demand letter for accuracy before signing and sending it. TenantAdvocate is not liable for outcomes resulting from errors in AI-generated content that you could have identified through reasonable review.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The TenantAdvocate platform, including its design, software, AI models, and statutory database, is owned by TenantAdvocate and protected by applicable intellectual property laws. The demand letter generated for your specific case is yours to use for your personal legal dispute. You may not resell, sublicense, or commercially exploit the generated content or any portion of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TENANTADVOCATE AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-muted-foreground mt-3">
              OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE AMOUNTS YOU PAID TO TENANTADVOCATE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">10. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless TenantAdvocate and its affiliates from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">11. Prohibited Uses</h2>
            <p className="text-muted-foreground mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Submit false or fraudulent case information</li>
              <li>Use the Service on behalf of another person without their express authorization</li>
              <li>Attempt to reverse-engineer, copy, or reproduce the Service or its AI models</li>
              <li>Use automated tools, bots, or scripts to access the Service</li>
              <li>Circumvent any payment mechanisms or access controls</li>
              <li>Upload malicious files or attempt to compromise the security of the Service</li>
              <li>Use the Service for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">12. Governing Law and Dispute Resolution</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law provisions. Any dispute arising from these Terms or the Service shall first be submitted to good-faith negotiation. If unresolved, disputes shall be settled by binding arbitration administered by JAMS under its Streamlined Arbitration Rules and Procedures. You waive any right to participate in a class action lawsuit or class-wide arbitration.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">13. Termination</h2>
            <p className="text-muted-foreground">
              We reserve the right to suspend or terminate your access to the Service at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, provisions that by their nature should survive (including Limitation of Liability, Indemnification, and Governing Law) will survive termination.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">14. Contact</h2>
            <p className="text-muted-foreground">Questions about these Terms? Contact us:</p>
            <div className="mt-3 p-4 rounded-lg bg-muted/50 border text-muted-foreground">
              <p className="font-medium text-foreground">TenantAdvocate</p>
              <p>Email: <a href="mailto:legal@tenantadvocate.com" className="text-[#2E5FAA] hover:underline">legal@tenantadvocate.com</a></p>
              <p>Support: <a href="mailto:support@tenantadvocate.com" className="text-[#2E5FAA] hover:underline">support@tenantadvocate.com</a></p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t py-8 px-4 sm:px-6 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
