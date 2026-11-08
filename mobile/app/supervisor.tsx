import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/Button";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import { theme } from "@/constants/theme";
import { logout } from "@/services/authService";

const { colors, spacing } = theme;

export default function SupervisorScreen() {
  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.logo}>
          <Ionicons name="desktop-outline" size={32} color={colors.accent} />
        </View>

        <Text style={styles.brand}>MuniPrioritise</Text>
        <Text style={styles.title}>Supervisor portal</Text>

        <Card style={styles.card}>
          <Text style={styles.description}>
            Supervisors use the web dashboard to review the queue, reassign jobs and read analytics.
          </Text>
        </Card>

        <Button title="Log Out" icon="log-out-outline" variant="danger" onPress={handleLogout} style={styles.logout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  logo: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  brand: { fontSize: theme.font.small, fontWeight: "700", color: colors.brand, marginBottom: spacing.xs },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  card: { marginTop: spacing.lg },
  description: { fontSize: theme.font.body, lineHeight: 24, color: colors.muted },
  logout: { marginTop: spacing.xl },
});
