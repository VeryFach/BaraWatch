"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Masuk</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Autentikasi akan tersedia pada tahap berikutnya.
      </p>
    </main>
  );
}
