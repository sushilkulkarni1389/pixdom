## MODIFIED Requirements

### Requirement: --profile flag
The `convert` subcommand SHALL accept `--profile <slug>` where `slug` is any canonical `ProfileSlug` value or any legacy alias (`instagram`, `twitter`, `linkedin`). When provided, `width`, `height`, `format`, and `quality` SHALL be pre-filled from the resolved preset via `resolveProfile()`. Individual override flags applied alongside `--profile` SHALL take precedence. The `--profile` flag's `--help` output SHALL enumerate all valid slugs grouped by platform.

#### Scenario: Canonical slug sets dimensions
- **WHEN** `pixdom convert --html "x" --profile instagram-post-square` is run
- **THEN** the output image has dimensions 1080×1080

#### Scenario: Legacy slug still resolves
- **WHEN** `pixdom convert --html "x" --profile instagram` is run
- **THEN** the output image has dimensions 1080×1080 (resolves to `instagram-post-square`)

#### Scenario: New namespaced slug sets correct dimensions
- **WHEN** `pixdom convert --html "x" --profile linkedin-background` is run
- **THEN** the output image has dimensions 1584×396 and format is jpeg

#### Scenario: Profile flag with format override
- **WHEN** `pixdom convert --html "x" --profile instagram-post-square --format jpeg` is run
- **THEN** the output is a JPEG (overrides the profile's default jpeg — no behavioural change)

#### Scenario: Invalid profile exits with error
- **WHEN** `pixdom convert --html "x" --profile tiktok` is run
- **THEN** stderr contains an error about the invalid profile and the process exits with code 1
