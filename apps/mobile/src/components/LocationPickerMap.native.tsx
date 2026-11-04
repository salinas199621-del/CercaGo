import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

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
      const value=JSON.stringify({latitude:point.lat,longitude:point.lng});
      if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(value);
      else window.parent.postMessage({type:'location-picker-point',coordinates:JSON.parse(value)},'*');
    }
    marker.on('dragend',()=>sendPoint(marker.getLatLng()));
    map.on('click',event=>{marker.setLatLng(event.latlng);sendPoint(event.latlng)});
    function receive(event){
      const value=event.data;
      if(!value||value.type!=='location-picker-set') return;
      const point=[value.coordinates.latitude,value.coordinates.longitude];
      marker.setLatLng(point);map.setView(point,16);
    }
    window.addEventListener('message',receive);
    if(window.parent!==window) window.parent.addEventListener('message',receive);
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
  </script>
</body>
</html>`;
}

export function LocationPickerMap({ coordinates, onSelect, mapHeight = 300 }: {
  coordinates: LocationCoordinates;
  onSelect: (coordinates: LocationCoordinates) => void;
  mapHeight?: number;
}) {
  const webView = useRef<WebView<{}>>(null);
  const [html] = useState(() => createMapHtml(coordinates));

  useEffect(() => {
    const point = JSON.stringify({ latitude: coordinates.latitude, longitude: coordinates.longitude });
    webView.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:{type:'location-picker-set',coordinates:${point}}}));true;`);
  }, [coordinates.latitude, coordinates.longitude]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const value: unknown = JSON.parse(event.nativeEvent.data);
      if (!value || typeof value !== "object" || !("latitude" in value) || !("longitude" in value)) return;
      const point = value as { latitude: unknown; longitude: unknown };
      if (typeof point.latitude !== "number" || typeof point.longitude !== "number" ||
        !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
      onSelect({ latitude: point.latitude, longitude: point.longitude });
    } catch (error) {
      console.error("No se pudo leer la ubicación seleccionada en el mapa", error);
    }
  }

  return (
    <View style={{ height: mapHeight, width: "100%", borderRadius: 16, overflow: "hidden", backgroundColor: "#E8ECEF" }}>
      <WebView<{}>
        ref={webView}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
    </View>
  );
}
