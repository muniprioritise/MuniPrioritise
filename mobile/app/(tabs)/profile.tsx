import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import Button from "@/components/Button";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import { theme } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";

const { colors, spacing } = theme;

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const name = user?.full_name ?? "Resident";

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.container}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </Card>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push("/notifications")}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.brand} />
          <Text style={styles.rowText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Button title="Log out" icon="log-out-outline" variant="danger" onPress={handleLogout} style={styles.logout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  container: { flex: 1, padding: spacing.xl },
  profileCard: { alignItems: "center", paddingVertical: spacing.xxl, marginBottom: spacing.xl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarLetter: { fontSize: 32, fontWeight: "800", color: colors.accent },
  name: { fontSize: theme.font.heading, fontWeight: "800", color: colors.text },
  email: { fontSize: theme.font.small, color: colors.muted, marginTop: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: theme.hit + 8,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.lg,
  },
  rowPressed: { opacity: 0.85 },
  rowText: { flex: 1, fontSize: theme.font.body, fontWeight: "600", color: colors.text },
  logout: { marginTop: spacing.xl },
});
