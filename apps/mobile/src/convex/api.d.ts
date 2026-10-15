import type { FunctionReference } from "convex/server";
import type { MobileAccessContextDTO } from "@cb-connect/contracts";

export declare const api: {
  readonly queries: {
    readonly mobileAccess: {
      readonly getGuardState: FunctionReference<
        "query",
        "public",
        Record<string, never>,
        MobileAccessContextDTO
      >;
    };
  };
};
