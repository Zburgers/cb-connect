import React from "react";
import { Image, StyleSheet } from "react-native";

export function BloomLocket(): React.JSX.Element {
  return <Image accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" source={require("../../assets/partner/digital-locket.png")} resizeMode="contain" style={styles.artwork} />;
}

const styles = StyleSheet.create({ artwork: { alignSelf: "center", width: "100%", height: 148 } });
