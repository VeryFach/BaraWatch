"use client";

import {
  Check,
  FileSearch,
  Flame,
  LandPlot,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buildLandCases,
  formatHa,
  type LandCase,
  landOwners,
  type OwnershipReviewInput,
  type OwnershipStatus,
  ownerHoldings,
  ownershipStatusLabels,
  parcelOwnerId,
} from "@/lib/land-ownership";
import { cn } from "@/lib/utils";

function OwnershipBadge({ status }: { status: OwnershipStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        status === "terverifikasi"
          ? "bg-forest/10 text-forest"
          : status === "perlu-penelusuran"
            ? "bg-destructive/10 text-destructive"
            : "bg-risk-medium/20 text-foreground",
      )}
    >
      {status === "terverifikasi" && <Check className="size-3" />}
      {ownershipStatusLabels[status]}
    </span>
  );
}

export function LawDashboard() {
  const { ownershipReviews, statusOf, hotspots } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("semua");
  const [region, setRegion] = useState("semua");
  const [selected, setSelected] = useState<string | null>(null);
  const cases = buildLandCases(ownershipReviews, statusOf, hotspots);
  const activeCase = cases.find((row) => row.parcel.id === selected);
  const regions = [...new Set(cases.map((row) => row.hotspot.kabupaten))];
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  const filtered = cases.filter(
    (row) =>
      (status === "semua" || row.status === status) &&
      (region === "semua" || row.hotspot.kabupaten === region) &&
      [
        row.parcel.id,
        row.hotspot.id,
        row.hotspot.desa,
        row.hotspot.kabupaten,
        row.owner?.name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(normalized),
  );
  const stats = [
    {
      label: "Estimasi lahan terbakar",
      value: `${formatHa(cases.reduce((sum, row) => sum + (row.hotspot.luasHa ?? 0), 0))} ha`,
      icon: Flame,
    },
    {
      label: "Pemilik teridentifikasi",
      value: String(
        new Set(cases.flatMap((row) => (row.owner ? [row.owner.id] : []))).size,
      ),
      icon: Users,
    },
    {
      label: "Belum diverifikasi",
      value: String(
        cases.filter((row) => row.status === "belum-diverifikasi").length,
      ),
      icon: FileSearch,
    },
    {
      label: "Kepemilikan terverifikasi",
      value: String(
        cases.filter((row) => row.status === "terverifikasi").length,
      ),
      icon: ShieldCheck,
    },
  ];

  return (
    <>
      <section
        aria-label="Ringkasan telaah lahan"
        className="grid gap-6 border-y py-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" />
              {label}
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">
              {value}
            </div>
          </div>
        ))}
      </section>
      <p className="flex items-start gap-3 border-l-2 border-risk-medium bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-medium text-foreground">
            Data telaah, bukan bukti hukum final.
          </strong>{" "}
          Telaah hanya menampilkan data yang tersedia dari database.
        </span>
      </p>
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Telaah lahan terbakar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pemilik, luas bidang terdampak, dan status pemeriksaan.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} dari {cases.length} bidang
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              aria-label="Cari lahan atau pemilik"
              placeholder="Cari pemilik, desa, atau ID bidang…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <SearchSelect
            ariaLabel="Filter verifikasi kepemilikan"
            value={status}
            onChange={setStatus}
            options={[
              { value: "semua", label: "Semua status verifikasi" },
              ...Object.entries(ownershipStatusLabels).map(
                ([value, label]) => ({ value, label }),
              ),
            ]}
          />
          <SearchSelect
            ariaLabel="Filter wilayah lahan"
            value={region}
            onChange={setRegion}
            options={[
              { value: "semua", label: "Semua wilayah" },
              ...regions.map((value) => ({ value, label: value })),
            ]}
          />
        </div>
        <ul className="divide-y border-b">
          {filtered.map((row) => (
            <LandCaseRow
              key={row.parcel.id}
              row={row}
              onSelect={setSelected}
              ownershipReviews={ownershipReviews}
              statusOf={statusOf}
              hotspots={hotspots}
            />
          ))}
        </ul>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Tidak ada bidang yang sesuai.
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(activeCase)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {activeCase && (
          <OwnershipDetail key={activeCase.parcel.id} landCase={activeCase} />
        )}
      </Dialog>
    </>
  );
}

