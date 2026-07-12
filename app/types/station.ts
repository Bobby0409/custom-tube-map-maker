export type Station = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: string[];
  zone?: string;
};
