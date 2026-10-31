"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const demoRoles = {
      admin: "admin",
      penegak: "hukum",
      petugas: "petugas",
    } as const;
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const demoRole = demoRoles[normalizedIdentifier as keyof typeof demoRoles];
    if (demoRole && password === normalizedIdentifier) {
      sessionStorage.setItem("barawatch-demo-role", demoRole);
      router.push("/");
      router.refresh();
      return;
    }

    const { error } = await createClient().auth.signInWithPassword({
      email: identifier,
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("Login gagal", { description: error.message });
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Masuk dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Khusus petugas, penegak hukum, dan admin.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-sm">
            ID atau email
            <input
              required
              type="text"
              autoComplete="email"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border bg-background px-3"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              required
              type="password"
              minLength={5}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border bg-background px-3"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
        <p className="mt-5 text-xs text-muted-foreground">
          Demo: admin/admin, penegak/penegak, atau petugas/petugas.
        </p>
      </div>
    </main>
  );
}
