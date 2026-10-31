import { type ChangeEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/AppState";
import { SearchSelect } from "@/components/SearchSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { desaList } from "@/lib/dummy-data";
import { cn } from "@/lib/utils";

export function ReportDialog({
  children,
  defaultDesa,
}: {
  children: ReactNode;
  defaultDesa?: string;
}) {
  const { addLaporan } = useApp();
  const [open, setOpen] = useState(false);
  const [desa, setDesa] = useState(defaultDesa ?? desaList[0]?.nama ?? "");
  const [jenis, setJenis] = useState<"Api" | "Asap">("Api");
  const [catatan, setCatatan] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const submit = () => {
    if (foto && !isJpegFile(foto)) {
      toast.error("Format foto tidak didukung", {
        description: "Gunakan file JPG atau JPEG.",
      });
      return;
    }

    addLaporan({ desa, jenis, catatan: catatan || "Tanpa catatan" });
    toast.success("Laporan terkirim", {
      description: "Tim desa dan admin akan meninjau laporanmu.",
    });
    setOpen(false);
    setCatatan("");
    setFoto(null);
  };

  const handleFotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setFoto(null);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Laporkan api atau asap</DialogTitle>
          <DialogDescription>
            Laporanmu membantu memastikan titik api lebih cepat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["Api", "Asap"] as const).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJenis(j)}
                className={cn(
                  "rounded-xl border py-3 text-sm font-medium transition",
                  jenis === j
                    ? "border-primary bg-accent text-accent-foreground"
                    : "hover:bg-muted",
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
              value={desa}
              onChange={setDesa}
              options={desaList.map((d) => ({ value: d.nama, label: d.nama }))}
            />
          </div>
          <label className="block text-sm">
            <span className="text-muted-foreground">Catatan (opsional)</span>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              placeholder="Contoh: asap tebal di belakang sekolah"
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5"
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
              className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
            />
            {foto && (
              <span className="mt-2 block truncate text-xs text-muted-foreground">
                {foto.name}
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={submit}
            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Kirim laporan
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isJpegFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  return (
    file.type === "image/jpeg" && (extension === "jpg" || extension === "jpeg")
  );
}
