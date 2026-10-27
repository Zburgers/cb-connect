import { useContext } from "react";
import { Redirect } from "expo-router";
import { accessStatusRedirect } from "../../navigation/accessResolver";
import { AccessContext } from "../../navigation/accessContext";
import { SanctuaryShell } from "../../components/SanctuaryShell";

export default function AccessStatus() {
  const state = useContext(AccessContext);
  const redirect = accessStatusRedirect(state);
  if (redirect) return <Redirect href={redirect} />;
  return <SanctuaryShell state={state} />;
}
