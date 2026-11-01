"use client";

import { MapPin } from "lucide-react";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const DEFAULT_CENTER: [number, number] = [-1.6, 113.9];

export function ReportLocationPicker({
  value,
  onChange,
}: {
  value: Coordinates | null;
  onChange: (coordinates: Coordinates) => void;
}) {
  const center: [number, number] = value
    ? [value.latitude, value.longitude]
    : DEFAULT_CENTER;

  return (
    <div className="relative h-56 overflow-hidden rounded-xl border">
      <MapContainer
        center={center}
        zoom={value ? 14 : 6}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport value={value} />
        <MapClickHandler onChange={onChange} />
        {value && (
          <CircleMarker
            center={[value.latitude, value.longitude]}
            radius={9}
            pathOptions={{
              color: "#b42318",
              fillColor: "#ef4444",
              fillOpacity: 0.9,
              weight: 3,
            }}
          />
        )}
      </MapContainer>
      <div className="pointer-events-none absolute left-2 top-2 z-[400] rounded-lg bg-card/95 px-2.5 py-1.5 text-xs shadow-sm">
        <MapPin className="mr-1 inline size-3.5 text-destructive" />
        Klik peta untuk memilih titik
      </div>
    </div>
  );
}

function MapClickHandler({
  onChange,
}: {
  onChange: (coordinates: Coordinates) => void;
}) {
  useMapEvents({
    click(event) {
      onChange({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

function MapViewport({ value }: { value: Coordinates | null }) {
  const map = useMap();

  useEffect(() => {
    if (value) {
      map.setView(
        [value.latitude, value.longitude],
        Math.max(map.getZoom(), 14),
      );
    }
  }, [map, value]);

  return null;
}
