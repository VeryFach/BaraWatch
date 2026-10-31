import { useEffect, useState } from "react";
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

interface Props {
  showRisk: boolean;
  showHotspots: boolean;
  hideFalse: boolean;
  selectedId?: string | null | undefined;
  onSelect?: (h: Hotspot) => void;
  compact?: boolean;
  showKonsesi?: boolean;
  hotspotIds?: string[];
  villageNames?: string[];
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

export default function FireMap({
  showRisk,
  showHotspots,
  hideFalse,
  selectedId,
  onSelect,
  compact,
  showKonsesi,
  hotspotIds,
  villageNames,
}: Props) {
  const { statusOf } = useApp();
  const [mapReady, setMapReady] = useState(false);
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
      whenReady={() => setMapReady(true)}
    >
      {mapReady && (
        <>
          <FocusHotspot selectedId={selectedId} />
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
        </>
      )}
    </MapContainer>
  );
}
