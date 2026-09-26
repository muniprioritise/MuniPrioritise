import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import MapView, { Marker } from "react-native-maps";

import { getNearbyReports } from "@/services/reportsService";
import type { Report } from "@/types/report";

export default function MapScreen() {
  const [region, setRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setError("Location permission is needed to show nearby reports.");
          setLoading(false);
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = position.coords;
        setRegion({ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        setReports(await getNearbyReports(latitude, longitude));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the map.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={styles.centered}>
        <Text>Map is only available on Android/iOS.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !region) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Location unavailable."}</Text>
      </View>
    );
  }

  return (
    <MapView style={styles.map} initialRegion={region} showsUserLocation>
      {reports.map((report) => (
        <Marker
          key={report.id}
          coordinate={{ latitude: report.latitude, longitude: report.longitude }}
          title={report.category}
          description={report.description}
          onCalloutPress={() => router.push(`/report/${report.id}`)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 14, color: "#A61212", textAlign: "center" },
});