"use client";

import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { copyToClipboard, shareText } from "@/lib/utils";
import { Copy, Share2, Check } from "lucide-react";

export default function PartnerPage() {
  const router = useRouter();
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
        <h1 className="text-2xl font-bold text-foreground">Partner</h1>
        <p className="text-muted-foreground text-sm">Manage your partner connection</p>
      </div>
      {message && (
        <div className="p-3 bg-primary/10 text-primary rounded-xl text-sm border border-primary/20">
          {message}
        </div>
      )}
      {/* Already linked */}
      {coupleStatus?.isLinked && (
        <div className="glass-card rounded-3xl p-6 space-y-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">💕</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Connected</h2>
              <p className="text-sm text-muted-foreground">
                Linked with {coupleStatus.partner?.name ?? "your partner"}
              </p>
            </div>
          </div>

          {me.role === "primary" && (
            <>
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-medium text-foreground">Sharing Settings</h3>
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
                className="w-full py-2 border border-red-400/50 text-red-500 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/10 transition-colors"
              >
                Revoke Partner Access
              </button>
            </>
          )}
        </div>
      )}
      {/* Not linked - Primary user */}
      {!coupleStatus?.isLinked && me.role === "primary" && (
        <div className="glass-card rounded-3xl p-6 space-y-4 animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground">Link Your Partner</h2>
          <p className="text-sm text-muted-foreground">
            Generate a pairing code and share it with your partner.
          </p>

          {generatedCode || coupleStatus?.activePairingCode ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">Your pairing code:</p>
              <div className="flex items-center justify-center gap-2 mb-3">
                <p className="text-4xl font-mono font-bold tracking-widest text-primary">
                  {generatedCode ?? coupleStatus?.activePairingCode?.code}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() =>
                    handleCopyCode(
                      generatedCode ?? coupleStatus?.activePairingCode?.code!
                    )
                  }
                  className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
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
                  className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
                  type="button"
                  aria-label="Share pairing code"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Valid for 24 hours</p>
            </div>
          ) : null}

          <button
            onClick={handleGenerateCode}
            disabled={isSubmitting}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting
              ? "Generating..."
              : generatedCode
                ? "Generate New Code"
                : "Generate Pairing Code"}
          </button>
        </div>
      )}
      {/* Not linked - Partner user */}
      {!coupleStatus?.isLinked && me.role === "partner" && (
        <div className="glass-card rounded-3xl p-6 space-y-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 dark:bg-secondary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">💕</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Enter Pairing Code</h2>
              <p className="text-sm text-muted-foreground">
                Ask your partner for their 6-digit pairing code.
              </p>
            </div>
          </div>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest
              bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            maxLength={6}
          />

          <button
            onClick={handleLinkPartner}
            disabled={isSubmitting || code.length !== 6}
            className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-secondary/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Linking..." : "Link Account"}
          </button>
        </div>
      )}
    </div>
  );
}
