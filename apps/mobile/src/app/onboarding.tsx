import { OnboardingScreen } from "../features/onboarding/OnboardingScreen";
import { AuthGate } from "../auth/AuthGate";

export default function OnboardingRoute() {
  return (
    <AuthGate>
      <OnboardingScreen />
    </AuthGate>
  );
}
