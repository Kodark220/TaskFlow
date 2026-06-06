import { cn } from "#/lib/utils";

function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}
export { cn };
