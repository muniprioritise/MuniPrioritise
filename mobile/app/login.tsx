import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import Button from "@/components/Button";
import Screen from "@/components/Screen";
import TextField from "@/components/TextField";
import { theme } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/services/apiError";
import { homeRouteForRole } from "@/utils/roleRoutes";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing info", "Enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);
      const user = await login(email.trim(), password);
      router.replace(homeRouteForRole(user.role));
    } catch (error) {
      console.log("Login failed:", error);
      Alert.alert(
        "Login failed",
        getApiErrorMessage(error, "Could not log you in. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll background={theme.colors.brand} edges={["top", "left", "right"]}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>M</Text>
        </View>
        <Text style={styles.appName}>MuniPrioritise</Text>
        <Text style={styles.tagline}>Report a problem. Fair, faster service.</Text>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Welcome back</Text>

        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextField
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <Button title="Log in" onPress={handleLogin} loading={submitting} style={styles.primary} />

        <Text style={styles.divider}>New here?</Text>
        <Button title="Create an account" variant="secondary" onPress={() => router.push("/register")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.brandStrong,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  logoLetter: { fontSize: 34, fontWeight: "800", color: theme.colors.accent },
  appName: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.onBrand },
  tagline: { fontSize: theme.font.small, color: theme.colors.brandSoft, marginTop: theme.spacing.xs },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
  },
  title: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text, marginBottom: theme.spacing.xl },
  primary: { marginTop: theme.spacing.sm },
  divider: { textAlign: "center", color: theme.colors.muted, fontSize: theme.font.small, marginVertical: theme.spacing.lg },
});
