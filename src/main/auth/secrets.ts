import crypto from "node:crypto";

const HASH_KEY_LENGTH = 32;
const SCRYPT_PREFIX = "scrypt";

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

export const validateAdminPin = (pin: string): void => {
  if (!/^[0-9]{4,12}$/.test(pin)) {
    throw new Error("Admin PIN must be 4 to 12 digits.");
  }
};
