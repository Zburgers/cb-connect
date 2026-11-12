import { useEffect } from "react";
import { AppState } from "react-native";
import { useMutation } from "convex/react";
import { api } from "../../convex/api";

/** Keep the current user's presence truthful while a linked app session is active. */
export function PresenceHeartbeat(): null {
  const heartbeat = useMutation(api.mutations.presence.heartbeat);
  const goOffline = useMutation(api.mutations.presence.goOffline);

  useEffect(() => {
    const beat = () => {
      if (AppState.currentState === "active") {
        void heartbeat({}).catch(() => undefined);
      } else {
        void goOffline({}).catch(() => undefined);
      }
    };
    beat();
    const interval = setInterval(beat, 15_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void heartbeat({}).catch(() => undefined);
      else void goOffline({}).catch(() => undefined);
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
      void goOffline({}).catch(() => undefined);
    };
  }, [goOffline, heartbeat]);

  return null;
}
