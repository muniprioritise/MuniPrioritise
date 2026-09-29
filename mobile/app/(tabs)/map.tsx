import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import MapView, { Marker } from "react-native-maps";

import { getApiErrorMessage } from "@/services/apiError";
import { getNearbyReports } from "@/services/reportsService";
import type { Report } from "@/types/report";

interface Coords {
  latitude: number;
  longitude: number;
}

export default function MapScreen() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLocating(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!permission.granted) {
          if (active) {
            setLocationError("Location permission is needed to show nearby reports.");
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({});

        if (active) {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } catch (err) {
        console.error("Failed to get location:", err);

        if (active) {
          setLocationError("Could not get your location. Check that location is turned on.");
        }
      } finally {
        if (active) {
          setLocating(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const loadReports = useCallback(async () => {
    if (!coords) {
      return;
    }

    try {
      setReportsError(null);
      setReports(await getNearbyReports(coords.latitude, coords.longitude));
    } catch (err) {
      console.error("Failed to load nearby reports:", err);
      setReportsError(getApiErrorMessage(err, "Could not load nearby reports."));
    }
  }, [coords]);

  // Refetch every time the tab comes into focus so new reports show up.
  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  if (Platform.OS === "web") {
    return (
      <View style={styles.centered}>
        <Text>Map is only available on Android/iOS.</Text>
      </View>
    );
  }

  if (locating) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (locationError || !coords) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{locationError ?? "Location unavailable."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
      >
        {reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            title={report.category}
            description={report.description}
          />
        ))}
      </MapView>

      {reportsError ? (
        <View style={styles.banner}>
          <Text style={styles.errorText}>{reportsError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { fontSize: 14, color: "#A61212", textAlign: "center" },
  banner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderRadius: 4,
    padding: 12,
  },
});

