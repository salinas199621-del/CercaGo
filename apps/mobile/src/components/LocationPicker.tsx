import React, { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import * as Location from "../location";
import { useAppearance } from "../appearance";
import { api } from "../api";
import { Button, styles } from "./UI";
import { LocationPickerMap, type LocationCoordinates } from "./LocationPickerMap";

type AddressDetails = { street: string; city: string };
const defaultCoordinates = { latitude: 10.245, longitude: -67.595 };

export function LocationPicker({ visible, initialCoordinates, initialAddress, onClose, onSelect }: {
  visible: boolean;
  initialCoordinates?: LocationCoordinates | null;
  initialAddress?: AddressDetails;
  onClose: () => void;
  onSelect: (coordinates: LocationCoordinates, addressLabel?: string, addressDetails?: AddressDetails) => void;
}) {
  const { theme } = useAppearance();
  const { height: windowHeight } = useWindowDimensions();
  const [coordinates, setCoordinates] = useState<LocationCoordinates>(
    initialCoordinates ?? defaultCoordinates,
  );
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [geocodeRevision, setGeocodeRevision] = useState(0);
  const geocodeSequence = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetEdited = useRef(false);
  const cityEdited = useRef(false);

  useEffect(() => {
    if (visible) setCoordinates(initialCoordinates ?? defaultCoordinates);
  }, [visible, initialCoordinates?.latitude, initialCoordinates?.longitude]);

  useEffect(() => {
    if (!visible) return;
    const initialStreet = initialAddress?.street ?? "";
    const initialCity = initialAddress?.city ?? "";
    setStreet(initialStreet);
    setCity(initialCity);
    streetEdited.current = Boolean(initialStreet);
    cityEdited.current = Boolean(initialCity);
  }, [visible, initialAddress?.street, initialAddress?.city]);

  useEffect(() => {
    if (!visible) return;
    const sequence = ++geocodeSequence.current;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setGeocoding(true);
    const geocodeAddress = async () => {
      try {
        const result = await api<AddressDetails>(
          `/location/reverse?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}`,
        );
        if (sequence !== geocodeSequence.current) return;
        if (result.street && !streetEdited.current) setStreet(result.street);
        if (result.city && !cityEdited.current) setCity(result.city);
        setError("");
      } catch (reason) {
        if (sequence === geocodeSequence.current) {
          setError("No se pudo completar la dirección automáticamente. Puedes escribirla.");
          console.error("No se pudo obtener la dirección desde OpenStreetMap", reason);
        }
      } finally {
        if (sequence === geocodeSequence.current) setGeocoding(false);
      }
    };
    const timer = setTimeout(() => void geocodeAddress(), 1200);
    debounceTimer.current = timer;
    return () => {
      ++geocodeSequence.current;
      clearTimeout(timer);
    };
  }, [coordinates.latitude, coordinates.longitude, visible, geocodeRevision]);

  function updateCoordinates(next: LocationCoordinates) {
    streetEdited.current = false;
    cityEdited.current = false;
    setStreet("");
    setCity("");
    setCoordinates(next);
    setGeocodeRevision((revision) => revision + 1);
    setError("");
    onSelect(next);
  }

  async function useCurrentLocation() {
    setLocating(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Debes permitir el acceso a la ubicación para usar el GPS.");
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateCoordinates(current.coords);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo obtener tu ubicación";
      setError(message);
      Alert.alert("Ubicación no disponible", message);
    } finally {
      setLocating(false);
    }
  }

  function confirmLocation() {
    const addressLine = [street.trim(), city.trim()].filter(Boolean).join(", ");
    onSelect(coordinates, addressLine, { street: street.trim(), city: city.trim() });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#15192388" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%", maxWidth: 620, maxHeight: "94%", alignSelf: "center" }}
        >
          <View style={{ maxHeight: "100%", backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 18 }}>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.title, { color: theme.ink }]}>Fija tu dirección en el mapa</Text>
                  <Text style={[styles.subtitle, { color: theme.muted }]}>Mueve el pin o toca el punto exacto en el mapa.</Text>
                </View>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar mapa" hitSlop={10}>
                  <Text style={{ color: theme.muted, fontSize: 24 }}>×</Text>
                </Pressable>
              </View>
              <LocationPickerMap coordinates={coordinates} onSelect={updateCoordinates} mapHeight={Math.min(280, Math.max(170, windowHeight * 0.28))} />
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Text style={{ flex: 1, color: theme.muted, fontSize: 11, lineHeight: 16 }}>
                  {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)} · © OpenStreetMap
                </Text>
                <Pressable accessibilityRole="button" disabled={locating} onPress={() => void useCurrentLocation()} style={{
                  minHeight: 42, borderRadius: 12, paddingHorizontal: 12, justifyContent: "center",
                  backgroundColor: theme.soft, opacity: locating ? 0.6 : 1,
                }}>
                  <Text style={{ color: theme.primaryDark, fontSize: 12, fontWeight: "800" }}>
                    {locating ? "Buscando GPS…" : "Usar mi ubicación actual"}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="Calle o avenida"
                placeholder="Calle o avenida"
                placeholderTextColor={theme.muted}
                value={street}
                onChangeText={(value) => { streetEdited.current = true; setStreet(value); }}
                style={{ minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, color: theme.ink, backgroundColor: theme.background }}
              />
              <TextInput
                accessibilityLabel="Ciudad"
                placeholder="Ciudad"
                placeholderTextColor={theme.muted}
                value={city}
                onChangeText={(value) => { cityEdited.current = true; setCity(value); }}
                style={{ minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, color: theme.ink, backgroundColor: theme.background }}
              />
              {geocoding && <Text style={{ color: theme.muted, fontSize: 12 }}>Buscando calle y ciudad…</Text>}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button title="Usar esta ubicación" onPress={confirmLocation} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
