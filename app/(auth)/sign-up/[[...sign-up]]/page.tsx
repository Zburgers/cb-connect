import { SignUp } from "@clerk/nextjs";
import SanctuaryShell from "@/components/common/SanctuaryShell";

export default function SignUpPage() {
  return (
    <SanctuaryShell phase="follicular" intensity="soft" className="flex items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-5xl gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div className="text-center md:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Start gently
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-none tracking-tight text-foreground">
            Build a private space for care.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            CB Connect helps couples understand today’s cycle context without turning intimacy into surveillance.
          </p>
        </div>
        <div className="flex justify-center">
          <SignUp
            fallbackRedirectUrl="/dashboard"
            appearance={{
              variables: {
                colorPrimary: "hsl(var(--primary))",
                colorBackground: "var(--color-glass)",
                colorText: "hsl(var(--foreground))",
                colorTextSecondary: "hsl(var(--muted-foreground))",
                borderRadius: "24px",
                fontFamily: "var(--font-ui)",
              },
              elements: {
                cardBox: "shadow-2xl shadow-primary/10",
                card: "backdrop-blur-2xl border border-glass-border",
                headerTitle: "font-display text-3xl",
                formButtonPrimary: "rounded-2xl",
                footer: "bg-transparent",
              },
            }}
          />
        </div>
      </div>
    </SanctuaryShell>
  );
}
