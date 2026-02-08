/**
 * Simple TTL (Time-To-Live) cache for resource monitoring data
 * Prevents redundant system calls when data is still fresh
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;

  /**
   * @param ttl Time-to-live in milliseconds (default: 2000ms)
   */
  constructor(ttl: number = 2000) {
    this.ttl = ttl;
  }

  /**
   * Get cached value if still valid, undefined otherwise
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a key exists and is still valid
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Clear a specific key or all keys
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}
