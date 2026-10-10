"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-actions";

export function SignOutButton() {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await signOut();
      router.push("/");
      // The header and the profile gate read the session on the server.
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={pending} aria-busy={pending}>
      <LogOut aria-hidden="true" className="size-4" />
      {t("signOut")}
    </Button>
  );
}
