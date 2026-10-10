"use client";

import { useRouter } from "next/navigation";
import { texts } from "@/texts";
import { notify } from "@/lib/toast";
import { useLogout } from "@/hooks/useAuth";

export function useLogoutRedirect(onBeforeLeave: () => void) {
  const router = useRouter();
  const logoutMutation = useLogout();

  return () => {
    onBeforeLeave();
    router.replace("/");
    logoutMutation.mutate(undefined, {
      onSuccess: () => notify.success(texts.feedback.session.loggedOut),
      onError: () => notify.fail(texts.feedback.session.logoutFailed),
    });
  };
}
