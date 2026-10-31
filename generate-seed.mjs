import fs from 'fs';
import { randomUUID } from 'crypto';

const BASE_URL = 'https://www.emsifa.com/api-wilayah-indonesia/v2';
const PROVINCE_ID = '62'; // Kode Kalteng

const ltreeLabel = (code) => `ID_${code.replace(/\./g, '_')}`;
const escapeSql = (str) => str.replace(/'/g, "''");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gagal fetch ${url}: ${res.status} ${text}`);
  }
  return res.json();
}

async function getGeomWkt(id, hasPath) {
  if (!hasPath) return "ST_GeomFromText('MULTIPOLYGON EMPTY', 4326)";
  
  try {
    const res = await fetchJson(`${BASE_URL}/paths/${id}.json`);
    const pathData = res.data.path; 
    
    if (!pathData || pathData.length === 0) {
      return "ST_GeomFromText('MULTIPOLYGON EMPTY', 4326)";
    }

    // Deteksi kedalaman array koordinat
    let depth = 0;
    let curr = pathData;
    while (Array.isArray(curr)) {
        depth++;
        curr = curr[0];
    }
    
    // Normalisasi struktur menjadi MultiPolygon standar [ [ [ [lng, lat] ] ] ]
    let multiPolygon = [];
    if (depth === 2) multiPolygon = [[pathData]]; // Array of [lat, lng]
    else if (depth === 3) multiPolygon = [pathData]; // Array of rings
    else if (depth === 4) multiPolygon = pathData; // Array of polygons
    else return "ST_GeomFromText('MULTIPOLYGON EMPTY', 4326)";

    // Format ke string WKT dengan memastikan Polygon tertutup
    const polygonStrings = multiPolygon.map(polygon => {
        const ringStrings = polygon.map(ring => {
            let pairs = ring.map(coord => `${coord[1]} ${coord[0]}`); // WKT butuh (lng lat)
            // PostGIS mewajibkan titik awal = titik akhir
            if (pairs.length > 0 && pairs[0] !== pairs[pairs.length - 1]) {
                pairs.push(pairs[0]);
            }
            return `(${pairs.join(', ')})`;
        });
        return `(${ringStrings.join(', ')})`;
    });
    
    return `ST_GeomFromText('MULTIPOLYGON(${polygonStrings.join(', ')})', 4326)`;
  } catch (error) {
    console.warn(`⚠️ Gagal mengambil poligon untuk ${id}, fallback ke EMPTY.`);
    return "ST_GeomFromText('MULTIPOLYGON EMPTY', 4326)";
  }
}

async function generateSeed() {
  const sql = [];
  sql.push('-- Seed Wilayah Kalimantan Tengah (Provinsi, Kabupaten, Kecamatan, Desa)');
  sql.push('-- Data & Koordinat Poligon ditarik dari API Emsifa v2\n');

  try {
    console.log('Mengambil data Provinsi...');
    const provRes = await fetchJson(`${BASE_URL}/provinces.json`);
    const kalteng = provRes.data.find((p) => p.id === PROVINCE_ID);

    if (!kalteng) throw new Error('Data Provinsi Kalimantan Tengah tidak ditemukan.');

    const provUuid = randomUUID();
    const provPath = ltreeLabel(kalteng.id);
    const provGeom = await getGeomWkt(kalteng.id, kalteng.has_path);
    
    sql.push(`INSERT INTO public.regions (id, parent_id, level, code, name, path, geom) VALUES ('${provUuid}', NULL, 'provinsi', '${kalteng.id}', '${escapeSql(kalteng.name)}', '${provPath}', ${provGeom});`);

    console.log('Mengambil data Kabupaten...');
    const kabRes = await fetchJson(`${BASE_URL}/regencies/${PROVINCE_ID}.json`);

    for (const kab of kabRes.data) {
      const kabUuid = randomUUID();
      const kabPath = `${provPath}.${ltreeLabel(kab.id)}`;
      const kabGeom = await getGeomWkt(kab.id, kab.has_path);
      
      sql.push(`INSERT INTO public.regions (id, parent_id, level, code, name, path, geom) VALUES ('${kabUuid}', '${provUuid}', 'kabupaten', '${kab.id}', '${escapeSql(kab.name)}', '${kabPath}', ${kabGeom});`);

      console.log(`Mengambil data Kecamatan untuk Kabupaten ${kab.name}...`);
      const kecRes = await fetchJson(`${BASE_URL}/districts/${kab.id}.json`);

      for (const kec of kecRes.data) {
        const kecUuid = randomUUID();
        const kecPath = `${kabPath}.${ltreeLabel(kec.id)}`;
        const kecGeom = await getGeomWkt(kec.id, kec.has_path);
        
        sql.push(`INSERT INTO public.regions (id, parent_id, level, code, name, path, geom) VALUES ('${kecUuid}', '${kabUuid}', 'kecamatan', '${kec.id}', '${escapeSql(kec.name)}', '${kecPath}', ${kecGeom});`);

        const kelRes = await fetchJson(`${BASE_URL}/villages/${kec.id}.json`);

        for (const kel of kelRes.data) {
          const kelUuid = randomUUID();
          const kelPath = `${kecPath}.${ltreeLabel(kel.id)}`;
          const kelGeom = await getGeomWkt(kel.id, kel.has_path);
          
          sql.push(`INSERT INTO public.regions (id, parent_id, level, code, name, path, geom) VALUES ('${kelUuid}', '${kecUuid}', 'desa', '${kel.id}', '${escapeSql(kel.name)}', '${kelPath}', ${kelGeom});`);
        }
      }
    }

    fs.writeFileSync('kalteng_regions_seed.sql', sql.join('\n'));
    console.log('✅ Berhasil! File seed tersimpan di: kalteng_regions_seed.sql');
    
  } catch (error) {
    console.error('❌ Gagal menjalankan script:', error.message);
  }
}

generateSeed();