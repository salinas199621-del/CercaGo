import React from "react";
import { View } from "react-native";
import type { LocationCoordinates } from "./LocationPickerMap.native";

export function LocationPickerMap({ coordinates }: {
  coordinates: LocationCoordinates;
  onSelect: (coordinates: LocationCoordinates) => void;
}) {
  const bounds = [
    coordinates.longitude - 0.012,
    coordinates.latitude - 0.008,
    coordinates.longitude + 0.012,
    coordinates.latitude + 0.008,
  ].join(",");
  const source = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${coordinates.latitude}%2C${coordinates.longitude}`;

  return (
    <View style={{ height: 300, width: "100%", borderRadius: 16, overflow: "hidden", backgroundColor: "#E8ECEF" }}>
      <iframe
        title="Mapa de ubicación de entrega"
        src={source}
        style={{ border: 0, width: "100%", height: "100%" }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </View>
  );
}
