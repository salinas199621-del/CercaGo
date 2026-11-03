import React from "react";
import { Text, View } from "react-native";

export function ExchangeRateBadge({ rate, valueDate }: { rate: number | null; valueDate?: string | null }) {
  const formattedRate = rate == null
    ? null
    : new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(rate);
  const formattedDate = valueDate
    ? new Intl.DateTimeFormat("es-VE", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${valueDate}T12:00:00Z`))
    : null;

  return (
    <View style={{ backgroundColor: rate == null ? "#FFF7E8" : "#F0F8F3", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: rate == null ? "#F3DEB3" : "#D9EFE1" }}>
      <Text style={{ color: rate == null ? "#7A4B00" : "#17633A", fontSize: 12, fontWeight: "900" }}>
        {formattedRate
          ? `Tasa BCV · 1 USD = Bs. ${formattedRate}${formattedDate ? ` · Valor ${formattedDate}` : ""}`
          : "Tasa BCV no disponible · Intenta más tarde"}
      </Text>
    </View>
  );
}
