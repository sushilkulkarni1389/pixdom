"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");

// ../../packages/core/dist/index.js
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_playwright = require("playwright");

// ../../packages/detector/dist/index.js
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
function lcmTwo(a, b) {
  return Math.round(a / gcd(a, b) * b);
}
function lcmAll(nums) {
  return nums.reduce(lcmTwo, 1);
}
async function autoDetectElement(page) {
  try {
    const result = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pageCenterX = viewportWidth / 2;
      const pageCenterY = viewportHeight / 2;
      const maxDist = Math.sqrt(pageCenterX ** 2 + pageCenterY ** 2) || 1;
      const candidates = Array.from(document.querySelectorAll("div, section, article, main, figure, canvas, svg"));
      const scored = [];
      for (const el of candidates) {
        if (el === document.body || el === document.documentElement)
          continue;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")
          continue;
        const rect2 = el.getBoundingClientRect();
        if (rect2.width <= 0 || rect2.height <= 0)
          continue;
        if (rect2.width >= viewportWidth * 0.95)
          continue;
        const area = rect2.width * rect2.height;
        const elCenterX = rect2.left + rect2.width / 2;
        const elCenterY = rect2.top + rect2.height / 2;
        const dist = Math.sqrt((elCenterX - pageCenterX) ** 2 + (elCenterY - pageCenterY) ** 2);
        const centrality = (1 - dist / maxDist) * area;
        let depth = 0;
        let node = el.parentElement;
        while (node) {
          depth++;
          node = node.parentElement;
        }
        const depthFactor = Math.max(0.1, 1 - depth * 0.05);
        const score = (area + centrality) * depthFactor;
        scored.push({ el, score, rect: rect2 });
      }
      if (scored.length === 0)
        return null;
      scored.sort((a, b) => b.score - a.score);
      if (scored.length >= 2 && scored[1].score >= scored[0].score * 0.9) {
        return { ambiguous: true };
      }
      const winner = scored[0].el;
      const rect = scored[0].rect;
      let selector = null;
      if (winner.id) {
        selector = "#" + winner.id;
      } else {
        const classes = Array.from(winner.classList);
        for (const cls of classes) {
          if (document.querySelectorAll("." + CSS.escape(cls)).length === 1) {
            selector = "." + CSS.escape(cls);
            break;
          }
        }
        if (!selector) {
          const parts = [];
          let node = winner;
          while (node && node !== document.body) {
            const tag = node.tagName.toLowerCase();
            const parent = node.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
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
          selector = parts.join(" > ");
        }
      }
      return { selector, width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    if (result === null)
      return null;
    if ("ambiguous" in result)
      return { selector: null, width: 0, height: 0, ambiguous: true };
    return { selector: result.selector, width: result.width, height: result.height, ambiguous: false };
  } catch {
    return null;
  }
}
async function autoDetectDuration(page, selector) {
  try {
    const animDurations = await page.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.documentElement;
      if (!root)
        return [];
      const elements = [root, ...Array.from(root.querySelectorAll("*"))];
      const durations = [];
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const raw = style.animationDuration ?? "";
        if (!raw)
          continue;
        raw.split(",").forEach((part) => {
          const t = part.trim();
          if (!t || t === "0s" || t === "0ms")
            return;
          const ms = t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1e3;
          if (ms > 0 && isFinite(ms))
            durations.push(Math.round(ms));
        });
      }
      return durations;
    }, selector ?? null);
    if (animDurations.length > 0) {
      const maxDuration = Math.max(...animDurations);
      const lcmValue = lcmAll(animDurations);
      if (lcmValue <= 1e4) {
        return { durationMs: lcmValue, strategy: "css-lcm" };
      } else {
        return { durationMs: maxDuration, strategy: "css-lcm", lcmMs: lcmValue };
      }
    }
    const transDuration = await page.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.documentElement;
      if (!root)
        return 0;
      const elements = [root, ...Array.from(root.querySelectorAll("*"))];
      let max = 0;
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const raw = style.transitionDuration ?? "";
        raw.split(",").forEach((part) => {
          const t = part.trim();
          if (!t)
            return;
          const ms = t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1e3;
          if (ms >= 500 && ms > max)
            max = Math.round(ms);
        });
      }
      return max;
    }, selector ?? null);
    if (transDuration > 0) {
      return { durationMs: transDuration, strategy: "css-transition" };
    }
    const pageContent = await page.content();
    const pattern = /(?:loop|duration|cycle|interval|delay)\s*[:=]\s*(\d+(?:\.\d+)?)/gi;
    let maxValue = 0;
    let match;
    while ((match = pattern.exec(pageContent)) !== null) {
      const num = parseFloat(match[1]);
      if (num > 0) {
        const ms = num >= 100 ? num : num * 1e3;
        if (ms > maxValue)
          maxValue = ms;
      }
    }
    if (maxValue > 0) {
      return { durationMs: Math.round(maxValue), strategy: "source-pattern" };
    }
    return null;
  } catch {
    return null;
  }
}
async function autoDetectFps(page, selector, durationMs) {
  try {
    const hasNonLinear = await page.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.documentElement;
      if (!root)
        return false;
      const elements = [root, ...Array.from(root.querySelectorAll("*"))];
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const timing = style.animationTimingFunction ?? "";
        if (!timing || timing === "none")
          continue;
        const parts = timing.split(",").map((p) => p.trim());
        for (const part of parts) {
          if (!part || part === "none")
            continue;
          if (part === "linear")
            continue;
          if (part === "ease" || part === "ease-in" || part === "ease-out" || part === "ease-in-out")
            return true;
          if (part.startsWith("cubic-bezier")) {
            const m = part.match(/cubic-bezier\s*\(\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
            if (m) {
              const x1 = parseFloat(m[1]);
              const y1 = parseFloat(m[2]);
              const x2 = parseFloat(m[3]);
              const y2 = parseFloat(m[4]);
              if (!(x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1))
                return true;
            } else {
              return true;
            }
          }
          if (!part.startsWith("steps"))
            return true;
        }
      }
      return false;
    }, selector ?? null);
    let fps = hasNonLinear ? 24 : 12;
    if (durationMs !== void 0 && durationMs > 0) {
      const frameCount = fps * (durationMs / 1e3);
      if (frameCount > 1200) {
        fps = Math.max(1, Math.floor(1200 / (durationMs / 1e3)));
      }
    }
    return fps;
  } catch {
    return 12;
  }
}
async function cssMaxDuration(page) {
  const maxMs = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("*"));
    let max = 0;
    const SHORT_TRANSITION_THRESHOLD_MS = 500;
    const parseDurations = (raw) => {
      if (!raw)
        return [];
      return raw.split(",").map((part) => {
        const t = part.trim();
        return t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1e3;
      });
    };
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const animDurations = parseDurations(style.animationDuration ?? "");
      const transDurations = parseDurations(style.transitionDuration ?? "");
      const hasAnimation = animDurations.some((ms) => ms > 0);
      for (const ms of animDurations) {
        if (ms > max)
          max = ms;
      }
      for (const ms of transDurations) {
        if (ms >= SHORT_TRANSITION_THRESHOLD_MS || hasAnimation) {
          if (ms > max)
            max = ms;
        }
      }
    }
    return max;
  });
  return maxMs;
}
async function rafSampleCycle(page) {
  const SAMPLE_MS = 300;
  const MIN_MUTATIONS = 3;
  const result = await page.evaluate((sampleMs) => {
    return new Promise((resolve2) => {
      let mutationCount = 0;
      const startTime = performance.now();
      const observer = new MutationObserver(() => {
        mutationCount++;
      });
      observer.observe(document.body ?? document.documentElement, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true
      });
      setTimeout(() => {
        observer.disconnect();
        resolve2({ mutationCount, durationMs: performance.now() - startTime });
      }, sampleMs);
    });
  }, SAMPLE_MS);
  if (result.mutationCount < MIN_MUTATIONS)
    return null;
  const msPerMutation = result.durationMs / result.mutationCount;
  return Math.min(Math.round(msPerMutation * 60), 1e4);
}
async function detectAnimationCycle(page) {
  try {
    const cssDuration = await cssMaxDuration(page);
    if (cssDuration > 0)
      return cssDuration;
    return await rafSampleCycle(page);
  } catch {
    return null;
  }
}

