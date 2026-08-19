export type OnboardingAuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
};

export function canSelectOnboardingRole({
  isLoading,
  isAuthenticated,
}: OnboardingAuthState): boolean {
  return !isLoading && isAuthenticated;
}
