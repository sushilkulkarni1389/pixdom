# packages/detector — requirements

## Capabilities
- Detects presence of CSS transitions, keyframe animations, and JS-driven DOM changes
- Estimates animation cycle length in milliseconds
- Returns cycle length or null if no animation detected
- Fallback chain: CSS duration → rAF sampling → fixed timeout

## Constraints
- Must not start a new browser instance — receives an existing Playwright page
- All page.evaluate() calls must be serialisable (no function passing)
- detectAnimationCycle returns a number (ms) or null — never throws
- No direct imports from apps/

## v1 acceptance criteria
- [ ] Returns null for a static HTML page with no animation
- [ ] Detects CSS keyframe animation and returns cycle within +/- 100ms
- [ ] Detects JS-driven DOM animation via rAF sampling
- [ ] Falls back gracefully when cycle cannot be determined (returns null)
- [ ] All page.evaluate() calls are serialisable
