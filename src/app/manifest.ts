import type { MetadataRoute } from "next";
import meta from "@/texts/meta";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: meta.siteTitle,
    short_name: meta.siteTitle,
    description: meta.siteDescription,

    id: "/",
    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#fafafa",
    theme_color: "#09090b",

    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
