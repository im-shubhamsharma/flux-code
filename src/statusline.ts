/**
 * Orchestration: turn the raw Status Line payload into a normalized
 * {@link StatusModel} and render it.
 *
 * `buildModel` is where the documented JSON contract meets our render model.
 * It reads only officially-supported fields and resolves the git branch (the
 * one value not carried in the payload) via `getGitBranch`.
 */

import { createAnsi } from './colors';
import { render } from './renderer';
import type { Config, StatusInput, StatusModel } from './types';
import { basenameOf, clampPercent, getGitBranch, homeShorten, numberOrNull } from './utils';

/** Normalize a raw payload into a render-ready model. */
export function buildModel(input: StatusInput, config: Config, _nowMs: number): StatusModel {
  const contextWindow = input.context_window;
  const rateLimits = input.rate_limits;
  const cwdPath = input.workspace?.current_dir ?? input.cwd ?? null;

  const branch = config.showBranch
    ? getGitBranch(cwdPath, input.session_id, input.worktree?.branch)
    : null;

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
  };
}

/** Should ANSI color be emitted? Honors config and the NO_COLOR convention. */
export function colorsEnabled(config: Config): boolean {
  // The NO_COLOR convention: any non-empty value disables color.
  if (process.env.NO_COLOR) return false;
  return config.useColors;
}

/** Build and render the status line from a raw payload. */
export function produceStatusLine(
  input: StatusInput,
  config: Config,
  nowMs: number = Date.now(),
): string {
  const model = buildModel(input, config, nowMs);
  const ansi = createAnsi(colorsEnabled(config));
  return render(model, config, { nowMs, ansi });
}
