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
  layout: "default",
  theme: "default",
  showModel: true,
  showBranch: true,
  showContext: true,
  showFiveHour: true,
  showWeekly: true,
  showCost: true,
  showCountdown: true,
  showWorkingDirectory: false,
  refreshSeconds: 30,
  progressWidth: 12,
  useColors: true,
  useIcons: true,
  partialBlocks: false,
  flashOnCritical: true,
  separator: " | ",
  missingText: "--",
  colorThresholds: { yellow: 60, orange: 80, red: 90 },
  warnThresholds: { warn: 80, danger: 90, flash: 95 }
};
var LAYOUTS = ["default", "compact", "minimal"];
var THEMES = [
  "default",
  "minimal",
  "compact",
  "powerline",
  "nerd-font",
  "plain-text"
];
var BOOLEAN_KEYS = [
  "showModel",
  "showBranch",
  "showContext",
  "showFiveHour",
  "showWeekly",
  "showCost",
  "showCountdown",
  "showWorkingDirectory",
  "useColors",
  "useIcons",
  "partialBlocks",
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
  if (typeof raw.separator === "string") cfg.separator = raw.separator;
  if (typeof raw.missingText === "string") cfg.missingText = raw.missingText;
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
function formatResetsIn(resetAtSec, nowMs) {
  const countdown = formatCountdown(resetAtSec, nowMs);
  if (countdown === "--") return "";
  if (countdown === "now") return "Resets now";
  return `Resets in ${countdown}`;
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

// src/renderer.ts
function pctLabel(value, config) {
  return value === null ? config.missingText : `${Math.round(value)}%`;
}
function barOptions(config) {
  return { partial: config.partialBlocks };
}
function iconPrefix(icon, config) {
  return config.useIcons && icon ? `${icon} ` : "";
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
function renderDefault(model, config, ctx) {
  const { ansi, nowMs } = ctx;
  const I = EMOJI_ICONS;
  const lines = [];
  const paint = (pct) => colorForPercent(ansi, pct, config.colorThresholds);
  const bar = (pct) => paint(pct)(progressBar(pct, config.progressWidth, barOptions(config)));
  if (config.showModel && model.modelName) {
    lines.push(`${iconPrefix(I.model, config)}${ansi.bold(model.modelName)}`);
  }
  if (config.showBranch && model.branch) {
    lines.push(`${iconPrefix(I.branch, config)}${ansi.blue(model.branch)}`);
  }
  if (config.showWorkingDirectory && model.cwdPath) {
    lines.push(`${iconPrefix(I.dir, config)}${ansi.dim(model.cwdPath)}`);
  }
  if (config.showContext) {
    lines.push(
      `${iconPrefix(I.context, config)}Context${warnBadge(model.context, config, ansi, I.warn)}`
    );
    lines.push(`${bar(model.context)} ${pctLabel(model.context, config)}`);
  }
  if (config.showFiveHour) {
    lines.push(
      `${iconPrefix(I.fiveHour, config)}5-hour${warnBadge(model.fiveHour, config, ansi, I.warn)}`
    );
    lines.push(`${bar(model.fiveHour)} ${pctLabel(model.fiveHour, config)}`);
    if (config.showCountdown) {
      const resets = formatResetsIn(model.fiveHourResetAt, nowMs);
      if (resets) lines.push(ansi.cyan(resets));
    }
  }
  if (config.showWeekly) {
    lines.push(
      `${iconPrefix(I.weekly, config)}Weekly${warnBadge(model.weekly, config, ansi, I.warn)}`
    );
    lines.push(`${bar(model.weekly)} ${pctLabel(model.weekly, config)}`);
    if (config.showCountdown) {
      const resets = formatResetsIn(model.weeklyResetAt, nowMs);
      if (resets) lines.push(ansi.cyan(resets));
    }
  }
  if (config.showCost && model.cost !== null) {
    lines.push(`${iconPrefix(I.cost, config)}${ansi.yellow(formatCost(model.cost))}`);
  }
  return lines.length > 0 ? lines.join("\n") : fallback(model, config, ansi);
}
function renderCompact(model, config, ctx) {
  const { ansi } = ctx;
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
  if (config.showFiveHour) {
    segments.push(
      `5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}${warnBadge(model.fiveHour, config, ansi, EMOJI_ICONS.warn)}`
    );
  }
  if (config.showWeekly) {
    segments.push(
      `Week ${paint(model.weekly)(pctLabel(model.weekly, config))}${warnBadge(model.weekly, config, ansi, EMOJI_ICONS.warn)}`
    );
  }
  if (config.showCost && model.cost !== null) segments.push(ansi.yellow(formatCost(model.cost)));
  return segments.length > 0 ? segments.join(config.separator) : fallback(model, config, ansi);
}
function renderMinimal(model, config, ctx) {
  const { ansi } = ctx;
  const paint = (pct) => colorForPercent(ansi, pct, config.colorThresholds);
  const segments = [];
  if (config.showModel && model.modelName) segments.push(ansi.bold(model.modelName));
  if (config.showBranch && model.branch) segments.push(ansi.blue(model.branch));
  if (config.showContext)
    segments.push(`Ctx ${paint(model.context)(pctLabel(model.context, config))}`);
  if (config.showFiveHour)
    segments.push(`5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`);
  if (config.showWeekly)
    segments.push(`Week ${paint(model.weekly)(pctLabel(model.weekly, config))}`);
  if (config.showCost && model.cost !== null) segments.push(ansi.yellow(formatCost(model.cost)));
  return segments.length > 0 ? segments.join(" \u2502 ") : fallback(model, config, ansi);
}
function renderPowerline(model, config, ctx) {
  const { ansi } = ctx;
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
  if (config.showFiveHour) segments.push(pctSeg("5H", model.fiveHour));
  if (config.showWeekly) segments.push(pctSeg("7D", model.weekly));
  if (config.showCost && model.cost !== null) {
    segments.push({ text: ` ${formatCost(model.cost)} `, fg: white, bg: 22 });
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
  const { ansi } = ctx;
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
  if (config.showFiveHour) {
    segments.push(
      `${useIcons ? `${I.fiveHour} ` : "5h "}${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`
    );
  }
  if (config.showWeekly) {
    segments.push(
      `${useIcons ? `${I.weekly} ` : "7d "}${paint(model.weekly)(pctLabel(model.weekly, config))}`
    );
  }
  if (config.showCost && model.cost !== null) {
    segments.push(`${useIcons ? `${I.cost} ` : ""}${ansi.yellow(formatCost(model.cost))}`);
  }
  return segments.length > 0 ? segments.join("  ") : fallback(model, config, ansi);
}
function renderPlainText(model, config) {
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
  if (config.showFiveHour) segments.push(`5h ${pctLabel(model.fiveHour, config)}`);
  if (config.showWeekly) segments.push(`Week ${pctLabel(model.weekly, config)}`);
  if (config.showCost && model.cost !== null) segments.push(formatCost(model.cost));
  return segments.length > 0 ? segments.join(" | ") : model.modelName ?? config.missingText;
}
function render(model, config, ctx) {
  const ansi = config.theme === "plain-text" ? createAnsi(false) : ctx.ansi;
  const themedCtx = { ...ctx, ansi };
  switch (config.theme) {
    case "compact":
      return renderCompact(model, config, themedCtx);
    case "minimal":
      return renderMinimal(model, config, themedCtx);
    case "powerline":
      return renderPowerline(model, config, themedCtx);
    case "nerd-font":
      return renderNerdFont(model, config, themedCtx);
    case "plain-text":
      return renderPlainText(model, config);
    case "default":
    default:
      return renderDefault(model, config, themedCtx);
  }
}

// src/statusline.ts
function buildModel(input, config, _nowMs) {
  const contextWindow = input.context_window;
  const rateLimits = input.rate_limits;
  const cwdPath = input.workspace?.current_dir ?? input.cwd ?? null;
  const branch = config.showBranch ? getGitBranch(cwdPath, input.session_id, input.worktree?.branch) : null;
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
    version: input.version ?? null,
    sessionName: input.session_name ?? null,
    contextWindowSize: numberOrNull(contextWindow?.context_window_size)
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
var PREVIEW_THEMES = [
  "default",
  "compact",
  "minimal",
  "powerline",
  "nerd-font",
  "plain-text"
];
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
  default, compact, minimal, powerline, nerd-font, plain-text
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
  } catch {
    process.stdout.write("\n");
  }
}
main();
//# sourceMappingURL=index.js.map