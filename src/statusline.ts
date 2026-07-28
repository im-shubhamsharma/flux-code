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
import type { Config, ContextUsage, RepoInfo, StatusInput, StatusModel } from './types';
import {
  basenameOf,
  clampPercent,
  getGitBranch,
  getGitDirtyCount,
  homeShorten,
  numberOrNull,
} from './utils';

/** `owner/name` for a repo, or just the name, or `null`. */
function repoLabel(repo: RepoInfo | undefined): string | null {
  if (!repo) return null;
  if (repo.owner && repo.name) return `${repo.owner}/${repo.name}`;
  return repo.name ?? null;
}

/** Sum the input-side token components that make up the current context. */
function contextTokenCount(usage: ContextUsage | null | undefined): number | null {
  if (!usage) return null;
  const parts = [
    usage.input_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens,
  ].filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0);
}

/** Normalize a raw payload into a render-ready model. */
export function buildModel(input: StatusInput, config: Config, _nowMs: number): StatusModel {
  const contextWindow = input.context_window;
  const rateLimits = input.rate_limits;
  const cwdPath = input.workspace?.current_dir ?? input.cwd ?? null;

  const branch = config.showBranch
    ? getGitBranch(cwdPath, input.session_id, input.worktree?.branch)
    : null;
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
    gitDirty,
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
