const EPSILON = 1e-9;
const WGS84_SEMI_MAJOR_METERS = 6378137;
const WGS84_FLATTENING = 1 / 298.257223563;
const WGS84_SEMI_MINOR_METERS = (1 - WGS84_FLATTENING) * WGS84_SEMI_MAJOR_METERS;

export function analyzeLineIntersection(first, second) {
  const a = pointXY(first?.a ?? first?.start);
  const b = pointXY(first?.b ?? first?.end);
  const c = pointXY(second?.a ?? second?.start);
  const d = pointXY(second?.b ?? second?.end);
  if (!a || !b || !c || !d) {
    return { intersects: false, reason: "invalid" };
  }

  const firstVector = subtract(b, a);
  const secondVector = subtract(d, c);
  const denominator = cross(firstVector, secondVector);
  const firstLength = length(firstVector);
  const secondLength = length(secondVector);
  if (firstLength < EPSILON || secondLength < EPSILON) {
    return { intersects: false, reason: "degenerate" };
  }

  const rawAngle = angleBetween(firstVector, secondVector);
  const angle = Math.min(rawAngle, 180 - rawAngle);
  if (Math.abs(denominator) < EPSILON) {
    return {
      intersects: false,
      reason: pointsCollinear(a, b, c) ? "collinear" : "parallel",
      angle,
      firstLength,
      secondLength
    };
  }

  const offset = subtract(c, a);
  const firstRatio = cross(offset, secondVector) / denominator;
  const secondRatio = cross(offset, firstVector) / denominator;
  const intersects = firstRatio >= -EPSILON
    && firstRatio <= 1 + EPSILON
    && secondRatio >= -EPSILON
    && secondRatio <= 1 + EPSILON;
  const intersection = add(a, scale(firstVector, firstRatio));
  return {
    intersects,
    reason: intersects ? "intersection" : "extension",
    point: intersection,
    firstRatio,
    secondRatio,
    angle,
    firstLength,
    secondLength
  };
}

