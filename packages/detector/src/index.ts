// import type { Page } from 'playwright';

// /**
//  * Queries all DOM elements and returns the maximum computed CSS animation or
//  * transition duration in milliseconds. Returns 0 if no animated elements found.
//  *
//  * All page.evaluate arguments and return values are plain serialisable types.
//  */
// async function cssMaxDuration(page: Page): Promise<number> {
//   const maxMs: number = await page.evaluate(() => {
//     const elements = Array.from(document.querySelectorAll('*'));
//     let max = 0;

//     for (const el of elements) {
//       const style = window.getComputedStyle(el);

//       const parseDurations = (value: string): number => {
//         return value
//           .split(',')
//           .map((s) => {
//             const trimmed = s.trim();
//             if (trimmed.endsWith('ms')) return parseFloat(trimmed);
//             if (trimmed.endsWith('s')) return parseFloat(trimmed) * 1000;
//             return 0;
//           })
//           .reduce((a, b) => Math.max(a, b), 0);
//       };

//       const animDuration = parseDurations(style.animationDuration ?? '0s');
//       const transDuration = parseDurations(style.transitionDuration ?? '0s');
//       const elMax = Math.max(animDuration, transDuration);
//       if (elMax > max) max = elMax;
//     }

//     return max;
//   });

//   return maxMs;
// }

// /**
//  * Uses a MutationObserver + rAF sampling to detect whether the page itself is
//  * running JS-driven DOM animations. Returns a cycle estimate in ms, or null if
//  * no DOM mutations are observed within the sampling window.
//  */
// async function rafSampleCycle(page: Page): Promise<number | null> {
//   const SAMPLE_MS = 300;
//   const MIN_MUTATIONS = 3;

//   const result: { mutationCount: number; durationMs: number } = await page.evaluate(
//     (sampleMs: number) => {
//       return new Promise<{ mutationCount: number; durationMs: number }>((resolve) => {
//         let mutationCount = 0;
//         const startTime = performance.now();

//         const observer = new MutationObserver(() => {
//           mutationCount++;
//         });

//         observer.observe(document.body ?? document.documentElement, {
//           subtree: true,
//           attributes: true,
//           childList: true,
//           characterData: true,
//         });

//         setTimeout(() => {
//           observer.disconnect();
//           resolve({ mutationCount, durationMs: performance.now() - startTime });
//         }, sampleMs);
//       });
//     },
//     SAMPLE_MS,
//   );

//   if (result.mutationCount < MIN_MUTATIONS) return null;

//   // Estimate cycle as sampling window / mutation rate, capped at 10s
//   const msPerMutation = result.durationMs / result.mutationCount;
//   return Math.min(Math.round(msPerMutation * 60), 10_000);
// }

// /**
//  * Detects the animation cycle length of the page in milliseconds.
//  * Returns null for static pages or when no cycle can be determined.
//  *
//  * Strategy:
//  * 1. CSS computed duration (fast, synchronous in-page query)
//  * 2. rAF sampling fallback (catches JS-driven animations)
//  * 3. null — page is static or cycle is indeterminate
//  */
// export async function detectAnimationCycle(page: Page): Promise<number | null> {
//   try {
//     const cssDuration = await cssMaxDuration(page);
//     if (cssDuration > 0) return cssDuration;

//     return await rafSampleCycle(page);
//   // } catch {
//   //   return null;
//   // }
//   } catch (e) {
//     console.error('DEBUG detector caught:', e);
//     return null;
//   }
// }

import type { Page } from 'playwright';

/**
 * Queries all DOM elements and returns the maximum computed CSS animation or
 * transition duration in milliseconds. Returns 0 if no animated elements found.
 *
 * All page.evaluate arguments and return values are plain serialisable types.
 */
async function cssMaxDuration(page: Page): Promise<number> {
  const maxMs: number = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    let max = 0;

    const SHORT_TRANSITION_THRESHOLD_MS = 500;

    const parseDurations = (raw: string): number[] => {
      if (!raw) return [];
      return raw.split(',').map((part) => {
        const t = part.trim();
        return t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000;
      });
    };

    for (const el of elements) {
      const style = window.getComputedStyle(el);

      const animDurations = parseDurations(style.animationDuration ?? '');
      const transDurations = parseDurations(style.transitionDuration ?? '');

      const hasAnimation = animDurations.some((ms) => ms > 0);

      for (const ms of animDurations) {
        if (ms > max) max = ms;
      }

      for (const ms of transDurations) {
        if (ms >= SHORT_TRANSITION_THRESHOLD_MS || hasAnimation) {
          if (ms > max) max = ms;
        }
      }
    }

    return max;
  });

  return maxMs;
}

/**
 * Uses a MutationObserver + rAF sampling to detect whether the page itself is
 * running JS-driven DOM animations. Returns a cycle estimate in ms, or null if
 * no DOM mutations are observed within the sampling window.
 */
async function rafSampleCycle(page: Page): Promise<number | null> {
  const SAMPLE_MS = 300;
  const MIN_MUTATIONS = 3;

  const result: { mutationCount: number; durationMs: number } = await page.evaluate(
    (sampleMs: number) => {
      return new Promise<{ mutationCount: number; durationMs: number }>((resolve) => {
        let mutationCount = 0;
        const startTime = performance.now();

        const observer = new MutationObserver(() => {
          mutationCount++;
        });

        observer.observe(document.body ?? document.documentElement, {
          subtree: true,
          attributes: true,
          childList: true,
          characterData: true,
        });

        setTimeout(() => {
          observer.disconnect();
          resolve({ mutationCount, durationMs: performance.now() - startTime });
        }, sampleMs);
      });
    },
    SAMPLE_MS,
  );

  if (result.mutationCount < MIN_MUTATIONS) return null;

  // Estimate cycle as sampling window / mutation rate, capped at 10s
  const msPerMutation = result.durationMs / result.mutationCount;
  return Math.min(Math.round(msPerMutation * 60), 10_000);
}

/**
 * Detects the animation cycle length of the page in milliseconds.
 * Returns null for static pages or when no cycle can be determined.
 *
 * Strategy:
 * 1. CSS computed duration (fast, synchronous in-page query)
 * 2. rAF sampling fallback (catches JS-driven animations)
 * 3. null — page is static or cycle is indeterminate
 */
export async function detectAnimationCycle(page: Page): Promise<number | null> {
  try {
    const cssDuration = await cssMaxDuration(page);
    if (cssDuration > 0) return cssDuration;

    return await rafSampleCycle(page);
  } catch {
    return null;
  }
}