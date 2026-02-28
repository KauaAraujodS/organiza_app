import { formatMoneyFromCents } from "../utils";

export default function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={className}>{formatMoneyFromCents(cents || 0)}</span>;
}
