# Dashboard Performance Optimization - Implementation Plan

**Status**: 🚧 PLANNED  
**Priority**: 🔴 HIGH - Critical performance issues blocking production readiness  
**Estimated Effort**: 2-3 days (16-24 hours)  
**Target Date**: TBD

---

## 📊 Executive Summary

### Current Performance Issues

The dashboard currently suffers from severe performance bottlenecks that make it unsuitable for production use:

- **UI Freezes**: Blocking `execSync` calls every 2-3 seconds freeze the entire application
- **Excessive I/O**: File system operations occur hundreds of times per minute
- **Memory Leaks**: Unnecessary re-renders and object allocations
- **Poor UX**: Sluggish response to user input during resource polling

### Performance Impact

- **Worst Case**: 500-1500ms UI freeze every 2 seconds on Windows
- **Best Case**: 50-200ms freeze every 2 seconds on Unix systems
- **User Experience**: Dashboard feels unresponsive and janky

### Expected Improvements

After optimization:

- ✅ Zero UI blocking/freezing
- ✅ 90%+ reduction in file system operations
- ✅ 60%+ reduction in memory allocations
- ✅ Smooth 60 FPS UI updates
- ✅ <16ms input response time

---

## 🎯 Optimization Phases

### Phase 1: Critical Blocking Operations (Priority: 🔴 CRITICAL)

**Timeline**: Day 1 (6-8 hours)  
**Goal**: Eliminate all blocking execSync calls

#### 1.1 Async Resource Monitoring System

**File**: `src/utils/resources.ts`  
**Lines Affected**: 31-209  
**Complexity**: High

**Current Problems**:

```typescript
// ❌ BLOCKING - Freezes entire app
export function getSystemResources(): SystemResources {
  const memOutput = execSync('powershell "..."'); // 100-300ms
  const cpuOutput = execSync('powershell "..."'); // 100-300ms
  const cpuUsageOutput = execSync('powershell "..."'); // 100-300ms
  // Total: 300-900ms UI freeze!
}
```

**Solution Architecture**:

```typescript
// ✅ NON-BLOCKING - Background worker
interface ResourceMonitor {
  start(): void;
  stop(): void;
  getLatestResources(): SystemResources;
  subscribe(callback: (resources: SystemResources) => void): () => void;
}

class AsyncResourceMonitor implements ResourceMonitor {
  private latestResources: SystemResources;
  private worker: Worker | null = null;
  private subscribers: Set<Function> = new Set();
  private updateInterval: NodeJS.Timer | null = null;

  async start() {
    // Use worker thread or async polling
    this.updateInterval = setInterval(() => {
      this.pollResourcesAsync();
    }, 2000);
  }

  private async pollResourcesAsync() {
    const resources = await this.getSystemResourcesAsync();
    this.latestResources = resources;
    this.notifySubscribers(resources);
  }

  private async getSystemResourcesAsync(): Promise<SystemResources> {
    // Use exec (async) instead of execSync
    return new Promise((resolve, reject) => {
      exec('powershell "..."', (error, stdout) => {
        if (error) return reject(error);
        resolve(parseResources(stdout));
      });
    });
  }
}
```

**Implementation Tasks**:

- [ ] Create `src/utils/resource-monitor.ts` (new file, ~300 lines)
- [ ] Implement `AsyncResourceMonitor` class with pub/sub pattern
- [ ] Replace `execSync` with `exec` (async) for all shell commands
- [ ] Add platform-specific async implementations:
  - [ ] Windows: PowerShell async queries
  - [ ] macOS: vm_stat + top async
  - [ ] Linux: /proc/meminfo + /proc/stat async
- [ ] Implement caching layer (avoid redundant queries)
- [ ] Add error handling and fallback values
- [ ] Write unit tests for resource monitor
- [ ] Update `dashboard.tsx` to use subscription pattern

**Code Changes**:

