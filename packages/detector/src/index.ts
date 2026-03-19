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

// ---------------------------------------------------------------------------
// LCM helpers (used by autoDetectDuration)
// ---------------------------------------------------------------------------

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcmTwo(a: number, b: number): number {
  return Math.round((a / gcd(a, b)) * b);
}

function lcmAll(nums: number[]): number {
  return nums.reduce(lcmTwo, 1);
}

// ---------------------------------------------------------------------------
// autoDetectElement
// ---------------------------------------------------------------------------

export type AutoElementResult =
  | { selector: string; width: number; height: number; ambiguous: false }
  | { selector: null; width: 0; height: 0; ambiguous: true }
  | null;

/**
 * Identifies the most prominent content element on the page using a scoring
 * algorithm (area × centrality − depth penalty). Returns null if no visible
 * block-level candidates exist.
 */
export async function autoDetectElement(page: Page): Promise<AutoElementResult> {
  try {
    const result: { selector: string; width: number; height: number } | { ambiguous: true } | null =
      await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const pageCenterX = viewportWidth / 2;
        const pageCenterY = viewportHeight / 2;
        const maxDist = Math.sqrt(pageCenterX ** 2 + pageCenterY ** 2) || 1;

        const candidates = Array.from(
          document.querySelectorAll('div, section, article, main, figure, canvas, svg'),
        );

        const scored: { el: Element; score: number; rect: DOMRect }[] = [];

        for (const el of candidates) {
          if (el === document.body || el === document.documentElement) continue;

          const style = window.getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          )
            continue;

          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          if (rect.width >= viewportWidth * 0.95) continue;

          const area = rect.width * rect.height;
          const elCenterX = rect.left + rect.width / 2;
          const elCenterY = rect.top + rect.height / 2;
          const dist = Math.sqrt((elCenterX - pageCenterX) ** 2 + (elCenterY - pageCenterY) ** 2);
          const centrality = (1 - dist / maxDist) * area;

          let depth = 0;
          let node: Element | null = el.parentElement;
          while (node) {
            depth++;
            node = node.parentElement;
          }
          const depthFactor = Math.max(0.1, 1 - depth * 0.05);

          const score = (area + centrality) * depthFactor;
          scored.push({ el, score, rect });
        }

        if (scored.length === 0) return null;

        scored.sort((a, b) => b.score - a.score);

        // Ambiguity check: top two within 10%
        if (scored.length >= 2 && scored[1]!.score >= scored[0]!.score * 0.9) {
          return { ambiguous: true };
        }

        const winner = scored[0]!.el;
        const rect = scored[0]!.rect;

        // Selector generation: #id > .unique-class > path
        let selector: string | null = null;

        if ((winner as HTMLElement).id) {
          selector = '#' + (winner as HTMLElement).id;
        } else {
          const classes = Array.from((winner as HTMLElement).classList);
          for (const cls of classes) {
            if (document.querySelectorAll('.' + CSS.escape(cls)).length === 1) {
              selector = '.' + CSS.escape(cls);
              break;
            }
          }

          if (!selector) {
            const parts: string[] = [];
            let node: Element | null = winner;
            while (node && node !== document.body) {
              const tag = node.tagName.toLowerCase();
              const parent: Element | null = node.parentElement;
              if (parent) {
                const siblings = Array.from<Element>(parent.children).filter(
                  (c) => c.tagName === node!.tagName,
                );
                if (siblings.length > 1) {
                  const idx = siblings.indexOf(node) + 1;
                  parts.unshift(`${tag}:nth-child(${idx})`);
                } else {
                  parts.unshift(tag);
                }
              } else {
                parts.unshift(tag);
              }
              node = parent;
            }
            selector = parts.join(' > ');
          }
        }

        return { selector, width: Math.round(rect.width), height: Math.round(rect.height) };
      });

    if (result === null) return null;
    if ('ambiguous' in result) return { selector: null, width: 0, height: 0, ambiguous: true };
    return { selector: result.selector, width: result.width, height: result.height, ambiguous: false };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// autoDetectDuration
// ---------------------------------------------------------------------------

export type AutoDurationResult = {
  durationMs: number;
  strategy: 'css-lcm' | 'css-transition' | 'source-pattern';
  /** Present when LCM exceeded 10 000ms and longest individual was used instead */
  lcmMs?: number;
};

/**
 * Detects animation cycle length using a multi-source strategy:
 * 1. CSS animation-duration LCM (capped at 10 000ms)
 * 2. CSS transition-duration fallback (longest ≥ 500ms)
 * 3. Source pattern scan
 * Returns null if no animation cycle can be determined.
 */
