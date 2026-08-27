function mapCoordinate(geo) {
  return `${Number(geo.lat).toFixed(6)},${Number(geo.lng).toFixed(6)}`;
}

function validGeo(geo) {
  return Boolean(geo) && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng));
}

function normalizedStops(stops) {
  return (Array.isArray(stops) ? stops : [])
    .map((stop) => ({ ...stop, geo: stop?.geo }))
    .filter((stop) => validGeo(stop.geo));
}

export function externalMapUrl(provider, stops) {
  const validStops = normalizedStops(stops);
  if (validStops.length === 0) return null;

  const first = validStops[0];
  if (validStops.length === 1) {
    const coordinate = mapCoordinate(first.geo);
    if (provider === "apple") {
      return `https://maps.apple.com/?ll=${coordinate}&q=${encodeURIComponent(first.title || "GRID ATLAS Point")}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${coordinate}`;
  }

  const origin = mapCoordinate(first.geo);
  const destination = mapCoordinate(validStops.at(-1).geo);
  const waypoints = validStops.slice(1, -1).map((stop) => mapCoordinate(stop.geo));

  if (provider === "apple") {
    const params = new URLSearchParams({ source: origin, destination, mode: "driving" });
    for (const waypoint of waypoints) params.append("waypoint", waypoint);
    return `https://maps.apple.com/directions?${params.toString()}`;
  }

  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
