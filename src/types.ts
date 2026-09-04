/**
 * Type definitions for the Claude Code Status Line JSON payload and the
 * Flux Code configuration.
 *
 * The `StatusInput` interface mirrors the official Status Line contract:
 * https://code.claude.com/docs/en/statusline (see "Available data").
 *
 * Every field is optional because Claude Code omits fields that do not apply
 * to the current session (for example, `rate_limits` is present only for
 * Claude.ai Pro/Max subscribers after the first API response). Nothing here is
 * inferred or undocumented.
 */

/** `model.*` — current model identity. */
export interface ModelInfo {
  id?: string;
  display_name?: string;
}

/** `workspace.repo.*` — parsed from the `origin` remote. Absent outside a repo. */
export interface RepoInfo {
  host?: string;
  owner?: string;
  name?: string;
}

/** `workspace.*` — directory and repository context. */
export interface WorkspaceInfo {
  current_dir?: string;
  project_dir?: string;
  added_dirs?: string[];
  git_worktree?: string;
  repo?: RepoInfo;
}

/** `cost.*` — client-side session cost and activity counters. */
export interface CostInfo {
  total_cost_usd?: number;
  total_duration_ms?: number;
  total_api_duration_ms?: number;
  total_lines_added?: number;
  total_lines_removed?: number;
}

/** `context_window.current_usage.*` — per-component token counts from the last call. */
export interface ContextUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** `context_window.*` — live context window from the most recent API response. */
export interface ContextWindow {
  total_input_tokens?: number;
  total_output_tokens?: number;
  context_window_size?: number;
  /** Pre-calculated, input-only. May be `null` early in the session. */
  used_percentage?: number | null;
  remaining_percentage?: number | null;
  /** `null` before the first API call and again right after `/compact`. */
  current_usage?: ContextUsage | null;
}

/** A single rate-limit window (`five_hour` or `seven_day`). */
export interface RateWindow {
  /** Percentage of the window consumed, 0-100. */
  used_percentage?: number;
  /** Unix epoch seconds when the window resets. */
  resets_at?: number;
}

/**
 * `rate_limits.*` — Claude.ai subscription usage.
 * Present only for Pro/Max subscribers after the first API response. Each
 * window may be independently absent.
 */
export interface RateLimits {
  five_hour?: RateWindow;
  seven_day?: RateWindow;
}

export interface OutputStyle {
  name?: string;
}

export interface EffortInfo {
  level?: string;
}

export interface WorktreeInfo {
  name?: string;
  path?: string;
  branch?: string;
  original_cwd?: string;
  original_branch?: string;
}

export interface PrInfo {
  number?: number;
  url?: string;
  review_state?: string;
}

/**
 * The complete JSON object Claude Code writes to the status line command's
 * stdin. All fields are optional; see the per-field docs above.
 */
export interface StatusInput {
  cwd?: string;
  session_id?: string;
  session_name?: string;
  prompt_id?: string;
  transcript_path?: string;
  model?: ModelInfo;
  workspace?: WorkspaceInfo;
  version?: string;
  output_style?: OutputStyle;
  cost?: CostInfo;
  context_window?: ContextWindow;
  exceeds_200k_tokens?: boolean;
  effort?: EffortInfo;
  thinking?: { enabled?: boolean };
  rate_limits?: RateLimits;
  vim?: { mode?: string };
  agent?: { name?: string };
  pr?: PrInfo;
  worktree?: WorktreeInfo;
}

/** Structural density of the rendered line. Alias for a subset of themes. */
export type Layout = 'compact' | 'minimal';

/**
 * Visual style. `theme` is the canonical selector; `layout` maps onto it.
 * (The old multi-line `default` theme was removed in v1.4.0 — every theme is
 * now a single line. A config that still says `"default"` falls back to
 * `compact`.)
 */
export type Theme = 'minimal' | 'compact' | 'powerline' | 'nerd-font' | 'plain-text';

/** Percentage boundaries that pick the segment color. */
export interface ColorThresholds {
  /** >= this is yellow (default 60). */
  yellow: number;
  /** >= this is orange (default 80). */
  orange: number;
  /** >= this is red (default 90). */
  red: number;
}

/** Percentage boundaries that pick the warning badge. */
export interface WarnThresholds {
  /** >= this shows a yellow warning icon (default 80). */
  warn: number;
  /** >= this shows a red warning icon (default 90). */
  danger: number;
  /** >= this makes the icon flash, if the terminal supports blink (default 95). */
  flash: number;
}

