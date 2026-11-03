import React, { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { Button, styles } from "./UI";
import { LocationPickerMap, type LocationCoordinates } from "./LocationPickerMap";

export function LocationPicker({ visible, initialCoordinates, onClose, onSelect }: {
  visible: boolean;
  initialCoordinates?: LocationCoordinates | null;
  onClose: () => void;
  onSelect: (coordinates: LocationCoordinates, addressLabel?: string) => void;
}) {
  const [coordinates, setCoordinates] = useState<LocationCoordinates>(
    initialCoordinates ?? { latitude: 10.4806, longitude: -66.9036 },
  );
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState("");
  const subscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (initialCoordinates) setCoordinates(initialCoordinates);
  }, [initialCoordinates?.latitude, initialCoordinates?.longitude]);

  useEffect(() => () => subscription.current?.remove(), []);

  async function updateCoordinates(next: LocationCoordinates) {
    setCoordinates(next);
    setError("");
    try {
      const [place] = await Location.reverseGeocodeAsync(next);
      if (place) {
        const label = [place.street, place.name, place.subregion, place.city].filter(Boolean).join(", ");
        onSelect(next, label || undefined);
        return;
      }
    } catch (reason) {
      console.warn("No se pudo obtener la dirección de las coordenadas", reason);
    }
    onSelect(next);
  }

  async function startTracking() {
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Debes permitir el acceso a la ubicación para usar el GPS.");
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await updateCoordinates(current.coords);
      subscription.current?.remove();
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (position) => { void updateCoordinates(position.coords); },
      );
      setTracking(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo obtener tu ubicación");
    }
  }

  function stopTracking() {
    subscription.current?.remove();
    subscription.current = null;
    setTracking(false);
  }

  function close() {
    stopTracking();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#15192366" }}>
        <Pressable onPress={close} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ width: "100%", maxWidth: 620, maxHeight: "92%", alignSelf: "center", backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.title}>Ubicación de entrega</Text>
              <Text style={styles.subtitle}>El punto del mapa se guarda con tu dirección.</Text>
            </View>
            <Pressable onPress={close} accessibilityRole="button"><Text style={{ color: "#777D89", fontSize: 24 }}>×</Text></Pressable>
          </View>
          <LocationPickerMap coordinates={coordinates} onSelect={(next) => void updateCoordinates(next)} />
          <Text style={{ color: "#667085", fontSize: 11 }}>
            {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
            {tracking ? " · GPS activo" : ""}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={tracking ? "Detener GPS" : "Rastrear mi ubicación"} secondary onPress={() => tracking ? stopTracking() : void startTracking()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Usar esta ubicación" onPress={() => { onSelect(coordinates); close(); }} />
            </View>
          </View>
          {PlatformNotice()}
        </View>
      </View>
    </Modal>
  );
}

function PlatformNotice() {
  if (Platform.OS !== "web" || typeof window === "undefined" || window.isSecureContext !== false) return null;
  return (
    <Text style={{ color: "#777D89", fontSize: 11, lineHeight: 16 }}>
      En el navegador, el GPS requiere HTTPS. En una dirección local HTTP usa CercaGo en Expo Go o abre la app por HTTPS.
    </Text>
  );
}
