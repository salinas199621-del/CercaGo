import React from "react";
import { Text, View } from "react-native";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export function LocationPickerMap({ coordinates }: {
  coordinates: LocationCoordinates;
  onSelect: (coordinates: LocationCoordinates) => void;
}) {
  return (
    <View style={{ height: 180, width: "100%", borderRadius: 16, backgroundColor: "#EAF5F3", alignItems: "center", justifyContent: "center", padding: 22, gap: 8 }}>
      <Text style={{ fontSize: 28 }}>📍</Text>
      <Text style={{ color: "#176B64", fontSize: 15, fontWeight: "800", textAlign: "center" }}>Mapa pendiente de configurar</Text>
      <Text style={{ color: "#667085", fontSize: 12, lineHeight: 18, textAlign: "center" }}>
        Puedes usar el GPS y guardar estas coordenadas. El mapa se habilitará en una próxima versión.
      </Text>
      <Text style={{ color: "#667085", fontSize: 11 }}>{coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</Text>
    </View>
  );
}
