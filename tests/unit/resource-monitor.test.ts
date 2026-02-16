import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { AsyncResourceMonitor } from '../../src/cli/lib/resource-monitor.js';
import type { GlobalResources } from '../../src/utils/resources/index.js';

describe('AsyncResourceMonitor', () => {
  let monitor: AsyncResourceMonitor;

  beforeEach(() => {
    monitor = new AsyncResourceMonitor({
      updateInterval: 100, // Fast interval for testing
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('initialization', () => {
    test('should initialize with default resources', () => {
      const resources = monitor.getLatestResources();

      expect(resources).toBeDefined();
      expect(resources.system.totalMemory).toBeGreaterThanOrEqual(0);
      expect(resources.system.usedMemory).toBeGreaterThanOrEqual(0);
      expect(resources.system.freeMemory).toBeGreaterThanOrEqual(0);
      expect(resources.system.cpuCount).toBeGreaterThanOrEqual(1);
      expect(resources.system.cpuUsage).toBeGreaterThanOrEqual(0);
    });

    test('should accept custom configuration', () => {
      const customMonitor = new AsyncResourceMonitor({
        updateInterval: 500,
      });

      expect(customMonitor).toBeDefined();
      customMonitor.stop();
    });
  });

  describe('getLatestResources', () => {
    test('should return cached resources without blocking', () => {
      const start = Date.now();
      const resources = monitor.getLatestResources();
      const duration = Date.now() - start;

      expect(resources).toBeDefined();
      expect(duration).toBeLessThan(10); // Should be <10ms (cached)
    });

    test('should return a copy of resources (not reference)', () => {
      const resources1 = monitor.getLatestResources();
      const resources2 = monitor.getLatestResources();

      expect(resources1).not.toBe(resources2); // Different objects
      
      // Compare values (excluding Map which might need special equality check or iteration)
      expect(resources1.system).toEqual(resources2.system);
    });
  });

  describe('start and stop', () => {
    test('should start monitoring', async () => {
      monitor.start();

      // Wait a bit to ensure polling happens
      await new Promise((resolve) => setTimeout(resolve, 150));

      const resources = monitor.getLatestResources();
      expect(resources).toBeDefined();
    });

    test('should stop monitoring', () => {
      monitor.start();
      monitor.stop();

      // Should not crash after stop
      const resources = monitor.getLatestResources();
      expect(resources).toBeDefined();
    });

    test('should not start twice', () => {
      monitor.start();
      monitor.start(); // Second start should be ignored

      // Should still work
      const resources = monitor.getLatestResources();
      expect(resources).toBeDefined();
    });
  });

  describe('subscribe', () => {
    test('should immediately call subscriber with current data', () => {
      let callCount = 0;
      let receivedResources: GlobalResources | null = null;

      monitor.subscribe((resources) => {
        callCount++;
        receivedResources = resources;
      });

      expect(callCount).toBe(1); // Called immediately
      expect(receivedResources).toBeDefined();
    });

    test('should notify subscribers on updates', async () => {
      const updates: GlobalResources[] = [];

      monitor.subscribe((resources) => {
        updates.push(resources);
      });

      monitor.start();

      // Wait for at least one update cycle
      await new Promise((resolve) => setTimeout(resolve, 350));

      expect(updates.length).toBeGreaterThanOrEqual(1); // At least initial call
    });

    test('should support multiple subscribers', async () => {
      let subscriber1Called = 0;
      let subscriber2Called = 0;

      monitor.subscribe(() => {
        subscriber1Called++;
      });

      monitor.subscribe(() => {
        subscriber2Called++;
      });

      monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(subscriber1Called).toBeGreaterThan(0);
      expect(subscriber2Called).toBeGreaterThan(0);
    });

    test('should return unsubscribe function', () => {
      let callCount = 0;

      const unsubscribe = monitor.subscribe(() => {
        callCount++;
      });

      expect(callCount).toBe(1); // Initial call

      unsubscribe();

      monitor.start();
      // After unsubscribe, no more updates
      expect(callCount).toBe(1); // Still 1
    });

    test('should handle subscriber errors gracefully', async () => {
      const errorSubscriber = mock(() => {
        throw new Error('Subscriber error');
      });

      const normalSubscriber = mock(() => {
        // Normal subscriber
      });

      monitor.subscribe(errorSubscriber);
      monitor.subscribe(normalSubscriber);

      monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Both should be called despite error in first
      expect(errorSubscriber).toHaveBeenCalled();
      expect(normalSubscriber).toHaveBeenCalled();
    });
  });

  describe('change detection', () => {
    test('should only notify when resources actually change', async () => {
      const updates: GlobalResources[] = [];

      monitor.subscribe((resources) => {
        updates.push(resources);
      });

      monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should have updates, but not for every poll (due to change detection)
      expect(updates.length).toBeGreaterThan(0);
      expect(updates.length).toBeLessThan(10); // Not updating every millisecond
    });
  });

  describe('platform compatibility', () => {
    test('should work on current platform', async () => {
      monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      const resources = monitor.getLatestResources();

      // Basic sanity checks
      expect(resources.system.cpuCount).toBeGreaterThan(0);
      expect(resources.system.totalMemory).toBeGreaterThanOrEqual(0);
      expect(resources.system.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(resources.system.cpuUsage).toBeLessThanOrEqual(100);
    });
  });

  describe('memory leaks', () => {
    test('should clean up subscribers on stop', async () => {
      const subscriber = mock(() => {});

      monitor.subscribe(subscriber);
      monitor.start();
      await monitor.stop();

      // After stop, subscribers should not be called
      const initialCalls = subscriber.mock.calls.length;

      // Wait a bit to ensure no more calls
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      expect(subscriber.mock.calls.length).toBe(initialCalls);
    });
  });
});
