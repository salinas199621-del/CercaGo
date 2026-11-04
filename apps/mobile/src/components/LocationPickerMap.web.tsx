import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { LocationCoordinates } from "./LocationPickerMap.native";

function createMapHtml(initial: LocationCoordinates) {
  const center = JSON.stringify([initial.latitude, initial.longitude]);
  return `<!doctype html>
<html lang="es">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>html,body,#map{height:100%;width:100%;margin:0}.leaflet-control-attribution{font-size:9px}</style>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    const initial=${center};
    const map=L.map('map',{zoomControl:true}).setView(initial,16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,attribution:'&copy; OpenStreetMap'
    }).addTo(map);
    const marker=L.marker(initial,{draggable:true}).addTo(map);
    function sendPoint(point){
      window.parent.postMessage({type:'location-picker-point',coordinates:{latitude:point.lat,longitude:point.lng}},'*');
    }
    marker.on('dragend',()=>sendPoint(marker.getLatLng()));
    map.on('click',event=>{marker.setLatLng(event.latlng);sendPoint(event.latlng)});
    window.addEventListener('message',event=>{
      const value=event.data;
      if(!value||value.type!=='location-picker-set') return;
      const point=[value.coordinates.latitude,value.coordinates.longitude];
      marker.setLatLng(point);map.setView(point,16);
    });
  </script>
</body>
</html>`;
}

export function LocationPickerMap({ coordinates, onSelect, mapHeight = 300 }: {
  coordinates: LocationCoordinates;
  onSelect: (coordinates: LocationCoordinates) => void;
  mapHeight?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html] = useState(() => createMapHtml(coordinates));

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || !event.data ||
        event.data.type !== "location-picker-point") return;
      const latitude = Number(event.data.coordinates?.latitude);
      const longitude = Number(event.data.coordinates?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
      onSelect({ latitude, longitude });
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onSelect]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({
      type: "location-picker-set",
      coordinates: { latitude: coordinates.latitude, longitude: coordinates.longitude },
    }, "*");
  }, [coordinates.latitude, coordinates.longitude]);

  return (
    <View style={{ height: mapHeight, width: "100%", borderRadius: 16, overflow: "hidden", backgroundColor: "#E8ECEF" }}>
      {React.createElement("iframe", {
        ref: frame,
        title: "Mapa interactivo de OpenStreetMap",
        srcDoc: html,
        loading: "lazy",
        style: { border: 0, width: "100%", height: "100%" },
      })}
    </View>
  );
}
