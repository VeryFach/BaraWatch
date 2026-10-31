import type { Contact, Session } from "./types";

export const MAIN_MENU =
  "Menu BaraWatch:\n\n" +
  "1. Daftar langganan peringatan Karhutla\n" +
  "2. Lapor kejadian kebakaran\n" +
  "3. Bantuan\n\n" +
  "Ketik *0* kapan saja untuk kembali ke menu awal.";

export const HELP =
  "Perintah yang tersedia:\n\n" +
  "1 atau Daftar - Berlangganan peringatan Karhutla berdasarkan wilayah\n" +
  "2 atau Lapor - Mengirim laporan dengan foto dan lokasi\n" +
  "3 atau Bantuan - Melihat daftar perintah\n" +
  "0 atau Menu - Kembali ke menu awal";

export const MPA_MENU =
  "Menu MPA:\n\n" +
  "1. Laporan belum ditangani\n" +
  "2. Laporan sedang ditangani\n" +
  "3. Laporan selesai\n" +
  "4. Laporan berdasarkan wilayah\n\n" +
  "Ketik *0* untuk kembali ke menu awal.";

export function isMpa(contact: Contact): boolean {
  return contact.role === "mpa";
}

export function sessionMenu(session: Session): string {
  return session.state === "mpa_menu" ? MPA_MENU : MAIN_MENU;
}
