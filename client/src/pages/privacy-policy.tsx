import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { usePageTitle } from "@/hooks/use-page-title";

export default function PrivacyPolicyPage() {
  usePageTitle("Privacy Policy — TenantAdvocate", "TenantAdvocate's Privacy Policy explains how we collect, use, and protect your personal information when you use our security deposit recovery platform.");

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
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 13, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">1. Overview</h2>
            <p className="text-muted-foreground">
              TenantAdvocate ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered security deposit recovery platform at tenantadvocate.com (the "Service"). Please read this policy carefully. If you do not agree with its terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">2. Information We Collect</h2>
            <h3 className="font-semibold mb-2 text-base">Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground mb-4">
              <li>Your name and contact information</li>
              <li>Your current and former rental property addresses</li>
              <li>Your landlord's name and address</li>
              <li>Security deposit amount and move-out dates</li>
              <li>Details about deductions and disputes</li>
              <li>Evidence files (photographs, PDFs, documents) you upload</li>
              <li>Electronic signature data</li>
              <li>Payment information (processed securely by Stripe — we never store raw card numbers)</li>
            </ul>
            <h3 className="font-semibold mb-2 text-base">Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Browser type and version</li>
              <li>Pages visited and time spent</li>
              <li>IP address and approximate geographic location</li>
              <li>Referring website</li>
              <li>Device type and operating system</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Generate your AI-powered demand letter and legal analysis</li>
              <li>Process payments securely through Stripe</li>
              <li>Deliver your demand letter via USPS Certified Mail through Lob.com</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Improve our AI models and platform features</li>
              <li>Send transactional communications (receipts, tracking updates)</li>
              <li>Comply with applicable law and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">4. How We Share Your Information</h2>
            <p className="text-muted-foreground mb-3">We do not sell your personal information. We share it only as follows:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Google (Gemini AI)</strong> — Your case details are sent to Google's Gemini API to generate your demand letter. Google's data processing terms apply.</li>
              <li><strong>Stripe</strong> — Payment processing. Stripe's Privacy Policy governs how they handle your payment data.</li>
              <li><strong>Lob.com</strong> — If you purchase certified mail delivery, your name, address, and letter content are transmitted to Lob.com to print and mail your letter via USPS.</li>
              <li><strong>Legal requirements</strong> — We may disclose information if required by law, court order, or government authority.</li>
              <li><strong>Business transfers</strong> — If TenantAdvocate is acquired or merged, your information may transfer to the new entity subject to the same privacy protections.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard security measures including HTTPS/TLS encryption in transit, AES encryption at rest for sensitive data, SHA-256 tamper-proof hashing for evidence files, and access controls limiting who can view your case data. Your cases are protected by unique access tokens stored only in your browser. We never store plain-text passwords.
            </p>
            <p className="text-muted-foreground mt-3">
              No method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security but take commercially reasonable steps to protect your information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your case data for as long as necessary to provide the Service and comply with our legal obligations. Evidence files and generated letters are retained for a minimum of 3 years to support your legal proceedings. You may request deletion of your data by contacting us at <a href="mailto:privacy@tenantadvocate.com" className="text-[#2E5FAA] hover:underline">privacy@tenantadvocate.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground mb-3">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Access</strong> — Request a copy of the personal data we hold about you</li>
              <li><strong>Correction</strong> — Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion</strong> — Request deletion of your personal data (subject to legal retention requirements)</li>
              <li><strong>Portability</strong> — Request your data in a portable format</li>
              <li><strong>Opt-out of marketing</strong> — Unsubscribe from any marketing communications at any time</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              To exercise these rights, contact us at <a href="mailto:privacy@tenantadvocate.com" className="text-[#2E5FAA] hover:underline">privacy@tenantadvocate.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground">
              We use localStorage (not traditional cookies) to store your case access tokens locally in your browser. We may use analytics tools that set cookies to understand how users interact with the Service. You can disable cookies in your browser settings, though this may affect Service functionality.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">9. Children's Privacy</h2>
            <p className="text-muted-foreground">
              The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">10. California Privacy Rights (CCPA)</h2>
            <p className="text-muted-foreground">
              California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete personal information, and the right to opt out of the sale of personal information. We do not sell personal information. To exercise your CCPA rights, contact us at <a href="mailto:privacy@tenantadvocate.com" className="text-[#2E5FAA] hover:underline">privacy@tenantadvocate.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated "Last updated" date. Your continued use of the Service after changes become effective constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-3 p-4 rounded-lg bg-muted/50 border text-muted-foreground">
              <p className="font-medium text-foreground">TenantAdvocate</p>
              <p>Email: <a href="mailto:privacy@tenantadvocate.com" className="text-[#2E5FAA] hover:underline">privacy@tenantadvocate.com</a></p>
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
