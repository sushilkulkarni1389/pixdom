# resource-limits — requirements

### Requirement: Hard limits on animation parameters
The CLI SHALL enforce the following hard limits on animation-related flags at parse time, before rendering begins:
- `--fps`: integer in range 1–60 inclusive. Values outside this range SHALL be rejected with error code `INVALID_FPS`.
- `--duration`: integer in range 100–300000 (ms) inclusive. Values outside this range SHALL be rejected with error code `INVALID_DURATION`.

#### Scenario: fps=0 rejected
- **WHEN** `pixdom convert --html "x" --fps 0 --duration 1000` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_FPS`

#### Scenario: fps=61 rejected
- **WHEN** `pixdom convert --html "x" --fps 61 --duration 1000` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_FPS`

#### Scenario: fps=30 accepted
- **WHEN** `pixdom convert --html "x" --fps 30 --duration 1000` is run
- **THEN** the fps validation passes

#### Scenario: duration=50 rejected (below minimum)
- **WHEN** `pixdom convert --html "x" --fps 30 --duration 50` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_DURATION`

#### Scenario: duration=999999 rejected (above maximum)
- **WHEN** `pixdom convert --html "x" --fps 30 --duration 999999` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_DURATION`

#### Scenario: duration=300000 accepted (at maximum)
- **WHEN** `pixdom convert --html "x" --fps 30 --duration 300000` is run
- **THEN** the duration validation passes

#### Scenario: Non-numeric fps rejected
- **WHEN** `pixdom convert --html "x" --fps abc` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_FPS`

### Requirement: Hard limits on viewport dimensions
The CLI SHALL enforce the following hard limits on viewport flags at parse time:
- `--width`: integer in range 1–7680 inclusive.
- `--height`: integer in range 1–4320 inclusive.
Values outside these ranges SHALL be rejected with error code `RESOURCE_LIMIT_EXCEEDED`.

#### Scenario: width=0 rejected
- **WHEN** `pixdom convert --html "x" --width 0` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED`

#### Scenario: width=8000 rejected
- **WHEN** `pixdom convert --html "x" --width 8000` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED`

#### Scenario: width=7680 accepted (8K maximum)
- **WHEN** `pixdom convert --html "x" --width 7680` is run
- **THEN** the width validation passes

#### Scenario: height=4321 rejected
- **WHEN** `pixdom convert --html "x" --height 4321` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED`

### Requirement: Derived frame count cap
The CLI SHALL compute the derived frame count as `ceil(duration / 1000) * fps` and reject the combination if the result exceeds 3,600 frames. The error code SHALL be `RESOURCE_LIMIT_EXCEEDED` with a message indicating how to reduce fps or duration.

#### Scenario: fps=60, duration=300000 rejected (18000 frames)
- **WHEN** `pixdom convert --html "x" --fps 60 --duration 300000` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED` with a suggestion to lower fps or duration

#### Scenario: fps=30, duration=60000 accepted (1800 frames, within limit)
- **WHEN** `pixdom convert --html "x" --fps 30 --duration 60000` is run
- **THEN** the frame count check passes and rendering proceeds

### Requirement: Sharp image input pixel limit
`packages/core` SHALL call `sharp.limitInputPixels(268402689)` at module load in the image renderer. This prevents decompression bomb attacks from images whose uncompressed pixel count exceeds 16384×16384 (≈268 megapixels).

#### Scenario: Image within pixel limit processes normally
- **WHEN** an image with dimensions below 16384×16384 is passed as `--image`
- **THEN** rendering completes successfully

#### Scenario: Module loads Sharp limit without explicit invocation
- **WHEN** `packages/core` is imported
- **THEN** `sharp.limitInputPixels` has been called with `268402689` before any render call

### Requirement: Playwright navigation timeout
The Playwright page SHALL have its navigation timeout set to 30000 ms (30 seconds) via `page.setDefaultNavigationTimeout(30000)`. This prevents indefinitely hanging renders for slow or unresponsive URLs.

#### Scenario: Slow URL times out within 30 seconds
- **WHEN** `pixdom convert --url https://example.com` is run and the page does not respond within 30 seconds
- **THEN** the render returns a `PAGE_LOAD_FAILED` error within approximately 30 seconds
