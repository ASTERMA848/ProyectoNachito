/**
 * Rate limiter en memoria simple para proteger endpoints críticos.
 * En producción con múltiples instancias, reemplazar por Redis.
 */

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

// Limpiar entradas vencidas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(store)) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Verifica si una clave (IP, username, etc.) excedió el límite.
 * @param key      Identificador único (ej: `login:${ip}`)
 * @param limit    Máximo de intentos permitidos
 * @param windowMs Ventana de tiempo en milisegundos
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true };
}
