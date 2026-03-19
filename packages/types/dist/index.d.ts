import { z } from 'zod';
export declare const RenderInputSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"html">;
    html: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "html";
    html: string;
}, {
    type: "html";
    html: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"file">;
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "file";
    path: string;
}, {
    type: "file";
    path: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"url">;
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "url";
    url: string;
}, {
    type: "url";
    url: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"image">;
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "image";
    path: string;
}, {
    type: "image";
    path: string;
}>]>;
export type RenderInput = z.infer<typeof RenderInputSchema>;
export declare const OutputFormatSchema: z.ZodEnum<["png", "jpeg", "webp", "gif", "mp4", "webm"]>;
export type OutputFormat = z.infer<typeof OutputFormatSchema>;
export declare const ViewportOptionsSchema: z.ZodObject<{
    width: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    deviceScaleFactor: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    width: number;
    height: number;
    deviceScaleFactor: number;
}, {
    width?: number | undefined;
    height?: number | undefined;
    deviceScaleFactor?: number | undefined;
}>;
export type ViewportOptions = z.infer<typeof ViewportOptionsSchema>;
export declare const RenderOptionsSchema: z.ZodObject<{
    input: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"html">;
        html: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "html";
        html: string;
    }, {
        type: "html";
        html: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"file">;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "file";
        path: string;
    }, {
        type: "file";
        path: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"url">;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "url";
        url: string;
    }, {
        type: "url";
        url: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "image";
        path: string;
    }, {
        type: "image";
        path: string;
    }>]>;
    format: z.ZodEnum<["png", "jpeg", "webp", "gif", "mp4", "webm"]>;
    viewport: z.ZodObject<{
        width: z.ZodDefault<z.ZodNumber>;
        height: z.ZodDefault<z.ZodNumber>;
        deviceScaleFactor: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        deviceScaleFactor: number;
    }, {
        width?: number | undefined;
        height?: number | undefined;
        deviceScaleFactor?: number | undefined;
    }>;
    quality: z.ZodOptional<z.ZodNumber>;
    timeout: z.ZodOptional<z.ZodNumber>;
    fps: z.ZodOptional<z.ZodNumber>;
    duration: z.ZodOptional<z.ZodNumber>;
    autoSize: z.ZodOptional<z.ZodBoolean>;
    selector: z.ZodOptional<z.ZodString>;
    allowLocal: z.ZodOptional<z.ZodBoolean>;
    auto: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    input: {
        type: "html";
        html: string;
    } | {
        type: "file";
        path: string;
    } | {
        type: "url";
        url: string;
    } | {
        type: "image";
        path: string;
    };
    format: "png" | "jpeg" | "webp" | "gif" | "mp4" | "webm";
    viewport: {
        width: number;
        height: number;
        deviceScaleFactor: number;
    };
    quality?: number | undefined;
    timeout?: number | undefined;
    fps?: number | undefined;
    duration?: number | undefined;
    autoSize?: boolean | undefined;
    selector?: string | undefined;
    allowLocal?: boolean | undefined;
    auto?: boolean | undefined;
}, {
    input: {
        type: "html";
        html: string;
    } | {
        type: "file";
        path: string;
    } | {
        type: "url";
        url: string;
    } | {
        type: "image";
        path: string;
    };
    format: "png" | "jpeg" | "webp" | "gif" | "mp4" | "webm";
    viewport: {
        width?: number | undefined;
        height?: number | undefined;
        deviceScaleFactor?: number | undefined;
    };
    quality?: number | undefined;
    timeout?: number | undefined;
    fps?: number | undefined;
    duration?: number | undefined;
    autoSize?: boolean | undefined;
    selector?: string | undefined;
    allowLocal?: boolean | undefined;
    auto?: boolean | undefined;
}>;
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;
export declare const ProfileIdSchema: z.ZodEnum<["linkedin-background", "linkedin-post", "linkedin-article-cover", "linkedin-profile", "linkedin-single-image-ad", "linkedin-career-background", "twitter-post", "twitter-header", "twitter-ad", "twitter-video", "twitter-ad-landscape", "instagram-post-3-4", "instagram-post-4-5", "instagram-post-square", "instagram-story", "instagram-reel", "instagram-profile", "instagram-story-video", "square", "instagram", "twitter", "linkedin"]>;
export type ProfileId = z.infer<typeof ProfileIdSchema>;
export declare const ProfileSchema: z.ZodObject<{
    id: z.ZodEnum<["linkedin-background", "linkedin-post", "linkedin-article-cover", "linkedin-profile", "linkedin-single-image-ad", "linkedin-career-background", "twitter-post", "twitter-header", "twitter-ad", "twitter-video", "twitter-ad-landscape", "instagram-post-3-4", "instagram-post-4-5", "instagram-post-square", "instagram-story", "instagram-reel", "instagram-profile", "instagram-story-video", "square", "instagram", "twitter", "linkedin"]>;
    width: z.ZodNumber;
    height: z.ZodNumber;
    format: z.ZodEnum<["png", "jpeg", "webp", "gif", "mp4", "webm"]>;
    quality: z.ZodNumber;
    label: z.ZodString;
    group: z.ZodString;
    fps: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    width: number;
    height: number;
    format: "png" | "jpeg" | "webp" | "gif" | "mp4" | "webm";
    quality: number;
    id: "linkedin-background" | "linkedin-post" | "linkedin-article-cover" | "linkedin-profile" | "linkedin-single-image-ad" | "linkedin-career-background" | "twitter-post" | "twitter-header" | "twitter-ad" | "twitter-video" | "twitter-ad-landscape" | "instagram-post-3-4" | "instagram-post-4-5" | "instagram-post-square" | "instagram-story" | "instagram-reel" | "instagram-profile" | "instagram-story-video" | "square" | "instagram" | "twitter" | "linkedin";
    label: string;
    group: string;
    fps?: number | undefined;
}, {
    width: number;
    height: number;
    format: "png" | "jpeg" | "webp" | "gif" | "mp4" | "webm";
    quality: number;
    id: "linkedin-background" | "linkedin-post" | "linkedin-article-cover" | "linkedin-profile" | "linkedin-single-image-ad" | "linkedin-career-background" | "twitter-post" | "twitter-header" | "twitter-ad" | "twitter-video" | "twitter-ad-landscape" | "instagram-post-3-4" | "instagram-post-4-5" | "instagram-post-square" | "instagram-story" | "instagram-reel" | "instagram-profile" | "instagram-story-video" | "square" | "instagram" | "twitter" | "linkedin";
    label: string;
    group: string;
    fps?: number | undefined;
}>;
export type Profile = z.infer<typeof ProfileSchema>;
export declare const AnimationResultSchema: z.ZodObject<{
    cycleMs: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    cycleMs: number | null;
}, {
    cycleMs: number | null;
}>;
export type AnimationResult = z.infer<typeof AnimationResultSchema>;
export type Result<T, E extends {
    code: string;
}> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export declare function ok<T>(value: T): Result<T, never>;
export declare function err<E extends {
    code: string;
}>(error: E): Result<never, E>;
//# sourceMappingURL=index.d.ts.map