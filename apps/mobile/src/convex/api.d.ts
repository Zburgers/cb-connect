import type { FunctionReference } from "convex/server";
import type {
  CycleCapabilities,
  MobileAccessContextDTO,
} from "@cb-connect/contracts";
import type { CycleDashboardData } from "../features/cycle/CycleDashboardModel";
import type { MobileRole } from "../features/onboarding/onboardingModel";

export declare const api: {
  readonly queries: {
    readonly dashboard: {
      readonly getDashboardData: FunctionReference<
        "query",
        "public",
        { todayDate?: string },
        CycleDashboardData
      >;
    };
    readonly capabilities: {
      readonly getCapabilities: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        CycleCapabilities
      >;
    };
    readonly users: {
      readonly getMe: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        { role?: string; timeZone?: string } | null
      >;
    };
    readonly mobileAccess: {
      readonly getGuardState: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        MobileAccessContextDTO
      >;
    };
  };
  readonly mutations: {
    readonly predictionSnapshots: {
      readonly ensureForViewer: FunctionReference<
        "mutation",
        "public",
        Record<string, never>,
        null
      >;
    };
    readonly users: {
      readonly ensureUser: FunctionReference<
        "mutation",
        "public",
        Record<string, never>,
        string
      >;
      readonly updateUserRole: FunctionReference<
        "mutation",
        "public",
        { role: MobileRole },
        string
      >;
      readonly updateUserTimeZone: FunctionReference<
        "mutation",
        "public",
        { timeZone: string },
        string
      >;
    };
  };
};
