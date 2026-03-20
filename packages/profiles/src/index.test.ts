import { describe, it, expect } from 'vitest'
import {
  resolveProfile,
  getProfile,
  groupedProfiles,
  PROFILES,
  LINKEDIN_POST,
  TWITTER_POST,
  INSTAGRAM_POST_SQUARE,
} from './index.js'

describe('resolveProfile — canonical slugs', () => {
  it('resolves linkedin-post correctly', () => {
    const profile = resolveProfile('linkedin-post')
    expect(profile.id).toBe('linkedin-post')
    expect(profile.width).toBe(1200)
    expect(profile.height).toBe(1200)
    expect(profile.format).toBe('jpeg')
    expect(profile.group).toBe('linkedin')
  })
  it('resolves twitter-post correctly', () => {
    const profile = resolveProfile('twitter-post')
    expect(profile.width).toBe(1600)
    expect(profile.height).toBe(900)
    expect(profile.format).toBe('png')
  })
  it('resolves instagram-story correctly', () => {
    const profile = resolveProfile('instagram-story')
    expect(profile.width).toBe(1080)
    expect(profile.height).toBe(1920)
    expect(profile.format).toBe('jpeg')
  })
  it('resolves square correctly', () => {
    const profile = resolveProfile('square')
    expect(profile.width).toBe(1080)
    expect(profile.height).toBe(1080)
    expect(profile.format).toBe('png')
    expect(profile.quality).toBe(100)
  })
})

describe('resolveProfile — legacy aliases', () => {
  it('instagram alias resolves to instagram-post-square', () => {
    const profile = resolveProfile('instagram')
    expect(profile).toStrictEqual(INSTAGRAM_POST_SQUARE)
    expect(profile.id).toBe('instagram-post-square')
  })
  it('twitter alias resolves to twitter-post', () => {
    const profile = resolveProfile('twitter')
    expect(profile).toStrictEqual(TWITTER_POST)
    expect(profile.id).toBe('twitter-post')
  })
  it('linkedin alias resolves to linkedin-post', () => {
    const profile = resolveProfile('linkedin')
    expect(profile).toStrictEqual(LINKEDIN_POST)
    expect(profile.id).toBe('linkedin-post')
  })
})

describe('getProfile', () => {
  it('returns same result as resolveProfile for canonical slug', () => {
    expect(getProfile('linkedin-background')).toStrictEqual(resolveProfile('linkedin-background'))
  })
  it('returns same result as resolveProfile for legacy alias', () => {
    expect(getProfile('instagram')).toStrictEqual(resolveProfile('instagram'))
  })
})

describe('PROFILES record', () => {
  const expectedCanonicalCount = 19

  it(`contains exactly ${expectedCanonicalCount} canonical profiles`, () => {
    expect(Object.keys(PROFILES).length).toBe(expectedCanonicalCount)
  })
  it('does not contain legacy alias keys', () => {
    expect(PROFILES['instagram']).toBeUndefined()
    expect(PROFILES['twitter']).toBeUndefined()
    expect(PROFILES['linkedin']).toBeUndefined()
  })
  it('every profile has required fields', () => {
    for (const [slug, profile] of Object.entries(PROFILES)) {
      expect(profile.id, `${slug} missing id`).toBeTruthy()
      expect(profile.width, `${slug} missing width`).toBeGreaterThan(0)
      expect(profile.height, `${slug} missing height`).toBeGreaterThan(0)
      expect(profile.format, `${slug} missing format`).toBeTruthy()
      expect(profile.label, `${slug} missing label`).toBeTruthy()
      expect(profile.group, `${slug} missing group`).toBeTruthy()
    }
  })
})

describe('groupedProfiles', () => {
  it('returns linkedin, twitter, instagram, and generic groups', () => {
    const groups = groupedProfiles()
    expect(groups['linkedin']).toBeDefined()
    expect(groups['twitter']).toBeDefined()
    expect(groups['instagram']).toBeDefined()
    expect(groups['generic']).toBeDefined()
  })
  it('linkedin group has 6 profiles', () => {
    expect(groupedProfiles()['linkedin'].length).toBe(6)
  })
  it('twitter group has 5 profiles', () => {
    expect(groupedProfiles()['twitter'].length).toBe(5)
  })
  it('instagram group has 7 profiles', () => {
    expect(groupedProfiles()['instagram'].length).toBe(7)
  })
  it('generic group has 1 profile', () => {
    expect(groupedProfiles()['generic'].length).toBe(1)
  })
  it('total grouped profiles equals canonical count', () => {
    const groups = groupedProfiles()
    const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0)
    expect(total).toBe(19)
  })
})
