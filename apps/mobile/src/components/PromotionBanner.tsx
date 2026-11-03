import React from "react";
import { ImageBackground, View } from "react-native";
import type { Promotion } from "../promotions";

export function PromotionBanner({ promotion, children }: React.PropsWithChildren<{ promotion: Promotion }>) {
  return (
    <ImageBackground source={promotion.mediaType === "image" ? { uri: promotion.mediaUrl } : undefined} style={{ flex: 1, justifyContent: "center", padding: 22, overflow: "hidden", borderRadius: 24, backgroundColor: "#0A6E69" }} imageStyle={{ borderRadius: 24 }}>
      <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: `${promotion.tint}88`, borderRadius: 24 }} />
      {children}
    </ImageBackground>
  );
}
