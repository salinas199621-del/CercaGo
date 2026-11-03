import React from "react";
import { View } from "react-native";
import type { Promotion } from "../promotions";

export function PromotionBanner({ promotion, children }: React.PropsWithChildren<{ promotion: Promotion }>) {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 22, overflow: "hidden", borderRadius: 24, backgroundColor: "#0A6E69" }}>
      {promotion.mediaType === "video"
        ? React.createElement("video", {
          src: promotion.mediaUrl,
          autoPlay: true,
          loop: true,
          muted: true,
          playsInline: true,
          "aria-label": promotion.title,
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
        })
        : React.createElement("img", {
          src: promotion.mediaUrl,
          alt: "",
          "aria-hidden": true,
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
        })}
      <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: `${promotion.tint}88` }} />
      {children}
    </View>
  );
}
