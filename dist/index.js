#!/usr/bin/env node

// src/cli.ts
import { copyFileSync, existsSync, mkdirSync, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "fs";
import { homedir as homedir3 } from "os";
import { dirname, join as join3 } from "path";
import { fileURLToPath } from "url";

// src/config.ts
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var DEFAULT_CONFIG = {
  layout: "compact",
  theme: "compact",
  showModel: true,
  showBranch: true,
  showContext: true,
  showFiveHour: true,
  showWeekly: true,
  showCost: true,
  showCountdown: true,
  countdownAfterPercent: 50,
  showWorkingDirectory: false,
  showLines: false,
  showSessionTime: false,
  showBurnRate: false,
  showRepo: false,
  showTokens: false,
  showVersion: false,
  showOutputStyle: false,
  showEffort: false,
  showGitDirty: false,
  hideUnavailable: true,
  notify: false,
  notifyBell: true,
  notifyThresholds: [90],
  refreshSeconds: 30,
  progressWidth: 12,
  useColors: true,
  useIcons: true,
  flashOnCritical: true,
  separator: " | ",
  missingText: "--",
  colorThresholds: { yellow: 60, orange: 80, red: 90 },
  warnThresholds: { warn: 80, danger: 90, flash: 95 }
};
var LAYOUTS = ["compact", "minimal"];
var THEMES = ["minimal", "compact", "powerline", "nerd-font", "plain-text"];
var BOOLEAN_KEYS = [
  "showModel",
  "showBranch",
  "showContext",
  "showFiveHour",
  "showWeekly",
  "showCost",
  "showCountdown",
  "showWorkingDirectory",
  "showLines",
  "showSessionTime",
  "showBurnRate",
  "showRepo",
  "showTokens",
  "showVersion",
  "showOutputStyle",
  "showEffort",
  "showGitDirty",
  "hideUnavailable",
  "notify",
  "notifyBell",
  "useColors",
  "useIcons",
  "flashOnCritical"
];
function configPath(explicit) {
  return process.env.FLUX_CODE_CONFIG || explicit || join(homedir(), ".claude", "flux-code.json");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isLayout(value) {
  return typeof value === "string" && LAYOUTS.includes(value);
}
function isTheme(value) {
  return typeof value === "string" && THEMES.includes(value);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function mergeConfig(raw) {
  const cfg = structuredClone(DEFAULT_CONFIG);
  if (!isRecord(raw)) return cfg;
  for (const key of BOOLEAN_KEYS) {
    const value = raw[key];
    if (typeof value === "boolean") {
      cfg[key] = value;
    }
  }
  if (isFiniteNumber(raw.refreshSeconds)) {
    cfg.refreshSeconds = Math.max(1, Math.floor(raw.refreshSeconds));
  }
  if (isFiniteNumber(raw.progressWidth)) {
    cfg.progressWidth = Math.max(1, Math.min(60, Math.floor(raw.progressWidth)));
  }
  if (isFiniteNumber(raw.countdownAfterPercent)) {
    cfg.countdownAfterPercent = Math.max(0, Math.min(100, Math.floor(raw.countdownAfterPercent)));
  }
  if (typeof raw.separator === "string") cfg.separator = raw.separator;
  if (typeof raw.missingText === "string") cfg.missingText = raw.missingText;
  if (Array.isArray(raw.notifyThresholds)) {
    const cleaned = [
      ...new Set(
        raw.notifyThresholds.filter(isFiniteNumber).map((n) => Math.max(1, Math.min(100, Math.floor(n))))
      )
    ].sort((a, b) => a - b);
    cfg.notifyThresholds = cleaned;
  }
  const layout = isLayout(raw.layout) ? raw.layout : void 0;
  const theme = isTheme(raw.theme) ? raw.theme : void 0;
  if (layout) cfg.layout = layout;
  if (theme) cfg.theme = theme;
  else if (layout) cfg.theme = layout;
  if (isRecord(raw.colorThresholds)) {
    const ct = raw.colorThresholds;
    if (isFiniteNumber(ct.yellow)) cfg.colorThresholds.yellow = ct.yellow;
    if (isFiniteNumber(ct.orange)) cfg.colorThresholds.orange = ct.orange;
    if (isFiniteNumber(ct.red)) cfg.colorThresholds.red = ct.red;
  }
  if (isRecord(raw.warnThresholds)) {
    const wt = raw.warnThresholds;
    if (isFiniteNumber(wt.warn)) cfg.warnThresholds.warn = wt.warn;
    if (isFiniteNumber(wt.danger)) cfg.warnThresholds.danger = wt.danger;
    if (isFiniteNumber(wt.flash)) cfg.warnThresholds.flash = wt.flash;
  }
  return cfg;
}
function loadConfig(explicit) {
  const path = configPath(explicit);
  let raw = {};
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    raw = {};
  }
  return mergeConfig(raw);
}

// src/colors.ts
var ESC = `${String.fromCharCode(27)}[`;
var RESET = `${ESC}0m`;
function createAnsi(enabled) {
  const wrap = (text, sgr) => enabled ? `${ESC}${sgr.join(";")}m${text}${RESET}` : text;
  return {
    enabled,
    code: (text, ...sgr) => wrap(text, sgr),
    seq: (...sgr) => enabled ? `${ESC}${sgr.join(";")}m` : "",
    reset: () => enabled ? RESET : "",
    bold: (t) => wrap(t, [1]),
    dim: (t) => wrap(t, [2]),
    blink: (t) => wrap(t, [5]),
    red: (t) => wrap(t, [31]),
    green: (t) => wrap(t, [32]),
    yellow: (t) => wrap(t, [33]),
    orange: (t) => wrap(t, [38, 5, 208]),
    blue: (t) => wrap(t, [34]),
    cyan: (t) => wrap(t, [36]),
    magenta: (t) => wrap(t, [35]),
    gray: (t) => wrap(t, [90]),
    fg256: (t, n) => wrap(t, [38, 5, n]),
    bg256: (t, n) => wrap(t, [48, 5, n])
  };
}
function colorForPercent(ansi, pct, th) {
  if (pct === null) return (t) => ansi.gray(t);
  if (pct >= th.red) return (t) => ansi.red(t);
  if (pct >= th.orange) return (t) => ansi.orange(t);
  if (pct >= th.yellow) return (t) => ansi.yellow(t);
  return (t) => ansi.green(t);
}
function bg256ForPercent(pct, th) {
  if (pct === null) return 240;
  if (pct >= th.red) return 196;
  if (pct >= th.orange) return 208;
  if (pct >= th.yellow) return 220;
  return 34;
}

// src/countdown.ts
function formatCountdown(resetAtSec, nowMs) {
  if (resetAtSec === null || resetAtSec === void 0 || !Number.isFinite(resetAtSec)) {
    return "--";
  }
  const diffMs = resetAtSec * 1e3 - nowMs;
  if (diffMs <= 0) return "now";
  const totalMinutes = Math.floor(diffMs / 6e4);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor(totalMinutes % 1440 / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
function formatResetClock(resetAtSec) {
  if (resetAtSec === null || resetAtSec === void 0 || !Number.isFinite(resetAtSec)) {
    return "";
  }
  const date = new Date(resetAtSec * 1e3);
  const suffix = date.getHours() >= 12 ? "pm" : "am";
  const hour = date.getHours() % 12 || 12;
  return `${hour}:${String(date.getMinutes()).padStart(2, "0")}${suffix}`;
}
function formatDuration(ms) {
  if (ms === null || ms === void 0 || !Number.isFinite(ms) || ms < 0) return "--";
  const totalSeconds = Math.floor(ms / 1e3);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// src/icons.ts
var cp = (code) => String.fromCodePoint(code);
var EMOJI_ICONS = {
  model: "\u{1F916}",
  branch: "\u{1F33F}",
  dir: "\u{1F4C1}",
  context: "\u{1F9E0}",
  fiveHour: "\u26A1",
  weekly: "\u{1F4C5}",
  cost: "\u{1F4B0}",
  lines: "\u{1F4DD}",
  time: "\u23F1",
  burn: "\u{1F525}",
  repo: "\u{1F4E6}",
  tokens: "\u{1F522}",
  version: "\u{1F3F7}",
  style: "\u{1F3A8}",
  effort: "\u{1F9E9}",
  dirty: "\u25CF",
  warn: "\u26A0"
};
var NERD_ICONS = {
  model: cp(62171),
  // nf-fa-microchip
  branch: cp(59173),
  // nf-dev-git_branch
  dir: cp(61563),
  // nf-fa-folder
  context: cp(61573),
  // nf-fa-cogs
  fiveHour: cp(61671),
  // nf-fa-bolt
  weekly: cp(61555),
  // nf-fa-calendar
  cost: cp(61781),
  // nf-fa-dollar
  lines: cp(61504),
  // nf-fa-pencil
  time: cp(61463),
  // nf-fa-clock_o
  burn: cp(61549),
  // nf-fa-fire
  repo: cp(61907),
  // nf-fa-git_square
  tokens: cp(62098),
  // nf-fa-hashtag
  version: cp(61483),
  // nf-fa-tag
  style: cp(61948),
  // nf-fa-paint_brush
  effort: cp(61573),
  // nf-fa-cogs
  dirty: cp(61508),
  // nf-fa-pencil_square_o
  warn: cp(61553)
  // nf-fa-warning
};
var POWERLINE_SEPARATOR = cp(57520);
var POWERLINE_BRANCH = cp(57504);

// src/progress.ts
var EIGHTHS = [" ", "\u258F", "\u258E", "\u258D", "\u258C", "\u258B", "\u258A", "\u2589"];
var FULL_BLOCK = "\u2588";
var EMPTY_BLOCK = "\u2591";
function progressBar(percent, width, opts = {}) {
  const w = Math.max(1, Math.floor(width));
  const filledChar = opts.filled ?? FULL_BLOCK;
  const emptyChar = opts.empty ?? EMPTY_BLOCK;
  if (percent === null || !Number.isFinite(percent)) {
    return emptyChar.repeat(w);
  }
  const pct = Math.min(100, Math.max(0, percent));
  if (opts.partial && filledChar === FULL_BLOCK) {
    const totalEighths = Math.round(pct / 100 * w * 8);
    const full2 = Math.floor(totalEighths / 8);
    const remainder = totalEighths % 8;
    const partialChar = remainder > 0 ? EIGHTHS[remainder] : "";
    const used = full2 + (remainder > 0 ? 1 : 0);
    const empties = Math.max(0, w - used);
    return filledChar.repeat(full2) + partialChar + emptyChar.repeat(empties);
  }
  const full = Math.min(w, Math.round(pct / 100 * w));
  return filledChar.repeat(full) + emptyChar.repeat(w - full);
}

// src/utils.ts
import { execFileSync } from "child_process";
import { readFileSync as readFileSync2, statSync, writeFileSync } from "fs";
import { homedir as homedir2, tmpdir } from "os";
import { basename, join as join2 } from "path";
function readStdin() {
  try {
    return readFileSync2(0, "utf8");
  } catch {
    return "";
  }
}
function safeParseInput(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}
function basenameOf(p) {
  if (!p) return null;
  return basename(p) || p;
}
function homeShorten(p) {
  if (!p) return null;
  const home = homedir2();
  return home && p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}
function clampPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function formatCost(value) {
  if (value === null) return "--";
  return `$${value.toFixed(2)}`;
}
function formatLines(added, removed) {
  const a = added ?? 0;
  const r = removed ?? 0;
  if (added === null && removed === null) return null;
  return `+${a} \u2212${r}`;
}
function formatBurnRate(cost, durationMs) {
  if (cost === null || durationMs === null || durationMs < 3e4) return null;
  const perHour = cost / (durationMs / 36e5);
  return `$${perHour.toFixed(2)}/h`;
}
function formatTokens(value) {
  if (value === null || value < 0) return null;
  if (value < 1e3) return String(Math.round(value));
  if (value < 1e6) return `${(value / 1e3).toFixed(1)}k`;
  return `${(value / 1e6).toFixed(1)}M`;
}
var GIT_CACHE_TTL_MS = 3e3;
function sanitizeKey(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}
function getGitBranch(cwd, sessionId, worktreeBranch) {
  if (worktreeBranch) return worktreeBranch;
  const dir = cwd || process.cwd();
  const cacheFile = join2(tmpdir(), `flux-code-branch-${sanitizeKey(sessionId || "default")}`);
  try {
    const stats = statSync(cacheFile);
    if (Date.now() - stats.mtimeMs < GIT_CACHE_TTL_MS) {
      const cached = readFileSync2(cacheFile, "utf8");
      return cached === "" ? null : cached;
    }
  } catch {
  }
  let branch = null;
  try {
    const out = execFileSync("git", ["-C", dir, "branch", "--show-current"], {
      encoding: "utf8",
      timeout: 500,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    branch = out || null;
  } catch {
    branch = null;
  }
  try {
    writeFileSync(cacheFile, branch ?? "");
  } catch {
  }
  return branch;
}
function getGitDirtyCount(cwd, sessionId) {
  const dir = cwd || process.cwd();
  const cacheFile = join2(tmpdir(), `flux-code-dirty-${sanitizeKey(sessionId || "default")}`);
  try {
    const stats = statSync(cacheFile);
    if (Date.now() - stats.mtimeMs < GIT_CACHE_TTL_MS) {
      const cached = readFileSync2(cacheFile, "utf8");
      return cached === "" ? null : Number(cached);
    }
  } catch {
  }
  let count = null;
  try {
    const out = execFileSync("git", ["-C", dir, "status", "--porcelain"], {
      encoding: "utf8",
      timeout: 800,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const trimmed = out.replace(/\n+$/, "");
    count = trimmed === "" ? 0 : trimmed.split("\n").length;
  } catch {
    count = null;
  }
  try {
    writeFileSync(cacheFile, count === null ? "" : String(count));
  } catch {
  }
  return count;
}

// src/renderer.ts
function pctLabel(value, config) {
  return value === null ? config.missingText : `${Math.round(value)}%`;
}
function showPct(value, config) {
  return value !== null || !config.hideUnavailable;
}
function linesFragment(model, ansi) {
  if (model.linesAdded === null && model.linesRemoved === null) return null;
  const a = model.linesAdded ?? 0;
  const r = model.linesRemoved ?? 0;
  return `${ansi.green(`+${a}`)} ${ansi.red(`\u2212${r}`)}`;
}
function sessionTimeText(model) {
  if (model.durationMs === null) return null;
  return formatDuration(model.durationMs);
}
function extraSegments(model, config, ansi) {
  const out = [];
  if (config.showRepo && model.repo) {
    out.push({ icon: "repo", text: ansi.magenta(model.repo) });
  }
  if (config.showGitDirty && model.gitDirty !== null && model.gitDirty > 0) {
    out.push({ icon: "dirty", text: ansi.yellow(`\xB1${model.gitDirty}`) });
  }
  if (config.showTokens) {
    const tokens = formatTokens(model.contextTokens);
    if (tokens) out.push({ icon: "tokens", text: ansi.gray(`${tokens} tok`) });
  }
  if (config.showVersion && model.version) {
    out.push({ icon: "version", text: ansi.gray(`v${model.version}`) });
  }
  if (config.showOutputStyle && model.outputStyle) {
    out.push({ icon: "style", text: ansi.gray(model.outputStyle) });
  }
  if (config.showEffort && model.effort) {
    out.push({ icon: "effort", text: ansi.gray(model.effort) });
  }
  return out;
}
function fiveHourResetInfo(model, config, nowMs) {
  if (!config.showCountdown) return null;
  if (model.fiveHour === null || model.fiveHour <= config.countdownAfterPercent) return null;
  const clock = formatResetClock(model.fiveHourResetAt);
  const countdown = formatCountdown(model.fiveHourResetAt, nowMs);
  if (!clock || countdown === "--") return null;
  if (countdown === "now") return "resets now";
  return `resets ${clock} (${countdown} left)`;
}
function warnBadge(pct, config, ansi, glyph) {
  if (pct === null || !config.useIcons) return "";
  const { warn, danger, flash } = config.warnThresholds;
  if (pct >= flash) {
    const red = ansi.red(glyph);
    return ` ${config.flashOnCritical ? ansi.blink(red) : red}`;
  }
  if (pct >= danger) return ` ${ansi.red(glyph)}`;
  if (pct >= warn) return ` ${ansi.yellow(glyph)}`;
  return "";
}
function fallback(model, config, ansi) {
  return model.modelName ? ansi.bold(model.modelName) : config.missingText;
}
function renderCompact(model, config, ctx) {
  const { ansi, nowMs } = ctx;
  const paint = (pct) => colorForPercent(ansi, pct, config.colorThresholds);
  const segments = [];
  if (config.showModel && model.modelName) segments.push(ansi.bold(model.modelName));
  if (config.showBranch && model.branch) segments.push(ansi.blue(model.branch));
  if (config.showWorkingDirectory && model.cwdName) segments.push(ansi.dim(model.cwdName));
  if (config.showContext) {
    segments.push(
      `Ctx ${paint(model.context)(pctLabel(model.context, config))}${warnBadge(model.context, config, ansi, EMOJI_ICONS.warn)}`
    );
  }
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    let seg = `5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}${warnBadge(model.fiveHour, config, ansi, EMOJI_ICONS.warn)}`;
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg += ` ${ansi.cyan(reset)}`;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config)) {
    segments.push(
      `Week ${paint(model.weekly)(pctLabel(model.weekly, config))}${warnBadge(model.weekly, config, ansi, EMOJI_ICONS.warn)}`
    );
  }
  if (config.showCost && model.cost !== null) segments.push(ansi.yellow(formatCost(model.cost)));
  if (config.showLines) {
    const frag = linesFragment(model, ansi);
    if (frag) segments.push(frag);
  }
  if (config.showSessionTime) {
    const t = sessionTimeText(model);
    if (t) segments.push(ansi.gray(t));
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(ansi.yellow(b));
  }
  for (const e of extraSegments(model, config, ansi)) segments.push(e.text);
  return segments.length > 0 ? segments.join(config.separator) : fallback(model, config, ansi);
}
function renderMinimal(model, config, ctx) {
  const { ansi, nowMs } = ctx;
  const paint = (pct) => colorForPercent(ansi, pct, config.colorThresholds);
  const segments = [];
  if (config.showModel && model.modelName) segments.push(ansi.bold(model.modelName));
  if (config.showBranch && model.branch) segments.push(ansi.blue(model.branch));
  if (config.showContext)
    segments.push(`Ctx ${paint(model.context)(pctLabel(model.context, config))}`);
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    let seg = `5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`;
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg += ` ${ansi.cyan(reset)}`;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config))
    segments.push(`Week ${paint(model.weekly)(pctLabel(model.weekly, config))}`);
  if (config.showCost && model.cost !== null) segments.push(ansi.yellow(formatCost(model.cost)));
  if (config.showLines) {
    const frag = linesFragment(model, ansi);
    if (frag) segments.push(frag);
  }
  if (config.showSessionTime) {
    const t = sessionTimeText(model);
    if (t) segments.push(ansi.gray(t));
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(ansi.yellow(b));
  }
  for (const e of extraSegments(model, config, ansi)) segments.push(e.text);
  return segments.length > 0 ? segments.join(" \u2502 ") : fallback(model, config, ansi);
}
function renderPowerline(model, config, ctx) {
  const { ansi, nowMs } = ctx;
  const segments = [];
  const white = 15;
  if (config.showModel && model.modelName) {
    segments.push({ text: ` ${model.modelName} `, fg: white, bg: 24 });
  }
  if (config.showBranch && model.branch) {
    const label = config.useIcons ? `${POWERLINE_BRANCH} ${model.branch}` : model.branch;
    segments.push({ text: ` ${label} `, fg: white, bg: 240 });
  }
  const pctSeg = (label, pct) => ({
    text: ` ${label} ${pctLabel(pct, config)} `,
    fg: 0,
    bg: bg256ForPercent(pct, config.colorThresholds)
  });
  if (config.showContext) segments.push(pctSeg("CTX", model.context));
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    const seg = pctSeg("5H", model.fiveHour);
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg.text = `${seg.text.trimEnd()} \xB7 ${reset} `;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config)) segments.push(pctSeg("7D", model.weekly));
  if (config.showCost && model.cost !== null) {
    segments.push({ text: ` ${formatCost(model.cost)} `, fg: white, bg: 22 });
  }
  if (config.showLines) {
    const frag = formatLines(model.linesAdded, model.linesRemoved);
    if (frag) segments.push({ text: ` ${frag} `, fg: white, bg: 238 });
  }
  if (config.showSessionTime && model.durationMs !== null) {
    segments.push({ text: ` ${formatDuration(model.durationMs)} `, fg: white, bg: 236 });
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push({ text: ` ${b} `, fg: white, bg: 22 });
  }
  if (config.showRepo && model.repo) {
    segments.push({ text: ` ${model.repo} `, fg: white, bg: 54 });
  }
  if (config.showGitDirty && model.gitDirty !== null && model.gitDirty > 0) {
    segments.push({ text: ` \xB1${model.gitDirty} `, fg: 0, bg: 130 });
  }
  if (config.showTokens) {
    const tokens = formatTokens(model.contextTokens);
    if (tokens) segments.push({ text: ` ${tokens} tok `, fg: white, bg: 240 });
  }
  if (config.showVersion && model.version) {
    segments.push({ text: ` v${model.version} `, fg: white, bg: 238 });
  }
  if (config.showOutputStyle && model.outputStyle) {
    segments.push({ text: ` ${model.outputStyle} `, fg: white, bg: 238 });
  }
  if (config.showEffort && model.effort) {
    segments.push({ text: ` ${model.effort} `, fg: white, bg: 238 });
  }
  if (segments.length === 0) return fallback(model, config, ansi);
  if (!ansi.enabled) return segments.map((s) => s.text).join("");
  let out = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    out += ansi.seq(38, 5, seg.fg, 48, 5, seg.bg) + seg.text;
    const next = segments[i + 1];
    out += ansi.seq(0);
    if (next) {
      out += ansi.seq(38, 5, seg.bg, 48, 5, next.bg) + POWERLINE_SEPARATOR;
    } else {
      out += ansi.seq(38, 5, seg.bg) + POWERLINE_SEPARATOR + ansi.reset();
    }
  }
  return out;
}
function renderNerdFont(model, config, ctx) {
  const { ansi, nowMs } = ctx;
  const I = NERD_ICONS;
  const paint = (pct) => colorForPercent(ansi, pct, config.colorThresholds);
  const useIcons = config.useIcons;
  const segments = [];
  if (config.showModel && model.modelName) {
    segments.push(`${useIcons ? `${I.model} ` : ""}${ansi.bold(model.modelName)}`);
  }
  if (config.showBranch && model.branch) {
    segments.push(`${useIcons ? `${I.branch} ` : ""}${ansi.blue(model.branch)}`);
  }
  if (config.showContext) {
    segments.push(
      `${useIcons ? `${I.context} ` : "ctx "}${paint(model.context)(pctLabel(model.context, config))}`
    );
  }
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    let seg = `${useIcons ? `${I.fiveHour} ` : "5h "}${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`;
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg += ` ${ansi.cyan(reset)}`;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config)) {
    segments.push(
      `${useIcons ? `${I.weekly} ` : "7d "}${paint(model.weekly)(pctLabel(model.weekly, config))}`
    );
  }
  if (config.showCost && model.cost !== null) {
    segments.push(`${useIcons ? `${I.cost} ` : ""}${ansi.yellow(formatCost(model.cost))}`);
  }
  if (config.showLines) {
    const frag = linesFragment(model, ansi);
    if (frag) segments.push(`${useIcons ? `${I.lines} ` : ""}${frag}`);
  }
  if (config.showSessionTime) {
    const t = sessionTimeText(model);
    if (t) segments.push(`${useIcons ? `${I.time} ` : ""}${ansi.gray(t)}`);
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(`${useIcons ? `${I.burn} ` : ""}${ansi.yellow(b)}`);
  }
  for (const e of extraSegments(model, config, ansi)) {
    segments.push(`${useIcons ? `${I[e.icon]} ` : ""}${e.text}`);
  }
  return segments.length > 0 ? segments.join("  ") : fallback(model, config, ansi);
}
function renderPlainText(model, config, ctx) {
  const segments = [];
  const barOpts = { filled: "#", empty: "-", partial: false };
  if (config.showModel && model.modelName) segments.push(model.modelName);
  if (config.showBranch && model.branch) segments.push(model.branch);
  if (config.showWorkingDirectory && model.cwdName) segments.push(model.cwdName);
  if (config.showContext) {
    segments.push(
      `Ctx ${pctLabel(model.context, config)} [${progressBar(model.context, config.progressWidth, barOpts)}]`
    );
  }
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    const reset = fiveHourResetInfo(model, config, ctx.nowMs);
    segments.push(`5h ${pctLabel(model.fiveHour, config)}${reset ? ` ${reset}` : ""}`);
  }
  if (config.showWeekly && showPct(model.weekly, config))
    segments.push(`Week ${pctLabel(model.weekly, config)}`);
  if (config.showCost && model.cost !== null) segments.push(formatCost(model.cost));
  if (config.showLines && (model.linesAdded !== null || model.linesRemoved !== null)) {
    segments.push(`+${model.linesAdded ?? 0} -${model.linesRemoved ?? 0}`);
  }
  if (config.showSessionTime && model.durationMs !== null) {
    segments.push(formatDuration(model.durationMs));
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(b);
  }
  if (config.showRepo && model.repo) segments.push(model.repo);
  if (config.showGitDirty && model.gitDirty !== null && model.gitDirty > 0) {
    segments.push(`*${model.gitDirty}`);
  }
  if (config.showTokens) {
    const tokens = formatTokens(model.contextTokens);
    if (tokens) segments.push(`${tokens} tok`);
  }
  if (config.showVersion && model.version) segments.push(`v${model.version}`);
  if (config.showOutputStyle && model.outputStyle) segments.push(model.outputStyle);
  if (config.showEffort && model.effort) segments.push(model.effort);
  return segments.length > 0 ? segments.join(" | ") : model.modelName ?? config.missingText;
}
function render(model, config, ctx) {
  const ansi = config.theme === "plain-text" ? createAnsi(false) : ctx.ansi;
  const themedCtx = { ...ctx, ansi };
  switch (config.theme) {
    case "minimal":
      return renderMinimal(model, config, themedCtx);
    case "powerline":
      return renderPowerline(model, config, themedCtx);
    case "nerd-font":
      return renderNerdFont(model, config, themedCtx);
    case "plain-text":
      return renderPlainText(model, config, themedCtx);
    case "compact":
    default:
      return renderCompact(model, config, themedCtx);
  }
}

