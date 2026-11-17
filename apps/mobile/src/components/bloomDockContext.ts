import { createContext, useContext } from "react";

export const BloomDockInsetContext = createContext(0);

export function useBloomDockInset(): number {
  return useContext(BloomDockInsetContext);
}
