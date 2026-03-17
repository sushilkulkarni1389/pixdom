import type { Profile, ProfileId } from '@pixdom/types';

export const INSTAGRAM: Profile = Object.freeze({
  id: 'instagram' as const,
  width: 1080,
  height: 1080,
  format: 'webp' as const,
  quality: 90,
});

export const TWITTER: Profile = Object.freeze({
  id: 'twitter' as const,
  width: 1200,
  height: 675,
  format: 'webp' as const,
  quality: 85,
});

export const LINKEDIN: Profile = Object.freeze({
  id: 'linkedin' as const,
  width: 1200,
  height: 627,
  format: 'webp' as const,
  quality: 85,
});

export const SQUARE: Profile = Object.freeze({
  id: 'square' as const,
  width: 800,
  height: 800,
  format: 'png' as const,
  quality: 100,
});

export const PROFILES: Record<ProfileId, Profile> = {
  instagram: INSTAGRAM,
  twitter: TWITTER,
  linkedin: LINKEDIN,
  square: SQUARE,
};

export function getProfile(id: ProfileId): Profile {
  return PROFILES[id];
}
