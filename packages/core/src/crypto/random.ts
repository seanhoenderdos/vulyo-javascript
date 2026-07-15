import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_TOKEN_BYTES = 32;

export function generateToken(byteLength = DEFAULT_TOKEN_BYTES) {
  return randomBytes(byteLength).toString("base64url");
}

export function generatePrefixedKey(prefix: string) {
  return `${prefix}_${generateToken(24)}`;
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeCompareHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
