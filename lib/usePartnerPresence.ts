"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isPresentAt, PRESENCE_REFRESH_MS } from "@/lib/presence.mjs";

export function usePartnerPresence(isAuthenticated: boolean) {
  const presence = useQuery(
    api.queries.presence.getPartnerPresence,
    isAuthenticated ? {} : "skip"
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, PRESENCE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

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
