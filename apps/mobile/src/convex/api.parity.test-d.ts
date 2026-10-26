import type { api as mobileApi } from "./api";
import type { api as serverApi } from "../../../../convex/_generated/api";
import type { FunctionReference } from "convex/server";
import { mobilePublicApiInventory } from "./api.inventory";
import type {
  AssertTrue,
  PublicArgsCompatible,
  PublicRefCompatible,
  SameKeys,
  ServerReturnAssignable,
} from "./api.parity.assertions";

declare const mobile: typeof mobileApi;
declare const server: typeof serverApi;

const mobilePublicRefs = {
  "queries.dashboard.getDashboardData": mobile.queries.dashboard.getDashboardData,
  "queries.capabilities.getCapabilities": mobile.queries.capabilities.getCapabilities,
  "queries.mobileAccess.getGuardState": mobile.queries.mobileAccess.getGuardState,
  "queries.users.getMe": mobile.queries.users.getMe,
  "queries.couples.getCoupleStatus": mobile.queries.couples.getCoupleStatus,
  "queries.notifications.getMyInboxAvailability": mobile.queries.notifications.getMyInboxAvailability,
  "queries.notifications.getMyInbox": mobile.queries.notifications.getMyInbox,
  "queries.notifications.getMyPreferences": mobile.queries.notifications.getMyPreferences,
  "queries.messages.listPageForMobile": mobile.queries.messages.listPageForMobile,
  "queries.nudges.latestReceived": mobile.queries.nudges.latestReceived,
  "queries.presence.getPartnerPresence": mobile.queries.presence.getPartnerPresence,
  "queries.history.getCycleSettings": mobile.queries.history.getCycleSettings,
  "queries.history.getPredictionSegmentOptions": mobile.queries.history.getPredictionSegmentOptions,
  "queries.history.getPeriodHistory": mobile.queries.history.getPeriodHistory,
  "queries.history.getPainHistory": mobile.queries.history.getPainHistory,
  "mutations.predictionSnapshots.ensureForViewer": mobile.mutations.predictionSnapshots.ensureForViewer,
  "mutations.notifications.markMyInboxItemRead": mobile.mutations.notifications.markMyInboxItemRead,
  "mutations.notifications.dismissMyInboxItem": mobile.mutations.notifications.dismissMyInboxItem,
  "mutations.notifications.setMyPreference": mobile.mutations.notifications.setMyPreference,
  "mutations.users.ensureUser": mobile.mutations.users.ensureUser,
  "mutations.users.updateUserRole": mobile.mutations.users.updateUserRole,
  "mutations.users.updateUserTimeZone": mobile.mutations.users.updateUserTimeZone,
  "mutations.users.updateUserPreferences": mobile.mutations.users.updateUserPreferences,
  "mutations.periods.updateCycleSettings": mobile.mutations.periods.updateCycleSettings,
  "mutations.periods.logPeriodStart": mobile.mutations.periods.logPeriodStart,
  "mutations.periods.assistLogPeriodStart": mobile.mutations.periods.assistLogPeriodStart,
  "mutations.periods.logPeriodEnd": mobile.mutations.periods.logPeriodEnd,
  "mutations.periods.assistLogPeriodEnd": mobile.mutations.periods.assistLogPeriodEnd,
  "mutations.periods.updatePeriodEvent": mobile.mutations.periods.updatePeriodEvent,
  "mutations.periods.correctAssistedPeriodEvent": mobile.mutations.periods.correctAssistedPeriodEvent,
  "mutations.cycleContext.createPredictionSegment": mobile.mutations.cycleContext.createPredictionSegment,
  "mutations.couples.generatePairingCode": mobile.mutations.couples.generatePairingCode,
  "mutations.couples.linkPartnerWithCode": mobile.mutations.couples.linkPartnerWithCode,
  "mutations.couples.revokePartnerAccess": mobile.mutations.couples.revokePartnerAccess,
  "mutations.couples.updateSharingSettings": mobile.mutations.couples.updateSharingSettings,
  "mutations.messages.send": mobile.mutations.messages.send,
  "mutations.messages.markDelivered": mobile.mutations.messages.markDelivered,
  "mutations.messages.markReadThrough": mobile.mutations.messages.markReadThrough,
  "mutations.messages.react": mobile.mutations.messages.react,
  "mutations.nudges.send": mobile.mutations.nudges.send,
  "mutations.nudges.markSeen": mobile.mutations.nudges.markSeen,
  "mutations.presence.heartbeat": mobile.mutations.presence.heartbeat,
  "mutations.presence.goOffline": mobile.mutations.presence.goOffline,
  "mutations.painLog.createOrUpdatePainLog": mobile.mutations.painLog.createOrUpdatePainLog,
} as const;

