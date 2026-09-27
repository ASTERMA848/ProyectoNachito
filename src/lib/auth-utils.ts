import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/**
 * Hashea una contraseña usando bcrypt (seguro para almacenamiento).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifica una contraseña contra un hash bcrypt.
 * También acepta hashes SHA-256 legacy para migración transparente.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  // Hash bcrypt comienza con $2b$ o $2a$
  if (storedHash.startsWith("$2b$") || storedHash.startsWith("$2a$")) {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy: SHA-256 — permite login pero fuerza re-hash en el próximo inicio
  const sha256 = crypto.createHash("sha256").update(password).digest("hex");
  return sha256 === storedHash;
}

/**
 * Indica si un hash es legacy (SHA-256) y debe ser migrado.
 */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith("$2b$") && !hash.startsWith("$2a$");
}

/**
 * Genera un token aleatorio criptográficamente seguro.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
