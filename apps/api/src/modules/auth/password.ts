import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString("base64")}:${derived.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) {
    return false;
  }
  const saltB64 = parts[0];
  const hashB64 = parts[1];
  if (saltB64 === undefined || hashB64 === undefined) {
    return false;
  }
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = (await scryptAsync(
    password,
    salt,
    expected.length,
  )) as Buffer;
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
