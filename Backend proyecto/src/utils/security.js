import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_PREFIX = "scrypt";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password, storedPassword) {
  const stored = String(storedPassword || "");

  if (!stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    return safeEqual(String(password), stored);
  }

  const [, salt, expectedHash] = stored.split("$");

  if (!salt || !expectedHash) return false;

  const actualHash = scryptSync(String(password), salt, 64).toString("hex");
  return safeEqual(actualHash, expectedHash);
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(content, secret) {
  return createHmac("sha256", secret).update(content).digest("base64url");
}

export function createToken(user, secret, ttlSeconds = 60 * 60 * 8) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: user.id,
    rol: user.rol,
    iat: now,
    exp: now + ttlSeconds,
  });
  const content = `${header}.${payload}`;

  return `${content}.${sign(content, secret)}`;
}

export function verifyToken(token, secret) {
  const [header, payload, signature] = String(token || "").split(".");

  if (!header || !payload || !signature) return null;

  const content = `${header}.${payload}`;

  if (!safeEqual(signature, sign(content, secret))) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);

    if (!decoded.sub || !decoded.rol || decoded.exp <= now) return null;

    return decoded;
  } catch {
    return null;
  }
}

export function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
