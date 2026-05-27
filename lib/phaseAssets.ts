export const PHASE_ASSETS: Record<string, string> = {
  menstruation: "/assets/phases/menstruation.png",
  follicular: "/assets/phases/follicular.png",
  ovulation: "/assets/phases/ovulation.png",
  luteal: "/assets/phases/luteal.png",
};

export function getPhaseAsset(phase: string) {
  return PHASE_ASSETS[phase] ?? PHASE_ASSETS.follicular;
}
