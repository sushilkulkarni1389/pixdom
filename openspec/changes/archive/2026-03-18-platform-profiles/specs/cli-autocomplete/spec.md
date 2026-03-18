## MODIFIED Requirements

### Requirement: --profile value completion
After sourcing the completion script, pressing TAB after `pixdom convert --profile ` (with trailing space) SHALL suggest all canonical profile slugs. Legacy alias slugs (`instagram`, `twitter`, `linkedin`) SHALL NOT appear as completion candidates — users are guided toward canonical slugs. The canonical slug list is: `linkedin-background`, `linkedin-post`, `linkedin-article-cover`, `linkedin-profile`, `linkedin-single-image-ad`, `linkedin-career-background`, `twitter-post`, `twitter-header`, `twitter-ad`, `twitter-video`, `twitter-ad-landscape`, `instagram-post-3-4`, `instagram-post-4-5`, `instagram-post-square`, `instagram-story`, `instagram-reel`, `instagram-profile`, `instagram-story-video`, `square`.

#### Scenario: All canonical profile slugs surface as choices
- **WHEN** the completion script is sourced and the user types `pixdom convert --profile ` then presses TAB
- **THEN** the shell presents all 19 canonical slugs as candidates and does NOT include `instagram`, `twitter`, or `linkedin` as standalone entries

#### Scenario: Legacy slugs are absent from completion
- **WHEN** the completion script is sourced and the user types `pixdom convert --profile ins` then presses TAB
- **THEN** the shell suggests `instagram-post-3-4`, `instagram-post-4-5`, `instagram-post-square`, `instagram-story`, `instagram-reel`, `instagram-profile`, `instagram-story-video` — but not a bare `instagram` entry