export function analyzeSegmentShape(segments) {
  const normalizedSegments = Array.isArray(segments)
    ? segments.map(normalizeSegment).filter(Boolean)
    : [];
  if (normalizedSegments.length < 3) {
    return { valid: false, reason: "too-few-segments", segments: normalizedSegments };
  }
  const projectedSegments = projectSegmentsAroundMean(normalizedSegments);

  const vertices = new Map();
  const edges = projectedSegments.map((segment) => {
    const aKey = pointKey(segment.a);
    const bKey = pointKey(segment.b);
    if (!vertices.has(aKey)) vertices.set(aKey, segment.a);
    if (!vertices.has(bKey)) vertices.set(bKey, segment.b);
    return { ...segment, aKey, bKey };
  });
  if (vertices.size !== edges.length) {
    return { valid: false, reason: "not-simple-cycle", segments: normalizedSegments };
  }

  const adjacency = new Map([...vertices.keys()].map((key) => [key, []]));
  for (const edge of edges) {
    adjacency.get(edge.aKey)?.push({ key: edge.bKey, edge });
    adjacency.get(edge.bKey)?.push({ key: edge.aKey, edge });
  }
  if ([...adjacency.values()].some((neighbors) => neighbors.length !== 2)) {
    return { valid: false, reason: "not-simple-cycle", segments: normalizedSegments };
  }

  const startKey = edges[0].aKey;
  const sequenceKeys = [startKey];
  const sequenceEdges = [];
  let previousKey = null;
  let currentKey = startKey;
  for (let index = 0; index < edges.length; index += 1) {
    const next = adjacency.get(currentKey)?.find((neighbor) => neighbor.key !== previousKey);
    if (!next) return { valid: false, reason: "not-simple-cycle", segments: normalizedSegments };
    sequenceEdges.push(next.edge);
    previousKey = currentKey;
    currentKey = next.key;
    if (currentKey === startKey) break;
    sequenceKeys.push(currentKey);
  }
  if (currentKey !== startKey || sequenceKeys.length !== edges.length) {
    return { valid: false, reason: "not-simple-cycle", segments: normalizedSegments };
  }

  const points = sequenceKeys.map((key) => vertices.get(key));
  const turning = turningNumber(points);
  const n = points.length;
  const k = Math.max(1, Math.min(Math.floor((n - 1) / 2), Math.abs(Math.round(turning))));
  const selfIntersections = countSelfIntersections(sequenceEdges);
  const idealAngle = 180 * (n - 2 * k) / n;
  const idealDiagonalToSide = Math.sin((2 * Math.PI * k) / n) / Math.sin((Math.PI * k) / n);
  const sideLengths = sequenceEdges.map((edge) => (
    validGeo(edge.a.geo) && validGeo(edge.b.geo)
      ? vincentyDistanceMeters(edge.a, edge.b)
      : length(subtract(edge.b, edge.a))
  ));
  const angles = points.map((point, index) => {
    const previous = points[(index + n - 1) % n];
    const next = points[(index + 1) % n];
    return angleBetween(subtract(previous, point), subtract(next, point));
  });
  const meanSide = average(sideLengths);
  const perimeter = sideLengths.reduce((sum, value) => sum + value, 0);
  const sideRangePercent = meanSide > EPSILON
    ? ((Math.max(...sideLengths) - Math.min(...sideLengths)) / meanSide) * 100
    : 0;
  const maxAngleDeviation = Math.max(...angles.map((angle) => Math.abs(angle - idealAngle)));
  const maxAngleDeviationPercent = idealAngle > EPSILON ? (maxAngleDeviation / idealAngle) * 100 : 0;
  const angleScore = clamp(100 * (1 - maxAngleDeviationPercent / 25), 0, 100);
  const sideScore = clamp(100 * (1 - sideRangePercent / 25), 0, 100);
  const area = selfIntersections === 0 ? polygonArea(points) : null;
  const regularityDeviationPercent = regularityPercent(points, k);
  const dragonEyePrecision = dragonEyePrecisionFromPoints(points);
  const referenceScoreRaw = 100 / (1 + regularityDeviationPercent / 20);
  const referenceScoreCeiling = dragonEyePrecision === null
    ? null
    : 40 + dragonEyePrecision * 60;

  return {
    valid: true,
    points,
    segments: sequenceEdges,
    n,
    k,
    turningNumber: Math.abs(Math.round(turning)),
    selfIntersections,
    shapeKind: selfIntersections > 0 ? (k > 1 ? "star" : "self-crossing") : "polygon",
    sideLengths,
    shortestSide: Math.min(...sideLengths),
    longestSide: Math.max(...sideLengths),
    angles,
    meanSide,
    perimeter,
    area,
    vertexCount: points.length,
    edgeCount: sequenceEdges.length,
    sideRangePercent,
    idealAngle,
    maxAngleDeviation,
    maxAngleDeviationPercent,
    idealDiagonalToSide,
    sideScore,
    angleScore,
    referenceScore: referenceScoreCeiling === null
      ? referenceScoreRaw
      : Math.min(referenceScoreRaw, referenceScoreCeiling),
    referenceScoreRaw,
    referenceScoreCeiling,
    dragonEyePrecision
  };
}

