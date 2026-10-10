import { formatTemplate, messages } from "@/texts";
import { Container } from "../ui/Container";

export function Footer() {
  return (

    <footer className="border-t border-stroke bg-page py-10">

      <Container className="flex flex-wrap items-center justify-between gap-4 text-(length:--type-xs) leading-normal text-muted max-md:flex-col max-md:gap-3 max-md:text-center">

        <span className="inline-flex items-center font-medium tracking-[0.01em]">
          {formatTemplate(messages.footer.copyright, {
            site: messages.nav.brand,
          })}
        </span>

        <span>{messages.footer.tagline}</span>
      </Container>
    </footer>
  );
}
