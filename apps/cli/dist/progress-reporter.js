import ora from 'ora';
const STEP_LABELS = {
    'load-page': 'Loading page',
    'auto-size': 'Detecting content',
    'selector': 'Detecting content',
    'detect-animation': 'Detecting animation',
    'capture': 'Capturing screenshot',
    'read-image': 'Reading image',
    'write-output': 'Writing output',
};
export function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}
export function createProgressReporter(context, noProgress) {
    const startMs = Date.now();
    if (noProgress) {
        return {
            onProgress: () => { },
            finish: () => { },
        };
    }
    let spinner = null;
    let currentEncodeFormat = '';
    let lastFrameCount = null;
    const resizeLabel = context.profileName
        ? `Resizing for ${context.profileName}`
        : 'Resizing image';
    const onProgress = (event) => {
        switch (event.type) {
            case 'step-start': {
                if (event.step === 'capture-frames') {
                    spinner = ora({ text: 'Capturing frames', stream: process.stderr }).start();
                }
                else if (event.step === 'resize') {
                    spinner = ora({ text: resizeLabel, stream: process.stderr }).start();
                }
                else {
                    const label = STEP_LABELS[event.step];
                    if (label) {
                        spinner = ora({ text: label, stream: process.stderr }).start();
                    }
                }
                break;
            }
            case 'step-done': {
                if (spinner) {
                    if (event.step === 'capture-frames') {
                        const label = lastFrameCount
                            ? `Capturing frames (${lastFrameCount.current}/${lastFrameCount.total})`
                            : 'Capturing frames';
                        spinner.succeed(label);
                    }
                    else if (event.step === 'resize') {
                        spinner.succeed(resizeLabel);
                    }
                    else {
                        const label = STEP_LABELS[event.step];
                        if (label)
                            spinner.succeed(label);
                    }
                    spinner = null;
                }
                break;
            }
            case 'frame-progress': {
                lastFrameCount = { current: event.current, total: event.total };
                if (spinner) {
                    spinner.text = `Capturing frames (${event.current}/${event.total})`;
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
            case 'encode-done': {
                if (spinner) {
                    spinner.succeed(`Encoding ${event.format} (100%)`);
                    spinner = null;
                }
                break;
            }
        }
    };
    const finish = (outputPath) => {
        const elapsed = Date.now() - startMs;
        const duration = formatDuration(elapsed);
        // Stop any active spinner before printing the Done line
        if (spinner) {
            spinner.stop();
            spinner = null;
        }
        ora({ stream: process.stderr }).succeed(`Done in ${duration} → ${outputPath}`);
    };
    return { onProgress, finish };
}