export function analyzeOpenPath(segments) {
  const normalizedSegments = Array.isArray(segments)
    ? segments.map(normalizeSegment).filter(Boolean)
    : [];
  if (normalizedSegments.length < 2) {
    return { valid: false, reason: "too-few-segments", segments: normalizedSegments };
  }

  const vertices = new Map();
  const edges = normalizedSegments.map((segment) => {
    const aKey = pointKey(segment.a);
    const bKey = pointKey(segment.b);
    if (!vertices.has(aKey)) vertices.set(aKey, segment.a);
    if (!vertices.has(bKey)) vertices.set(bKey, segment.b);
    return { ...segment, aKey, bKey };
  });
  const adjacency = new Map([...vertices.keys()].map((key) => [key, []]));
  for (const edge of edges) {
    adjacency.get(edge.aKey)?.push({ key: edge.bKey, edge });
    adjacency.get(edge.bKey)?.push({ key: edge.aKey, edge });
  }
  const endpointKeys = [...adjacency.entries()]
    .filter(([, neighbors]) => neighbors.length === 1)
    .map(([key]) => key);
  if (endpointKeys.length !== 2 || [...adjacency.values()].some((neighbors) => neighbors.length < 1 || neighbors.length > 2)) {
    return { valid: false, reason: "not-simple-path", segments: normalizedSegments };
  }

  const pathKeys = [endpointKeys[0]];
  const pathEdges = [];
  const visitedEdges = new Set();
  let previousKey = null;
  let currentKey = endpointKeys[0];
  while (true) {
    const next = adjacency.get(currentKey)?.find((neighbor) => neighbor.key !== previousKey && !visitedEdges.has(neighbor.edge));
    if (!next) break;
    visitedEdges.add(next.edge);
    pathEdges.push(next.edge);
    previousKey = currentKey;
    currentKey = next.key;
    pathKeys.push(currentKey);
  }
  if (visitedEdges.size !== edges.length || currentKey !== endpointKeys[1]) {
    return { valid: false, reason: "not-simple-path", segments: normalizedSegments };
  }

  const points = pathKeys.map((key) => vertices.get(key));
  if (points.some((point) => !validGeo(point.geo))) {
    return { valid: false, reason: "missing-geo", segments: normalizedSegments };
  }
  const earthPoints = points.map((point) => ecef(point.geo));
  const scatter = sumOuterProducts(earthPoints);
  const eigen = symmetricEigenDecomposition3(scatter);
  const normal = normalizeVector(eigen.vectors[eigen.values.indexOf(Math.min(...eigen.values))]);
  if (!normal) return { valid: false, reason: "degenerate-path", segments: normalizedSegments };

  const planeDistances = earthPoints.map((point) => Math.abs(dot3(point, normal)));
  const projected = earthPoints.map((point) => subtract3(point, scale3(normal, dot3(point, normal))));
  const center = meanVector(projected);
  const centered = projected.map((point) => subtract3(point, center));
  const directionEigen = symmetricEigenDecomposition3(sumOuterProducts(centered));
  const direction = normalizeVector(directionEigen.vectors[directionEigen.values.indexOf(Math.max(...directionEigen.values))]);
  if (!direction) return { valid: false, reason: "degenerate-path", segments: normalizedSegments };

  const positions = centered.map((point) => dot3(point, direction));
  const span = Math.max(...positions) - Math.min(...positions);
  if (!(span > EPSILON)) return { valid: false, reason: "degenerate-path", segments: normalizedSegments };

  const regression = linearRegression(positions);
  const alongResiduals = positions.map((value, index) => value - (regression.intercept + regression.slope * index));
  const perpendicularRmsMeters = rootMeanSquare(planeDistances);
  const spacingRmsMeters = rootMeanSquare(alongResiduals);
  const totalRmsMeters = Math.hypot(perpendicularRmsMeters, spacingRmsMeters);
  const perpendicularPercent = (perpendicularRmsMeters / span) * 100;
  const spacingPercent = (spacingRmsMeters / span) * 100;
  const totalPercent = (totalRmsMeters / span) * 100;
  const increasing = positions.every((value, index) => index === 0 || value > positions[index - 1] + span * 1e-9);
  const decreasing = positions.every((value, index) => index === 0 || value < positions[index - 1] - span * 1e-9);
  const pathLengthMeters = pathEdges.reduce((sum, edge) => sum + vincentyDistanceMeters(edge.a, edge.b), 0);
  const endpointDistanceMeters = vincentyDistanceMeters(points[0], points.at(-1));
  const mercator = analyzeMercatorLine(points);
  const farthestIndex = planeDistances.indexOf(Math.max(...planeDistances));

  return {
    valid: true,
    points,
    segments: pathEdges,
    vertexCount: points.length,
    edgeCount: pathEdges.length,
    span,
    planeDistances,
    perpendicularRmsMeters,
    perpendicularMaxMeters: Math.max(...planeDistances),
    perpendicularPercent,
    spacingRmsMeters,
    spacingPercent,
    totalRmsMeters,
    totalPercent,
    referenceScore: 100 / (1 + totalPercent / 10),
    pathLengthMeters,
    endpointDistanceMeters,
    pathLengthRatioPercent: endpointDistanceMeters > EPSILON ? (pathLengthMeters / endpointDistanceMeters) * 100 : Infinity,
    bearingDegrees: initialBearingDegrees(points[0].geo, points.at(-1).geo),
    farthestPoint: points[farthestIndex],
    farthestPointIndex: farthestIndex,
    folded: !(increasing || decreasing),
    mercator
  };
}

