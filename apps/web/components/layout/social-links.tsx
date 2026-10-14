import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import { SOCIAL_NETWORKS } from "@/lib/company";
import { SocialIcon } from "./social-icon";

// The social marks (SPEC §2.8, after the Framer "Quick Social Links"): a row of round icons that
// swell from their base when pointed at or focused, with the network's name rising above them.
// Not links (G's decision): the fictional company has no accounts, so each mark says "coming
// soon" and leads nowhere. Each takes focus so a keyboard visitor gets the same label.
export async function SocialLinks() {
  const t = await getTranslations("Footer");

  return (
    <ul className="grid w-fit grid-cols-2 gap-3 pt-8 md:flex md:gap-2">
      {SOCIAL_NETWORKS.map((network) => {
        const name = t(`social.${network}`);
        // The column of marks is always at the right of the footer, with room to its left: the labels open to the left, so none of them can run past the edge of the page (an invisible label still counts as page width).
        const edge = "right-0";
        return (
          <li key={network}>
            <span
              tabIndex={0}
              role="img"
              aria-label={t("socialSoon", { network: name })}
              className="group/sl relative flex size-11 items-end justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="flex size-11 origin-bottom items-center justify-center rounded-full border border-border bg-surface text-fg transition-[scale] duration-300 ease-spring group-hover/sl:scale-125 group-focus-visible/sl:scale-125 motion-reduce:transition-none">
                <SocialIcon network={network} className="size-5" />
              </span>
              <span
                aria-hidden="true"
                className={cn("pointer-events-none invisible absolute bottom-full mb-3 translate-y-2 scale-75 whitespace-nowrap rounded-full bg-fg px-3 py-1 text-small text-canvas opacity-0 transition-[opacity,translate,scale,visibility] duration-200 group-hover/sl:visible group-hover/sl:translate-y-0 group-hover/sl:scale-100 group-hover/sl:opacity-100 group-focus-visible/sl:visible group-focus-visible/sl:translate-y-0 group-focus-visible/sl:scale-100 group-focus-visible/sl:opacity-100 motion-reduce:transition-none", edge)}
              >
                {t("socialSoon", { network: name })}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
