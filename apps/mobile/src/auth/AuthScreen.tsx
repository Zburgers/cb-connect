import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { mobileColors } from "../theme/tokens";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }): React.JSX.Element {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { startHostedAuth } = useHostedAuth();
  const palette = useColorScheme() === "dark" ? mobileColors.dark : mobileColors.light;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignIn = mode === "sign-in";
  const action = isSignIn ? "sign-in" : "sign-up";
  const primaryLabel = isSignedIn
    ? isSignIn ? "Switch Account" : "Create New Account"
    : isSignIn ? "Sign In" : "Sign Up";

  if (!isLoaded) {
    return (
      <View
        style={[styles.container, { backgroundColor: palette.background }]}
        accessibilityRole="progressbar"
        accessibilityLabel={`Loading ${action}`}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const handleAuth = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isSignedIn) await signOut();
      const { createdSessionId } = await startHostedAuth({
        mode: isSignIn ? "sign-in" : "sign-up",
      });
      if (!createdSessionId) {
        setError(`Unable to complete ${action}. Please try again.`);
      }
    } catch {
      setError(`Unable to complete ${action}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signOut();
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient colors={palette.atmosphere} style={StyleSheet.absoluteFill} />
      <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>
        {isSignIn ? "Sign In" : "Create Account"}
      </Text>
      <Text style={[styles.subtitle, { color: palette.muted }]}>
        {isSignIn
          ? "Sign in to access your CB Connect account"
          : "Sign up for a new CB Connect account"}
      </Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {isSignedIn ? (
        <View style={styles.notice}>
          <Text style={[styles.secondaryText, { color: palette.foreground }]}>You are currently signed in.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of current account"
            style={[styles.button, styles.secondaryButton, { borderColor: palette.border }]}
            disabled={isSubmitting}
            onPress={handleSignOut}
          >
            <Text style={[styles.secondaryText, { color: palette.foreground }]}>Sign Out</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSignIn ? "Sign in with Clerk" : "Create account with Clerk"}
        style={[styles.button, { backgroundColor: palette.accent }, isSubmitting && styles.disabled]}
        disabled={isSubmitting}
        onPress={handleAuth}
      >
        {isSubmitting ? (
          <ActivityIndicator color={palette.surface} size="small" />
        ) : (
          <Text style={[styles.buttonText, { color: palette.surface }]}>
            {primaryLabel}
          </Text>
        )}
      </Pressable>

      <View style={styles.linkRow}>
        <Text style={[styles.secondaryText, { color: palette.muted }]}>
          {isSignIn ? "Don't have an account?" : "Already have an account?"}
        </Text>
        <Link href={isSignIn ? "/(auth)/sign-up" : "/(auth)/sign-in"} asChild>
          <Pressable accessibilityRole="link">
            <Text style={[styles.linkText, { color: palette.accent }]}>{isSignIn ? "Create Account" : "Sign In"}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: { fontFamily: "serif", fontSize: 34, lineHeight: 42, marginBottom: 8 },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  error: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
  },
  notice: { marginBottom: 16, alignItems: "center" },
  secondaryText: { fontSize: 14, color: "#374151", marginBottom: 8 },
  button: {
    backgroundColor: "#111",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  linkText: { color: "#2563EB", fontSize: 14, fontWeight: "600" },
});
