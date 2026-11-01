"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReportVerificationActions({
  reportId,
  status,
  incidentId,
  onUpdated,
}: {
  reportId: string;
  status: string;
  incidentId?: string | null;
  onUpdated: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function verify(verdict: "real_fire" | "not_fire") {
    setSaving(true);
    try {
      const response = await fetch("/api/ops/reports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, verdict }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Verdict gagal disimpan.");
      toast.success(
        verdict === "real_fire" ? "Ditandai api nyata." : "Ditandai bukan api.",
      );
      await onUpdated();
    } catch (error) {
      toast.error("Verdict gagal disimpan.", {
        description: error instanceof Error ? error.message : "Coba lagi.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function followUp() {
    setSaving(true);
    try {
      const response = await fetch("/api/ops/reports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, action: "follow_up" }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Tindak lanjut gagal.");
      toast.success("Laporan ditindaklanjuti.");
      await onUpdated();
    } catch (error) {
      toast.error("Tindak lanjut gagal.", {
        description: error instanceof Error ? error.message : "Coba lagi.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (status === "verified") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Api nyata</span>
        {incidentId && (
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void followUp()}
          >
            Tindak lanjut
          </Button>
        )}
      </div>
    );
  }
  if (status === "rejected" || status === "handled") {
    return (
      <span className="text-xs text-muted-foreground">
        Status lapangan:{" "}
        {status === "handled" ? "Ditindaklanjuti" : "Bukan api"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        disabled={saving}
        onClick={() => void verify("real_fire")}
      >
        <Check />
        Api nyata
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={() => void verify("not_fire")}
      >
        <X />
        Bukan api
      </Button>
    </div>
  );
}
