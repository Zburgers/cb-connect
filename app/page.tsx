import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, HeartHandshake, Lock, Moon, Sparkles } from "lucide-react";
import SanctuaryShell from "@/components/common/SanctuaryShell";
import GlassPanel from "@/components/common/GlassPanel";

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  const promises = [
    {
      icon: Moon,
      title: "Translate the day",
      description: "Cycle phase, pain, and energy become a clear support signal instead of raw data.",
    },
    {
      icon: HeartHandshake,
      title: "Help without hovering",
      description: "Partners get care prompts that answer what to say, what to do, and what to avoid.",
    },
    {
      icon: Lock,
      title: "Consent stays visible",
      description: "Sharing is explicit, adjustable, and surfaced wherever partner-visible data appears.",
    },
  ];

  return (
    <SanctuaryShell phase="ovulation" intensity="medium" className="flex flex-col">
      {/* Header */}
      <header className="relative z-10 border-b border-white/30 bg-white/24 backdrop-blur-2xl dark:border-white/10 dark:bg-black/18">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-foreground">
            CB Connect
          </Link>
          <div className="flex gap-3">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg shadow-foreground/10 transition-all press-feedback dark:bg-white dark:text-slate-950"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* Hero section */}
        <section className="flex-1 px-4 py-20 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.05fr_0.95fr] md:items-center">
            <div className="space-y-8 animate-slide-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/38 px-4 py-2 text-sm font-semibold text-primary backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
              <Sparkles className="w-4 h-4" />
                Built for care, not surveillance
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl font-display text-6xl font-semibold leading-[0.92] tracking-tight text-foreground md:text-8xl">
                  The private rhythm app for couples.
                </h1>

                <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                  CB Connect turns cycle context into gentle, useful support. Less guessing, less awkwardness, more care at the right moment.
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-2 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] bg-foreground px-8 py-4 text-base font-semibold text-background shadow-2xl shadow-foreground/10 transition-all press-feedback dark:bg-white dark:text-slate-950"
                >
                  Create your shared space
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center rounded-[1.4rem] bg-white/[0.42] px-8 py-4 text-base font-semibold text-foreground backdrop-blur-xl transition-all press-feedback hover:bg-white/60 dark:bg-white/8 dark:hover:bg-white/[0.12]"
                >
                  Sign In
                </Link>
              </div>
            </div>

            <GlassPanel variant="warm" className="relative min-h-[31rem] overflow-hidden p-6">
              <div className="phase-aura-field animate-aura-drift absolute left-1/2 top-6 h-72 w-72 -translate-x-1/2 rounded-full opacity-80" />
              <div className="relative flex min-h-[28rem] flex-col justify-between">
                <div className="ml-auto w-fit rounded-full border border-white/50 bg-white/[0.45] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
                  Day 24
                </div>
                <div>
                  <p className="text-7xl" aria-hidden="true">🍂</p>
                  <h2 className="mt-4 max-w-sm font-display text-5xl font-semibold leading-none">
                    Dusk signal
                  </h2>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                    Sensitivity can rise here. A quiet evening and fewer decisions may help more than advice.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-white/50 p-4 backdrop-blur-xl dark:bg-white/8">
                    <p className="text-sm font-semibold">For her</p>
                    <p className="mt-1 text-xs text-muted-foreground">Log a quick body check-in.</p>
                  </div>
                  <div className="rounded-3xl bg-foreground p-4 text-background dark:bg-white dark:text-slate-950">
                    <p className="text-sm font-semibold">For partner</p>
                    <p className="mt-1 text-xs opacity-75">Handle dinner, keep it soft.</p>
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>
        </section>

        {/* Features section */}
        <section className="px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Product promise
              </p>
              <h2 className="font-display text-4xl font-semibold text-foreground md:text-5xl">
                Not another clinical tracker with a partner login.
              </h2>
              <p className="text-lg leading-8 text-muted-foreground">
                This is a shared interface for timing, tenderness, and consent.
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-3">
              {promises.map((promise, i) => {
                const Icon = promise.icon;
                return (
                  <GlassPanel
                    key={i}
                    className="space-y-4 p-6 transition-all duration-300 animate-slide-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{promise.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{promise.description}</p>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <GlassPanel variant="elevated" className="p-10 text-center md:p-12">
              <h2 className="mb-4 font-display text-4xl font-semibold text-foreground md:text-5xl">
                Start with privacy. Grow into support.
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg leading-8 text-muted-foreground">
                Invite your partner only when you are ready. Control what is visible. Keep the relationship human.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-[1.4rem] bg-foreground px-8 py-4 text-base font-semibold text-background shadow-xl shadow-foreground/10 transition-all press-feedback dark:bg-white dark:text-slate-950"
              >
                Create your shared space
                <ArrowRight className="w-5 h-5" />
              </Link>
            </GlassPanel>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/30 bg-white/20 py-8 backdrop-blur-xl dark:border-white/10 dark:bg-black/18">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CB Connect. Built for couples.</p>
        </div>
      </footer>
    </SanctuaryShell>
  );
}
