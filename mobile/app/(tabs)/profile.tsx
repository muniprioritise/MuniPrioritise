import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name ?? "Resident"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={styles.row} onPress={() => router.push("/notifications")}>
        <Text style={styles.rowText}>Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F8", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 4, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: "#EAEAEA" },
  name: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  email: { fontSize: 14, color: "#6B6B6B", marginTop: 4 },
  row: { backgroundColor: "#fff", borderRadius: 4, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#EAEAEA" },
  rowText: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  logoutButton: { marginTop: 20, alignItems: "center", padding: 14 },
  logoutText: { color: "#A61212", fontWeight: "600" },
});