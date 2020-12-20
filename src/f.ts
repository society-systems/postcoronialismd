import crypto from "crypto";

export function uint8ArrayToHexString(i: Uint8Array) {
  return Buffer.from(i).toString("hex");
}

export function hexStringToUint8Array(s: string) {
  return Uint8Array.from(Buffer.from(s, "hex"));
}

export function sha256(data: crypto.BinaryLike) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

export function uint32toUint8Array(n: number) {
  if (n < 0 || n >= 2 ** 32) {
    throw new RangeError("Number should be between 0 and 4294967296");
  }
  return Uint8Array.from([
    (n >> 24) & 0xff,
    (n >> 16) & 0xff,
    (n >> 8) & 0xff,
    n & 0xff,
  ]);
}

export function uint8ArrayToUint32(a: Uint8Array) {
  if (a.length !== 4) {
    throw new RangeError("Array should have 4 bytes");
  }
  // Bitwise operations convert the number to a 32-bit signed int,
  // so we need to go back to an unsigned representation by using
  // the unsigned shift operator `>>>`.
  return ((a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3]) >>> 0;
}
