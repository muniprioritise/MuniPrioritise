import { router } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SupervisorScreen() {
  const handleLogout = () => {
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>
          MuniPrioritise
        </Text>

        <Text style={styles.title}>
          Supervisor Portal
        </Text>

        <Text style={styles.description}>
          Supervisor authentication was successful.
          Supervisor operational screens are outside
          the current worker-screen implementation.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Supervisor
          </Text>

          <Text style={styles.cardText}>
            This route confirms that role-based
            navigation is working correctly.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>
            Log Out
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },

  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },

  brand: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3A6EA5",
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
  },

  description: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#6B6B6B",
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    marginTop: 28,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },

  cardText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B6B6B",
  },

  logoutButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#A61212",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },

  logoutText: {
    color: "#A61212",
    fontSize: 15,
    fontWeight: "700",
  },
});
