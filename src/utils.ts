/**
 * Small helpers: stdin reading, safe JSON parsing, path shortening, number
 * coercion, and the git-branch lookup.
 *
 * The git branch is NOT a native Status Line field, so it is derived by
 * shelling out to `git`, exactly as the official docs' examples do. Results are
 * cached to a temp file keyed by `session_id` (stable per session) with a short
 * TTL, so large repositories do not slow the frequently-run status line.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { StatusInput } from './types';

/** Read all of stdin synchronously. Returns "" on any error (e.g. no stdin). */
export function readStdin(): string {
  try {
    // fd 0 = stdin.
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Parse the status payload defensively. Any failure yields an empty object. */
export function safeParseInput(raw: string): StatusInput {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as StatusInput;
    }
    return {};
  } catch {
    return {};
  }
}

/** Basename of a path, or `null` when the path is empty/undefined. */
export function basenameOf(p: string | null | undefined): string | null {
  if (!p) return null;
  return basename(p) || p;
}

/** Replace a leading home directory with "~". */
export function homeShorten(p: string | null | undefined): string | null {
  if (!p) return null;
  const home = homedir();
  return home && p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

/** Expand a leading "~" to the home directory. */
export function expandTilde(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(homedir(), p.slice(2));
  return p;
}

/** Clamp an unknown value to a percentage in [0, 100], or `null` if not a number. */
export function clampPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/** Coerce an unknown value to a finite number, or `null`. */
export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Format a USD amount as "$0.12". */
export function formatCost(value: number | null): string {
  if (value === null) return '--';
  return `$${value.toFixed(2)}`;
}

/**
 * Format lines added/removed as "+124 −18". Uses a true minus sign (U+2212)
 * for the removed count. Returns `null` when neither value is available.
 */
export function formatLines(added: number | null, removed: number | null): string | null {
  const a = added ?? 0;
  const r = removed ?? 0;
  if (added === null && removed === null) return null;
  return `+${a} −${r}`;
}

/**
 * Format spend rate as "$0.34/h" from a cost and an elapsed duration. Returns
 * `null` when either input is missing or the duration is too short to be
 * meaningful (under 30 seconds), which would produce a wild extrapolation.
 */
export function formatBurnRate(cost: number | null, durationMs: number | null): string | null {
  if (cost === null || durationMs === null || durationMs < 30_000) return null;
  const perHour = cost / (durationMs / 3_600_000);
  return `$${perHour.toFixed(2)}/h`;
}

const GIT_CACHE_TTL_MS = 3000;

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

/**
 * Resolve the current git branch.
 *
 * Prefers the native `worktree.branch` field when Claude Code provides it
 * (only during `--worktree` sessions). Otherwise shells out to
 * `git branch --show-current`, caching the result per session. Returns `null`
 * outside a repo, on a detached HEAD, or on any error.
 */
export function getGitBranch(
  cwd: string | null | undefined,
  sessionId: string | null | undefined,
  worktreeBranch?: string | null,
): string | null {
  if (worktreeBranch) return worktreeBranch;

  const dir = cwd || process.cwd();
  const cacheFile = join(tmpdir(), `flux-code-branch-${sanitizeKey(sessionId || 'default')}`);

  try {
    const stats = statSync(cacheFile);
    if (Date.now() - stats.mtimeMs < GIT_CACHE_TTL_MS) {
      const cached = readFileSync(cacheFile, 'utf8');
      return cached === '' ? null : cached;
    }
  } catch {
    // No usable cache; fall through to a fresh lookup.
  }

  let branch: string | null = null;
  try {
    const out = execFileSync('git', ['-C', dir, 'branch', '--show-current'], {
      encoding: 'utf8',
      timeout: 500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    branch = out || null;
  } catch {
    branch = null;
  }

  try {
    writeFileSync(cacheFile, branch ?? '');
  } catch {
    // Caching is best-effort.
  }
  return branch;
}
