import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

type PublicFunctionReference = FunctionReference<any, "public", any, any, any>;

export type PublicArgsCompatible<Mobile extends PublicFunctionReference, Server extends PublicFunctionReference> =
  [FunctionArgs<Mobile>] extends [FunctionArgs<Server>]
    ? [FunctionArgs<Server>] extends [FunctionArgs<Mobile>]
      ? true
      : false
    : false;

export type ServerReturnAssignable<Mobile extends PublicFunctionReference, Server extends PublicFunctionReference> =
  [FunctionReturnType<Server>] extends [FunctionReturnType<Mobile>] ? true : false;

export type PublicKindCompatible<Mobile extends PublicFunctionReference, Server extends PublicFunctionReference> =
  [Mobile["_type"]] extends [Server["_type"]] ? [Server["_type"]] extends [Mobile["_type"]] ? true : false : false;

export type PublicRefCompatible<Mobile extends PublicFunctionReference, Server extends PublicFunctionReference> =
  PublicKindCompatible<Mobile, Server> extends true
    ? PublicArgsCompatible<Mobile, Server> extends true
      ? ServerReturnAssignable<Mobile, Server>
      : false
    : false;

export type CompatibilityByPath<Mobile extends Record<string, PublicFunctionReference>, Server extends Record<string, PublicFunctionReference>> = {
  [Path in keyof Mobile]: Path extends keyof Server ? PublicRefCompatible<Mobile[Path], Server[Path]> : false;
};

export type InventoryCovers<Used, Inventory> = Exclude<Used, Inventory> extends never ? true : false;
export type SameKeys<Left, Right> =
  Exclude<Left, Right> extends never
    ? Exclude<Right, Left> extends never
      ? true
      : false
    : false;

export type AssertTrue<Value extends true> = Value;