// ../../packages/types/dist/index.js
var import_zod = require("zod");
var RenderInputSchema = import_zod.z.discriminatedUnion("type", [
  import_zod.z.object({ type: import_zod.z.literal("html"), html: import_zod.z.string() }),
  import_zod.z.object({ type: import_zod.z.literal("file"), path: import_zod.z.string() }),
  import_zod.z.object({ type: import_zod.z.literal("url"), url: import_zod.z.string() }),
  import_zod.z.object({ type: import_zod.z.literal("image"), path: import_zod.z.string() })
]);
var OutputFormatSchema = import_zod.z.enum(["png", "jpeg", "webp", "gif", "mp4", "webm"]);
var ViewportOptionsSchema = import_zod.z.object({
  width: import_zod.z.number().default(1280),
  height: import_zod.z.number().default(720),
  deviceScaleFactor: import_zod.z.number().default(1)
});
var RenderOptionsSchema = import_zod.z.object({
  input: RenderInputSchema,
  format: OutputFormatSchema,
  viewport: ViewportOptionsSchema,
  quality: import_zod.z.number().int().min(0).max(100).optional(),
  timeout: import_zod.z.number().optional(),
  fps: import_zod.z.number().optional(),
  duration: import_zod.z.number().optional(),
  autoSize: import_zod.z.boolean().optional(),
  selector: import_zod.z.string().optional(),
  allowLocal: import_zod.z.boolean().optional(),
  auto: import_zod.z.boolean().optional()
});
var ProfileIdSchema = import_zod.z.enum([
  // LinkedIn (6)
  "linkedin-background",
  "linkedin-post",
  "linkedin-article-cover",
  "linkedin-profile",
  "linkedin-single-image-ad",
  "linkedin-career-background",
  // Twitter/X (5)
  "twitter-post",
  "twitter-header",
  "twitter-ad",
  "twitter-video",
  "twitter-ad-landscape",
  // Instagram (7)
  "instagram-post-3-4",
  "instagram-post-4-5",
  "instagram-post-square",
  "instagram-story",
  "instagram-reel",
  "instagram-profile",
  "instagram-story-video",
  // Generic (1)
  "square",
  // Legacy aliases (3)
  "instagram",
  "twitter",
  "linkedin"
]);
var ProfileSchema = import_zod.z.object({
  id: ProfileIdSchema,
  width: import_zod.z.number(),
  height: import_zod.z.number(),
  format: OutputFormatSchema,
  quality: import_zod.z.number(),
  label: import_zod.z.string(),
  group: import_zod.z.string(),
  fps: import_zod.z.number().optional()
});
var AnimationResultSchema = import_zod.z.object({
  cycleMs: import_zod.z.number().nullable()
});
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return { ok: false, error };
}

