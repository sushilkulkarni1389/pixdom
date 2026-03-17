## Why

The current GIF encoder uses a single FFmpeg invocation with a `split` filter to generate and apply a palette in one pass. Because the palette is derived only from the frames the filter graph has seen up to that point (not the full sequence), colors for later frames are often mis-mapped — producing visible banding and dithering artifacts, especially in gradients or smooth CSS animations.

## What Changes

- Replace the single-pass `split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse` filter chain with a true two-pass FFmpeg approach:
  - **Pass 1**: Run FFmpeg on the frame sequence with `-vf palettegen` to produce a `palette.png` that samples the entire animation
  - **Pass 2**: Run FFmpeg again with `-i palette.png` and `-filter_complex "[0:v][1:v]paletteuse"` to encode the final GIF using the global palette
- The intermediate `palette.png` is written to the same temp directory and cleaned up with the frame files in the `finally` block

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `animated-renderer`: GIF encoding requirement changes — two-pass palette generation replaces the single-pass filter chain

## Impact

- `packages/core/src/animated-renderer.ts` — `encodeGif()` rewritten to run two sequential `ffmpegEncode` calls
- No new dependencies
- No API changes — `render({ format: 'gif', ... })` signature and return type are unchanged
