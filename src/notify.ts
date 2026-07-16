/**
 * Usage-threshold desktop notifications.
 *
 * When `notify` is enabled, the 5-hour and weekly windows are watched, and a
 * desktop notification fires the first time each crosses a configured
 * `notifyThresholds` level within a window. State is persisted to a temp file
 * keyed by `session_id` so a notification is not repeated on every render, and
 * the recorded level resets when a window rolls over (its `resets_at` changes).
 *
 * The decision logic ({@link computeNotifications}) is pure and unit-tested.
 * The side effects (spawning a notifier, writing state) are best-effort and
 * fully wrapped so they can never break or slow the status line.
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatCountdown } from './countdown';
import type { Config, StatusInput } from './types';
import { clampPercent, numberOrNull } from './utils';

/** Per-window dedupe state: the reset it belongs to and the highest level fired. */
export interface WindowState {
  resetAt: number | null;
  level: number;
}

export interface NotifyState {
  fiveHour: WindowState;
  weekly: WindowState;
}

export interface NotifyEvent {
  /** Human label for the window, e.g. "5-hour" or "weekly". */
  label: string;
  /** Current usage percentage that triggered the event. */
  pct: number;
  /** The threshold level that was crossed. */
  threshold: number;
  /** Unix epoch seconds when the window resets, if known. */
  resetAt: number | null;
}

const EMPTY_STATE: NotifyState = {
  fiveHour: { resetAt: null, level: 0 },
  weekly: { resetAt: null, level: 0 },
};

interface WindowInput {
  pct: number | null;
  resetAt: number | null;
}

/** Highest threshold that `pct` has reached, or 0 if none. `thresholds` sorted ascending. */
function highestCrossed(pct: number, thresholds: number[]): number {
  let hit = 0;
  for (const t of thresholds) if (pct >= t) hit = t;
  return hit;
}

/**
 * Decide which windows should notify, given the current usage, the configured
 * thresholds, and the previously recorded state. Returns the events to emit and
 * the next state to persist. Pure — no I/O, no clock.
 */
export function computeNotifications(
  windows: { fiveHour: WindowInput; weekly: WindowInput },
  thresholds: number[],
  prev: NotifyState,
): { events: NotifyEvent[]; next: NotifyState } {
  const events: NotifyEvent[] = [];
  const next: NotifyState = {
    fiveHour: { ...prev.fiveHour },
    weekly: { ...prev.weekly },
  };

  const handle = (key: 'fiveHour' | 'weekly', label: string, input: WindowInput): void => {
    const state = next[key];
    // A changed reset timestamp means a new window: clear the fired level.
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

  handle('fiveHour', '5-hour', windows.fiveHour);
  handle('weekly', 'weekly', windows.weekly);
  return { events, next };
}

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function stateFile(sessionId: string | null | undefined): string {
  return join(tmpdir(), `flux-code-notify-${sanitizeKey(sessionId || 'default')}`);
}

function isWindowState(value: unknown): value is WindowState {
  return (
    typeof value === 'object' && value !== null && typeof (value as WindowState).level === 'number'
  );
}

function readState(file: string): NotifyState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      isWindowState((parsed as NotifyState).fiveHour) &&
      isWindowState((parsed as NotifyState).weekly)
    ) {
      return parsed as NotifyState;
    }
  } catch {
    // No usable state; start fresh.
  }
  return structuredClone(EMPTY_STATE);
}

function writeState(file: string, state: NotifyState): void {
  try {
    writeFileSync(file, JSON.stringify(state));
  } catch {
    // Best-effort: a failed write just means we may re-notify next time.
  }
}

/** Quote a string for use inside an AppleScript literal. */
function osaQuote(s: string): string {
  return `"${s.replace(/["\\]/g, '\\$&')}"`;
}

function notifyOS(title: string, body: string): void {
  try {
    if (process.platform === 'darwin') {
      const script = `display notification ${osaQuote(body)} with title ${osaQuote(title)}`;
      spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'linux') {
      spawn('notify-send', [title, body], { detached: true, stdio: 'ignore' }).unref();
    }
    // Other platforms: no supported notifier; the bell (if enabled) still fires.
  } catch {
    // Missing notifier binary, etc. — never surface it.
  }
}

function emit(event: NotifyEvent, config: Config, nowMs: number): void {
  const title = 'flux-code — usage alert';
  const resets = formatCountdown(event.resetAt, nowMs);
  const suffix = resets !== '--' && resets !== 'now' ? ` · resets in ${resets}` : '';
  const label = event.label.charAt(0).toUpperCase() + event.label.slice(1);
  notifyOS(title, `${label} usage at ${Math.round(event.pct)}%${suffix}`);
  if (config.notifyBell) {
    try {
      process.stderr.write('\x07');
    } catch {
      // Bell is decorative.
    }
  }
}

/**
 * Read state, decide, persist, and emit any usage notifications. Never throws:
 * notifications must not break or slow the status line.
 */
export function maybeNotify(input: StatusInput, config: Config, nowMs: number = Date.now()): void {
  if (!config.notify || config.notifyThresholds.length === 0) return;
  try {
    const file = stateFile(input.session_id);
    const prev = readState(file);
    const rl = input.rate_limits;
    const windows = {
      fiveHour: {
        pct: clampPercent(rl?.five_hour?.used_percentage),
        resetAt: numberOrNull(rl?.five_hour?.resets_at),
      },
      weekly: {
        pct: clampPercent(rl?.seven_day?.used_percentage),
        resetAt: numberOrNull(rl?.seven_day?.resets_at),
      },
    };
    const { events, next } = computeNotifications(windows, config.notifyThresholds, prev);
    writeState(file, next);
    for (const event of events) emit(event, config, nowMs);
  } catch {
    // Swallow everything — a notification failure must be invisible.
  }
}
