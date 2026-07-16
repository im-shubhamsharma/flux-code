import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config';
import { buildModel, colorsEnabled, produceStatusLine } from '../src/statusline';
import type { Config, StatusInput } from '../src/types';

const NOW = 1_700_000_000_000;

function config(overrides: Partial<Config> = {}): Config {
  // showBranch off by default here so tests never shell out to git.
  return { ...structuredClone(DEFAULT_CONFIG), showBranch: false, ...overrides };
}

const richInput: StatusInput = {
  model: { id: 'claude-opus-4-8', display_name: 'Opus 4' },
  workspace: { current_dir: '/home/dev/code/flux', project_dir: '/home/dev/code/flux' },
  context_window: { used_percentage: 82, context_window_size: 200000 },
  cost: { total_cost_usd: 0.1234 },
  rate_limits: {
    five_hour: { used_percentage: 61, resets_at: Math.floor(NOW / 1000) + 3600 },
    seven_day: { used_percentage: 19, resets_at: Math.floor(NOW / 1000) + 86400 },
  },
};

describe('buildModel', () => {
  it('normalizes a full payload into a render model', () => {
    const m = buildModel(richInput, config(), NOW);
    expect(m.modelName).toBe('Opus 4');
    expect(m.context).toBe(82);
    expect(m.fiveHour).toBe(61);
    expect(m.weekly).toBe(19);
    expect(m.cost).toBeCloseTo(0.1234);
    expect(m.cwdName).toBe('flux');
    expect(m.contextWindowSize).toBe(200000);
    expect(m.branch).toBeNull(); // showBranch: false
  });

  it('maps every missing field to null (never throws)', () => {
    const m = buildModel({}, config(), NOW);
    expect(m.modelName).toBeNull();
    expect(m.context).toBeNull();
    expect(m.fiveHour).toBeNull();
    expect(m.weekly).toBeNull();
    expect(m.cost).toBeNull();
    expect(m.fiveHourResetAt).toBeNull();
    expect(m.weeklyResetAt).toBeNull();
  });

  it('prefers the native worktree.branch over a git shell-out', () => {
    const m = buildModel(
      { ...richInput, worktree: { branch: 'wt-feature' } },
      config({ showBranch: true }),
      NOW,
    );
    expect(m.branch).toBe('wt-feature');
  });

  it('clamps out-of-range percentages', () => {
    const m = buildModel(
      {
        context_window: { used_percentage: 140 },
        rate_limits: { five_hour: { used_percentage: -3 } },
      },
      config(),
      NOW,
    );
    expect(m.context).toBe(100);
    expect(m.fiveHour).toBe(0);
  });
});

describe('produceStatusLine', () => {
  it('renders a non-empty line for a rich payload', () => {
    const out = produceStatusLine(richInput, config({ theme: 'compact', useColors: false }), NOW);
    expect(out).toContain('Opus 4');
    expect(out).toContain('82%');
    expect(out).toContain('61%');
  });

  it('renders -- for missing usage fields instead of crashing', () => {
    const sparse: StatusInput = {
      model: { display_name: 'Opus 4' },
      context_window: { used_percentage: 12 },
    };
    const out = produceStatusLine(sparse, config({ theme: 'compact', useColors: false }), NOW);
    expect(out).toContain('5h --');
    expect(out).toContain('Week --');
  });

  it('never throws on an empty payload', () => {
    expect(() => produceStatusLine({}, config(), NOW)).not.toThrow();
  });
});

describe('colorsEnabled', () => {
  afterEach(() => {
    delete process.env.NO_COLOR;
  });

  it('follows useColors when NO_COLOR is unset', () => {
    expect(colorsEnabled(config({ useColors: true }))).toBe(true);
    expect(colorsEnabled(config({ useColors: false }))).toBe(false);
  });

  it('is disabled when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';
    expect(colorsEnabled(config({ useColors: true }))).toBe(false);
  });
});
