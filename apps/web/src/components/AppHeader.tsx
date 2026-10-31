"use client";

import Link from "next/link";
import { Check, ChevronDown, ClipboardList, Flame, KeyRound, LayoutDashboard, Map, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/AppState";
import { allPermissions, can, permissionLabel, roles, type Role } from "@/lib/roles";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/peta", label: "Peta", icon: Map },
  { href: "/laporan", label: "Laporan", icon: ClipboardList },
];

export function AccessDialog() {
  const { role } = useApp();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" aria-label="Hak akses" className="gap-1.5 rounded-full px-3 text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          <span className="hidden lg:inline">Hak akses</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hak akses per peran</DialogTitle>
          <DialogDescription>Kolom yang disorot adalah peranmu saat ini.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Fitur</th>{(Object.keys(roles) as Role[]).map((r) => <th key={r} className={`px-2 py-2 text-center font-medium ${r === role ? "rounded-t-lg bg-accent text-accent-foreground" : ""}`}>{roles[r].short}</th>)}</tr></thead>
            <tbody>{allPermissions.map((p) => <tr key={p} className="border-t"><td className="py-2.5 pr-3">{permissionLabel[p]}</td>{(Object.keys(roles) as Role[]).map((r) => <td key={r} className={`px-2 text-center ${r === role ? "bg-accent" : ""}`}>{can(r, p) ? <Check className="mx-auto h-4 w-4 text-forest" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AppHeader() {
  const { role, setRole } = useApp();
  return (
    <header className="sticky top-0 z-[1000] border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Flame className="h-5 w-5" /></span>
          <div className="hidden leading-tight md:block"><div className="font-semibold">BaraWatch</div><div className="text-xs text-muted-foreground">Kalimantan Tengah · Pilot</div></div>
        </Link>
        <nav className="flex items-center gap-1 rounded-full bg-muted p-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"><Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span></Link>)}</nav>
        <div className="flex items-center gap-1">
          <AccessDialog />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" aria-label="Pilih peran pengguna" className="h-10 rounded-full py-1.5 pl-1.5 pr-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{roles[role].short.slice(0, 1)}</span><span className="hidden font-medium sm:inline">{roles[role].short}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[1100] w-72 rounded-xl p-1.5"><DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Lihat sebagai (mode demo)</DropdownMenuLabel><DropdownMenuSeparator />{(Object.keys(roles) as Role[]).map((r) => <DropdownMenuItem key={r} onSelect={() => { setRole(r); toast(`Sekarang melihat sebagai ${roles[r].label}`); }} className="flex items-start gap-3 rounded-lg p-2.5"><div className="flex-1"><div className="font-medium">{roles[r].label}</div><div className="text-xs text-muted-foreground">{roles[r].deskripsi}</div></div>{r === role && <Check className="mt-0.5 h-4 w-4 text-primary" />}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
