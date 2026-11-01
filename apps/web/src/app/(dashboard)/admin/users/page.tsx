"use client";

import { ArrowLeft, RefreshCw, Shield, Users } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PublicRegionBoundary } from "@/lib/public-api";

type DashboardUser = {
  id: string;
  fullName: string;
  email: string;
  role: "petugas" | "penegak_hukum" | "admin";
  agency: string | null;
  isActive: boolean;
  createdAt: string;
};

type Contact = {
  id: string;
  phone_e164: string;
  display_name: string | null;
  role: "warga" | "mpa";
  assigned_region_id: string | null;
  regions: { id: string; name: string; level: string } | null;
};

const roles = [
  { value: "petugas", label: "Petugas" },
  { value: "penegak_hukum", label: "Penegak hukum" },
  { value: "admin", label: "Admin" },
] as const;

function roleBadgeStyle(role: string) {
  switch (role) {
    case "admin":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
    case "penegak_hukum":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case "petugas":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Admin";
    case "penegak_hukum":
      return "Penegak Hukum";
    case "petugas":
      return "Petugas";
    default:
      return role;
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "petugas",
    agency: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [regions, setRegions] = useState<PublicRegionBoundary[]>([]);
  const [contactForm, setContactForm] = useState({
    phone: "",
    displayName: "",
    role: "mpa",
    regionId: "",
  });
  const [creatingContact, setCreatingContact] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error("Gagal memuat pengguna", { description: err.error });
        return;
      }
      const result = (await response.json()) as { data: DashboardUser[] };
      setUsers(result.data);
    } catch {
      toast.error("Gagal menghubungi server untuk memuat pengguna");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const contactsResponse = await fetch("/api/admin/contacts");
      if (!contactsResponse.ok) return;
      const contactsResult = (await contactsResponse.json()) as {
        data: Contact[];
      };
      setContacts(contactsResult.data);
    } catch {
      // ignore
    }
  }, []);

  const loadRegions = useCallback(async () => {
    if (regions.length || regionsLoading) return;
    setRegionsLoading(true);
    try {
      const response = await fetch("/api/public/regions?level=desa");
      if (!response.ok) return;
      const result = (await response.json()) as {
        data: PublicRegionBoundary[];
      };
      setRegions(result.data);
    } finally {
      setRegionsLoading(false);
    }
  }, [regions.length, regionsLoading]);

  useEffect(() => {
    void loadUsers();
    void loadContacts();
  }, [loadUsers, loadContacts]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingUser(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error("Akun gagal dibuat", { description: result.error });
        return;
      }

      toast.success("Akun dashboard berhasil dibuat");
      setForm({
        email: "",
        password: "",
        fullName: "",
        role: "petugas",
        agency: "",
      });
      await loadUsers();
    } finally {
      setCreatingUser(false);
    }
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingContact(true);
    try {
      const response = await fetch("/api/admin/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error("Kontak gagal disimpan", { description: result.error });
        return;
      }
      toast.success(
        contactForm.role === "mpa" ? "MPA tersimpan" : "Warga tersimpan",
      );
      setContactForm({ phone: "", displayName: "", role: "mpa", regionId: "" });
      await loadContacts();
    } finally {
      setCreatingContact(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
      {/* HEADER & NAV */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="mb-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Dashboard Admin
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Manajemen Pengguna & Kontak
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola akun internal dashboard (admin, petugas, penegak hukum) dan
            nomor WhatsApp MPA/warga.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void loadUsers();
            void loadContacts();
          }}
          disabled={usersLoading}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${usersLoading ? "animate-spin" : ""}`}
          />
          Segarkan Data
        </Button>
      </div>

      {/* SECTION 1: USERS TERDAFTAR & BUAT AKUN DASHBOARD */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">
            Pengguna Dashboard Terdaftar
          </h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {users.length} akun
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* FORM BUAT AKUN */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h3 className="font-semibold text-base">
              Buat Akun Dashboard Baru
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Akses khusus petugas pemadam, penegak hukum, atau admin tambahan.
            </p>
            <form onSubmit={submit} className="mt-5 space-y-3.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Nama lengkap
                <input
                  required
                  placeholder="cth. Budi Setiawan"
                  value={form.fullName}
                  onChange={(event) =>
                    setForm({ ...form, fullName: event.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Email login
                <input
                  required
                  type="email"
                  placeholder="cth. budi@kalteng.go.id"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Password
                <input
                  required
                  minLength={8}
                  type="password"
                  placeholder="Minimal 8 karakter"
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Peran (Role)
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Instansi (opsional)
                <input
                  placeholder="cth. BPBD Kalteng / Manggala Agni"
                  value={form.agency}
                  onChange={(event) =>
                    setForm({ ...form, agency: event.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <Button
                type="submit"
                disabled={creatingUser}
                className="w-full mt-2"
              >
                {creatingUser ? "Membuat Akun..." : "Buat Akun Dashboard"}
              </Button>
            </form>
          </div>

          {/* TABEL USERS TERDAFTAR */}
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3.5">Nama & Email</th>
                    <th className="p-3.5">Peran</th>
                    <th className="p-3.5">Instansi</th>
                    <th className="p-3.5">Terdaftar</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3.5">
                        <div className="font-medium text-foreground">
                          {user.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {user.email}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleBadgeStyle(user.role)}`}
                        >
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="p-3.5 text-sm text-muted-foreground">
                        {user.agency || "-"}
                      </td>
                      <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-3.5">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !usersLoading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-sm text-muted-foreground"
                      >
                        Belum ada pengguna dashboard yang terdaftar.
                      </td>
                    </tr>
                  )}
                  {usersLoading && users.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-sm text-muted-foreground"
                      >
                        Memuat data pengguna...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: KONTAK WHATSAPP */}
      <section className="space-y-6 border-t pt-8">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">
            Kontak WhatsApp (MPA & Warga)
          </h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {contacts.length} kontak
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* FORM DAFTAR NOMOR */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h3 className="font-semibold text-base">
              Daftarkan Nomor WhatsApp
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              MPA tidak memerlukan akun login; notifikasi diteruskan langsung
              lewat nomor WhatsApp terdaftar.
            </p>
            <form onSubmit={submitContact} className="mt-5 space-y-3.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Nomor WhatsApp (E.164)
                <input
                  required
                  placeholder="+628123456789"
                  value={contactForm.phone}
                  onChange={(event) =>
                    setContactForm({
                      ...contactForm,
                      phone: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Nama tampilan (opsional)
                <input
                  placeholder="cth. Pak Joko (MPA Kalampangan)"
                  value={contactForm.displayName}
                  onChange={(event) =>
                    setContactForm({
                      ...contactForm,
                      displayName: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Peran
                <select
                  value={contactForm.role}
                  onChange={(event) =>
                    setContactForm({
                      ...contactForm,
                      role: event.target.value,
                      regionId:
                        event.target.value === "mpa"
                          ? contactForm.regionId
                          : "",
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="mpa">MPA (Masyarakat Peduli Api)</option>
                  <option value="warga">Warga</option>
                </select>
              </label>
              {contactForm.role === "mpa" && (
                <label className="block text-xs font-medium text-muted-foreground">
                  Wilayah Tugas
                  <select
                    required
                    value={contactForm.regionId}
                    onFocus={() => void loadRegions()}
                    onChange={(event) =>
                      setContactForm({
                        ...contactForm,
                        regionId: event.target.value,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Pilih desa/kelurahan</option>
                    {regionsLoading && (
                      <option value="">Memuat wilayah…</option>
                    )}
                    {regions
                      .filter((region) => region.level !== "provinsi")
                      .map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name} ({region.level})
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <Button
                type="submit"
                disabled={creatingContact}
                className="w-full mt-2"
              >
                {creatingContact ? "Menyimpan..." : "Simpan Nomor WhatsApp"}
              </Button>
            </form>
          </div>

          {/* TABEL KONTAK TERDAFTAR */}
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3.5">Nama & Nomor</th>
                    <th className="p-3.5">Peran</th>
                    <th className="p-3.5">Wilayah Tugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3.5">
                        <div className="font-medium text-foreground">
                          {contact.display_name ?? "Tanpa nama"}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {contact.phone_e164}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium uppercase text-muted-foreground">
                          {contact.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {contact.regions?.name ? (
                          <span className="font-medium text-foreground">
                            {contact.regions.name}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({contact.regions.level})
                            </span>
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground text-xs">
                            Belum di-assign
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-8 text-center text-sm text-muted-foreground"
                      >
                        Belum ada kontak WhatsApp terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
