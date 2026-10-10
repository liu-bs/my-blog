"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { texts } from "@/texts";
import type { CommentsListData, CommentsSectionProps } from "@shared";
import { CommentCard } from "@/components/post/CommentCard";
import { CommentsSkeleton } from "@/components/skeletons/CommentsSkeleton";

const CommentsSection = dynamic(() => import("./CommentsSection").then((m) => m.CommentsSection), {
  ssr: false,

  loading: () => <CommentsSkeleton />,
});

const BackToTop = dynamic(() => import("@/components/post/BackToTop").then((m) => m.BackToTop), {
  ssr: false,
});

function CommentsPreview({ data }: { data: CommentsListData | null }) {
  if (!data || data.comments.length === 0) return <CommentsSkeleton />;

  return (
    <section className="mt-10 mb-12">
      <h2 className="mb-6 section-title">
        {texts.postDetail.commentsTitle}{" "}
        <span className="ml-1.5 text-(length:--type-xs) font-normal text-muted opacity-80">
          · {data.total}
        </span>
      </h2>

      <div className="card-list">
        {data.comments.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
      </div>
    </section>
  );
}

export function DeferredComments({ initialData = null, ...props }: CommentsSectionProps) {
  const anchorRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el || isVisible) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={anchorRef}>
      {isVisible ? (
        <CommentsSection {...props} initialData={initialData} />
      ) : (
        <CommentsPreview data={initialData} />
      )}
    </div>
  );
}

export function DeferredBackToTop() {
  return <BackToTop />;
}