/** Resolved, fully-populated configuration. */
export interface Config {
  layout: Layout;
  theme: Theme;
  showModel: boolean;
  showBranch: boolean;
  showContext: boolean;
  showFiveHour: boolean;
  showWeekly: boolean;
  showCost: boolean;
  /** Show 5-hour reset details once usage crosses `countdownAfterPercent`. */
  showCountdown: boolean;
  /**
   * Usage percentage above which the 5-hour segment appends its reset details:
   * the wall-clock reset time and the time left, e.g.
   * `resets 4:32pm (2h 13m left)`. Default 50. Set 0 to always show it, or
   * 100 (or `showCountdown: false`) to never show it.
   */
  countdownAfterPercent: number;
  showWorkingDirectory: boolean;
  /** Show lines added/removed this session (`+124 −18`). Off by default. */
  showLines: boolean;
  /** Show elapsed session time (`⏱ 2h 13m`). Off by default. */
  showSessionTime: boolean;
  /** Show spend rate in USD per hour (`$0.34/h`). Off by default. */
  showBurnRate: boolean;
  /** Show the repository as `owner/name` (`workspace.repo`). Off by default. */
  showRepo: boolean;
  /** Show the context token count (`45.2k`). Off by default. */
  showTokens: boolean;
  /** Show the Claude Code version (`v2.1.90`). Off by default. */
  showVersion: boolean;
  /** Show the active output style (`output_style.name`). Off by default. */
  showOutputStyle: boolean;
  /** Show the thinking-effort level (`effort.level`). Off by default. */
  showEffort: boolean;
  /** Show the count of uncommitted git changes. Off by default; adds a git call. */
  showGitDirty: boolean;
  /**
   * Hide the 5-hour and weekly segments until their data is available instead
   * of showing a `--` placeholder. On a fresh session `rate_limits` only
   * appears after the first API response, so this avoids a "loading" flicker.
   * Set `false` to always show the segments with `--`. (Cost is always hidden
   * until available, regardless of this flag.)
   */
  hideUnavailable: boolean;
  /**
   * Fire a desktop notification when the 5-hour or weekly usage first crosses
   * a `notifyThresholds` level within a window. Off by default. Notifications
   * are deduplicated per session and reset when a window rolls over.
   */
  notify: boolean;
  /** Also emit a terminal bell alongside a usage notification. */
  notifyBell: boolean;
  /** Percentage levels that trigger a usage notification, e.g. `[80, 95]`. */
  notifyThresholds: number[];
  /** Seconds between forced refreshes. Bridged to `statusLine.refreshInterval`. */
  refreshSeconds: number;
  /** Progress bar width in characters. */
  progressWidth: number;
  useColors: boolean;
  /** Render emoji / nerd-font glyphs. */
  useIcons: boolean;
  /** Emit the ANSI blink code for values past the flash threshold. */
  flashOnCritical: boolean;
  /** Segment separator for single-line themes. */
  separator: string;
  /** Text shown when a value is unavailable. */
  missingText: string;
  colorThresholds: ColorThresholds;
  warnThresholds: WarnThresholds;
}

/**
 * Normalized, render-ready view of a status payload. Percentages are clamped
 * numbers or `null` (meaning "unavailable, show missingText"). This is the pure
 * input the renderer consumes, decoupled from stdin parsing and git shell-outs.
 */
export interface StatusModel {
  modelName: string | null;
  branch: string | null;
  cwdName: string | null;
  cwdPath: string | null;
  context: number | null;
  fiveHour: number | null;
  weekly: number | null;
  fiveHourResetAt: number | null;
  weeklyResetAt: number | null;
  cost: number | null;
  /** `cost.total_lines_added` — lines added this session. */
  linesAdded: number | null;
  /** `cost.total_lines_removed` — lines removed this session. */
  linesRemoved: number | null;
  /** `cost.total_duration_ms` — wall-clock session duration. */
  durationMs: number | null;
  version: string | null;
  sessionName: string | null;
  contextWindowSize: number | null;
  /** `workspace.repo` rendered as `owner/name`, when available. */
  repo: string | null;
  /** Tokens currently held in the context window (`context_window.current_usage`). */
  contextTokens: number | null;
  /** `output_style.name` — the active output style. */
  outputStyle: string | null;
  /** `effort.level` — the active thinking-effort level. */
  effort: string | null;
  /** Count of uncommitted changes, derived from `git status`. `null` when unknown. */
  gitDirty: number | null;
}
