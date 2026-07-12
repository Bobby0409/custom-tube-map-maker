"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  WheelEvent,
} from "react";
import Link from "next/link";
import stationsData from "./data/stations.json";
import type { Station } from "./types/station";
import {
  MAP_BOUNDS,
  MAP_HEIGHT,
  MAP_WIDTH,
  projectGeoPoint,
  projectStation,
  unprojectMapPoint,
} from "./utils/mapProjection";

type StationPoint = {
  renderKey?: string;
  stationLines?: CustomLine[];
  station: Station;
  x: number;
  y: number;
  labelAnchor: "start" | "end";
  labelDx: number;
  labelDy: number;
};

type MapView = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type CustomBranch = {
  id: string;
  name: string;
  stationIds: string[];
};

type CustomLine = {
  activeBranchId: string;
  branches: CustomBranch[];
  colour: string;
  id: string;
  name: string;
};

const stations = stationsData as Station[];

const tubePalette = [
  { name: "Central red", value: "#e32017" },
  { name: "Victoria blue", value: "#0098d4" },
  { name: "District green", value: "#00782a" },
  { name: "Circle yellow", value: "#ffd300" },
  { name: "Elizabeth purple", value: "#6950a1" },
  { name: "Overground orange", value: "#ee7c0e" },
  { name: "Bakerloo brown", value: "#b36305" },
  { name: "Jubilee silver", value: "#a0a5a9" },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 50;
const ZOOM_STEP = 1;
const SEARCH_ZOOM = 28;
const SELECTED_LABEL_ZOOM = 5;
const STATION_LABEL_ZOOM = 12;
const STATION_MARKER_ZOOM = 2.6;
const MOBILE_BREAKPOINT_QUERY = "(max-width: 768px)";
const MOBILE_TAP_TARGET_RADIUS = 24;
const CAMERA_SAFE_PADDING = 0.18;
const CAMERA_ANIMATION_MS = 320;
const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 1088;
const EXPORT_NETWORK_BOUNDS = {
  bottom: MAP_HEIGHT - 58,
  left: 74,
  right: MAP_WIDTH - 56,
  top: 132,
};
const EXPORT_LEGEND_BOUNDS = {
  bottom: 142,
  left: 18,
  right: 370,
  top: 18,
};
const EXPORT_MIN_STATION_GAP = 94;
const CENTRAL_LONDON_CAMERA = {
  center: { lat: 51.5116, lon: -0.113 },
  zoom: 10,
};

type LabelBox = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type RouteSegment = {
  fromStationId: string;
  toStationId: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

type ExportRoute = {
  branch: CustomBranch;
  line: CustomLine;
  points: StationPoint[];
  routePoints: string;
};

type SchematicNode = StationPoint & {
  degree: number;
  lineIds: Set<string>;
  placed: boolean;
  sourceX: number;
  sourceY: number;
};

type SchematicEdge = {
  directionIndex?: number;
  from: string;
  key: string;
  length: number;
  to: string;
};

type MapCamera = {
  x: number;
  y: number;
  zoom: number;
};

type DragState = {
  isPinch?: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startZoom: number;
  moved: boolean;
};

type TouchPoint = {
  clientX: number;
  clientY: number;
};

type PinchState = {
  moved: boolean;
  startCamera: MapCamera;
  startCenterX: number;
  startCenterY: number;
  startDistance: number;
};

type CameraAnimationState = {
  frame: number;
  to: MapCamera;
};

type MapTile = {
  height: number;
  href: string;
  key: string;
  width: number;
  x: number;
  y: number;
};

const MIN_OSM_TILE_ZOOM = 12;
const MAX_OSM_TILE_ZOOM = 19;

function lonToTileX(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number) {
  const latRadians = (lat * Math.PI) / 180;

  return Math.floor(
    ((1 -
      Math.log(Math.tan(latRadians) + 1 / Math.cos(latRadians)) / Math.PI) /
      2) *
      2 ** zoom,
  );
}

function tileXToLon(tileX: number, zoom: number) {
  return (tileX / 2 ** zoom) * 360 - 180;
}

function tileYToLat(tileY: number, zoom: number) {
  const mercator = Math.PI * (1 - (2 * tileY) / 2 ** zoom);

  return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
}

function tileZoomForCamera(zoom: number) {
  return Math.min(
    MAX_OSM_TILE_ZOOM,
    Math.max(MIN_OSM_TILE_ZOOM, MIN_OSM_TILE_ZOOM + Math.floor(Math.log2(zoom))),
  );
}

function tileRectToMapRect(tileX: number, tileY: number, zoom: number) {
  const west = tileXToLon(tileX, zoom);
  const east = tileXToLon(tileX + 1, zoom);
  const north = tileYToLat(tileY, zoom);
  const south = tileYToLat(tileY + 1, zoom);
  const topLeft = projectGeoPoint({ lat: north, lon: west }, { clamp: false });
  const bottomRight = projectGeoPoint(
    { lat: south, lon: east },
    { clamp: false },
  );

  return {
    height: bottomRight.y - topLeft.y,
    width: bottomRight.x - topLeft.x,
    x: topLeft.x,
    y: topLeft.y,
  };
}

function visibleGeoBounds(camera: MapCamera) {
  const viewWidth = MAP_WIDTH / camera.zoom;
  const viewHeight = MAP_HEIGHT / camera.zoom;
  const topLeft = unprojectMapPoint({ x: camera.x, y: camera.y });
  const bottomRight = unprojectMapPoint({
    x: camera.x + viewWidth,
    y: camera.y + viewHeight,
  });

  return {
    maxLat: Math.min(MAP_BOUNDS.maxLat, Math.max(topLeft.lat, bottomRight.lat)),
    maxLon: Math.min(MAP_BOUNDS.maxLon, Math.max(topLeft.lon, bottomRight.lon)),
    minLat: Math.max(MAP_BOUNDS.minLat, Math.min(topLeft.lat, bottomRight.lat)),
    minLon: Math.max(MAP_BOUNDS.minLon, Math.min(topLeft.lon, bottomRight.lon)),
  };
}

function mapTilesForCamera(camera: MapCamera): MapTile[] {
  const tileZoom = tileZoomForCamera(camera.zoom);
  const bounds = visibleGeoBounds(camera);
  const maxTile = 2 ** tileZoom - 1;
  const westTile = Math.max(0, lonToTileX(bounds.minLon, tileZoom) - 1);
  const eastTile = Math.min(maxTile, lonToTileX(bounds.maxLon, tileZoom) + 1);
  const northTile = Math.max(0, latToTileY(bounds.maxLat, tileZoom) - 1);
  const southTile = Math.min(maxTile, latToTileY(bounds.minLat, tileZoom) + 1);
  const tiles: MapTile[] = [];

  for (let tileX = westTile; tileX <= eastTile; tileX += 1) {
    for (let tileY = northTile; tileY <= southTile; tileY += 1) {
      const rect = tileRectToMapRect(tileX, tileY, tileZoom);

      tiles.push({
        ...rect,
        href: `https://tile.openstreetmap.org/${tileZoom}/${tileX}/${tileY}.png`,
        key: `${tileZoom}-${tileX}-${tileY}`,
      });
    }
  }

  return tiles;
}

function labelPosition(x: number, index: number) {
  const onRightEdge = x > MAP_WIDTH * 0.72;
  const labelAnchor = onRightEdge ? "end" : "start";
  const labelDx = onRightEdge ? -14 : 14;
  const labelDy = [-12, 6, 22][index % 3];

  return { labelAnchor, labelDx, labelDy };
}

function slugifyLineName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "my-tube-line"
  );
}

function displayLineName(line: CustomLine) {
  return line.name.trim() || "Untitled line";
}

function displayBranchName(branch: CustomBranch) {
  return branch.name.trim() || "Untitled branch";
}

function displayLegendLineName(line: CustomLine) {
  const name = displayLineName(line);

  return name.length > 34 ? `${name.slice(0, 31)}...` : name;
}

function makeBranch(id: string, index: number): CustomBranch {
  return {
    id,
    name: index === 0 ? "Main branch" : `Branch ${index + 1}`,
    stationIds: [],
  };
}

function makeLine(id: string, index: number): CustomLine {
  const branch = makeBranch(`${id}-branch-1`, 0);

  return {
    activeBranchId: branch.id,
    branches: [branch],
    colour: tubePalette[index % tubePalette.length].value,
    id,
    name: index === 0 ? "My Tube Line" : `Line ${index + 1}`,
  };
}

function makeStationPoints() {
  return stations.map((station, index) => {
    const point = projectStation(station);

    return {
      station,
      ...point,
      ...labelPosition(point.x, index),
    };
  });
}

const stationPoints = makeStationPoints();

function clampCamera(camera: MapCamera): MapCamera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom));
  const viewWidth = MAP_WIDTH / zoom;
  const viewHeight = MAP_HEIGHT / zoom;
  const maxX = Math.max(0, MAP_WIDTH - viewWidth);
  const maxY = Math.max(0, MAP_HEIGHT - viewHeight);

  return {
    zoom,
    x: Math.min(maxX, Math.max(0, camera.x)),
    y: Math.min(maxY, Math.max(0, camera.y)),
  };
}

function formatViewBox(view: MapView) {
  return `${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.width.toFixed(
    2,
  )} ${view.height.toFixed(2)}`;
}

