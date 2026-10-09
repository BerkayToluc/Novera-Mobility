import Image from "next/image";
import { Car } from "lucide-react";

type VehicleImageProps = {
  imageUrl: string | null;
  brand: string;
  model: string;
};

// 16:10 (SPEC §6). Until real photos exist (`imageUrl` is null) a calm placeholder holds the
// space with the car's name, so the layout does not change when photos arrive.
export function VehicleImage({ imageUrl, brand, model }: VehicleImageProps) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={`${brand} ${model}`}
        width={640}
        height={400}
        className="aspect-16/10 w-full rounded-media object-cover"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${brand} ${model}`}
      className="flex aspect-16/10 w-full flex-col items-center justify-center gap-2 rounded-media bg-surface-muted text-fg-subtle"
    >
      <Car aria-hidden="true" className="size-12" />
      <span aria-hidden="true" className="text-small">
        {brand}
      </span>
    </div>
  );
}
