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

const MIN_PASSWORD_LENGTH = 6;

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Missing info", "Fill in every field.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        "Password too short",
        `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    try {
      setSubmitting(true);
      const user = await register(name.trim(), email.trim(), password);
      router.replace(homeRouteForRole(user.role));
    } catch (error) {
      console.error("Registration failed:", error);
      Alert.alert(
        "Registration failed",
        getApiErrorMessage(error, "Could not create your account. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll background={theme.colors.brand} edges={["top", "left", "right"]}>
      <View style={styles.hero}>
        <Text style={styles.appName}>MuniPrioritise</Text>
        <Text style={styles.tagline}>Create your resident account</Text>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Get started</Text>

        <TextField
          label="Full name"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />

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
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Button title="Create account" onPress={handleRegister} loading={submitting} style={styles.primary} />

        <Text style={styles.divider}>Already registered?</Text>
        <Button title="Log in" variant="secondary" onPress={() => router.replace("/login")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xl },
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
