import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { mobileColors } from "../theme/tokens";

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps extends React.PropsWithChildren {
  palette: (typeof mobileColors)["light"] | (typeof mobileColors)["dark"];
}

export function ErrorBoundary({ children }: React.PropsWithChildren): React.JSX.Element {
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  return <ErrorBoundaryView palette={palette}>{children}</ErrorBoundaryView>;
}

class ErrorBoundaryView extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        style={[styles.container, { backgroundColor: this.props.palette.background }]}
        accessibilityRole="alert"
        accessibilityLabel="An unexpected error occurred"
      >
        <Text allowFontScaling accessibilityRole="header" style={[styles.title, { color: this.props.palette.foreground }]}>
          Something went wrong
        </Text>
        <Text allowFontScaling style={[styles.message, { color: this.props.palette.muted }]}>
          Please close and reopen the app.
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  message: { fontSize: 15, textAlign: "center" },
});

export default ErrorBoundary;
