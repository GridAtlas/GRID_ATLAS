const VERSION_DATA = [
  null,
  { totalCodewords: 26, ecCodewords: 10, groups: [{ count: 1, dataCodewords: 16 }] },
  { totalCodewords: 44, ecCodewords: 16, groups: [{ count: 1, dataCodewords: 28 }] },
  { totalCodewords: 70, ecCodewords: 26, groups: [{ count: 1, dataCodewords: 44 }] },
  { totalCodewords: 100, ecCodewords: 18, groups: [{ count: 2, dataCodewords: 32 }] },
  { totalCodewords: 134, ecCodewords: 24, groups: [{ count: 2, dataCodewords: 43 }] },
  { totalCodewords: 172, ecCodewords: 16, groups: [{ count: 4, dataCodewords: 27 }] },
  { totalCodewords: 196, ecCodewords: 18, groups: [{ count: 4, dataCodewords: 31 }] },
  { totalCodewords: 242, ecCodewords: 22, groups: [{ count: 2, dataCodewords: 38 }, { count: 2, dataCodewords: 39 }] },
  { totalCodewords: 292, ecCodewords: 22, groups: [{ count: 3, dataCodewords: 36 }, { count: 2, dataCodewords: 37 }] },
  { totalCodewords: 346, ecCodewords: 26, groups: [{ count: 4, dataCodewords: 43 }, { count: 1, dataCodewords: 44 }] }
];

const ALIGNMENT_POSITIONS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

export class QrCodeError extends Error {
  constructor(message) {
    super(message);
    this.name = "QrCodeError";
  }
}

export function generateQrCodeMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  const version = chooseVersion(bytes.length);
  const codewords = createCodewords(bytes, version);
  let bestMatrix = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = createMatrix(version, codewords, mask);
    drawFormatBits(matrix, mask);
    const penalty = penaltyScore(matrix.modules);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = matrix.modules.map((row) => row.slice());
    }
  }

  return bestMatrix;
}

function chooseVersion(byteLength) {
  for (let version = 1; version < VERSION_DATA.length; version += 1) {
    const lengthBits = version < 10 ? 8 : 16;
    const capacityBits = VERSION_DATA[version].groups.reduce(
      (total, group) => total + group.count * group.dataCodewords * 8,
      0
    );
    if (4 + lengthBits + byteLength * 8 <= capacityBits) return version;
  }
  throw new QrCodeError("QRコードに収まらない長さです");
}

function createCodewords(bytes, version) {
  const versionData = VERSION_DATA[version];
  const dataCodewordCount = versionData.groups.reduce(
    (total, group) => total + group.count * group.dataCodewords,
    0
  );
  const bitBuffer = [];
  appendBits(bitBuffer, 0b0100, 4);
  appendBits(bitBuffer, bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) appendBits(bitBuffer, byte, 8);
  const capacityBits = dataCodewordCount * 8;
  appendBits(bitBuffer, 0, Math.min(4, capacityBits - bitBuffer.length));
  while (bitBuffer.length % 8 !== 0) bitBuffer.push(false);

  const dataCodewords = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    dataCodewords.push(bitsToByte(bitBuffer, i));
  }
  for (let pad = 0; dataCodewords.length < dataCodewordCount; pad += 1) {
    dataCodewords.push(pad % 2 === 0 ? 0xEC : 0x11);
  }

  const blocks = [];
  let offset = 0;
  for (const group of versionData.groups) {
    for (let blockIndex = 0; blockIndex < group.count; blockIndex += 1) {
      const data = dataCodewords.slice(offset, offset + group.dataCodewords);
      offset += group.dataCodewords;
      blocks.push({ data, ecc: reedSolomonRemainder(data, versionData.ecCodewords) });
    }
  }

  const result = [];
  const maxDataLength = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < maxDataLength; i += 1) {
    for (const block of blocks) if (i < block.data.length) result.push(block.data[i]);
  }
  for (let i = 0; i < versionData.ecCodewords; i += 1) {
    for (const block of blocks) result.push(block.ecc[i]);
  }
  return result;
}

function appendBits(buffer, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) buffer.push(((value >>> i) & 1) !== 0);
}

function bitsToByte(bits, offset) {
  let value = 0;
  for (let i = 0; i < 8; i += 1) value = (value << 1) | (bits[offset + i] ? 1 : 0);
  return value;
}

function reedSolomonRemainder(data, degree) {
  const divisor = reedSolomonDivisor(degree);
  const result = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < degree; i += 1) {
      result[i] ^= gfMultiply(divisor[i + 1], factor);
    }
  }
  return result;
}

function reedSolomonDivisor(degree) {
  const result = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= result[j];
      next[j + 1] ^= gfMultiply(result[j], root);
    }
    result.splice(0, result.length, ...next);
    root = gfMultiply(root, 2);
  }
  return result;
}

function gfMultiply(x, y) {
  let product = 0;
  while (y > 0) {
    if ((y & 1) !== 0) product ^= x;
    y >>>= 1;
    x = (x << 1) ^ ((x & 0x80) !== 0 ? 0x11D : 0);
  }
  return product;
}

function createMatrix(version, codewords, mask) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));
  const matrix = { modules, isFunction, size };
  drawFunctionPatterns(matrix, version);
  drawFormatBits(matrix, mask);
  drawCodewords(matrix, codewords, mask);
  return matrix;
}

