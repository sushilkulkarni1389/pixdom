## Context

The current `encodeGif()` in `packages/core/src/animated-renderer.ts` uses a single FFmpeg invocation:

```
-vf split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse
```

The `split` trick feeds frames into both the palette generator and the palette consumer simultaneously. FFmpeg processes the filter graph in a streaming fashion, so `palettegen` only has access to frames up to the current position when it needs to output palette entries. The result is a palette optimized for the first frames of the animation, causing color degradation on later frames.

The standard fix is a true two-pass approach: generate the palette in a separate FFmpeg run over the entire input, then encode using that fixed palette.

## Goals / Non-Goals

**Goals:**
- Produce a globally-optimal 256-color palette by scanning all frames before encoding
- Maintain the same API surface — no changes to `render()` signature, `RenderOptions`, or the CLI
- Keep both FFmpeg calls within the existing temp directory lifecycle (cleaned up in `finally`)

**Non-Goals:**
- Dithering algorithm configuration (stay with FFmpeg's default `sierra2_4a`)
- Per-scene palette segmentation
- WebM or MP4 quality improvements (separate concern)

## Decisions

### Two separate `ffmpegEncode` calls vs one complex filtergraph

**Decision**: Two sequential calls.

Pass 1 generates `palette.png`; Pass 2 reads both the frame sequence and `palette.png` as inputs and uses `-filter_complex "[0:v][1:v]paletteuse"`. This is simpler and matches the canonical FFmpeg documentation approach for high-quality GIFs.

Alternative: Use `palettegen=stats_mode=full` within a single-pass lavfi graph. Rejected — FFmpeg's streaming model means palettegen can't look ahead; the single-pass approach is fundamentally limited regardless of the stats_mode.

### Palette file location

**Decision**: Write `palette.png` into the same `tmpDir` used for frames (`path.join(tmpDir, 'palette.png')`). It's cleaned up automatically when `fs.rm(tmpDir, { recursive: true, force: true })` runs in the `finally` block.

### `ffmpegEncode` signature reuse

**Decision**: The existing `ffmpegEncode(inputPattern, fps, outputPath, extraArgs)` helper only accepts a single input. For Pass 2 we need two inputs. Rather than over-engineering a generic multi-input helper, call `fluent-ffmpeg` directly inline for Pass 2 — it's a one-off use case.

Alternative: Extend `ffmpegEncode` to accept multiple inputs. Rejected as over-engineering for a single call site.

## Risks / Trade-offs

- **Slightly longer encode time** → Two FFmpeg processes instead of one. For typical short animations (1–5 seconds at 30fps) this adds ~100–500ms. Acceptable trade-off for quality.
- **palette.png persists if Pass 2 fails** → Mitigated: the `finally` block removes the entire `tmpDir` regardless.
- **Pass 1 completes but Pass 2 fails** → The `encodeGif` function propagates the Pass 2 error up to `render()` which wraps it in `Result.err({ code: 'ENCODE_FAILED' })`. No partial output is written.