export async function autoDetectDuration(
  page: Page,
  selector?: string,
): Promise<AutoDurationResult | null> {
  try {
    // Strategy 1: CSS animation-duration LCM
    const animDurations: number[] = await page.evaluate((sel: string | null) => {
      const root = sel ? document.querySelector(sel) : document.documentElement;
      if (!root) return [];
      const elements = [root, ...Array.from(root.querySelectorAll('*'))];
      const durations: number[] = [];
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const raw = style.animationDuration ?? '';
        if (!raw) continue;
        raw.split(',').forEach((part) => {
          const t = part.trim();
          if (!t || t === '0s' || t === '0ms') return;
          const ms = t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000;
          if (ms > 0 && isFinite(ms)) durations.push(Math.round(ms));
        });
      }
      return durations;
    }, selector ?? null);

    if (animDurations.length > 0) {
      const maxDuration = Math.max(...animDurations);
      const lcmValue = lcmAll(animDurations);
      if (lcmValue <= 10000) {
        return { durationMs: lcmValue, strategy: 'css-lcm' };
      } else {
        return { durationMs: maxDuration, strategy: 'css-lcm', lcmMs: lcmValue };
      }
    }

    // Strategy 2: CSS transition-duration (longest ≥ 500ms)
    const transDuration: number = await page.evaluate((sel: string | null) => {
      const root = sel ? document.querySelector(sel) : document.documentElement;
      if (!root) return 0;
      const elements = [root, ...Array.from(root.querySelectorAll('*'))];
      let max = 0;
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const raw = style.transitionDuration ?? '';
        raw.split(',').forEach((part) => {
          const t = part.trim();
          if (!t) return;
          const ms = t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000;
          if (ms >= 500 && ms > max) max = Math.round(ms);
        });
      }
      return max;
    }, selector ?? null);

    if (transDuration > 0) {
      return { durationMs: transDuration, strategy: 'css-transition' };
    }

    // Strategy 3: Source pattern scan
    const pageContent = await page.content();
    const pattern = /(?:loop|duration|cycle|interval|delay)\s*[:=]\s*(\d+(?:\.\d+)?)/gi;
    let maxValue = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(pageContent)) !== null) {
      const num = parseFloat(match[1]!);
      if (num > 0) {
        const ms = num >= 100 ? num : num * 1000;
        if (ms > maxValue) maxValue = ms;
      }
    }
    if (maxValue > 0) {
      return { durationMs: Math.round(maxValue), strategy: 'source-pattern' };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// autoDetectFps
// ---------------------------------------------------------------------------

/**
 * Selects optimal FPS based on CSS animation timing functions:
 * - Non-linear (ease, cubic-bezier): 24 fps
 * - Linear / transitions only: 12 fps
 * Applies a frame-count ceiling of 1200 frames when durationMs is provided.
 */
export async function autoDetectFps(
  page: Page,
  selector?: string,
  durationMs?: number,
): Promise<number> {
  try {
    const hasNonLinear: boolean = await page.evaluate((sel: string | null) => {
      const root = sel ? document.querySelector(sel) : document.documentElement;
      if (!root) return false;
      const elements = [root, ...Array.from(root.querySelectorAll('*'))];
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const timing = style.animationTimingFunction ?? '';
        if (!timing || timing === 'none') continue;

        const parts = timing.split(',').map((p) => p.trim());
        for (const part of parts) {
          if (!part || part === 'none') continue;
          if (part === 'linear') continue;
          if (
            part === 'ease' ||
            part === 'ease-in' ||
            part === 'ease-out' ||
            part === 'ease-in-out'
          )
            return true;
          if (part.startsWith('cubic-bezier')) {
            const m = part.match(
              /cubic-bezier\s*\(\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*\)/,
            );
            if (m) {
              const x1 = parseFloat(m[1]!);
              const y1 = parseFloat(m[2]!);
              const x2 = parseFloat(m[3]!);
              const y2 = parseFloat(m[4]!);
              if (!(x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1)) return true;
            } else {
              return true;
            }
          }
          if (!part.startsWith('steps')) return true;
        }
      }
      return false;
    }, selector ?? null);

    let fps = hasNonLinear ? 24 : 12;

    if (durationMs !== undefined && durationMs > 0) {
      const frameCount = fps * (durationMs / 1000);
      if (frameCount > 1200) {
        fps = Math.max(1, Math.floor(1200 / (durationMs / 1000)));
      }
    }

    return fps;
  } catch {
    return 12;
  }
}

// ---------------------------------------------------------------------------
// detectAnimationCycle (existing)
// ---------------------------------------------------------------------------

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