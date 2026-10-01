"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { CommentsSectionProps } from "@shared";
import { CommentsSkeleton } from "@/components/skeletons/CommentsSkeleton";

const CommentsSection = dynamic(() => import("./CommentsSection").then((m) => m.CommentsSection), {
  ssr: false,

  loading: () => <CommentsSkeleton />,
});

const BackToTop = dynamic(() => import("@/components/blog/BackToTop").then((m) => m.BackToTop), {
  ssr: false,
});

export function LazyComments(props: CommentsSectionProps) {

  const anchorRef = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el || visible) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (

    <div ref={anchorRef}>{visible ? <CommentsSection {...props} /> : <CommentsSkeleton />}</div>
  );
}

export function LazyBackToTop() {
  return <BackToTop />;
}
