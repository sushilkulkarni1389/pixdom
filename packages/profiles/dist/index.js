export const INSTAGRAM = Object.freeze({
    id: 'instagram',
    width: 1080,
    height: 1080,
    format: 'webp',
    quality: 90,
});
export const TWITTER = Object.freeze({
    id: 'twitter',
    width: 1200,
    height: 675,
    format: 'webp',
    quality: 85,
});
export const LINKEDIN = Object.freeze({
    id: 'linkedin',
    width: 1200,
    height: 627,
    format: 'webp',
    quality: 85,
});
export const SQUARE = Object.freeze({
    id: 'square',
    width: 800,
    height: 800,
    format: 'png',
    quality: 100,
});
export const PROFILES = {
    instagram: INSTAGRAM,
    twitter: TWITTER,
    linkedin: LINKEDIN,
    square: SQUARE,
};
export function getProfile(id) {
    return PROFILES[id];
}
