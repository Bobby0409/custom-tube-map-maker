import type { Station } from "../types/station";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 680;

export const MAP_BOUNDS = {
  minLat: 51.35,
  maxLat: 51.72,
  minLon: -1,
  maxLon: 0.36,
};

const padding = {
  x: 48,
  y: 54,
};

function mercatorY(lat: number) {
  const latRadians = (lat * Math.PI) / 180;

  return Math.log(Math.tan(Math.PI / 4 + latRadians / 2));
}

function inverseMercatorY(y: number) {
  return (Math.atan(Math.sinh(y)) * 180) / Math.PI;
}

const projectedBounds = {
  minY: mercatorY(MAP_BOUNDS.minLat),
  maxY: mercatorY(MAP_BOUNDS.maxLat),
};

export function projectGeoPoint(
  point: Pick<Station, "lat" | "lon">,
  options: { clamp?: boolean } = {},
) {
  const shouldClamp = options.clamp ?? true;
  const xRange = MAP_WIDTH - padding.x * 2;
  const yRange = MAP_HEIGHT - padding.y * 2;
  const x =
    padding.x +
    ((point.lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) *
      xRange;
  const y =
    padding.y +
    ((projectedBounds.maxY - mercatorY(point.lat)) /
      (projectedBounds.maxY - projectedBounds.minY)) *
      yRange;

  return {
    x: shouldClamp ? Math.max(padding.x, Math.min(MAP_WIDTH - padding.x, x)) : x,
    y: shouldClamp ? Math.max(padding.y, Math.min(MAP_HEIGHT - padding.y, y)) : y,
  };
}

export function unprojectMapPoint(point: { x: number; y: number }) {
  const xRange = MAP_WIDTH - padding.x * 2;
  const yRange = MAP_HEIGHT - padding.y * 2;
  const lon =
    MAP_BOUNDS.minLon +
    ((point.x - padding.x) / xRange) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const mercator =
    projectedBounds.maxY -
    ((point.y - padding.y) / yRange) *
      (projectedBounds.maxY - projectedBounds.minY);

  return {
    lat: inverseMercatorY(mercator),
    lon,
  };
}

export function projectStation(station: Pick<Station, "lat" | "lon">) {
  return projectGeoPoint(station);
}
