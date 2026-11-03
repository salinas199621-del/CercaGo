import React, { useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { Button, styles } from "../components/UI";
import { ExchangeRateBadge } from "../components/ExchangeRateBadge";
import { AndroidDownloadLink } from "../components/AndroidDownloadLink";
import { useAppearance } from "../appearance";

const pages = [
  { eyebrow: "TODO TU BARRIO, EN UN SOLO LUGAR", title: "Lo bueno está más cerca", body: "Descubre restaurantes, tiendas y favoritos locales a pocos minutos de ti.", icon: "🏘️", color: "#E7F7F5", accent: "#00A896" },
  { eyebrow: "FÁCIL, RÁPIDO Y A TU MANERA", title: "Pide lo que te encanta", body: "Explora menús, encuentra ofertas y recibe todo en la puerta de tu casa.", icon: "🛍️", color: "#EEF7EC", accent: "#468A58" },
  { eyebrow: "CADA PEDIDO, SIEMPRE A LA VISTA", title: "Tu pedido va contigo", body: "Sigue cada paso y conoce a las personas que hacen crecer tu comunidad.", icon: "🛵", color: "#FFF5D9", accent: "#D98B18" },
];

export function OnboardingScreen({ exchangeRate, exchangeRateValueDate, onComplete }: { exchangeRate: number | null; exchangeRateValueDate: string | null; onComplete: () => void }) {
  const { theme } = useAppearance();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const width = Math.min(Dimensions.get("window").width - 40, 440);

  function moveTo(index: number) {
    const next = Math.max(0, Math.min(index, pages.length - 1));
    setPage(next);
    scrollRef.current?.scrollTo({ x: width * next, animated: true });
  }

  return (
    <ScrollView style={[styles.page, { backgroundColor: theme.background }]} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 24 }}>
      <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <Text style={{ color: theme.primaryDark, fontWeight: "900", fontSize: 17, letterSpacing: 2 }}>CERCAGO</Text>
          <Pressable accessibilityRole="button" onPress={onComplete} hitSlop={12}>
            <Text style={{ color: "#777D89", fontSize: 14, fontWeight: "700" }}>Omitir</Text>
          </Pressable>
        </View>
        <View style={{ marginBottom: 14 }}>
          <ExchangeRateBadge rate={exchangeRate} valueDate={exchangeRateValueDate} />
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ alignItems: "center" }}
        >
          {pages.map((item, index) => (
            <View key={item.title} style={{ width, paddingHorizontal: 20 }}>
              <View style={{ height: 360, borderRadius: 32, backgroundColor: item.color, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <View style={{ position: "absolute", width: 250, height: 250, borderRadius: 150, backgroundColor: `${item.accent}18`, top: 54, right: -56 }} />
                <View style={{ position: "absolute", width: 190, height: 190, borderRadius: 120, backgroundColor: `${item.accent}18`, bottom: -48, left: -32 }} />
                <View style={{ width: 210, height: 210, borderRadius: 110, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#303443", shadowOpacity: 0.10, shadowRadius: 24, elevation: 7 }}>
                  <Text style={{ fontSize: 105 }}>{item.icon}</Text>
                </View>
                <View style={{ position: "absolute", bottom: 30, right: 24, backgroundColor: "#fff", paddingVertical: 11, paddingHorizontal: 16, borderRadius: 18, elevation: 4 }}>
                  <Text style={{ color: item.accent, fontWeight: "800" }}>✦ Cerca de ti</Text>
                </View>
                <View style={{ position: "absolute", top: 28, left: 22, backgroundColor: "#fff", width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22 }}>{index === 0 ? "📍" : index === 1 ? "♡" : "✓"}</Text>
                </View>
              </View>
              <Text style={{ color: item.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.4, marginTop: 28 }}>{item.eyebrow}</Text>
              <Text style={[styles.title, { fontSize: 31, marginTop: 9, lineHeight: 38 }]}>{item.title}</Text>
              <Text style={[styles.subtitle, { marginTop: 10, fontSize: 16, lineHeight: 24 }]}>{item.body}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 23, marginBottom: 12 }}>
          {pages.map((item, index) => (
            <Pressable key={item.title} onPress={() => moveTo(index)} accessibilityRole="button" accessibilityLabel={`Ir a la pantalla ${index + 1}`}>
              <Animated.View style={{ width: page === index ? 24 : 7, height: 7, borderRadius: 5, backgroundColor: page === index ? theme.primary : "#D8DBE1" }} />
            </Pressable>
          ))}
        </View>
        <Button title={page === pages.length - 1 ? "Comenzar" : "Continuar"} onPress={() => page === pages.length - 1 ? onComplete() : moveTo(page + 1)} />
        <View style={{ marginTop: 10 }}>
          <AndroidDownloadLink />
        </View>
      </View>
    </ScrollView>
  );
}