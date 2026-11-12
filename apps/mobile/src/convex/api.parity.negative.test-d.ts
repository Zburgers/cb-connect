import type { FunctionReference } from "convex/server";
import type { AssertTrue, CompatibilityByPath, InventoryCovers, PublicRefCompatible, SameKeys, PublicKindCompatible } from "./api.parity.assertions";

type MobileRef = FunctionReference<"query", "public", { value: string }, { result: number }>;
type ServerRef = FunctionReference<"query", "public", { value: number }, { result: string }>;

// @ts-expect-error Incompatible args and return data must fail parity.
type IncompatibleReferenceMustFail = AssertTrue<PublicRefCompatible<MobileRef, ServerRef>>;

type UsedPaths = "queries.presence.getPartnerPresence" | "mutations.presence.heartbeat";
type IncompleteInventory = "queries.presence.getPartnerPresence";

// @ts-expect-error Removing a mobile-used reference from the inventory must fail coverage.
type MissingInventoryEntryMustFail = AssertTrue<InventoryCovers<UsedPaths, IncompleteInventory>>;

// @ts-expect-error The actual parity key comparison must reject a missing map entry.
type MissingParityMapEntryMustFail = AssertTrue<SameKeys<UsedPaths, IncompleteInventory>>;

type MutationRef = FunctionReference<"mutation", "public", { value: string }, { result: number }>;
// @ts-expect-error A change from query to mutation must fail parity.
type ChangedKindMustFail = AssertTrue<PublicKindCompatible<MobileRef, MutationRef>>;

// @ts-expect-error One incompatible member must make the aggregate assignment fail.
const mixedReferencesMustFail: CompatibilityByPath<{ good: MobileRef; bad: MobileRef }, { good: MobileRef; bad: ServerRef }> = { good: true, bad: true };
void mixedReferencesMustFail;
