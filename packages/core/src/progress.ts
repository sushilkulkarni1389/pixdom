export type ProgressEvent =
  | { type: 'step-start'; step: string }
  | { type: 'step-done'; step: string }
  | { type: 'frame-progress'; current: number; total: number }
  | { type: 'encode-progress'; pct: number }
  | { type: 'encode-format'; format: string };

export type OnProgress = (event: ProgressEvent) => void;
