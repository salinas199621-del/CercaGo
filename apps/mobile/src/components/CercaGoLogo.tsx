import React from "react";
import { Image, type ImageStyle } from "react-native";
import logo from "../../assets/cercago-logo.png";

export function CercaGoLogo({ style }: { style: ImageStyle }) {
  return <Image source={{ uri: logo }} resizeMode="cover" accessibilityLabel="CercaGo" style={style} />;
}
