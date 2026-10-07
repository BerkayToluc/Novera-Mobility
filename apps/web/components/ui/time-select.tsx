import type { ComponentProps } from "react";
import { Select } from "./select";

// 30-minute slots: rental desks hand over keys on the half hour, and a free-form
// time input would let visitors pick times no branch can serve.
const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function TimeSelect(props: Omit<ComponentProps<typeof Select>, "children">) {
  return (
    <Select {...props}>
      {TIME_SLOTS.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </Select>
  );
}

export { TimeSelect };