const serverPublicRefs = {
  "queries.dashboard.getDashboardData": server.queries.dashboard.getDashboardData,
  "queries.capabilities.getCapabilities": server.queries.capabilities.getCapabilities,
  "queries.mobileAccess.getGuardState": server.queries.mobileAccess.getGuardState,
  "queries.users.getMe": server.queries.users.getMe,
  "queries.couples.getCoupleStatus": server.queries.couples.getCoupleStatus,
  "queries.notifications.getMyInboxAvailability": server.queries.notifications.getMyInboxAvailability,
  "queries.notifications.getMyInbox": server.queries.notifications.getMyInbox,
  "queries.notifications.getMyPreferences": server.queries.notifications.getMyPreferences,
  "queries.messages.listPageForMobile": server.queries.messages.listPageForMobile,
  "queries.nudges.latestReceived": server.queries.nudges.latestReceived,
  "queries.presence.getPartnerPresence": server.queries.presence.getPartnerPresence,
  "queries.history.getCycleSettings": server.queries.history.getCycleSettings,
  "queries.history.getPredictionSegmentOptions": server.queries.history.getPredictionSegmentOptions,
  "queries.history.getPeriodHistory": server.queries.history.getPeriodHistory,
  "queries.history.getPainHistory": server.queries.history.getPainHistory,
  "mutations.predictionSnapshots.ensureForViewer": server.mutations.predictionSnapshots.ensureForViewer,
  "mutations.notifications.markMyInboxItemRead": server.mutations.notifications.markMyInboxItemRead,
  "mutations.notifications.dismissMyInboxItem": server.mutations.notifications.dismissMyInboxItem,
  "mutations.notifications.setMyPreference": server.mutations.notifications.setMyPreference,
  "mutations.users.ensureUser": server.mutations.users.ensureUser,
  "mutations.users.updateUserRole": server.mutations.users.updateUserRole,
  "mutations.users.updateUserTimeZone": server.mutations.users.updateUserTimeZone,
  "mutations.users.updateUserPreferences": server.mutations.users.updateUserPreferences,
  "mutations.periods.updateCycleSettings": server.mutations.periods.updateCycleSettings,
  "mutations.periods.logPeriodStart": server.mutations.periods.logPeriodStart,
  "mutations.periods.assistLogPeriodStart": server.mutations.periods.assistLogPeriodStart,
  "mutations.periods.logPeriodEnd": server.mutations.periods.logPeriodEnd,
  "mutations.periods.assistLogPeriodEnd": server.mutations.periods.assistLogPeriodEnd,
  "mutations.periods.updatePeriodEvent": server.mutations.periods.updatePeriodEvent,
  "mutations.periods.correctAssistedPeriodEvent": server.mutations.periods.correctAssistedPeriodEvent,
  "mutations.cycleContext.createPredictionSegment": server.mutations.cycleContext.createPredictionSegment,
  "mutations.couples.generatePairingCode": server.mutations.couples.generatePairingCode,
  "mutations.couples.linkPartnerWithCode": server.mutations.couples.linkPartnerWithCode,
  "mutations.couples.revokePartnerAccess": server.mutations.couples.revokePartnerAccess,
  "mutations.couples.updateSharingSettings": server.mutations.couples.updateSharingSettings,
  "mutations.messages.send": server.mutations.messages.send,
  "mutations.messages.markDelivered": server.mutations.messages.markDelivered,
  "mutations.messages.markReadThrough": server.mutations.messages.markReadThrough,
  "mutations.messages.react": server.mutations.messages.react,
  "mutations.nudges.send": server.mutations.nudges.send,
  "mutations.nudges.markSeen": server.mutations.nudges.markSeen,
  "mutations.presence.heartbeat": server.mutations.presence.heartbeat,
  "mutations.presence.goOffline": server.mutations.presence.goOffline,
  "mutations.painLog.createOrUpdatePainLog": server.mutations.painLog.createOrUpdatePainLog,
} as const;

type MobileRefs = typeof mobilePublicRefs;
type ServerRefs = typeof serverPublicRefs;
type RefKeysMatchInventory = SameKeys<keyof MobileRefs, keyof typeof mobilePublicApiInventory>;
type ServerKeysMatchInventory = SameKeys<keyof ServerRefs, keyof typeof mobilePublicApiInventory>;
type ArgumentCompatibilityByPath = {
  [Path in keyof MobileRefs]: Path extends keyof ServerRefs
    ? PublicArgsCompatible<MobileRefs[Path], ServerRefs[Path]>
    : false;
};
type ReturnCompatibilityByPath = {
  [Path in keyof MobileRefs]: Path extends keyof ServerRefs
    ? ServerReturnAssignable<MobileRefs[Path], ServerRefs[Path]>
    : false;
};

const inventoryCoversMobileMap: AssertTrue<RefKeysMatchInventory> = true;
const inventoryCoversServerMap: AssertTrue<ServerKeysMatchInventory> = true;
const everyPublicArgumentsMatch: ArgumentCompatibilityByPath = mobilePublicApiInventory;
const everyServerReturnFitsMobileDTO: ReturnCompatibilityByPath = mobilePublicApiInventory;
void [inventoryCoversMobileMap, inventoryCoversServerMap, everyPublicArgumentsMatch, everyServerReturnFitsMobileDTO];

type PublicRef = FunctionReference<any, "public", any, any, any>;
type _AllSelectedRefsArePublic = AssertTrue<
  MobileRefs[keyof MobileRefs] extends PublicRef ? true : false
>;