// ../../packages/core/dist/errors.js
function makeError(code, message, cause, hints) {
  const error = { code, message, cause };
  if (hints !== void 0)
    error.hints = hints;
  return error;
}

// ../../packages/core/dist/load-page.js
async function loadPage(page, input) {
  switch (input.type) {
    case "html":
      await page.setContent(input.html, { waitUntil: "networkidle" });
      break;
    case "file":
      await page.goto(`file://${input.path}`, { waitUntil: "networkidle" });
      break;
    case "url":
      await page.goto(input.url, { waitUntil: "networkidle" });
      break;
  }
}

// ../../packages/core/dist/static-renderer.js
var import_sharp = __toESM(require("sharp"), 1);
async function renderStatic(page, options, element, onProgress) {
  const emit = onProgress ?? (() => {
  });
  emit({ type: "step-start", step: "capture" });
  const screenshot = element ? await element.screenshot({ type: "png" }) : await page.screenshot({ type: "png", fullPage: false });
  emit({ type: "step-done", step: "capture" });
  const image = (0, import_sharp.default)(screenshot);
  emit({ type: "step-start", step: "write-output" });
  let buf;
  switch (options.format) {
    case "png":
      buf = await image.png({ compressionLevel: Math.round((100 - (options.quality ?? 100)) / 100 * 9) }).toBuffer();
      break;
    case "jpeg":
      buf = await image.jpeg({ quality: options.quality ?? 90 }).toBuffer();
      break;
    case "webp":
      buf = await image.webp({ quality: options.quality ?? 90 }).toBuffer();
      break;
    default:
      throw new Error(`Static renderer does not handle format: ${options.format}`);
  }
  emit({ type: "step-done", step: "write-output" });
  return buf;
}

// ../../packages/core/dist/animated-renderer.js
var import_promises = __toESM(require("node:fs/promises"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_crypto = require("node:crypto");

// ../../packages/core/dist/ffmpeg-spawn.js
var import_node_child_process = require("node:child_process");
var import_ffmpeg_static = __toESM(require("ffmpeg-static"), 1);
function getFfmpegPath() {
  if (!import_ffmpeg_static.default) {
    throw new Error("FFmpeg binary not available on this platform (ffmpeg-static returned null)");
  }
  return import_ffmpeg_static.default;
}
function spawnFfmpeg(args, totalFrames, onProgress) {
  return new Promise((resolve2, reject) => {
    const bin = getFfmpegPath();
    const proc = (0, import_node_child_process.spawn)(bin, args, { shell: false });
    const stderrLines = [];
    let stderrBuf = "";
    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) {
        stderrLines.push(line);
        if (onProgress && totalFrames != null && totalFrames > 0) {
          const m = line.match(/frame=\s*(\d+)/);
          if (m) {
            const pct = Math.min(100, Math.round(parseInt(m[1], 10) / totalFrames * 100));
            onProgress({ type: "encode-progress", pct });
          }
        }
      }
    });
    proc.on("error", (err2) => reject(err2));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve2();
      } else {
        const stderr = stderrLines.join("\n");
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });
  });
}

