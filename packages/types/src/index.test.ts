import { describe, it, expect } from 'vitest'
import {
  RenderInputSchema,
  OutputFormatSchema,
  ViewportOptionsSchema,
  RenderOptionsSchema,
  ProfileIdSchema,
  ok,
  err,
} from './index.js'

describe('RenderInputSchema', () => {
  it('accepts html input', () => {
    expect(RenderInputSchema.safeParse({ type: 'html', html: '<h1>Hello</h1>' }).success).toBe(true)
  })
  it('accepts file input', () => {
    expect(RenderInputSchema.safeParse({ type: 'file', path: '/tmp/index.html' }).success).toBe(true)
  })
  it('accepts url input', () => {
    expect(RenderInputSchema.safeParse({ type: 'url', url: 'https://example.com' }).success).toBe(true)
  })
  it('accepts image input', () => {
    expect(RenderInputSchema.safeParse({ type: 'image', path: '/tmp/photo.png' }).success).toBe(true)
  })
  it('rejects unknown type', () => {
    expect(RenderInputSchema.safeParse({ type: 'pdf', path: '/tmp/doc.pdf' }).success).toBe(false)
  })
  it('rejects html input missing html field', () => {
    expect(RenderInputSchema.safeParse({ type: 'html' }).success).toBe(false)
  })
})

describe('OutputFormatSchema', () => {
  const validFormats = ['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm']
  it.each(validFormats)('accepts %s', (format) => {
    expect(OutputFormatSchema.safeParse(format).success).toBe(true)
  })
  it('rejects invalid format', () => {
    expect(OutputFormatSchema.safeParse('svg').success).toBe(false)
  })
})

describe('ViewportOptionsSchema', () => {
  it('applies defaults when fields are omitted', () => {
    const result = ViewportOptionsSchema.parse({})
    expect(result.width).toBe(1280)
    expect(result.height).toBe(720)
    expect(result.deviceScaleFactor).toBe(1)
  })
  it('accepts custom viewport values', () => {
    const result = ViewportOptionsSchema.parse({ width: 1920, height: 1080, deviceScaleFactor: 2 })
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
    expect(result.deviceScaleFactor).toBe(2)
  })
})

describe('RenderOptionsSchema', () => {
  const base = {
    input: { type: 'html', html: '<h1>Test</h1>' },
    format: 'png',
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
  }
  it('accepts valid minimal options', () => {
    expect(RenderOptionsSchema.safeParse(base).success).toBe(true)
  })
  it('accepts quality within 0–100', () => {
    expect(RenderOptionsSchema.safeParse({ ...base, quality: 85 }).success).toBe(true)
    expect(RenderOptionsSchema.safeParse({ ...base, quality: 0 }).success).toBe(true)
    expect(RenderOptionsSchema.safeParse({ ...base, quality: 100 }).success).toBe(true)
  })
  it('rejects quality above 100', () => {
    expect(RenderOptionsSchema.safeParse({ ...base, quality: 101 }).success).toBe(false)
  })
  it('rejects quality below 0', () => {
    expect(RenderOptionsSchema.safeParse({ ...base, quality: -1 }).success).toBe(false)
  })
  it('rejects non-integer quality', () => {
    expect(RenderOptionsSchema.safeParse({ ...base, quality: 85.5 }).success).toBe(false)
  })
})

describe('ProfileIdSchema', () => {
  const canonicalIds = [
    'linkedin-background', 'linkedin-post', 'linkedin-article-cover',
    'linkedin-profile', 'linkedin-single-image-ad', 'linkedin-career-background',
    'twitter-post', 'twitter-header', 'twitter-ad', 'twitter-video', 'twitter-ad-landscape',
    'instagram-post-3-4', 'instagram-post-4-5', 'instagram-post-square',
    'instagram-story', 'instagram-reel', 'instagram-profile', 'instagram-story-video',
    'square',
  ]
  const legacyAliases = ['instagram', 'twitter', 'linkedin']

  it.each([...canonicalIds, ...legacyAliases])('accepts %s', (id) => {
    expect(ProfileIdSchema.safeParse(id).success).toBe(true)
  })
  it('rejects unknown profile id', () => {
    expect(ProfileIdSchema.safeParse('facebook-post').success).toBe(false)
  })
})

describe('Result helpers', () => {
  it('ok wraps a value', () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(42)
  })
  it('err wraps an error with a code', () => {
    const result = err({ code: 'RENDER_FAILED', message: 'timeout' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RENDER_FAILED')
  })
})