```typescript
// dashboard.tsx - Before
const [systemResources, setSystemResources] = useState<SystemResources>(
  () => getSystemResources() // ❌ BLOCKING on mount
);

useEffect(() => {
  const interval = setInterval(() => {
    setSystemResources(getSystemResources()); // ❌ BLOCKING every 2s
  }, 2000);
  return () => clearInterval(interval);
}, []);

// dashboard.tsx - After
const [resourceMonitor] = useState(() => new AsyncResourceMonitor());
const [systemResources, setSystemResources] = useState<SystemResources>(
  resourceMonitor.getLatestResources() // ✅ Returns cached value
);

useEffect(() => {
  resourceMonitor.start();
  const unsubscribe = resourceMonitor.subscribe((resources) => {
    setSystemResources(resources); // ✅ Updated async in background
  });
  return () => {
    unsubscribe();
    resourceMonitor.stop();
  };
}, []);
```

**Testing Strategy**:

- Unit tests: Verify async operations complete correctly
- Performance tests: Measure UI frame rate during polling
- Platform tests: Verify on Windows, macOS, Linux
- Load tests: 100+ modules with resource monitoring

**Success Metrics**:

- Zero UI freezes during resource polling
- <5ms to read cached resource values
- Background updates every 2s without blocking

---

#### 1.2 Smart Config Caching & File Watching

**File**: `src/cli/commands/dashboard.tsx`  
**Lines Affected**: 43-110  
**Complexity**: High

**Current Problems**:

```typescript
// ❌ Reloads config from disk every 3 seconds!
useEffect(() => {
  loadConfigAndStatus();
  const interval = setInterval(loadConfigAndStatus, 3000);
  return () => clearInterval(interval);
}, []);

const loadConfigAndStatus = useCallback(async () => {
  const config = await loadConfig(process.cwd(), true, true); // ❌ Disk I/O
  orchestrator.load(config);

  for (const name of moduleNames) {
    const resources = getProcessResources(pid); // ❌ execSync per module
    if (module.type === 'docker') {
      const services = dockerExecutor.getServices(module); // ❌ docker ps
    }
  }
}, []);
```

**Solution Architecture**:

```typescript
// ✅ File watcher + incremental updates
interface StatusCache {
  modules: Map<string, ModuleStatus>;
  lastUpdate: Map<string, number>;
  isDirty: Set<string>;
}

class DashboardDataManager {
  private configWatcher: FSWatcher | null = null;
  private statusCache: StatusCache;
  private updateQueue: Set<string> = new Set();

  async initialize() {
    // Load config once
    await this.loadInitialConfig();

    // Watch config file for changes
    this.watchConfigFile();

    // Start incremental status updates
    this.startIncrementalUpdates();
  }

  private watchConfigFile() {
    this.configWatcher = fs.watch(this.configPath, (event) => {
      if (event === 'change') {
        this.reloadConfig(); // Only reload when file changes
      }
    });
  }

  private startIncrementalUpdates() {
    setInterval(() => {
      this.updateDirtyModules(); // Only update changed modules
    }, 1000);
  }

  private async updateDirtyModules() {
    const updates = await Promise.all(
      Array.from(this.updateQueue).map(
        (name) => this.updateModuleStatus(name) // Parallel async updates
      )
    );
    this.updateQueue.clear();
  }
}
```

**Implementation Tasks**:

- [ ] Create `src/cli/lib/dashboard-data-manager.ts` (new file, ~400 lines)
- [ ] Implement config file watching with `fs.watch()`
- [ ] Create status cache with TTL (time-to-live) per module
- [ ] Implement incremental status updates (only update changed modules)
- [ ] Add debouncing for file system events
- [ ] Replace synchronous process polling with async
- [ ] Batch Docker queries (single `docker ps` for all containers)
- [ ] Add memory limits for cache (prevent memory leaks)
- [ ] Implement dirty-checking before updating state
- [ ] Write integration tests

**Code Changes**:

