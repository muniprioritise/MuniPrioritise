import { StyleSheet, Text, View } from "react-native";

// PLACEHOLDER — no one has built this tab yet.
// Candidates per the build plan: Nearby Map (resident) or Notifications.
// Replace with the real screen once assigned.
export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.subtitle}>Not built yet — placeholder tab.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6B6B6B" },
});
