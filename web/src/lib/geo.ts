export type GeoPoint = {
  lat: number;
  lng: number;
};

export type GeoFix = GeoPoint & {
  accuracy: number | null;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
