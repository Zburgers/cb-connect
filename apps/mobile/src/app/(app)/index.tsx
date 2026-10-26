import { useContext } from "react";
import { AccessContext } from "../../navigation/accessContext";
import { SanctuaryShell } from "../../components/SanctuaryShell";

export default function SanctuaryHome() {
  const state = useContext(AccessContext);
  return <SanctuaryShell state={state} />;
}
