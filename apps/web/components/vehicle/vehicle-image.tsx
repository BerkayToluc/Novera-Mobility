import Image from "next/image";
import { Car } from "lucide-react";
import { cn } from "@/lib/cn";

type VehicleImageProps = {
  // When the card around it already names the car, the picture is not announced again.
  decorative?: boolean;
  className?: string;
  imageUrl: string | null;
  brand: string;
  model: string;
};

// 16:10 (SPEC §6). Until real photos exist (`imageUrl` is null) a calm placeholder holds the
// space with the car's name, so the layout does not change when photos arrive.
export function VehicleImage({ imageUrl, brand, model, decorative = false, className }: VehicleImageProps) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={decorative ? "" : `${brand} ${model}`}
        width={640}
        height={400}
        className={cn("aspect-16/10 w-full rounded-media object-cover", className)}
      />
    );
  }

  return (
    <div
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `${brand} ${model}` })}
      className={cn("flex aspect-16/10 w-full flex-col items-center justify-center gap-2 rounded-media bg-surface-muted text-fg-subtle", className)}
    >
      <Car aria-hidden="true" className="size-12" />
      <span aria-hidden="true" className="text-small">
        {brand}
      </span>
    </div>
  );
}
