import Image from "next/image";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { useApp } from "@/components/AppState";
import "leaflet/dist/leaflet.css";
import {
  desaList,
  type Hotspot,
  hotspots,
  riskLabel,
  riskVar,
  statusLabel,
} from "@/lib/dummy-data";
import type { PublicRegionBoundary, PublicReport } from "@/lib/public-api";

interface Props {
  showRisk: boolean;
  showHotspots: boolean;
  showReports?: boolean;
  hideFalse: boolean;
  selectedId?: string | null | undefined;
  selectedReportId?: string | null | undefined;
  onSelect?: (h: Hotspot) => void;
  onSelectReport?: (report: PublicReport) => void;
  compact?: boolean;
  showKonsesi?: boolean;
  hotspotIds?: string[];
  villageNames?: string[];
  reports?: PublicReport[];
  regions?: PublicRegionBoundary[];
  regionLevels?: PublicRegionBoundary["level"][];
}

const konsesi: { nama: string; pts: [number, number][] }[] = [
  {
    nama: "PT Sawit Lestari (contoh)",
    pts: [
      [-2.48, 114.1],
      [-2.48, 114.3],
      [-2.62, 114.3],
      [-2.62, 114.1],
    ],
  },
  {
    nama: "PT Hutan Raya (contoh)",
    pts: [
      [-2.85, 113.75],
      [-2.85, 113.95],
      [-3.02, 113.95],
      [-3.02, 113.75],
    ],
  },
];

const css = (v: string) =>
  typeof window === "undefined"
    ? v
    : getComputedStyle(document.documentElement)
        .getPropertyValue(v.slice(4, -1))
        .trim() || v;

function FocusHotspot({
  selectedId,
}: {
  selectedId?: string | null | undefined;
}) {
  const map = useMap();
  useEffect(() => {
    const h = hotspots.find((row) => row.id === selectedId);
    if (h)
      map.setView([h.lat, h.lng], Math.max(map.getZoom(), 10), {
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
  }, [map, selectedId]);
  return null;
}

function FocusReport({ report }: { report?: PublicReport }) {
  const map = useMap();
  useEffect(() => {
    if (
      report?.latitude !== null &&
      report?.latitude !== undefined &&
      report.longitude !== null &&
      report.longitude !== undefined
    ) {
      map.setView(
        [report.latitude, report.longitude],
        Math.max(map.getZoom(), 12),
        {
          animate: !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
        },
      );
    }
  }, [map, report]);
  return null;
}

export default function FireMap({
  showRisk,
  showHotspots,
  showReports = true,
  hideFalse,
  selectedId,
  selectedReportId,
  onSelect,
  onSelectReport,
  compact,
  showKonsesi,
  hotspotIds,
  villageNames,
  reports = [],
  regions = [],
  regionLevels = [],
}: Props) {
  const { statusOf } = useApp();
  const list = hotspots
    .map((h) => ({ ...h, status: statusOf(h.id) }))
    .filter((h) =>
      hotspotIds
        ? hotspotIds.includes(h.id)
        : !(hideFalse && h.status === "bukan-api"),
    );
  return (
    <MapContainer
      center={[-2.45, 114.1]}
      zoom={compact ? 8 : 9}
      scrollWheelZoom={!compact}
      zoomControl={!compact}
      className="h-full w-full z-0"
    >
      <FocusHotspot selectedId={selectedId} />
      <FocusReport
        report={reports.find((report) => report.id === selectedReportId)}
      />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {showKonsesi &&
        konsesi.map((k) => (
          <Polygon
            key={k.nama}
            positions={k.pts}
            pathOptions={{
              color: css("var(--forest)"),
              dashArray: "6 6",
              weight: 2,
              fillOpacity: 0.08,
            }}
          >
            <Tooltip sticky>{k.nama}</Tooltip>
          </Polygon>
        ))}
      {regions
        .filter(
          (region) =>
            region.geometry !== null && regionLevels.includes(region.level),
        )
        .map((region) =>
          region.geometry ? (
            <Polygon
              key={region.id}
              positions={geoJsonToLeaflet(region.geometry)}
              pathOptions={{
                color: css(
                  region.level === "kabupaten"
                    ? "var(--primary)"
                    : region.level === "kecamatan"
                      ? "var(--forest)"
                      : "var(--risk-medium)",
                ),
                weight: region.level === "kabupaten" ? 2 : 1,
                fillOpacity: 0.04,
              }}
            >
              <Tooltip sticky>
                {region.level} · {region.name}
              </Tooltip>
            </Polygon>
          ) : null,
        )}
      {showRisk &&
        desaList
          .filter((d) => !villageNames || villageNames.includes(d.nama))
          .map((d) => (
            <CircleMarker
              key={d.nama}
              center={[d.lat, d.lng]}
              radius={compact ? 16 : 26}
              pathOptions={{
                color: css(riskVar[d.risk]),
                fillColor: css(riskVar[d.risk]),
                fillOpacity: 0.22,
                weight: 1,
              }}
            >
              <Tooltip>
                <b>{d.nama}</b> · Risiko {riskLabel[d.risk]}
                <br />
                {d.alasan}
              </Tooltip>
            </CircleMarker>
          ))}
      {showHotspots &&
        list.map((h) => {
          const off = h.status === "bukan-api" || h.status === "selesai";
          const sel = selectedId === h.id;
          return (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lng]}
              radius={sel ? 11 : 7}
              eventHandlers={{ click: () => onSelect?.(h) }}
              pathOptions={{
                color: css("var(--map-marker-stroke)"),
                weight: 2,
                fillColor: off
                  ? css("var(--map-marker-inactive)")
                  : css("var(--risk-extreme)"),
                fillOpacity: 1,
              }}
            >
              {!onSelect && (
                <Popup>
                  <b>{h.desa}</b> — {statusLabel[h.status]}
                  <br />
                  Confidence {h.confidence}% · {h.waktu}
                </Popup>
              )}
            </CircleMarker>
          );
        })}
      {showReports &&
        reports
          .filter(
            (report) => report.latitude !== null && report.longitude !== null,
          )
          .map((report) => (
            <CircleMarker
              key={`report-${report.id}`}
              center={[report.latitude as number, report.longitude as number]}
              radius={8}
              eventHandlers={{
                click: () => onSelectReport?.(report),
              }}
              pathOptions={{
                color: css("var(--primary)"),
                fillColor: css("var(--risk-medium)"),
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Popup>
                <div className="w-72">
                  <strong className="text-base">Laporan warga</strong>
                  <p className="mt-1 text-sm">
                    {report.description ?? "Deskripsi belum tersedia"}
                  </p>
                  {report.region && (
                    <p className="text-xs text-gray-500">
                      {report.region.name}
                      {report.region.parent
                        ? ` · ${report.region.parent.name}`
                        : ""}
                    </p>
                  )}
                  {report.media.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {report.media.map((media) => (
                        <Image
                          key={media.url}
                          src={media.url}
                          alt="Bukti laporan"
                          width={240}
                          height={180}
                          unoptimized
                          className="h-36 w-full rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
    </MapContainer>
  );
}

function geoJsonToLeaflet(
  geometry: NonNullable<PublicRegionBoundary["geometry"]>,
) {
  if (geometry.type === "Polygon") {
    const coordinates = geometry.coordinates as number[][][];
    return coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
  }
  const coordinates = geometry.coordinates as number[][][][];
  return coordinates.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
    ),
  );
}
