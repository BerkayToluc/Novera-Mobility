"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

// The countdown to the end of the hold on the car (SPEC §2.3). `expiresAt` is the server's time;
// the browser's clock only measures how much is left from the moment the page arrived, so a
// wrong clock on the visitor's side cannot shorten or lengthen the hold.
//
// The ticking number is hidden from screen readers (reading it every second would drown the
// page); a separate status line speaks up once with a minute left and once when time is up.
export function HoldCountdown({ expiresAt, serverNow }: { expiresAt: string; serverNow: string }) {
  const t = useTranslations("HoldCountdown");
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((new Date(expiresAt).getTime() - new Date(serverNow).getTime()) / 1000)),
  );

  useEffect(() => {
    const started = performance.now();
    const total = Math.max(0, Math.round((new Date(expiresAt).getTime() - new Date(serverNow).getTime()) / 1000));
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, total - Math.floor((performance.now() - started) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, serverNow]);

  // Once it reaches zero the server is asked again, and it answers with the "time is up" screen.
  useEffect(() => {
    if (secondsLeft === 0) router.refresh();
  }, [secondsLeft, router]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const announcement = secondsLeft === 0 ? t("over") : secondsLeft <= 60 ? t("lastMinute") : "";

  return (
    <div className="flex items-center gap-3 rounded-card border border-border-strong bg-accent-soft p-4 text-on-accent-soft">
      <Timer aria-hidden="true" className="size-6 shrink-0" />
      <p className="text-body">
        {t("label")}{" "}
        <span aria-hidden="true" className="text-h3 tabular-nums">
          {minutes}:{seconds}
        </span>
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
