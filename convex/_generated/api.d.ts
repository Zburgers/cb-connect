/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers_auth from "../_helpers/auth.js";
import type * as _helpers_calendarDates from "../_helpers/calendarDates.js";
import type * as _helpers_clerkWebhook from "../_helpers/clerkWebhook.js";
import type * as _helpers_coupleSpace from "../_helpers/coupleSpace.js";
import type * as _helpers_cycleCalculations from "../_helpers/cycleCalculations.js";
import type * as _helpers_cycleFactCorrections from "../_helpers/cycleFactCorrections.js";
import type * as _helpers_cycleFactEligibility from "../_helpers/cycleFactEligibility.js";
import type * as _helpers_cycleFactSemantics from "../_helpers/cycleFactSemantics.js";
import type * as _helpers_cycleFactsFlag from "../_helpers/cycleFactsFlag.js";
import type * as _helpers_cycleIntervals from "../_helpers/cycleIntervals.js";
import type * as _helpers_cyclePredictionData from "../_helpers/cyclePredictionData.js";
import type * as _helpers_cycleReadModel from "../_helpers/cycleReadModel.js";
import type * as _helpers_cycleState from "../_helpers/cycleState.js";
import type * as _helpers_cycleStateExposure from "../_helpers/cycleStateExposure.js";
import type * as _helpers_cycleStateFlag from "../_helpers/cycleStateFlag.js";
import type * as _helpers_historyProjections from "../_helpers/historyProjections.js";
import type * as _helpers_legacyCycleFactClassification from "../_helpers/legacyCycleFactClassification.js";
import type * as _helpers_notificationPrediction from "../_helpers/notificationPrediction.js";
import type * as _helpers_partnerCycleProjection from "../_helpers/partnerCycleProjection.js";
import type * as _helpers_periodEventInvariants from "../_helpers/periodEventInvariants.js";
import type * as _helpers_periodPrediction from "../_helpers/periodPrediction.js";
import type * as _helpers_periodPredictionFlag from "../_helpers/periodPredictionFlag.js";
import type * as _helpers_predictionBounds from "../_helpers/predictionBounds.js";
import type * as _helpers_predictionEstimators from "../_helpers/predictionEstimators.js";
import type * as _helpers_predictionIntervals from "../_helpers/predictionIntervals.js";
import type * as _helpers_predictionQuality from "../_helpers/predictionQuality.js";
import type * as _helpers_predictionSegments from "../_helpers/predictionSegments.js";
import type * as _helpers_predictionSnapshotContract from "../_helpers/predictionSnapshotContract.js";
import type * as _helpers_timelinePhases from "../_helpers/timelinePhases.js";
import type * as actions_discord from "../actions/discord.js";
import type * as actions_notifications from "../actions/notifications.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as internal_cycleDataAudit from "../internal/cycleDataAudit.js";
import type * as internal_cycleFactsMigration from "../internal/cycleFactsMigration.js";
import type * as internal_predictionSnapshots from "../internal/predictionSnapshots.js";
import type * as mutations_couples from "../mutations/couples.js";
import type * as mutations_cycleContext from "../mutations/cycleContext.js";
import type * as mutations_fixtureCleanup from "../mutations/fixtureCleanup.js";
import type * as mutations_messages from "../mutations/messages.js";
import type * as mutations_misc from "../mutations/misc.js";
import type * as mutations_nudges from "../mutations/nudges.js";
import type * as mutations_painLog from "../mutations/painLog.js";
import type * as mutations_periods from "../mutations/periods.js";
import type * as mutations_predictionSnapshots from "../mutations/predictionSnapshots.js";
import type * as mutations_presence from "../mutations/presence.js";
import type * as mutations_users from "../mutations/users.js";
import type * as queries_capabilities from "../queries/capabilities.js";
import type * as queries_couples from "../queries/couples.js";
import type * as queries_dashboard from "../queries/dashboard.js";
import type * as queries_history from "../queries/history.js";
import type * as queries_messages from "../queries/messages.js";
import type * as queries_nudges from "../queries/nudges.js";
import type * as queries_presence from "../queries/presence.js";
import type * as queries_system from "../queries/system.js";
import type * as queries_users from "../queries/users.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_helpers/auth": typeof _helpers_auth;
  "_helpers/calendarDates": typeof _helpers_calendarDates;
  "_helpers/clerkWebhook": typeof _helpers_clerkWebhook;
  "_helpers/coupleSpace": typeof _helpers_coupleSpace;
  "_helpers/cycleCalculations": typeof _helpers_cycleCalculations;
  "_helpers/cycleFactCorrections": typeof _helpers_cycleFactCorrections;
  "_helpers/cycleFactEligibility": typeof _helpers_cycleFactEligibility;
  "_helpers/cycleFactSemantics": typeof _helpers_cycleFactSemantics;
  "_helpers/cycleFactsFlag": typeof _helpers_cycleFactsFlag;
  "_helpers/cycleIntervals": typeof _helpers_cycleIntervals;
  "_helpers/cyclePredictionData": typeof _helpers_cyclePredictionData;
  "_helpers/cycleReadModel": typeof _helpers_cycleReadModel;
  "_helpers/cycleState": typeof _helpers_cycleState;
  "_helpers/cycleStateExposure": typeof _helpers_cycleStateExposure;
  "_helpers/cycleStateFlag": typeof _helpers_cycleStateFlag;
  "_helpers/historyProjections": typeof _helpers_historyProjections;
  "_helpers/legacyCycleFactClassification": typeof _helpers_legacyCycleFactClassification;
  "_helpers/notificationPrediction": typeof _helpers_notificationPrediction;
  "_helpers/partnerCycleProjection": typeof _helpers_partnerCycleProjection;
  "_helpers/periodEventInvariants": typeof _helpers_periodEventInvariants;
  "_helpers/periodPrediction": typeof _helpers_periodPrediction;
  "_helpers/periodPredictionFlag": typeof _helpers_periodPredictionFlag;
  "_helpers/predictionBounds": typeof _helpers_predictionBounds;
  "_helpers/predictionEstimators": typeof _helpers_predictionEstimators;
  "_helpers/predictionIntervals": typeof _helpers_predictionIntervals;
  "_helpers/predictionQuality": typeof _helpers_predictionQuality;
  "_helpers/predictionSegments": typeof _helpers_predictionSegments;
  "_helpers/predictionSnapshotContract": typeof _helpers_predictionSnapshotContract;
  "_helpers/timelinePhases": typeof _helpers_timelinePhases;
  "actions/discord": typeof actions_discord;
  "actions/notifications": typeof actions_notifications;
  crons: typeof crons;
  http: typeof http;
  "internal/cycleDataAudit": typeof internal_cycleDataAudit;
  "internal/cycleFactsMigration": typeof internal_cycleFactsMigration;
  "internal/predictionSnapshots": typeof internal_predictionSnapshots;
  "mutations/couples": typeof mutations_couples;
  "mutations/cycleContext": typeof mutations_cycleContext;
  "mutations/fixtureCleanup": typeof mutations_fixtureCleanup;
  "mutations/messages": typeof mutations_messages;
  "mutations/misc": typeof mutations_misc;
  "mutations/nudges": typeof mutations_nudges;
  "mutations/painLog": typeof mutations_painLog;
  "mutations/periods": typeof mutations_periods;
  "mutations/predictionSnapshots": typeof mutations_predictionSnapshots;
  "mutations/presence": typeof mutations_presence;
  "mutations/users": typeof mutations_users;
  "queries/capabilities": typeof queries_capabilities;
  "queries/couples": typeof queries_couples;
  "queries/dashboard": typeof queries_dashboard;
  "queries/history": typeof queries_history;
  "queries/messages": typeof queries_messages;
  "queries/nudges": typeof queries_nudges;
  "queries/presence": typeof queries_presence;
  "queries/system": typeof queries_system;
  "queries/users": typeof queries_users;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