```typescript
// dashboard.tsx - Before
const loadConfigAndStatus = useCallback(async () => {
  const config = await loadConfig(process.cwd(), true, true);
  // ... 60 lines of sync/blocking operations
}, [orchestrator, processManager, dockerExecutor]);

useEffect(() => {
  loadConfigAndStatus();
  const interval = setInterval(loadConfigAndStatus, 3000);
  return () => clearInterval(interval);
}, []);

// dashboard.tsx - After
const [dataManager] = useState(
  () => new DashboardDataManager(orchestrator, processManager, dockerExecutor)
);

useEffect(() => {
  dataManager.initialize();
  const unsubscribe = dataManager.subscribe((modules) => {
    setModules(modules); // Only updates when data actually changes
  });
  return () => {
    unsubscribe();
    dataManager.cleanup();
  };
}, []);
```

**Optimization Details**:

- **Config Reload**: Only when file changes (vs every 3s)
- **Process Status**: Cached with 1s TTL (vs queried every 3s)
- **Docker Status**: Batched single query (vs per-module queries)
- **State Updates**: Only when data changes (vs forced every 3s)

**Success Metrics**:

- Config only reloaded when file changes (file system events)
- 90%+ reduction in `getProcessResources()` calls
- Single Docker query per update cycle (vs N queries)
- Zero unnecessary re-renders

---

### Phase 2: React Performance Optimization (Priority: 🟠 HIGH)

**Timeline**: Day 1-2 (4-6 hours)  
**Goal**: Eliminate unnecessary re-renders and optimize component lifecycle

#### 2.1 Component Memoization

**Files Affected**: All screen components  
**Complexity**: Low-Medium

**Implementation Tasks**:

- [ ] Add `React.memo` to `HelpScreen.tsx` (line 5)
- [ ] Add `React.memo` to `EnvScreen.tsx` (line 5)
- [ ] Add `React.memo` to `LogsScreen.tsx` (line 12)
- [ ] Add `React.memo` to `HistoryScreen.tsx` (line 6)
- [ ] Verify `ModuleRow.tsx` memo is working correctly (already has memo)
- [ ] Add custom comparison function where needed

**Code Changes**:

```typescript
// Before - Re-renders on every parent update
export const HelpScreen: React.FC<ScreenProps> = ({ onBack, onQuit }) => {
  // Static content
};

// After - Only re-renders when props change
export const HelpScreen = React.memo<React.FC<ScreenProps>>(
  ({ onBack, onQuit }) => {
    // Static content
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if callbacks change
    return prevProps.onBack === nextProps.onBack && prevProps.onQuit === nextProps.onQuit;
  }
);
```

**Testing**:

- Visual test: No flickering when system resources update
- Performance test: Measure render count with React DevTools
- Regression test: All screens still respond to user input

**Success Metrics**:

- 80%+ reduction in screen component renders
- Static screens render once and stay mounted

---

#### 2.2 Callback Memoization

**File**: `src/cli/commands/dashboard.tsx`  
**Lines Affected**: 161-223  
**Complexity**: Medium

**Current Problem**:

```typescript
// ❌ Creates new function on every render (every 2-3s)
useInput((input, key) => {
  // 60+ lines of input handling
  if (input === 'q') handleExit();
  // ... accesses: modules, selectedModule, searchQuery, etc.
});
```

**Solution**:

```typescript
// ✅ Stable reference with proper dependencies
const handleKeyPress = useCallback(
  (input: string, key: Key) => {
    // ... input handling
  },
  [screen, selectedModule, searchMode, searchQuery, filteredModules, handleModuleAction, handleExit]
);

useInput(handleKeyPress);
```

**Implementation Tasks**:

- [ ] Extract input handler to separate `useCallback`
- [ ] Identify all dependencies correctly
- [ ] Split into multiple smaller handlers if needed:
  - [ ] `useGlobalKeyHandler()` - q, ESC
  - [ ] `useDashboardKeyHandler()` - navigation, actions
  - [ ] `useSearchKeyHandler()` - search input
- [ ] Ensure no stale closures
- [ ] Test all keyboard shortcuts

**Success Metrics**:

