import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";
import { CercaGoLogo } from "./CercaGoLogo";
import { useAppearance } from "../appearance";

export function HomeSplash() {
  const { theme } = useAppearance();
  const pulse = useRef(new Animated.Value(0)).current;

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.9, 1, 0] });

  useEffect(() => {
    const fade = Animated.timing(pulse, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web" });
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.45, duration: 420, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    const fadeTimer = setTimeout(() => {
      loop.stop();
      fade.start();
    }, 1050);
    return () => { clearTimeout(fadeTimer); loop.stop(); fade.stop(); };
  }, [pulse]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary }}>
      <Animated.View style={{ alignItems: "center", gap: 16, transform: [{ scale }], opacity }}>
        <CercaGoLogo style={{ width: 238, height: 238, borderRadius: 36, backgroundColor: theme.surface }} />
        <Text style={{ color: "#E7FFFC", fontSize: 13, fontWeight: "700", letterSpacing: 1.1 }}>TODO LO BUENO, MÁS CERCA</Text>
      </Animated.View>
    </View>
  );
}
