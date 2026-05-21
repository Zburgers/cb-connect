"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Lock, HeartHandshake, Sparkles, Shield, Moon } from "lucide-react";
import SanctuaryShell from "@/components/common/SanctuaryShell";

/* ── Parallax merge ── */
function ParallaxMerge() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const leftX        = useTransform(scrollYProgress, [0, 0.6], ["-60%", "0%"]);
  const rightX       = useTransform(scrollYProgress, [0, 0.6], ["60%",  "0%"]);
  const baseOpacity  = useTransform(scrollYProgress, [0, 0.15, 0.7, 1], [0, 1, 1, 0]);
  const mergeOpacity = useTransform(scrollYProgress, [0.4, 0.65], [0, 1]);
  const mergeScale   = useTransform(scrollYProgress, [0.4, 0.65], [0.7, 1]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-24"
      aria-label="Two people, one rhythm"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <motion.div style={{ x: leftX, opacity: baseOpacity }} className="absolute w-56 h-56 md:w-72 md:h-72 rounded-full">
          <div className="h-full w-full rounded-full"
            style={{ background: "radial-gradient(circle at 40% 40%, oklch(70% 0.20 32 / 0.9), oklch(64% 0.14 22 / 0.5))", filter: "blur(32px) saturate(1.3)" }} />
        </motion.div>
        <motion.div style={{ x: rightX, opacity: baseOpacity }} className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full">
          <div className="h-full w-full rounded-full"
            style={{ background: "radial-gradient(circle at 60% 40%, oklch(66% 0.14 295 / 0.8), oklch(58% 0.10 280 / 0.5))", filter: "blur(28px) saturate(1.2)" }} />
        </motion.div>
        <motion.div style={{ opacity: mergeOpacity, scale: mergeScale }} className="absolute w-80 h-80 md:w-96 md:h-96 rounded-full">
          <div className="h-full w-full rounded-full"
            style={{ background: "radial-gradient(circle at 48% 44%, oklch(76% 0.14 42 / 0.88), oklch(62% 0.12 305 / 0.58))", filter: "blur(40px) saturate(1.4)" }} />
        </motion.div>
      </div>

      <motion.div style={{ opacity: baseOpacity }} className="relative max-w-2xl text-center">
        <span className="phase-badge mb-6 mx-auto block w-fit">For couples</span>
        <h2 className="font-display text-balance overflow-wrap-anywhere"
          style={{ fontSize: "var(--text-display-s)", fontStyle: "italic", lineHeight: 1.05, letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}>
          Two people,<br />one rhythm.
        </h2>
        <p className="mt-6 text-lg leading-8" style={{ color: "hsl(var(--muted-foreground))" }}>
          As you scroll, two separate signals drift together. That's what CB Connect does — it translates her cycle into a shared language you both understand.
        </p>
      </motion.div>
    </section>
  );
}

/* ── Phase mockup card ── */
function PhaseCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="bento-cell-warm relative isolate overflow-hidden"
      style={{ padding: "2rem", borderRadius: "var(--radius-xl)" }}
    >
      <div className="animate-orb-breathe pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full opacity-80"
        style={{ background: "radial-gradient(circle at 38% 36%, oklch(76% 0.16 50 / 0.9), oklch(68% 0.14 32 / 0.6) 45%, transparent)", filter: "blur(24px)" }}
        aria-hidden="true" />
      <div className="relative flex min-h-[28rem] flex-col justify-between gap-6">
        <div className="ml-auto">
          <span className="phase-badge">Day 24</span>
        </div>
        <div>
          <p className="text-5xl leading-none md:text-6xl" aria-hidden="true">🍂</p>
          <h2 className="mt-4 font-display"
            style={{ fontSize: "var(--text-display-s)", fontStyle: "italic", lineHeight: 0.96, letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}>
            Dusk signal
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6" style={{ color: "hsl(var(--muted-foreground))" }}>
            Sensitivity can rise here. A quiet evening and fewer decisions may help more than advice.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.4rem] p-4"
            style={{ background: "oklch(100% 0 0 / 0.55)", backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.5)" }}>
            <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>For her</p>
            <p className="mt-1 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Log a quick body check-in.</p>
          </div>
          <div className="rounded-[1.4rem] p-4"
            style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}>
            <p className="text-sm font-semibold">For partner</p>
            <p className="mt-1 text-xs opacity-75">Handle dinner, keep it soft.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Features ── */
const features = [
  { icon: Moon,          title: "Translate the day",     description: "Cycle phase, pain, and energy become a clear support signal — not raw data." },
  { icon: HeartHandshake,title: "Help without hovering", description: "Partners get care prompts: what to say, what to do, and what to avoid." },
  { icon: Lock,          title: "Consent stays visible", description: "Sharing is explicit, adjustable, and surfaced wherever partner-visible data appears." },
];