function analyzeMercatorLine(points) {
  const projected = points.map((point) => {
    const lat = toRadians(point.geo.lat);
    return {
      x: WGS84_SEMI_MAJOR_METERS * toRadians(shortestLongitudeDelta(0, point.geo.lng)),
      y: WGS84_SEMI_MAJOR_METERS * Math.log(Math.tan(Math.PI / 4 + lat / 2)),
      scale: Math.cos(lat)
    };
  });
  const center = {
    x: average(projected.map((point) => point.x)),
    y: average(projected.map((point) => point.y))
  };
  const centered = projected.map((point) => ({ x: point.x - center.x, y: point.y - center.y }));
  const covariance = centered.reduce((matrix, point) => {
    matrix[0][0] += point.x * point.x;
    matrix[0][1] += point.x * point.y;
    matrix[1][0] += point.x * point.y;
    matrix[1][1] += point.y * point.y;
    return matrix;
  }, [[0, 0], [0, 0]]);
  const directionAngle = 0.5 * Math.atan2(2 * covariance[0][1], covariance[0][0] - covariance[1][1]);
  const direction = { x: Math.cos(directionAngle), y: Math.sin(directionAngle) };
  const positions = centered.map((point) => point.x * direction.x + point.y * direction.y);
  const span = Math.max(...positions) - Math.min(...positions);
  if (!(span > EPSILON)) return { deviationPercent: 0, rmsMeters: 0, maxMeters: 0 };
  const distances = centered.map((point, index) => Math.abs(point.x * direction.y - point.y * direction.x) * projected[index].scale);
  return {
    deviationPercent: (rootMeanSquare(distances) / span) * 100,
    rmsMeters: rootMeanSquare(distances),
    maxMeters: Math.max(...distances)
  };
}

function ecef(geo) {
  const latitude = toRadians(geo.lat);
  const longitude = toRadians(geo.lng);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const radius = WGS84_SEMI_MAJOR_METERS / Math.sqrt(1 - WGS84_FLATTENING * (2 - WGS84_FLATTENING) * sinLatitude ** 2);
  return [
    radius * cosLatitude * Math.cos(longitude),
    radius * cosLatitude * Math.sin(longitude),
    radius * (1 - WGS84_FLATTENING) ** 2 * sinLatitude
  ];
}

function sumOuterProducts(points) {
  return points.reduce((matrix, point) => {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) matrix[row][column] += point[row] * point[column];
    }
    return matrix;
  }, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
}

