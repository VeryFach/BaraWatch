import {
  ArrowUpRight,
  Check,
  Clock,
  Flame,
  MapPin,
  Satellite,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/AppState";
import { Button } from "@/components/ui/button";
import type { Hotspot } from "@/lib/dummy-data";

export function HotspotDetails({ hotspot: h }: { hotspot: Hotspot }) {
  const { can, statusOf, setStatus, escalated, escalate } = useApp();
  const status = statusOf(h.id);
  return (
    <div className="border-t px-4 py-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            Terdeteksi
          </dt>
          <dd className="mt-1 font-medium">{h.waktu} WIB</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            Jenis lahan
          </dt>
          <dd className="mt-1 font-medium">
            {h.gambut ? "Gambut" : "Mineral"}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="size-3.5" />
            Confidence
          </dt>
          <dd className="mt-1 font-medium">{h.confidence}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Estimasi luas</dt>
          <dd className="mt-1 font-medium">
            {h.luasHa === null ? "Belum dihitung" : `${h.luasHa} ha`}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Satellite className="size-3.5" />
            Sumber satelit
          </dt>
          <dd className="mt-1 font-medium">{h.sumber}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Koordinat</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {h.lat.toFixed(3)}, {h.lng.toFixed(3)}
          </dd>
        </div>
      </dl>
      {can("verifikasi") && status === "baru" && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
          <Button
            size="sm"
            onClick={() => {
              setStatus(h.id, "diverifikasi");
              toast.success("Ditandai api nyata");
            }}
          >
            <Check />
            Api nyata
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus(h.id, "bukan-api");
              toast("Ditandai bukan api");
            }}
          >
            <X />
            Bukan api
          </Button>
        </div>
      )}
      {can("ubahStatusPemadaman") && status === "diverifikasi" && (
        <Button
          className="mt-4 h-auto w-full whitespace-normal"
          onClick={() => {
            setStatus(h.id, "ditangani");
            toast.success("Tim dikerahkan, status: ditangani");
          }}
        >
          Kerahkan tim · tandai ditangani
        </Button>
      )}
      {can("ubahStatusPemadaman") && status === "ditangani" && (
        <Button
          className="mt-4 w-full"
          onClick={() => {
            setStatus(h.id, "selesai");
            toast.success("Api padam, status: selesai");
          }}
        >
          <Check />
          Tandai selesai
        </Button>
      )}
      {can("eskalasi") &&
        status === "diverifikasi" &&
        (escalated.includes(h.id) ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-forest">
            <Check className="size-4" />
            Sudah dieskalasi ke BPBD
          </p>
        ) : (
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => {
              escalate(h.id);
              toast.success("Eskalasi dikirim ke BPBD");
            }}
          >
            <ArrowUpRight />
            Eskalasi ke BPBD
          </Button>
        ))}
    </div>
  );
}