- Input handler reference stable across re-renders
- No input lag or missed keystrokes

---

#### 2.3 Text Highlighting Optimization

**File**: `src/cli/components/dashboard/ModuleRow.tsx`  
**Lines Affected**: 15-41, 55  
**Complexity**: Low

**Current Problem**:

```typescript
// ❌ Runs string operations on every render
function highlightText(text: string, query: string): React.ReactNode {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  // ... substring operations
}

// Called inline without memoization
{searchQuery ? highlightText(module.name, searchQuery) : <Text>{module.name}</Text>}
```

**Solution**:

```typescript
// ✅ Memoized computation
const HighlightedText: React.FC<{text: string, query?: string}> = React.memo(
  ({ text, query }) => {
    const highlighted = useMemo(() => {
      if (!query) return <Text>{text}</Text>;
      // ... highlighting logic
      return result;
    }, [text, query]);

    return highlighted;
  }
);

// Usage
<HighlightedText text={module.name} query={searchQuery} />
```

**Implementation Tasks**:

- [ ] Move `highlightText` into separate memoized component
- [ ] Use `useMemo` for string operations
- [ ] Update `ModuleRow` to use new component
- [ ] Add unit tests for edge cases

**Success Metrics**:

- String operations only run when text or query changes
- No performance impact with 100+ modules

---

### Phase 3: I/O Optimization (Priority: 🟠 HIGH)

**Timeline**: Day 2 (4-6 hours)  
**Goal**: Replace blocking file operations with async streaming

#### 3.1 Async Log Streaming

**File**: `src/cli/components/dashboard/LogsScreen.tsx`  
**Lines Affected**: 23-53  
**Complexity**: Medium-High

**Current Problem**:

```typescript
// ❌ Reads entire file synchronously every 2 seconds
const content = readFileSync(logFile, 'utf-8'); // BLOCKING
const lines = content.split('\n'); // Memory intensive for large logs
const recentLines = lines.slice(-100).join('\n');
```

**Solution Architecture**:

```typescript
// ✅ Streaming tail implementation
class LogTailer {
  private fileWatcher: FSWatcher | null = null;
  private lines: string[] = [];
  private subscribers: Set<Function> = new Set();

  async start(filePath: string, lineCount: number = 100) {
    // Initial read: Get last N lines efficiently
    await this.readLastLines(filePath, lineCount);

    // Watch for new lines
    this.fileWatcher = fs.watch(filePath, () => {
      this.readNewLines(filePath);
    });
  }

  private async readLastLines(filePath: string, count: number) {
    const stats = await fs.promises.stat(filePath);
    const bufferSize = Math.min(64 * 1024, stats.size); // Read last 64KB

    const buffer = Buffer.alloc(bufferSize);
    const fd = await fs.promises.open(filePath, 'r');
    await fd.read(buffer, 0, bufferSize, Math.max(0, stats.size - bufferSize));
    await fd.close();

    const text = buffer.toString('utf-8');
    this.lines = text.split('\n').slice(-count);
    this.notifySubscribers();
  }

  private async readNewLines(filePath: string) {
    // Incremental read from last known position
    // Only read new content, not entire file
  }
}
```

**Implementation Tasks**:

- [ ] Create `src/cli/lib/log-tailer.ts` (new file, ~250 lines)
- [ ] Implement efficient tail algorithm (read last N bytes)
- [ ] Add file watching for new log entries
- [ ] Implement streaming updates (pub/sub)
- [ ] Handle log rotation and file deletion
- [ ] Add error recovery
- [ ] Replace `readFileSync` in `LogsScreen.tsx`
- [ ] Write unit tests with mock files

**Code Changes**:

