import { divIcon } from "leaflet";
import Image from "next/image";
import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
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
import type {
  PublicHotspot,
  PublicIncident,
  PublicRegionBoundary,
  PublicReport,
} from "@/lib/public-api";

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
  publicHotspots?: PublicHotspot[];
  publicIncidents?: PublicIncident[];
  onSelectPublicHotspot?: (hotspot: PublicHotspot) => void;
}

type LocatedReport = PublicReport & {
  latitude: number;
  longitude: number;
};

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
  publicHotspots,
}: {
  selectedId?: string | null | undefined;
  publicHotspots?: PublicHotspot[];
}) {
  const map = useMap();
  useEffect(() => {
    const live = publicHotspots?.find((row) => row.id === selectedId);
    const fixture =
      publicHotspots === undefined
        ? hotspots.find((row) => row.id === selectedId)
        : undefined;
    const coordinates = live
      ? ([live.latitude, live.longitude] as [number, number])
      : fixture
        ? ([fixture.lat, fixture.lng] as [number, number])
        : null;
    if (coordinates)
      map.setView(coordinates, Math.max(map.getZoom(), 10), {
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
  }, [map, selectedId, publicHotspots]);
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
  publicHotspots,
  publicIncidents = [],
  onSelectPublicHotspot,
}: Props) {
  const { statusOf } = useApp();
  const list = hotspots
    .map((h) => ({ ...h, status: statusOf(h.id) }))
    .filter((h) =>
      hotspotIds
        ? hotspotIds.includes(h.id)
        : !(hideFalse && h.status === "bukan-api"),
    );
  const reportGroups = useMemo(() => {
    const groups = new Map<string, LocatedReport[]>();
    const locatedReports = reports.filter(
      (report): report is LocatedReport =>
        report.latitude !== null && report.longitude !== null,
    );
    for (const report of locatedReports) {
      const key = `${report.latitude.toFixed(5)}:${report.longitude.toFixed(5)}`;
      const group = groups.get(key) ?? [];
      group.push(report);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [reports]);
  return (
    <MapContainer
      center={[-2.45, 114.1]}
      zoom={compact ? 8 : 9}
      scrollWheelZoom={!compact}
      zoomControl={!compact}
      className="h-full w-full z-0"
    >
      <FocusHotspot selectedId={selectedId} publicHotspots={publicHotspots} />
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
        publicHotspots !== undefined &&
        publicHotspots.map((h) => (
          <CircleMarker
            key={`live-hotspot-${h.id}`}
            center={[h.latitude, h.longitude]}
            radius={selectedId === h.id ? 10 : 6}
            eventHandlers={{ click: () => onSelectPublicHotspot?.(h) }}
            pathOptions={{
              color: css("var(--map-marker-stroke)"),
              weight: 2,
              fillColor: css("var(--risk-extreme)"),
              fillOpacity: 1,
            }}
          >
            <Popup>
              <b>{h.regionName ?? "Hotspot FIRMS"}</b>
              <br />
              {new Date(h.acqAt).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              WIB
              <br />
              {h.satellite} · {h.instrument}
              <br />
              Confidence {h.confidenceLevel ?? "tidak diketahui"}
              {h.frp === null ? "" : ` · FRP ${h.frp} MW`}
            </Popup>
          </CircleMarker>
        ))}
      {showHotspots &&
        publicHotspots === undefined &&
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
      {showHotspots &&
        publicHotspots !== undefined &&
        publicIncidents
          .filter(
            (incident) =>
              incident.latitude !== null && incident.longitude !== null,
          )
          .map((incident) => (
            <CircleMarker
              key={`live-incident-${incident.id}`}
              center={[
                incident.latitude as number,
                incident.longitude as number,
              ]}
              radius={11}
              pathOptions={{
                color: css("var(--primary)"),
                fillColor: css("var(--primary)"),
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Popup>
                <b>
                  Insiden · {incident.regionName ?? "Wilayah belum tersedia"}
                </b>
                <br />
                {incident.hotspotCount} hotspot · {incident.status}
                <br />
                Terakhir terdeteksi{" "}
                {new Date(incident.lastDetectedAt).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}{" "}
                WIB
              </Popup>
            </CircleMarker>
          ))}
      {showReports &&
        reportGroups.map((group) => {
          const first = group[0];
          if (!first) return null;
          return (
            <Marker
              key={`report-group-${first.id}`}
              position={[first.latitude, first.longitude]}
              icon={divIcon({
                className: "",
                html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${css("var(--primary)")};border:2px solid white;color:white;font-size:12px;font-weight:700;box-shadow:0 1px 5px #0005">${group.length}</span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              })}
              eventHandlers={{ click: () => onSelectReport?.(first) }}
            >
              <Popup>
                <div className="w-72">
                  <strong className="text-base">
                    {group.length} laporan warga
                  </strong>
                  <div className="mt-2 max-h-80 space-y-3 overflow-y-auto">
                    {group.map((report) => (
                      <div
                        key={report.id}
                        className="border-b pb-3 last:border-0"
                      >
                        <p className="text-sm">
                          {report.description ?? "Deskripsi belum tersedia"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {report.region?.name ?? "Wilayah belum tersedia"}
                          {report.region?.parent
                            ? ` · ${report.region.parent.name}`
                            : ""}
                        </p>
                        {report.media.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {report.media.map((media) => (
                              <Image
                                key={media.url}
                                src={media.url}
                                alt="Bukti laporan"
                                width={240}
                                height={160}
                                unoptimized
                                className="h-20 w-full rounded-md object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
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
