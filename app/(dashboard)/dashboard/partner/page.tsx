"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { copyToClipboard, shareText } from "@/lib/utils";
import { Copy, Share2, Check } from "lucide-react";
import DigitalLocket from "@/components/partner/DigitalLocket";

export default function PartnerPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.queries.users.getMe, isAuthenticated ? {} : "skip");
  const coupleStatus = useQuery(
    api.queries.couples.getCoupleStatus,
    // Only run once we know the user exists and has a role
    isAuthenticated && me?.role ? {} : "skip"
  );
  const generateCode = useMutation(api.mutations.couples.generatePairingCode);
  const linkPartner = useMutation(api.mutations.couples.linkPartnerWithCode);
  const updateSharing = useMutation(api.mutations.couples.updateSharingSettings);
  const revokeAccess = useMutation(api.mutations.couples.revokePartnerAccess);

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Still loading auth
  if (isLoading || me === undefined) return <LoadingSpinner />;

  // Convex auth not ready / unauthenticated
  if (!isAuthenticated) {
    if (clerkLoaded && isSignedIn) {
      return (
        <div className="glass-card rounded-3xl p-6 animate-slide-up space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Authentication setup issue</h2>
          <p className="text-sm text-muted-foreground">
            You are signed in to Clerk, but Convex could not obtain a session token.
          </p>
          <p className="text-sm text-muted-foreground">
            In Clerk Dashboard, create a JWT template named <code>convex</code>, then refresh.
          </p>
        </div>
      );
    }
    return <LoadingSpinner />;
  }

  if (me === null) return <LoadingSpinner />;

  // User exists but hasn't completed onboarding yet — layout will redirect
  if (!me.role) return <LoadingSpinner />;

  // Waiting for couple status
  if (coupleStatus === undefined) return <LoadingSpinner />;

  const handleCopyCode = async (codeToCopy: string) => {
    const success = await copyToClipboard(codeToCopy);
    if (success) {
      setCopied(true);
      setMessage("Code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      setMessage("Failed to copy. Please copy manually.");
    }
  };

  const handleShareCode = async (codeToShare: string) => {
    const shareMessage = `Join me on CB Connect! Use pairing code: ${codeToShare}`;
    const success = await shareText(shareMessage, "CB Connect - Partner Linking");
    if (!success) {
      setMessage("Share not supported. Code copied instead.");
      await handleCopyCode(codeToShare);
    }
  };

  const handleGenerateCode = async () => {
    setIsSubmitting(true);
    try {
      const result = await generateCode();
      setGeneratedCode(result.code);
      setMessage("Code generated and copied to clipboard!");
      // Auto-copy after short delay for animation
      setTimeout(() => handleCopyCode(result.code), 300);
    } catch (error: any) {
      setMessage(error.message || "Failed to generate code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkPartner = async () => {
    if (code.length !== 6) return;
    setIsSubmitting(true);
    try {
      await linkPartner({ code });
      setCode("");
      setMessage("Successfully linked!");
    } catch (error: any) {
      setMessage(error.message || "Failed to link");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (
      !confirm(
        "Are you sure you want to revoke partner access? They will no longer be able to see your data."
      )
    )
      return;
    setIsSubmitting(true);
    try {
      await revokeAccess();
      setMessage("Partner access revoked.");
    } catch (error: any) {
      setMessage(error.message || "Failed to revoke access");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Shared space
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-foreground">
          Partner connection
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite, consent, and sharing settings live here.
        </p>
      </div>
      {message && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
          {message}
        </div>
      )}
      {/* Already linked */}
      {coupleStatus?.isLinked && (
        <DigitalLocket
          title="Your locket is connected"
          description={`Linked with ${coupleStatus.partner?.name ?? "your partner"}. Keep sharing specific, consensual, and easy to change.`}
          status="connected"
          className="space-y-4 animate-slide-up"
        >
          {me.role === "primary" && (
            <>
              <div className="space-y-3 rounded-[1.6rem] border border-white/50 bg-white/[0.42] p-4 dark:border-white/10 dark:bg-white/[0.07]">
                <h3 className="text-sm font-semibold text-foreground">Visible to your partner</h3>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Share cycle phase</span>
                  <input
                    type="checkbox"
                    checked={coupleStatus.sharingSettings?.phase ?? true}
                    onChange={(e) => updateSharing({ sharingPhase: e.target.checked })}
                    className="h-5 w-5 rounded accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Share pain data</span>
                  <input
                    type="checkbox"
                    checked={coupleStatus.sharingSettings?.pain ?? false}
                    onChange={(e) => updateSharing({ sharingPain: e.target.checked })}
                    className="h-5 w-5 rounded accent-primary"
                  />
                </label>
              </div>

              <button
                onClick={handleRevokeAccess}
                className="w-full rounded-2xl border border-red-400/50 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                Close partner access
              </button>
            </>
          )}
        </DigitalLocket>
      )}
      {/* Not linked - Primary user */}
      {!coupleStatus?.isLinked && me.role === "primary" && (
        <DigitalLocket
          title="Invite your partner into this space"
          description="Generate a private code. It creates the bridge, but you still control what crosses it."
          code={generatedCode ?? coupleStatus?.activePairingCode?.code}
          status={generatedCode || coupleStatus?.activePairingCode ? "ready" : "waiting"}
          className="animate-slide-up"
        >
          {generatedCode || coupleStatus?.activePairingCode ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() =>
                    handleCopyCode(
                      generatedCode ?? coupleStatus?.activePairingCode?.code!
                    )
                  }
                  className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80"
                  type="button"
                  aria-label="Copy pairing code"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    handleShareCode(
                      generatedCode ?? coupleStatus?.activePairingCode?.code!
                    )
                  }
                  className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80"
                  type="button"
                  aria-label="Share pairing code"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          ) : null}

          <button
            onClick={handleGenerateCode}
            disabled={isSubmitting}
            className="w-full rounded-[1.4rem] bg-foreground py-4 font-semibold text-background transition-all press-feedback disabled:opacity-50 dark:bg-white dark:text-slate-950"
          >
            {isSubmitting
              ? "Generating..."
              : generatedCode
                ? "Generate New Code"
                : "Generate Pairing Code"}
          </button>
        </DigitalLocket>
      )}
      {/* Not linked - Partner user */}
      {!coupleStatus?.isLinked && me.role === "partner" && (
        <DigitalLocket
          title="Unlock the shared space"
          description="Enter the 6-digit code your partner generated. You will only see what they choose to share."
          className="animate-slide-up"
        >
          <label className="text-sm font-semibold text-foreground" htmlFor="partner-code">
            Partner pairing code
          </label>
          <input
            id="partner-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            className="w-full rounded-[1.4rem] border border-white/50 bg-white/50 px-4 py-4 text-center font-data text-3xl tracking-widest text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15 dark:border-white/10 dark:bg-white/7"
            maxLength={6}
          />

          <button
            onClick={handleLinkPartner}
            disabled={isSubmitting || code.length !== 6}
            className="w-full rounded-[1.4rem] bg-secondary py-4 font-semibold text-secondary-foreground transition-all press-feedback disabled:opacity-50"
          >
            {isSubmitting ? "Linking..." : "Link Account"}
          </button>
        </DigitalLocket>
      )}
    </div>
  );
}
