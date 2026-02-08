/**
 * Simple cache for Docker container listings
 * Prevents redundant docker ps calls
 */

import type { DockerContainer } from './docker.js';

interface CacheEntry {
  containers: DockerContainer[];
  timestamp: number;
}

class DockerCache {
  private cache = new Map<string, CacheEntry>();
  private ttl = 1000; // 1 second TTL

  get(composeFile: string): DockerContainer[] | null {
    const entry = this.cache.get(composeFile);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      this.cache.delete(composeFile);
      return null;
    }

    return entry.containers;
  }

  set(composeFile: string, containers: DockerContainer[]): void {
    this.cache.set(composeFile, {
      containers,
      timestamp: Date.now(),
    });
  }

  clear(composeFile?: string): void {
    if (composeFile) {
      this.cache.delete(composeFile);
    } else {
      this.cache.clear();
    }
  }
}

export const dockerCache = new DockerCache();
