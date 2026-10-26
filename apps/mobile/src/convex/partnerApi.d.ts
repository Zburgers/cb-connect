import type { FunctionReference, PaginationOptions, PaginationResult } from "convex/server";
import type { MobileAccessContextDTO } from "@cb-connect/contracts";

type CoupleStatus = {
  isLinked: boolean;
  status?: "pending" | "active" | "revoked";
  role?: "primary" | "partner";
  relationshipGeneration?: string | null;
  sharingSettings?: { pain: boolean; phase: boolean; periodWrite: boolean } | null;
  partner?: { displayName?: string | null } | null;
  activePairingCode?: { code: string; expiresAt: number } | null;
};

type DashboardData = {
  cycleInfo?: { phase?: string | null } | null;
  cycleStateV1?: { phase?: string | null; status?: string } | null;
  message?: string;
};

type MobileMessage = {
  _id: string;
  body: string;
  createdAt: number;
  senderName: string;
  senderImageUrl: string | null;
  isMine: boolean;
  deliveredAt: number | null;
  readAt: number | null;
  reactions: { emoji: string; count: number; isMine: boolean }[];
};

type Ref<
  Type extends "query" | "mutation" | "action",
  Args = Record<string, never>,
  Result = unknown,
> =
  FunctionReference<Type, "public", Args, Result>;

export declare const api: {
  readonly queries: {
    readonly mobileAccess: { readonly getGuardState: Ref<"query", Record<string, never>, MobileAccessContextDTO> };
    readonly couples: { readonly getCoupleStatus: Ref<"query", Record<string, never>, CoupleStatus> };
    readonly dashboard: { readonly getDashboardData: Ref<"query", { todayDate?: string }, DashboardData> };
    readonly messages: { readonly listPageForMobile: Ref<"query", { paginationOpts: PaginationOptions; relationshipGeneration: string }, PaginationResult<MobileMessage>> };
    readonly nudges: { readonly latestReceived: Ref<"query", Record<string, never>, { _id: string; senderName: string; message: string } | null> };
    readonly presence: { readonly getPartnerPresence: Ref<"query", Record<string, never>, { isPresent: boolean; lastSeen: number; expiresAt: number } | null> };
  };
  readonly mutations: {
    readonly couples: {
      readonly generatePairingCode: Ref<"action", Record<string, never>, { code: string; expiresAt: number }>;
      readonly linkPartnerWithCode: Ref<"mutation", { code: string }, { success: true; coupleId: string } | { success: false; error: string }>;
      readonly revokePartnerAccess: Ref<"mutation">;
      readonly updateSharingSettings: Ref<"mutation", { sharingPain?: boolean; sharingPhase?: boolean; sharingPeriodWrite?: boolean }>;
    };
    readonly messages: {
      readonly send: Ref<"mutation", { body: string }>;
      readonly markDelivered: Ref<"mutation", { messageId: string }>;
      readonly markReadThrough: Ref<"mutation", { messageId: string }>;
      readonly react: Ref<"mutation", { messageId: string; emoji: string }>;
    };
    readonly nudges: { readonly send: Ref<"mutation", { emoji: string }>; readonly markSeen: Ref<"mutation", { nudgeId: string }> };
    readonly presence: { readonly heartbeat: Ref<"mutation">; readonly goOffline: Ref<"mutation"> };
  };
};
