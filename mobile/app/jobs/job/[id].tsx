import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

export default function JobDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    jobId: string;
    category: string;
    description: string;
    severity: string;
    status: string;
    address: string;
    ward: string;
    latitude: string;
    longitude: string;
    submittedAt: string;
    priorityScore: string;
  }>();

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);

  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const openGoogleMaps = async () => {
    if (!hasCoordinates) return;

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${latitude},${longitude}`;

    await Linking.openURL(url);
  };

  const openWaze = async () => {
    if (!hasCoordinates) return;

    const url =
      `https://waze.com/ul?ll=${latitude},${longitude}` +
      `&navigate=yes`;

    await Linking.openURL(url);
  };

  const goToStatus = () => {
    router.push({
      pathname: "/jobs/status/[id]",
      params: {
        id: params.id,
        jobId: params.jobId,
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.category}>
            {params.category}
          </Text>

          <Text style={styles.ward}>
            {params.ward}
          </Text>
        </View>

        <View style={styles.severityBadge}>
          <Text style={styles.severityText}>
            {params.severity?.toUpperCase()}
          </Text>
        </View>
      </View>

      {params.priorityScore ? (
        <View style={styles.priorityCard}>
          <Text style={styles.priorityLabel}>
            Priority Score
          </Text>

          <Text style={styles.priorityValue}>
            {Math.round(
              Number(params.priorityScore) * 100
            )}
            %
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Report
        </Text>

        <Text style={styles.description}>
          {params.description}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Location
        </Text>

        <Text style={styles.address}>
          {params.address}
        </Text>

        {hasCoordinates && (
          <Text style={styles.coordinates}>
            {latitude.toFixed(5)},{" "}
            {longitude.toFixed(5)}
          </Text>
        )}

        <View style={styles.mapButtons}>
          <TouchableOpacity
            style={styles.mapButton}
            onPress={openGoogleMaps}
            disabled={!hasCoordinates}
          >
            <Text style={styles.mapButtonText}>
              Google Maps
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapButtonSecondary}
            onPress={openWaze}
            disabled={!hasCoordinates}
          >
            <Text
              style={styles.mapButtonSecondaryText}
            >
              Waze
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Status
        </Text>

        <Text style={styles.status}>
          {params.status
            ?.replace("_", " ")
            .toUpperCase()}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={goToStatus}
      >
        <Text style={styles.primaryButtonText}>
          Update Job Status
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  category: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1A1A",
  },

  ward: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B6B6B",
  },

  severityBadge: {
    backgroundColor: "#FBDADA",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  severityText: {
    color: "#A61212",
    fontSize: 12,
    fontWeight: "700",
  },

  priorityCard: {
    backgroundColor: "#EAF2FB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  priorityLabel: {
    fontSize: 14,
    color: "#3A6EA5",
    fontWeight: "600",
  },

  priorityValue: {
    fontSize: 22,
    color: "#3A6EA5",
    fontWeight: "700",
  },

  section: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B6B6B",
    textTransform: "uppercase",
    marginBottom: 10,
  },

  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#282828",
  },

  address: {
    fontSize: 15,
    fontWeight: "600",
    color: "#282828",
  },

  coordinates: {
    marginTop: 5,
    fontSize: 13,
    color: "#777777",
  },

  mapButtons: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },

  mapButton: {
    flex: 1,
    backgroundColor: "#3A6EA5",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  mapButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  mapButtonSecondary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#3A6EA5",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  mapButtonSecondaryText: {
    color: "#3A6EA5",
    fontWeight: "600",
  },

  status: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3A6EA5",
  },

  primaryButton: {
    backgroundColor: "#16A34A",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});