import type { api as mobileApi } from "./api";
import type { api as serverApi } from "../../../../convex/_generated/api";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

declare const mobile: typeof mobileApi;
declare const server: typeof serverApi;

const mobilePublicRefs = {
  dashboard: mobile.queries.dashboard.getDashboardData,
  capabilities: mobile.queries.capabilities.getCapabilities,
  guard: mobile.queries.mobileAccess.getGuardState,
  account: mobile.queries.users.getMe,
  couple: mobile.queries.couples.getCoupleStatus,
  inboxAvailability: mobile.queries.notifications.getMyInboxAvailability,
  inbox: mobile.queries.notifications.getMyInbox,
  preferences: mobile.queries.notifications.getMyPreferences,
  chat: mobile.queries.messages.listPageForMobile,
  periods: mobile.queries.history.getPeriodHistory,
  painHistory: mobile.queries.history.getPainHistory,
  ensureUser: mobile.mutations.users.ensureUser,
  updateRole: mobile.mutations.users.updateUserRole,
  updateTimeZone: mobile.mutations.users.updateUserTimeZone,
  updateProfile: mobile.mutations.users.updateUserPreferences,
  ensureSnapshot: mobile.mutations.predictionSnapshots.ensureForViewer,
  startPeriod: mobile.mutations.periods.logPeriodStart,
  assistStartPeriod: mobile.mutations.periods.assistLogPeriodStart,
  endPeriod: mobile.mutations.periods.logPeriodEnd,
  assistEndPeriod: mobile.mutations.periods.assistLogPeriodEnd,
  correctPeriod: mobile.mutations.periods.updatePeriodEvent,
  correctAssistedPeriod: mobile.mutations.periods.correctAssistedPeriodEvent,
  pain: mobile.mutations.painLog.createOrUpdatePainLog,
  pairingCode: mobile.mutations.couples.generatePairingCode,
  pair: mobile.mutations.couples.linkPartnerWithCode,
  revoke: mobile.mutations.couples.revokePartnerAccess,
  sharing: mobile.mutations.couples.updateSharingSettings,
  send: mobile.mutations.messages.send,
  delivered: mobile.mutations.messages.markDelivered,
  readThrough: mobile.mutations.messages.markReadThrough,
  react: mobile.mutations.messages.react,
  markInboxRead: mobile.mutations.notifications.markMyInboxItemRead,
  dismissInbox: mobile.mutations.notifications.dismissMyInboxItem,
  setPreference: mobile.mutations.notifications.setMyPreference,
};

const serverPublicRefs = {
  dashboard: server.queries.dashboard.getDashboardData,
  capabilities: server.queries.capabilities.getCapabilities,
  guard: server.queries.mobileAccess.getGuardState,
  account: server.queries.users.getMe,
  couple: server.queries.couples.getCoupleStatus,
  inboxAvailability: server.queries.notifications.getMyInboxAvailability,
  inbox: server.queries.notifications.getMyInbox,
  preferences: server.queries.notifications.getMyPreferences,
  chat: server.queries.messages.listPageForMobile,
  periods: server.queries.history.getPeriodHistory,
  painHistory: server.queries.history.getPainHistory,
  ensureUser: server.mutations.users.ensureUser,
  updateRole: server.mutations.users.updateUserRole,
  updateTimeZone: server.mutations.users.updateUserTimeZone,
  updateProfile: server.mutations.users.updateUserPreferences,
  ensureSnapshot: server.mutations.predictionSnapshots.ensureForViewer,
  startPeriod: server.mutations.periods.logPeriodStart,
  assistStartPeriod: server.mutations.periods.assistLogPeriodStart,
  endPeriod: server.mutations.periods.logPeriodEnd,
  assistEndPeriod: server.mutations.periods.assistLogPeriodEnd,
  correctPeriod: server.mutations.periods.updatePeriodEvent,
  correctAssistedPeriod: server.mutations.periods.correctAssistedPeriodEvent,
  pain: server.mutations.painLog.createOrUpdatePainLog,
  pairingCode: server.mutations.couples.generatePairingCode,
  pair: server.mutations.couples.linkPartnerWithCode,
  revoke: server.mutations.couples.revokePartnerAccess,
  sharing: server.mutations.couples.updateSharingSettings,
  send: server.mutations.messages.send,
  delivered: server.mutations.messages.markDelivered,
  readThrough: server.mutations.messages.markReadThrough,
  react: server.mutations.messages.react,
  markInboxRead: server.mutations.notifications.markMyInboxItemRead,
  dismissInbox: server.mutations.notifications.dismissMyInboxItem,
  setPreference: server.mutations.notifications.setMyPreference,
};

type CompatiblePublicRefs<
  Mobile extends Record<keyof Server, FunctionReference<any, any, any, any, any>>,
  Server extends Record<keyof Mobile, FunctionReference<any, any, any, any, any>>,
> = {
  [Key in keyof Server]: [FunctionArgs<Mobile[Key]>] extends [FunctionArgs<Server[Key]>]
    ? [FunctionArgs<Server[Key]>] extends [FunctionArgs<Mobile[Key]>]
      ? [FunctionReturnType<Server[Key]>] extends [FunctionReturnType<Mobile[Key]>]
        ? true
        : false
      : false
    : false;
}[keyof Server];

const publicRefsMatchActualServer: CompatiblePublicRefs<typeof mobilePublicRefs, typeof serverPublicRefs> = true;
void publicRefsMatchActualServer;