```typescript
// LogsScreen.tsx - Before
const loadLogs = useCallback(() => {
  const content = readFileSync(logFile, 'utf-8'); // ❌
  const lines = content.split('\n');
  const recentLines = lines.slice(-100).join('\n');
  setLogContent(recentLines);
}, [currentModule]);

useEffect(() => {
  loadLogs();
  const interval = setInterval(loadLogs, 2000); // ❌ Polling
  return () => clearInterval(interval);
}, [loadLogs]);

// LogsScreen.tsx - After
const [logTailer] = useState(() => new LogTailer());

useEffect(() => {
  if (!currentModule?.name) return;

  const logFile = join(process.cwd(), 'tmp', 'logs', `${currentModule.name}.log`);
  logTailer.start(logFile, 100);

  const unsubscribe = logTailer.subscribe((lines) => {
    setLogContent(lines.join('\n')); // ✅ Only updates when file changes
  });

  return () => {
    unsubscribe();
    logTailer.stop();
  };
}, [currentModule]);
```

**Success Metrics**:

- Zero blocking file reads
- Instant updates when new log entries appear
- Memory usage <10MB even with large log files
- No polling overhead

---

#### 3.2 Batched History Writing

**File**: `src/utils/preferences.ts`  
**Lines Affected**: 200-214  
**Complexity**: Low-Medium

**Current Problem**:

```typescript
// ❌ Synchronous disk I/O on every user action
export function addToHistory(command: string, module?: string, success: boolean = true): void {
  const prefs = loadPreferences(); // readFileSync
  prefs.history.unshift({ command, module, timestamp: new Date(), success });
  prefs.history = prefs.history.slice(0, 100);
  savePreferences(prefs); // writeFileSync - BLOCKING
}
```

**Solution**:

```typescript
// ✅ In-memory buffer + periodic flush
class PreferencesManager {
  private prefs: UserPreferences;
  private dirty: boolean = false;
  private flushTimer: NodeJS.Timer | null = null;

  constructor() {
    this.prefs = this.loadSync();
    this.startAutoFlush();
  }

  addToHistory(command: string, module?: string, success: boolean = true) {
    this.prefs.history.unshift({ command, module, timestamp: new Date(), success });
    this.prefs.history = this.prefs.history.slice(0, 100);
    this.dirty = true;
    // Will flush in next cycle (no blocking I/O here!)
  }

  private startAutoFlush() {
    this.flushTimer = setInterval(() => {
      if (this.dirty) {
        this.flushAsync(); // Async write in background
      }
    }, 5000); // Flush every 5s if dirty
  }

  private async flushAsync() {
    if (!this.dirty) return;
    await fs.promises.writeFile(PREFS_FILE, JSON.stringify(this.prefs, null, 2));
    this.dirty = false;
  }
}
```

**Implementation Tasks**:

- [ ] Create `src/utils/preferences-manager.ts` (new file, ~200 lines)
- [ ] Implement in-memory preferences cache
- [ ] Add batched async writes (flush every 5s or on exit)
- [ ] Replace synchronous file I/O with async
- [ ] Add shutdown handler to flush on exit
- [ ] Migrate existing code to use manager
- [ ] Write tests for batching logic

**Success Metrics**:

- Zero blocking I/O during user actions
- Preferences persisted within 5s
- No data loss on crash (flush on shutdown signal)

---

### Phase 4: Advanced Optimizations (Priority: 🟡 MEDIUM)

**Timeline**: Day 3 (4-6 hours)  
**Goal**: Polish and fine-tune for production

#### 4.1 Component Tree Flattening

**File**: `src/cli/commands/dashboard.tsx`  
**Lines Affected**: 283-386  
**Complexity**: Low

**Tasks**:

- [ ] Reduce Box nesting depth from 4-5 levels to 2-3
- [ ] Extract repeated patterns into sub-components
- [ ] Measure Ink reconciliation performance before/after

**Success Metrics**:

- 20%+ reduction in Box components
- Faster reconciliation time (measure with profiler)

---

#### 4.2 Lazy Loading & Code Splitting

**Complexity**: Medium

**Tasks**:

- [ ] Lazy load screen components with React.lazy
- [ ] Split large utility functions into separate modules
- [ ] Reduce initial bundle size

**Code Example**:

```typescript
const LogsScreen = React.lazy(() => import('./components/dashboard/LogsScreen'));
const HistoryScreen = React.lazy(() => import('./components/dashboard/HistoryScreen'));
```

**Success Metrics**:

- 30%+ reduction in initial load time
- Faster dashboard startup

---

#### 4.3 Memory Profiling & Leak Detection

**Complexity**: Medium-High

**Tasks**:

- [ ] Add memory usage tracking
- [ ] Profile with Node.js `--inspect` flag
- [ ] Identify and fix memory leaks
- [ ] Add memory pressure warnings
- [ ] Implement automatic garbage collection hints

**Tools**:

- Chrome DevTools memory profiler
- Node.js heap snapshots
- `process.memoryUsage()` tracking

**Success Metrics**:

- Stable memory usage over 24+ hours
- No memory leaks in long-running sessions
- <200MB total memory footprint

---

## 📁 File Structure Changes

### New Files

```
src/
├── cli/
│   └── lib/
│       ├── dashboard-data-manager.ts     [NEW] ~400 lines
│       ├── log-tailer.ts                 [NEW] ~250 lines
│       └── resource-monitor.ts           [NEW] ~300 lines
└── utils/
    ├── preferences-manager.ts            [NEW] ~200 lines
    └── resource-monitor.ts               [MOVED]
```

### Modified Files

```
src/
├── cli/
│   ├── commands/
│   │   └── dashboard.tsx                 [REFACTOR] Major changes
│   └── components/
│       └── dashboard/
│           ├── ModuleRow.tsx             [OPTIMIZE] Text highlighting
│           ├── LogsScreen.tsx            [REFACTOR] Async I/O
│           ├── HistoryScreen.tsx         [OPTIMIZE] Add memo
│           ├── HelpScreen.tsx            [OPTIMIZE] Add memo
│           └── EnvScreen.tsx             [OPTIMIZE] Add memo
└── utils/
    ├── resources.ts                      [REFACTOR] Async operations
    └── preferences.ts                    [DEPRECATE] Use manager instead
```

### Total Changes

- **New files**: 4 (~1150 lines)
- **Modified files**: 9
- **Estimated total changes**: 2000+ lines

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// tests/unit/resource-monitor.test.ts
describe('AsyncResourceMonitor', () => {
  it('should poll resources without blocking', async () => {
    const monitor = new AsyncResourceMonitor();
    monitor.start();

    const start = Date.now();
    const resources = monitor.getLatestResources();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5); // Must be <5ms (cached)
  });

  it('should update resources asynchronously', async () => {
    const monitor = new AsyncResourceMonitor();
    let updateCount = 0;

    monitor.subscribe(() => updateCount++);
    monitor.start();

    await sleep(2500); // Wait for one update cycle
    expect(updateCount).toBeGreaterThan(0);
  });
});

// tests/unit/log-tailer.test.ts
describe('LogTailer', () => {
  it('should read last N lines efficiently', async () => {
    const largefile = createLargeLogFile(1000000); // 1M lines
    const tailer = new LogTailer();

    const start = Date.now();
    await tailer.start(largefile, 100);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Must be <100ms
    expect(tailer.getLines()).toHaveLength(100);
  });
});
```

### Performance Tests

```typescript
// tests/performance/dashboard-performance.test.ts
describe('Dashboard Performance', () => {
  it('should maintain 60 FPS during updates', async () => {
    const { rerender } = render(<Dashboard />);
    const frameRates: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      rerender(<Dashboard />);
      const duration = performance.now() - start;
      frameRates.push(1000 / duration);
    }

    const avgFPS = frameRates.reduce((a, b) => a + b) / frameRates.length;
    expect(avgFPS).toBeGreaterThan(60);
  });

  it('should respond to input within 16ms', async () => {
    const { getByText } = render(<Dashboard />);

    const start = performance.now();
    fireEvent.keyPress(window, { key: 'j' });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(16); // 60 FPS = 16ms per frame
  });
});
```

### Integration Tests

```typescript
// tests/integration/dashboard-flow.test.ts
describe('Dashboard Integration', () => {
  it('should handle 100 modules without performance degradation', async () => {
    const modules = Array.from({ length: 100 }, (_, i) => ({
      name: `module-${i}`,
      type: 'workspace',
      status: 'RUNNING'
    }));

    const start = performance.now();
    const { rerender } = render(<Dashboard modules={modules} />);
    const renderTime = performance.now() - start;

    expect(renderTime).toBeLessThan(100); // <100ms for 100 modules
  });
});
```

### Load Tests

```bash
# Load test with many modules and high update frequency
npm run test:load