// ../../packages/core/dist/animated-renderer.js
async function captureFrames(page, cycleMs, fps, outDir, element, onProgress) {
  const emit = onProgress ?? (() => {
  });
  const frameCount = Math.max(1, Math.round(cycleMs / 1e3 * fps));
  const frameIntervalMs = cycleMs / frameCount;
  if (element) {
    await element.boundingBox();
  }
  await page.clock.install({ time: 0 });
  emit({ type: "step-start", step: "capture-frames" });
  const paths = [];
  let lastEmitTs = 0;
  for (let i = 0; i < frameCount; i++) {
    await page.clock.runFor(frameIntervalMs);
    const framePath = import_node_path.default.join(outDir, `frame-${String(i).padStart(6, "0")}.png`);
    if (element) {
      await element.screenshot({ type: "png", path: framePath });
    } else {
      await page.screenshot({ type: "png", fullPage: false, path: framePath });
    }
    paths.push(framePath);
    const now = Date.now();
    if (now - lastEmitTs >= 100) {
      emit({ type: "frame-progress", current: i + 1, total: frameCount });
      lastEmitTs = now;
    }
  }
  emit({ type: "step-done", step: "capture-frames" });
  return paths;
}
async function encodeGif(frames, fps, _cycleMs, onProgress) {
  getFfmpegPath();
  const pattern = frames[0].replace(/frame-\d+\.png$/, "frame-%06d.png");
  const palettePath = frames[0].replace(/frame-\d+\.png$/, "palette.png");
  const outPath = frames[0].replace(/frame-\d+\.png$/, "out.gif");
  await spawnFfmpeg(["-framerate", String(fps), "-i", pattern, "-vf", "palettegen", "-y", palettePath]);
  await spawnFfmpeg([
    "-framerate",
    String(fps),
    "-i",
    pattern,
    "-i",
    palettePath,
    "-loop",
    "0",
    "-filter_complex",
    "[0:v][1:v]paletteuse",
    "-y",
    outPath
  ], frames.length, onProgress);
  const buf = await import_promises.default.readFile(outPath);
  await import_promises.default.unlink(outPath);
  return buf;
}
async function encodeMp4(frames, fps, onProgress) {
  getFfmpegPath();
  const pattern = frames[0].replace(/frame-\d+\.png$/, "frame-%06d.png");
  const outPath = frames[0].replace(/frame-\d+\.png$/, "out.mp4");
  await spawnFfmpeg([
    "-framerate",
    String(fps),
    "-i",
    pattern,
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-y",
    outPath
  ], frames.length, onProgress);
  const buf = await import_promises.default.readFile(outPath);
  await import_promises.default.unlink(outPath);
  return buf;
}
async function encodeWebm(frames, fps, onProgress) {
  getFfmpegPath();
  const pattern = frames[0].replace(/frame-\d+\.png$/, "frame-%06d.png");
  const outPath = frames[0].replace(/frame-\d+\.png$/, "out.webm");
  await spawnFfmpeg([
    "-framerate",
    String(fps),
    "-i",
    pattern,
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    "33",
    "-y",
    outPath
  ], frames.length, onProgress);
  const buf = await import_promises.default.readFile(outPath);
  await import_promises.default.unlink(outPath);
  return buf;
}
async function renderAnimated(page, options, cycleMs, element, onProgress) {
  const emit = onProgress ?? (() => {
  });
  const tmpDir = import_node_path.default.join(import_node_os.default.tmpdir(), `pixdom-${(0, import_node_crypto.randomUUID)()}`);
  await import_promises.default.mkdir(tmpDir, { recursive: true });
  await import_promises.default.chmod(tmpDir, 448);
  const cleanup = () => {
    try {
      import_node_fs.default.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
    }
  };
  const sigtermHandler = () => {
    cleanup();
    process.kill(process.pid, "SIGTERM");
  };
  const sigintHandler = () => {
    cleanup();
    process.kill(process.pid, "SIGINT");
  };
  process.once("SIGTERM", sigtermHandler);
  process.once("SIGINT", sigintHandler);
  try {
    const fps = options.fps ?? 30;
    const frames = await captureFrames(page, cycleMs, fps, tmpDir, element, onProgress);
    const fmt = options.format.toUpperCase();
    emit({ type: "encode-format", format: fmt });
    let buf;
    switch (options.format) {
      case "gif":
        buf = await encodeGif(frames, fps, cycleMs, onProgress);
        break;
      case "mp4":
        buf = await encodeMp4(frames, fps, onProgress);
        break;
      case "webm":
        buf = await encodeWebm(frames, fps, onProgress);
        break;
      default:
        throw new Error(`Animated renderer does not handle format: ${options.format}`);
    }
    emit({ type: "encode-done", format: fmt });
    emit({ type: "step-start", step: "write-output" });
    emit({ type: "step-done", step: "write-output" });
    return buf;
  } finally {
    process.off("SIGTERM", sigtermHandler);
    process.off("SIGINT", sigintHandler);
    await import_promises.default.rm(tmpDir, { recursive: true, force: true });
  }
}

// ../../packages/core/dist/image-renderer.js
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_sharp2 = __toESM(require("sharp"), 1);
var MAX_INPUT_PIXELS = 268402689;
var ANIMATED_FORMATS = /* @__PURE__ */ new Set(["gif", "mp4", "webm"]);
async function renderImage(options, onProgress) {
  const emit = onProgress ?? (() => {
  });
  if (options.input.type !== "image") {
    throw makeError("CAPTURE_FAILED", "renderImage called with non-image input");
  }
  if (ANIMATED_FORMATS.has(options.format)) {
    throw makeError("CAPTURE_FAILED", `Image input does not support animated output format: ${options.format}`);
  }
  if (!import_node_fs2.default.existsSync(options.input.path)) {
    throw makeError("IMAGE_NOT_FOUND", `Image "${options.input.path}" does not exist`);
  }
  const { width, height } = options.viewport;
  const DEFAULT_WIDTH = 1280;
  const DEFAULT_HEIGHT = 720;
  emit({ type: "step-start", step: "read-image" });
  let image = (0, import_sharp2.default)(options.input.path, { limitInputPixels: MAX_INPUT_PIXELS });
  emit({ type: "step-done", step: "read-image" });
  if (width !== DEFAULT_WIDTH || height !== DEFAULT_HEIGHT) {
    emit({ type: "step-start", step: "resize" });
    image = image.resize(width, height, { fit: "inside" });
    emit({ type: "step-done", step: "resize" });
  }
  emit({ type: "step-start", step: "write-output" });
  let buf;
  switch (options.format) {
    case "png":
      buf = await image.png({ compressionLevel: Math.round((100 - (options.quality ?? 100)) / 100 * 9) }).toBuffer();
      break;
    case "jpeg":
      buf = await image.jpeg({ quality: options.quality ?? 90 }).toBuffer();
      break;
    case "webp":
      buf = await image.webp({ quality: options.quality ?? 90 }).toBuffer();
      break;
    default:
      throw makeError("SHARP_ERROR", `Image renderer does not handle format: ${options.format}`);
  }
  emit({ type: "step-done", step: "write-output" });
  return buf;
}

