import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Scale, FileText, Clock, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-[#2E5FAA]" />
            <span className="font-serif text-lg font-bold text-foreground tracking-tight">
              The Deposit Retriever
            </span>
          </div>
          <Button
            data-testid="button-start-case-header"
            onClick={() => navigate("/new-case")}
          >
            Start Your Case
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2E5FAA]/10 text-[#2E5FAA] text-sm font-medium mb-6">
              <Scale className="h-3.5 w-3.5" />
              AI-Powered Legal Technology
            </div>
          </motion.div>

          <motion.h1
            className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Get Your Security Deposit{" "}
            <span className="text-[#2E5FAA]">Back</span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Our AI legal team analyzes your case, calculates penalties your landlord
            owes, and generates a professional demand letter — all in under 15 minutes.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Button
              size="lg"
              data-testid="button-start-case-hero"
              onClick={() => navigate("/new-case")}
              className="text-base px-8 bg-[#C9A84C] text-white border-[#b8963f]"
            >
              Start Free Analysis
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <p className="text-sm text-muted-foreground">
              No credit card required. Takes 5 minutes.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-4 px-4 sm:px-6 border-y bg-card/50">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            50-State Coverage
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            AI Legal Analysis
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            Professional Demand Letters
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            Penalty Calculator
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-3">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Three simple steps to recover what's rightfully yours
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: FileText,
                step: "1",
                title: "Tell Us Your Situation",
                desc: "Enter your state, move-out date, and deposit amount. We'll instantly check if your landlord has violated the law.",
              },
              {
                icon: Scale,
                step: "2",
                title: "AI Analyzes Your Case",
                desc: "Our team of 4 specialized AI agents researches current statutes, assesses case strength, and drafts a professional demand letter.",
              },
              {
                icon: Shield,
                step: "3",
                title: "Sign & Send",
                desc: "Review the generated letter, sign electronically, and we'll prepare it for certified mail delivery to your landlord.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="p-6 h-full relative">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#2E5FAA]/10 flex items-center justify-center">
                      <span className="text-[#2E5FAA] font-bold text-sm">{item.step}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-card/50 border-y">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Why Tenants Lose Their Deposits
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Common problems our platform solves
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { problem: "Unaware of exact statutory deadlines", impact: "Deposits go unchallenged past deadline" },
              { problem: "Landlords charge for normal wear and tear", impact: "Wrongful deductions totaling $200-$2,000+" },
              { problem: "Landlords ignore return entirely", impact: "100% deposit loss" },
              { problem: "Demand letters are intimidating to write", impact: "Tenants give up without taking action" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="p-5">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.problem}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.impact}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-4">
            Average Recovery: $1,200+
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Most landlords return the deposit after receiving a professional demand letter
            citing exact statutory violations and penalty amounts.
          </p>
          <Button
            size="lg"
            data-testid="button-start-case-cta"
            onClick={() => navigate("/new-case")}
            className="text-base px-8 bg-[#C9A84C] text-white border-[#b8963f]"
          >
            Start Your Free Case Analysis
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="py-8 px-4 sm:px-6 border-t">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-[#2E5FAA]" />
            <span className="font-serif text-sm font-bold text-foreground">The Deposit Retriever</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto">
            This platform is not a law firm and does not provide legal advice. AI-generated letters
            are tools for tenant self-representation. Consult an attorney for complex legal matters.
          </p>
        </div>
      </footer>
    </div>
  );
}
