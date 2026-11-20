import { useContext, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { AccessContext } from "../../navigation/accessContext";
import { api } from "../../convex/api";
import { PartnerControls } from "../../features/partner/PartnerControls";

export default function PartnerRoute(): React.JSX.Element {
  const access = useContext(AccessContext);
  const guard = useQuery(api.queries.mobileAccess.getGuardState, {});
  const couple = useQuery(api.queries.couples.getCoupleStatus, {});
  const [revoking, setRevoking] = useState(false);
  const role = guard?.user?.role ?? null;
  useEffect(() => {
    if (couple?.status !== "active") setRevoking(false);
  }, [couple?.status]);

  return (
    <PartnerControls
      access={access}
      role={role}
      couple={couple}
      guard={guard}
      isActive={couple?.status === "active"}
      revoking={revoking}
      onRevokeStart={() => setRevoking(true)}
      onRevokeFailure={() => setRevoking(false)}
    />
  );
}
