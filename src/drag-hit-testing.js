export function resolveLineBodyDragCandidate({ point, lineEndpoint, barrierStone, moved = false, findNearestLink }) {
  if (moved || lineEndpoint || barrierStone || typeof findNearestLink !== "function") return null;
  return findNearestLink(point);
}
