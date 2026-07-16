import { describe, expect, it } from 'vitest';
import { computeNotifications, type NotifyState } from '../src/notify';

const fresh = (): NotifyState => ({
  fiveHour: { resetAt: null, level: 0 },
  weekly: { resetAt: null, level: 0 },
});

const windows = (fiveHourPct: number | null, resetAt: number | null = 1000) => ({
  fiveHour: { pct: fiveHourPct, resetAt },
  weekly: { pct: null, resetAt: null },
});

describe('computeNotifications', () => {
  it('fires when usage first crosses a threshold', () => {
    const { events, next } = computeNotifications(windows(92), [90], fresh());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ label: '5-hour', threshold: 90, pct: 92 });
    expect(next.fiveHour.level).toBe(90);
  });

  it('does not fire again on the next render within the same window', () => {
    const first = computeNotifications(windows(92), [90], fresh());
    const second = computeNotifications(windows(94), [90], first.next);
    expect(second.events).toHaveLength(0);
    expect(second.next.fiveHour.level).toBe(90);
  });

  it('re-arms when the window resets (resets_at changes)', () => {
    const first = computeNotifications(windows(92, 1000), [90], fresh());
    // New window: same high usage, different reset timestamp.
    const second = computeNotifications(windows(92, 5000), [90], first.next);
    expect(second.events).toHaveLength(1);
    expect(second.next.fiveHour.resetAt).toBe(5000);
  });

  it('does not fire below the lowest threshold', () => {
    const { events } = computeNotifications(windows(80), [90], fresh());
    expect(events).toHaveLength(0);
  });

  it('fires the highest crossed threshold and steps up on later crossings', () => {
    const first = computeNotifications(windows(85), [80, 90, 95], fresh());
    expect(first.events[0]?.threshold).toBe(80);
    const second = computeNotifications(windows(96), [80, 90, 95], first.next);
    expect(second.events[0]?.threshold).toBe(95);
  });

  it('ignores a window with no usage data', () => {
    const { events, next } = computeNotifications(windows(null), [90], fresh());
    expect(events).toHaveLength(0);
    expect(next.fiveHour.level).toBe(0);
  });

  it('watches the weekly window independently', () => {
    const { events } = computeNotifications(
      { fiveHour: { pct: 10, resetAt: 1 }, weekly: { pct: 99, resetAt: 2 } },
      [90],
      fresh(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.label).toBe('weekly');
  });
});
