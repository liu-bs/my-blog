export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

export const PROTECTED_ROUTES = ["/write", "/settings", "/profile"];

export const STATIC_PARAMS_LIMIT = 100;

/** sitemap 分批拉取的批大小（不再一次性拉全量） */
export const SITEMAP_BATCH_SIZE = 500;

export const OPTIMIZED_IMAGE_HOSTS = ["images.pexels.com"];

export const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/posts", key: "posts" },
] as const;
