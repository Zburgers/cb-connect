"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { copyToClipboard, shareText } from "@/lib/utils";
import { CalendarHeart, Copy, Gift, Share2, Check } from "lucide-react";
import DigitalLocket from "@/components/partner/DigitalLocket";
import PartnerChat from "@/components/partner/PartnerChat";

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
  const updateConnectedSinceDate = useMutation(api.mutations.couples.updateConnectedSinceDate);
  const updatePartnerNickname = useMutation(api.mutations.couples.updatePartnerNickname);

  const [code, setCode] = useState("");
  const [connectedSinceDate, setConnectedSinceDate] = useState("");
  const [partnerNickname, setPartnerNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (coupleStatus?.connectedSinceDate) {
      setConnectedSinceDate(coupleStatus.connectedSinceDate);
    }
  }, [coupleStatus?.connectedSinceDate]);

  useEffect(() => {
    setPartnerNickname(coupleStatus?.partner?.nickname ?? "");
  }, [coupleStatus?.partner?.nickname]);

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

  const handleConnectedSinceSave = async () => {
    if (!connectedSinceDate) return;
    setIsSavingDate(true);
    try {
      await updateConnectedSinceDate({ connectedSinceDate });
      setMessage("Connected-since date saved.");
    } catch (error: any) {
      setMessage(error.message || "Failed to save connected-since date");
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleNicknameSave = async () => {
    setIsSavingNickname(true);
    try {
      await updatePartnerNickname({ nickname: partnerNickname });
      setMessage(partnerNickname.trim() ? "Partner nickname saved." : "Partner nickname cleared.");
    } catch (error: any) {
      setMessage(error.message || "Failed to save partner nickname");
    } finally {
      setIsSavingNickname(false);
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
          description={`Linked with ${coupleStatus.partner?.displayName ?? coupleStatus.partner?.name ?? "Partner"}. Keep sharing specific, consensual, and easy to change.`}
          status="connected"
          connectedSinceDate={coupleStatus.connectedSinceDate}
          className="space-y-4 animate-slide-up"
        >
          {coupleStatus.anniversary && (
            <div className="relative overflow-hidden rounded-[1.7rem] bg-foreground p-5 text-background">
              <div
                className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full opacity-40"
                style={{
                  background:
                    "radial-gradient(circle, oklch(from var(--color-phase-1) l c h / 0.9), transparent 66%)",
                }}
                aria-hidden="true"
              />
              <div className="relative flex items-start gap-3">
                <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-background text-foreground">
                  <Gift className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-background/70">
                    Anniversary signal
                  </p>
                  <h3 className="mt-1 font-display text-3xl italic leading-none">
                    {coupleStatus.anniversary.headline}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-background/78">
                    {coupleStatus.anniversary.body} Send a note, make a small plan, or leave a soft reminder in the thread below.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="contrast-glass space-y-3 rounded-[1.6rem] p-4">
            <div className="flex items-start gap-3">
              <CalendarHeart className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Relationship date</h3>
                <p className="mt-1 text-sm leading-6 text-foreground/75">
                  Used for monthly and yearly locket moments like “Happy 6 months.”
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="date"
                value={connectedSinceDate}
                onChange={(event) => setConnectedSinceDate(event.target.value)}
                className="contrast-glass min-h-11 flex-1 rounded-2xl px-4 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
              <button
                type="button"
                onClick={handleConnectedSinceSave}
                disabled={isSavingDate || !connectedSinceDate}
                className="touch-target rounded-2xl bg-foreground px-5 text-sm font-bold text-background press-feedback disabled:opacity-50"
              >
                {isSavingDate ? "Saving..." : "Save date"}
              </button>
            </div>
          </div>

          <div className="contrast-glass space-y-3 rounded-[1.6rem] p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Partner nickname</h3>
              <p className="mt-1 text-sm leading-6 text-foreground/75">
                This only changes how their name appears for you in the locket and DM.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={partnerNickname}
                onChange={(event) => setPartnerNickname(event.target.value.slice(0, 40))}
                placeholder={coupleStatus.partner?.name ?? "Partner name"}
                className="contrast-glass min-h-11 flex-1 rounded-2xl px-4 text-sm font-semibold text-foreground outline-none placeholder:text-foreground/55 focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
              <button
                type="button"
                onClick={handleNicknameSave}
                disabled={isSavingNickname}
                className="touch-target rounded-2xl bg-foreground px-5 text-sm font-bold text-background press-feedback disabled:opacity-50"
              >
                {isSavingNickname ? "Saving..." : "Save name"}
              </button>
            </div>
          </div>

          {me.role === "primary" && (
            <>
              <div className="contrast-glass space-y-3 rounded-[1.6rem] p-4">
                <h3 className="text-sm font-semibold text-foreground">Visible to your partner</h3>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-foreground/75">Share cycle phase</span>
                  <input
                    type="checkbox"
                    checked={coupleStatus.sharingSettings?.phase ?? true}
                    onChange={(e) => updateSharing({ sharingPhase: e.target.checked })}
                    className="h-5 w-5 rounded accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-foreground/75">Share pain data</span>
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
      {coupleStatus?.isLinked && (
        <PartnerChat
          partnerName={coupleStatus.partner?.displayName ?? coupleStatus.partner?.name}
          partnerImageUrl={coupleStatus.partner?.imageUrl}
          showLauncher={false}
          defaultOpen
        />
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
            className="contrast-glass w-full rounded-[1.4rem] px-4 py-4 text-center font-data text-3xl tracking-widest text-foreground outline-none transition-colors placeholder:text-foreground/55 focus:border-primary focus:ring-4 focus:ring-primary/15"
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
