import { View, Text } from "react-native";

// Public placeholder only: no user identity, health state or partner data.
export default function MobileFoundationHome() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text accessibilityRole="header">CB Connect</Text>
      <Text>Mobile foundation — isolated development build</Text>
    </View>
  );
}
