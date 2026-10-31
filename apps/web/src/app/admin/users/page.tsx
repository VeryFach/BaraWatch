"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

const roles = [
  { value: "petugas", label: "Petugas" },
  { value: "penegak_hukum", label: "Penegak hukum" },
  { value: "admin", label: "Admin" },
] as const;

export default function CreateUserPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "petugas",
    agency: "",
  });
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      toast.error("Akun gagal dibuat", { description: result.error });
      return;
    }
    toast.success("Akun berhasil dibuat");
    setForm({
      email: "",
      password: "",
      fullName: "",
      role: "petugas",
      agency: "",
    });
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Buat akun dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hanya admin yang dapat mendaftarkan akun baru.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm">
          Nama lengkap
          <input
            required
            value={form.fullName}
            onChange={(event) =>
              setForm({ ...form, fullName: event.target.value })
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            required
            minLength={8}
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3"
          />
        </label>
        <label className="block text-sm">
          Peran
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            className="mt-1 h-11 w-full rounded-md border bg-background px-3"
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Instansi (opsional)
          <input
            value={form.agency}
            onChange={(event) =>
              setForm({ ...form, agency: event.target.value })
            }
            className="mt-1 h-11 w-full rounded-md border bg-background px-3"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Membuat..." : "Buat akun"}
        </button>
      </form>
    </main>
  );
}