// ../../packages/core/dist/animation-cycle-hint.js
function toMs(value, unit) {
  if (unit === "ms")
    return value;
  if (unit === "s" || unit === void 0) {
    return value < 100 ? value * 1e3 : value;
  }
  return value;
}
function hint(ms, source) {
  return `Found possible cycle length (${source}): ${ms}ms \u2192 try --duration ${ms}`;
}
function scanForCycleLengths(html) {
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  function add(ms, source) {
    const rounded = Math.round(ms);
    if (rounded > 0 && !seen.has(rounded)) {
      seen.add(rounded);
      candidates.push({ ms: rounded, source });
    }
  }
  const cssRe = /animation-duration\s*:\s*([\d.]+)(ms|s)?/gi;
  for (const m of html.matchAll(cssRe)) {
    const val = parseFloat(m[1]);
    const unit = m[2] ?? "s";
    if (!isNaN(val))
      add(toMs(val, unit), "CSS animation-duration");
  }
  const jsVarRe = /(?:duration|cycle|loop|total[Dd]uration|CYCLE|LOOP|DURATION)\s*[=:]\s*([\d.]+)\s*(?:,|;|\n|\r|\/\/|\*\/)?/g;
  for (const m of html.matchAll(jsVarRe)) {
    const val = parseFloat(m[1]);
    if (!isNaN(val))
      add(toMs(val), "JS variable assignment");
  }
  const rafRe = /(?:if\s*\(\s*\w+\s*>=\s*([\d.]+)\s*\)|\w+\s*%\s*([\d.]+))/g;
  for (const m of html.matchAll(rafRe)) {
    const val = parseFloat(m[1] ?? m[2]);
    if (!isNaN(val))
      add(toMs(val), "rAF comparison");
  }
  return candidates.slice(0, 3).map((c) => hint(c.ms, c.source));
}

// ../../packages/core/dist/request-guard.js
var import_promises2 = __toESM(require("node:dns/promises"), 1);
var ALLOWED_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:"]);
function parseCidr4(cidr) {
  const [ip, bits] = cidr.split("/");
  const mask = bits ? ~((1 << 32 - Number(bits)) - 1) >>> 0 : 4294967295;
  const parts = ip.split(".").map(Number);
  const base = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
  return { base: base >>> 0, mask: mask >>> 0 };
}
function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);
  return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
}
var BLOCKED_CIDRS = [
  "127.0.0.0/8",
  // loopback
  "10.0.0.0/8",
  // RFC1918
  "172.16.0.0/12",
  // RFC1918
  "192.168.0.0/16",
  // RFC1918
  "169.254.0.0/16"
  // link-local / cloud metadata
].map(parseCidr4);
function isBlockedIpv4(ip) {
  const n = ipv4ToInt(ip);
  return BLOCKED_CIDRS.some((cidr) => (n & cidr.mask) === cidr.base);
}
function isBlockedIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1")
    return true;
  if (lower.startsWith("fc") || lower.startsWith("fd"))
    return true;
  return false;
}
async function isBlockedHost(hostname) {
  try {
    const result = await import_promises2.default.lookup(hostname, { all: true });
    for (const addr of result) {
      if (addr.family === 4 && isBlockedIpv4(addr.address))
        return true;
      if (addr.family === 6 && isBlockedIpv6(addr.address))
        return true;
    }
  } catch {
  }
  return false;
}
async function installRequestGuard(page, options) {
  const allowLocal = options.allowLocal === true;
  await page.route("**", async (route) => {
    const url = new URL(route.request().url());
    const isFileInput = options.input.type === "file";
    if (!ALLOWED_PROTOCOLS.has(url.protocol) && !(isFileInput && url.protocol === "file:")) {
      await route.abort("blockedbyclient");
      return;
    }
    if (!allowLocal && url.protocol !== "file:") {
      const blocked = await isBlockedHost(url.hostname);
      if (blocked) {
        await route.abort("blockedbyclient");
        return;
      }
    }
    await route.continue();
  });
}

