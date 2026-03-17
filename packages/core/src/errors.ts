export type RenderErrorCode =
  | 'BROWSER_LAUNCH_FAILED'
  | 'PAGE_LOAD_FAILED'
  | 'CAPTURE_FAILED'
  | 'ENCODE_FAILED'
  | 'NO_ANIMATION_DETECTED';

export interface RenderError {
  code: RenderErrorCode;
  message: string;
  cause?: unknown;
}

export function makeError(
  code: RenderErrorCode,
  message: string,
  cause?: unknown,
): RenderError {
  return { code, message, cause };
}
