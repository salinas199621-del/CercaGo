import React from "react";
import { Image, type ImageStyle } from "react-native";
import logo from "../../assets/cercago-wordmark.png";

export function CercaGoLogo({ style }: { style: ImageStyle }) {
  return <Image source={{ uri: logo }} resizeMode="contain" accessibilityLabel="CercaGo" style={style} />;
}
