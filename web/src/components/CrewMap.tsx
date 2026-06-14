"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Member } from "@/lib/crew";
import type { GeoFix } from "@/lib/geo";
import type { MeetingPin } from "@/lib/pin";

const STALE_AFTER_MS = 30_000;
const GONE_AFTER_MS = 10 * 60_000;

type Props = {
  members: Member[];
  meId: string | null;
  ownPosition: GeoFix | null;
  now: number;
  pin: MeetingPin | null;
  picking: boolean;
  onPickLocation: (lat: number, lng: number) => void;
};

type Point = {
  member: Member;
  lat: number;
  lng: number;
  accuracy: number | null;
  ageMs: number;
  isMe: boolean;
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatAge(ageMs: number): string {
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
}

function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="font-size:32px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function markerIcon(point: Point): L.DivIcon {
  const classes = ["crew-marker"];
  if (point.isMe) classes.push("crew-marker-me");
  if (point.ageMs > STALE_AFTER_MS) classes.push("crew-marker-stale");
  const label =
    escapeHtml(point.member.name) +
    (point.ageMs > STALE_AFTER_MS ? ` &middot; ${formatAge(point.ageMs)}` : "");
  return L.divIcon({
    className: "",
    html: `<div class="${classes.join(" ")}">
      <span class="crew-marker-emoji">${point.member.emoji}</span>
      <span class="crew-marker-name">${label}</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function CrewMap({
  members,
  meId,
  ownPosition,
  now,
  pin,
  picking,
  onPickLocation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const accuracyRef = useRef<L.Circle | null>(null);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    map.setView([20, 0], 2);
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
      accuracyRef.current = null;
      pinMarkerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const points: Point[] = [];
    for (const member of members) {
      const isMe = member.id === meId;
      if (isMe && ownPosition) {
        points.push({ member, ...ownPosition, ageMs: 0, isMe });
      } else if (member.position) {
        const ageMs = Math.max(0, now - member.position.at);
        if (ageMs <= GONE_AFTER_MS) {
          points.push({
            member,
            lat: member.position.lat,
            lng: member.position.lng,
            accuracy: member.position.accuracy,
            ageMs,
            isMe,
          });
        }
      }
    }
    pointsRef.current = points;

    const markers = markersRef.current;
    const seen = new Set<string>();
    for (const point of points) {
      seen.add(point.member.id);
      const existing = markers.get(point.member.id);
      if (existing) {
        existing.setLatLng([point.lat, point.lng]);
        existing.setIcon(markerIcon(point));
      } else {
        const marker = L.marker([point.lat, point.lng], {
          icon: markerIcon(point),
        }).addTo(map);
        markers.set(point.member.id, marker);
      }
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    const me = points.find((point) => point.isMe);
    if (me && me.accuracy !== null) {
      if (accuracyRef.current) {
        accuracyRef.current.setLatLng([me.lat, me.lng]);
        accuracyRef.current.setRadius(me.accuracy);
      } else {
        accuracyRef.current = L.circle([me.lat, me.lng], {
          radius: me.accuracy,
          weight: 1,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
        }).addTo(map);
      }
    } else if (accuracyRef.current) {
      accuracyRef.current.remove();
      accuracyRef.current = null;
    }

    if (!fittedRef.current && points.length > 0) {
      fittedRef.current = true;
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 18);
      } else {
        map.fitBounds(
          L.latLngBounds(points.map((point) => [point.lat, point.lng])),
          { padding: [50, 50], maxZoom: 19 },
        );
      }
    }
  }, [members, meId, ownPosition, now]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!pin) {
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      return;
    }

    const popup = `<div style="text-align:center">Set by ${escapeHtml(
      pin.setByEmoji,
    )} ${escapeHtml(pin.setByName)}<br/>${formatAge(
      Math.max(0, now - pin.at),
    )} ago</div>`;

    if (pinMarkerRef.current) {
      pinMarkerRef.current.setLatLng([pin.lat, pin.lng]);
    } else {
      pinMarkerRef.current = L.marker([pin.lat, pin.lng], {
        icon: pinIcon(),
      }).addTo(map);
    }
    pinMarkerRef.current.bindPopup(popup);
  }, [pin, now]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picking) return;
    const handler = (event: L.LeafletMouseEvent) =>
      onPickLocation(event.latlng.lat, event.latlng.lng);
    map.on("click", handler);
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.off("click", handler);
      map.getContainer().style.cursor = "";
    };
  }, [picking, onPickLocation]);

  function fitCrew() {
    const map = mapRef.current;
    const points = pointsRef.current;
    if (!map || points.length === 0) return;
    map.fitBounds(
      L.latLngBounds(points.map((point) => [point.lat, point.lng])),
      { padding: [50, 50], maxZoom: 19 },
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button
        onClick={fitCrew}
        className="absolute bottom-3 right-3 z-[1000] rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-md transition-colors hover:bg-zinc-100"
      >
        Fit crew
      </button>
    </div>
  );
}
