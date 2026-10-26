import type { api as backendApi } from "../../../../convex/_generated/api";

type BackendQueries = typeof backendApi.queries;
type BackendMutations = typeof backendApi.mutations;

export declare const api: {
  readonly queries: {
    readonly mobileAccess: Pick<BackendQueries["mobileAccess"], "getGuardState">;
    readonly couples: Pick<BackendQueries["couples"], "getCoupleStatus">;
    readonly dashboard: Pick<BackendQueries["dashboard"], "getDashboardData">;
    readonly messages: Pick<BackendQueries["messages"], "listPageForMobile">;
    readonly nudges: Pick<BackendQueries["nudges"], "latestReceived">;
    readonly presence: Pick<BackendQueries["presence"], "getPartnerPresence">;
  };
  readonly mutations: {
    readonly couples: Pick<BackendMutations["couples"],
      "generatePairingCode" | "linkPartnerWithCode" | "revokePartnerAccess" | "updateSharingSettings">;
    readonly messages: Pick<BackendMutations["messages"],
      "send" | "markDelivered" | "markReadThrough" | "react">;
    readonly nudges: Pick<BackendMutations["nudges"], "send" | "markSeen">;
    readonly presence: Pick<BackendMutations["presence"], "heartbeat" | "goOffline">;
  };
};
