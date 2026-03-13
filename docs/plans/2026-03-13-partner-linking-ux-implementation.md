# Partner Linking UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement discoverable partner linking UX with auto-copy, share functionality, and connection status display.

**Architecture:** Create a new `PartnerStatusCard` component that displays context-aware messaging based on user role and link status. Enhance the partner page with auto-copy and Web Share API integration. All changes are additive - no existing functionality is modified.

**Tech Stack:** Next.js 15, React 19, Convex, TypeScript, Tailwind CSS, Lucide Icons

---

## Pre-Flight Checklist

- [ ] Verify Convex is running: `npx convex dev`
- [ ] Verify dev server: `npm run dev`
- [ ] Check existing tests pass: `npm test` (if configured)

---

### Task 1: Create PartnerStatusCard Component

**Files:**
- Create: `components/dashboard/PartnerStatusCard.tsx`
- Test: N/A (visual component, manual testing)

**Step 1: Create the component file**

Create `components/dashboard/PartnerStatusCard.tsx` with:

```tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PartnerStatusCard() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.queries.users.getMe, isLoaded ? {} : "skip");
  const coupleStatus = useQuery(
    api.queries.couples.getCoupleStatus,
    isLoaded && isSignedIn ? {} : "skip"
  );

  if (!isLoaded || me === undefined || coupleStatus === undefined) {
    return null;
  }

  const isLinked = coupleStatus?.isLinked;
  const isPartner = me?.role === "partner";
  const partnerName = coupleStatus?.partner?.name ?? "your partner";

  // Not linked - Partner user (male messaging)
  if (!isLinked && isPartner) {
    return (
      <div
        onClick={() => router.push("/dashboard/partner")}
        className="glass-card rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all
          border border-gray-100 dark:border-gray-800 animate-slide-up"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary/10 dark:bg-secondary/20
            flex items-center justify-center flex-shrink-0">
            <Heart className="w-6 h-6 text-secondary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              Connect with your partner now
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Stay informed and support her journey
            </p>
            <button
              className="mt-3 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl
                text-sm font-medium hover:bg-secondary/90 transition-colors"
            >
              Connect Now →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not linked - Primary user (female messaging)
  if (!isLinked && !isPartner) {
    return (
      <div
        onClick={() => router.push("/dashboard/partner")}
        className="glass-card rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all
          border border-gray-100 dark:border-gray-800 animate-slide-up"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20
            flex items-center justify-center flex-shrink-0">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              Let your special one take care of you
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Share your cycle journey with your partner
            </p>
            <button
              className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl
                text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Invite Partner →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Linked - Show connection status
  return (
    <div className="glass-card rounded-3xl p-6 border border-gray-100 dark:border-gray-800
      animate-slide-up">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20
          flex items-center justify-center flex-shrink-0">
          <Heart className="w-6 h-6 text-primary fill-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              Connected with {partnerName}
            </h3>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              Sharing: {coupleStatus.sharingSettings?.phase ? "✓ Phase" : ""}{" "}
              {coupleStatus.sharingSettings?.pain ? "✓ Pain" : ""}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isPartner
              ? "Check in on her current phase and pain levels"
              : "Your partner is here to support you"}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push("/dashboard/partner");
            }}
            className="mt-3 px-4 py-2 bg-muted text-foreground rounded-xl text-sm font-medium
              hover:bg-muted/80 transition-colors"
          >
            Manage Sharing
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify file creation**

Run: `ls -la components/dashboard/PartnerStatusCard.tsx`
Expected: File exists with ~150 lines

**Step 3: Commit**

```bash
git add components/dashboard/PartnerStatusCard.tsx
git commit -m "feat: add PartnerStatusCard component with role-based messaging"
```

---

### Task 2: Add PartnerStatusCard to Dashboard

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Step 1: Import PartnerStatusCard**

Add import after other imports:

```tsx
import PartnerStatusCard from "@/components/dashboard/PartnerStatusCard";
```

**Step 2: Add component to dashboard layout**

Insert after the `CurrentPhase` block and before `PainLogger`:

```tsx
{data.cycleInfo && (
  <CurrentPhase
    phase={data.cycleInfo.phase}
    cycleDay={data.cycleInfo.cycleDay}
    description={data.cycleInfo.phaseDescription}
    daysUntilNextPeriod={data.cycleInfo.daysUntilNextPeriod}
    nextPeriodStart={data.cycleInfo.predictedNextPeriodStart}
  />
)}

