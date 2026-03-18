import ora, { type Ora } from 'ora';
import type { OnProgress } from '@pixdom/core';

const STEP_LABELS: Record<string, string> = {
  'load-page': 'Loading page',
  'auto-size': 'Detecting content',
  'selector': 'Detecting content',
  'detect-animation': 'Detecting animation',
  'capture': 'Capturing screenshot',
  'read-image': 'Reading image',
};

export interface ProgressReporterContext {
  hasSelector: boolean;
  hasAutoSize: boolean;
  isAnimated: boolean;
  isImagePassthrough: boolean;
  profileName?: string;
  format: string;
  hasResize: boolean;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export interface ProgressReporter {
  onProgress: OnProgress;
  finish(outputPath: string): void;
}

export function createProgressReporter(
  context: ProgressReporterContext,
  noProgress: boolean,
): ProgressReporter {
  const startMs = Date.now();

  if (noProgress) {
    return {
      onProgress: () => {},
      finish: () => {},
    };
  }

  let spinner: Ora | null = null;
  let currentEncodeFormat = '';

  const resizeLabel = context.profileName
    ? `Resizing for ${context.profileName}`
    : 'Resizing image';

  const onProgress: OnProgress = (event) => {
    switch (event.type) {
      case 'step-start': {
        if (event.step === 'resize') {
          spinner = ora({ text: resizeLabel, stream: process.stderr }).start();
        } else {
          const label = STEP_LABELS[event.step];
          if (label) {
            spinner = ora({ text: label, stream: process.stderr }).start();
          }
        }
        break;
      }
      case 'step-done': {
        if (spinner) {
          if (event.step === 'resize') {
            spinner.succeed(resizeLabel);
          } else {
            const label = STEP_LABELS[event.step];
            if (label) spinner.succeed(label);
          }
          spinner = null;
        }
        break;
      }
      case 'frame-progress': {
        if (spinner) {
          spinner.text = `Capturing frames (${event.current}/${event.total})`;
        } else {
          spinner = ora({
            text: `Capturing frames (${event.current}/${event.total})`,
            stream: process.stderr,
          }).start();
        }
        break;
      }
      case 'encode-format': {
        currentEncodeFormat = event.format;
        spinner = ora({ text: `Encoding ${event.format}`, stream: process.stderr }).start();
        break;
      }
      case 'encode-progress': {
        if (spinner) {
          spinner.text = `Encoding ${currentEncodeFormat} (${event.pct}%)`;
        }
        break;
      }
    }
  };

  const finish = (outputPath: string): void => {
    const elapsed = Date.now() - startMs;
    const duration = formatDuration(elapsed);
    // Finish any lingering spinner (e.g. encode step) then print summary
    if (spinner) {
      spinner.succeed(`Encoding ${currentEncodeFormat}`);
      spinner = null;
    }
    ora({ stream: process.stderr }).succeed(`Done in ${duration} → ${outputPath}`);
  };

  return { onProgress, finish };
}
