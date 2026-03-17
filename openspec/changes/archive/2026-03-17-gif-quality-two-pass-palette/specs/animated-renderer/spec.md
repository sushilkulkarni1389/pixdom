## MODIFIED Requirements

### Requirement: FFmpeg GIF encoding
The animated renderer SHALL encode the captured PNG frame sequence into a GIF using a two-pass FFmpeg process. **Pass 1** SHALL run FFmpeg on the frame sequence with the `palettegen` filter to produce a `palette.png` file in the temp directory — this generates a globally-optimal 256-color palette from the entire frame sequence. **Pass 2** SHALL run FFmpeg with the frame sequence and `palette.png` as separate inputs, using `-filter_complex "[0:v][1:v]paletteuse"` to produce the final GIF. The output GIF SHALL loop indefinitely (`-loop 0`). The intermediate `palette.png` SHALL be written to the same temp directory as the frames and cleaned up with them. The frame rate SHALL default to 30fps unless `options.fps` is set.

#### Scenario: GIF buffer is valid
- **WHEN** `render({ format: 'gif', ... })` completes successfully
- **THEN** the output buffer begins with the GIF89a header (`GIF89a`)

#### Scenario: GIF loops at cycle length
- **WHEN** the output GIF is inspected
- **THEN** its total frame duration matches `cycleMs` within ±100ms

#### Scenario: Two-pass produces better color accuracy
- **WHEN** a GIF is encoded from an animation with smooth color gradients
- **THEN** the output GIF uses a palette derived from all frames (not just the first N frames), reducing banding visible in later animation frames

#### Scenario: Palette file cleaned up after encode
- **WHEN** `render({ format: 'gif', ... })` returns (success or failure)
- **THEN** `palette.png` is removed along with all frame files in the temp directory
