export type Promotion = {
  id: string;
  tag: string;
  title: string;
  body: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  linkUrl?: string;
  tint: string;
};

export const promotionStorageKey = "cercago-promotions-v1";
const publishedPromotionsManifestUrl = "https://salinas199621-del.github.io/CercaGo/promotions.json";
export const promotionsManifestUrl =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? new URL("promotions.json", window.location.href).toString()
    : publishedPromotionsManifestUrl;

export const defaultPromotions: Promotion[] = [
  {
    id: "local-favorites",
    tag: "FAVORITOS DEL BARRIO",
    title: "Lo rico llega rápido",
    body: "Descubre algo nuevo a la vuelta de la esquina.",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=85",
    tint: "#351A13",
  },
  {
    id: "coffee-break",
    tag: "UNA PAUSA QUE TE MERECES",
    title: "Café y algo dulce",
    body: "Tu tarde acaba de mejorar. Desde $3.50.",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85",
    tint: "#332014",
  },
  {
    id: "fresh-market",
    tag: "CERCA, FRESCO, LOCAL",
    title: "El mercado va a ti",
    body: "Llena tu cocina con productos frescos.",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85",
    tint: "#183324",
  },
];

export function parsePromotions(value: unknown): Promotion[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error("La configuración debe ser una lista de hasta 20 anuncios.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`El anuncio ${index + 1} no es válido.`);
    const candidate = item as Record<string, unknown>;
    const mediaUrl = typeof candidate.mediaUrl === "string" ? candidate.mediaUrl.trim() : "";
    const mediaType = candidate.mediaType;
    if (!/^https:\/\//i.test(mediaUrl)) throw new Error(`El anuncio ${index + 1} necesita un enlace HTTPS para imagen o video.`);
    if (mediaType !== "image" && mediaType !== "video") throw new Error(`El tipo de medio del anuncio ${index + 1} debe ser image o video.`);
    const linkUrl = typeof candidate.linkUrl === "string" ? candidate.linkUrl.trim() : "";
    if (linkUrl && !/^https:\/\//i.test(linkUrl)) throw new Error(`El enlace del anuncio ${index + 1} debe usar HTTPS.`);
    return {
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `promotion-${index + 1}`,
      tag: typeof candidate.tag === "string" ? candidate.tag.slice(0, 60) : "",
      title: typeof candidate.title === "string" ? candidate.title.slice(0, 100) : "",
      body: typeof candidate.body === "string" ? candidate.body.slice(0, 200) : "",
      mediaType,
      mediaUrl,
      ...(linkUrl ? { linkUrl } : {}),
      tint: typeof candidate.tint === "string" && /^#[\da-f]{6}$/i.test(candidate.tint) ? candidate.tint : "#183324",
    };
  });
}
