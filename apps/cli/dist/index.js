#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
import dns2 from "node:dns/promises";
import fs5 from "node:fs/promises";
import fsSync2 from "node:fs";
import path4 from "node:path";
import { program } from "commander";

// ../../packages/core/dist/index.js
import fs3 from "node:fs";
import { chromium } from "playwright";

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
    return new Promise((resolve) => {
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
        resolve({ mutationCount, durationMs: performance.now() - startTime });
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

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path: path5, errorMaps, issueData } = params;
  const fullPath = [...path5, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path5, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path5;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err2) {
        if (err2?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// ../../packages/types/dist/index.js
var RenderInputSchema = external_exports.discriminatedUnion("type", [
  external_exports.object({ type: external_exports.literal("html"), html: external_exports.string() }),
  external_exports.object({ type: external_exports.literal("file"), path: external_exports.string() }),
  external_exports.object({ type: external_exports.literal("url"), url: external_exports.string() }),
  external_exports.object({ type: external_exports.literal("image"), path: external_exports.string() })
]);
var OutputFormatSchema = external_exports.enum(["png", "jpeg", "webp", "gif", "mp4", "webm"]);
var ViewportOptionsSchema = external_exports.object({
  width: external_exports.number().default(1280),
  height: external_exports.number().default(720),
  deviceScaleFactor: external_exports.number().default(1)
});
var RenderOptionsSchema = external_exports.object({
  input: RenderInputSchema,
  format: OutputFormatSchema,
  viewport: ViewportOptionsSchema,
  quality: external_exports.number().int().min(0).max(100).optional(),
  timeout: external_exports.number().optional(),
  fps: external_exports.number().optional(),
  duration: external_exports.number().optional(),
  autoSize: external_exports.boolean().optional(),
  selector: external_exports.string().optional(),
  allowLocal: external_exports.boolean().optional(),
  auto: external_exports.boolean().optional()
});
var ProfileIdSchema = external_exports.enum([
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
var ProfileSchema = external_exports.object({
  id: ProfileIdSchema,
  width: external_exports.number(),
  height: external_exports.number(),
  format: OutputFormatSchema,
  quality: external_exports.number(),
  label: external_exports.string(),
  group: external_exports.string(),
  fps: external_exports.number().optional()
});
var AnimationResultSchema = external_exports.object({
  cycleMs: external_exports.number().nullable()
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
import sharp from "sharp";
async function renderStatic(page, options, element, onProgress) {
  const emit = onProgress ?? (() => {
  });
  emit({ type: "step-start", step: "capture" });
  const screenshot = element ? await element.screenshot({ type: "png" }) : await page.screenshot({ type: "png", fullPage: false });
  emit({ type: "step-done", step: "capture" });
  const image = sharp(screenshot);
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
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// ../../packages/core/dist/ffmpeg-spawn.js
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
function getFfmpegPath() {
  if (!ffmpegPath) {
    throw new Error("FFmpeg binary not available on this platform (ffmpeg-static returned null)");
  }
  return ffmpegPath;
}
function spawnFfmpeg(args, totalFrames, onProgress) {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegPath();
    const proc = spawn(bin, args, { shell: false });
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
        resolve();
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
    const framePath = path.join(outDir, `frame-${String(i).padStart(6, "0")}.png`);
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
  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
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
  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
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
  const buf = await fs.readFile(outPath);
  await fs.unlink(outPath);
  return buf;
}
async function renderAnimated(page, options, cycleMs, element, onProgress) {
  const emit = onProgress ?? (() => {
  });
  const tmpDir = path.join(os.tmpdir(), `pixdom-${randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.chmod(tmpDir, 448);
  const cleanup = () => {
    try {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
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
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// ../../packages/core/dist/image-renderer.js
import fs2 from "node:fs";
import sharp2 from "sharp";
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
  if (!fs2.existsSync(options.input.path)) {
    throw makeError("IMAGE_NOT_FOUND", `Image "${options.input.path}" does not exist`);
  }
  const { width, height } = options.viewport;
  const DEFAULT_WIDTH = 1280;
  const DEFAULT_HEIGHT = 720;
  emit({ type: "step-start", step: "read-image" });
  let image = sharp2(options.input.path, { limitInputPixels: MAX_INPUT_PIXELS });
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
import dns from "node:dns/promises";
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
    const result = await dns.lookup(hostname, { all: true });
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
  if (options.input.type === "file" && !fs3.existsSync(options.input.path)) {
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
    browser = await chromium.launch({
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

// src/commands/completion.ts
import { createRequire } from "node:module";
var _require = createRequire(import.meta.url);
var omelette = _require("omelette");
var PROFILE_SLUGS = [
  // LinkedIn
  "linkedin-background",
  "linkedin-post",
  "linkedin-article-cover",
  "linkedin-profile",
  "linkedin-single-image-ad",
  "linkedin-career-background",
  // Twitter/X
  "twitter-post",
  "twitter-header",
  "twitter-ad",
  "twitter-video",
  "twitter-ad-landscape",
  // Instagram
  "instagram-post-3-4",
  "instagram-post-4-5",
  "instagram-post-square",
  "instagram-story",
  "instagram-reel",
  "instagram-profile",
  "instagram-story-video",
  // Generic
  "square",
  // Legacy aliases — resolved server-side to canonical slugs
  "linkedin",
  "twitter",
  "instagram"
];
var FORMAT_VALUES = ["png", "jpeg", "webp", "gif", "mp4", "webm"];
var CONVERT_FLAGS = [
  "--html",
  "--file",
  "--url",
  "--image",
  "--profile",
  "--output",
  "--format",
  "--width",
  "--height",
  "--quality",
  "--fps",
  "--duration",
  "--auto-size"
];
function generateFishCompletionScript() {
  const lines = [
    "# pixdom fish completion",
    "# Generated by: pixdom completion",
    "",
    "# Disable file completion by default (re-enabled per-flag where needed)",
    "complete -c pixdom -f",
    "",
    "# Subcommands",
    'complete -c pixdom -n "__fish_use_subcommand" -a convert -d "Render HTML, file, or URL to image/video"',
    'complete -c pixdom -n "__fish_use_subcommand" -a completion -d "Print shell completion script"',
    "",
    "# Global flags",
    'complete -c pixdom -l no-color -d "Disable ANSI color in error output"',
    'complete -c pixdom -l no-progress -d "Disable progress spinner output"',
    "",
    "# convert flags \u2014 free-text / numeric (no value completion)",
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l html -r -d "Inline HTML string"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l url -r -d "Remote URL to render"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l output -r -d "Output file path"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l width -r -d "Viewport width in pixels"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l height -r -d "Viewport height in pixels"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l quality -r -d "Compression quality 0-100"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l fps -r -d "Frame rate for animated output"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l duration -r -d "Animation cycle length in ms"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l auto-size -d "Auto-detect output dimensions"',
    "",
    "# convert --file and --image: path completion via -F (force-files)",
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l file -r -F -d "Local HTML file path"',
    'complete -c pixdom -n "__fish_seen_subcommand_from convert" -l image -r -F -d "Local image file to convert"',
    "",
    "# convert --format values",
    ...FORMAT_VALUES.map(
      (v) => `complete -c pixdom -n "__fish_seen_subcommand_from convert" -l format -r -a "${v}" -d "Output format"`
    ),
    "",
    "# convert --profile values",
    ...PROFILE_SLUGS.map(
      (v) => `complete -c pixdom -n "__fish_seen_subcommand_from convert" -l profile -r -a "${v}"`
    ),
    "",
    "# completion subcommand flags",
    'complete -c pixdom -n "__fish_seen_subcommand_from completion" -l install -d "Print installation instructions"'
  ];
  return lines.join("\n") + "\n";
}
function generateCompletionScript(program2) {
  const fn = `_${program2}_completion`;
  return [
    `### ${program2} completion - begin ###`,
    `if type compdef &>/dev/null; then`,
    `  ${fn}() {`,
    `    local _${program2}_comps`,
    `    _${program2}_comps=\`${program2} --compzsh --compgen "\${CURRENT}" "\${words[CURRENT-1]}" "\${BUFFER}"\``,
    `    if [[ -n "$_${program2}_comps" ]]; then`,
    `      compadd -- $_${program2}_comps`,
    `    else`,
    `      _path_files`,
    `    fi`,
    `  }`,
    `  compdef ${fn} ${program2}`,
    `elif type complete &>/dev/null; then`,
    `  ${fn}() {`,
    `    local cur prev nb_colon _${program2}_comps`,
    `    _get_comp_words_by_ref -n : cur prev`,
    `    nb_colon=$(grep -o ":" <<< "$COMP_LINE" | wc -l)`,
    `    _${program2}_comps=$(${program2} --compbash --compgen "$((COMP_CWORD - (nb_colon * 2)))" "$prev" "\${COMP_LINE}")`,
    `    COMPREPLY=( $(compgen -W "$_${program2}_comps" -- "$cur") )`,
    `    __ltrim_colon_completions "$cur"`,
    `  }`,
    `  complete -F ${fn} -o default ${program2}`,
    `fi`,
    `### ${program2} completion - end ###`
  ].join("\n");
}
function registerCompletion(program2) {
  if (process.argv.includes("--completion")) {
    process.stdout.write(generateCompletionScript("pixdom") + "\n");
    process.exit(0);
  }
  if (process.argv.includes("--completion-fish")) {
    process.stdout.write(generateFishCompletionScript());
    process.exit(0);
  }
  const completion = omelette("pixdom <command>");
  completion.tree({
    convert: Object.fromEntries([
      ...CONVERT_FLAGS.filter((f) => f !== "--profile" && f !== "--format").map((f) => [f, []]),
      ["--profile", PROFILE_SLUGS],
      ["--format", FORMAT_VALUES]
    ]),
    completion: ["--install"]
  });
  const OMELETTE_FLAGS = ["--compbash", "--compzsh", "--compgen", "--compfish"];
  const isCompletionRequest = OMELETTE_FLAGS.some((f) => process.argv.includes(f));
  try {
    completion.init();
  } catch {
  }
  if (isCompletionRequest) {
    process.stdout.write("\n");
    process.exit(0);
  }
  program2.command("completion").description("Print shell completion script to stdout").option("--install", "Print installation instructions for your shell").action((opts) => {
    if (opts.install) {
      process.stdout.write(
        [
          "pixdom shell completion setup",
          "",
          "Bash \u2014 add to ~/.bashrc:",
          "  echo '. <(pixdom --completion)' >> ~/.bashrc",
          "  source ~/.bashrc",
          "",
          "Zsh \u2014 add to ~/.zshrc:",
          "  echo '. <(pixdom --completion)' >> ~/.zshrc",
          "  source ~/.zshrc",
          "",
          "Fish \u2014 write to completions directory:",
          "  pixdom --completion-fish > ~/.config/fish/completions/pixdom.fish",
          "",
          "Note: type 'pixdom' in full to trigger completion. Partial name expansion (pix<TAB> \u2192 pixdom) is not supported.",
          ""
        ].join("\n")
      );
      process.exit(0);
    } else {
      process.stdout.write(generateCompletionScript("pixdom") + "\n");
      process.exit(0);
    }
  });
}

// src/error-formatter.ts
import path2 from "node:path";
function ansi(code, text, enabled) {
  return enabled ? `\x1B[${code}m${text}\x1B[0m` : text;
}
function red(text, enabled) {
  return ansi("31", text, enabled);
}
function bold(text, enabled) {
  return ansi("1", text, enabled);
}
function dim(text, enabled) {
  return ansi("2", text, enabled);
}
var TEMPLATES = {
  NO_ANIMATION_DETECTED: {
    title: "No animation detected",
    whatHappened: () => "No CSS animation was found on the page. Canvas and JS-driven animations require a manual duration.",
    howToFix: "Add --duration <ms> to specify the cycle length, and --fps <number> for frame rate.",
    docs: "--duration, --fps",
    correction: { addFlag: "--duration 1000" }
  },
  SELECTOR_NOT_FOUND: {
    title: "Selector matched no elements",
    whatHappened: (e) => e.message,
    howToFix: "Check the selector is correct using browser DevTools, or omit --selector to capture the full page.",
    docs: "--selector",
    correction: null
  },
  INVALID_FILE_TYPE: {
    title: "Unsupported file type",
    whatHappened: (e) => e.message,
    howToFix: "--file accepts .html and .htm only. --image accepts .png, .jpg, .jpeg, .webp, .gif only. Use --url to render remote pages of any type.",
    docs: "--file, --image",
    correction: null
  },
  FILE_NOT_FOUND: {
    title: "File not found",
    whatHappened: (e) => e.message,
    howToFix: "Use an absolute path. Relative paths are resolved from the current working directory.",
    docs: "--file",
    correction: null
  },
  IMAGE_NOT_FOUND: {
    title: "Image not found",
    whatHappened: (e) => e.message,
    howToFix: "Use an absolute path. Relative paths are resolved from the current working directory.",
    docs: "--image",
    correction: null
  },
  BROWSER_LAUNCH_FAILED: {
    title: "Browser failed to launch",
    whatHappened: () => "Playwright could not start Chromium. The browser binary may be missing or incompatible.",
    howToFix: "Run `npx playwright install chromium` to reinstall the browser binary.",
    docs: "--help",
    correction: null
  },
  PAGE_LOAD_FAILED: {
    title: "Page failed to load",
    whatHappened: () => "The browser could not load the page. The file path may be wrong, the URL unreachable, or the HTML invalid.",
    howToFix: "Check the file path is absolute, the URL is reachable, or validate your HTML.",
    docs: "--file, --url, --html",
    correction: null
  },
  CAPTURE_FAILED: {
    title: "Screenshot capture failed",
    whatHappened: (e) => e.message,
    howToFix: "Check that the page renders correctly in a browser. If using --selector, verify the element exists and is visible.",
    docs: "--selector, --width, --height",
    correction: null,
    showDetail: true
  },
  ENCODE_FAILED: {
    title: "FFmpeg encoding failed",
    whatHappened: () => "FFmpeg failed during video or GIF encoding.",
    howToFix: "Check that --fps and --duration values are valid. Include the Detail below in bug reports.",
    docs: "--fps, --duration",
    correction: null,
    showDetail: true
  },
  SHARP_ERROR: {
    title: "Image processing failed",
    whatHappened: () => "Sharp could not process the input image.",
    howToFix: "Check the input image is a valid PNG, JPEG, or WebP. Include the Detail below in bug reports.",
    docs: "--image",
    correction: null,
    showDetail: true
  },
  INVALID_URL_PROTOCOL: {
    title: "URL protocol not allowed",
    whatHappened: (e) => e.message,
    howToFix: "Only http:// and https:// URLs are supported. file://, ftp://, data://, and other protocols are not permitted.",
    docs: "--url",
    correction: null
  },
  INVALID_URL_HOST: {
    title: "URL host not allowed",
    whatHappened: (e) => e.message,
    howToFix: "Loopback (127.x.x.x), private (RFC1918), and cloud metadata (169.254.x.x) addresses are blocked. Use --allow-local to permit localhost rendering for development.",
    docs: "--url, --allow-local",
    correction: null
  },
  INVALID_OUTPUT_PATH: {
    title: "Invalid output path",
    whatHappened: (e) => e.message,
    howToFix: "Ensure the output directory exists and is writable. Paths under /dev/, /proc/, and /sys/ are not allowed.",
    docs: "--output",
    correction: null
  },
  INVALID_FPS: {
    title: "Invalid frame rate",
    whatHappened: (e) => e.message,
    howToFix: "--fps must be an integer between 1 and 60.",
    docs: "--fps",
    correction: null
  },
  INVALID_DURATION: {
    title: "Invalid duration",
    whatHappened: (e) => e.message,
    howToFix: "--duration must be an integer between 100 and 300000 (milliseconds).",
    docs: "--duration",
    correction: null
  },
  RESOURCE_LIMIT_EXCEEDED: {
    title: "Resource limit exceeded",
    whatHappened: (e) => e.message,
    howToFix: "Reduce --fps (max 60), --duration (max 300000ms), --width (max 7680), or --height (max 4320). For animation, lower fps or duration to keep total frames under 3600.",
    docs: "--fps, --duration, --width, --height",
    correction: null
  }
};
var SECRET_KEY_PATTERN = /key|token|secret|password|api_?key/i;
function scrubSecrets(ctx) {
  const result = {};
  for (const [k, v] of Object.entries(ctx)) {
    result[k] = SECRET_KEY_PATTERN.test(k) && typeof v === "string" ? "[REDACTED]" : v;
  }
  return result;
}
function relativizePaths(msg) {
  return msg.replace(/\/[^\s"']+/g, (abs) => {
    try {
      const rel = path2.relative(process.cwd(), abs);
      return rel.startsWith("..") ? abs : rel;
    } catch {
      return abs;
    }
  });
}
var BASE64_TOKEN_PATTERN = /[A-Za-z0-9+/=]{20,}/g;
function sanitizeFfmpegStderr(stderr) {
  return stderr.replace(BASE64_TOKEN_PATTERN, "[REDACTED]");
}
function buildExample(argv, addFlag) {
  return `pixdom ${[...argv, addFlag].join(" ")}`;
}
function formatError(error, opts) {
  const { argv, color } = opts;
  if (error.cause && typeof error.cause === "object" && !Array.isArray(error.cause)) {
    error = {
      ...error,
      cause: scrubSecrets(error.cause)
    };
  }
  const safeMessage = relativizePaths(error.message);
  const displayError = { ...error, message: safeMessage };
  const tpl = TEMPLATES[error.code];
  const lines = [];
  if (!tpl) {
    lines.push(red(`\u2717 Unexpected error (${displayError.code})`, color));
    lines.push(`  ${bold("What happened:", color)} ${displayError.message}`);
    lines.push(`  ${bold("How to fix:", color)}    This is an unexpected error. Please file a bug report at:`);
    lines.push(`  ${dim("                   https://github.com/anthropics/claude-code/issues", color)}`);
    lines.push(`  ${bold("Error code:", color)}     ${displayError.code}`);
    return lines.join("\n");
  }
  lines.push(red(`\u2717 ${tpl.title}`, color));
  lines.push(`  ${bold("What happened:", color)} ${tpl.whatHappened(displayError)}`);
  lines.push(`  ${bold("How to fix:", color)}    ${tpl.howToFix}`);
  if (displayError.hints && displayError.hints.length > 0) {
    for (const hint2 of displayError.hints) {
      lines.push(`  ${bold("Hint:", color)}          ${hint2}`);
    }
  }
  if (tpl.correction !== null && tpl.correction !== void 0) {
    const example = buildExample(argv, tpl.correction.addFlag);
    lines.push(`  ${bold("Example:", color)}       ${dim(example, color)}`);
  }
  lines.push(`  ${bold("Docs:", color)}          ${tpl.docs}`);
  if (tpl.showDetail && displayError.message) {
    const detail = error.code === "ENCODE_FAILED" ? sanitizeFfmpegStderr(displayError.message) : displayError.message;
    lines.push(`  ${bold("Detail:", color)}        ${dim(detail, color)}`);
  }
  return lines.join("\n");
}

// src/validate-input.ts
import fs4 from "node:fs";
import path3 from "node:path";
var HTML_EXTS = /* @__PURE__ */ new Set([".html", ".htm"]);
var IMAGE_EXTS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
function sniffFile(filePath, flag) {
  let buf;
  try {
    const fd = fs4.openSync(filePath, "r");
    buf = Buffer.alloc(16);
    fs4.readSync(fd, buf, 0, 16, 0);
    fs4.closeSync(fd);
  } catch {
    return false;
  }
  if (flag === "--file") {
    const str = buf.toString("utf8", 0, 12).trimStart();
    return str.startsWith("<!") || str.toLowerCase().startsWith("<h") || str.startsWith("<");
  }
  if (flag === "--image") {
    if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) return true;
    if (buf[0] === 255 && buf[1] === 216) return true;
    if (buf.toString("ascii", 0, 4) === "GIF8") return true;
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;
  }
  return false;
}
function validateFileInput(flag, resolvedPath) {
  const name = path3.basename(resolvedPath);
  if (!fs4.existsSync(resolvedPath)) {
    if (flag === "--image") {
      return { code: "IMAGE_NOT_FOUND", message: `Image "${name}" does not exist at ${resolvedPath}` };
    }
    return { code: "FILE_NOT_FOUND", message: `File "${name}" does not exist at ${resolvedPath}` };
  }
  const ext = path3.extname(resolvedPath).toLowerCase();
  const allowedExts = flag === "--file" ? HTML_EXTS : IMAGE_EXTS;
  if (ext === "") {
    if (!sniffFile(resolvedPath, flag)) {
      return {
        code: "INVALID_FILE_TYPE",
        message: `"${name}" is not a supported input type for ${flag}. Could not determine file type from contents.`
      };
    }
    return null;
  }
  if (!allowedExts.has(ext)) {
    if (flag === "--file") {
      return {
        code: "INVALID_FILE_TYPE",
        message: `"${name}" is not a supported input file type. ${flag} only accepts .html or .htm files. To convert an image use --image instead.`
      };
    }
    return {
      code: "INVALID_FILE_TYPE",
      message: `"${name}" is not a supported image type. --image accepts .png, .jpg, .jpeg, .webp, .gif only.`
    };
  }
  return null;
}

// src/progress-reporter.ts
import ora from "ora";
var STEP_LABELS = {
  "load-page": "Loading page",
  "auto-size": "Detecting content",
  "selector": "Detecting content",
  "detect-animation": "Detecting animation",
  "capture": "Capturing screenshot",
  "read-image": "Reading image",
  "write-output": "Writing output",
  "analyse-page": "Analysing page",
  "detect-animations": "Detecting animations"
};
function formatDuration(ms) {
  if (ms < 1e3) return `${ms}ms`;
  if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
  const minutes = Math.floor(ms / 6e4);
  const seconds = Math.floor(ms % 6e4 / 1e3);
  return `${minutes}m ${seconds}s`;
}
function createProgressReporter(context, noProgress) {
  const startMs = Date.now();
  if (noProgress) {
    return {
      onProgress: () => {
      },
      finish: () => {
      }
    };
  }
  let spinner = null;
  let currentEncodeFormat = "";
  let lastFrameCount = null;
  const resizeLabel = context.profileName ? `Resizing for ${context.profileName}` : "Resizing image";
  const onProgress = (event) => {
    switch (event.type) {
      case "step-start": {
        if (event.step === "capture-frames") {
          spinner = ora({ text: "Capturing frames", stream: process.stderr }).start();
        } else if (event.step === "resize") {
          spinner = ora({ text: resizeLabel, stream: process.stderr }).start();
        } else {
          const label = STEP_LABELS[event.step];
          if (label) {
            spinner = ora({ text: label, stream: process.stderr }).start();
          }
        }
        break;
      }
      case "step-done": {
        if (spinner) {
          if (event.step === "capture-frames") {
            const label = lastFrameCount ? `Capturing frames (${lastFrameCount.current}/${lastFrameCount.total})` : "Capturing frames";
            spinner.succeed(label);
          } else if (event.step === "resize") {
            spinner.succeed(resizeLabel);
          } else {
            const label = STEP_LABELS[event.step];
            if (label) spinner.succeed(label);
          }
          spinner = null;
        }
        break;
      }
      case "frame-progress": {
        lastFrameCount = { current: event.current, total: event.total };
        if (spinner) {
          spinner.text = `Capturing frames (${event.current}/${event.total})`;
        }
        break;
      }
      case "encode-format": {
        currentEncodeFormat = event.format;
        spinner = ora({ text: `Encoding ${event.format}`, stream: process.stderr }).start();
        break;
      }
      case "encode-progress": {
        if (spinner) {
          spinner.text = `Encoding ${currentEncodeFormat} (${event.pct}%)`;
        }
        break;
      }
      case "encode-done": {
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
    if (spinner) {
      spinner.stop();
      spinner = null;
    }
    ora({ stream: process.stderr }).succeed(`Done in ${duration} \u2192 ${outputPath}`);
  };
  return { onProgress, finish };
}

// src/index.ts
function parseCidr42(cidr) {
  const [ip, bits] = cidr.split("/");
  const mask = bits ? ~((1 << 32 - Number(bits)) - 1) >>> 0 : 4294967295;
  const parts = ip.split(".").map(Number);
  const base = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
  return { base: base >>> 0, mask: mask >>> 0 };
}
function ipv4ToInt2(ip) {
  const parts = ip.split(".").map(Number);
  return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
}
var BLOCKED_CIDRS2 = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16"
].map(parseCidr42);
function isBlockedIpv42(ip) {
  const n = ipv4ToInt2(ip);
  return BLOCKED_CIDRS2.some((c) => (n & c.mask) === c.base);
}
function isBlockedIpv62(ip) {
  const lower = ip.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}
async function validateUrl(rawUrl, allowLocal, fmt) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    process.stderr.write(`Error: Invalid URL: ${rawUrl}
`);
    process.exit(1);
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const renderErr = {
      code: "INVALID_URL_PROTOCOL",
      message: `URL protocol "${parsed.protocol}" is not allowed. Only http:// and https:// are supported.`
    };
    process.stderr.write(formatError(renderErr, fmt) + "\n");
    process.exit(1);
  }
  if (!allowLocal) {
    const hostname = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
    try {
      const addrs = await dns2.lookup(hostname, { all: true });
      for (const addr of addrs) {
        const blocked = addr.family === 4 ? isBlockedIpv42(addr.address) : isBlockedIpv62(addr.address);
        if (blocked) {
          const renderErr = {
            code: "INVALID_URL_HOST",
            message: `URL host "${hostname}" resolves to a blocked address (${addr.address}). Loopback, private, and cloud-metadata addresses are not permitted.`
          };
          process.stderr.write(formatError(renderErr, fmt) + "\n");
          process.exit(1);
        }
      }
    } catch {
    }
  } else {
    process.stderr.write("Warning: --allow-local is active \u2014 localhost and private network URLs are permitted.\n");
  }
}
var SHELL_METACHARACTERS = /[;&|$`()<>\n]/;
function validateOutputPath(outputPath, fmt) {
  if (SHELL_METACHARACTERS.test(outputPath)) {
    const renderErr = {
      code: "INVALID_OUTPUT_PATH",
      message: `Output path contains shell metacharacters: ${outputPath}`
    };
    process.stderr.write(formatError(renderErr, fmt) + "\n");
    process.exit(1);
  }
  const abs = path4.resolve(outputPath);
  if (abs.startsWith("/dev/") || abs.startsWith("/proc/") || abs.startsWith("/sys/")) {
    const renderErr = {
      code: "INVALID_OUTPUT_PATH",
      message: `Output path "${abs}" is not allowed (device/proc/sys paths are prohibited).`
    };
    process.stderr.write(formatError(renderErr, fmt) + "\n");
    process.exit(1);
  }
  const dir = path4.dirname(abs);
  try {
    fsSync2.accessSync(dir, fsSync2.constants.F_OK);
  } catch {
    const renderErr = {
      code: "INVALID_OUTPUT_PATH",
      message: `Output directory does not exist: ${dir}`
    };
    process.stderr.write(formatError(renderErr, fmt) + "\n");
    process.exit(1);
  }
  try {
    fsSync2.accessSync(dir, fsSync2.constants.W_OK);
  } catch {
    const renderErr = {
      code: "INVALID_OUTPUT_PATH",
      message: `Output directory is not writable: ${dir}`
    };
    process.stderr.write(formatError(renderErr, fmt) + "\n");
    process.exit(1);
  }
  if (fsSync2.existsSync(abs)) {
    process.stderr.write(`Warning: output file already exists and will be overwritten: ${abs}
`);
  }
}
async function convertAction(opts, fmt) {
  const inputFlags = [opts.html, opts.file, opts.url, opts.image].filter((v) => v !== void 0);
  if (inputFlags.length === 0) {
    process.stderr.write("Error: Provide exactly one of --html, --file, --url, or --image\n");
    process.exit(1);
  }
  if (inputFlags.length > 1) {
    process.stderr.write("Error: Provide exactly one of --html, --file, --url, or --image (got multiple)\n");
    process.exit(1);
  }
  let fps;
  if (opts.fps !== void 0) {
    fps = parseInt(opts.fps, 10);
    if (!Number.isInteger(fps) || isNaN(fps) || fps < 1 || fps > 60) {
      const renderErr = {
        code: "INVALID_FPS",
        message: `--fps must be an integer between 1 and 60 (got: ${opts.fps})`
      };
      process.stderr.write(formatError(renderErr, fmt) + "\n");
      process.exit(1);
    }
  }
  let duration;
  if (opts.duration !== void 0) {
    duration = parseInt(opts.duration, 10);
    if (!Number.isInteger(duration) || isNaN(duration) || duration < 100 || duration > 3e5) {
      const renderErr = {
        code: "INVALID_DURATION",
        message: `--duration must be an integer between 100 and 300000 ms (got: ${opts.duration})`
      };
      process.stderr.write(formatError(renderErr, fmt) + "\n");
      process.exit(1);
    }
  }
  const width = parseInt(opts.width, 10);
  const height = parseInt(opts.height, 10);
  if (isNaN(width) || width < 1 || width > 7680) {
    const renderErr = {
      code: "RESOURCE_LIMIT_EXCEEDED",
      message: `--width must be between 1 and 7680 (got: ${opts.width})`
    };
    process.stderr.write(formatError(renderErr, fmt) + "\n");
    process.exit(1);
  }
  if (isNaN(height) || height < 1 || height > 4320) {
    const renderErr = {
      code: "RESOURCE_LIMIT_EXCEEDED",
      message: `--height must be between 1 and 4320 (got: ${opts.height})`
    };
    process.stderr.write(formatError(renderErr, fmt) + "\n");
    process.exit(1);
  }
  if (fps !== void 0 && duration !== void 0) {
    const frameCount = Math.ceil(duration / 1e3) * fps;
    if (frameCount > 3600) {
      const renderErr = {
        code: "RESOURCE_LIMIT_EXCEEDED",
        message: `Derived frame count (${frameCount}) exceeds the limit of 3600. Lower --fps (current: ${fps}) or --duration (current: ${duration}ms).`
      };
      process.stderr.write(formatError(renderErr, fmt) + "\n");
      process.exit(1);
    }
  }
  let autoEnabled = opts.auto === true;
  if (autoEnabled && opts.image !== void 0) {
    process.stderr.write(
      "Warning: --auto is not supported for --image inputs and will be ignored.\n"
    );
    autoEnabled = false;
  }
  let input;
  if (opts.html !== void 0) {
    input = { type: "html", html: opts.html };
  } else if (opts.file !== void 0) {
    let resolved;
    try {
      resolved = fsSync2.realpathSync(path4.resolve(opts.file));
    } catch {
      resolved = path4.resolve(opts.file);
    }
    input = { type: "file", path: resolved };
  } else if (opts.image !== void 0) {
    let resolved;
    try {
      resolved = fsSync2.realpathSync(path4.resolve(opts.image));
    } catch {
      resolved = path4.resolve(opts.image);
    }
    input = { type: "image", path: resolved };
  } else {
    input = { type: "url", url: opts.url };
  }
  if (input.type === "url") {
    await validateUrl(input.url, opts.allowLocal === true, fmt);
  }
  if (input.type === "file") {
    const fileErr = validateFileInput("--file", input.path);
    if (fileErr) {
      process.stderr.write(formatError(fileErr, fmt) + "\n");
      process.exit(1);
    }
  }
  if (input.type === "image") {
    const fileErr = validateFileInput("--image", input.path);
    if (fileErr) {
      process.stderr.write(formatError(fileErr, fmt) + "\n");
      process.exit(1);
    }
  }
  let format = opts.format;
  let finalWidth = width;
  let finalHeight = height;
  let quality = parseInt(opts.quality, 10);
  if (opts.profile !== void 0) {
    const profileParse = ProfileIdSchema.safeParse(opts.profile);
    if (!profileParse.success) {
      process.stderr.write(
        `Error: Invalid profile "${opts.profile}". Valid canonical slugs: ${Object.keys(PROFILES).join(", ")}. Legacy aliases: instagram, twitter, linkedin
`
      );
      process.exit(1);
    }
    const profile = resolveProfile(profileParse.data);
    format = opts.format !== "png" ? opts.format : profile.format;
    finalWidth = opts.width !== "1280" ? width : profile.width;
    finalHeight = opts.height !== "720" ? height : profile.height;
    quality = opts.quality !== "90" ? parseInt(opts.quality, 10) : profile.quality;
  }
  let selector;
  if (opts.selector !== void 0) {
    if (input.type === "image") {
      process.stderr.write(`Warning: --selector is ignored for --image inputs
`);
    } else {
      selector = opts.selector;
      if (process.argv.includes("--width")) {
        process.stderr.write(`Warning: --width is ignored because --selector takes precedence; output dimensions are determined by the element bounding box
`);
        finalWidth = 1280;
      }
      if (process.argv.includes("--height")) {
        process.stderr.write(`Warning: --height is ignored because --selector takes precedence; output dimensions are determined by the element bounding box
`);
        finalHeight = 720;
      }
    }
  }
  let outputPath = opts.output ? path4.resolve(opts.output) : path4.resolve(`pixdom-output.${format}`);
  if (opts.output) {
    validateOutputPath(opts.output, fmt);
  }
  const isAnimated = ["gif", "mp4", "webm"].includes(format);
  const isImagePassthrough = input.type === "image";
  const hasResize = opts.profile !== void 0 || isImagePassthrough && (process.argv.includes("--width") || process.argv.includes("--height"));
  const reporter = createProgressReporter(
    {
      hasSelector: !!selector,
      hasAutoSize: !!(opts.autoSize && !selector),
      isAnimated,
      isImagePassthrough,
      profileName: opts.profile,
      format: format.toUpperCase(),
      hasResize
    },
    fmt.noProgress
  );
  const ANIMATED_FORMATS_CLI = /* @__PURE__ */ new Set(["gif", "mp4", "webm"]);
  const baseOnProgress = reporter.onProgress;
  const onProgress = (event) => {
    if (event.type === "auto-detected") {
      if (event.duration === null && ANIMATED_FORMATS_CLI.has(format)) {
        if (!opts.output) {
          outputPath = path4.resolve("pixdom-output.png");
        } else if (/\.(gif|mp4|webm)$/i.test(outputPath)) {
          outputPath = outputPath.replace(/\.(gif|mp4|webm)$/i, ".png");
        }
      }
      if (!fmt.noProgress) {
        if (event.lcmExceeded && event.lcmMs !== void 0) {
          process.stderr.write(
            `Warning: Animation LCM (${Math.round(event.lcmMs)}ms) exceeds 10s cap \u2014 using longest single cycle (${event.duration}ms)
`
          );
        }
        if (event.duration === null && ANIMATED_FORMATS_CLI.has(format)) {
          process.stderr.write(
            "Warning: No animation detected \u2014 producing static PNG. Use --duration to force animated output.\n"
          );
        }
        if (event.elementAmbiguous) {
          process.stderr.write(
            "Auto-selector: ambiguous \u2014 capturing full page. Use --selector to specify.\n"
          );
        }
        const elementLabel = event.element ? `${event.element} (${event.elementWidth}\xD7${event.elementHeight})` : event.elementAmbiguous ? "full page (ambiguous)" : "full page";
        const durationLabel = event.duration !== null ? (() => {
          const stratDesc = event.durationStrategy === "css-lcm" ? "CSS animation LCM" : event.durationStrategy === "css-transition" ? "CSS transition" : event.durationStrategy === "source-pattern" ? "source pattern" : "detected";
          return `${event.duration}ms (${stratDesc})`;
        })() : "none detected \u2014 producing static PNG";
        const timingDesc = event.fps >= 24 ? "ease-in-out detected" : "linear timing";
        process.stderr.write(
          `Auto mode:
  Element:  ${elementLabel}
  Duration: ${durationLabel}
  FPS:      ${event.fps} (${timingDesc})
  Frames:   ${event.frames}
`
        );
      }
      return;
    }
    baseOnProgress(event);
  };
  const result = await render(
    {
      input,
      format,
      viewport: { width: finalWidth, height: finalHeight, deviceScaleFactor: 1 },
      quality,
      fps,
      duration,
      autoSize: selector ? false : opts.autoSize ?? false,
      selector,
      allowLocal: opts.allowLocal === true,
      auto: autoEnabled
    },
    { onProgress }
  );
  if (!result.ok) {
    process.stderr.write(formatError(result.error, fmt) + "\n");
    process.exit(1);
  }
  await fs5.writeFile(outputPath, result.value);
  reporter.finish(outputPath);
  process.stdout.write(`${outputPath}
`);
}
var originalArgv = process.argv.slice(2);
program.name("pixdom").description("Convert HTML to platform-ready images and animated assets").version("0.1.0").option("--no-color", "Disable ANSI color in error output").option("--no-progress", "Disable progress spinner output");
program.command("convert").description("Render HTML, a file, or a URL to an image or video").option("--html <string>", "Inline HTML string to render").option("--file <path>", "Local HTML file path to render").option("--url <url>", "Remote URL to render").option(
  "--profile <slug>",
  `Platform profile slug. Canonical: ${Object.keys(PROFILES).join(", ")}. Legacy aliases: instagram \u2192 instagram-post-square, twitter \u2192 twitter-post, linkedin \u2192 linkedin-post`
).option("--output <path>", "Output file path (default: ./pixdom-output.<format>)").option("--format <fmt>", "Output format: png | jpeg | webp | gif | mp4 | webm", "png").option("--width <n>", "Viewport width in pixels", "1280").option("--height <n>", "Viewport height in pixels", "720").option("--quality <n>", "Compression quality 0\u2013100", "90").option("--image <path>", "Local image file to convert (bypasses browser)").option("--fps <n>", "Frame rate for animated output (gif/mp4/webm)").option("--duration <ms>", "Animation cycle length in ms (overrides auto-detection)").option("--auto-size", "Auto-detect output dimensions from page content").option("--selector <css>", 'CSS selector to capture a specific DOM element (e.g. "#canvas", ".card")').option("--allow-local", "Allow rendering of localhost and private network URLs (development only)").option(
  "--auto",
  "Automatically detect the primary content element, animation duration, and optimal FPS"
).action(async (opts) => {
  const globalOpts = program.opts();
  const color = globalOpts.color !== false && process.env["NO_COLOR"] === void 0 && !!process.stderr.isTTY;
  const noProgress = globalOpts.progress === false || !process.stderr.isTTY;
  try {
    await convertAction(opts, { argv: originalArgv, color, noProgress });
  } catch (err2) {
    const msg = err2 instanceof Error ? err2.message : String(err2);
    process.stderr.write(`Error: ${msg}
`);
    process.exit(1);
  }
});
registerCompletion(program);
program.parse();