function centralLondonCamera(): MapCamera {
  const point = projectGeoPoint(CENTRAL_LONDON_CAMERA.center);
  const zoom = CENTRAL_LONDON_CAMERA.zoom;

  return clampCamera({
    zoom,
    x: point.x - MAP_WIDTH / zoom / 2,
    y: point.y - MAP_HEIGHT / zoom / 2,
  });
}

function boxesOverlap(first: LabelBox, second: LabelBox) {
  return !(
    first.right < second.left ||
    first.left > second.right ||
    first.bottom < second.top ||
    first.top > second.bottom
  );
}

function labelBoxForPoint(
  point: StationPoint,
  label: { labelAnchor: "start" | "end"; labelDx: number; labelDy: number },
) {
  const width = Math.min(260, Math.max(66, point.station.name.length * 8.8));
  const height = 19;
  const x = point.x + label.labelDx;
  const y = point.y + label.labelDy;
  const left = label.labelAnchor === "end" ? x - width : x;

  return {
    bottom: y + 4,
    left,
    right: left + width,
    top: y - height,
  };
}

const octilinearDirections = [
  { x: 1, y: 0 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: 0, y: 1 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -1, y: 0 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
];

function normalizeAngle(angle: number) {
  const twoPi = Math.PI * 2;

  return ((angle % twoPi) + twoPi) % twoPi;
}

function angleDistance(first: number, second: number) {
  const delta = Math.abs(normalizeAngle(first) - normalizeAngle(second));

  return Math.min(delta, Math.PI * 2 - delta);
}

function octilinearAngle(index: number) {
  return (normalizeAngle(index * (Math.PI / 4)));
}

function closestOctilinearIndex(angle: number) {
  return octilinearDirections
    .map((_, index) => ({
      index,
      score: angleDistance(angle, octilinearAngle(index)),
    }))
    .sort((first, second) => first.score - second.score)[0].index;
}

function oppositeDirectionIndex(index: number) {
  return (index + 4) % octilinearDirections.length;
}

function stationGapFor(point: StationPoint, degree = 2) {
  return (
    EXPORT_MIN_STATION_GAP +
    Math.min(36, Math.max(0, point.station.name.length - 10) * 2.2) +
    Math.max(0, degree - 2) * 14 +
    ((point.stationLines?.length ?? 0) > 1 ? 18 : 0)
  );
}

function routeSegmentBox(segment: RouteSegment, padding = 10): LabelBox {
  return {
    bottom: Math.max(segment.y1, segment.y2) + padding,
    left: Math.min(segment.x1, segment.x2) - padding,
    right: Math.max(segment.x1, segment.x2) + padding,
    top: Math.min(segment.y1, segment.y2) - padding,
  };
}

function buildRouteSegments(routes: ExportRoute[]) {
  return routes.flatMap((route) =>
    route.points.slice(0, -1).map((point, index) => {
      const nextPoint = route.points[index + 1];

      return {
        fromStationId: point.station.id,
        toStationId: nextPoint.station.id,
        x1: point.x,
        x2: nextPoint.x,
        y1: point.y,
        y2: nextPoint.y,
      };
    }),
  );
}

function placeExportLabels(points: StationPoint[], routeSegments: RouteSegment[]) {
  const placedBoxes: LabelBox[] = [];
  const candidates = [
    { labelAnchor: "start" as const, labelDx: 20, labelDy: 5 },
    { labelAnchor: "end" as const, labelDx: -20, labelDy: 5 },
    { labelAnchor: "start" as const, labelDx: 18, labelDy: -20 },
    { labelAnchor: "end" as const, labelDx: -18, labelDy: -20 },
    { labelAnchor: "start" as const, labelDx: 18, labelDy: 28 },
    { labelAnchor: "end" as const, labelDx: -18, labelDy: 28 },
    { labelAnchor: "start" as const, labelDx: 32, labelDy: -34 },
    { labelAnchor: "end" as const, labelDx: -32, labelDy: 42 },
  ];

  return [...points]
    .sort(
      (first, second) =>
        (second.stationLines?.length ?? 0) - (first.stationLines?.length ?? 0) ||
        second.station.name.length - first.station.name.length ||
        first.y - second.y ||
        first.x - second.x,
    )
    .map((point) => {
      const best = candidates
        .map((candidate) => {
          const box = labelBoxForPoint(point, candidate);
          const boundaryPenalty =
            Math.max(0, 34 - box.left) * 5 +
            Math.max(0, box.right - (MAP_WIDTH - 34)) * 5 +
            Math.max(0, 34 - box.top) * 5 +
            Math.max(0, box.bottom - (MAP_HEIGHT - 46)) * 5;
          const legendPenalty = boxesOverlap(box, EXPORT_LEGEND_BOUNDS) ? 600 : 0;
          const labelOverlapPenalty =
            placedBoxes.filter((placed) => boxesOverlap(box, placed)).length * 140;
          const stationOverlapPenalty =
            points.filter((other) => {
              if (other.station.id === point.station.id) {
                return false;
              }

              return boxesOverlap(box, {
                bottom: other.y + 9,
                left: other.x - 9,
                right: other.x + 9,
                top: other.y - 9,
              });
            }).length * 52;
          const routeOverlapPenalty =
            routeSegments.filter((segment) => {
              const touchesCurrentStation =
                segment.fromStationId === point.station.id ||
                segment.toStationId === point.station.id;

              return (
                boxesOverlap(box, routeSegmentBox(segment, touchesCurrentStation ? 4 : 10)) &&
                !touchesCurrentStation
              );
            }).length * 88;
          const sidePreferencePenalty =
            point.labelAnchor === candidate.labelAnchor ? 0 : 8;

          return {
            box,
            candidate,
            score:
              boundaryPenalty +
              legendPenalty +
              labelOverlapPenalty +
              stationOverlapPenalty +
              routeOverlapPenalty +
              sidePreferencePenalty,
          };
        })
        .sort((first, second) => first.score - second.score)[0];

      placedBoxes.push(best.box);

      return {
        ...point,
        ...best.candidate,
      };
    });
}

function buildSchematicExportLayout(
  customLines: CustomLine[],
  stationPointById: Map<string, StationPoint>,
) {
  const routes = customLines.flatMap((line) =>
    line.branches
      .filter((branch) => branch.stationIds.length > 0)
      .map((branch) => ({ branch, line })),
  );
  const stationIds = Array.from(
    new Set(routes.flatMap((route) => route.branch.stationIds)),
  );
  const sourcePoints = stationIds
    .map((stationId) => stationPointById.get(stationId))
    .filter((point): point is StationPoint => Boolean(point));
  const stationLineMap = new Map<string, CustomLine[]>();
  const branchUseCounts = new Map<string, number>();

  routes.forEach((route) => {
    const branchStationIds = new Set(route.branch.stationIds);

    branchStationIds.forEach((stationId) => {
      branchUseCounts.set(stationId, (branchUseCounts.get(stationId) ?? 0) + 1);
    });
    route.branch.stationIds.forEach((stationId) => {
      const lines = stationLineMap.get(stationId) ?? [];

      if (!lines.some((line) => line.id === route.line.id)) {
        lines.push(route.line);
      }

      stationLineMap.set(stationId, lines);
    });
  });

  if (sourcePoints.length === 0) {
    return { routes: [], stationPoints: [] };
  }

  const edgeMap = new Map<string, SchematicEdge>();
  const adjacency = new Map<string, string[]>();
  const nodeById = new Map<string, SchematicNode>(
    sourcePoints.map((point) => [
      point.station.id,
      {
        ...point,
        degree: 0,
        lineIds: new Set(
          (stationLineMap.get(point.station.id) ?? []).map((line) => line.id),
        ),
        placed: false,
        renderKey: `export-${point.station.id}`,
        sourceX: point.x,
        sourceY: point.y,
        stationLines: stationLineMap.get(point.station.id) ?? [],
        x: 0,
        y: 0,
      },
    ]),
  );

  routes.forEach((route) => {
    route.branch.stationIds.slice(0, -1).forEach((stationId, index) => {
      const nextStationId = route.branch.stationIds[index + 1];

      if (stationId === nextStationId) {
        return;
      }

      const [from, to] =
        stationId < nextStationId
          ? [stationId, nextStationId]
          : [nextStationId, stationId];
      const key = `${from}--${to}`;

      if (!edgeMap.has(key)) {
        const first = nodeById.get(from);
        const second = nodeById.get(to);
        const maxNameLength = Math.max(
          first?.station.name.length ?? 0,
          second?.station.name.length ?? 0,
        );

        edgeMap.set(key, {
          from,
          key,
          length: 104 + Math.min(46, Math.max(0, maxNameLength - 9) * 3),
          to,
        });
        adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
        adjacency.set(to, [...(adjacency.get(to) ?? []), from]);
      }
    });
  });

  nodeById.forEach((node) => {
    node.degree = adjacency.get(node.station.id)?.length ?? 0;
  });

  const sourceCenterX =
    sourcePoints.reduce((total, point) => total + point.x, 0) / sourcePoints.length;
  const sourceCenterY =
    sourcePoints.reduce((total, point) => total + point.y, 0) / sourcePoints.length;
  const nodes = Array.from(nodeById.values());
  const rootQueue = [...nodes].sort((first, second) => {
    const firstScore =
      first.degree * 26 +
      first.lineIds.size * 48 +
      (branchUseCounts.get(first.station.id) ?? 0) * 18 -
      Math.hypot(first.sourceX - sourceCenterX, first.sourceY - sourceCenterY) /
        32;
    const secondScore =
      second.degree * 26 +
      second.lineIds.size * 48 +
      (branchUseCounts.get(second.station.id) ?? 0) * 18 -
      Math.hypot(second.sourceX - sourceCenterX, second.sourceY - sourceCenterY) /
        32;

    return secondScore - firstScore;
  });
  const usedDirectionsByNode = new Map<string, Set<number>>();
  let componentOffset = 0;

  rootQueue.forEach((rootCandidate) => {
    if (rootCandidate.placed) {
      return;
    }

    rootCandidate.x = componentOffset;
    rootCandidate.y = 0;
    rootCandidate.placed = true;
    componentOffset += 440;

    const queue = [rootCandidate.station.id];

    while (queue.length > 0) {
      const stationId = queue.shift();

      if (!stationId) {
        continue;
      }

      const station = nodeById.get(stationId);

      if (!station) {
        continue;
      }

      const neighbours = [...(adjacency.get(stationId) ?? [])].sort((first, second) => {
        const firstNode = nodeById.get(first);
        const secondNode = nodeById.get(second);

        if (!firstNode || !secondNode) {
          return 0;
        }

        return (
          Math.atan2(firstNode.sourceY - station.sourceY, firstNode.sourceX - station.sourceX) -
          Math.atan2(
            secondNode.sourceY - station.sourceY,
            secondNode.sourceX - station.sourceX,
          )
        );
      });
      const usedDirections = usedDirectionsByNode.get(stationId) ?? new Set<number>();

      neighbours.forEach((neighbourId) => {
        const neighbour = nodeById.get(neighbourId);

        if (!neighbour || neighbour.placed) {
          return;
        }

        const desiredAngle = Math.atan2(
          neighbour.sourceY - station.sourceY,
          neighbour.sourceX - station.sourceX,
        );
        const directionChoices = octilinearDirections
          .map((_, index) => {
            const separationPenalty = usedDirections.has(index) ? 3.2 : 0;
            const oppositePenalty = usedDirections.has(oppositeDirectionIndex(index))
              ? 0.8
              : 0;

            return {
              index,
              score:
                angleDistance(desiredAngle, octilinearAngle(index)) +
                separationPenalty +
                oppositePenalty,
            };
          })
          .sort((first, second) => first.score - second.score);
        const directionIndex = directionChoices[0].index;
        const direction = octilinearDirections[directionIndex];
        const [from, to] =
          stationId < neighbourId ? [stationId, neighbourId] : [neighbourId, stationId];
        const edge = edgeMap.get(`${from}--${to}`);
        const length = edge?.length ?? 112;

        if (edge) {
          edge.directionIndex = stationId === edge.from
            ? directionIndex
            : oppositeDirectionIndex(directionIndex);
        }

        neighbour.x = station.x + direction.x * length;
        neighbour.y = station.y + direction.y * length;
        neighbour.placed = true;
        usedDirections.add(directionIndex);
        usedDirectionsByNode.set(stationId, usedDirections);
        usedDirectionsByNode.set(
          neighbourId,
          new Set([oppositeDirectionIndex(directionIndex)]),
        );
        queue.push(neighbourId);
      });
    }
  });

  const edges = Array.from(edgeMap.values());

  edges.forEach((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);

    if (!from || !to || edge.directionIndex !== undefined) {
      return;
    }

    edge.directionIndex = closestOctilinearIndex(
      Math.atan2(to.sourceY - from.sourceY, to.sourceX - from.sourceX),
    );
  });

  for (let iteration = 0; iteration < 180; iteration += 1) {
    const edgeStrength = iteration < 120 ? 0.12 : 0.07;

    edges.forEach((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);

      if (!from || !to) {
        return;
      }

      const direction = octilinearDirections[edge.directionIndex ?? 0];
      const targetX = direction.x * edge.length;
      const targetY = direction.y * edge.length;
      const errorX = to.x - from.x - targetX;
      const errorY = to.y - from.y - targetY;

      from.x += errorX * edgeStrength;
      from.y += errorY * edgeStrength;
      to.x -= errorX * edgeStrength;
      to.y -= errorY * edgeStrength;
    });

    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const first = nodes[firstIndex];
        const second = nodes[secondIndex];
        const deltaX = second.x - first.x;
        const deltaY = second.y - first.y;
        const distance = Math.hypot(deltaX, deltaY) || 0.01;
        const minimumGap = Math.max(
          stationGapFor(first, first.degree),
          stationGapFor(second, second.degree),
        );

        if (distance >= minimumGap) {
          continue;
        }

        const push = ((minimumGap - distance) / distance) * 0.42;

        first.x -= deltaX * push;
        first.y -= deltaY * push;
        second.x += deltaX * push;
        second.y += deltaY * push;
      }
    }
  }

  edges.forEach((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);

    if (!from || !to) {
      return;
    }

    const direction = octilinearDirections[edge.directionIndex ?? 0];
    const perpendicular = { x: -direction.y, y: direction.x };
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const perpendicularError = deltaX * perpendicular.x + deltaY * perpendicular.y;

    from.x += perpendicular.x * perpendicularError * 0.5;
    from.y += perpendicular.y * perpendicularError * 0.5;
    to.x -= perpendicular.x * perpendicularError * 0.5;
    to.y -= perpendicular.y * perpendicularError * 0.5;
  });

  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const layoutWidth = Math.max(maxX - minX, 1);
  const layoutHeight = Math.max(maxY - minY, 1);
  const targetWidth = EXPORT_NETWORK_BOUNDS.right - EXPORT_NETWORK_BOUNDS.left;
  const targetHeight = EXPORT_NETWORK_BOUNDS.bottom - EXPORT_NETWORK_BOUNDS.top;
  const scale = Math.min(targetWidth / layoutWidth, targetHeight / layoutHeight);
  const scaledWidth = layoutWidth * scale;
  const scaledHeight = layoutHeight * scale;
  const offsetX =
    EXPORT_NETWORK_BOUNDS.left + (targetWidth - scaledWidth) / 2 - minX * scale;
  const offsetY =
    EXPORT_NETWORK_BOUNDS.top + (targetHeight - scaledHeight) / 2 - minY * scale;

  nodes.forEach((node) => {
    node.x = offsetX + node.x * scale;
    node.y = offsetY + node.y * scale;
    node.labelAnchor = node.x > MAP_WIDTH / 2 ? "start" : "end";
    node.labelDx = node.labelAnchor === "start" ? 20 : -20;
    node.labelDy = 5;
  });

  const pointByIdBeforeLabels = new Map(nodes.map((node) => [node.station.id, node]));
  const routesBeforeLabels = routes.map((route) => {
    const points = route.branch.stationIds
      .map((stationId) => pointByIdBeforeLabels.get(stationId))
      .filter((point): point is StationPoint => Boolean(point));

    return {
      ...route,
      points,
      routePoints: points
        .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(" "),
    };
  });
  const routeSegments = buildRouteSegments(routesBeforeLabels);
  const exportStationPoints = placeExportLabels(nodes, routeSegments);
  const pointById = new Map(
    exportStationPoints.map((point) => [point.station.id, point]),
  );
  const exportRoutes = routes.map((route) => {
    const points = route.branch.stationIds
      .map((stationId) => pointById.get(stationId))
      .filter((point): point is StationPoint => Boolean(point));

    return {
      ...route,
      points,
      routePoints: points
        .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(" "),
    };
  });

  return { routes: exportRoutes, stationPoints: exportStationPoints };
}

