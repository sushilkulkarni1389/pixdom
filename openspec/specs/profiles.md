# packages/profiles — requirements

## Capabilities
- Defines 4 platform output presets: Instagram, Twitter, LinkedIn, Square
- Each profile specifies: width, height, format, quality, fps (animated)
- Profiles are immutable and exported as named constants
- Accepts a profile ID string and returns the matching profile object

## Constraints
- Profiles are Object.freeze()'d — no runtime mutation
- No external dependencies — pure TypeScript data module
- No direct imports from apps/
- Adding a profile must not require changes outside this package

## v1 acceptance criteria
- [ ] All 4 profiles export correctly: instagram, twitter, linkedin, square
- [ ] Each profile has required fields: id, width, height, format, quality
- [ ] Object.freeze() prevents mutation at runtime
- [ ] Invalid profile ID returns undefined, not an error
- [ ] TypeScript types are exported alongside values
