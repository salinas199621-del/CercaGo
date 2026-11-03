import React from "react";
import { Image, type ImageStyle } from "react-native";

export function CercaGoLogo({ style }: { style: ImageStyle }) {
  return <Image source={require("../../assets/cercago-logo.png")} resizeMode="cover" accessibilityLabel="CercaGo" style={style} />;
}
