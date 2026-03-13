"use client";

import { useQuery } from "convex/react";
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

  // Not linked - Partner user
  if (!isLinked && isPartner) {
    return (
      <div
        onClick={() => router.push("/dashboard/partner")}
        className="glass-card rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all
          border border-gray-100 dark:border-gray-800 animate-slide-up"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push("/dashboard/partner");
          }
        }}
        aria-label="Connect with your partner - Click to open partner linking page"
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
              aria-label="Connect now"
            >
              Connect Now →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not linked - Primary user
  if (!isLinked && !isPartner) {
    return (
      <div
        onClick={() => router.push("/dashboard/partner")}
        className="glass-card rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all
          border border-gray-100 dark:border-gray-800 animate-slide-up"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push("/dashboard/partner");
          }
        }}
        aria-label="Invite your partner - Click to open partner linking page"
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
            <ul className="text-sm text-muted-foreground mt-3 space-y-1">
              <li>• Real-time phase updates</li>
              <li>• Pain symptom tracking</li>
              <li>• Personalized support tips</li>
            </ul>
            <button
              className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl
                text-sm font-medium hover:bg-primary/90 transition-colors"
              aria-label="Invite partner"
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
            aria-label="Manage sharing settings"
          >
            Manage Sharing
          </button>
        </div>
      </div>
    </div>
  );
}