// ../../packages/core/dist/index.js
var ANIMATED_FORMATS2 = /* @__PURE__ */ new Set(["gif", "mp4", "webm"]);
var STATIC_FORMATS = /* @__PURE__ */ new Set(["png", "jpeg", "webp"]);
async function render(options, { onProgress } = {}) {
  const emit = onProgress ?? (() => {
  });
  if (options.input.type === "file" && !import_node_fs3.default.existsSync(options.input.path)) {
    return err(makeError("FILE_NOT_FOUND", `File "${options.input.path}" does not exist`));
  }
  if (options.input.type === "image") {
    try {
      const buffer = await renderImage(options, emit);
      return ok(buffer);
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause) {
        return err(cause);
      }
      const msg = cause instanceof Error ? cause.message : String(cause);
      return err(makeError("SHARP_ERROR", `Image processing failed: ${msg}`, cause));
    }
  }
  let browser;
  const noSandbox = process.env["PIXDOM_NO_SANDBOX"] === "1" || process.env["PIXDOM_NO_SANDBOX"] === "true";
  if (noSandbox) {
    process.stderr.write("Warning: PIXDOM_NO_SANDBOX is set \u2014 running Chromium without sandbox. Do not use in production.\n");
  }
  try {
    browser = await import_playwright.chromium.launch({
      args: [
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-background-networking",
        "--disable-webrtc",
        ...noSandbox ? ["--no-sandbox", "--disable-setuid-sandbox"] : []
      ]
    });
  } catch (cause) {
    return err(makeError("BROWSER_LAUNCH_FAILED", "Failed to launch browser", cause));
  }
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await page.setViewportSize({
      width: options.viewport.width,
      height: options.viewport.height
    });
    page.setDefaultNavigationTimeout(3e4);
    await installRequestGuard(page, options);
    if (options.viewport.deviceScaleFactor !== 1) {
      await page.emulateMedia({ colorScheme: "light" });
    }
    emit({ type: "step-start", step: "load-page" });
    try {
      await loadPage(page, options.input);
    } catch (cause) {
      return err(makeError("PAGE_LOAD_FAILED", "Failed to load page", cause));
    }
    emit({ type: "step-done", step: "load-page" });
    let autoEffectiveSelector = options.selector;
    let autoEffectiveDuration = options.duration;
    let autoEffectiveFps = options.fps;
    let autoSwitchedToStatic = false;
    if (options.auto) {
      emit({ type: "step-start", step: "analyse-page" });
      let autoElement = null;
      let autoElementAmbiguous = false;
      let autoElementWidth = 0;
      let autoElementHeight = 0;
      if (!options.selector) {
        const elResult = await autoDetectElement(page);
        if (elResult !== null) {
          autoElement = elResult.selector;
          autoElementAmbiguous = elResult.ambiguous;
          autoElementWidth = elResult.width;
          autoElementHeight = elResult.height;
          if (elResult.selector) {
            autoEffectiveSelector = elResult.selector;
          }
        }
      } else {
        autoElement = options.selector;
      }
      emit({ type: "step-done", step: "analyse-page" });
      emit({ type: "step-start", step: "detect-animations" });
      let autoDuration = null;
      let autoDurationStrategy = null;
      let autoLcmExceeded = false;
      let autoLcmMs;
      if (!options.duration) {
        const durResult = await autoDetectDuration(page, autoEffectiveSelector ?? void 0);
        if (durResult !== null) {
          autoDuration = durResult.durationMs;
          autoDurationStrategy = durResult.strategy;
          autoLcmExceeded = durResult.lcmMs !== void 0;
          autoLcmMs = durResult.lcmMs;
          autoEffectiveDuration = autoDuration ?? void 0;
        }
      } else {
        autoDuration = options.duration;
        autoEffectiveDuration = options.duration;
      }
      if (!options.fps) {
        autoEffectiveFps = await autoDetectFps(page, autoEffectiveSelector ?? void 0, autoEffectiveDuration ?? void 0);
      }
      emit({ type: "step-done", step: "detect-animations" });
      const autoFrames = autoEffectiveDuration !== void 0 ? Math.round((autoEffectiveFps ?? 12) * (autoEffectiveDuration / 1e3)) : 0;
      emit({
        type: "auto-detected",
        element: autoElement,
        elementAmbiguous: autoElementAmbiguous,
        elementWidth: autoElementWidth,
        elementHeight: autoElementHeight,
        duration: autoDuration,
        durationStrategy: autoDurationStrategy,
        lcmExceeded: autoLcmExceeded,
        lcmMs: autoLcmMs,
        fps: autoEffectiveFps ?? 12,
        frames: autoFrames
      });
      if (ANIMATED_FORMATS2.has(options.format) && autoDuration === null && !options.duration) {
        autoSwitchedToStatic = true;
      }
    }
    if (options.autoSize && !options.selector) {
      emit({ type: "step-start", step: "auto-size" });
      const { scrollWidth, scrollHeight } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight
      }));
      const autoWidth = options.viewport.width === 1280 ? scrollWidth : options.viewport.width;
      await page.setViewportSize({ width: autoWidth, height: scrollHeight });
      emit({ type: "step-done", step: "auto-size" });
    }
    if (options.timeout) {
      page.setDefaultTimeout(options.timeout);
    }
    const resolvedSelector = autoEffectiveSelector;
    let elementHandle;
    if (resolvedSelector) {
      emit({ type: "step-start", step: "selector" });
      const matches = await page.$$(resolvedSelector);
      if (matches.length === 0) {
        return err(makeError("SELECTOR_NOT_FOUND", `Selector '${resolvedSelector}' matched no elements in the page`));
      }
      if (matches.length > 1) {
        process.stderr.write(`Warning: selector '${resolvedSelector}' matched ${matches.length} elements; using the first match
`);
      }
      const box = await matches[0].boundingBox();
      if (box === null) {
        return err(makeError("SELECTOR_NOT_FOUND", `Selector '${resolvedSelector}' matched no elements in the page`));
      }
      elementHandle = matches[0];
      emit({ type: "step-done", step: "selector" });
    }
    const isAnimatedFormat = ANIMATED_FORMATS2.has(options.format);
    const isStaticFormat = STATIC_FORMATS.has(options.format);
    if (autoSwitchedToStatic || isStaticFormat) {
      try {
        const staticOptions = autoSwitchedToStatic ? { ...options, format: "png" } : options;
        const buffer = await renderStatic(page, staticOptions, elementHandle, emit);
        return ok(buffer);
      } catch (cause) {
        return err(makeError("CAPTURE_FAILED", "Static render failed", cause));
      }
    }
    if (isAnimatedFormat) {
      emit({ type: "step-start", step: "detect-animation" });
      const cycleMs = autoEffectiveDuration ?? await detectAnimationCycle(page);
      if (cycleMs === null) {
        const pageContent = await page.content();
        const hints = scanForCycleLengths(pageContent);
        return err(makeError("NO_ANIMATION_DETECTED", `No animation detected on page; cannot produce animated ${options.format}`, void 0, hints));
      }
      emit({ type: "step-done", step: "detect-animation" });
      const effectiveOptions = autoEffectiveFps !== void 0 && autoEffectiveFps !== options.fps ? { ...options, fps: autoEffectiveFps } : options;
      try {
        const buffer = await renderAnimated(page, effectiveOptions, cycleMs, elementHandle, emit);
        return ok(buffer);
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        const code = msg.toLowerCase().includes("ffmpeg") ? "ENCODE_FAILED" : "CAPTURE_FAILED";
        return err(makeError(code, `Animated render failed: ${msg}`, cause));
      }
    }
    return err(makeError("CAPTURE_FAILED", `Unknown output format: ${options.format}`));
  } finally {
    await browser.close();
  }
}

