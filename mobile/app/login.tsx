import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { login } from "@/services/authService";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      Alert.alert(
        "Email required",
        "Please enter your email address."
      );
      return;
    }

    if (!cleanPassword) {
      Alert.alert(
        "Password required",
        "Please enter your password."
      );
      return;
    }

    try {
      setLoggingIn(true);

      const user = await login(cleanEmail, cleanPassword);

      if (user.role === "worker") {
        router.replace("/jobs");
        return;
      }

      if (user.role === "supervisor") {
        router.replace("/supervisor");
        return;
      }

      // A resident account exists but this is the staff app.
      Alert.alert(
        "Wrong app",
        "This account isn't a worker or supervisor account. Use the resident app instead."
      );
    } catch (error: any) {
      console.error("Login failed:", error);

      const status = error?.response?.status;

      Alert.alert(
        "Login failed",
        status === 401
          ? "Incorrect email or password."
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brand}>
              MuniPrioritise
            </Text>

            <Text style={styles.title}>
              Staff Login
            </Text>

            <Text style={styles.subtitle}>
              Sign in as a municipal worker or
              supervisor.
            </Text>
          </View>

          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="name@municipality.gov.za"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>
            Password
          </Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
          />

          <TouchableOpacity
            style={[
              styles.loginButton,
              loggingIn &&
                styles.disabledButton,
            ]}
            onPress={handleLogin}
            disabled={loggingIn}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>
              {loggingIn
                ? "Signing in..."
                : "Login"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },

  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  header: {
    marginBottom: 30,
  },

  brand: {
    color: "#3A6EA5",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1A1A1A",
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: "#6B6B6B",
    marginTop: 8,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 7,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 18,
  },

  loginButton: {
    backgroundColor: "#16A34A",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },

  disabledButton: {
    opacity: 0.55,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
