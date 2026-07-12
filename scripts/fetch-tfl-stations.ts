import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Station } from "../app/types/station";

type TflLineGroup = {
  lineIdentifier?: string[];
};

type TflStopPoint = {
  id?: string;
  naptanId?: string;
  commonName?: string;
  lat?: number;
  lon?: number;
  zone?: string;
  lineModeGroups?: TflLineGroup[];
  modes?: string[];
};

type TflModeResponse = {
  stopPoints?: TflStopPoint[];
};

const outputPath = resolve(process.cwd(), "app/data/stations.json");
const endpoint = new URL("https://api.tfl.gov.uk/StopPoint/Mode/tube,overground,elizabeth-line");
endpoint.searchParams.set(
  "stopTypes",
  "NaptanMetroStation,NaptanRailStation",
);

const lineDisplayNames = new Map([
  ["bakerloo", "Bakerloo"],
  ["central", "Central"],
  ["circle", "Circle"],
  ["district", "District"],
  ["elizabeth", "Elizabeth"],
  ["elizabeth-line", "Elizabeth"],
  ["hammersmith-city", "Hammersmith & City"],
  ["jubilee", "Jubilee"],
  ["liberty", "Overground"],
  ["lioness", "Overground"],
  ["metropolitan", "Metropolitan"],
  ["mildmay", "Overground"],
  ["northern", "Northern"],
  ["london-overground", "Overground"],
  ["overground", "Overground"],
  ["piccadilly", "Piccadilly"],
  ["suffragette", "Overground"],
  ["victoria", "Victoria"],
  ["waterloo-city", "Waterloo & City"],
  ["weaver", "Overground"],
  ["windrush", "Overground"],
]);

const lineOrder = [
  "Bakerloo",
  "Central",
  "Circle",
  "District",
  "Hammersmith & City",
  "Jubilee",
  "Metropolitan",
  "Northern",
  "Piccadilly",
  "Victoria",
  "Waterloo & City",
  "Overground",
  "Elizabeth",
];

function toStationName(name: string) {
  const cleanName = name
    .replace(/\s+(Underground|Rail|DLR|Elizabeth line)\s+Station$/i, "")
    .replace(/\s+Stn\s*\/\s*H&c and Circle Lines$/i, "")
    .replace(/\s+Station$/i, "")
    .replace(/-Underground$/i, "")
    .trim();

  return cleanName
    .replace(/^Battersea Power$/i, "Battersea Power Station")
    .replace(/^Heathrow Airport Terminal\s+([45])$/i, "Heathrow Terminal $1")
    .replace(/^Heathrow Terminals\s+1-2-3$/i, "Heathrow Terminals 2 & 3")
    .replace(/^Hammersmith\s*\((Dist&Picc|District and Piccadilly|H&C) Line\)$/i, "Hammersmith")
    .replace(/^King's Cross & St Pancras International$/i, "King's Cross St Pancras")
    .replace(/^King's Cross St\. Pancras$/i, "King's Cross St Pancras");
}

function normaliseStationName(name: string) {
  const normalisedName = name
    .replace(/\s*\((?:[^)]*(?:Line|Central|District|Piccadilly|H&C)[^)]*)\)$/i, "")
    .replace(/^Heathrow Airport Terminal\s+([45])$/i, "Heathrow Terminal $1")
    .replace(/^Heathrow Terminals\s+1-2-3$/i, "Heathrow Terminals 2 & 3")
    .trim();

  return normalisedName
    .replace(/^Cambridge Heath \(London\)$/i, "Cambridge Heath")
    .replace(/^Edgware Road \(Bakerloo\)$/i, "Edgware Road")
    .replace(/^London Euston$/i, "Euston")
    .replace(/^London Liverpool Street$/i, "Liverpool Street")
    .replace(/^London Paddington$/i, "Paddington")
    .replace(/^New Cross ELL$/i, "New Cross")
    .replace(/^Queen's Park Station \(London\)$/i, "Queen's Park")
    .replace(/^Queens Park \(London\)$/i, "Queen's Park")
    .replace(/^Richmond \(London\)$/i, "Richmond")
    .replace(/^Shepherds Bush$/i, "Shepherd's Bush")
    .replace(/^St James Street \(London\)$/i, "St James Street")
    .replace(/^Stratford \(London\)$/i, "Stratford");
}

function slugifyStationId(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "station"
  );
}

function linesForStopPoint(stopPoint: TflStopPoint) {
  const lineIds = stopPoint.lineModeGroups?.flatMap(
    (group) => group.lineIdentifier ?? [],
  );

  return [...new Set(lineIds ?? [])]
    .map((lineId) => lineDisplayNames.get(lineId))
    .filter((line): line is string => Boolean(line))
    .sort((a, b) => lineOrder.indexOf(a) - lineOrder.indexOf(b));
}

function transformStopPoint(stopPoint: TflStopPoint): Station | null {
  if (
    !stopPoint.commonName ||
    typeof stopPoint.lat !== "number" ||
    typeof stopPoint.lon !== "number"
  ) {
    return null;
  }

  const name = toStationName(stopPoint.commonName);
  const displayName = normaliseStationName(name);
  const lines = linesForStopPoint(stopPoint);

  if (lines.length === 0) {
    return null;
  }

  return {
    id: slugifyStationId(displayName),
    name: displayName,
    lat: stopPoint.lat,
    lon: stopPoint.lon,
    lines,
    zone: stopPoint.zone,
  };
}

const response = await fetch(endpoint);

if (!response.ok) {
  throw new Error(`TfL station fetch failed with ${response.status}`);
}

const payload = (await response.json()) as TflModeResponse | TflStopPoint[];
const stopPoints = Array.isArray(payload) ? payload : payload.stopPoints ?? [];
const stationMap = new Map<
  string,
  Station & { coordinateCount: number; latitudeTotal: number; longitudeTotal: number }
>();

for (const stopPoint of stopPoints) {
  const station = transformStopPoint(stopPoint);

  if (!station) {
    continue;
  }

  const existing = stationMap.get(station.id);

  if (!existing) {
    stationMap.set(station.id, {
      ...station,
      coordinateCount: 1,
      latitudeTotal: station.lat,
      longitudeTotal: station.lon,
    });
    continue;
  }

  const lines = [...new Set([...existing.lines, ...station.lines])].sort(
    (a, b) => lineOrder.indexOf(a) - lineOrder.indexOf(b),
  );

  existing.lines = lines;
  existing.coordinateCount += 1;
  existing.latitudeTotal += station.lat;
  existing.longitudeTotal += station.lon;
  existing.lat = Number((existing.latitudeTotal / existing.coordinateCount).toFixed(6));
  existing.lon = Number((existing.longitudeTotal / existing.coordinateCount).toFixed(6));
  existing.zone = existing.zone ?? station.zone;
}

const stations = [...stationMap.values()]
  .map((station) => ({
    id: station.id,
    name: station.name,
    lat: station.lat,
    lon: station.lon,
    lines: station.lines,
    zone: station.zone,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(stations, null, 2)}\n`, "utf8");
