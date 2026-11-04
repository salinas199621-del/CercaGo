import React from "react";
import { Image, View, type ImageStyle } from "react-native";
import { WebView } from "react-native-webview";
import type { SponsoredAd } from "../externalAds";

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function ExternalAdMedia({ ad, style, onPress }: { ad: SponsoredAd; style: ImageStyle; onPress?: () => void }) {
  const videoUrl = escapeHtmlAttribute(ad.mediaUrl);
  const videoHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}video{position:fixed;inset:0;width:100%;height:100%;object-fit:cover}.sound-toggle{position:fixed;top:12px;left:12px;min-height:40px;padding:0 12px;border:1px solid #ffffff99;border-radius:20px;background:#101820d9;color:#fff;font:700 13px sans-serif}</style></head><body><video id="ad-video" src="${videoUrl}" autoplay loop muted playsinline></video><button class="sound-toggle" type="button" aria-label="Activar sonido" onclick="event.stopPropagation();const video=document.getElementById('ad-video');video.muted=!video.muted;this.textContent=video.muted?'Activar sonido':'Silenciar';this.setAttribute('aria-label',video.muted?'Activar sonido':'Silenciar');if(!video.muted)video.play().catch(()=>{})">Activar sonido</button><script>document.body.addEventListener('click',event=>{if(event.target.closest('button'))return;window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ad-click')})</script></body></html>`;

  return ad.mediaType === "video" ? (
    <View style={[style, { overflow: "hidden" }]}>
      <WebView
        source={{ html: videoHtml }}
        originWhitelist={["*"]}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onMessage={(event) => {
          if (event.nativeEvent.data === "ad-click") onPress?.();
        }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "transparent" }}
      />
    </View>
  ) : (
    <Image source={{ uri: ad.mediaUrl }} style={style} resizeMode="cover" />
  );
}
