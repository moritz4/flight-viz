// Fetch data

import { MercatorCoordinate } from "maplibre-gl";

type Position = [number, number, number, number]; // time, lat, long, alt
type Flight = { origin: string; dest: string; positions: Position[] };
export type FlightsData = { [id: string]: Flight };

export async function fetchData() {
  const url = "https://storage.googleapis.com/flight-vis/flights.json";
  const response = await fetch(url);
  const data = (await response.json()) as FlightsData;

  // Convert lat long alt to world coordinates
  for (const flightId in data) {
    const flight = data[flightId];
    for (const position of flight.positions) {
      const [time, lat, long, alt] = position;
      const worldCoords = latLongAltToWorldCoordinates(lat, long, alt);
      position[1] = worldCoords.x; // replace lat with x
      position[2] = worldCoords.y; // replace long with y
      position[3] = worldCoords.z; // replace alt with z
    }
  }

  // Console log all flights ordered by the most recent time which appears in the positions array
  const sortedFlights = Object.entries(data).sort((a, b) => {
    const aMaxTime = Math.max(...a[1].positions.map((p) => p[0]));
    const bMaxTime = Math.max(...b[1].positions.map((p) => p[0]));
    return bMaxTime - aMaxTime;
  });
  console.log("Flights sorted by most recent time:", sortedFlights);

  return data;
}

function latLongAltToWorldCoordinates(
  lat: number,
  long: number,
  alt: number,
): { x: number; y: number; z: number } {
  const position = MercatorCoordinate.fromLngLat([long, lat], alt);
  position.x = position.x * 4000 - 2000; // convert to world coordinates
  position.y = position.y * 4000 - 2000 - 0.5; // convert to world coordinates For some reason we need to add a small northern offset
  // Apply sensible conversion factor from alt in feet to world coordinates
  position.z = position.z * 4000;

  return { x: position.x, y: position.y, z: position.z };
}
