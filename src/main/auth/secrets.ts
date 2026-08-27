import crypto from "node:crypto";
import { safeStorage } from "electron";

const HASH_KEY_LENGTH = 32;
const SCRYPT_PREFIX = "scrypt";
const SAFE_STORAGE_PREFIX = "safe-storage";
const BASE64_PREFIX = "base64";

export const generateApiToken = (): string => {
  return `pa_${crypto.randomBytes(24).toString("base64url")}`;
};

export const hashSecret = (secret: string): string => {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(secret, salt, HASH_KEY_LENGTH).toString("base64url");
  return `${SCRYPT_PREFIX}:${salt}:${hash}`;
};

export const verifySecret = (secret: string, storedHash: string | undefined): boolean => {
  if (!storedHash) {
    return false;
  }

  const [prefix, salt, expectedHash] = storedHash.split(":");
  if (prefix !== SCRYPT_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const actual = crypto.scryptSync(secret, salt, HASH_KEY_LENGTH);
  const expected = Buffer.from(expectedHash, "base64url");

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
};

export const encryptLocalSecret = (secret: string): string => {
  if (safeStorage.isEncryptionAvailable()) {
    return `${SAFE_STORAGE_PREFIX}:${safeStorage.encryptString(secret).toString("base64")}`;
  }

  return `${BASE64_PREFIX}:${Buffer.from(secret, "utf8").toString("base64")}`;
};

export const decryptLocalSecret = (stored: string | null | undefined): string | null => {
  if (!stored) {
    return null;
  }

  const [prefix, value] = stored.split(":", 2);
  if (!prefix || !value) {
    return null;
  }

  if (prefix === SAFE_STORAGE_PREFIX) {
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  }

  if (prefix === BASE64_PREFIX) {
    return Buffer.from(value, "base64").toString("utf8");
  }

  return null;
};
