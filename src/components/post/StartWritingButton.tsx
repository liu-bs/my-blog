import home from "@/texts/home";
import { Button } from "@/components/ui/Button";

export function StartWritingButton() {
  return (
    <Button href="/write" variant="outline" size="lg">
      {home.startWriting}
    </Button>
  );
}
