import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield, Scale, FileText, Clock, ArrowRight, CheckCircle2, AlertTriangle,
  Zap, Users, MapPin, DollarSign, TrendingUp, Gavel, BadgeCheck, ChevronDown,
  Lock, Mail, Briefcase, Camera, HelpCircle, ChevronRight, Building2, BookOpen,
} from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo, logoSrc } from "@/components/logo";
import { usePageTitle } from "@/hooks/use-page-title";
import { STATE_LAWS } from "../../../shared/stateLaws";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function AnimatedCounter({ end, prefix = "", suffix = "", duration = 2000 }: { end: number; prefix?: string; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

function StateTicker() {
  const tickerItems = useMemo(() => {
    return Object.entries(STATE_LAWS).map(([abbr, law]) => ({
      state: law.state,
      abbr,
      deadline: law.returnDeadlineDays,
      penalty: law.penaltyType === "multiplier" && law.penaltyMultiplier
        ? `${law.penaltyMultiplier}x damages`
        : law.penaltyType === "flat" && law.penaltyFlatFee
        ? `$${law.penaltyFlatFee} penalty`
        : "No statutory penalty",
      hasPenalty: law.penaltyType !== "none",
    }));
  }, []);

  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="ticker-container overflow-hidden relative" data-testid="ticker-container">
      <div className="ticker-track flex gap-6">
        {doubled.map((item, i) => (
          <div
            key={`${item.abbr}-${i}`}
            className="ticker-item flex-shrink-0 flex items-center gap-3 px-4 py-2 rounded-lg border bg-card/80 backdrop-blur-sm"
          >
            <span className="text-xs font-bold text-[#2E5FAA] bg-[#2E5FAA]/10 px-2 py-0.5 rounded">{item.abbr}</span>
            <span className="text-sm font-medium text-foreground whitespace-nowrap">{item.state}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{item.deadline} days</span>
            <span className={`text-xs font-medium whitespace-nowrap ${item.hasPenalty ? "text-[#C9A84C]" : "text-muted-foreground"}`}>
              {item.penalty}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositValidator() {
  const [state, setState] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [result, setResult] = useState<null | {
    isLate: boolean;
    daysPastDeadline: number;
    deadline: number;
    stateName: string;
    penaltyText: string;
    potentialRecovery: number;
    citation: string;
  }>(null);

  const handleValidate = () => {
    if (!state || !depositAmount || !moveOutDate) return;
    const law = STATE_LAWS[state];
    if (!law) return;

    const deposit = parseFloat(depositAmount);
    if (isNaN(deposit) || deposit <= 0) return;

    const moveOut = new Date(moveOutDate);
    const deadlineDate = new Date(moveOut);
    deadlineDate.setDate(deadlineDate.getDate() + law.returnDeadlineDays);
    const now = new Date();
    const daysPast = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
    const isLate = daysPast > 0;

    let penalty = 0;
    let penaltyText = "No statutory penalty applies";
    if (isLate) {
      if (law.penaltyType === "multiplier" && law.penaltyMultiplier) {
        penalty = deposit * law.penaltyMultiplier;
        penaltyText = `${law.penaltyMultiplier}x damages = ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(penalty)}`;
      } else if (law.penaltyType === "flat" && law.penaltyFlatFee) {
        penalty = law.penaltyFlatFee;
        penaltyText = `$${law.penaltyFlatFee} flat penalty`;
      }
    }

    setResult({
      isLate,
      daysPastDeadline: daysPast,
      deadline: law.returnDeadlineDays,
      stateName: law.state,
      penaltyText,
      potentialRecovery: deposit + penalty,
      citation: law.citation,
    });
  };

  const stateOptions = Object.entries(STATE_LAWS).map(([abbr, law]) => ({
    value: abbr,
    label: `${law.state} (${abbr})`,
  }));

  return (
    <Card className="p-0 overflow-hidden border-2 border-[#2E5FAA]/20" data-testid="validator-widget">
      <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2E5FAA] px-5 py-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#C9A84C]" />
          <h3 className="font-serif text-lg font-bold text-white">Instant Deposit Validator</h3>
        </div>
        <p className="text-white/70 text-sm mt-1">Check if your landlord violated the law — free and instant</p>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Your State</label>
          <select
            value={state}
            onChange={(e) => { setState(e.target.value); setResult(null); }}
            className="w-full rounded-md border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2E5FAA]/50"
            data-testid="validator-state"
          >
            <option value="">Select your state...</option>
            {stateOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Deposit Amount</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => { setDepositAmount(e.target.value); setResult(null); }}
              placeholder="2,500"
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2E5FAA]/50"
              data-testid="validator-amount"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Move-Out Date</label>
          <input
            type="date"
            value={moveOutDate}
            onChange={(e) => { setMoveOutDate(e.target.value); setResult(null); }}
            className="w-full rounded-md border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2E5FAA]/50"
            data-testid="validator-date"
          />
        </div>

        <Button
          onClick={handleValidate}
          className="w-full bg-[#C9A84C] text-white border-[#b8963f] text-sm"
          disabled={!state || !depositAmount || !moveOutDate}
          data-testid="button-validate"
        >
          <Zap className="mr-2 h-4 w-4" />
          Check My Deposit
        </Button>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={`rounded-lg p-4 space-y-3 ${
                result.isLate
                  ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
                  : "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900"
              }`} data-testid="validator-result">
                <div className="flex items-center gap-2">
                  {result.isLate ? (
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                  <span className={`font-bold text-sm ${result.isLate ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}>
                    {result.isLate
                      ? `Deadline Violated — ${result.daysPastDeadline} days late`
                      : result.daysPastDeadline < 0
                      ? `${Math.abs(result.daysPastDeadline)} days remaining`
                      : "Deadline is today"}
                  </span>
                </div>
                <div className="text-xs space-y-1.5 text-foreground/80">
                  <p><span className="font-medium">{result.stateName}</span> requires return within <span className="font-bold">{result.deadline} days</span></p>
                  <p className="text-[10px] text-muted-foreground">{result.citation}</p>
                  {result.isLate && (
                    <>
                      <p className="font-medium text-[#C9A84C]">Penalty: {result.penaltyText}</p>
                      <div className="pt-2 border-t border-current/10">
                        <p className="text-base font-bold text-foreground">
                          Potential recovery: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(result.potentialRecovery)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-30px" }}
      variants={fadeUp}
      custom={index * 0.5}
    >
      <Card className="overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between p-5 text-left gap-4 hover:bg-muted/30 transition-colors"
          data-testid={`faq-toggle-${index}`}
          aria-expanded={open}
        >
          <h3 className="font-semibold text-sm text-foreground pr-4">{question}</h3>
          <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-5 pb-5 pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  usePageTitle(undefined, "TenantAdvocate: Get your security deposit back with AI legal demand letters. 50-state coverage, penalty calculation, and certified mail delivery for tenants.");
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.97]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Logo size="md" className="flex-shrink-0 min-w-0 text-sm sm:text-lg" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex text-sm"
              onClick={() => {
                document.getElementById("validator-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              data-testid="button-check-deposit-nav"
            >
              Check My Deposit
            </Button>
            <Button
              size="sm"
              data-testid="button-start-case-header"
              onClick={() => navigate("/new-case")}
              className="text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Start Your Case</span>
              <span className="sm:hidden">Start Case</span>
              <ArrowRight className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </header>

      <motion.section
        className="relative overflow-hidden"
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        <div className="hero-gradient absolute inset-0" />
        <div className="hero-grid absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold tracking-wide uppercase mb-6">
                  <Scale className="h-3.5 w-3.5" />
                  AI-Powered Legal Technology
                </div>
              </motion.div>

              <motion.h1
                className="font-serif text-4xl sm:text-5xl xl:text-6xl font-bold text-foreground leading-[1.1] mb-5"
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={1}
              >
                Your Landlord Owes You{" "}
                <span className="relative inline-block">
                  <span className="text-[#C9A84C]">Money.</span>
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                    <path d="M1 5.5C47 2 153 2 199 5.5" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                  </svg>
                </span>
                <br />
                <span className="text-[#2E5FAA]">We'll Get It Back.</span>
              </motion.h1>

              <motion.p
                className="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed mb-8"
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={2}
              >
                4 specialized AI legal agents analyze your state's laws, calculate penalties
                your landlord owes, and generate a court-ready demand letter in under 15 minutes.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row items-start gap-3 mb-8"
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={3}
              >
                <Button
                  size="lg"
                  data-testid="button-start-case-hero"
                  onClick={() => navigate("/new-case")}
                  className="text-base px-8 h-12 bg-[#C9A84C] text-white border-[#b8963f] shadow-lg shadow-[#C9A84C]/20"
                >
                  Start Free Analysis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground pl-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No credit card required</span>
                </div>
              </motion.div>

              <motion.div
                className="grid grid-cols-3 gap-4"
                initial="hidden"
                animate="visible"
                variants={stagger}
              >
                {[
                  { value: 1200, prefix: "$", suffix: "+", label: "Avg. Recovery" },
                  { value: 50, suffix: " States", label: "Full Coverage" },
                  { value: 15, suffix: " Min", label: "Start to Finish" },
                ].map((stat) => (
                  <motion.div key={stat.label} variants={scaleIn} className="text-center sm:text-left">
                    <div className="text-2xl sm:text-3xl font-bold text-foreground font-serif">
                      <AnimatedCounter end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block"
            >
              <DepositValidator />
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
        </div>
      </motion.section>

      <section className="py-3 px-4 sm:px-6 border-y bg-card/30 relative overflow-hidden">
        <div className="ticker-fade-left absolute left-0 top-0 bottom-0 w-16 z-10" />
        <div className="ticker-fade-right absolute right-0 top-0 bottom-0 w-16 z-10" />
        <StateTicker />
      </section>

      <section id="validator-section" className="py-12 px-4 sm:px-6 lg:hidden">
        <div className="max-w-md mx-auto">
          <DepositValidator />
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium text-muted-foreground mb-4">
              <Gavel className="h-3 w-3" />
              Simple Process
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Three Steps to Your Money
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our AI legal team handles the complexity. You just answer a few questions.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                step: "01",
                title: "Tell Us Your Situation",
                desc: "Enter your state, move-out date, and deposit details. Our system instantly cross-references your state's specific statutes.",
                accent: "from-blue-500/10 to-blue-600/5",
              },
              {
                icon: Scale,
                step: "02",
                title: "AI Analyzes Your Case",
                desc: "4 specialized agents — Paralegal, Attorney, Drafter, and Reviewer — work together to build your strongest possible case.",
                accent: "from-[#C9A84C]/10 to-amber-600/5",
              },
              {
                icon: Shield,
                step: "03",
                title: "Edit, Sign & Send",
                desc: "Review and edit your letter, sign electronically, then download the PDF to send via certified mail with return receipt.",
                accent: "from-green-500/10 to-green-600/5",
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
                <Card className="p-6 h-full relative group hover-elevate">
                  <div className={`absolute inset-0 rounded-[inherit] bg-gradient-to-br ${item.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E3A5F] to-[#2E5FAA] flex items-center justify-center shadow-lg shadow-[#2E5FAA]/10">
                        <item.icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-3xl font-serif font-bold text-muted-foreground/20">{item.step}</span>
                    </div>
                    <h3 className="font-serif text-lg font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-card/50 border-y">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium text-muted-foreground mb-4">
              <AlertTriangle className="h-3 w-3" />
              The Problem
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              $4.6 Billion in Deposits Wrongfully Withheld Every Year
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Landlords count on tenants not knowing their rights. Here's what we see every day.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Clock, problem: "Missed statutory deadlines", impact: "Your landlord had a specific number of days to return your deposit. If they missed it, they may owe you double or triple.", stat: "72%" },
              { icon: DollarSign, problem: "Bogus deductions for normal wear", impact: "Charging for paint touch-ups, carpet cleaning, or minor wall holes? That's often illegal under your state's law.", stat: "$850" },
              { icon: Users, problem: "Complete deposit retention", impact: "Some landlords simply never return the deposit, banking on tenants not taking action. The law is on your side.", stat: "34%" },
              { icon: TrendingUp, problem: "No formal demand letter sent", impact: "Most tenants don't know how to write a legally effective demand letter. Our AI drafts one citing exact statutes.", stat: "89%" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="p-5 h-full hover-elevate">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-[#C9A84C]" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-foreground text-sm">{item.problem}</h3>
                        <span className="text-xs font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">{item.stat}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.impact}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium text-muted-foreground mb-4">
              <BadgeCheck className="h-3 w-3" />
              All-In-One Solution
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Everything You Need for $29
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From evidence collection through court-ready filings — no other service covers this much.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Scale, title: "4-Agent AI Legal Team", desc: "Paralegal, Attorney, Drafter, and Reviewer work together like a real law firm to build your strongest case.", color: "from-[#1E3A5F] to-[#2E5FAA]" },
              { icon: Camera, title: "Evidence Vault", desc: "Upload photos and documents. Each file is SHA-256 hashed with timestamps — tamper-proof evidence your landlord can't dispute.", color: "from-blue-600 to-blue-700" },
              { icon: MapPin, title: "50-State Statutory Database", desc: "Exact deadlines, penalty multipliers, interest rates, and special rules for every state — automatically applied to your case.", color: "from-[#C9A84C] to-amber-600" },
              { icon: Mail, title: "USPS Certified Mail (+$12)", desc: "We print, mail, and track your demand letter via USPS Certified Mail with delivery confirmation — all handled for you.", color: "from-green-600 to-green-700" },
              { icon: Lock, title: "Electronic Signature", desc: "Sign your letter digitally with a legally binding electronic signature. Edit before signing if needed.", color: "from-purple-600 to-purple-700" },
              { icon: Briefcase, title: "Small Claims Court Prep", desc: "If your landlord doesn't respond, we auto-populate court filing forms with your case data so you're ready to sue.", color: "from-red-500 to-red-600" },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="p-5 h-full hover-elevate">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm mb-1.5">{item.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 sm:py-32 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#1E3A5F] to-[#2E5FAA]" />
        <div className="hero-grid absolute inset-0 opacity-[0.05]" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#C9A84C]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2E5FAA]/20 rounded-full blur-3xl" />

        <motion.div
          className="relative z-10 max-w-3xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          custom={0}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 text-xs font-medium text-white/70 mb-6">
            <DollarSign className="h-3 w-3" />
            One-Time Fee: $29
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight">
            Average Recovery:{" "}
            <span className="text-[#C9A84C]">$1,200+</span>
          </h2>
          <p className="text-white/70 mb-10 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
            Most landlords return the deposit after receiving a professional demand letter
            citing exact statutory violations and penalty amounts. Your $29 investment typically returns 40x or more.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              data-testid="button-start-case-cta"
              onClick={() => navigate("/new-case")}
              className="text-base px-10 h-13 bg-[#C9A84C] text-white border-[#b8963f] shadow-xl shadow-black/20"
            >
              Start Your Free Case Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-white/50">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Free analysis</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Evidence vault</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Certified mail</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Court prep</span>
          </div>
        </motion.div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-card/50 border-y" data-testid="section-tenant-rights">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium text-muted-foreground mb-4">
              <BookOpen className="h-3 w-3" />
              Know Your Rights
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Security Deposit Laws by State
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every state has different rules for security deposit returns, penalties, and tenant protections.
              TenantAdvocate tracks all 50 states so you don't have to.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              { state: "California", deadline: "21 days", penalty: "Up to 2x deposit in bad faith", law: "Cal. Civ. Code § 1950.5" },
              { state: "New York", deadline: "14 days", penalty: "Full deposit + damages", law: "GOL § 7-108" },
              { state: "Texas", deadline: "30 days", penalty: "$100 + 3x deposit", law: "Tex. Prop. Code § 92.109" },
              { state: "Florida", deadline: "15-30 days", penalty: "Full deposit + court costs", law: "Fla. Stat. § 83.49" },
              { state: "Illinois", deadline: "30-45 days", penalty: "2x deposit", law: "765 ILCS 710" },
              { state: "Pennsylvania", deadline: "30 days", penalty: "2x deposit", law: "68 Pa.C.S. § 250.512" },
            ].map((item, i) => (
              <motion.div
                key={item.state}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="p-5 h-full hover-elevate" data-testid={`card-state-law-${item.state.toLowerCase()}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-[#2E5FAA]" />
                    <h3 className="font-serif font-bold text-foreground">{item.state}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Return deadline:</span>
                      <span className="font-medium text-foreground">{item.deadline}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Penalty:</span>
                      <span className="font-medium text-[#C9A84C]">{item.penalty}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1 border-t">{item.law}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              custom={0}
            >
              <Card className="p-6 h-full">
                <h3 className="font-serif text-lg font-bold text-foreground mb-4">What Landlords Cannot Deduct</h3>
                <ul className="space-y-2.5">
                  {[
                    "Normal wear and tear — faded paint, minor carpet wear, small nail holes",
                    "Pre-existing damage documented before move-in",
                    "Routine cleaning between tenants (unless unit was left excessively dirty)",
                    "Appliance depreciation from normal use over time",
                    "Repairs for issues reported during tenancy but never fixed",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              custom={1}
            >
              <Card className="p-6 h-full">
                <h3 className="font-serif text-lg font-bold text-foreground mb-4">When to Take Legal Action</h3>
                <ul className="space-y-2.5">
                  {[
                    "Landlord missed the statutory deadline to return your deposit",
                    "Deductions are for normal wear and tear, not actual damage",
                    "No itemized statement of deductions was provided",
                    "Deposit was not held in a separate escrow account (required in some states)",
                    "Landlord is unresponsive to written requests for deposit return",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-[#C9A84C] mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6" data-testid="section-faq">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium text-muted-foreground mb-4">
              <HelpCircle className="h-3 w-3" />
              FAQ
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Frequently Asked Questions About Security Deposits
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything renters need to know about getting their security deposit back.
            </p>
          </motion.div>

          <div className="space-y-3">
            {[
              {
                q: "How do I get my security deposit back from my landlord?",
                a: "Start by knowing your state's statutory deadline for deposit return (typically 14-60 days after move-out). Document the condition you left the property in with photos and videos. Then send a formal demand letter citing your state's specific statutes and penalties. If your landlord doesn't respond, file in small claims court. TenantAdvocate automates this entire process with AI-powered demand letter generation, evidence management, certified mail delivery, and court filing preparation — all for $29.",
              },
              {
                q: "What is considered normal wear and tear vs. damage?",
                a: "Normal wear and tear includes: faded or slightly worn paint, minor scuffs on floors, small nail holes from hanging pictures, worn carpet in high-traffic areas, minor scratches on countertops, and slightly dirty grout. Damage includes: large holes in walls, broken windows, pet stains or odors, burn marks, unauthorized paint colors, and broken fixtures. Landlords cannot legally charge tenants for normal wear and tear — it's an expected cost of renting out property.",
              },
              {
                q: "How long does my landlord have to return my security deposit?",
                a: "It depends on your state. California requires return within 21 days, New York within 14 days, Texas within 30 days, and Florida within 15-30 days depending on whether deductions are claimed. Other states range from 14 to 60 days. TenantAdvocate's 50-state database tracks every state's exact deadline and automatically calculates whether your landlord has violated the timeline.",
              },
              {
                q: "What penalties can my landlord face for not returning my deposit on time?",
                a: "Penalties vary significantly by state. Many states impose double or triple damages (2x-3x the deposit amount). Texas imposes $100 plus 3x the withheld amount. California allows 2x damages in bad faith cases. Some states also require landlords to pay interest on the deposit and/or the tenant's attorney fees. TenantAdvocate automatically calculates the maximum penalties available under your state's specific laws.",
              },
              {
                q: "Can I sue my landlord in small claims court for my deposit?",
                a: "Absolutely. Small claims court is the most common and accessible venue for security deposit disputes. Filing fees typically range from $30-$75, and you don't need a lawyer. Most states allow claims up to $5,000-$10,000 in small claims court. The key to winning is strong documentation: a professional demand letter, evidence of the property's condition at move-out, and knowledge of your state's statutes. TenantAdvocate provides all three.",
              },
              {
                q: "Should I send my demand letter via certified mail?",
                a: "Yes, strongly recommended. Certified mail with return receipt creates a legal record proving your landlord received the letter, demonstrates you're serious about pursuing your claim, and provides admissible evidence in court. Many states require written notice before filing suit. TenantAdvocate offers integrated USPS certified mail delivery with tracking for just $12.",
              },
              {
                q: "My landlord charged me for carpet cleaning — is that legal?",
                a: "It depends on your state and the condition of the carpet. In most states, landlords cannot charge for professional carpet cleaning if the carpet shows only normal wear and tear. However, if there are pet stains, burns, or other damage beyond normal use, the landlord may have a valid claim. Many states explicitly prohibit carpet cleaning deductions unless the lease specifically requires it AND the carpet was cleaned before move-in.",
              },
              {
                q: "Do I need a lawyer to get my security deposit back?",
                a: "No. Most security deposit disputes are handled in small claims court, where lawyers are often not even allowed. TenantAdvocate's 4-agent AI legal team generates demand letters that are comparable to what an attorney would draft, citing your state's exact statutes and maximum penalties — for $29 instead of the $200-$500+ a lawyer would charge. If your case is complex, we recommend consulting a licensed attorney.",
              },
              {
                q: "What if my landlord already sent me a deduction list?",
                a: "Review each deduction carefully. Landlords often charge for normal wear and tear (illegal in every state), pre-existing damage, or inflated repair costs. TenantAdvocate helps you identify which deductions are legitimate and which violate your state's laws, then generates a demand letter disputing the specific illegal deductions with statutory citations.",
              },
              {
                q: "How does TenantAdvocate's AI legal team work?",
                a: "TenantAdvocate uses 4 specialized AI agents: (1) A Paralegal Researcher that verifies your state's exact statutes, deadlines, and penalty provisions. (2) A Strategy Attorney that assesses your case strength and identifies the strongest legal arguments. (3) A Demand Letter Drafter that generates a professional legal letter with all relevant facts, citations, and calculations. (4) A Quality Reviewer that checks for accuracy, tone, and completeness. The entire process takes under 15 minutes.",
              },
            ].map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      <footer className="py-10 px-4 sm:px-6 border-t" data-testid="footer">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <Logo size="md" />
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>All 50 States</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>AI-Powered Analysis</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>$29 Per Letter</span>
            </div>
          </div>
          <div className="border-t pt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <a href="mailto:support@tenantadvocate.com" className="hover:text-foreground transition-colors">
                support@tenantadvocate.com
              </a>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 hidden sm:block" />
              <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 hidden sm:block" />
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 hidden sm:block" />
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30 hidden sm:block" />
              <span>© {new Date().getFullYear()} TenantAdvocate</span>
            </div>
            <p className="text-[11px] text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed">
              TenantAdvocate is the leading AI-powered security deposit recovery platform for renters across the United States.
              We help tenants in all 50 states recover deposits withheld unfairly or returned past statutory deadlines.
              Our services include AI demand letter generation, penalty and interest calculation, tamper-proof evidence management,
              USPS certified mail delivery, and small claims court preparation.
            </p>
            <p className="text-[11px] text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed">
              Common searches: how to get security deposit back, landlord won't return deposit, security deposit demand letter,
              tenant rights by state, normal wear and tear vs damage, security deposit laws, landlord tenant dispute,
              small claims court security deposit, apartment deposit not returned, rental deposit recovery, unfair deductions from deposit.
            </p>
            <p className="text-[10px] text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
              This platform is not a law firm and does not provide legal advice. AI-generated demand letters
              are tools for tenant self-representation based on publicly available statutes and user-provided facts.
              Consult a licensed attorney for complex legal matters or questions specific to your situation.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
