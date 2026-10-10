"use client";

import { useRouter } from "next/navigation";
import feedback from "@/texts/feedback";
import { notify } from "@/lib/toast";
import { useLogout } from "@/hooks/useAuth";

export function useLogoutRedirect(onBeforeLeave: () => void) {
  const router = useRouter();
  const logoutMutation = useLogout();

  return () => {
    onBeforeLeave();
    router.replace("/");
    logoutMutation.mutate(undefined, {
      onSuccess: () => notify.success(feedback.session.loggedOut),
      onError: () => notify.fail(feedback.session.logoutFailed),
    });
  };
}
