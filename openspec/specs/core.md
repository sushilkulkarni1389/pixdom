# packages/core — requirements

## Capabilities
- Accepts: HTML string, local file path, or URL
- Detects animation presence and delegates to static or animated renderer
- Static output: PNG, JPEG, WebP via Sharp
- Animated output: GIF, MP4, WebM via FFmpeg (frame capture → encode)
- Viewport configuration: width, height, deviceScaleFactor
- Timeout and wait-for-idle controls

## Constraints
- Browser instance must always be closed in a finally block
- Frame capture uses requestAnimationFrame — no fixed-interval polling
- Sharp output must respect quality and compression settings per format
- No direct imports from apps/ — core is consumed by CLI and MCP server

## v1 acceptance criteria
- [ ] PNG export matches reference pixel dimensions within 1px
- [ ] GIF loops at detected animation cycle length +/- 100ms
- [ ] MP4 encodes at 30fps with correct duration
- [ ] Memory usage under 512MB for 1080x1080 renders
