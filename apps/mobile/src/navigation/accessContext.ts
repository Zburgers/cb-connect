import { createContext } from "react";
import type { AccessState } from "./accessResolver";

export const AccessContext = createContext<AccessState>("backend_pending");
