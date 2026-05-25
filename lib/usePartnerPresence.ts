"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getPresenceExpiryDelay, isPresentAt } from "@/lib/presence.mjs";

export function usePartnerPresence(isAuthenticated: boolean) {
  const presence = useQuery(
    api.queries.presence.getPartnerPresence,
    isAuthenticated ? {} : "skip"
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!presence) return;

    const delay = getPresenceExpiryDelay(presence.lastSeen);
    if (delay === 0) {
      setNow(Date.now());
      return;
    }

    const timeout = window.setTimeout(() => {
      setNow(Date.now());
    }, delay + 50);
    return () => window.clearTimeout(timeout);
  }, [presence]);

  if (!presence) {
    return {
      isPresent: false,
      lastSeen: null,
      expiresAt: null,
    };
  }

  return {
    isPresent: isPresentAt(presence.lastSeen, now),
    lastSeen: presence.lastSeen,
    expiresAt: presence.expiresAt,
  };
}
