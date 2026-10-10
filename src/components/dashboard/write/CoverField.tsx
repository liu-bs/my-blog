"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { messages } from "@/texts";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { isSafeImageUrl } from "@shared";
import { isOptimizableImageSrc } from "@/lib/url";
import { PREVIEW_DEBOUNCE_MS } from "./MarkdownPane";

export function isCoverUrlAllowed(value: string): boolean {
  const url = value.trim();
  return url === "" || isSafeImageUrl(url);
}

export function CoverField({
  value,
  onChange,
  error,
}: {

  value: string;

  onChange: (value: string) => void;

  error?: string;
}) {

  const [touched, setTouched] = useState(false);

  const [previewSrc, setPreviewSrc] = useState("");

  const [previewFailed, setPreviewFailed] = useState(false);

  const allowed = isCoverUrlAllowed(value);

  const url = value.trim();

  useEffect(() => {
    if (url === "" || !allowed) {
      setPreviewSrc("");
      setPreviewFailed(false);
      return;
    }
    const timer = setTimeout(() => {
      setPreviewSrc(url);
      setPreviewFailed(false);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [url, allowed]);

  const shownError = error ?? (touched && !allowed ? messages.write.coverInvalid : undefined);

  return (
    <FormField
      label={messages.write.coverLabel}
      hint={previewFailed ? messages.write.coverPreviewFailed : messages.write.coverHint}
      error={shownError}
    >
      <div className="row-sm">

        <Input
          id="cover-image"
          name="coverImage"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://example.com/cover.jpg"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.replace(/\s+/g, ""));
          }}

          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          onFocus={() => setTouched(false)}
          onBlur={() => setTouched(true)}
          error={!!shownError}
          className="flex-1"
        />

        {previewSrc !== "" && !previewFailed && (
          <div className="shrink-0 overflow-hidden rounded-md border border-stroke-strong">
            <Image
              src={previewSrc}
              alt={messages.write.coverPreview}
              width={40}
              height={40}
              unoptimized={!isOptimizableImageSrc(previewSrc)}
              onError={() => setPreviewFailed(true)}
              className="h-10 w-10 object-cover"
            />
          </div>
        )}
      </div>
    </FormField>
  );
}