// src/statusline.ts
function repoLabel(repo) {
  if (!repo) return null;
  if (repo.owner && repo.name) return `${repo.owner}/${repo.name}`;
  return repo.name ?? null;
}
function contextTokenCount(usage) {
  if (!usage) return null;
  const parts = [
    usage.input_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens
  ].filter((n) => typeof n === "number" && Number.isFinite(n));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0);
}
function buildModel(input, config, _nowMs) {
  const contextWindow = input.context_window;
  const rateLimits = input.rate_limits;
  const cwdPath = input.workspace?.current_dir ?? input.cwd ?? null;
  const branch = config.showBranch ? getGitBranch(cwdPath, input.session_id, input.worktree?.branch) : null;
  const gitDirty = config.showGitDirty ? getGitDirtyCount(cwdPath, input.session_id) : null;
  return {
    modelName: input.model?.display_name ?? null,
    branch,
    cwdName: basenameOf(cwdPath),
    cwdPath: homeShorten(cwdPath),
    context: clampPercent(contextWindow?.used_percentage ?? null),
    fiveHour: clampPercent(rateLimits?.five_hour?.used_percentage ?? null),
    weekly: clampPercent(rateLimits?.seven_day?.used_percentage ?? null),
    fiveHourResetAt: numberOrNull(rateLimits?.five_hour?.resets_at),
    weeklyResetAt: numberOrNull(rateLimits?.seven_day?.resets_at),
    cost: numberOrNull(input.cost?.total_cost_usd),
    linesAdded: numberOrNull(input.cost?.total_lines_added),
    linesRemoved: numberOrNull(input.cost?.total_lines_removed),
    durationMs: numberOrNull(input.cost?.total_duration_ms),
    version: input.version ?? null,
    sessionName: input.session_name ?? null,
    contextWindowSize: numberOrNull(contextWindow?.context_window_size),
    repo: repoLabel(input.workspace?.repo),
    contextTokens: contextTokenCount(contextWindow?.current_usage),
    outputStyle: input.output_style?.name ?? null,
    effort: input.effort?.level ?? null,
    gitDirty
  };
}
function colorsEnabled(config) {
  if (process.env.NO_COLOR) return false;
  return config.useColors;
}
function produceStatusLine(input, config, nowMs = Date.now()) {
  const model = buildModel(input, config, nowMs);
  const ansi = createAnsi(colorsEnabled(config));
  return render(model, config, { nowMs, ansi });
}

