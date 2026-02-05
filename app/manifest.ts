import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "fluxo.sh",
    short_name: "fluxo.sh",
    description: "Suas finanças, no seu controle",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
    // @ts-expect-error - handle_links is not yet in Next.js types but is valid PWA manifest
    handle_links: "preferred",
    icons: [
      {
        src: "/brand-kit/exports/icon-192-dark.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand-kit/exports/icon-512-dark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