function symmetricEigenDecomposition3(matrix) {
  const values = matrix.map((row) => [...row]);
  const vectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 32; iteration += 1) {
    let p = 0;
    let q = 1;
    let largest = Math.abs(values[p][q]);
    for (let row = 0; row < 3; row += 1) {
      for (let column = row + 1; column < 3; column += 1) {
        if (Math.abs(values[row][column]) > largest) {
          largest = Math.abs(values[row][column]);
          p = row;
          q = column;
        }
      }
    }
    if (largest < 1e-7) break;
    const angle = 0.5 * Math.atan2(2 * values[p][q], values[q][q] - values[p][p]);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const pDiagonal = values[p][p];
    const qDiagonal = values[q][q];
    const offDiagonal = values[p][q];
    values[p][p] = cosine ** 2 * pDiagonal - 2 * sine * cosine * offDiagonal + sine ** 2 * qDiagonal;
    values[q][q] = sine ** 2 * pDiagonal + 2 * sine * cosine * offDiagonal + cosine ** 2 * qDiagonal;
    values[p][q] = 0;
    values[q][p] = 0;
    for (let index = 0; index < 3; index += 1) {
      if (index === p || index === q) continue;
      const indexP = values[index][p];
      const indexQ = values[index][q];
      values[index][p] = values[p][index] = cosine * indexP - sine * indexQ;
      values[index][q] = values[q][index] = sine * indexP + cosine * indexQ;
    }
    for (let index = 0; index < 3; index += 1) {
      const vectorP = vectors[index][p];
      const vectorQ = vectors[index][q];
      vectors[index][p] = cosine * vectorP - sine * vectorQ;
      vectors[index][q] = sine * vectorP + cosine * vectorQ;
    }
  }
  return { values: [values[0][0], values[1][1], values[2][2]], vectors: [
    [vectors[0][0], vectors[1][0], vectors[2][0]],
    [vectors[0][1], vectors[1][1], vectors[2][1]],
    [vectors[0][2], vectors[1][2], vectors[2][2]]
  ] };
}

function meanVector(points) {
  return points.reduce((sum, point) => sum.map((value, index) => value + point[index] / points.length), [0, 0, 0]);
}

function subtract3(first, second) {
  return first.map((value, index) => value - second[index]);
}

function scale3(point, factor) {
  return point.map((value) => value * factor);
}

function dot3(first, second) {
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

function normalizeVector(vector) {
  if (!vector) return null;
  const magnitude = Math.hypot(...vector);
  return magnitude < EPSILON ? null : vector.map((value) => value / magnitude);
}

function rootMeanSquare(values) {
  return Math.sqrt(average(values.map((value) => value * value)));
}

function linearRegression(values) {
  const meanIndex = (values.length - 1) / 2;
  const meanValue = average(values);
  const denominator = values.reduce((sum, _, index) => sum + (index - meanIndex) ** 2, 0);
  const slope = denominator > EPSILON
    ? values.reduce((sum, value, index) => sum + (index - meanIndex) * (value - meanValue), 0) / denominator
    : 0;
  return { slope, intercept: meanValue - slope * meanIndex };
}

function initialBearingDegrees(first, second) {
  const latitude1 = toRadians(first.lat);
  const latitude2 = toRadians(second.lat);
  const longitudeDelta = toRadians(shortestLongitudeDelta(first.lng, second.lng));
  const bearing = Math.atan2(
    Math.sin(longitudeDelta) * Math.cos(latitude2),
    Math.cos(latitude1) * Math.sin(latitude2) - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta)
  ) * (180 / Math.PI);
  return (bearing + 360) % 360;
}