function LandCaseRow({
  row,
  onSelect,
  ownershipReviews,
  statusOf,
  hotspots,
}: {
  row: LandCase;
  onSelect: (id: string) => void;
  ownershipReviews: Parameters<typeof ownerHoldings>[1];
  statusOf: Parameters<typeof ownerHoldings>[2];
  hotspots: Parameters<typeof ownerHoldings>[3];
}) {
  const holding = row.owner
    ? ownerHoldings(row.owner.id, ownershipReviews, statusOf, hotspots)
    : null;
  return (
    <li className="grid items-center gap-4 py-5 sm:grid-cols-2 xl:grid-cols-[1.3fr_1.2fr_1fr_1fr_1.3fr_96px]">
      <div>
        <div className="font-medium">{row.hotspot.desa}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {row.parcel.id} · {row.hotspot.kabupaten}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium">
          {row.owner?.name ?? "Belum diketahui"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {row.owner?.type ?? "Perlu identifikasi pemilik"}
        </div>
      </div>
      <div className="text-sm font-semibold text-destructive">
        {row.hotspot.luasHa === null
          ? "Belum dihitung"
          : `${formatHa(row.hotspot.luasHa)} ha`}
        <div className="mt-1 text-xs font-normal text-muted-foreground">
          Bidang: {formatHa(row.parcel.areaHa)} ha
        </div>
      </div>
      <div className="text-sm font-semibold">
        {holding ? `${formatHa(holding.totalHa)} ha` : "Belum diketahui"}
      </div>
      <OwnershipBadge status={row.status} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSelect(row.parcel.id)}
      >
        <FileSearch />
        Telaah
      </Button>
    </li>
  );
}

function OwnershipDetail({ landCase: row }: { landCase: LandCase }) {
  const { can, ownershipReviews, reviewOwnership, statusOf, hotspots } =
    useApp();
  const review = ownershipReviews[row.parcel.id];
  const [ownerId, setOwnerId] = useState(
    parcelOwnerId(row.parcel, ownershipReviews) ?? "unknown",
  );
  const [outcome, setOutcome] = useState<OwnershipReviewInput["status"]>(
    review?.status ?? (row.owner ? "terverifikasi" : "perlu-penelusuran"),
  );
  const [reference, setReference] = useState(review?.reference ?? "");
  const [notes, setNotes] = useState(review?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const selectedOwner = landOwners.find((owner) => owner.id === ownerId);
  const previewReviews = {
    ...ownershipReviews,
    [row.parcel.id]: {
      ownerId: ownerId === "unknown" ? null : ownerId,
      status: outcome,
      reference,
      notes,
      reviewedAt: "",
    },
  };
  const holding = selectedOwner
    ? ownerHoldings(selectedOwner.id, previewReviews, statusOf, hotspots)
    : null;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = reviewOwnership(row.parcel.id, {
      ownerId: ownerId === "unknown" ? null : ownerId,
      status: outcome,
      reference,
      notes,
    });
    setError(result);
    if (!result) toast.success("Hasil verifikasi kepemilikan disimpan");
  };
  return (
    <DialogContent className="z-[1100] max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Kepemilikan lahan · {row.hotspot.desa}</DialogTitle>
        <DialogDescription>
          {row.parcel.id} · {row.hotspot.id} · {row.hotspot.kabupaten} · Data
          tersimpan
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-between">
        <OwnershipBadge status={review?.status ?? "belum-diverifikasi"} />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/peta?id=${encodeURIComponent(row.hotspot.id)}`}>
            <MapPin />
            Lihat di peta
          </Link>
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-y py-4">
        <div>
          <dt className="text-xs text-muted-foreground">
            Estimasi luas terbakar
          </dt>
          <dd className="mt-1 text-xl font-semibold text-destructive">
            {row.hotspot.luasHa === null
              ? "Belum dihitung"
              : `${formatHa(row.hotspot.luasHa)} ha`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Luas bidang</dt>
          <dd className="mt-1 text-xl font-semibold">
            {formatHa(row.parcel.areaHa)} ha
          </dd>
        </div>
      </dl>
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <div className="text-sm font-medium">Pemilik bidang lahan</div>
          <SearchSelect
            ariaLabel="Pemilik bidang lahan"
            value={ownerId}
            onChange={setOwnerId}
            options={[
              { value: "unknown", label: "Belum diketahui" },
              ...landOwners.map((owner) => ({
                value: owner.id,
                label: `${owner.name} · ${owner.type}`,
              })),
            ]}
          />
        </div>
        {holding && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <LandPlot className="size-4 text-forest" />
              Seluruh lahan pemilik · {formatHa(holding.totalHa)} ha
            </h3>
            <ul className="max-h-32 divide-y overflow-y-auto">
              {holding.parcels.map((parcel) => (
                <li
                  key={parcel.id}
                  className="flex justify-between py-2 text-sm"
                >
                  <span>
                    {parcel.village} · {parcel.id}
                  </span>
                  <span>{formatHa(parcel.areaHa)} ha</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {can("verifikasiKepemilikan") && (
          <section className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">
              Hasil verifikasi kepemilikan
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={outcome === "terverifikasi" ? "secondary" : "outline"}
                onClick={() => setOutcome("terverifikasi")}
              >
                <ShieldCheck />
                Sesuai
              </Button>
              <Button
                type="button"
                variant={
                  outcome === "perlu-penelusuran" ? "secondary" : "outline"
                }
                onClick={() => setOutcome("perlu-penelusuran")}
              >
                <FileSearch />
                Telusuri
              </Button>
            </div>
            <Input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Referensi dokumen / pemeriksaan"
            />
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Catatan hasil pemeriksaan"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit">
                <Check />
                Simpan verifikasi
              </Button>
            </div>
          </section>
        )}
      </form>
    </DialogContent>
  );
}
