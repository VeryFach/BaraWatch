import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApp } from "@/components/AppState";
import { SearchSelect } from "@/components/SearchSelect";
import { desaList } from "@/lib/dummy-data";
import { cn } from "@/lib/utils";

export function ReportDialog({ children, defaultDesa }: { children: ReactNode; defaultDesa?: string }) {
  const { addLaporan } = useApp();
  const [open, setOpen] = useState(false);
  const [desa, setDesa] = useState(defaultDesa ?? desaList[0]!.nama);
  const [jenis, setJenis] = useState<"Api" | "Asap">("Api");
  const [catatan, setCatatan] = useState("");

  const submit = () => {
    addLaporan({ desa, jenis, catatan: catatan || "Tanpa catatan" });
    toast.success("Laporan terkirim", { description: "Tim desa dan admin akan meninjau laporanmu." });
    setOpen(false);
    setCatatan("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Laporkan api atau asap</DialogTitle>
          <DialogDescription>Laporanmu membantu memastikan titik api lebih cepat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["Api", "Asap"] as const).map((j) => (
              <button
                key={j}
                onClick={() => setJenis(j)}
                className={cn("rounded-xl border py-3 text-sm font-medium transition", jenis === j ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}
              >
                {j === "Api" ? "🔥 Api" : "💨 Asap"}
              </button>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <span className="text-muted-foreground">Desa</span>
            <SearchSelect ariaLabel="Pilih desa" searchPlaceholder="Cari desa…" value={desa} onChange={setDesa} options={desaList.map((d) => ({ value: d.nama, label: d.nama }))} />
          </div>
          <label className="block text-sm">
            <span className="text-muted-foreground">Catatan (opsional)</span>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} placeholder="Contoh: asap tebal di belakang sekolah" className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5" />
          </label>
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Lampirkan foto (contoh, tidak aktif di prototipe)</div>
          <button onClick={submit} className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            Kirim laporan
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
