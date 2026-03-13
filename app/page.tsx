import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart, Calendar, Bell, Shield, ArrowRight, Sparkles } from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  const features = [
    {
      icon: Calendar,
      title: "Cycle Tracking",
      description: "Track periods and get accurate phase predictions",
    },
    {
      icon: Heart,
      title: "Pain Logging",
      description: "Log daily pain scores and symptoms with ease",
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description: "Get phase-specific tips and reminders",
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Control what data you share with your partner",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 
        dark:from-primary/10 dark:via-background dark:to-secondary/10 pointer-events-none" />
      
      {/* Animated blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl 
          animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl 
          animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-accent/10 rounded-full blur-3xl 
          animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm bg-background/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-secondary 
            bg-clip-text text-transparent">
            CB Connect
          </Link>
          <div className="flex gap-3">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary 
                transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary 
                rounded-full hover:bg-primary/90 transition-all press-feedback shadow-lg 
                shadow-primary/30"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* Hero section */}
        <section className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 
              dark:bg-primary/20 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Track together, support better
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-secondary to-accent 
                bg-clip-text text-transparent">
                CB Connect
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Track cycles, manage pain, and stay connected with your partner. 
              Built for couples who care.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base 
                  font-semibold text-primary-foreground bg-primary rounded-2xl hover:bg-primary/90 
                  transition-all press-feedback shadow-xl shadow-primary/30"
              >
                Start Tracking Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold 
                  text-foreground bg-muted/50 dark:bg-muted/30 rounded-2xl hover:bg-muted/80 
                  transition-all press-feedback"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section className="px-4 py-20 border-t border-border/50 backdrop-blur-sm bg-background/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Everything you need to track together
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed for couples navigating cycle tracking as a team
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={i}
                    className="glass-card rounded-3xl p-6 space-y-4 hover:shadow-xl 
                      transition-all duration-300 animate-slide-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex 
                      items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground mt-2">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="glass-card rounded-3xl p-12 text-center bg-gradient-to-br 
              from-primary/10 via-secondary/10 to-accent/10 dark:from-primary/20 
              dark:via-secondary/20 dark:to-accent/20 border-0 shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Ready to start tracking together?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Join couples who are already using CB Connect to understand cycles better 
                and support each other.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base 
                  font-semibold text-primary-foreground bg-primary rounded-2xl hover:bg-primary/90 
                  transition-all press-feedback shadow-xl shadow-primary/30"
              >
                Get Started for Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 backdrop-blur-sm bg-background/50 
        py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CB Connect. Built for couples.</p>
        </div>
      </footer>
    </div>
  );
}