export default function Home() {
  const [customLines, setCustomLines] = useState<CustomLine[]>([
    makeLine("line-1", 0),
  ]);
  const [activeLineId, setActiveLineId] = useState("line-1");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedStationId, setHighlightedStationId] = useState<string | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [camera, setCamera] = useState<MapCamera>(() => centralLondonCamera());
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const mapRef = useRef<SVGSVGElement>(null);
  const exportMapRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef(camera);
  const cameraAnimationRef = useRef<CameraAnimationState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const activePointersRef = useRef(new Map<number, TouchPoint>());
  const skipStationClickRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const syncMobileState = () => setIsMobileViewport(mediaQuery.matches);

    syncMobileState();
    mediaQuery.addEventListener("change", syncMobileState);

    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, []);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(
    () => () => {
      const animation = cameraAnimationRef.current;

      if (animation) {
        window.cancelAnimationFrame(animation.frame);
      }
    },
    [],
  );

  const stationPointById = useMemo(
    () => new Map(stationPoints.map((point) => [point.station.id, point])),
    [],
  );
  const activeLine =
    customLines.find((line) => line.id === activeLineId) ?? customLines[0];
  const activeLineIndex = Math.max(
    0,
    customLines.findIndex((line) => line.id === activeLine.id),
  );
  const activeLineName = displayLineName(activeLine);
  const activeBranch =
    activeLine.branches.find((branch) => branch.id === activeLine.activeBranchId) ??
    activeLine.branches[0];
  const activeBranchIndex = Math.max(
    0,
    activeLine.branches.findIndex((branch) => branch.id === activeBranch.id),
  );
  const activeBranchName = displayBranchName(activeBranch);

  const selectedStationIdSet = useMemo(
    () => new Set(activeBranch.stationIds),
    [activeBranch.stationIds],
  );
  const createdStationInfoById = useMemo(() => {
    const stationInfo = new Map<
      string,
      { branch: CustomBranch; index: number; line: CustomLine }
    >();

    customLines.forEach((line) => {
      line.branches.forEach((branch) => {
        branch.stationIds.forEach((stationId, index) => {
          if (!stationInfo.has(stationId)) {
            stationInfo.set(stationId, { branch, index, line });
          }
        });
      });
    });

    return stationInfo;
  }, [customLines]);
  const selectedPoints = useMemo(
    () =>
      activeBranch.stationIds
        .map((stationId) => stationPointById.get(stationId))
        .filter((point): point is StationPoint => Boolean(point)),
    [activeBranch.stationIds, stationPointById],
  );
  const visibleLineRoutes = useMemo(
    () =>
      customLines.flatMap((line) =>
        line.branches.map((branch) => {
          const points = branch.stationIds
            .map((stationId) => stationPointById.get(stationId))
            .filter((point): point is StationPoint => Boolean(point));

          return {
            branch,
            line,
            points,
            routePoints: points
              .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
              .join(" "),
          };
        }),
      ),
    [customLines, stationPointById],
  );
  const exportLayout = useMemo(
    () => buildSchematicExportLayout(customLines, stationPointById),
    [customLines, stationPointById],
  );
  const exportLineRoutes = exportLayout.routes;
  const exportStationLineIdsById = useMemo(() => {
    const stationLines = new Map<string, Set<string>>();

    customLines.forEach((line) => {
      line.branches.forEach((branch) => {
        branch.stationIds.forEach((stationId) => {
          const lineIds = stationLines.get(stationId) ?? new Set<string>();
          lineIds.add(line.id);
          stationLines.set(stationId, lineIds);
        });
      });
    });

    return stationLines;
  }, [customLines]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return stationPoints
      .filter((point) =>
        point.station.name.toLowerCase().includes(query) ||
        point.station.lines.some((line) => line.toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [searchQuery]);
  const totalSelectedStations = customLines.reduce(
    (total, line) =>
      total +
      line.branches.reduce(
        (branchTotal, branch) => branchTotal + branch.stationIds.length,
        0,
      ),
    0,
  );
  const totalSegmentCount = customLines.reduce(
    (total, line) =>
      total +
      line.branches.reduce(
        (branchTotal, branch) =>
          branchTotal + Math.max(branch.stationIds.length - 1, 0),
        0,
      ),
    0,
  );
  const totalBranchCount = customLines.reduce(
    (total, line) => total + line.branches.length,
    0,
  );
  const legendLines = useMemo(
    () =>
      customLines.filter((line) =>
        line.branches.some((branch) => branch.stationIds.length > 0),
      ),
    [customLines],
  );

  const displayMapName =
    customLines.length === 1 ? activeLineName : "My Tube System";
  const canExport = totalSegmentCount > 0 && !isExporting;
  const mapViewBox = formatViewBox({
    height: MAP_HEIGHT / camera.zoom,
    width: MAP_WIDTH / camera.zoom,
    x: camera.x,
    y: camera.y,
  });
  const exportView = useMemo(
    () => ({ height: MAP_HEIGHT, width: MAP_WIDTH, x: 0, y: 0 }),
    [],
  );
  const exportViewBox = formatViewBox(exportView);
  const exportUiScale = exportView.width / MAP_WIDTH;
  const canZoomOut = camera.zoom > MIN_ZOOM;
  const canZoomIn = camera.zoom < MAX_ZOOM;
  const visibleTiles = useMemo(() => mapTilesForCamera(camera), [camera]);
  const latestSelectedStationId =
    activeBranch.stationIds[activeBranch.stationIds.length - 1] ?? null;
  const canCentreLatestStation = Boolean(latestSelectedStationId);
  const canFitActiveBranch = selectedPoints.length > 0;

  function cancelCameraAnimation() {
    const animation = cameraAnimationRef.current;

    if (!animation) {
      return;
    }

    window.cancelAnimationFrame(animation.frame);
    cameraAnimationRef.current = null;
  }

  function animateCameraTo(nextCamera: MapCamera, options = { force: false }) {
    const targetCamera = clampCamera(nextCamera);
    const current = cameraRef.current;

    if (
      !options.force &&
      Math.abs(current.x - targetCamera.x) < 0.25 &&
      Math.abs(current.y - targetCamera.y) < 0.25 &&
      Math.abs(current.zoom - targetCamera.zoom) < 0.01
    ) {
      return;
    }

    if (cameraAnimationRef.current) {
      return;
    }

    const startedAt = window.performance.now();
    const startCamera = current;
    const animationState: CameraAnimationState = {
      frame: 0,
      to: targetCamera,
    };
    const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
    const step = (timestamp: number) => {
      const progress = Math.min(
        1,
        (timestamp - startedAt) / CAMERA_ANIMATION_MS,
      );
      const eased = easeOutCubic(progress);
      const nextFrameCamera = clampCamera({
        zoom:
          startCamera.zoom +
          (animationState.to.zoom - startCamera.zoom) * eased,
        x: startCamera.x + (animationState.to.x - startCamera.x) * eased,
        y: startCamera.y + (animationState.to.y - startCamera.y) * eased,
      });

      setCamera(nextFrameCamera);

      if (progress < 1) {
        animationState.frame = window.requestAnimationFrame(step);
        return;
      }

      cameraAnimationRef.current = null;
      cameraRef.current = animationState.to;
      setCamera(animationState.to);
    };

    cameraAnimationRef.current = animationState;
    animationState.frame = window.requestAnimationFrame(step);
  }

  function stationCameraTarget(
    point: StationPoint,
    options: { force?: boolean; zoom?: number } = {},
  ) {
    const current = cameraRef.current;
    const zoom = options.zoom ?? current.zoom;
    const viewWidth = MAP_WIDTH / zoom;
    const viewHeight = MAP_HEIGHT / zoom;
    const safeLeft = current.x + viewWidth * CAMERA_SAFE_PADDING;
    const safeRight = current.x + viewWidth * (1 - CAMERA_SAFE_PADDING);
    const safeTop = current.y + viewHeight * CAMERA_SAFE_PADDING;
    const safeBottom = current.y + viewHeight * (1 - CAMERA_SAFE_PADDING);
    const isInsideSafeArea =
      point.x >= safeLeft &&
      point.x <= safeRight &&
      point.y >= safeTop &&
      point.y <= safeBottom;

    if (!options.force && zoom === current.zoom && isInsideSafeArea) {
      return null;
    }

    return clampCamera({
      zoom,
      x: point.x - viewWidth * 0.46,
      y: point.y - viewHeight * 0.48,
    });
  }

  function clientPointToMapPoint(clientX: number, clientY: number) {
    const mapRect = mapRef.current?.getBoundingClientRect();
    const current = cameraRef.current;

    if (!mapRect) {
      return null;
    }

    const viewWidth = MAP_WIDTH / current.zoom;
    const viewHeight = MAP_HEIGHT / current.zoom;

    return {
      mapPoint: {
        x: current.x + ((clientX - mapRect.left) / mapRect.width) * viewWidth,
        y: current.y + ((clientY - mapRect.top) / mapRect.height) * viewHeight,
      },
      rect: mapRect,
      viewHeight,
      viewWidth,
    };
  }

  function nearestMobileStation(clientX: number, clientY: number) {
    const pointDetails = clientPointToMapPoint(clientX, clientY);

    if (!pointDetails) {
      return null;
    }

    const { mapPoint, rect, viewHeight, viewWidth } = pointDetails;
    const xScale = rect.width / viewWidth;
    const yScale = rect.height / viewHeight;
    const nearest = stationPoints
      .filter(
        (point) =>
          cameraRef.current.zoom >= STATION_MARKER_ZOOM ||
          selectedStationIdSet.has(point.station.id) ||
          highlightedStationId === point.station.id,
      )
      .map((point) => {
        const distance = Math.hypot(
          (point.x - mapPoint.x) * xScale,
          (point.y - mapPoint.y) * yScale,
        );

        return { distance, point };
      })
      .sort((first, second) => first.distance - second.distance)[0];

    return nearest && nearest.distance <= MOBILE_TAP_TARGET_RADIUS
      ? nearest.point
      : null;
  }

  function zoomTo(nextZoom: number, clientX?: number, clientY?: number) {
    cancelCameraAnimation();
    setCamera((current) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const currentViewWidth = MAP_WIDTH / current.zoom;
      const currentViewHeight = MAP_HEIGHT / current.zoom;
      const nextViewWidth = MAP_WIDTH / zoom;
      const nextViewHeight = MAP_HEIGHT / zoom;
      const mapRect = mapRef.current?.getBoundingClientRect();
      const hasPointerFocus =
        mapRect && clientX !== undefined && clientY !== undefined;
      const focusRatioX = hasPointerFocus
        ? (clientX - mapRect.left) / mapRect.width
        : 0.5;
      const focusRatioY = hasPointerFocus
        ? (clientY - mapRect.top) / mapRect.height
        : 0.5;
      const focusX = current.x + focusRatioX * currentViewWidth;
      const focusY = current.y + focusRatioY * currentViewHeight;

      return clampCamera({
        zoom,
        x: focusX - focusRatioX * nextViewWidth,
        y: focusY - focusRatioY * nextViewHeight,
      });
    });
  }

  function zoomBy(amount: number) {
    zoomTo(camera.zoom + amount);
  }

  function resetMapView() {
    cancelCameraAnimation();
    setCamera(centralLondonCamera());
    setStatusMessage("Map centred on central London.");
  }

  function centreLatestSelectedStation() {
    if (!latestSelectedStationId) {
      return;
    }

    focusStationOnMap(latestSelectedStationId, {
      force: true,
      preserveZoom: true,
      updateSearch: false,
    });
  }

  function fitActiveBranch() {
    if (selectedPoints.length === 0) {
      return;
    }

    if (selectedPoints.length === 1) {
      focusStationOnMap(selectedPoints[0].station.id, {
        force: true,
        preserveZoom: true,
        updateSearch: false,
      });
      setStatusMessage(`${selectedPoints[0].station.name} centred.`);
      return;
    }

    const minX = Math.min(...selectedPoints.map((point) => point.x));
    const maxX = Math.max(...selectedPoints.map((point) => point.x));
    const minY = Math.min(...selectedPoints.map((point) => point.y));
    const maxY = Math.max(...selectedPoints.map((point) => point.y));
    const routeWidth = Math.max(maxX - minX, 1);
    const routeHeight = Math.max(maxY - minY, 1);
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((MAP_WIDTH * 0.68) / routeWidth, (MAP_HEIGHT * 0.68) / routeHeight),
      ),
    );
    const viewWidth = MAP_WIDTH / zoom;
    const viewHeight = MAP_HEIGHT / zoom;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    animateCameraTo(
      {
        zoom,
        x: centerX - viewWidth / 2,
        y: centerY - viewHeight / 2,
      },
      { force: true },
    );
    setStatusMessage(`${activeBranchName} fitted on the map.`);
  }

  function handleMapWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const nextZoom = camera.zoom * (event.deltaY > 0 ? 0.86 : 1.16);

    zoomTo(nextZoom, event.clientX, event.clientY);
  }

  function getPinchDetails() {
    const pointers = Array.from(activePointersRef.current.values());

    if (pointers.length < 2) {
      return null;
    }

    const [first, second] = pointers;
    const deltaX = second.clientX - first.clientX;
    const deltaY = second.clientY - first.clientY;

    return {
      centerX: (first.clientX + second.clientX) / 2,
      centerY: (first.clientY + second.clientY) / 2,
      distance: Math.hypot(deltaX, deltaY),
    };
  }

  function cameraZoomedFrom(
    startCamera: MapCamera,
    nextZoom: number,
    clientX: number,
    clientY: number,
  ) {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const currentViewWidth = MAP_WIDTH / startCamera.zoom;
    const currentViewHeight = MAP_HEIGHT / startCamera.zoom;
    const nextViewWidth = MAP_WIDTH / zoom;
    const nextViewHeight = MAP_HEIGHT / zoom;
    const mapRect = mapRef.current?.getBoundingClientRect();
    const focusRatioX = mapRect ? (clientX - mapRect.left) / mapRect.width : 0.5;
    const focusRatioY = mapRect ? (clientY - mapRect.top) / mapRect.height : 0.5;
    const focusX = startCamera.x + focusRatioX * currentViewWidth;
    const focusY = startCamera.y + focusRatioY * currentViewHeight;

    return clampCamera({
      zoom,
      x: focusX - focusRatioX * nextViewWidth,
      y: focusY - focusRatioY * nextViewHeight,
    });
  }

  function handleMapPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    cancelCameraAnimation();
    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (activePointersRef.current.size >= 2) {
      const pinch = getPinchDetails();

      if (pinch) {
        pinchRef.current = {
          moved: false,
          startCamera: camera,
          startCenterX: pinch.centerX,
          startCenterY: pinch.centerY,
          startDistance: pinch.distance,
        };
        dragRef.current = null;
        setIsPanning(true);
      }

      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: camera.x,
      startY: camera.y,
      startZoom: camera.zoom,
      moved: false,
    };
    setIsPanning(true);
  }

  function handleMapPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    const pinch = pinchRef.current;

    if (pinch) {
      const nextPinch = getPinchDetails();

      if (!nextPinch || pinch.startDistance === 0) {
        return;
      }

      const distanceRatio = nextPinch.distance / pinch.startDistance;
      const centerMoved = Math.hypot(
        nextPinch.centerX - pinch.startCenterX,
        nextPinch.centerY - pinch.startCenterY,
      );

      if (!pinch.moved && Math.abs(distanceRatio - 1) < 0.03 && centerMoved < 5) {
        return;
      }

      pinch.moved = true;
      setCamera(
        cameraZoomedFrom(
          pinch.startCamera,
          pinch.startCamera.zoom * distanceRatio,
          nextPinch.centerX,
          nextPinch.centerY,
        ),
      );
      return;
    }

    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;
    const dragThreshold = event.pointerType === "touch" ? 10 : 4;

    if (!drag.moved && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return;
    }

    drag.moved = true;
    const mapRect = mapRef.current?.getBoundingClientRect();

    if (!mapRect) {
      return;
    }

    const viewWidth = MAP_WIDTH / drag.startZoom;
    const viewHeight = MAP_HEIGHT / drag.startZoom;

    setCamera(
      clampCamera({
        zoom: drag.startZoom,
        x: drag.startX - deltaX * (viewWidth / mapRect.width),
        y: drag.startY - deltaY * (viewHeight / mapRect.height),
      }),
    );
  }

  function endMapDrag(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const pinch = pinchRef.current;

    activePointersRef.current.delete(event.pointerId);

    if (pinch) {
      if (pinch.moved) {
        skipStationClickRef.current = true;
        window.setTimeout(() => {
          skipStationClickRef.current = false;
        }, 0);
      }

      if (activePointersRef.current.size < 2) {
        pinchRef.current = null;
        dragRef.current = null;
        setIsPanning(false);
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      return;
    }

    if (!drag || drag.pointerId !== event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if (drag.moved) {
      skipStationClickRef.current = true;
      window.setTimeout(() => {
        skipStationClickRef.current = false;
      }, 0);
    } else if (isMobileViewport) {
      const nearestStation = nearestMobileStation(event.clientX, event.clientY);

      if (nearestStation) {
        skipStationClickRef.current = true;
        event.preventDefault();
        addStation(nearestStation.station.id);
        window.setTimeout(() => {
          skipStationClickRef.current = false;
        }, 350);
      }
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setIsPanning(false);
  }

  function handleMapClick(event: MouseEvent<SVGSVGElement>) {
    if (!isMobileViewport || skipStationClickRef.current) {
      return;
    }

    const nearestStation = nearestMobileStation(event.clientX, event.clientY);

    if (!nearestStation) {
      return;
    }

    event.preventDefault();
    addStation(nearestStation.station.id);
  }

  function updateActiveLine(updater: (line: CustomLine) => CustomLine) {
    setCustomLines((current) =>
      current.map((line) => (line.id === activeLine.id ? updater(line) : line)),
    );
  }

  function updateActiveBranch(updater: (branch: CustomBranch) => CustomBranch) {
    updateActiveLine((line) => ({
      ...line,
      branches: line.branches.map((branch) =>
        branch.id === activeBranch.id ? updater(branch) : branch,
      ),
    }));
  }

  function focusStation(stationId: string) {
    focusStationOnMap(stationId, {
      force: true,
      preserveZoom: false,
      updateSearch: true,
    });
  }

  function focusStationOnMap(
    stationId: string,
    options: {
      force?: boolean;
      preserveZoom?: boolean;
      updateSearch?: boolean;
    } = {},
  ) {
    const point = stationPointById.get(stationId);

    if (!point) {
      return;
    }

    const current = cameraRef.current;
    const zoom = options.preserveZoom
      ? current.zoom
      : Math.max(current.zoom, SEARCH_ZOOM);
    const targetCamera = stationCameraTarget(point, {
      force: options.force,
      zoom,
    });

    if (targetCamera) {
      animateCameraTo(targetCamera, { force: Boolean(options.force) });
    }

    setHighlightedStationId(stationId);
    if (options.updateSearch ?? true) {
      setSearchQuery(point.station.name);
    }
    setStatusMessage(`${point.station.name} located on the map.`);
  }

  function findStationFromSearch() {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      setStatusMessage("Type a station name to search.");
      return;
    }

    const exactMatch = stationPoints.find(
      (point) => point.station.name.toLowerCase() === query,
    );
    const partialMatch = searchResults[0];
    const match = exactMatch ?? partialMatch;

    if (!match) {
      setStatusMessage("No matching station found.");
      return;
    }

    focusStation(match.station.id);
  }

  function createNewLine() {
    setCustomLines((current) => {
      const nextLine = makeLine(`line-${Date.now()}`, current.length);

      setActiveLineId(nextLine.id);
      setStatusMessage(`${displayLineName(nextLine)} created.`);

      return [...current, nextLine];
    });
  }

  function removeActiveLine() {
    if (customLines.length === 1) {
      const branch = makeBranch(`${activeLine.id}-branch-1`, 0);

      updateActiveLine((line) => ({
        ...line,
        activeBranchId: branch.id,
        branches: [branch],
      }));
      setStatusMessage(`${activeLineName} cleared.`);
      return;
    }

    setCustomLines((current) => {
      const nextLines = current.filter((line) => line.id !== activeLine.id);
      const nextActiveLine = nextLines[Math.max(0, activeLineIndex - 1)];

      setActiveLineId(nextActiveLine.id);
      setStatusMessage(`${activeLineName} removed.`);

      return nextLines;
    });
  }

  function createNewBranch() {
    updateActiveLine((line) => {
      const nextBranch = makeBranch(
        `${line.id}-branch-${Date.now()}`,
        line.branches.length,
      );

      setStatusMessage(`${displayBranchName(nextBranch)} created on ${activeLineName}.`);

      return {
        ...line,
        activeBranchId: nextBranch.id,
        branches: [...line.branches, nextBranch],
      };
    });
  }

  function removeActiveBranch() {
    if (activeLine.branches.length === 1) {
      updateActiveBranch((branch) => ({ ...branch, stationIds: [] }));
      setStatusMessage(`${activeBranchName} cleared.`);
      return;
    }

    updateActiveLine((line) => {
      const nextBranches = line.branches.filter(
        (branch) => branch.id !== activeBranch.id,
      );
      const nextActiveBranch = nextBranches[Math.max(0, activeBranchIndex - 1)];

      setStatusMessage(`${activeBranchName} removed from ${activeLineName}.`);

      return {
        ...line,
        activeBranchId: nextActiveBranch.id,
        branches: nextBranches,
      };
    });
  }

  function addStation(stationId: string) {
    if (selectedStationIdSet.has(stationId)) {
      setStatusMessage("That station is already on this branch.");
      return;
    }

    const station = stationPointById.get(stationId)?.station;
    updateActiveBranch((branch) => ({
      ...branch,
      stationIds: [...branch.stationIds, stationId],
    }));
    focusStationOnMap(stationId, {
      preserveZoom: true,
      updateSearch: false,
    });
    setStatusMessage(
      station
        ? `${station.name} added to ${activeLineName} / ${activeBranchName}.`
        : `Station added to ${activeLineName} / ${activeBranchName}.`,
    );
  }

  function handleStationKeyDown(
    event: KeyboardEvent<SVGGElement>,
    stationId: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      addStation(stationId);
    }
  }

  function undoLastStation() {
    updateActiveBranch((branch) => {
      const removedStationId = branch.stationIds[branch.stationIds.length - 1];
      const removedStation = removedStationId
        ? stationPointById.get(removedStationId)?.station
        : null;

      if (removedStation) {
        setStatusMessage(
          `${removedStation.name} removed from ${activeLineName} / ${activeBranchName}.`,
        );
      }

      return { ...branch, stationIds: branch.stationIds.slice(0, -1) };
    });
  }

  function resetLine() {
    updateActiveBranch((branch) => ({ ...branch, stationIds: [] }));
    setStatusMessage(`${activeLineName} / ${activeBranchName} reset.`);
  }

  async function createPngBlob() {
    const svg = exportMapRef.current;

    if (!svg) {
      throw new Error("Map is not ready");
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(EXPORT_WIDTH));
    clone.setAttribute("height", String(EXPORT_HEIGHT));
    clone.setAttribute("viewBox", exportViewBox);

    const source = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      const loadedImage = new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Map image failed to render"));
      });

      image.src = svgUrl;
      await loadedImage;

      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_WIDTH;
      canvas.height = EXPORT_HEIGHT;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas is not available");
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("PNG export failed"));
          }
        }, "image/png");
      });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function downloadBlob(blob: Blob) {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `${slugifyLineName(displayMapName)}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  async function downloadMap() {
    setIsExporting(true);
    setStatusMessage("Preparing PNG...");

    try {
      const pngBlob = await createPngBlob();
      downloadBlob(pngBlob);
      setStatusMessage("PNG downloaded.");
    } catch {
      setStatusMessage("PNG export failed in this browser.");
    } finally {
      setIsExporting(false);
    }
  }

  async function shareMap() {
    setIsExporting(true);
    setStatusMessage("Preparing share image...");

    try {
      const pngBlob = await createPngBlob();
      const file = new File([pngBlob], `${slugifyLineName(displayMapName)}.png`, {
        type: "image/png",
      });
      const shareData: ShareData = {
        title: displayMapName,
        text: `I made ${displayMapName} with Custom Tube Map Maker.`,
        files: [file],
      };
      const navigatorWithShare = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (navigator.share && navigatorWithShare.canShare?.(shareData)) {
        await navigator.share(shareData);
        setStatusMessage("Map shared.");
      } else {
        downloadBlob(pngBlob);
        setStatusMessage("Sharing is not available here, so the PNG downloaded.");
      }
    } catch {
      setStatusMessage("Sharing failed in this browser.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleStationClick(
    event: MouseEvent<SVGGElement>,
    stationId: string,
  ) {
    event.stopPropagation();

    if (skipStationClickRef.current) {
      event.preventDefault();
      return;
    }

    addStation(stationId);
  }

  function handleStationPointerDown(event: PointerEvent<SVGGElement>) {
    event.stopPropagation();
  }

  function renderMapContent(
    uiScale: number,
    ids: { description: string; grid: string; title: string },
    options: {
      interactive: boolean;
      showGuideLines: boolean;
      showLegend: boolean;
      showTiles: boolean;
      stationMode: "all" | "created";
      view?: MapView;
    },
  ) {
    const renderedStationPoints =
      options.stationMode === "created"
        ? exportLayout.stationPoints
        : stationPoints;
    const sortedRenderedStationPoints = options.interactive
      ? [...renderedStationPoints].sort((first, second) => {
          const firstSelected = selectedStationIdSet.has(first.station.id);
          const secondSelected = selectedStationIdSet.has(second.station.id);
          const firstHighlighted = highlightedStationId === first.station.id;
          const secondHighlighted = highlightedStationId === second.station.id;

          return (
            Number(firstSelected) - Number(secondSelected) ||
            Number(firstHighlighted) - Number(secondHighlighted)
          );
        })
      : renderedStationPoints;
    const renderedLineRoutes =
      options.stationMode === "created" ? exportLineRoutes : visibleLineRoutes;
    const legendScale = options.view ? options.view.width / EXPORT_WIDTH : uiScale;
    const legendX = options.view ? options.view.x + 24 * legendScale : 24;
    const legendY = options.view ? options.view.y + 24 * legendScale : 24;
    const legendWidth = 330 * legendScale;
    const legendEntries = legendLines.map((line) => {
      const activeBranches = line.branches.filter(
        (branch) => branch.stationIds.length > 0,
      );

      return {
        branchSummary:
          activeBranches.length > 1
            ? activeBranches
                .map((branch) => displayBranchName(branch))
                .join(" / ")
                .slice(0, 42)
            : "",
        line,
      };
    });
    const legendHeight =
      (68 +
        legendEntries.reduce(
          (total, entry) => total + (entry.branchSummary ? 43 : 31),
          0,
        ) +
        25) *
      legendScale;

    return (
      <>
        <title id={ids.title}>{displayMapName}</title>
        <desc id={ids.description}>
          A custom London transport style map with station dots, station labels,
          and a user-created line.
        </desc>
        <defs>
          <pattern
            id={ids.grid}
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="#d9e2ea"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="0" fill="#e1e9ef" />
        {options.showTiles ? (
          <>
            <g className="osm-tile-layer">
              {visibleTiles.map((tile) => (
                <image
                  height={tile.height}
                  href={tile.href}
                  key={tile.key}
                  preserveAspectRatio="none"
                  width={tile.width}
                  x={tile.x}
                  y={tile.y}
                />
              ))}
            </g>
            <rect
              className="map-basemap-tint"
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill="#ffffff"
              opacity="0.18"
            />
          </>
        ) : (
          <>
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="0" fill="#fbfcf8" />
            {options.stationMode === "created" ? null : (
              <rect
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                fill={`url(#${ids.grid})`}
                opacity="0.9"
              />
            )}
            {options.showGuideLines ? (
              <>
                <path
                  d="M 84 596 C 250 500 386 398 492 302 C 610 196 730 156 918 108"
                  fill="none"
                  stroke="#0098d4"
                  strokeLinecap="round"
                  strokeWidth={5 * uiScale}
                  opacity="0.22"
                />
                <path
                  d="M 134 130 C 272 188 374 236 484 322 C 626 432 744 500 902 568"
                  fill="none"
                  stroke="#00782a"
                  strokeLinecap="round"
                  strokeWidth={5 * uiScale}
                  opacity="0.22"
                />
                <path
                  d="M 176 526 C 286 424 394 374 514 358 C 664 338 784 278 902 196"
                  fill="none"
                  stroke="#ee7c0e"
                  strokeLinecap="round"
                  strokeWidth={5 * uiScale}
                  opacity="0.2"
                />
              </>
            ) : null}
          </>
        )}

        <g>
          {renderedLineRoutes.map((route) => {
            const isActiveRoute =
              !options.interactive ||
              (route.line.id === activeLine.id &&
                route.branch.id === activeBranch.id);
            const isExport = options.stationMode === "created";

            return route.points.length > 1 ? (
              <g key={`${route.line.id}-${route.branch.id}`}>
                <title>
                  {`${displayLineName(route.line)} - ${displayBranchName(
                    route.branch,
                  )}`}
                </title>
                <polyline
                  points={route.routePoints}
                  fill="none"
                  stroke="#fbfcf8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={(isExport ? 13 : 23) * uiScale}
                />
                {isExport ? null : (
                  <polyline
                    points={route.routePoints}
                    fill="none"
                    stroke="#111827"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={17 * uiScale}
                    opacity={isActiveRoute ? "0.24" : "0.14"}
                  />
                )}
                <polyline
                  points={route.routePoints}
                  fill="none"
                  stroke={route.line.colour}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={
                    (isExport ? 7.2 : isActiveRoute ? 13 : 10) * uiScale
                  }
                  opacity={isActiveRoute ? "1" : "0.82"}
                />
              </g>
            ) : null;
          })}
        </g>

        <g>
          {sortedRenderedStationPoints.map((point) => {
            const createdStationInfo = createdStationInfoById.get(
              point.station.id,
            );
            const stationInfo = createdStationInfo;
            const sharedLineCount =
              options.stationMode === "created"
                ? exportStationLineIdsById.get(point.station.id)?.size ?? 0
                : 0;
            const isInterchange =
              options.stationMode === "created" && sharedLineCount > 1;
            const isSelected =
              options.stationMode === "created"
                ? Boolean(stationInfo)
                : selectedStationIdSet.has(point.station.id);
            const selectedIndex =
              options.stationMode === "created"
                ? stationInfo?.index ?? -1
                : activeBranch.stationIds.indexOf(point.station.id);
            const selectedLineColour =
              options.stationMode === "created"
                ? point.stationLines?.[0]?.colour ??
                  stationInfo?.line.colour ??
                  activeLine.colour
                : activeLine.colour;
            const isHighlighted =
              options.interactive && highlightedStationId === point.station.id;
            const showStationMarker =
              !options.interactive ||
              camera.zoom >= STATION_MARKER_ZOOM ||
              isSelected ||
              isHighlighted;
            const showStationLabel =
              !options.interactive ||
              camera.zoom >= STATION_LABEL_ZOOM ||
              isHighlighted ||
              (isSelected && camera.zoom >= SELECTED_LABEL_ZOOM);
            const labelDx = point.labelDx;
            const labelDy = point.labelDy;
            const labelAnchor = point.labelAnchor;
            const labelX = point.x + labelDx * uiScale;
            const labelY = point.y + labelDy * uiScale;
            const labelFontSize =
              options.stationMode === "created" ? 13 : isSelected ? 15 : 12;
            const stationInteractionProps = options.interactive
              ? {
                  "aria-label": isSelected
                    ? `${point.station.name} selected`
                    : `Add ${point.station.name}`,
                  "aria-pressed": isSelected,
                  onClick: isMobileViewport
                    ? undefined
                    : (event: MouseEvent<SVGGElement>) =>
                        handleStationClick(event, point.station.id),
                  onKeyDown: (event: KeyboardEvent<SVGGElement>) =>
                    handleStationKeyDown(event, point.station.id),
                  onPointerDown: isMobileViewport
                    ? undefined
                    : handleStationPointerDown,
                  role: "button",
                  tabIndex: 0,
                }
              : {};

            if (!showStationMarker && !showStationLabel) {
              return null;
            }

            return (
              <g
                key={point.renderKey ?? point.station.id}
                className={
                  [
                    "station-node",
                    isSelected ? "station-node-selected" : "",
                    isHighlighted ? "station-node-highlighted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                {...stationInteractionProps}
              >
                <title>
                  {`${point.station.name} - ${point.station.lines.join(", ")}`}
                </title>
                {showStationMarker ? (
                  <>
                    <circle
                      className="station-hit-area"
                      cx={point.x}
                      cy={point.y}
                      r={
                        (options.interactive && isMobileViewport
                          ? 64
                          : isSelected
                            ? 13
                            : 10) * uiScale
                      }
                      fill="transparent"
                      stroke="transparent"
                    />
                    <circle
                      className="station-marker"
                      cx={point.x}
                      cy={point.y}
                      r={
                        (options.stationMode === "created"
                          ? isInterchange
                            ? 7.2
                            : 5.4
                          : isSelected
                            ? 11
                            : 6.5) * uiScale
                      }
                      fill={
                        isInterchange
                          ? "#ffffff"
                          : isSelected
                            ? selectedLineColour
                            : "#ffffff"
                      }
                      stroke={
                        isSelected ? "#111827" : "#253040"
                      }
                      strokeWidth={
                        (isHighlighted
                          ? 4
                          : options.stationMode === "created"
                            ? isInterchange
                              ? 2.5
                              : 2
                            : isSelected
                              ? 3
                              : 2) * uiScale
                      }
                    />
                  </>
                ) : null}
                {isSelected && options.interactive ? (
                  <text
                    x={point.x}
                    y={point.y + 4.5 * uiScale}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize={12 * uiScale}
                    fontWeight="900"
                  >
                    {selectedIndex + 1}
                  </text>
                ) : null}
                {showStationLabel ? (
                  <text
                    className="station-label"
                    x={labelX}
                    y={labelY}
                    textAnchor={labelAnchor}
                    fill={isSelected ? "#111827" : "#253040"}
                    stroke="#fbfcf8"
                    strokeWidth={5 * uiScale}
                    paintOrder="stroke"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize={labelFontSize * uiScale}
                    fontWeight={isSelected ? 900 : 700}
                  >
                    {point.station.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        {options.showLegend && legendLines.length > 0 ? (
          <g>
            <rect
              x={legendX}
              y={legendY}
              width={legendWidth}
              height={legendHeight}
              rx={8 * legendScale}
              fill="#fbfcf8"
              opacity="0.94"
              stroke="#ccd7e1"
              strokeWidth={1.4 * legendScale}
            />
            <text
              x={legendX + 18 * legendScale}
              y={legendY + 28 * legendScale}
              fill="#111827"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={15 * legendScale}
              fontWeight="900"
            >
              Line legend
            </text>
            {legendEntries.map((entry, index) => {
              const rowOffset = legendEntries
                .slice(0, index)
                .reduce(
                  (total, previousEntry) =>
                    total + (previousEntry.branchSummary ? 43 : 31),
                  52,
                );
              const entryY = legendY + rowOffset * legendScale;

              return (
                <g key={`legend-${entry.line.id}`}>
                  <line
                    x1={legendX + 18 * legendScale}
                    x2={legendX + 76 * legendScale}
                    y1={entryY}
                    y2={entryY}
                    stroke={entry.line.colour}
                    strokeLinecap="round"
                    strokeWidth={8 * legendScale}
                  />
                  <text
                    x={legendX + 90 * legendScale}
                    y={entryY + 5 * legendScale}
                    fill="#111827"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontSize={14 * legendScale}
                    fontWeight="800"
                  >
                    {displayLegendLineName(entry.line)}
                  </text>
                  {entry.branchSummary ? (
                    <text
                      x={legendX + 90 * legendScale}
                      y={entryY + 23 * legendScale}
                      fill="#526071"
                      fontFamily="Arial, Helvetica, sans-serif"
                      fontSize={10.5 * legendScale}
                      fontWeight="700"
                    >
                      {entry.branchSummary}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <circle
              cx={legendX + 28 * legendScale}
              cy={
                legendY +
                (legendEntries.reduce(
                  (total, entry) => total + (entry.branchSummary ? 43 : 31),
                  58,
                ) *
                  legendScale)
              }
              r={6 * legendScale}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth={2 * legendScale}
            />
            <text
              x={legendX + 46 * legendScale}
              y={
                legendY +
                (legendEntries.reduce(
                  (total, entry) => total + (entry.branchSummary ? 43 : 31),
                  63,
                ) *
                  legendScale)
              }
              fill="#526071"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize={11.5 * legendScale}
              fontWeight="800"
            >
              multi-line interchange
            </text>
          </g>
        ) : null}

        <text
          x={MAP_WIDTH - 28}
          y={MAP_HEIGHT - 24}
          textAnchor="end"
          fill="#64748b"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="700"
        >
          Unofficial fan map. Not affiliated with Transport for London.
        </text>
      </>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <Link className="wordmark" href="/" aria-label="Custom Tube Map Maker home">
          <span className="roundel" aria-hidden="true" />
          <span>Custom Tube Map Maker</span>
        </Link>
        <p>Unofficial fan-made London line builder</p>
      </header>

      <section className="maker-layout" aria-label="Custom Tube line builder">
        <div className="map-panel">
          <div className="map-toolbar">
            <div>
              <p className="panel-kicker">Live map</p>
              <h1>{displayMapName}</h1>
            </div>
            <div className="map-stats" aria-label="Map statistics">
              <span>
                <strong>{stations.length}</strong> stations
              </span>
              <span>
                <strong>{customLines.length}</strong> lines
              </span>
              <span>
                <strong>{totalBranchCount}</strong> branches
              </span>
              <span>
                <strong>{totalSelectedStations}</strong> chosen
              </span>
            </div>
          </div>

          <div className="mobile-map-search">
            <form
              className="station-search"
              onSubmit={(event) => {
                event.preventDefault();
                findStationFromSearch();
              }}
            >
              <label className="field-label" htmlFor="mobile-station-search">
                Find station
              </label>
              <div className="search-row">
                <input
                  id="mobile-station-search"
                  className="text-field"
                  list="station-search-options"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search station or line"
                  type="search"
                  value={searchQuery}
                />
                <button className="tool-button" type="submit">
                  Find
                </button>
              </div>
            </form>
            {searchResults.length > 0 ? (
              <div className="search-results" aria-label="Station search results">
                {searchResults.map((point) => (
                  <button
                    key={`mobile-${point.station.id}`}
                    onClick={() => focusStation(point.station.id)}
                    type="button"
                  >
                    <strong>{point.station.name}</strong>
                    <span>{point.station.lines.join(", ")}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="map-canvas" aria-label="Station map canvas">
            <div className="map-navigation" aria-label="Map navigation">
              <button
                className="map-control-button"
                aria-label="Zoom out"
                disabled={!canZoomOut}
                onClick={() => zoomBy(-ZOOM_STEP)}
                title="Zoom out"
                type="button"
              >
                -
              </button>
              <span className="desktop-map-zoom-label" aria-live="polite">Zoom</span>
              <button
                className="map-control-button"
                aria-label="Zoom in"
                disabled={!canZoomIn}
                onClick={() => zoomBy(ZOOM_STEP)}
                title="Zoom in"
                type="button"
              >
                +
              </button>
              <button
                className="desktop-map-centre"
                aria-label="Centre on London"
                onClick={resetMapView}
                title="Centre on London"
                type="button"
              >
                Centre
              </button>
              <button
                className="mobile-map-control"
                aria-label="Centre on latest selected station"
                disabled={!canCentreLatestStation}
                onClick={centreLatestSelectedStation}
                title="Centre on latest selected station"
                type="button"
              >
                ◎
              </button>
              <button
                className="mobile-map-control"
                aria-label="Fit current branch"
                disabled={!canFitActiveBranch}
                onClick={fitActiveBranch}
                title="Fit current branch"
                type="button"
              >
                ↗
              </button>
            </div>
            <svg
              ref={mapRef}
              className={isPanning ? "tube-map tube-map-panning" : "tube-map"}
              viewBox={mapViewBox}
              preserveAspectRatio="none"
              role="img"
              aria-labelledby="map-title map-description"
              onClick={handleMapClick}
              onPointerCancel={endMapDrag}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={endMapDrag}
              onWheel={handleMapWheel}
            >
              {renderMapContent(
                1 / camera.zoom,
                {
                  description: "map-description",
                  grid: "map-grid",
                  title: "map-title",
                },
                {
                  interactive: true,
                  showGuideLines: false,
                  showLegend: false,
                  showTiles: true,
                  stationMode: "all",
                },
              )}
            </svg>
            <div className="osm-attribution">
              <a href="https://www.openstreetmap.org/copyright">
                © OpenStreetMap contributors
              </a>
              <a href="https://www.openstreetmap.org/fixthemap">
                Report a map issue
              </a>
            </div>
            <svg
              ref={exportMapRef}
              aria-hidden="true"
              className="export-map-source"
              height={EXPORT_HEIGHT}
              viewBox={exportViewBox}
              width={EXPORT_WIDTH}
              xmlns="http://www.w3.org/2000/svg"
            >
              {renderMapContent(
                exportUiScale,
                {
                  description: "export-map-description",
                  grid: "export-map-grid",
                  title: "export-map-title",
                },
                {
                  interactive: false,
                  showGuideLines: false,
                  showLegend: true,
                  showTiles: false,
                  stationMode: "created",
                  view: exportView,
                },
              )}
            </svg>
          </div>
        </div>

        <aside className="control-panel" aria-label="Line controls">
          <div className="control-section search-section">
            <form
              className="station-search"
              onSubmit={(event) => {
                event.preventDefault();
                findStationFromSearch();
              }}
            >
              <label className="field-label" htmlFor="station-search">
                Find station
              </label>
              <div className="search-row">
                <input
                  id="station-search"
                  className="text-field"
                  list="station-search-options"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search station or line"
                  type="search"
                  value={searchQuery}
                />
                <button className="tool-button" type="submit">
                  Find
                </button>
              </div>
              <datalist id="station-search-options">
                {stations.map((station) => (
                  <option key={station.id} value={station.name} />
                ))}
              </datalist>
            </form>
            {searchResults.length > 0 ? (
              <div className="search-results" aria-label="Station search results">
                {searchResults.map((point) => (
                  <button
                    key={point.station.id}
                    onClick={() => focusStation(point.station.id)}
                    type="button"
                  >
                    <strong>{point.station.name}</strong>
                    <span>{point.station.lines.join(", ")}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="control-section lines-section">
            <div className="selected-heading">
              <span>Custom lines</span>
              <strong>{customLines.length}</strong>
            </div>
            <div className="line-tabs" aria-label="Custom line list">
              {customLines.map((line) => (
                <button
                  aria-pressed={line.id === activeLine.id}
                  key={line.id}
                  onClick={() => setActiveLineId(line.id)}
                  type="button"
                >
                  <span
                    className="line-chip"
                    style={{ backgroundColor: line.colour } as CSSProperties}
                  />
                  <span>
                    {displayLineName(line)}
                    <em>{`${line.branches.length} branch${
                      line.branches.length === 1 ? "" : "es"
                    }`}</em>
                  </span>
                </button>
              ))}
            </div>
            <div className="control-row line-actions">
              <button className="tool-button" onClick={createNewLine} type="button">
                Add line
              </button>
              <button
                className="tool-button"
                onClick={removeActiveLine}
                type="button"
              >
                {customLines.length === 1 ? "Clear line" : "Remove line"}
              </button>
            </div>
          </div>

          <div className="control-section branches-section">
            <div className="selected-heading">
              <span>Branches</span>
              <strong>{activeLine.branches.length}</strong>
            </div>
            <div className="branch-tabs" aria-label="Branch list">
              {activeLine.branches.map((branch) => (
                <button
                  aria-pressed={branch.id === activeBranch.id}
                  key={branch.id}
                  onClick={() =>
                    updateActiveLine((line) => ({
                      ...line,
                      activeBranchId: branch.id,
                    }))
                  }
                  type="button"
                >
                  <span>{displayBranchName(branch)}</span>
                  <em>{`${branch.stationIds.length} stop${
                    branch.stationIds.length === 1 ? "" : "s"
                  }`}</em>
                </button>
              ))}
            </div>
            <div className="control-row branch-actions">
              <button className="tool-button" onClick={createNewBranch} type="button">
                Add branch
              </button>
              <button
                className="tool-button"
                onClick={removeActiveBranch}
                type="button"
              >
                {activeLine.branches.length === 1 ? "Clear branch" : "Remove branch"}
              </button>
            </div>
          </div>

          <div className="control-section">
            <label className="field-label" htmlFor="line-name">
              Active line name
            </label>
            <input
              id="line-name"
              className="text-field"
              maxLength={42}
              onChange={(event) =>
                updateActiveLine((line) => ({
                  ...line,
                  name: event.target.value,
                }))
              }
              placeholder="Name your line"
              type="text"
              value={activeLine.name}
            />
          </div>

          <div className="control-section">
            <label className="field-label" htmlFor="branch-name">
              Active branch name
            </label>
            <input
              id="branch-name"
              className="text-field"
              maxLength={42}
              onChange={(event) =>
                updateActiveBranch((branch) => ({
                  ...branch,
                  name: event.target.value,
                }))
              }
              placeholder="Name this branch"
              type="text"
              value={activeBranch.name}
            />
          </div>

          <div className="control-section">
            <div className="field-label">Active line colour</div>
            <div className="colour-row">
              <input
                aria-label="Custom line colour"
                className="colour-input"
                onChange={(event) =>
                  updateActiveLine((line) => ({
                    ...line,
                    colour: event.target.value,
                  }))
                }
                type="color"
                value={activeLine.colour}
              />
              <div className="swatch-grid" aria-label="Tube colour presets">
                {tubePalette.map((colour) => (
                  <button
                    aria-label={colour.name}
                    aria-pressed={activeLine.colour === colour.value}
                    className="swatch-button"
                    key={colour.value}
                    onClick={() =>
                      updateActiveLine((line) => ({
                        ...line,
                        colour: colour.value,
                      }))
                    }
                    style={{ backgroundColor: colour.value } as CSSProperties}
                    title={colour.name}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="control-section">
            <div className="control-row">
              <button
                className="tool-button"
                disabled={selectedPoints.length === 0}
                onClick={undoLastStation}
                type="button"
              >
                Undo
              </button>
              <button
                className="tool-button"
                disabled={selectedPoints.length === 0}
                onClick={resetLine}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="control-section selected-section">
            <div className="selected-heading">
              <span>{activeBranchName} stations</span>
              <strong>{selectedPoints.length}</strong>
            </div>
            {selectedPoints.length > 0 ? (
              <ol className="selected-list">
                {selectedPoints.map((point, index) => (
                  <li key={point.station.id}>
                    <span
                      className="stop-index"
                      style={{ backgroundColor: activeLine.colour } as CSSProperties}
                    >
                      {index + 1}
                    </span>
                    <span>
                      <strong>{point.station.name}</strong>
                      <em>{point.station.lines.join(", ")}</em>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">No stations selected on this branch.</p>
            )}
          </div>

          <div className="control-section export-section">
            <button
              className="export-button"
              disabled={!canExport}
              onClick={downloadMap}
              type="button"
            >
              {isExporting ? "Preparing..." : "Download PNG"}
            </button>
            <button
              className="share-button"
              disabled={!canExport}
              onClick={shareMap}
              type="button"
            >
              Share
            </button>
            <p aria-live="polite" className="status-line">
              {statusMessage ||
                "PNG export is ready after any branch has two stations."}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