// ../../packages/profiles/dist/index.js
var LINKEDIN_BACKGROUND = Object.freeze({
  id: "linkedin-background",
  width: 1584,
  height: 396,
  format: "jpeg",
  quality: 85,
  label: "LinkedIn Background",
  group: "linkedin"
});
var LINKEDIN_POST = Object.freeze({
  id: "linkedin-post",
  width: 1200,
  height: 1200,
  format: "jpeg",
  quality: 90,
  label: "LinkedIn Post",
  group: "linkedin"
});
var LINKEDIN_ARTICLE_COVER = Object.freeze({
  id: "linkedin-article-cover",
  width: 2e3,
  height: 600,
  format: "jpeg",
  quality: 85,
  label: "LinkedIn Article Cover",
  group: "linkedin"
});
var LINKEDIN_PROFILE = Object.freeze({
  id: "linkedin-profile",
  width: 800,
  height: 800,
  format: "jpeg",
  quality: 90,
  label: "LinkedIn Profile",
  group: "linkedin"
});
var LINKEDIN_SINGLE_IMAGE_AD = Object.freeze({
  id: "linkedin-single-image-ad",
  width: 1200,
  height: 627,
  format: "jpeg",
  quality: 85,
  label: "LinkedIn Single Image Ad",
  group: "linkedin"
});
var LINKEDIN_CAREER_BACKGROUND = Object.freeze({
  id: "linkedin-career-background",
  width: 1128,
  height: 191,
  format: "jpeg",
  quality: 85,
  label: "LinkedIn Career Background",
  group: "linkedin"
});
var TWITTER_POST = Object.freeze({
  id: "twitter-post",
  width: 1600,
  height: 900,
  format: "png",
  quality: 90,
  label: "Twitter/X Post",
  group: "twitter"
});
var TWITTER_HEADER = Object.freeze({
  id: "twitter-header",
  width: 1500,
  height: 500,
  format: "jpeg",
  quality: 85,
  label: "Twitter/X Header",
  group: "twitter"
});
var TWITTER_AD = Object.freeze({
  id: "twitter-ad",
  width: 1600,
  height: 900,
  format: "jpeg",
  quality: 85,
  label: "Twitter/X Ad",
  group: "twitter"
});
var TWITTER_VIDEO = Object.freeze({
  id: "twitter-video",
  width: 1600,
  height: 900,
  format: "mp4",
  quality: 85,
  label: "Twitter/X Video",
  group: "twitter"
});
var TWITTER_AD_LANDSCAPE = Object.freeze({
  id: "twitter-ad-landscape",
  width: 800,
  height: 450,
  format: "mp4",
  quality: 85,
  label: "Twitter/X Ad Landscape",
  group: "twitter"
});
var INSTAGRAM_POST_3_4 = Object.freeze({
  id: "instagram-post-3-4",
  width: 1080,
  height: 1440,
  format: "jpeg",
  quality: 90,
  label: "Instagram Post (3:4)",
  group: "instagram"
});
var INSTAGRAM_POST_4_5 = Object.freeze({
  id: "instagram-post-4-5",
  width: 1080,
  height: 1350,
  format: "jpeg",
  quality: 90,
  label: "Instagram Post (4:5)",
  group: "instagram"
});
var INSTAGRAM_POST_SQUARE = Object.freeze({
  id: "instagram-post-square",
  width: 1080,
  height: 1080,
  format: "jpeg",
  quality: 90,
  label: "Instagram Post (Square)",
  group: "instagram"
});
var INSTAGRAM_STORY = Object.freeze({
  id: "instagram-story",
  width: 1080,
  height: 1920,
  format: "jpeg",
  quality: 90,
  label: "Instagram Story",
  group: "instagram"
});
var INSTAGRAM_REEL = Object.freeze({
  id: "instagram-reel",
  width: 1080,
  height: 1920,
  format: "mp4",
  quality: 85,
  label: "Instagram Reel",
  group: "instagram"
});
var INSTAGRAM_PROFILE = Object.freeze({
  id: "instagram-profile",
  width: 320,
  height: 320,
  format: "jpeg",
  quality: 90,
  label: "Instagram Profile",
  group: "instagram"
});
var INSTAGRAM_STORY_VIDEO = Object.freeze({
  id: "instagram-story-video",
  width: 1080,
  height: 1920,
  format: "mp4",
  quality: 85,
  label: "Instagram Story Video",
  group: "instagram"
});
var SQUARE = Object.freeze({
  id: "square",
  width: 1080,
  height: 1080,
  format: "png",
  quality: 100,
  label: "Square",
  group: "generic"
});
var PROFILES = {
  "linkedin-background": LINKEDIN_BACKGROUND,
  "linkedin-post": LINKEDIN_POST,
  "linkedin-article-cover": LINKEDIN_ARTICLE_COVER,
  "linkedin-profile": LINKEDIN_PROFILE,
  "linkedin-single-image-ad": LINKEDIN_SINGLE_IMAGE_AD,
  "linkedin-career-background": LINKEDIN_CAREER_BACKGROUND,
  "twitter-post": TWITTER_POST,
  "twitter-header": TWITTER_HEADER,
  "twitter-ad": TWITTER_AD,
  "twitter-video": TWITTER_VIDEO,
  "twitter-ad-landscape": TWITTER_AD_LANDSCAPE,
  "instagram-post-3-4": INSTAGRAM_POST_3_4,
  "instagram-post-4-5": INSTAGRAM_POST_4_5,
  "instagram-post-square": INSTAGRAM_POST_SQUARE,
  "instagram-story": INSTAGRAM_STORY,
  "instagram-reel": INSTAGRAM_REEL,
  "instagram-profile": INSTAGRAM_PROFILE,
  "instagram-story-video": INSTAGRAM_STORY_VIDEO,
  square: SQUARE
};
var ALIAS_MAP = {
  instagram: "instagram-post-square",
  twitter: "twitter-post",
  linkedin: "linkedin-post"
};
function resolveProfile(slug) {
  const canonical = ALIAS_MAP[slug] ?? slug;
  return PROFILES[canonical];
}
function getProfile(id) {
  return resolveProfile(id);
}

