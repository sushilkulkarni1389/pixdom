// ---------------------------------------------------------------------------
// LinkedIn (6 canonical presets)
// ---------------------------------------------------------------------------
export const LINKEDIN_BACKGROUND = Object.freeze({
    id: 'linkedin-background',
    width: 1584,
    height: 396,
    format: 'jpeg',
    quality: 85,
    label: 'LinkedIn Background',
    group: 'linkedin',
});
export const LINKEDIN_POST = Object.freeze({
    id: 'linkedin-post',
    width: 1200,
    height: 1200,
    format: 'jpeg',
    quality: 90,
    label: 'LinkedIn Post',
    group: 'linkedin',
});
export const LINKEDIN_ARTICLE_COVER = Object.freeze({
    id: 'linkedin-article-cover',
    width: 2000,
    height: 600,
    format: 'jpeg',
    quality: 85,
    label: 'LinkedIn Article Cover',
    group: 'linkedin',
});
export const LINKEDIN_PROFILE = Object.freeze({
    id: 'linkedin-profile',
    width: 800,
    height: 800,
    format: 'jpeg',
    quality: 90,
    label: 'LinkedIn Profile',
    group: 'linkedin',
});
export const LINKEDIN_SINGLE_IMAGE_AD = Object.freeze({
    id: 'linkedin-single-image-ad',
    width: 1200,
    height: 627,
    format: 'jpeg',
    quality: 85,
    label: 'LinkedIn Single Image Ad',
    group: 'linkedin',
});
export const LINKEDIN_CAREER_BACKGROUND = Object.freeze({
    id: 'linkedin-career-background',
    width: 1128,
    height: 191,
    format: 'jpeg',
    quality: 85,
    label: 'LinkedIn Career Background',
    group: 'linkedin',
});
// ---------------------------------------------------------------------------
// Twitter/X (5 canonical presets)
// ---------------------------------------------------------------------------
export const TWITTER_POST = Object.freeze({
    id: 'twitter-post',
    width: 1600,
    height: 900,
    format: 'png',
    quality: 90,
    label: 'Twitter/X Post',
    group: 'twitter',
});
export const TWITTER_HEADER = Object.freeze({
    id: 'twitter-header',
    width: 1500,
    height: 500,
    format: 'jpeg',
    quality: 85,
    label: 'Twitter/X Header',
    group: 'twitter',
});
export const TWITTER_AD = Object.freeze({
    id: 'twitter-ad',
    width: 1600,
    height: 900,
    format: 'jpeg',
    quality: 85,
    label: 'Twitter/X Ad',
    group: 'twitter',
});
export const TWITTER_VIDEO = Object.freeze({
    id: 'twitter-video',
    width: 1600,
    height: 900,
    format: 'mp4',
    quality: 85,
    label: 'Twitter/X Video',
    group: 'twitter',
});
export const TWITTER_AD_LANDSCAPE = Object.freeze({
    id: 'twitter-ad-landscape',
    width: 800,
    height: 450,
    format: 'mp4',
    quality: 85,
    label: 'Twitter/X Ad Landscape',
    group: 'twitter',
});
// ---------------------------------------------------------------------------
// Instagram (7 canonical presets)
// ---------------------------------------------------------------------------
export const INSTAGRAM_POST_3_4 = Object.freeze({
    id: 'instagram-post-3-4',
    width: 1080,
    height: 1440,
    format: 'jpeg',
    quality: 90,
    label: 'Instagram Post (3:4)',
    group: 'instagram',
});
export const INSTAGRAM_POST_4_5 = Object.freeze({
    id: 'instagram-post-4-5',
    width: 1080,
    height: 1350,
    format: 'jpeg',
    quality: 90,
    label: 'Instagram Post (4:5)',
    group: 'instagram',
});
export const INSTAGRAM_POST_SQUARE = Object.freeze({
    id: 'instagram-post-square',
    width: 1080,
    height: 1080,
    format: 'jpeg',
    quality: 90,
    label: 'Instagram Post (Square)',
    group: 'instagram',
});
export const INSTAGRAM_STORY = Object.freeze({
    id: 'instagram-story',
    width: 1080,
    height: 1920,
    format: 'jpeg',
    quality: 90,
    label: 'Instagram Story',
    group: 'instagram',
});
export const INSTAGRAM_REEL = Object.freeze({
    id: 'instagram-reel',
    width: 1080,
    height: 1920,
    format: 'mp4',
    quality: 85,
    label: 'Instagram Reel',
    group: 'instagram',
});
export const INSTAGRAM_PROFILE = Object.freeze({
    id: 'instagram-profile',
    width: 320,
    height: 320,
    format: 'jpeg',
    quality: 90,
    label: 'Instagram Profile',
    group: 'instagram',
});
export const INSTAGRAM_STORY_VIDEO = Object.freeze({
    id: 'instagram-story-video',
    width: 1080,
    height: 1920,
    format: 'mp4',
    quality: 85,
    label: 'Instagram Story Video',
    group: 'instagram',
});
// ---------------------------------------------------------------------------
// Generic (1 canonical preset)
// ---------------------------------------------------------------------------
export const SQUARE = Object.freeze({
    id: 'square',
    width: 1080,
    height: 1080,
    format: 'png',
    quality: 100,
    label: 'Square',
    group: 'generic',
});
// ---------------------------------------------------------------------------
// Legacy alias exports (backwards compat — point to canonical presets)
// ---------------------------------------------------------------------------
export const INSTAGRAM = INSTAGRAM_POST_SQUARE;
export const TWITTER = TWITTER_POST;
export const LINKEDIN = LINKEDIN_POST;
// ---------------------------------------------------------------------------
// PROFILES — canonical slugs only (legacy alias slugs are NOT keys here)
// ---------------------------------------------------------------------------
export const PROFILES = {
    'linkedin-background': LINKEDIN_BACKGROUND,
    'linkedin-post': LINKEDIN_POST,
    'linkedin-article-cover': LINKEDIN_ARTICLE_COVER,
    'linkedin-profile': LINKEDIN_PROFILE,
    'linkedin-single-image-ad': LINKEDIN_SINGLE_IMAGE_AD,
    'linkedin-career-background': LINKEDIN_CAREER_BACKGROUND,
    'twitter-post': TWITTER_POST,
    'twitter-header': TWITTER_HEADER,
    'twitter-ad': TWITTER_AD,
    'twitter-video': TWITTER_VIDEO,
    'twitter-ad-landscape': TWITTER_AD_LANDSCAPE,
    'instagram-post-3-4': INSTAGRAM_POST_3_4,
    'instagram-post-4-5': INSTAGRAM_POST_4_5,
    'instagram-post-square': INSTAGRAM_POST_SQUARE,
    'instagram-story': INSTAGRAM_STORY,
    'instagram-reel': INSTAGRAM_REEL,
    'instagram-profile': INSTAGRAM_PROFILE,
    'instagram-story-video': INSTAGRAM_STORY_VIDEO,
    square: SQUARE,
};
// ---------------------------------------------------------------------------
// resolveProfile — resolves canonical slugs and legacy aliases
// ---------------------------------------------------------------------------
const ALIAS_MAP = {
    instagram: 'instagram-post-square',
    twitter: 'twitter-post',
    linkedin: 'linkedin-post',
};
export function resolveProfile(slug) {
    const canonical = ALIAS_MAP[slug] ?? slug;
    return PROFILES[canonical];
}
// ---------------------------------------------------------------------------
// getProfile — backwards-compat wrapper delegating to resolveProfile
// ---------------------------------------------------------------------------
export function getProfile(id) {
    return resolveProfile(id);
}
// ---------------------------------------------------------------------------
// groupedProfiles — partitions canonical presets by platform group
// ---------------------------------------------------------------------------
export function groupedProfiles() {
    const groups = {};
    for (const profile of Object.values(PROFILES)) {
        if (!groups[profile.group])
            groups[profile.group] = [];
        groups[profile.group].push(profile);
    }
    return groups;
}
