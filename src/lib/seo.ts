import type { Metadata } from "next";

type PageAlternates = NonNullable<Metadata["alternates"]>;

export function pageAlternates(path: string): PageAlternates {
  return {
    canonical: path,
    types: { "application/rss+xml": "/rss" },
  };
}
