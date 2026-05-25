import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield, Scale, FileText, Lock, Mail, Clock, Zap, Users,
  CheckCircle2, ArrowRight, Server, Fingerprint, BookOpen,
  Globe, Briefcase, Gavel,
} from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import { usePageTitle } from "@/hooks/use-page-title";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function AboutPage() {
  usePageTitle("About TenantAdvocate — AI Legal Technology for Tenants", "Learn about TenantAdvocate's mission, security practices, AI legal team, and how we help tenants recover security deposits across all 50 states.");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Logo size="md" className="flex-shrink-0 min-w-0 text-sm sm:text-lg" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
            <Button size="sm" variant="outline" className="hidden sm:inline-flex text-sm" asChild>
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold tracking-wide uppercase mb-6">
            <Scale className="h-3.5 w-3.5" />
            About Us
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Legal Technology Built for Tenants
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            TenantAdvocate is an AI-powered legal technology platform that helps residential tenants recover security deposits withheld unfairly or returned past statutory deadlines. We combine a 50-state statutory database with a team of specialized AI legal agents to deliver an end-to-end solution from case intake to signed demand letters.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {[
            {
              icon: Shield,
              title: "Tenant-First Mission",
              desc: "We believe tenants deserve the same legal firepower landlords have. Our platform levels the playing field by making professional legal demand letters accessible to everyone for a flat $29 fee.",
            },
            {
              icon: Lock,
              title: "Privacy & Security",
              desc: "Your data is encrypted in transit (HTTPS/TLS) and at rest. Evidence files are SHA-256 hashed for tamper-proof integrity. We never store payment card numbers. Cases are accessed via unique tokens stored only in your browser.",
            },
            {
              icon: Zap,
              title: "4-Agent AI Legal Team",
              desc: "Our AI pipeline mimics a real law firm: a Paralegal researches statutes, a Strategy Attorney assesses your case, a Drafter writes the letter, and a Quality Reviewer checks for accuracy before you see it.",
            },
            {
              icon: Globe,
              title: "50-State Coverage",
              desc: "Every state has different deadlines, penalties, and court procedures. Our statutory database tracks them all — from California's 21-day rule to Texas's $100 + 3x penalty — automatically applied to your case.",
            },
          ].map((item, i) => (
            <motion.div key={item.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <Card className="p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1E3A5F] to-[#2E5FAA] flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="mb-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              From start to finish in under 15 minutes.
            </p>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { step: "1", icon: FileText, label: "Enter Your Case", desc: "State, deposit, move-out date, and landlord info." },
              { step: "2", icon: Zap, label: "AI Analysis", desc: "4 agents research laws and assess your case strength." },
              { step: "3", icon: Gavel, label: "Review & Sign", desc: "Edit the letter if needed, then sign electronically." },
              { step: "4", icon: Mail, label: "Send & Track", desc: "Download as PDF or mail via USPS Certified Mail." },
            ].map((s, i) => (
              <div key={s.step} className="relative">
                {i < 3 && (
                  <div className="hidden sm:block absolute top-8 left-[60%] right-0 h-0.5 bg-border" />
                )}
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1E3A5F] to-[#2E5FAA] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#2E5FAA]/10">
                    <s.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">Step {s.step}</span>
                  <h4 className="font-semibold text-foreground mt-1">{s.label}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="mb-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-3">Security & Trust</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Your case data and evidence are protected by industry-standard security measures.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Server, label: "AES-256 Encryption", desc: "Data encrypted at rest in our PostgreSQL database." },
              { icon: Fingerprint, label: "SHA-256 Evidence Hashing", desc: "Every uploaded file gets a tamper-proof hash. Download a manifest for court." },
              { icon: Shield, label: "No Stored Passwords", desc: "Cases are accessed via unique browser tokens. No login required, no passwords to breach." },
              { icon: Lock, label: "Stripe Payment Security", desc: "Payments processed by Stripe. We never see your card number." },
              { icon: Briefcase, label: "Not a Law Firm", desc: "We are a legal technology platform, not attorneys. Our tools empower self-representation." },
              { icon: Clock, label: "3-Year Data Retention", desc: "Case data and evidence retained to support your legal proceedings." },
            ].map((item, i) => (
              <Card key={item.label} className="p-5">
                <item.icon className="h-5 w-5 text-[#2E5FAA] mb-3" />
                <h4 className="font-semibold text-sm text-foreground mb-1">{item.label}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="mb-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-3">Meet Your AI Legal Team</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Four specialized agents work in sequence, just like a real law firm.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: BookOpen, role: "Paralegal Researcher", color: "from-blue-500 to-blue-600", desc: "Verifies your state's security deposit statute, deadlines, penalties, and recent case law." },
              { icon: Scale, role: "Strategy Attorney", color: "from-[#C9A84C] to-amber-600", desc: "Assesses case strength (1-10), identifies strongest legal arguments, and flags weaknesses." },
              { icon: FileText, role: "Demand Letter Drafter", color: "from-green-500 to-green-600", desc: "Writes a professional, citation-rich demand letter tailored to your case facts." },
              { icon: Shield, role: "Quality Reviewer", color: "from-purple-500 to-purple-600", desc: "Reviews the letter for accuracy, tone, and legal soundness before you see it." },
            ].map((agent) => (
              <Card key={agent.role} className="p-5 text-center">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center mx-auto mb-3`}>
                  <agent.icon className="h-5 w-5 text-white" />
                </div>
                <h4 className="font-semibold text-sm text-foreground">{agent.role}</h4>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{agent.desc}</p>
              </Card>
            ))}
          </div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold tracking-wide uppercase mb-6">
            <Users className="h-3.5 w-3.5" />
            For Tenants, By Tenants
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Ready to Get Your Deposit Back?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Start your free case analysis now. No credit card required until you are ready to generate your demand letter.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="bg-[#C9A84C] text-white border-[#b8963f] text-base px-8" asChild>
              <Link href="/new-case">
                Start Free Analysis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>No credit card required</span>
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="py-10 px-4 sm:px-6 border-t">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
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
