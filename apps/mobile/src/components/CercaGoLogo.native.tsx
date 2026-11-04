import React from "react";
import { Image, type ImageStyle } from "react-native";

export function CercaGoLogo({ style }: { style: ImageStyle }) {
  return <Image source={require("../../assets/cercago-wordmark.png")} resizeMode="contain" accessibilityLabel="CercaGo" style={style} />;
}
