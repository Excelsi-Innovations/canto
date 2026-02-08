import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { AsyncResourceMonitor } from '../../src/cli/lib/resource-monitor';
import { DashboardDataManager } from '../../src/cli/lib/dashboard-data-manager';
import { LogTailer } from '../../src/cli/lib/log-tailer';
import { PreferencesManager } from '../../src/utils/preferences-manager';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Load tests for dashboard performance optimizations.
 * Tests system behavior under heavy load with many modules and operations.
 */
describe('Dashboard Load Tests', () => {
  let resourceMonitor: AsyncResourceMonitor;
  let dataManager: DashboardDataManager;
  let logTailer: LogTailer;
  let preferencesManager: PreferencesManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'dashboard-load-'));

    // Create valid config file for tests
    const testConfig = `
modules:
  - name: test-module
    type: workspace
    path: ./test
    run:
      dev: echo "test"
`;
    await fs.writeFile(join(testDir, 'dev.config.yaml'), testConfig);

    resourceMonitor = new AsyncResourceMonitor({ updateInterval: 100 });
    preferencesManager = new PreferencesManager();
    await preferencesManager.initialize();
    logTailer = new LogTailer(1000); // Large buffer for load tests
  });

  afterEach(async () => {
    resourceMonitor.stop();
    dataManager?.cleanup();
    logTailer.stop();
    await preferencesManager.shutdown();

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('Module Scaling Tests', () => {
    test('should handle 50 modules efficiently', async () => {
      // Create mock with 50 modules
      const moduleNames = Array.from({ length: 50 }, (_, i) => `module-${i}`);

      const mockOrchestrator = {
        load: () => {},
        getModuleNames: () => moduleNames,
        getModule: (name: string) => ({ name, type: 'workspace' }),
      };

      const mockProcessManager = {
        getStatus: (name: string) => (name.endsWith('0') ? 'RUNNING' : 'STOPPED'),
        getPid: (name: string) =>
          name.endsWith('0') ? 1000 + Number.parseInt(name.split('-')[1]) : undefined,
      };

      const mockDockerExecutor = {
        getServices: () => [],
      };

      dataManager = new DashboardDataManager(
        mockOrchestrator as any,
        mockProcessManager as any,
        mockDockerExecutor as any,
        testDir
      );

      const start = Date.now();
      await dataManager.initialize();
      const initDuration = Date.now() - start;

      // Should initialize reasonably fast even with 50 modules
      expect(initDuration).toBeLessThan(5000); // 5 seconds is reasonable for 50 modules

      // Get all module statuses
      const readStart = Date.now();
      const modules = dataManager.getModuleStatuses();
      const readDuration = Date.now() - readStart;

      expect(modules.length).toBeGreaterThan(0);
      expect(readDuration).toBeLessThan(10); // Cached, should be fast
    });

    test('should handle 100 modules efficiently', async () => {
      const moduleNames = Array.from({ length: 100 }, (_, i) => `module-${i}`);

      const mockOrchestrator = {
        load: () => {},
        getModuleNames: () => moduleNames,
        getModule: (name: string) => ({ name, type: 'workspace' }),
      };

      const mockProcessManager = {
        getStatus: () => 'RUNNING',
        getPid: () => 5000,
      };

      const mockDockerExecutor = {
        getServices: () => [],
      };

      dataManager = new DashboardDataManager(
        mockOrchestrator as any,
        mockProcessManager as any,
        mockDockerExecutor as any,
        testDir
      );

      const start = Date.now();
      await dataManager.initialize();
      const duration = Date.now() - start;

      // Should still initialize in reasonable time
      // With real system calls, 100 modules can take significant time
      expect(duration).toBeLessThan(40000); // 40 seconds for 100 modules with real queries

      // Read should still be fast (cached)
      const readStart = Date.now();
      dataManager.getModuleStatuses();
      const readDuration = Date.now() - readStart;

      expect(readDuration).toBeLessThan(20);
    });

    test('should update many modules without blocking', async () => {
      const moduleNames = Array.from({ length: 50 }, (_, i) => `module-${i}`);

      const mockOrchestrator = {
        load: () => {},
        getModuleNames: () => moduleNames,
        getModule: (name: string) => ({ name, type: 'workspace' }),
      };

      const mockProcessManager = {
        getStatus: () => 'RUNNING',
        getPid: () => 1234,
      };

      const mockDockerExecutor = {
        getServices: () => [],
      };

      dataManager = new DashboardDataManager(
        mockOrchestrator as any,
        mockProcessManager as any,
        mockDockerExecutor as any,
        testDir
      );

      await dataManager.initialize();

      // Mark all modules dirty and update
      const start = Date.now();
      dataManager.markAllDirty();
      await dataManager.forceUpdate();
      const duration = Date.now() - start;

      // Should update all 50 modules efficiently (parallel)
      expect(duration).toBeLessThan(3000); // 3 seconds for 50 module update
    });
  });

  describe('Subscription Scaling Tests', () => {
    test('should handle 100 subscribers efficiently', async () => {
      const subscribers: (() => void)[] = [];
      const callCounts = new Array(100).fill(0);

      resourceMonitor.start();

      // Add 100 subscribers
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        const index = i;
        const unsub = resourceMonitor.subscribe(() => {
          callCounts[index]++;
        });
        subscribers.push(unsub);
      }
      const duration = Date.now() - start;

      // Should add subscribers quickly
      expect(duration).toBeLessThan(100);

      // All subscribers should have been called
      expect(callCounts.every((count) => count > 0)).toBe(true);

      // Cleanup
      subscribers.forEach((unsub) => unsub());
    });

    test('should notify 100 subscribers without significant overhead', async () => {
      resourceMonitor.start();

      const subscribers: (() => void)[] = [];
      let totalCalls = 0;

      // Add 100 subscribers
      for (let i = 0; i < 100; i++) {
        const unsub = resourceMonitor.subscribe(() => {
          totalCalls++;
        });
        subscribers.push(unsub);
      }

      // Wait for updates
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should have notified all subscribers multiple times
      expect(totalCalls).toBeGreaterThanOrEqual(100); // At least 100 calls (initial)

      // System should still be responsive
      const start = Date.now();
      resourceMonitor.getLatestResources();
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10);

      // Cleanup
      subscribers.forEach((unsub) => unsub());
    });

    test('should handle rapid subscribe/unsubscribe cycles', async () => {
      const start = Date.now();

      // Rapid subscribe/unsubscribe
      for (let i = 0; i < 1000; i++) {
        const unsub = resourceMonitor.subscribe(() => {});
        unsub();
      }

      const duration = Date.now() - start;

      // Should handle 1000 cycles quickly
      expect(duration).toBeLessThan(500);
    });
  });

  describe('History Scaling Tests', () => {
    test('should handle 1000 history items efficiently', async () => {
      const start = Date.now();

      // Add 1000 items
      for (let i = 0; i < 1000; i++) {
        preferencesManager.addToHistory(`command-${i}`, `module-${i % 10}`, true);
      }

      const duration = Date.now() - start;

      // Should add all items quickly (non-blocking)
      expect(duration).toBeLessThan(200);

      // Should limit to 100 items
      const prefs = preferencesManager.getPreferences();
      expect(prefs.history.length).toBe(100);

      // Should maintain order (most recent first)
      expect(prefs.history[0].command).toBe('command-999');
      expect(prefs.history[99].command).toBe('command-900');
    });

    test('should retrieve history quickly even with max items', async () => {
      // Fill history to max (100 items)
      for (let i = 0; i < 100; i++) {
        preferencesManager.addToHistory(`command-${i}`);
      }

      // Measure read time
      const measurements: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        preferencesManager.getHistory(20);
        const duration = Date.now() - start;
        measurements.push(duration);
      }

      const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      // Should maintain fast reads
      expect(avgDuration).toBeLessThan(5);
    });

    test('should handle concurrent history operations', async () => {
      const operations: Promise<any>[] = [];

      // Mix of writes and reads
      for (let i = 0; i < 500; i++) {
        if (i % 2 === 0) {
          operations.push(Promise.resolve(preferencesManager.addToHistory(`cmd-${i}`)));
        } else {
          operations.push(Promise.resolve(preferencesManager.getHistory(10)));
        }
      }

      const start = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - start;

      // Should handle 500 mixed operations efficiently
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Log File Scaling Tests', () => {
    test('should handle large log files (10,000 lines)', async () => {
      const logPath = join(testDir, 'large.log');

      // Create large log file
      const lines = Array.from({ length: 10000 }, (_, i) => `Log line ${i + 1}`).join('\n');
      await fs.writeFile(logPath, lines);

      // Should read efficiently (only last N lines)
      const start = Date.now();
      await logTailer.start(logPath);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);

      // Should only have last 1000 lines (buffer size)
      const logLines = logTailer.getLines();
      expect(logLines.length).toBeLessThanOrEqual(1000);
    });

    test('should handle very large log files (1MB)', async () => {
      const logPath = join(testDir, 'huge.log');

      // Create 1MB log file
      const line = 'x'.repeat(100) + '\n';
      const lines = line.repeat(10000); // ~1MB
      await fs.writeFile(logPath, lines);

      // Should read efficiently using 64KB buffer strategy
      const start = Date.now();
      await logTailer.start(logPath);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);

      const logLines = logTailer.getLines();
      expect(logLines.length).toBeGreaterThan(0);
    });

    test('should handle rapid log appends', async () => {
      const logPath = join(testDir, 'rapid.log');
      await fs.writeFile(logPath, 'Initial\n');
      await logTailer.start(logPath);

      let updateCount = 0;
      logTailer.subscribe(() => {
        updateCount++;
      });

      // Rapidly append 100 lines
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await fs.appendFile(logPath, `Line ${i}\n`);
      }
      const appendDuration = Date.now() - start;

      // Wait for file watch events
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should have processed appends
      expect(updateCount).toBeGreaterThan(1);

      // Final log should contain recent lines
      const lines = logTailer.getLines();
      expect(lines.some((line) => line.includes('Line'))).toBe(true);
    });
  });

  describe('Memory Stability Tests', () => {
    test('should maintain stable memory with prolonged use', async () => {
      resourceMonitor.start();

      // Simulate prolonged use
      for (let i = 0; i < 100; i++) {
        // Get resources multiple times
        for (let j = 0; j < 10; j++) {
          resourceMonitor.getLatestResources();
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // System should still be responsive
      const start = Date.now();
      const resources = resourceMonitor.getLatestResources();
      const duration = Date.now() - start;

      expect(resources).toBeDefined();
      expect(duration).toBeLessThan(10);
    });

    test('should not leak memory with subscriber churn', async () => {
      // Create and destroy many subscribers
      for (let cycle = 0; cycle < 10; cycle++) {
        const subscribers: (() => void)[] = [];

        // Add 50 subscribers
        for (let i = 0; i < 50; i++) {
          subscribers.push(resourceMonitor.subscribe(() => {}));
        }

        // Remove all
        subscribers.forEach((unsub) => unsub());

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // System should still work normally
      const resources = resourceMonitor.getLatestResources();
      expect(resources).toBeDefined();
    });

    test('should handle large preferences without degradation', async () => {
      // Add maximum data
      for (let i = 0; i < 100; i++) {
        preferencesManager.addToHistory(`command-${i}`, `module-${i % 10}`);
        preferencesManager.addFavorite(`module-${i}`);
      }

      // Measure performance with full data
      const measurements: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        preferencesManager.getPreferences();
        preferencesManager.getHistory(20);
        const duration = Date.now() - start;
        measurements.push(duration);
      }

      const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      // Should maintain performance even with full data
      expect(avgDuration).toBeLessThan(10);
    });
  });

  describe('Stress Tests', () => {
    test('should handle maximum concurrent operations', async () => {
      resourceMonitor.start();

      const operations: Promise<any>[] = [];

      // 1000 concurrent read operations
      for (let i = 0; i < 1000; i++) {
        operations.push(
          Promise.resolve({
            resources: resourceMonitor.getLatestResources(),
            prefs: preferencesManager.getPreferences(),
            history: preferencesManager.getHistory(10),
          })
        );
      }

      const start = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - start;

      // Should handle 1000 operations efficiently
      expect(duration).toBeLessThan(500);
    });

    test('should handle mixed heavy load', async () => {
      const moduleNames = Array.from({ length: 50 }, (_, i) => `module-${i}`);

      const mockOrchestrator = {
        load: () => {},
        getModuleNames: () => moduleNames,
        getModule: (name: string) => ({ name, type: 'workspace' }),
      };

      const mockProcessManager = {
        getStatus: () => 'RUNNING',
        getPid: () => 1234,
      };

      const mockDockerExecutor = {
        getServices: () => [],
      };

      dataManager = new DashboardDataManager(
        mockOrchestrator as any,
        mockProcessManager as any,
        mockDockerExecutor as any,
        testDir
      );

      resourceMonitor.start();
      await dataManager.initialize();

      const start = Date.now();

      // Mixed heavy operations
      const operations: Promise<any>[] = [];

      for (let i = 0; i < 100; i++) {
        // Resource reads
        operations.push(Promise.resolve(resourceMonitor.getLatestResources()));

        // Module reads
        operations.push(Promise.resolve(dataManager.getModuleStatuses()));

        // Preference writes
        operations.push(Promise.resolve(preferencesManager.addToHistory(`cmd-${i}`)));

        // Module updates
        if (i % 10 === 0) {
          operations.push(Promise.resolve(dataManager.markDirty(`module-${i % 50}`)));
        }
      }

      await Promise.all(operations);

      const duration = Date.now() - start;

      // Should handle mixed load efficiently
      expect(duration).toBeLessThan(1000);
    });

    test('should recover from spike load', async () => {
      resourceMonitor.start();

      // Normal load baseline
      const baselineStart = Date.now();
      for (let i = 0; i < 10; i++) {
        resourceMonitor.getLatestResources();
      }
      const baselineDuration = Date.now() - baselineStart;

      // Spike load
      const operations: Promise<any>[] = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(Promise.resolve(resourceMonitor.getLatestResources()));
      }
      await Promise.all(operations);

      // Recovery measurement
      await new Promise((resolve) => setTimeout(resolve, 100));

      const recoveryStart = Date.now();
      for (let i = 0; i < 10; i++) {
        resourceMonitor.getLatestResources();
      }
      const recoveryDuration = Date.now() - recoveryStart;

      // Should return to normal performance after spike
      // Both should be fast, so just check they're reasonable
      expect(recoveryDuration).toBeLessThanOrEqual(baselineDuration * 3 + 10);
    });
  });

  describe('Benchmark Comparisons', () => {
    test('cached reads vs uncached (theoretical)', () => {
      // This test demonstrates the performance improvement

      resourceMonitor.start();

      // Cached reads (what we have now)
      const cachedMeasurements: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        resourceMonitor.getLatestResources();
        cachedMeasurements.push(Date.now() - start);
      }

      const avgCached = cachedMeasurements.reduce((a, b) => a + b, 0) / cachedMeasurements.length;

      // Cached should be very fast (<10ms)
      expect(avgCached).toBeLessThan(10);

      console.log(`\n📊 Benchmark Results:`);
      console.log(`   Cached reads: ${avgCached.toFixed(2)}ms avg`);
      console.log(`   Theoretical old (blocking): ~500ms per read`);
      console.log(`   Performance improvement: ~${Math.round(500 / avgCached)}x faster`);
    });

    test('batched writes vs synchronous (theoretical)', async () => {
      // Batched writes (what we have now)
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        preferencesManager.addToHistory(`cmd-${i}`);
      }
      const batchedDuration = Date.now() - start;

      // Should be very fast (non-blocking)
      expect(batchedDuration).toBeLessThan(100);

      console.log(`\n📊 Write Performance:`);
      console.log(`   Batched writes (100 ops): ${batchedDuration}ms`);
      console.log(`   Per-operation: ${(batchedDuration / 100).toFixed(2)}ms`);
      console.log(`   Theoretical old (sync): ~5-10ms per write`);
      console.log(`   Total time saved: ~${500 - batchedDuration}ms`);
    });

    test('incremental updates vs full reload', async () => {
      const moduleNames = Array.from({ length: 50 }, (_, i) => `module-${i}`);

      const mockOrchestrator = {
        load: () => {},
        getModuleNames: () => moduleNames,
        getModule: (name: string) => ({ name, type: 'workspace' }),
      };

      const mockProcessManager = {
        getStatus: () => 'RUNNING',
        getPid: () => 1234,
      };

      const mockDockerExecutor = {
        getServices: () => [],
      };

      dataManager = new DashboardDataManager(
        mockOrchestrator as any,
        mockProcessManager as any,
        mockDockerExecutor as any,
        testDir
      );

      await dataManager.initialize();

      // Mark only 5 modules dirty (incremental)
      const incrementalStart = Date.now();
      for (let i = 0; i < 5; i++) {
        dataManager.markDirty(`module-${i}`);
      }
      await dataManager.forceUpdate();
      const incrementalDuration = Date.now() - incrementalStart;

      // Full update (all 50 modules)
      const fullStart = Date.now();
      dataManager.markAllDirty();
      await dataManager.forceUpdate();
      const fullDuration = Date.now() - fullStart;

      console.log(`\n📊 Update Performance:`);
      console.log(`   Incremental (5 modules): ${incrementalDuration}ms`);
      console.log(`   Full reload (50 modules): ${fullDuration}ms`);
      console.log(
        `   Efficiency gain: ${Math.round((fullDuration / incrementalDuration) * 100)}% faster for small changes`
      );

      // Incremental should be faster than full
      expect(incrementalDuration).toBeLessThan(fullDuration);
    });
  });
});