{/* Partner Status Card - Always shown */}
<PartnerStatusCard />

<PainLogger currentPain={data.painData ?? null} />
```

**Step 3: Verify dashboard renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/dashboard`
Expected: Partner status card appears between phase card and pain logger

**Step 4: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: integrate PartnerStatusCard into main dashboard"
```

---

### Task 3: Add Clipboard & Share Helpers

**Files:**
- Modify: `lib/utils.ts`

**Step 1: Read existing utils file**

Run: `cat lib/utils.ts`
Note: Existing utility functions

**Step 2: Add clipboard helper function**

Add to `lib/utils.ts`:

```typescript
/**
 * Copy text to clipboard with fallback for older browsers
 * @param text - Text to copy
 * @returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

/**
 * Share text using Web Share API with fallback to clipboard
 * @param text - Text to share
 * @param title - Optional title for share dialog
 * @returns true if shared successfully, false otherwise
 */
export async function shareText(text: string, title?: string): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({
        title: title ?? "CB Connect",
        text,
      });
      return true;
    }
    // Fallback: copy to clipboard
    return await copyToClipboard(text);
  } catch {
    return false;
  }
}
```

**Step 3: Verify functions are exported**

Run: `grep -n "export async function" lib/utils.ts`
Expected: Shows `copyToClipboard` and `shareText` functions

**Step 4: Commit**

```bash
git add lib/utils.ts
git commit -m "feat: add clipboard and Web Share API helper functions"
```

---

### Task 4: Enhance Partner Page with Auto-Copy & Share

**Files:**
- Modify: `app/(dashboard)/dashboard/partner/page.tsx`

**Step 1: Add imports**

Add at top of file:

```tsx
import { copyToClipboard, shareText } from "@/lib/utils";
import { Copy, Share2, Check } from "lucide-react";
```

**Step 2: Add state for copy feedback**

Add after existing state:

```tsx
const [copied, setCopied] = useState(false);
```

**Step 3: Add copy handler**

Add after `handleGenerateCode`:

```tsx
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
  const message = `Join me on CB Connect! Use pairing code: ${codeToShare}`;
  const success = await shareText(message, "CB Connect - Partner Linking");
  if (!success) {
    setMessage("Share not supported. Code copied instead.");
    await handleCopyCode(codeToShare);
  }
};
```

**Step 4: Update code display with buttons**

Replace the code display section with:

```tsx
{generatedCode || coupleStatus?.activePairingCode ? (
  <div className="text-center py-4">
    <p className="text-sm text-gray-500 mb-2">Your pairing code:</p>
    <div className="flex items-center justify-center gap-2 mb-3">
      <p className="text-4xl font-mono font-bold tracking-widest text-primary-500">
        {generatedCode ?? coupleStatus?.activePairingCode?.code}
      </p>
    </div>
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => handleCopyCode(generatedCode ?? coupleStatus?.activePairingCode?.code!)}
        className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm
          hover:bg-muted/80 transition-colors"
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
        onClick={() => handleShareCode(generatedCode ?? coupleStatus?.activePairingCode?.code!)}
        className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm
          hover:bg-muted/80 transition-colors"
      >
        <Share2 className="w-4 h-4" />
        <span>Share</span>
      </button>
    </div>
    <p className="text-xs text-gray-400 mt-3">Valid for 24 hours</p>
  </div>
) : null}
```

**Step 5: Add auto-copy on generate**

Modify `handleGenerateCode` to call `handleCopyCode` after success:

```tsx
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
```

**Step 6: Test manually**

Run: `npm run dev`
Navigate to: `http://localhost:3000/dashboard/partner`
Actions:
1. Click "Generate Pairing Code"
2. Verify code is auto-copied
3. Verify toast message appears
4. Click "Copy" button - verify feedback
5. Click "Share" button - verify share dialog (or fallback)

**Step 7: Commit**

```bash
git add app/\(dashboard\)/dashboard/partner/page.tsx
git commit -m "feat: add auto-copy, copy button, and share button to partner page"
```

