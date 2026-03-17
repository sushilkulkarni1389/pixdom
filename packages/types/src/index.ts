import { z } from 'zod';

// RenderInput — discriminated union on `type`
export const RenderInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('html'), html: z.string() }),
  z.object({ type: z.literal('file'), path: z.string() }),
  z.object({ type: z.literal('url'), url: z.string() }),
]);
export type RenderInput = z.infer<typeof RenderInputSchema>;

// OutputFormat — string enum
export const OutputFormatSchema = z.enum(['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm']);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

// ViewportOptions
export const ViewportOptionsSchema = z.object({
  width: z.number(),
  height: z.number(),
  deviceScaleFactor: z.number().default(1),
});
export type ViewportOptions = z.infer<typeof ViewportOptionsSchema>;

// RenderOptions — composes input, format, viewport, and optional fields
export const RenderOptionsSchema = z.object({
  input: RenderInputSchema,
  format: OutputFormatSchema,
  viewport: ViewportOptionsSchema,
  quality: z.number().int().min(0).max(100).optional(),
  timeout: z.number().optional(),
  fps: z.number().optional(),
});
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;

// ProfileId — string union
export const ProfileIdSchema = z.enum(['instagram', 'twitter', 'linkedin', 'square']);
export type ProfileId = z.infer<typeof ProfileIdSchema>;

// Profile
export const ProfileSchema = z.object({
  id: ProfileIdSchema,
  width: z.number(),
  height: z.number(),
  format: OutputFormatSchema,
  quality: z.number(),
  fps: z.number().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// AnimationResult
export const AnimationResultSchema = z.object({
  cycleMs: z.number().nullable(),
});
export type AnimationResult = z.infer<typeof AnimationResultSchema>;

// Result<T, E> generic
export type Result<T, E extends { code: string }> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends { code: string }>(error: E): Result<never, E> {
  return { ok: false, error };
}