function setFunctionModule(matrix, x, y, dark) {
  if (x < 0 || x >= matrix.size || y < 0 || y >= matrix.size) return;
  matrix.modules[y][x] = dark;
  matrix.isFunction[y][x] = true;
}

function drawFunctionPatterns(matrix, version) {
  const { size } = matrix;
  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, size - 7, 0);
  drawFinderPattern(matrix, 0, size - 7);

  for (let i = 0; i < size; i += 1) {
    if (!matrix.isFunction[6][i]) setFunctionModule(matrix, i, 6, i % 2 === 0);
    if (!matrix.isFunction[i][6]) setFunctionModule(matrix, 6, i, i % 2 === 0);
  }

  const positions = ALIGNMENT_POSITIONS[version - 1];
  for (const y of positions) {
    for (const x of positions) {
      if (matrix.isFunction[y][x]) continue;
      drawAlignmentPattern(matrix, x, y);
    }
  }

  if (version >= 7) {
    const versionBits = calculateBchCode(version, 0x1F25, 12);
    for (let i = 0; i < 18; i += 1) {
      const bit = ((versionBits >>> i) & 1) !== 0;
      setFunctionModule(matrix, Math.floor(i / 3), i % 3 + size - 11, bit);
      setFunctionModule(matrix, i % 3 + size - 11, Math.floor(i / 3), bit);
    }
  }

  // Reserve the format information area before data placement.
  drawFormatBits(matrix, 0);
}

function drawFinderPattern(matrix, left, top) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6
        && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setFunctionModule(matrix, left + dx, top + dy, dark);
    }
  }
}

function drawAlignmentPattern(matrix, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunctionModule(matrix, centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(matrix, mask) {
  const data = (0b00 << 3) | mask;
  const bits = calculateBchCode(data, 0x537, 10) ^ 0x5412;
  for (let i = 0; i < 15; i += 1) {
    const bit = ((bits >>> i) & 1) !== 0;
    if (i < 6) setFunctionModule(matrix, 8, i, bit);
    else if (i < 8) setFunctionModule(matrix, 8, i + 1, bit);
    else setFunctionModule(matrix, 8, matrix.size - 15 + i, bit);

    if (i < 8) setFunctionModule(matrix, matrix.size - i - 1, 8, bit);
    else if (i < 9) setFunctionModule(matrix, 15 - i, 8, bit);
    else setFunctionModule(matrix, 15 - i - 1, 8, bit);
  }
  setFunctionModule(matrix, 8, matrix.size - 8, true);
}

function calculateBchCode(value, polynomial, shift) {
  let result = value << shift;
  const polynomialDegree = Math.floor(Math.log2(polynomial));
  while (Math.floor(Math.log2(result)) >= polynomialDegree) {
    result ^= polynomial << (Math.floor(Math.log2(result)) - polynomialDegree);
  }
  return (value << shift) | result;
}

function drawCodewords(matrix, codewords, mask) {
  let bitIndex = 0;
  let direction = -1;
  let row = matrix.size - 1;
  for (let right = matrix.size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    while (true) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (matrix.isFunction[row][x]) continue;
        const dark = bitIndex < codewords.length * 8
          && ((codewords[Math.floor(bitIndex / 8)] >>> (7 - bitIndex % 8)) & 1) !== 0;
        matrix.modules[row][x] = dark !== maskFunction(mask, x, row);
        bitIndex += 1;
      }
      row += direction;
      if (row < 0 || row >= matrix.size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
}

function maskFunction(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    case 7: return ((x * y) % 3 + (x + y) % 2) % 2 === 0;
    default: throw new RangeError("Invalid QR mask");
  }
}

function penaltyScore(modules) {
  const size = modules.length;
  let score = 0;
  for (let y = 0; y < size; y += 1) score += penaltyRuns(modules[y]);
  for (let x = 0; x < size; x += 1) score += penaltyRuns(modules.map((row) => row[x]));
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      if (modules[y][x] === modules[y][x + 1] && modules[y][x] === modules[y + 1][x] && modules[y][x] === modules[y + 1][x + 1]) {
        score += 3;
      }
    }
  }
  for (let y = 0; y < size; y += 1) score += penaltyFinderPattern(modules[y]);
  for (let x = 0; x < size; x += 1) score += penaltyFinderPattern(modules.map((row) => row[x]));
  const darkCount = modules.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(darkCount * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

function penaltyRuns(line) {
  let score = 0;
  let runColor = line[0];
  let runLength = 1;
  for (let i = 1; i < line.length; i += 1) {
    if (line[i] === runColor) {
      runLength += 1;
    } else {
      if (runLength >= 5) score += runLength - 2;
      runColor = line[i];
      runLength = 1;
    }
  }
  if (runLength >= 5) score += runLength - 2;
  return score;
}

function penaltyFinderPattern(line) {
  let score = 0;
  for (let i = 0; i + 6 < line.length; i += 1) {
    if (!line[i] || line[i + 1] || !line[i + 2] || !line[i + 3] || !line[i + 4] || line[i + 5] || !line[i + 6]) continue;
    const before = i >= 4 && line.slice(i - 4, i).every((value) => !value);
    const after = i + 11 <= line.length && line.slice(i + 7, i + 11).every((value) => !value);
    if (before || after) score += 40;
  }
  return score;
}