---

### Task 5: Add Revoke Confirmation Dialog

**Files:**
- Modify: `app/(dashboard)/dashboard/partner/page.tsx`

**Step 1: Update handleRevokeAccess**

Replace existing handler with:

```tsx
const handleRevokeAccess = async () => {
  const confirmed = confirm(
    "Are you sure you want to revoke partner access? They will no longer be able to see your data."
  );
  if (!confirmed) return;

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
```

**Step 2: Test revoke flow**

Navigate to: `http://localhost:3000/dashboard/partner` (when linked)
Actions:
1. Click "Revoke Partner Access"
2. Verify confirm dialog appears
3. Click "Cancel" - verify nothing happens
4. Click "OK" - verify access is revoked

**Step 3: Commit**

```bash
git add app/\(dashboard\)/dashboard/partner/page.tsx
git commit -m "feat: add confirmation dialog for revoke partner access"
```

---

### Task 6: Manual Testing & Verification

**Files:** N/A (Testing task)

**Step 1: Test unlinked primary user flow**

1. Sign in as primary user (no partner linked)
2. Navigate to dashboard
3. Verify PartnerStatusCard shows "Let your special one take care of you"
4. Click "Invite Partner →"
5. Verify navigation to `/dashboard/partner`
6. Click "Generate Pairing Code"
7. Verify code is auto-copied with toast
8. Verify Copy and Share buttons work

**Step 2: Test unlinked partner user flow**

1. Sign in as partner user (no partner linked)
2. Navigate to dashboard
3. Verify PartnerStatusCard shows "Connect with your partner now"
4. Click "Connect Now →"
5. Verify navigation to `/dashboard/partner`
6. Enter 6-digit code
7. Verify linking succeeds

**Step 3: Test linked user flow**

1. Sign in as linked user
2. Navigate to dashboard
3. Verify PartnerStatusCard shows "Connected with {partnerName}"
4. Verify sharing settings are displayed
5. Click "Manage Sharing"
6. Verify navigation to `/dashboard/partner`

**Step 4: Test share functionality**

1. Generate pairing code
2. Click "Share" button
3. On mobile: Verify native share dialog
4. On desktop: Verify fallback to copy

**Step 5: Document any issues**

Create GitHub issues for any bugs found.

---

### Task 7: Final Review & Cleanup

**Files:** N/A

**Step 1: Run linting**

```bash
npm run lint
```

Fix any TypeScript errors or ESLint warnings.

**Step 2: Verify git status**

```bash
git status
```

Expected files:
- `components/dashboard/PartnerStatusCard.tsx` (new)
- `lib/utils.ts` (modified)
- `app/(dashboard)/dashboard/page.tsx` (modified)
- `app/(dashboard)/dashboard/partner/page.tsx` (modified)

**Step 3: Review diff**

```bash
git diff HEAD
```

Verify:
- No console.logs left in code
- Proper error handling
- Consistent code style

**Step 4: Create final commit if needed**

```bash
git add -A
git commit -m "chore: fix linting and cleanup"
```

**Step 5: Update issues.md**

Mark "Partner Linking UX Improvements" as complete:

```markdown
## ✅ Completed

### Partner Linking UX Improvements
**Status:** Complete  
**Completed:** March 13, 2026
**Design Doc:** `docs/plans/2026-03-13-partner-linking-ux-design.md`
```

---

## Post-Implementation Checklist

- [ ] All commits are atomic and well-described
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Manual testing complete
- [ ] issues.md updated
- [ ] Design doc marked as implemented

---

## Troubleshooting

### Clipboard API not working
- Check HTTPS (required for clipboard API)
- Fallback should handle older browsers
- Test in multiple browsers

### Share API not available
- Desktop browsers may not support Web Share API
- Fallback copies to clipboard
- Show appropriate message to user

### Convex subscription issues
- Verify `npx convex dev` is running
- Check Convex dashboard for errors
- Restart dev server if needed

---

## Next Steps

After implementation complete, consider:
1. Add E2E tests with Playwright
2. Add analytics tracking for partner linking conversion
3. Implement Phase 2 (gender fields) from issues.md
4. Implement Phase 3 (relationship milestones)