# Expected results:
# ✓ 0 UI freezes over 10 minutes
# ✓ Memory stable (<200MB)
# ✓ CPU usage <5% when idle
# ✓ Input response <16ms
```

---

## 📊 Success Metrics

### Performance KPIs

| Metric               | Current    | Target        | Measurement                  |
| -------------------- | ---------- | ------------- | ---------------------------- |
| **UI Freeze Time**   | 500-1500ms | 0ms           | Measure during resource poll |
| **Frame Rate**       | 20-30 FPS  | 60 FPS        | React DevTools profiler      |
| **Input Latency**    | 50-200ms   | <16ms         | Time from keypress to action |
| **Memory Usage**     | Growing    | Stable <200MB | `process.memoryUsage()`      |
| **File I/O Ops/min** | 1000+      | <50           | Count fs operations          |
| **Re-renders/sec**   | 50+        | <10           | React DevTools               |
| **Bundle Size**      | N/A        | <500KB        | webpack-bundle-analyzer      |
| **Startup Time**     | N/A        | <500ms        | Time to first render         |

### Code Quality Metrics

| Metric                | Target     |
| --------------------- | ---------- |
| **Test Coverage**     | >80%       |
| **TypeScript Errors** | 0          |
| **ESLint Warnings**   | 0          |
| **Performance Tests** | 100% pass  |
| **Memory Leaks**      | 0 detected |

---

## 🚀 Rollout Plan

### Phase 1 (Day 1): Critical Fixes

1. Implement `AsyncResourceMonitor`
2. Implement `DashboardDataManager`
3. Run performance tests
4. **Goal**: Zero UI freezes

### Phase 2 (Day 2): React & I/O

1. Add memoization to all components
2. Implement async log tailing
3. Implement batched preferences
4. Run integration tests
5. **Goal**: Smooth 60 FPS

### Phase 3 (Day 3): Polish

1. Component tree optimization
2. Memory profiling
3. Code splitting
4. Final performance audit
5. **Goal**: Production ready

### Validation Checklist

- [ ] All performance tests pass
- [ ] Zero blocking operations detected
- [ ] Memory stable over 24 hours
- [ ] 60 FPS maintained during updates
- [ ] Input latency <16ms
- [ ] No memory leaks detected
- [ ] Bundle size <500KB
- [ ] Test coverage >80%
- [ ] TypeScript builds without errors
- [ ] ESLint passes

---

## 🔧 Development Tools

### Profiling Commands

```bash
# Start dashboard with CPU profiler
node --cpu-prof --cpu-prof-interval=1000 ./bin/canto.js dev

# Start with heap profiler
node --inspect --inspect-brk ./bin/canto.js dev
# Then open chrome://inspect

# Memory profiling
node --expose-gc --trace-gc ./bin/canto.js dev

# Bundle analysis
npm run build
npm run analyze
```

### Monitoring During Development

```typescript
// Add performance monitoring (remove in production)
import { PerformanceObserver } from 'perf_hooks';

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    if (entry.duration > 16) {
      console.warn(`Slow operation: ${entry.name} took ${entry.duration}ms`);
    }
  });
});
obs.observe({ entryTypes: ['measure'] });

