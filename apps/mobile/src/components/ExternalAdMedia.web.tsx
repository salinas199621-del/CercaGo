import React from "react";
import { View, type ImageStyle } from "react-native";
import type { SponsoredAd } from "../externalAds";

export function ExternalAdMedia({ ad, style, onPress }: { ad: SponsoredAd; style: ImageStyle; onPress?: () => void }) {
  function openAd(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    onPress?.();
  }

  return (
    <View style={[style, { overflow: "hidden" }]}>
      {ad.mediaType === "video"
        ? React.createElement("div", {
          onClick: openAd,
          style: { position: "absolute", inset: 0 },
        },
        React.createElement("video", {
          src: ad.mediaUrl,
          autoPlay: true,
          loop: true,
          muted: true,
          playsInline: true,
          "aria-label": ad.brandName,
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
        }),
        React.createElement("button", {
          type: "button",
          "aria-label": "Activar sonido",
          onClick: (event: { stopPropagation: () => void; currentTarget: HTMLButtonElement }) => {
            event.stopPropagation();
            const video = event.currentTarget.parentElement?.querySelector("video");
            if (!video) return;
            video.muted = !video.muted;
            event.currentTarget.textContent = video.muted ? "Activar sonido" : "Silenciar";
            event.currentTarget.setAttribute("aria-label", event.currentTarget.textContent);
            if (!video.muted) void video.play();
          },
          style: { position: "absolute", top: 12, left: 12, minHeight: 40, padding: "0 12px", border: "1px solid #ffffff99", borderRadius: 20, background: "#101820d9", color: "#fff", font: "700 13px sans-serif", cursor: "pointer" },
        }, "Activar sonido"))
        : React.createElement("img", {
          src: ad.mediaUrl,
          alt: ad.brandName,
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
        })}
    </View>
  );
}
