export function resolveLineBodyDragCandidate({ point, lineEndpoint, moved = false, findNearestLink }) {
  if (moved || lineEndpoint || typeof findNearestLink !== "function") return null;
  return findNearestLink(point);
}
