import React from "react";
import MapView, { Marker, type Region } from "react-native-maps";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export function LocationPickerMap({ coordinates, onSelect }: {
  coordinates: LocationCoordinates;
  onSelect: (coordinates: LocationCoordinates) => void;
}) {
  const region: Region = {
    ...coordinates,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  return (
    <MapView
      style={{ height: 300, width: "100%", borderRadius: 16 }}
      region={region}
      onPress={(event) => onSelect(event.nativeEvent.coordinate)}
    >
      <Marker coordinate={coordinates} draggable onDragEnd={(event) => onSelect(event.nativeEvent.coordinate)} />
    </MapView>
  );
}
