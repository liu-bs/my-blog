import type { MetadataRoute } from "next";
import { texts } from "@/texts";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: texts.meta.siteTitle,
    short_name: texts.meta.siteTitle,
    description: texts.meta.siteDescription,

    id: "/",
    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#fafafa",
    theme_color: "#09090b",

    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
