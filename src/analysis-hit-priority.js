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
    .sort((left, right) => (HIT_PRIORITY[left.kind] ?? Number.MAX_SAFE_INTEGER) - (HIT_PRIORITY[right.kind] ?? Number.MAX_SAFE_INTEGER))[0] || null;
}
