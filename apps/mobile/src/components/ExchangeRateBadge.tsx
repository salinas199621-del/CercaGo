import React from "react";
import { Text, View } from "react-native";

export function ExchangeRateBadge({ rate, valueDate }: { rate: number | null; valueDate?: string | null }) {
  const formattedRate = rate == null
    ? null
    : new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rate);
  const formattedDate = valueDate
    ? new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${valueDate}T12:00:00Z`))
    : null;

  return (
    <View style={{ backgroundColor: rate == null ? "#FFF7E8" : "#103C2D", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: rate == null ? "#F3DEB3" : "#245941", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: rate == null ? "#7A4B00" : "#D5E9DB", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 }}>BCV USD/VES</Text>
        <Text style={{ color: rate == null ? "#7A4B00" : "#AFC7B5", fontSize: 9, fontWeight: "600" }}>
          {formattedDate ? `Actualizada · ${formattedDate}` : "Actualización diaria"}
        </Text>
      </View>
      <Text style={{ color: rate == null ? "#7A4B00" : "#FFD66B", fontSize: 14, fontWeight: "900", textAlign: "right" }}>
        {formattedRate ? `Bs. ${formattedRate} / USD` : "No disponible"}
      </Text>
    </View>
  );
}
