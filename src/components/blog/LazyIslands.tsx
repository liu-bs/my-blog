"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { messages } from "@/texts";
import type { CommentsListData, CommentsSectionProps } from "@shared";
import { CommentCardView } from "@/components/blog/CommentCardView";
import { CommentsSkeleton } from "@/components/skeletons/CommentsSkeleton";

const CommentsSection = dynamic(() => import("./CommentsSection").then((m) => m.CommentsSection), {
  ssr: false,

  loading: () => <CommentsSkeleton />,
});

const BackToTop = dynamic(() => import("@/components/blog/BackToTop").then((m) => m.BackToTop), {
  ssr: false,
});

function CommentsPreview({ data }: { data: CommentsListData | null }) {
  if (!data || data.comments.length === 0) return <CommentsSkeleton />;

  return (
    <section className="mt-10 mb-12">

      <h2 className="mb-6 section-title">
        {messages.post.commentsTitle}{" "}
        <span className="ml-1.5 text-(length:--type-xs) font-normal text-muted opacity-80">
          · {data.total}
        </span>
      </h2>

      <div className="card-list">
        {data.comments.map((c) => (
          <CommentCardView key={c.id} comment={c} />
        ))}
      </div>
    </section>
  );
}

export function LazyComments({ initialData = null, ...props }: CommentsSectionProps) {

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
    <div ref={anchorRef}>

      {visible ? (
        <CommentsSection {...props} initialData={initialData} />
      ) : (
        <CommentsPreview data={initialData} />
      )}
    </div>
  );
}

export function LazyBackToTop() {
  return <BackToTop />;
}
