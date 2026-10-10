import { messages } from "@/texts";
import { Button } from "@/components/ui/Button";

export function WriteCta() {
  return (

    <Button href="/write" variant="outline" size="lg">
      {messages.home.startWriting}
    </Button>
  );
}
