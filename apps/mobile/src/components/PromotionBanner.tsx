import React from "react";
import { ImageBackground, View } from "react-native";
import { WebView } from "react-native-webview";
import type { Promotion } from "../promotions";

export function PromotionBanner({ promotion, children }: React.PropsWithChildren<{ promotion: Promotion }>) {
  const style = { flex: 1 as const, justifyContent: "center" as const, padding: 20, overflow: "hidden" as const, borderRadius: 20, backgroundColor: "#0A6E69" };
  const videoUrl = promotion.mediaUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const videoHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:transparent"><video src="${videoUrl}" autoplay loop muted playsinline style="position:fixed;inset:0;width:100%;height:100%;object-fit:cover"></video></body></html>`;
  return promotion.mediaType === "video" ? (
    <View style={style}>
      <WebView
        source={{ html: videoHtml }}
        originWhitelist={["*"]}
        javaScriptEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        pointerEvents="none"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "transparent" }}
      />
      <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: `${promotion.tint}88` }} />
      {children}
    </View>
  ) : (
    <ImageBackground source={{ uri: promotion.mediaUrl }} style={style} imageStyle={{ borderRadius: 20 }}>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: `${promotion.tint}88`, borderRadius: 20 }} />
      {children}
    </ImageBackground>
  );
}