/* ── Main client component ── */
export default function LandingClient() {
  return (
    <SanctuaryShell phase="ovulation" intensity="medium" className="flex flex-col">

      {/* N5 floating pill nav */}
      <header className="relative z-50 px-4 pt-5">
        <nav className="nav-pill mx-auto flex max-w-5xl items-center justify-between px-5 py-3" aria-label="Main navigation">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight" style={{ fontStyle: "italic", color: "hsl(var(--foreground))" }}>
            CB Connect
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-white/20 no-tap-highlight"
              style={{ color: "hsl(var(--foreground))" }}>
              Sign in
            </Link>
            <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <Link href="/sign-up" id="nav-cta"
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg no-tap-highlight"
                style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}>
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex-1">

        {/* Split Studio hero */}
        <section className="px-4 pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.05fr_0.95fr] md:items-center">
            <div className="space-y-8">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                <span className="phase-badge">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Built for care, not surveillance
                </span>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="space-y-5">
                <h1 className="font-display text-balance overflow-wrap-anywhere"
                  style={{ fontSize: "var(--text-display)", fontStyle: "italic", lineHeight: 0.94, letterSpacing: "-0.025em", color: "hsl(var(--foreground))" }}>
                  The private rhythm app for couples.
                </h1>
                <p className="max-w-lg text-lg leading-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                  CB Connect turns cycle context into gentle, useful support. Less guessing, less awkwardness, more care at the right moment.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-3 pt-2 sm:flex-row">
                <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Link href="/sign-up" id="hero-cta-primary"
                    className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold shadow-2xl no-tap-highlight"
                    style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}>
                    Create your shared space <ArrowRight className="h-5 w-5" />
                  </Link>
                </motion.div>
                <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Link href="/sign-in" id="hero-cta-secondary"
                    className="inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-semibold no-tap-highlight"
                    style={{ background: "oklch(100% 0 0 / 0.45)", color: "hsl(var(--foreground))", backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.5)" }}>
                    Sign in
                  </Link>
                </motion.div>
              </motion.div>
            </div>

            <PhaseCard />
          </div>
        </section>

        {/* Parallax merge */}
        <ParallaxMerge />

        {/* Features */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Product promise
              </p>
              <h2 className="mt-3 font-display text-balance"
                style={{ fontSize: "var(--text-display-s)", fontStyle: "italic", lineHeight: 1.05, color: "hsl(var(--foreground))" }}>
                Not another clinical tracker with a partner login.
              </h2>
              <p className="mt-4 text-lg leading-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                This is a shared interface for timing, tenderness, and consent.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div key={i} className="bento-cell space-y-4 p-6"
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ background: "oklch(from var(--color-accent) l c h / 0.12)" }}>
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>{f.title}</h3>
                      <p className="mt-2 text-sm leading-6" style={{ color: "hsl(var(--muted-foreground))" }}>{f.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Privacy trust strip */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <motion.div className="bento-cell-warm grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: "oklch(from var(--color-phase-1) l c h / 0.14)" }}>
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>Consent is always visible</h3>
                  <p className="mt-1 text-sm leading-6" style={{ color: "hsl(var(--muted-foreground))" }}>
                    You choose exactly what to share. Your partner sees only what you decide — no silent data streams, no surprises.
                  </p>
                </div>
              </div>
              <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="flex-shrink-0">
                <Link href="/sign-up" id="trust-cta"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-lg no-tap-highlight"
                  style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}>
                  Start with privacy <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
              <h2 className="font-display text-balance"
                style={{ fontSize: "var(--text-display-s)", fontStyle: "italic", lineHeight: 1.05, color: "hsl(var(--foreground))" }}>
                Start with privacy. Grow into support.
              </h2>
              <p className="text-lg leading-8" style={{ color: "hsl(var(--muted-foreground))" }}>
                Invite your partner only when you are ready. Control what is visible. Keep the relationship human.
              </p>
              <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="inline-block">
                <Link href="/sign-up" id="footer-cta"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-10 py-5 text-base font-semibold shadow-2xl no-tap-highlight"
                  style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}>
                  Create your shared space <ArrowRight className="h-5 w-5" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Ft5 Statement footer */}
      <footer className="relative z-10 py-10 text-center"
        style={{ borderTop: "1px solid oklch(0% 0 0 / 0.06)", background: "oklch(100% 0 0 / 0.18)", backdropFilter: "blur(12px)" }}>
        <p className="font-display text-lg" style={{ fontStyle: "italic", color: "hsl(var(--muted-foreground))" }}>Built for couples.</p>
        <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>© {new Date().getFullYear()} CB Connect. Private by design.</p>
      </footer>
    </SanctuaryShell>
  );
}
