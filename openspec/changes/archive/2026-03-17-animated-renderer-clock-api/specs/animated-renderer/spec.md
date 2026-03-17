## MODIFIED Requirements

### Requirement: rAF frame capture loop
The animated renderer SHALL capture frames using Playwright's Clock API. Before the capture loop begins, it SHALL call `page.clock.install({ time: 0 })` to install a synthetic clock. For each frame, it SHALL call `page.clock.runFor(frameIntervalMs)` to advance the synthetic clock by one frame interval (firing all timers and rAF callbacks in that window), then take a Playwright screenshot. No real-time waiting between frames is permitted. The loop SHALL produce exactly `round(cycleMs / 1000 * fps)` frames (minimum 1).

#### Scenario: Frame count proportional to cycle length
- **WHEN** the animated renderer captures a 1000ms cycle at 30fps
- **THEN** exactly 30 PNG frames are written to the temp directory

#### Scenario: Frames are at exact time positions
- **WHEN** a CSS animation with a known 1000ms cycle is captured at 30fps
- **THEN** frame `i` is captured at synthetic time `i × 33ms` (±1ms) — each frame shows a distinct, evenly-spaced animation state

#### Scenario: Capture completes without real-time waiting
- **WHEN** a 2000ms animation cycle is captured at 30fps
- **THEN** the total host-side wall-clock time for `captureFrames` is under 10 seconds (not ~2+ seconds of real-time waiting)

#### Scenario: Temp directory cleaned up after render
- **WHEN** `render()` returns (success or failure)
- **THEN** the per-call temp directory and all frame files are deleted