// Measure critical operations
performance.mark('resource-poll-start');
await pollResources();
performance.mark('resource-poll-end');
performance.measure('resource-poll', 'resource-poll-start', 'resource-poll-end');
```

---

## 📚 References & Resources

### Node.js Performance

- [Node.js Performance Measurement](https://nodejs.org/api/perf_hooks.html)
- [Async Patterns Best Practices](https://nodejs.org/en/docs/guides/blocking-vs-non-blocking/)
- [Worker Threads](https://nodejs.org/api/worker_threads.html)

### React Performance

- [React Profiler API](https://react.dev/reference/react/Profiler)
- [React.memo Documentation](https://react.dev/reference/react/memo)
- [useMemo & useCallback Guide](https://react.dev/reference/react/useMemo)

### Ink Framework

- [Ink Performance Tips](https://github.com/vadimdemedes/ink#performance)
- [Ink Best Practices](https://github.com/vadimdemedes/ink/blob/master/docs/performance.md)

### File System Optimization

- [Node.js fs.watch](https://nodejs.org/api/fs.html#fswatchfilename-options-listener)
- [Efficient File Tailing](https://github.com/lucagrulla/node-tail)

---

## 🐛 Known Issues & Considerations

### Platform-Specific

- **Windows**: PowerShell commands are slower (100-300ms vs 20-50ms on Unix)
  - **Solution**: Consider using native Windows APIs via FFI
- **macOS**: `vm_stat` output format changes between versions
  - **Solution**: Robust parsing with fallbacks
- **Linux**: `/proc` filesystem varies by kernel version
  - **Solution**: Test on multiple distributions

### Edge Cases

- **Large Log Files** (>100MB): May cause memory issues
  - **Solution**: Streaming tail implementation
- **Many Modules** (100+): Array operations become slow
  - **Solution**: Use Map/Set for O(1) lookups
- **Docker Queries**: `docker ps` can be slow with many containers
  - **Solution**: Batch queries and cache results

### Future Improvements

- Use WebAssembly for hot paths (string operations, parsing)
- Implement virtual scrolling for large module lists
- Consider native addons for system resource monitoring
- Add performance telemetry and alerting

---

## 💼 Estimated Effort Breakdown

### Day 1: Critical Blocking Operations (6-8 hours)

- AsyncResourceMonitor implementation: 3-4 hours
- DashboardDataManager implementation: 2-3 hours
- Testing and debugging: 1-2 hours

### Day 2: React & I/O Optimization (6-8 hours)

- Component memoization: 1-2 hours
- Async log tailing: 2-3 hours
- Batched preferences: 1-2 hours
- Testing and integration: 2 hours

### Day 3: Polish & Validation (4-6 hours)

- Component tree optimization: 1-2 hours
- Memory profiling: 1-2 hours
- Performance testing: 1-2 hours
- Documentation: 1 hour

### **Total**: 16-22 hours (2-3 days)

---

## ✅ Definition of Done

### Code Complete

- [ ] All blocking operations replaced with async
- [ ] All components memoized appropriately
- [ ] All file I/O optimized
- [ ] No console warnings in development
- [ ] TypeScript builds without errors
- [ ] ESLint passes with no warnings

### Performance Complete

- [ ] Zero UI freezes during normal operation
- [ ] 60 FPS maintained during resource updates
- [ ] Input latency <16ms
- [ ] Memory stable over 24 hours (<200MB)
- [ ] Startup time <500ms
- [ ] All performance tests pass

### Testing Complete

- [ ] Unit tests: >80% coverage
- [ ] Integration tests: All pass
- [ ] Performance tests: All pass
- [ ] Load tests: All pass
- [ ] Manual testing on Windows/macOS/Linux

### Documentation Complete

- [ ] Performance optimization guide written
- [ ] API documentation updated
- [ ] Troubleshooting guide added
- [ ] Migration guide for breaking changes

---

**Status**: 🚧 READY FOR IMPLEMENTATION  
**Next Step**: Begin Phase 1 - Critical Blocking Operations  
**Blocked By**: None  
**Dependencies**: None

---

_Last Updated: 2026-02-08_  
_Owner: Development Team_  
_Reviewers: TBD_