function regularityPercent(points, k) {
  const n = points.length;
  const center = points.reduce((sum, point) => ({
    x: sum.x + point.x / n,
    y: sum.y + point.y / n
  }), { x: 0, y: 0 });
  const centered = points.map((point) => [point.x - center.x, point.y - center.y]);
  const scaleFactor = Math.sqrt(average(centered.map(([x, y]) => x * x + y * y)));
  if (scaleFactor < EPSILON) return Infinity;
  const normalized = centered.map(([x, y]) => [x / scaleFactor, y / scaleFactor]);
  const target = Array.from({ length: n }, (_, index) => {
    const angle = (2 * Math.PI * k * index) / n;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const bestResidual = [target, [...target].reverse()].reduce((best, candidate) => {
    const rotationVector = candidate.reduce((sum, [tx, ty], index) => {
      const [ax, ay] = normalized[index];
      return {
        real: sum.real + tx * ax + ty * ay,
        imaginary: sum.imaginary + tx * ay - ty * ax
      };
    }, { real: 0, imaginary: 0 });
    const rotation = Math.atan2(rotationVector.imaginary, rotationVector.real);
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);
    const residualSquared = normalized.reduce((sum, [ax, ay], index) => {
      const [tx, ty] = candidate[index];
      const rotatedX = tx * cosRotation - ty * sinRotation;
      const rotatedY = tx * sinRotation + ty * cosRotation;
      return sum + (ax - rotatedX) ** 2 + (ay - rotatedY) ** 2;
    }, 0) / n;
    return Math.min(best, Math.sqrt(residualSquared));
  }, Infinity);
  return bestResidual * 100;
}

function dragonEyePrecisionFromPoints(points) {
  const notes = points.map((point) => String(point.note || ""));
  if (notes.length === 0 || notes.some((note) => !note.includes("結界モード龍脈眼"))) return null;
  const values = notes
    .map((note) => note.match(/精度\s*(\d+(?:\.\d+)?)%/u)?.[1])
    .filter((value) => value !== undefined)
    .map(Number)
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0.8;
  return Math.min(1, Math.max(0, values.reduce((sum, value) => sum + value, 0) / values.length / 100));
}

function polygonArea(points) {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
}

function projectSegmentsAroundMean(segments) {
  const points = new Map();
  for (const segment of segments) {
    for (const point of [segment.a, segment.b]) {
      const key = pointKey(point);
      if (!points.has(key)) points.set(key, point);
    }
  }
  const center = meanGeo([...points.values()]);
  if (!center) return segments;
  const projected = new Map([...points.keys()].map((key) => [key, projectLocalAeqd(points.get(key).geo, center)]));
  return segments.map((segment) => ({
    ...segment,
    a: { ...segment.a, ...projected.get(pointKey(segment.a)) },
    b: { ...segment.b, ...projected.get(pointKey(segment.b)) }
  }));
}

export function analyzeRegularPolygon(points) {
  const validPoints = Array.isArray(points) ? points.map(pointXY).filter(Boolean) : [];
  if (validPoints.length < 3) {
    return { valid: false, points: validPoints };
  }

  const ordered = orderAroundCenter(validPoints);
  const sideLengths = ordered.map((point, index) => {
    const next = ordered[(index + 1) % ordered.length];
    return validGeo(point.geo) && validGeo(next.geo)
      ? vincentyDistanceMeters(point, next)
      : length(subtract(next, point));
  });
  const angles = ordered.map((point, index) => {
    const previous = ordered[(index + ordered.length - 1) % ordered.length];
    const next = ordered[(index + 1) % ordered.length];
    return angleBetween(subtract(previous, point), subtract(next, point));
  });
  const meanSide = average(sideLengths);
  const idealAngle = ((ordered.length - 2) * 180) / ordered.length;
  const sideDeviation = meanSide > EPSILON
    ? average(sideLengths.map((value) => Math.abs(value - meanSide))) / meanSide
    : 1;
  const angleDeviation = average(angles.map((value) => Math.abs(value - idealAngle)));
  const sideScore = clamp(100 * (1 - sideDeviation * 3), 0, 100);
  const angleScore = clamp(100 * (1 - angleDeviation / 45), 0, 100);
  const score = clamp(sideScore * 0.55 + angleScore * 0.45, 0, 100);

  return {
    valid: true,
    points: ordered,
    sideLengths,
    angles,
    meanSide,
    idealAngle,
    sideDeviation,
    angleDeviation,
    sideScore,
    angleScore,
    score
  };
}

function normalizeSegment(segment) {
  const a = pointXY(segment?.a ?? segment?.start);
  const b = pointXY(segment?.b ?? segment?.end);
  return a && b ? { ...segment, a, b } : null;
}

function pointXY(point) {
  if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
    return {
      x: point.x,
      y: point.y,
      id: point.id,
      title: point.title,
      geo: point.geo,
      note: point.note,
      endpointKey: point.endpointKey || point.key
    };
  }
  return null;
}

