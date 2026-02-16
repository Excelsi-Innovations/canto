# Task 001: OpenTUI Pilot (LogViewer)

## Status
- **State**: Draft
- **Owner**: @antigravity
- **Created**: 2026-02-16

## Context
Ink (current UI engine) suffers from rendering artifacts ("jank") during heavy usage (scrolling logs, resizing terminals) due to its JS-based layout and stdout patching. OpenTUI uses a native **Zig** rendering engine that guarantees atomic paints and better performance.

## Goal
Validate if OpenTUI provides a superior, more consistent DX/UX than Ink by porting a single complex component (`LogViewer`).

## Requirements

### Functional
1.  **Rendering Engine**: Must use OpenTUI (Zig-based) for rendering.
2.  **Feature Parity**: The new `LogViewer` must support:
    -   Displays logs from `ProcessManager`.
    -   Auto-scroll (tailing).
    -   Manual scroll (Arrow keys, PageUp/Down).
    -   Copy to Clipboard (`c`).
    -   Clear Logs (`x`).

### Technical
1.  **Hybrid Integration**: accurately mount OpenTUI within the existing Node.js CLI process.
2.  **No Regressions**: Must not crash or freeze the main process.

## Implementation Plan

### Phase 1: Setup & POC
1.  [ ] **Install Dependencies**:
    -   `@opentui/react`
    -   `@opentui/core`
2.  [ ] **Create Entrypoint**:
    -   Create `src/cli/tui-test.tsx` (experimental entrypoint).
    -   Mount a simple OpenTUI `<Box>` to verify the engine works.

### Phase 2: Component Porting
1.  [ ] **Port `LogViewer`**:
    -   Create `src/cli/components/opentui/LogViewer.tsx`.
    -   Replace Ink `<Box>`/`<Text>` with OpenTUI equivalents.
    -   Use OpenTUI's native `<ScrollBox>` (if available) or implement virtualized list.
    -   Implement keyboard handling using OpenTUI's event system.

### Phase 3: Evaluation Criteria (DoD)
| Metric | Pass Condition |
| :--- | :--- |
| **Resize Stability** | Zre flickering/tearing when resizing window. |
| **Scroll Performance** | Smooth scrolling at 60fps equivalent. |
| **CPU Usage** | Comparable or lower than Ink implementation. |
| **Input Latency** | Instant response to navigation keys. |

## Decision Gate
-   **GO**: If the user confirms "This feels native/smooth". -> Migrate Dashboard.
-   **NO-GO**: If installation fails or bindings are buggy. -> Stick with Ink.
