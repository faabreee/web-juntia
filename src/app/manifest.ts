import type { MetadataRoute } from "next";

// Modo validador instalable: se abre a pantalla completa y solo cubre /validator.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Juntia · Validador de boletos",
    short_name: "Validador",
    description: "Valida boletos en la puerta con la cámara del celular.",
    id: "/validator",
    start_url: "/validator",
    scope: "/validator",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
