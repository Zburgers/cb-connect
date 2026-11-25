import React from "react";
import { Image, StyleSheet } from "react-native";

export type BloomPhase = "Menstruation" | "Follicular" | "Ovulation" | "Luteal";

export function presentedArtworkPhase(title: string): BloomPhase | null {
  const phases: BloomPhase[] = ["Menstruation", "Follicular", "Ovulation", "Luteal"];
  return phases.find((phase) => title.startsWith(phase)) ?? null;
}

const artwork = {
  Menstruation: () => require("../../assets/phases/menstruation.png"),
  Follicular: () => require("../../assets/phases/follicular.png"),
  Ovulation: () => require("../../assets/phases/ovulation.png"),
  Luteal: () => require("../../assets/phases/luteal.png"),
};

export function BloomPhaseArtwork({ phase }: { phase: BloomPhase }): React.JSX.Element {
  return <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" source={artwork[phase]()} resizeMode="contain" style={styles.artwork} />;
}

const styles = StyleSheet.create({ artwork: { width: "100%", height: 172, alignSelf: "center" } });
