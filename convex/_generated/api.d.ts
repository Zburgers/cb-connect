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
import type * as _helpers_cycleCalculations from "../_helpers/cycleCalculations.js";
import type * as mutations_couples from "../mutations/couples.js";
import type * as mutations_misc from "../mutations/misc.js";
import type * as mutations_painLog from "../mutations/painLog.js";
import type * as mutations_periods from "../mutations/periods.js";
import type * as mutations_users from "../mutations/users.js";
import type * as queries_couples from "../queries/couples.js";
import type * as queries_dashboard from "../queries/dashboard.js";
import type * as queries_history from "../queries/history.js";
import type * as queries_users from "../queries/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_helpers/auth": typeof _helpers_auth;
  "_helpers/cycleCalculations": typeof _helpers_cycleCalculations;
  "mutations/couples": typeof mutations_couples;
  "mutations/misc": typeof mutations_misc;
  "mutations/painLog": typeof mutations_painLog;
  "mutations/periods": typeof mutations_periods;
  "mutations/users": typeof mutations_users;
  "queries/couples": typeof queries_couples;
  "queries/dashboard": typeof queries_dashboard;
  "queries/history": typeof queries_history;
  "queries/users": typeof queries_users;
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
