const HIT_PRIORITY = Object.freeze({
  "line-endpoint": 0,
  "figure-vertex": 1,
  point: 2,
  line: 3,
  "figure-edge": 4,
  "figure-surface": 5
});

export function chooseAnalysisHit(candidates = []) {
  return candidates
    .filter((candidate) => candidate?.value)
    .sort((left, right) => {
      const priority = (HIT_PRIORITY[left.kind] ?? Number.MAX_SAFE_INTEGER)
        - (HIT_PRIORITY[right.kind] ?? Number.MAX_SAFE_INTEGER);
      if (priority !== 0) return priority;

      const distance = normalizedHitMetric(left.distance) - normalizedHitMetric(right.distance);
      if (distance !== 0) return distance;

      // When a tap falls inside nested figure surfaces, prefer the smaller
      // surface. This keeps a large background figure from owning every tap
      // within it and masking the figure placed inside it.
      return normalizedHitMetric(left.area) - normalizedHitMetric(right.area);
    })[0] || null;
}

function normalizedHitMetric(value) {
  return Number.isFinite(value) ? value : 0;
}
