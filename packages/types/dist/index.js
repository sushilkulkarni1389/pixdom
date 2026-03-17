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
});
// ProfileId — string union
export const ProfileIdSchema = z.enum(['instagram', 'twitter', 'linkedin', 'square']);
// Profile
export const ProfileSchema = z.object({
    id: ProfileIdSchema,
    width: z.number(),
    height: z.number(),
    format: OutputFormatSchema,
    quality: z.number(),
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