function pointKey(point) {
  return point.endpointKey || point.id || `${point.x}:${point.y}`;
}

function turningNumber(points) {
  let total = 0;
  const n = points.length;
  for (let index = 0; index < n; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % n];
    const c = points[(index + 2) % n];
    const first = subtract(b, a);
    const second = subtract(c, b);
    total += Math.atan2(cross(first, second), dot(first, second));
  }
  return total / (2 * Math.PI);
}

function countSelfIntersections(segments) {
  let count = 0;
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      if (secondIndex === firstIndex + 1 || (firstIndex === 0 && secondIndex === segments.length - 1)) continue;
      if (segmentsIntersect(segments[firstIndex].a, segments[firstIndex].b, segments[secondIndex].a, segments[secondIndex].b)) count += 1;
    }
  }
  return count;
}

function segmentsIntersect(a, b, c, d) {
  const ab = subtract(b, a);
  const cd = subtract(d, c);
  const denominator = cross(ab, cd);
  if (Math.abs(denominator) < EPSILON) return false;
  const offset = subtract(c, a);
  const firstRatio = cross(offset, cd) / denominator;
  const secondRatio = cross(offset, ab) / denominator;
  return firstRatio > EPSILON && firstRatio < 1 - EPSILON && secondRatio > EPSILON && secondRatio < 1 - EPSILON;
}

function orderAroundCenter(points) {
  const center = points.reduce((sum, point) => add(sum, point), { x: 0, y: 0 });
  center.x /= points.length;
  center.y /= points.length;
  return points
    .map((point, index) => ({ point, index, angle: Math.atan2(point.y - center.y, point.x - center.x) }))
    .sort((a, b) => a.angle - b.angle || a.index - b.index)
    .map(({ point }) => point);
}

export function vincentyDistanceMeters(first, second) {
  const firstGeo = validGeo(first?.geo) ? first.geo : first;
  const secondGeo = validGeo(second?.geo) ? second.geo : second;
  if (!validGeo(firstGeo) || !validGeo(secondGeo)) return haversineDistanceMeters(firstGeo, secondGeo);

  const phi1 = toRadians(firstGeo.lat);
  const phi2 = toRadians(secondGeo.lat);
  const lambdaDifference = toRadians(shortestLongitudeDelta(firstGeo.lng, secondGeo.lng));
  const reducedLatitude1 = Math.atan((1 - WGS84_FLATTENING) * Math.tan(phi1));
  const reducedLatitude2 = Math.atan((1 - WGS84_FLATTENING) * Math.tan(phi2));
  const sinReduced1 = Math.sin(reducedLatitude1);
  const cosReduced1 = Math.cos(reducedLatitude1);
  const sinReduced2 = Math.sin(reducedLatitude2);
  const cosReduced2 = Math.cos(reducedLatitude2);
  let lambda = lambdaDifference;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let sinAlpha = 0;
  let cosSquaredAlpha = 0;
  let cosTwiceSigmaM = 0;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    const firstTerm = cosReduced2 * sinLambda;
    const secondTerm = cosReduced1 * sinReduced2 - sinReduced1 * cosReduced2 * cosLambda;
    sinSigma = Math.hypot(firstTerm, secondTerm);
    if (sinSigma < EPSILON) return 0;
    cosSigma = sinReduced1 * sinReduced2 + cosReduced1 * cosReduced2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = (cosReduced1 * cosReduced2 * sinLambda) / sinSigma;
    cosSquaredAlpha = 1 - sinAlpha ** 2;
    cosTwiceSigmaM = cosSquaredAlpha < EPSILON
      ? 0
      : cosSigma - (2 * sinReduced1 * sinReduced2) / cosSquaredAlpha;
    const coefficient = WGS84_FLATTENING / 16 * cosSquaredAlpha * (4 + WGS84_FLATTENING * (4 - 3 * cosSquaredAlpha));
    const nextLambda = lambdaDifference + (1 - coefficient) * WGS84_FLATTENING * sinAlpha * (
      sigma + coefficient * sinSigma * (
        cosTwiceSigmaM + coefficient * cosSigma * (-1 + 2 * cosTwiceSigmaM ** 2)
      )
    );
    if (Math.abs(nextLambda - lambda) < 1e-12) {
      lambda = nextLambda;
      break;
    }
    lambda = nextLambda;
    if (iteration === 99) return haversineDistanceMeters(firstGeo, secondGeo);
  }

  const uSquared = cosSquaredAlpha * (WGS84_SEMI_MAJOR_METERS ** 2 - WGS84_SEMI_MINOR_METERS ** 2) / (WGS84_SEMI_MINOR_METERS ** 2);
  const coefficientA = 1 + (uSquared / 16384) * (4096 + uSquared * (-768 + uSquared * (320 - 175 * uSquared)));
  const coefficientB = (uSquared / 1024) * (256 + uSquared * (-128 + uSquared * (74 - 47 * uSquared)));
  const deltaSigma = coefficientB * sinSigma * (
    cosTwiceSigmaM + (coefficientB / 4) * (
      cosSigma * (-1 + 2 * cosTwiceSigmaM ** 2)
      - (coefficientB / 6) * cosTwiceSigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cosTwiceSigmaM ** 2)
    )
  );
  return WGS84_SEMI_MINOR_METERS * coefficientA * (sigma - deltaSigma);
}

