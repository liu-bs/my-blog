import type { MetadataRoute } from "next";
import { messages } from "@/texts";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.meta.siteTitle,
    short_name: messages.meta.siteTitle,
    description: messages.meta.siteDescription,

    id: "/",
    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#fafafa",
    theme_color: "#09090b",

    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