// src/cli.ts
var SELF_PATH = fileURLToPath(import.meta.url);
function version() {
  try {
    const pkg = JSON.parse(readFileSync3(new URL("../package.json", import.meta.url), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
function readJson(path) {
  try {
    const parsed = JSON.parse(readFileSync3(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function statusLineCommand() {
  if (process.platform === "win32") {
    return `node "${SELF_PATH.replace(/\\/g, "/")}"`;
  }
  return `"${SELF_PATH}"`;
}
function settingsPath(scope) {
  return scope === "project" ? join3(process.cwd(), ".claude", "settings.json") : join3(homedir3(), ".claude", "settings.json");
}
function runInstall(args) {
  const scope = args.includes("--project") ? "project" : "global";
  const config = loadConfig();
  const settingsFile = settingsPath(scope);
  const settingsDir = dirname(settingsFile);
  mkdirSync(settingsDir, { recursive: true });
  const settings = readJson(settingsFile);
  if (existsSync(settingsFile)) {
    copyFileSync(settingsFile, `${settingsFile}.bak`);
  }
  settings.statusLine = {
    type: "command",
    command: statusLineCommand(),
    refreshInterval: config.refreshSeconds
  };
  writeFileSync2(settingsFile, `${JSON.stringify(settings, null, 2)}
`);
  const cfgPath = configPath();
  if (!existsSync(cfgPath)) {
    mkdirSync(dirname(cfgPath), { recursive: true });
    writeFileSync2(cfgPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}
`);
  }
  process.stdout.write(
    [
      "Flux Code installed.",
      "",
      `  settings : ${settingsFile}`,
      `  config   : ${cfgPath}`,
      `  refresh  : every ${config.refreshSeconds}s (statusLine.refreshInterval)`,
      "",
      "statusLine block written:",
      JSON.stringify(settings.statusLine, null, 2).split("\n").map((l) => `  ${l}`).join("\n"),
      "",
      "Restart Claude Code (or send one message) to see the status line.",
      existsSync(`${settingsFile}.bak`) ? `A backup was saved to ${settingsFile}.bak` : ""
    ].filter(Boolean).join("\n") + "\n"
  );
  return 0;
}
function runUninstall(args) {
  const scope = args.includes("--project") ? "project" : "global";
  const settingsFile = settingsPath(scope);
  if (!existsSync(settingsFile)) {
    process.stdout.write(`No settings file at ${settingsFile}; nothing to remove.
`);
    return 0;
  }
  const settings = readJson(settingsFile);
  const statusLine = settings.statusLine;
  const isOurs = typeof statusLine?.command === "string" && (statusLine.command.includes("flux-code") || statusLine.command.includes(SELF_PATH));
  if (!isOurs) {
    process.stdout.write("The configured statusLine is not Flux Code; leaving it untouched.\n");
    return 0;
  }
  copyFileSync(settingsFile, `${settingsFile}.bak`);
  delete settings.statusLine;
  writeFileSync2(settingsFile, `${JSON.stringify(settings, null, 2)}
`);
  process.stdout.write(
    `Removed statusLine from ${settingsFile} (backup at ${settingsFile}.bak).
`
  );
  return 0;
}
function mockInput(kind) {
  const now = Math.floor(Date.now() / 1e3);
  if (kind === "sparse") {
    return {
      model: { id: "claude-opus-4-8", display_name: "Opus 4" },
      workspace: { current_dir: join3(homedir3(), "code", "flux") },
      context_window: { used_percentage: 12, context_window_size: 2e5 }
      // No rate_limits (e.g. API-key user or before first response) and no cost.
    };
  }
  return {
    model: { id: "claude-opus-4-8", display_name: "Opus 4" },
    workspace: { current_dir: join3(homedir3(), "code", "flux") },
    context_window: { used_percentage: 82, context_window_size: 2e5 },
    cost: { total_cost_usd: 0.1234, total_duration_ms: 133e3 },
    rate_limits: {
      five_hour: { used_percentage: 61, resets_at: now + 2 * 3600 + 13 * 60 },
      seven_day: { used_percentage: 19, resets_at: now + 5 * 86400 }
    }
  };
}
var PREVIEW_THEMES = ["compact", "minimal", "powerline", "nerd-font", "plain-text"];
function runPreview(args) {
  const requested = args.find((a) => !a.startsWith("-"));
  const themes = requested ? [requested] : PREVIEW_THEMES;
  const base = loadConfig();
  const branchName = "feature/request-flow";
  for (const theme of themes) {
    if (!PREVIEW_THEMES.includes(theme)) {
      process.stderr.write(`Unknown theme "${theme}". Options: ${PREVIEW_THEMES.join(", ")}
`);
      return 1;
    }
    const config = { ...base, theme, showBranch: true };
    process.stdout.write(`
=== ${theme} ===
`);
    const input = mockInput("rich");
    input.worktree = { branch: branchName };
    process.stdout.write(produceStatusLine(input, config) + "\n");
  }
  process.stdout.write("\n");
  return 0;
}
function runDoctor() {
  const config = loadConfig();
  const globalSettings = settingsPath("global");
  const settings = readJson(globalSettings);
  const statusLine = settings.statusLine;
  const lines = [
    `Flux Code v${version()}`,
    "",
    `Config file      : ${configPath()}`,
    `Settings file    : ${globalSettings}`,
    `statusLine set   : ${statusLine ? "yes" : "no"}`,
    `statusLine cmd   : ${statusLine?.command ?? "(none)"}`,
    `Resolved theme   : ${config.theme}`,
    `Progress width   : ${config.progressWidth}`,
    `Colors           : ${config.useColors ? "on" : "off"}`,
    `Notify           : ${config.notify ? `on at ${config.notifyThresholds.join(", ")}%` : "off"}`,
    `Node             : ${process.version}`,
    "",
    "Sample render (rich payload):",
    produceStatusLine(mockInput("rich"), config).split("\n").map((l) => `  ${l}`).join("\n"),
    "",
    "Sample render (sparse payload, no rate_limits/cost):",
    produceStatusLine(mockInput("sparse"), config).split("\n").map((l) => `  ${l}`).join("\n")
  ];
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}
function runHelp() {
  process.stdout.write(
    `flux-code v${version()}
A live Claude Code status line: model, git branch, context window, 5-hour and
weekly usage, reset countdowns, and session cost.

USAGE
  flux-code                 Render a status line from JSON on stdin
                                       (this is what Claude Code invokes).
  flux-code install         Wire the status line into settings.json.
  flux-code install --project  Write to ./.claude/settings.json.
  flux-code uninstall       Remove the status line from settings.json.
  flux-code preview [theme] Preview one or all themes.
  flux-code doctor          Print resolved config and sample output.
  flux-code version         Print the version.
  flux-code help            Show this help.

CONFIG
  ~/.claude/flux-code.json  (override with FLUX_CODE_CONFIG)

THEMES
  compact, minimal, powerline, nerd-font, plain-text
`
  );
  return 0;
}
function runCli(command, args) {
  switch (command) {
    case "install":
      return runInstall(args);
    case "uninstall":
      return runUninstall(args);
    case "preview":
      return runPreview(args);
    case "doctor":
      return runDoctor();
    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`${version()}
`);
      return 0;
    case "help":
    case "--help":
    case "-h":
    default:
      return runHelp();
  }
}

// src/notify.ts
import { spawn } from "child_process";
import { readFileSync as readFileSync4, writeFileSync as writeFileSync3 } from "fs";
import { tmpdir as tmpdir2 } from "os";
import { join as join4 } from "path";
var EMPTY_STATE = {
  fiveHour: { resetAt: null, level: 0 },
  weekly: { resetAt: null, level: 0 }
};
function highestCrossed(pct, thresholds) {
  let hit = 0;
  for (const t of thresholds) if (pct >= t) hit = t;
  return hit;
}
function computeNotifications(windows, thresholds, prev) {
  const events = [];
  const next = {
    fiveHour: { ...prev.fiveHour },
    weekly: { ...prev.weekly }
  };
  const handle = (key, label, input) => {
    const state = next[key];
    if (input.resetAt !== state.resetAt) {
      state.resetAt = input.resetAt;
      state.level = 0;
    }
    if (input.pct === null) return;
    const crossed = highestCrossed(input.pct, thresholds);
    if (crossed > state.level) {
      events.push({ label, pct: input.pct, threshold: crossed, resetAt: input.resetAt });
      state.level = crossed;
    }
  };
  handle("fiveHour", "5-hour", windows.fiveHour);
  handle("weekly", "weekly", windows.weekly);
  return { events, next };
}
function sanitizeKey2(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}
function stateFile(sessionId) {
  return join4(tmpdir2(), `flux-code-notify-${sanitizeKey2(sessionId || "default")}`);
}
function isWindowState(value) {
  return typeof value === "object" && value !== null && typeof value.level === "number";
}
function readState(file) {
  try {
    const parsed = JSON.parse(readFileSync4(file, "utf8"));
    if (parsed && typeof parsed === "object" && isWindowState(parsed.fiveHour) && isWindowState(parsed.weekly)) {
      return parsed;
    }
  } catch {
  }
  return structuredClone(EMPTY_STATE);
}
function writeState(file, state) {
  try {
    writeFileSync3(file, JSON.stringify(state));
  } catch {
  }
}
function osaQuote(s) {
  return `"${s.replace(/["\\]/g, "\\$&")}"`;
}
function notifyOS(title, body) {
  try {
    if (process.platform === "darwin") {
      const script = `display notification ${osaQuote(body)} with title ${osaQuote(title)}`;
      spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "linux") {
      spawn("notify-send", [title, body], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
  }
}
function emit(event, config, nowMs) {
  const title = "flux-code \u2014 usage alert";
  const resets = formatCountdown(event.resetAt, nowMs);
  const suffix = resets !== "--" && resets !== "now" ? ` \xB7 resets in ${resets}` : "";
  const label = event.label.charAt(0).toUpperCase() + event.label.slice(1);
  notifyOS(title, `${label} usage at ${Math.round(event.pct)}%${suffix}`);
  if (config.notifyBell) {
    try {
      process.stderr.write("\x07");
    } catch {
    }
  }
}
function maybeNotify(input, config, nowMs = Date.now()) {
  if (!config.notify || config.notifyThresholds.length === 0) return;
  try {
    const file = stateFile(input.session_id);
    const prev = readState(file);
    const rl = input.rate_limits;
    const windows = {
      fiveHour: {
        pct: clampPercent(rl?.five_hour?.used_percentage),
        resetAt: numberOrNull(rl?.five_hour?.resets_at)
      },
      weekly: {
        pct: clampPercent(rl?.seven_day?.used_percentage),
        resetAt: numberOrNull(rl?.seven_day?.resets_at)
      }
    };
    const { events, next } = computeNotifications(windows, config.notifyThresholds, prev);
    writeState(file, next);
    for (const event of events) emit(event, config, nowMs);
  } catch {
  }
}

// src/index.ts
var SUBCOMMANDS = /* @__PURE__ */ new Set([
  "install",
  "uninstall",
  "preview",
  "doctor",
  "version",
  "--version",
  "-v",
  "help",
  "--help",
  "-h"
]);
function main() {
  const command = process.argv[2];
  if (command !== void 0 && SUBCOMMANDS.has(command)) {
    process.exitCode = runCli(command, process.argv.slice(3));
    return;
  }
  try {
    const input = safeParseInput(readStdin());
    const config = loadConfig();
    process.stdout.write(`${produceStatusLine(input, config)}
`);
    maybeNotify(input, config);
  } catch {
    process.stdout.write("\n");
  }
}
main();
//# sourceMappingURL=index.js.map