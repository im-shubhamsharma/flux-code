/**
 * Configuration loading and merging.
 *
 * Config is read from (in order of precedence):
 *   1. the `FLUX_CODE_CONFIG` environment variable
 *   2. an explicit path passed to {@link loadConfig}
 *   3. `~/.claude/flux-code.json`
 *
 * Loading never throws: a missing, unreadable, or malformed file falls back to
 * defaults, and unknown or wrongly-typed keys are ignored. This keeps the
 * status line resilient, per the API's "never crash the UI" guidance.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config, Layout, Theme } from './types';

export const DEFAULT_CONFIG: Config = {
  layout: 'compact',
  theme: 'compact',
  showModel: true,
  showBranch: true,
  showContext: true,
  showFiveHour: true,
  showWeekly: true,
  showCost: true,
  showCountdown: true,
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
  partialBlocks: false,
  flashOnCritical: true,
  separator: ' | ',
  missingText: '--',
  colorThresholds: { yellow: 60, orange: 80, red: 90 },
  warnThresholds: { warn: 80, danger: 90, flash: 95 },
};

const LAYOUTS: readonly Layout[] = ['default', 'compact', 'minimal'];
const THEMES: readonly Theme[] = [
  'default',
  'minimal',
  'compact',
  'powerline',
  'nerd-font',
  'plain-text',
];

const BOOLEAN_KEYS = [
  'showModel',
  'showBranch',
  'showContext',
  'showFiveHour',
  'showWeekly',
  'showCost',
  'showCountdown',
  'showWorkingDirectory',
  'showLines',
  'showSessionTime',
  'showBurnRate',
  'showRepo',
  'showTokens',
  'showVersion',
  'showOutputStyle',
  'showEffort',
  'showGitDirty',
  'hideUnavailable',
  'notify',
  'notifyBell',
  'useColors',
  'useIcons',
  'partialBlocks',
  'flashOnCritical',
] as const satisfies readonly (keyof Config)[];

/** Resolve the config file path from env, an explicit argument, or the default. */
export function configPath(explicit?: string): string {
  return process.env.FLUX_CODE_CONFIG || explicit || join(homedir(), '.claude', 'flux-code.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLayout(value: unknown): value is Layout {
  return typeof value === 'string' && (LAYOUTS as readonly string[]).includes(value);
}

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Merge a raw parsed object onto {@link DEFAULT_CONFIG}, validating each field. */
export function mergeConfig(raw: unknown): Config {
  const cfg: Config = structuredClone(DEFAULT_CONFIG);
  if (!isRecord(raw)) return cfg;

  for (const key of BOOLEAN_KEYS) {
    const value = raw[key];
    if (typeof value === 'boolean') {
      (cfg[key] as boolean) = value;
    }
  }

  if (isFiniteNumber(raw.refreshSeconds)) {
    cfg.refreshSeconds = Math.max(1, Math.floor(raw.refreshSeconds));
  }
  if (isFiniteNumber(raw.progressWidth)) {
    cfg.progressWidth = Math.max(1, Math.min(60, Math.floor(raw.progressWidth)));
  }

  if (typeof raw.separator === 'string') cfg.separator = raw.separator;
  if (typeof raw.missingText === 'string') cfg.missingText = raw.missingText;

  if (Array.isArray(raw.notifyThresholds)) {
    // Keep finite percentages, clamp to [1, 100], dedupe, and sort ascending.
    const cleaned = [
      ...new Set(
        raw.notifyThresholds
          .filter(isFiniteNumber)
          .map((n) => Math.max(1, Math.min(100, Math.floor(n)))),
      ),
    ].sort((a, b) => a - b);
    cfg.notifyThresholds = cleaned;
  }

  // `theme` is canonical. When only `layout` is given, it aliases the theme.
  const layout = isLayout(raw.layout) ? raw.layout : undefined;
  const theme = isTheme(raw.theme) ? raw.theme : undefined;
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

/** Load and validate the config from disk, falling back to defaults. */
export function loadConfig(explicit?: string): Config {
  const path = configPath(explicit);
  let raw: unknown = {};
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    raw = {};
  }
  return mergeConfig(raw);
}
