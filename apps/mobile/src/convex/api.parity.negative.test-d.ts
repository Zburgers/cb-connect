import type { FunctionReference } from "convex/server";
import type { AssertTrue, InventoryCovers, PublicRefCompatible } from "./api.parity.assertions";

type MobileRef = FunctionReference<"query", "public", { value: string }, { result: number }>;
type ServerRef = FunctionReference<"query", "public", { value: number }, { result: string }>;

// @ts-expect-error Incompatible args and return data must fail parity.
type IncompatibleReferenceMustFail = AssertTrue<PublicRefCompatible<MobileRef, ServerRef>>;

type UsedPaths = "queries.presence.getPartnerPresence" | "mutations.presence.heartbeat";
type IncompleteInventory = "queries.presence.getPartnerPresence";

// @ts-expect-error Removing a mobile-used reference from the inventory must fail coverage.
type MissingInventoryEntryMustFail = AssertTrue<InventoryCovers<UsedPaths, IncompleteInventory>>;