// src/index.ts
var import_sdk = __toESM(require("@anthropic-ai/sdk"));
var import_zod2 = require("zod");
var import_node_crypto2 = require("node:crypto");
var import_promises3 = require("node:fs/promises");
var import_node_path2 = require("node:path");
var OUTPUT_DIR = (0, import_node_path2.resolve)(process.cwd(), "output");
var systemPrompt;
function resolveRenderOptions(params) {
  let width = 1280;
  let height = 720;
  let format = "png";
  let quality = 90;
  if (params.profile) {
    const profile = getProfile(params.profile);
    width = profile.width;
    height = profile.height;
    format = profile.format;
    quality = profile.quality;
  }
  if (params.format) format = params.format;
  if (params.width) width = params.width;
  if (params.height) height = params.height;
  if (params.quality !== void 0) quality = params.quality;
  return {
    input: { type: "html", html: params.html },
    format,
    viewport: { width, height, deviceScaleFactor: 1 },
    quality
  };
}
async function writeOutput(buffer, format, customPath) {
  const outputPath = customPath ? (0, import_node_path2.resolve)(customPath) : (0, import_node_path2.join)(OUTPUT_DIR, `${(0, import_node_crypto2.randomUUID)()}.${format}`);
  await (0, import_promises3.writeFile)(outputPath, buffer);
  return outputPath;
}
var server = new import_mcp.McpServer(
  { name: "pixdom", version: "0.1.0" },
  { capabilities: { tools: {} } }
);
server.registerTool(
  "convert_html_to_asset",
  {
    description: "Convert an HTML string to an image or animated asset (PNG, JPEG, WebP, GIF, MP4, WebM).",
    inputSchema: {
      html: import_zod2.z.string().describe("HTML markup to render"),
      profile: import_zod2.z.enum(["instagram", "twitter", "linkedin", "square"]).optional().describe("Platform preset to apply"),
      format: import_zod2.z.enum(["png", "jpeg", "webp", "gif", "mp4", "webm"]).optional().default("png").describe("Output format"),
      width: import_zod2.z.number().int().min(1).max(7680).optional().default(1280).describe("Viewport width (1\u20137680)"),
      height: import_zod2.z.number().int().min(1).max(4320).optional().default(720).describe("Viewport height (1\u20134320)"),
      quality: import_zod2.z.number().min(0).max(100).optional().default(90).describe("Output quality (0-100)"),
      output: import_zod2.z.string().optional().describe("Custom output file path")
    }
  },
  async (params) => {
    try {
      const options = resolveRenderOptions(params);
      const result = await render(options);
      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: result.error.message }]
        };
      }
      const outputPath = await writeOutput(result.value, options.format, params.output);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              path: outputPath,
              format: options.format,
              width: options.viewport.width,
              height: options.viewport.height
            })
          }
        ]
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        isError: true,
        content: [{ type: "text", text: message }]
      };
    }
  }
);
server.registerTool(
  "generate_and_convert",
  {
    description: "Generate HTML from a plain-text prompt using Claude, then render it to an image or animated asset.",
    inputSchema: {
      prompt: import_zod2.z.string().describe("Plain-text description of the desired visual"),
      profile: import_zod2.z.enum(["instagram", "twitter", "linkedin", "square"]).optional().describe("Platform preset to apply"),
      format: import_zod2.z.enum(["png", "jpeg", "webp", "gif", "mp4", "webm"]).optional().default("png").describe("Output format"),
      width: import_zod2.z.number().int().min(1).max(7680).optional().default(1280).describe("Viewport width (1\u20137680)"),
      height: import_zod2.z.number().int().min(1).max(4320).optional().default(720).describe("Viewport height (1\u20134320)"),
      quality: import_zod2.z.number().min(0).max(100).optional().default(90).describe("Output quality (0-100)"),
      model: import_zod2.z.string().optional().default("claude-haiku-4-5-20251001").describe("Claude model to use for HTML generation"),
      output: import_zod2.z.string().optional().describe("Custom output file path")
    }
  },
  async (params) => {
    try {
      const anthropic = new import_sdk.default();
      const message = await anthropic.messages.create({
        model: params.model ?? "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: params.prompt }]
      });
      const html = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
      const options = resolveRenderOptions({ ...params, html });
      const result = await render(options);
      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: result.error.message }]
        };
      }
      const outputPath = await writeOutput(result.value, options.format, params.output);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              path: outputPath,
              format: options.format,
              width: options.viewport.width,
              height: options.viewport.height
            })
          }
        ]
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        isError: true,
        content: [{ type: "text", text: message }]
      };
    }
  }
);
async function main() {
  await (0, import_promises3.mkdir)(OUTPUT_DIR, { recursive: true });
  try {
    systemPrompt = await (0, import_promises3.readFile)(".claude/context/claude-integration.md", "utf-8");
  } catch {
    systemPrompt = "You are an HTML generation assistant. Output only valid, complete HTML markup with no explanation or markdown fencing. The HTML should be self-contained with inline styles.";
  }
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
}
main().catch((err2) => {
  process.stderr.write(String(err2) + "\n");
  process.exit(1);
});
