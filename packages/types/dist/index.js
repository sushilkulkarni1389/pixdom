import { z } from 'zod';
// RenderInput — discriminated union on `type`
export const RenderInputSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('html'), html: z.string() }),
    z.object({ type: z.literal('file'), path: z.string() }),
    z.object({ type: z.literal('url'), url: z.string() }),
    z.object({ type: z.literal('image'), path: z.string() }),
]);
// OutputFormat — string enum
export const OutputFormatSchema = z.enum(['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm']);
// ViewportOptions
export const ViewportOptionsSchema = z.object({
    width: z.number().default(1280),
    height: z.number().default(720),
    deviceScaleFactor: z.number().default(1),
});
// RenderOptions — composes input, format, viewport, and optional fields
export const RenderOptionsSchema = z.object({
    input: RenderInputSchema,
    format: OutputFormatSchema,
    viewport: ViewportOptionsSchema,
    quality: z.number().int().min(0).max(100).optional(),
    timeout: z.number().optional(),
    fps: z.number().optional(),
    duration: z.number().optional(),
    autoSize: z.boolean().optional(),
    selector: z.string().optional(),
});
// ProfileId — full union: 19 canonical slugs + 3 legacy aliases
export const ProfileIdSchema = z.enum([
    // LinkedIn (6)
    'linkedin-background',
    'linkedin-post',
    'linkedin-article-cover',
    'linkedin-profile',
    'linkedin-single-image-ad',
    'linkedin-career-background',
    // Twitter/X (5)
    'twitter-post',
    'twitter-header',
    'twitter-ad',
    'twitter-video',
    'twitter-ad-landscape',
    // Instagram (7)
    'instagram-post-3-4',
    'instagram-post-4-5',
    'instagram-post-square',
    'instagram-story',
    'instagram-reel',
    'instagram-profile',
    'instagram-story-video',
    // Generic (1)
    'square',
    // Legacy aliases (3)
    'instagram',
    'twitter',
    'linkedin',
]);
// Profile
export const ProfileSchema = z.object({
    id: ProfileIdSchema,
    width: z.number(),
    height: z.number(),
    format: OutputFormatSchema,
    quality: z.number(),
    label: z.string(),
    group: z.string(),
    fps: z.number().optional(),
});
// AnimationResult
export const AnimationResultSchema = z.object({
    cycleMs: z.number().nullable(),
});
export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
