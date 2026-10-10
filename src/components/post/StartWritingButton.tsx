import { texts } from "@/texts";
import { Button } from "@/components/ui/Button";

export function StartWritingButton() {
  return (
    <Button href="/write" variant="outline" size="lg">
      {texts.home.startWriting}
    </Button>
  );
}
