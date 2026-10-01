import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <Container className="page-section">
      <div className="flex min-h-[50vh] animate-fade-in flex-col items-center justify-center text-center">
        <h1 className="mb-5 display-serif text-(length:--type-3xl) leading-tight font-bold text-heading">
          404
        </h1>
        <p className="mb-10 max-w-90 text-(length:--type-base) leading-relaxed text-muted">
          {t("notFoundDesc")}
        </p>

        <div className="flex items-center gap-3">
          <Button href="/">{t("goHome")}</Button>
          <Button variant="outline" href="/posts">
            {t("browsePosts")}
          </Button>
        </div>
      </div>
    </Container>
  );
}