function haversineDistanceMeters(first, second) {
  if (!validGeo(first) || !validGeo(second)) return NaN;
  const earthRadius = 6371008.8;
  const lat1 = toRadians(first.lat);
  const lat2 = toRadians(second.lat);
  const dLat = toRadians(second.lat - first.lat);
  const dLng = toRadians(shortestLongitudeDelta(first.lng, second.lng));
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function meanGeo(points) {
  const geos = points.map((point) => point.geo).filter(validGeo);
  if (geos.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const geo of geos) {
    const lat = toRadians(geo.lat);
    const lng = toRadians(geo.lng);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }
  const magnitude = Math.hypot(x, y, z);
  return magnitude < EPSILON
    ? null
    : {
      lat: Math.atan2(z, Math.hypot(x, y)) * (180 / Math.PI),
      lng: Math.atan2(y, x) * (180 / Math.PI)
    };
}

function projectLocalAeqd(geo, centerGeo) {
  const lat = toRadians(geo.lat);
  const lngDelta = toRadians(shortestLongitudeDelta(centerGeo.lng, geo.lng));
  const lat0 = toRadians(centerGeo.lat);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const cosC = clamp(sinLat0 * sinLat + cosLat0 * cosLat * Math.cos(lngDelta), -1, 1);
  const c = Math.acos(cosC);
  const scaleFactor = c < EPSILON ? 1 : c / Math.sin(c);
  const earthRadius = 6371008.8;
  return {
    x: earthRadius * scaleFactor * cosLat * Math.sin(lngDelta),
    y: earthRadius * scaleFactor * (cosLat0 * sinLat - sinLat0 * cosLat * Math.cos(lngDelta))
  };
}

function validGeo(geo) {
  return Number.isFinite(geo?.lat) && Number.isFinite(geo?.lng);
}

function shortestLongitudeDelta(fromLng, toLng) {
  return ((((toLng - fromLng) + 540) % 360) + 360) % 360 - 180;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(point, factor) {
  return { x: point.x * factor, y: point.y * factor };
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function length(point) {
  return Math.hypot(point.x, point.y);
}

function angleBetween(first, second) {
  const denominator = length(first) * length(second);
  if (denominator < EPSILON) return 0;
  return Math.acos(clamp(dot(first, second) / denominator, -1, 1)) * (180 / Math.PI);
}

function pointsCollinear(a, b, c) {
  return Math.abs(cross(subtract(b, a), subtract(c, a))) < EPSILON;
}

function average(values) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
