/**
 * Reset countdown and duration formatting.
 *
 * `rate_limits.*.resets_at` is a Unix epoch in seconds. Countdowns are computed
 * against a caller-supplied "now" (milliseconds) so the functions stay pure and
 * testable, and so the whole line refreshes without re-reading the payload.
 */

/**
 * Format the time remaining until `resetAtSec` as a compact "2h 14m" / "5d 3h".
 *
 * - `null`/non-finite input -> "--"
 * - already elapsed -> "now"
 * - shows the two largest non-zero units (days+hours, hours+minutes, or minutes)
 */
export function formatCountdown(resetAtSec: number | null | undefined, nowMs: number): string {
  if (resetAtSec === null || resetAtSec === undefined || !Number.isFinite(resetAtSec)) {
    return '--';
  }
  const diffMs = resetAtSec * 1000 - nowMs;
  if (diffMs <= 0) return 'now';

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Human phrasing for a reset countdown. Returns "" when the value is
 * unavailable so callers can omit the line entirely.
 */
export function formatResetsIn(resetAtSec: number | null | undefined, nowMs: number): string {
  const countdown = formatCountdown(resetAtSec, nowMs);
  if (countdown === '--') return '';
  if (countdown === 'now') return 'Resets now';
  return `Resets in ${countdown}`;
}

/** Format an elapsed duration in ms as "1h 4m" / "4m 12s" / "12s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
