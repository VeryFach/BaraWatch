import { cn } from "@/lib/utils";
import { riskLabel, riskVar, statusLabel, type HotspotStatus, type Risk } from "@/lib/dummy-data";

const statusStyle: Record<HotspotStatus, string> = {
  baru: "bg-destructive/10 text-destructive",
  diverifikasi: "bg-primary/10 text-accent-foreground",
  ditangani: "bg-risk-medium/20 text-foreground",
  selesai: "bg-forest/10 text-forest",
  "bukan-api": "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: HotspotStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyle[status])}>
      {statusLabel[status]}
    </span>
  );
}

export function RiskDot({ risk, withLabel = true }: { risk: Risk; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: riskVar[risk] }} />
      {withLabel && riskLabel[risk]}
    </span>
  );
}
