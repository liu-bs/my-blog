import { OPTIMIZED_IMAGE_HOSTS } from "@/config/site";

export function hasInAppHistory(): boolean {
  if (typeof window === "undefined") return false;

  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx > 0 : window.history.length > 1;
}

export function safeRedirect(raw: string): string {
  const ok = raw.startsWith("/") && !raw.startsWith("//") && !["/login", "/register"].includes(raw);
  return ok ? raw : "/";
}

export function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function isOptimizableImageSrc(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    return OPTIMIZED_IMAGE_HOSTS.includes(new URL(src).hostname);
  } catch {
    return false;
  }
}

export function buildLoginRedirect(redirectPath: string): string {
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}
