const JWT_ALGORITHMS = {
  RS256: {
    importAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    verifyAlgorithm: { name: "RSASSA-PKCS1-v1_5" }
  },
  RS384: {
    importAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
    verifyAlgorithm: { name: "RSASSA-PKCS1-v1_5" }
  },
  RS512: {
    importAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
    verifyAlgorithm: { name: "RSASSA-PKCS1-v1_5" }
  },
  PS256: {
    importAlgorithm: { name: "RSA-PSS", hash: "SHA-256" },
    verifyAlgorithm: { name: "RSA-PSS", saltLength: 32 }
  },
  PS384: {
    importAlgorithm: { name: "RSA-PSS", hash: "SHA-384" },
    verifyAlgorithm: { name: "RSA-PSS", saltLength: 48 }
  },
  PS512: {
    importAlgorithm: { name: "RSA-PSS", hash: "SHA-512" },
    verifyAlgorithm: { name: "RSA-PSS", saltLength: 64 }
  },
  ES256: {
    importAlgorithm: { name: "ECDSA", namedCurve: "P-256" },
    verifyAlgorithm: { name: "ECDSA", hash: "SHA-256" }
  },
  ES384: {
    importAlgorithm: { name: "ECDSA", namedCurve: "P-384" },
    verifyAlgorithm: { name: "ECDSA", hash: "SHA-384" }
  },
  ES512: {
    importAlgorithm: { name: "ECDSA", namedCurve: "P-521" },
    verifyAlgorithm: { name: "ECDSA", hash: "SHA-512" }
  }
};

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_JWT_CHARS = 16 * 1024;
const MAX_JWKS_BYTES = 64 * 1024;
const MAX_JWKS_KEYS = 100;
let jwksCache = null;

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function authenticateRequest(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].length > MAX_JWT_CHARS) {
    throw new AuthError("ログインが必要です", 401);
  }

  const requiredConfig = ["AUTH_JWKS_URL", "AUTH_ISSUER", "AUTH_AUDIENCE"];
  if (requiredConfig.some((key) => !env[key])) {
    throw new AuthError("認証基盤が未設定です", 503);
  }

  const claims = await verifyJwt(match[1], env);
  return { id: claims.sub };
}

async function verifyJwt(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthError("認証情報が不正です", 401);
  }

  const header = decodeJson(parts[0]);
  const claims = decodeJson(parts[1]);
  const algorithm = JWT_ALGORITHMS[header.alg];
  if (
    !algorithm ||
    typeof header.kid !== "string" ||
    !header.kid ||
    header.kid.length > 200 ||
    (Array.isArray(header.crit) && header.crit.length > 0) ||
    header.b64 === false
  ) {
    throw new AuthError("認証方式に対応していません", 401);
  }

  const keys = await loadJwks(env.AUTH_JWKS_URL);
  const jwk = findVerificationKey(keys, header);
  if (!jwk) {
    jwksCache = null;
    const refreshedKeys = await loadJwks(env.AUTH_JWKS_URL);
    const refreshedJwk = findVerificationKey(refreshedKeys, header);
    if (!refreshedJwk) {
      throw new AuthError("認証鍵が見つかりません", 401);
    }
    await assertSignature(parts, refreshedJwk, algorithm);
  } else {
    await assertSignature(parts, jwk, algorithm);
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== env.AUTH_ISSUER || !audienceIncludes(claims.aud, env.AUTH_AUDIENCE)) {
    throw new AuthError("認証対象が一致しません", 401);
  }
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 512) {
    throw new AuthError("ユーザー情報がありません", 401);
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= now) {
    throw new AuthError("認証の有効期限が切れています", 401);
  }
  if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 60)) {
    throw new AuthError("認証をまだ利用できません", 401);
  }
  if (claims.iat !== undefined && (!Number.isFinite(claims.iat) || claims.iat > now + 60)) {
    throw new AuthError("認証情報の発行日時が不正です", 401);
  }

  return claims;
}

async function assertSignature(parts, jwk, algorithm) {
  let valid;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      algorithm.importAlgorithm,
      false,
      ["verify"]
    );
    valid = await crypto.subtle.verify(
      algorithm.verifyAlgorithm,
      key,
      base64UrlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
  } catch {
    throw new AuthError("認証署名が不正です", 401);
  }
  if (!valid) {
    throw new AuthError("認証署名が不正です", 401);
  }
}

async function loadJwks(url) {
  const now = Date.now();
  if (jwksCache?.url === url && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "error"
    });
  } catch {
    throw new AuthError("認証鍵を取得できません", 503);
  }
  if (!response.ok) {
    throw new AuthError("認証鍵を取得できません", 503);
  }
  const body = await readLimitedJson(response);
  if (!Array.isArray(body.keys) || body.keys.length === 0 || body.keys.length > MAX_JWKS_KEYS) {
    throw new AuthError("認証鍵の形式が不正です", 503);
  }
  const keys = body.keys.filter((key) => key && typeof key === "object" && !Array.isArray(key));
  if (keys.length !== body.keys.length) {
    throw new AuthError("認証鍵の形式が不正です", 503);
  }
  jwksCache = { url, keys, expiresAt: now + JWKS_CACHE_TTL_MS };
  return keys;
}

async function readLimitedJson(response) {
  const contentLengthValue = response.headers.get("Content-Length");
  if (contentLengthValue) {
    const contentLength = Number(contentLengthValue);
    if (Number.isFinite(contentLength) && contentLength > MAX_JWKS_BYTES) {
      throw new AuthError("認証鍵の形式が不正です", 503);
    }
  }
  if (!response.body) {
    throw new AuthError("認証鍵の形式が不正です", 503);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_JWKS_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // The size error below is actionable even if stream cancellation fails.
      }
      throw new AuthError("認証鍵の形式が不正です", 503);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AuthError("認証鍵の形式が不正です", 503);
  }
}

function audienceIncludes(audience, expected) {
  return Array.isArray(audience) ? audience.includes(expected) : audience === expected;
}

function findVerificationKey(keys, header) {
  return keys.find((key) => (
    key.kid === header.kid &&
    (key.alg === undefined || key.alg === header.alg) &&
    (key.use === undefined || key.use === "sig") &&
    (key.key_ops === undefined || (Array.isArray(key.key_ops) && key.key_ops.includes("verify")))
  ));
}

function decodeJson(value) {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JWT part must be an object");
    }
    return parsed;
  } catch {
    throw new AuthError("認証情報の形式が不正です", 401);
  }
}

function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new Error("Invalid base64url value");
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
