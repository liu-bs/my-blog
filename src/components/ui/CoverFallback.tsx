import { ImageIcon } from "lucide-react";
import type { CoverFallbackProps } from "@shared";

export function CoverFallback({ className = "" }: CoverFallbackProps) {
  return (

    <div
      className={`flex aspect-16/10 w-full items-center justify-center rounded-md text-muted cover-fallback ${className}`}
    >

      <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
    </div>
  );
}
