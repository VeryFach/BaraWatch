"use client";

import dynamic from "next/dynamic";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { useApp } from "@/components/AppState";
import { SearchSelect } from "@/components/SearchSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PublicRegion } from "@/lib/public-api";
import { cn } from "@/lib/utils";

const ReportLocationPicker = dynamic(
  () =>
    import("@/components/ReportLocationPicker").then(
      (module) => module.ReportLocationPicker,
    ),
  { ssr: false },
);

export function ReportDialog({
  children,
  defaultDesa,
}: {
  children: ReactNode;
  defaultDesa?: string;
}) {
  const { refreshReports } = useApp();
  const [open, setOpen] = useState(false);
  const [locationMapOpen, setLocationMapOpen] = useState(false);
  const [regionId, setRegionId] = useState("");
  const [phone, setPhone] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [regions, setRegions] = useState<PublicRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jenis, setJenis] = useState<"Api" | "Asap">("Api");
  const [catatan, setCatatan] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [publicPhotoConsent, setPublicPhotoConsent] = useState(false);
  const coordinates =
    latitude && longitude
      ? {
          latitude: Number(latitude),
          longitude: Number(longitude),
        }
      : null;

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/public/regions?level=desa")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load regions");
        return (await response.json()) as { data: PublicRegion[] };
      })
      .then(({ data }) => {
        if (!active) return;
        const villages = data.filter((region) => region.level === "desa");
        setRegions(villages);
        if (defaultDesa) {
          setRegionId(
            villages.find((region) => region.name === defaultDesa)?.id ?? "",
          );
        }
      })
      .catch(() => {
        if (active) setRegions([]);
      })
      .finally(() => {
        if (active) setRegionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [defaultDesa, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (foto && !isJpegFile(foto)) {
      toast.error("Format foto tidak didukung", {
        description: "Gunakan file JPG atau JPEG.",
      });
      return;
    }
    if (foto && foto.size > 5 * 1024 * 1024) {
      toast.error("Foto terlalu besar", {
        description: "Ukuran maksimum foto 5 MB.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("phone", phone.trim());
      body.set("region_id", regionId);
      body.set("latitude", latitude);
      body.set("longitude", longitude);
      body.set("type", jenis);
      body.set("description", catatan.trim());
      body.set("public_photo_consent", String(publicPhotoConsent));
      if (foto) body.set("photo", foto);
      const response = await fetch("/api/public/reports", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        error?: string;
        warnings?: string[];
      };
      if (!response.ok)
        throw new Error(result.error ?? "Laporan gagal dikirim.");
      await refreshReports();
      if (result.warnings?.length) {
        toast.warning("Laporan tersimpan sebagian", {
          description: result.warnings.join(" "),
        });
      } else {
        toast.success("Laporan terkirim", {
          description: "Laporan sudah tersimpan di server.",
        });
      }
      setOpen(false);
      setCatatan("");
      setFoto(null);
      setPublicPhotoConsent(false);
    } catch (error) {
      toast.error("Laporan belum terkirim", {
        description:
          error instanceof Error
            ? error.message
            : "Periksa koneksi lalu coba lagi.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Lokasi tidak didukung browser ini.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(String(Number(coords.latitude.toFixed(6))));
        setLongitude(String(Number(coords.longitude.toFixed(6))));
      },
      () =>
        toast.error("Lokasi tidak dapat diakses", {
          description: "Izinkan akses lokasi atau isi koordinat secara manual.",
        }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handleFotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setFoto(null);
      setPublicPhotoConsent(false);
      return;
    }

    if (!isJpegFile(file)) {
      event.target.value = "";
      setFoto(null);
      toast.error("Format foto tidak didukung", {
        description: "Hanya file JPG atau JPEG yang dapat dikirim.",
      });
      return;
    }

    setFoto(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Laporkan api atau asap</DialogTitle>
          <DialogDescription>
            Laporanmu membantu memastikan titik api lebih cepat.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="grid grid-cols-2 gap-2">
            {(["Api", "Asap"] as const).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJenis(j)}
                className={cn(
                  "rounded-xl border py-3 text-sm font-medium transition",
                  jenis === j
                    ? "border-primary bg-accent text-black"
                    : "text-black hover:bg-muted",
                )}
              >
                {j === "Api" ? "🔥 Api" : "💨 Asap"}
              </button>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <span className="text-muted-foreground">Desa</span>
            <SearchSelect
              ariaLabel="Pilih desa"
              searchPlaceholder="Cari desa…"
              value={regionId}
              onChange={setRegionId}
              triggerClassName="text-black"
              options={regions.map((region) => ({
                value: region.id,
                label: region.name,
              }))}
            />
            {regionsLoading && (
              <p className="text-xs text-muted-foreground">Memuat wilayah…</p>
            )}
          </div>
          <label className="block text-sm">
            <span className="text-muted-foreground">
              Nomor HP (format internasional)
            </span>
            <input
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+6281234567890"
              pattern="[+][1-9][0-9]{7,14}"
              className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-black placeholder:text-gray-500"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Nomor dipakai untuk mengaitkan laporan dengan kontak warga dan
              tidak ditampilkan ke publik.
            </span>
          </label>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Titik lokasi kejadian
              </span>
              <button
                type="button"
                onClick={useCurrentLocation}
                className="text-primary hover:underline"
              >
                Gunakan lokasi saya
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-black"
              onClick={() => setLocationMapOpen(true)}
            >
              {coordinates
                ? "Ubah titik lokasi di peta"
                : "Pilih titik lokasi di peta"}
            </Button>
            {coordinates ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Titik dipilih: {latitude}, {longitude}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pilih titik pada peta sebelum mengirim laporan.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-xs text-muted-foreground">Latitude</span>
                <input
                  required
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={latitude}
                  readOnly
                  placeholder="Pilih titik di peta"
                  className="mt-1 h-10 w-full rounded-xl border bg-muted px-3 text-black placeholder:text-gray-500"
                />
              </label>
              <label>
                <span className="text-xs text-muted-foreground">Longitude</span>
                <input
                  required
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={longitude}
                  readOnly
                  placeholder="Pilih titik di peta"
                  className="mt-1 h-10 w-full rounded-xl border bg-muted px-3 text-black placeholder:text-gray-500"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Pastikan titik berada di desa yang dipilih.
            </p>
          </div>
          <label className="block text-sm">
            <span className="text-muted-foreground">Catatan (opsional)</span>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              placeholder="Contoh: asap tebal di belakang sekolah"
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-black placeholder:text-gray-500"
            />
          </label>
          <label className="block rounded-xl border border-dashed p-4 text-sm">
            <span className="block text-center text-muted-foreground">
              Lampirkan foto (JPG atau JPEG)
            </span>
            <input
              type="file"
              accept=".jpg,.jpeg,image/jpeg"
              onChange={handleFotoChange}
              className="mt-3 block w-full text-sm text-black file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-black"
            />
            {foto && (
              <span className="mt-2 block truncate text-xs text-muted-foreground">
                {foto.name}
              </span>
            )}
          </label>
          {foto && (
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                required
                checked={publicPhotoConsent}
                onChange={(event) =>
                  setPublicPhotoConsent(event.target.checked)
                }
                className="mt-0.5"
              />
              <span>
                Saya setuju foto hasil anotasi AI ditampilkan di peta publik
                setelah laporan diverifikasi. Foto asli tetap privat.
              </span>
            </label>
          )}
          <button
            type="submit"
            disabled={submitting || regionsLoading || !regionId}
            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {submitting ? "Mengirim laporan…" : "Kirim laporan"}
          </button>
        </form>
      </DialogContent>
      <Dialog open={locationMapOpen} onOpenChange={setLocationMapOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pilih titik lokasi</DialogTitle>
            <DialogDescription>
              Klik lokasi kejadian pada peta. Koordinat akan diperbarui
              otomatis.
            </DialogDescription>
          </DialogHeader>
          <ReportLocationPicker
            value={coordinates}
            onChange={({
              latitude: nextLatitude,
              longitude: nextLongitude,
            }) => {
              setLatitude(String(nextLatitude));
              setLongitude(String(nextLongitude));
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {coordinates
                ? `${latitude}, ${longitude}`
                : "Belum ada titik dipilih"}
            </p>
            <Button
              type="button"
              disabled={!coordinates}
              onClick={() => setLocationMapOpen(false)}
            >
              Gunakan titik ini
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function isJpegFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  return (
    file.type === "image/jpeg" && (extension === "jpg" || extension === "jpeg")
  );
}
