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

export type PublicRefCompatible<Mobile extends PublicFunctionReference, Server extends PublicFunctionReference> =
  PublicArgsCompatible<Mobile, Server> extends true
    ? ServerReturnAssignable<Mobile, Server>
    : false;

export type InventoryCovers<Used, Inventory> = Exclude<Used, Inventory> extends never ? true : false;
export type SameKeys<Left, Right> =
  Exclude<keyof Left, keyof Right> extends never
    ? Exclude<keyof Right, keyof Left> extends never
      ? true
      : false
    : false;

export type AssertTrue<Value extends true> = Value;
