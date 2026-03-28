/**
 * LRU cache for completed prompts.
 *
 * Why cache?
 *   - A user often hits the same completion point after undoing/redoing.
 *   - Re-running inference for identical prompts wastes CPU cycles.
 *   - Cache hit returns in <1ms vs 200-800ms for inference.
 *
 * Cache key = SHA-256 of (prefix + suffix) after trimming.
 * TTL = 60 seconds — stale completions are worse than fresh ones.
 */
import { createHash } from "crypto";
const TTL_MS = 60_000;
const MAX_SIZE = 200;
const store = new Map();
function evictOldest() {
    const oldest = store.keys().next().value;
    if (oldest)
        store.delete(oldest);
}
export function cacheKey(prefix, suffix) {
    return createHash("sha256").update(prefix + "\x00" + suffix).digest("hex");
}
export function getCache(key) {
    const entry = store.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    // Move to end (LRU behavior with Map insertion order)
    store.delete(key);
    store.set(key, entry);
    return entry.completion;
}
export function setCache(key, completion) {
    if (store.size >= MAX_SIZE)
        evictOldest();
    store.set(key, { completion, expiresAt: Date.now() + TTL_MS });
}
