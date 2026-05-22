"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Eye, EyeOff, Copy, Check, ChevronUp, X } from "lucide-react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

const CARE_ACTIONS = [
  {
    id: "quiet-evening",
    emoji: "🌙",
    label: "Plan a quiet evening",
    detail: "Suggest staying in. Less decisions, more comfort.",
    copy: "Hey, let's have a quiet evening tonight — just us, no plans.",
  },
  {
    id: "check-in",
    emoji: "💬",
    label: "Send a check-in",
    detail: "A warm, low-pressure message.",
    copy: "Just checking in. No need to reply — I'm thinking of you. ❤️",
  },
  {
    id: "dinner",
    emoji: "🍜",
    label: "Handle dinner tonight",
    detail: "Take one decision off the table.",
    copy: "I'm handling dinner tonight. You just rest.",
  },
  {
    id: "space",
    emoji: "🌿",
    label: "Give space",
    detail: "Sometimes the best care is distance.",
    copy: null,
  },
] as const;

function CareChip({
  action,
}: {
  action: (typeof CARE_ACTIONS)[number];
}) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const handleCopy = () => {
    if (!action.copy) return;
    navigator.clipboard.writeText(action.copy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSendHeart = () => {
    // Optimistic: show "sent" state. Real-time receiver is a future sprint.
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <motion.div
      className="rounded-[1.4rem] p-4"
      style={{
        background: "var(--color-glass)",
        backdropFilter: "blur(12px)",
        boxShadow: "inset 0 1px 0 var(--color-glass-border)",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none pt-0.5" aria-hidden="true">
            {action.emoji}
          </span>
          <div>
            <p className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>
              {action.label}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              {action.detail}
            </p>
          </div>
        </div>

        {action.id === "check-in" || action.id === "quiet-evening" || action.id === "dinner" ? (
          <motion.button
            onClick={handleCopy}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            aria-label={copied ? "Copied" : "Copy message"}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors no-tap-highlight"
            style={{
              background: copied ? "hsl(var(--primary))" : "oklch(100% 0 0 / 0.6)",
              color: copied ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </motion.button>
        ) : action.id === "space" ? (
          <motion.button
            onClick={handleSendHeart}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            aria-label={sent ? "Signal sent" : "Send a quiet signal"}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors no-tap-highlight"
            style={{
              background: sent ? "hsl(var(--secondary))" : "oklch(100% 0 0 / 0.6)",
              color: sent ? "hsl(var(--secondary-foreground))" : "hsl(var(--muted-foreground))",
            }}
          >
            <Heart className={`h-4 w-4 ${sent ? "fill-current" : ""}`} />
          </motion.button>
        ) : null}
      </div>
    </motion.div>
  );
}

export default function PartnerStatusCard() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.queries.users.getMe, isLoaded ? {} : "skip");
  const coupleStatus = useQuery(
    api.queries.couples.getCoupleStatus,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!isLoaded || me === undefined || coupleStatus === undefined) return null;

  const isLinked      = coupleStatus?.isLinked;
  const isPartner     = me?.role === "partner";
  const partnerName   = coupleStatus?.partner?.name ?? "your partner";
  const primaryInviteTitle =
    me?.gender === "male"
      ? "Invite your partner into your rhythm"
      : "Let your special one take care of you";

  /* ── Not linked — Partner ── */
  if (!isLinked && isPartner) {
    return (
      <motion.div
        className="bento-cell cursor-pointer p-6"
        onClick={() => router.push("/dashboard/partner")}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/dashboard/partner"); } }}
        aria-label="Connect with your partner"
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "oklch(from var(--color-secondary) l c h / 0.12)" }}
          >
            <Heart className="h-6 w-6" style={{ color: "hsl(var(--secondary))" }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Connect with your partner
            </h3>
            <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Stay informed and support their journey
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Not linked — Primary ── */
  if (!isLinked && !isPartner) {
    return (
      <motion.div
        className="bento-cell cursor-pointer p-6"
        onClick={() => router.push("/dashboard/partner")}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/dashboard/partner"); } }}
        aria-label="Invite your partner"
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "oklch(from var(--color-accent) l c h / 0.12)" }}
          >
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              {primaryInviteTitle}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Share your cycle journey with your partner
            </p>
            <motion.button
              onClick={(e) => { e.stopPropagation(); router.push("/dashboard/partner"); }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="mt-4 rounded-full px-5 py-2 text-sm font-semibold no-tap-highlight"
              style={{
                background: "hsl(var(--foreground))",
                color: "hsl(var(--background))",
              }}
              aria-label="Invite partner"
            >
              Invite Partner →
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Linked — Care Action Card ── */
  return (
    <div className="bento-cell overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between gap-4 p-6"
        style={{ borderBottom: drawerOpen ? "1px solid oklch(0% 0 0 / 0.05)" : "none" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, oklch(from var(--color-accent) l c h / 0.15), oklch(from var(--color-secondary) l c h / 0.15))",
            }}
          >
            <Heart className="h-5 w-5 fill-current" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "hsl(var(--foreground))" }}>
              Connected with {partnerName}
            </p>
            <div className="mt-0.5 flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {coupleStatus.sharingSettings?.phase
                  ? <Eye className="h-3.5 w-3.5" />
                  : <EyeOff className="h-3.5 w-3.5" />}
                Period
              </span>
              <span className="flex items-center gap-1 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {coupleStatus.sharingSettings?.pain
                  ? <Eye className="h-3.5 w-3.5" />
                  : <EyeOff className="h-3.5 w-3.5" />}
                Pain
              </span>
            </div>
          </div>
        </div>

        {/* Care action drawer toggle */}
        <motion.button
          onClick={() => setDrawerOpen((v) => !v)}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold no-tap-highlight"
          style={{
            background: drawerOpen ? "hsl(var(--foreground))" : "oklch(100% 0 0 / 0.6)",
            color: drawerOpen ? "hsl(var(--background))" : "hsl(var(--muted-foreground))",
            backdropFilter: "blur(8px)",
          }}
          aria-expanded={drawerOpen}
          aria-label="Toggle care actions"
        >
          {isPartner ? "How to help" : "Care actions"}
          <motion.div
            animate={{ rotate: drawerOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </motion.div>
        </motion.button>
      </div>

      {/* ── Glassmorphic Care Action Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-6 pb-6 pt-4 space-y-3">
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-4"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {isPartner ? "What today asks from you" : "Quick ways to show care"}
              </p>
              {CARE_ACTIONS.map((action, i) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 22 }}
                >
                  <CareChip action={action} />
                </motion.div>
              ))}

              <motion.button
                onClick={(e) => { e.stopPropagation(); router.push("/dashboard/partner"); }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="mt-2 w-full rounded-[1.4rem] py-3 text-sm font-medium no-tap-highlight"
                style={{
                  background: "oklch(0% 0 0 / 0.04)",
                  color: "hsl(var(--muted-foreground))",
                }}
                aria-label="Manage sharing settings"
              >
                Manage sharing settings
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
