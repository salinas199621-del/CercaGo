import React from "react";
import { Text, View } from "react-native";

export function ExchangeRateBadge({ rate, valueDate, fallback = false, compact = false }: {
  rate: number | null;
  valueDate?: string | null;
  fallback?: boolean;
  compact?: boolean;
}) {
  const formattedRate = rate == null
    ? null
    : new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rate);
  const formattedDate = valueDate
    ? new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${valueDate}T12:00:00Z`))
    : null;

  if (compact) {
    return (
      <View style={{ minHeight: 40, backgroundColor: "#FFFFFF24", borderRadius: 13, paddingHorizontal: 9, paddingVertical: 5, justifyContent: "center", gap: 2 }}>
        <Text style={{ color: "#D8FFFA", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 }}>BCV · USD</Text>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>
          {formattedRate ? `Bs. ${formattedRate}` : "No disponible"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: rate == null ? "#EAF7F5" : "#00A896", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: rate == null ? "#BFE5E0" : "#00A896", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: rate == null ? "#08766F" : "#D8FFFA", fontSize: 10, fontWeight: "900", letterSpacing: 0.4 }}>BCV USD/VES</Text>
        <Text style={{ color: rate == null ? "#08766F" : "#D8FFFA", fontSize: 9, fontWeight: "600" }}>
          {fallback ? "Última tasa oficial guardada" : formattedDate ? `Actualizada · ${formattedDate}` : "Actualización diaria"}
        </Text>
      </View>
      <Text style={{ color: rate == null ? "#08766F" : "#fff", fontSize: 14, fontWeight: "900", textAlign: "right" }}>
        {formattedRate ? `Bs. ${formattedRate} / USD` : "No disponible"}
      </Text>
    </View>
  );
}
