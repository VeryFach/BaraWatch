import { supabaseRequest } from "@/lib/supabase/admin";
import { queryOne, setSession } from "./db";
import type { Contact, Region, Session } from "./types";

export async function findProvince(): Promise<Region> {
  const province = await queryOne<Region>(
    "regions?level=eq.provinsi&code=eq.62&select=id,parent_id,level,code,name",
  );
  if (!province)
    throw new Error("Kalimantan Tengah region (code 62) was not found");
  return province;
}

export async function findChildren(parentId: string, level: Region["level"]) {
  return supabaseRequest<Region[]>(
    `regions?parent_id=eq.${encodeURIComponent(parentId)}&level=eq.${level}&select=id,parent_id,level,code,name&order=code.asc`,
  );
}

export function chooseRegion(regions: Region[], input: string): Region | null {
  const value = input.trim();
  const number = Number(value);
  if (/^\d+$/.test(value) && number >= 1 && number <= regions.length) {
    return regions[number - 1];
  }
  const normalized = value.toLocaleLowerCase("id-ID");
  const exact = regions.filter(
    (region) => region.name.toLocaleLowerCase("id-ID") === normalized,
  );
  if (exact.length === 1) return exact[0];
  const partial = regions.filter((region) =>
    region.name.toLocaleLowerCase("id-ID").includes(normalized),
  );
  return partial.length === 1 ? partial[0] : null;
}

export function regionOptions(regions: Region[], label: string) {
  const options = regions
    .map((region, index) => `${index + 1}. ${region.name}`)
    .join("\n");
  return options.length > 3500
    ? `Silakan ketik nomor 1-${regions.length} atau nama ${label}.`
    : `Silakan ketik nomor atau nama ${label}:\n${options}`;
}

export async function startRegionSelection(contact: Contact) {
  const province = await findProvince();
  const kabupaten = await findChildren(province.id, "kabupaten");
  await setSession(contact.id, "choosing_kabupaten", { parentId: province.id });
  return `Wilayah ${province.name}.\n${regionOptions(kabupaten, "kabupaten")}`;
}

export async function handleRegionSelection(
  contact: Contact,
  session: Session,
  input: string,
): Promise<string> {
  const level =
    session.state === "choosing_kabupaten"
      ? "kabupaten"
      : session.state === "choosing_kecamatan"
        ? "kecamatan"
        : "desa";
  const parentId =
    typeof session.context.parentId === "string"
      ? session.context.parentId
      : (await findProvince()).id;
  const regions = await findChildren(parentId, level);
  const region = chooseRegion(regions, input);
  if (!region)
    return `Pilihan wilayah tidak ditemukan.\n${regionOptions(regions, level)}`;

  if (level === "kabupaten") {
    const children = await findChildren(region.id, "kecamatan");
    await setSession(contact.id, "choosing_kecamatan", {
      parentId: region.id,
      kabupatenId: region.id,
      kabupatenName: region.name,
    });
    return `Kabupaten ${region.name} dipilih.\n${regionOptions(children, "kecamatan")}`;
  }
  if (level === "kecamatan") {
    const children = await findChildren(region.id, "desa");
    await setSession(contact.id, "choosing_desa", {
      parentId: region.id,
      kabupatenId: session.context.kabupatenId,
      kabupatenName: session.context.kabupatenName,
      kecamatanId: region.id,
      kecamatanName: region.name,
    });
    return `Kecamatan ${region.name} dipilih.\n${regionOptions(children, "desa")}`;
  }
  await supabaseRequest("subscriptions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      contact_id: contact.id,
      region_id: region.id,
      is_active: true,
    }),
  });
  await setSession(contact.id, "idle");
  return `Berhasil! Anda kini akan menerima peringatan dini Karhutla untuk desa ${region.name}.`;
}
