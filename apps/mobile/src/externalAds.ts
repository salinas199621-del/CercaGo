export type SponsoredAd = {
  id: string;
  brandName: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  destinationUrl?: string;
  position: "startup_splash" | "between_categories" | "floating_home";
  active: boolean;
};

const adPositions: SponsoredAd["position"][] = ["startup_splash", "between_categories", "floating_home"];

export function parseSponsoredAds(value: unknown): SponsoredAd[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error("La configuración de marcas patrocinadas no es válida.");

  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`El anuncio patrocinado ${index + 1} no es válido.`);
    const candidate = item as Record<string, unknown>;
    const mediaUrl = typeof candidate.mediaUrl === "string" ? candidate.mediaUrl.trim() : "";
    const destinationUrl = typeof candidate.destinationUrl === "string" ? candidate.destinationUrl.trim() : "";
    if (!/^https:\/\//i.test(mediaUrl)) throw new Error(`El anuncio patrocinado ${index + 1} necesita un enlace HTTPS.`);
    if (destinationUrl && !/^https:\/\//i.test(destinationUrl)) throw new Error(`El enlace del anuncio patrocinado ${index + 1} debe usar HTTPS.`);
    if (candidate.mediaType !== "image" && candidate.mediaType !== "video") throw new Error(`El medio del anuncio patrocinado ${index + 1} no es válido.`);
    if (typeof candidate.position !== "string" || !adPositions.includes(candidate.position as SponsoredAd["position"])) {
      throw new Error(`La posición del anuncio patrocinado ${index + 1} no es válida.`);
    }

    return {
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `sponsored-ad-${index + 1}`,
      brandName: typeof candidate.brandName === "string" ? candidate.brandName.slice(0, 120) : "",
      mediaType: candidate.mediaType,
      mediaUrl,
      ...(destinationUrl ? { destinationUrl } : {}),
      position: candidate.position as SponsoredAd["position"],
      active: candidate.active === true,
    };
  });
}
