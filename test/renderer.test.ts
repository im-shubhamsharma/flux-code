import { describe, expect, it } from 'vitest';
import { createAnsi } from '../src/colors';
import { DEFAULT_CONFIG } from '../src/config';
import { render, type RenderContext } from '../src/renderer';
import type { Config, StatusModel, Theme } from '../src/types';

const NOW = 1_700_000_000_000;

function model(overrides: Partial<StatusModel> = {}): StatusModel {
  return {
    modelName: 'Opus 4',
    branch: 'feature/auth',
    cwdName: 'flux',
    cwdPath: '~/code/flux',
    context: 41,
    fiveHour: 28,
    weekly: 13,
    fiveHourResetAt: Math.floor(NOW / 1000) + 2 * 3600 + 13 * 60,
    weeklyResetAt: Math.floor(NOW / 1000) + 5 * 86400,
    cost: 0.12,
    linesAdded: 124,
    linesRemoved: 18,
    durationMs: 133000,
    version: '2.1.90',
    sessionName: null,
    contextWindowSize: 200000,
    repo: 'acme/flux',
    contextTokens: 45200,
    outputStyle: null,
    effort: null,
    gitDirty: null,
    ...overrides,
  };
}

function config(overrides: Partial<Config> = {}): Config {
  return { ...structuredClone(DEFAULT_CONFIG), ...overrides };
}

// Colors off keeps assertions about plain substrings simple.
const plainCtx = (): RenderContext => ({ nowMs: NOW, ansi: createAnsi(false) });
const colorCtx = (): RenderContext => ({ nowMs: NOW, ansi: createAnsi(true) });
const ESC = String.fromCharCode(27);

describe('render: compact', () => {
  it('matches the documented one-line shape', () => {
    const out = render(
      model(),
      config({ theme: 'compact', useColors: false, useIcons: false }),
      plainCtx(),
    );
    expect(out).toBe('Opus 4 | feature/auth | Ctx 41% | 5h 28% | Week 13% | $0.12');
  });

  it('shows -- for a missing rate limit window when hideUnavailable is off', () => {
    const out = render(
      model({ fiveHour: null, weekly: null }),
      config({
        theme: 'compact',
        useColors: false,
        useIcons: false,
        showCost: false,
        hideUnavailable: false,
      }),
      plainCtx(),
    );
    expect(out).toContain('5h --');
    expect(out).toContain('Week --');
  });

  it('hides not-yet-loaded rate windows by default (hideUnavailable)', () => {
    const out = render(
      model({ fiveHour: null, weekly: null }),
      config({ theme: 'compact', useColors: false, useIcons: false }),
      plainCtx(),
    );
    // No "--" placeholder or 5h/Week labels while the data is still loading.
    expect(out).not.toContain('5h');
    expect(out).not.toContain('Week');
    expect(out).not.toContain('--');
    // The available segments still render.
    expect(out).toContain('Ctx 41%');
  });

  it('honors show toggles', () => {
    const out = render(
      model(),
      config({
        theme: 'compact',
        useColors: false,
        showModel: false,
        showBranch: false,
        showCost: false,
      }),
      plainCtx(),
    );
    expect(out).not.toContain('Opus');
    expect(out).not.toContain('feature/auth');
    expect(out).toBe('Ctx 41% | 5h 28% | Week 13%');
  });

  it('adds opt-in lines, session-time, and burn-rate segments', () => {
    const out = render(
      model(),
      config({
        theme: 'compact',
        useColors: false,
        showLines: true,
        showSessionTime: true,
        showBurnRate: true,
      }),
      plainCtx(),
    );
    expect(out).toContain('+124 −18'); // lines added/removed
    expect(out).toContain('2m 13s'); // session time from 133000ms
    expect(out).toContain('/h'); // burn rate
  });

  it('omits new segments by default', () => {
    const out = render(model(), config({ theme: 'compact', useColors: false }), plainCtx());
    expect(out).not.toContain('−18');
    expect(out).not.toContain('/h');
    expect(out).not.toContain('acme/flux');
    expect(out).not.toContain('tok');
  });

  it('adds opt-in repo, tokens, and version segments', () => {
    const out = render(
      model(),
      config({
        theme: 'compact',
        useColors: false,
        showRepo: true,
        showTokens: true,
        showVersion: true,
      }),
      plainCtx(),
    );
    expect(out).toContain('acme/flux'); // repo
    expect(out).toContain('45.2k tok'); // context tokens
    expect(out).toContain('v2.1.90'); // Claude Code version
  });

  it('adds git-dirty, output-style, and effort segments', () => {
    const out = render(
      model({ gitDirty: 3, outputStyle: 'Explanatory', effort: 'high' }),
      config({
        theme: 'compact',
        useColors: false,
        showGitDirty: true,
        showOutputStyle: true,
        showEffort: true,
      }),
      plainCtx(),
    );
    expect(out).toContain('±3');
    expect(out).toContain('Explanatory');
    expect(out).toContain('high');
  });

  it('hides the git-dirty segment on a clean tree', () => {
    const out = render(
      model({ gitDirty: 0 }),
      config({ theme: 'compact', useColors: false, showGitDirty: true }),
      plainCtx(),
    );
    expect(out).not.toContain('±');
  });
});

describe('render: 5-hour reset info', () => {
  // The clock fragment is timezone-dependent, so match its shape, not a value.
  const RESET_INFO = /resets \d{1,2}:\d{2}(am|pm) \(2h 13m left\)/;

  it('appends reset time and time left once usage crosses 50%', () => {
    const out = render(
      model({ fiveHour: 61 }),
      config({ theme: 'compact', useColors: false, useIcons: false }),
      plainCtx(),
    );
    expect(out).toMatch(/5h 61% resets \d{1,2}:\d{2}(am|pm) \(2h 13m left\)/);
  });

  it('stays hidden at or below the threshold', () => {
    const out = render(
      model({ fiveHour: 50 }),
      config({ theme: 'compact', useColors: false, useIcons: false }),
      plainCtx(),
    );
    expect(out).not.toContain('resets');
  });

  it('honors a custom countdownAfterPercent', () => {
    const out = render(
      model({ fiveHour: 28 }),
      config({ theme: 'compact', useColors: false, useIcons: false, countdownAfterPercent: 20 }),
      plainCtx(),
    );
    expect(out).toMatch(RESET_INFO);
  });

  it('respects showCountdown: false', () => {
    const out = render(
      model({ fiveHour: 61 }),
      config({ theme: 'compact', useColors: false, useIcons: false, showCountdown: false }),
      plainCtx(),
    );
    expect(out).not.toContain('resets');
  });

  it('omits the info when the reset timestamp is unavailable', () => {
    const out = render(
      model({ fiveHour: 61, fiveHourResetAt: null }),
      config({ theme: 'compact', useColors: false, useIcons: false }),
      plainCtx(),
    );
    expect(out).toContain('5h 61%');
    expect(out).not.toContain('resets');
  });

  it('renders in minimal, nerd-font, powerline, and plain-text too', () => {
    for (const theme of ['minimal', 'nerd-font', 'powerline', 'plain-text'] as const) {
      const out = render(
        model({ fiveHour: 61 }),
        config({ theme, useColors: false, useIcons: false }),
        plainCtx(),
      );
      expect(out).toMatch(RESET_INFO);
    }
  });
});

describe('render: minimal', () => {
  it('uses the thin separator', () => {
    const out = render(
      model(),
      config({
        theme: 'minimal',
        useColors: false,
        showBranch: false,
        showContext: false,
        showCost: false,
      }),
      plainCtx(),
    );
    expect(out).toBe('Opus 4 │ 5h 28% │ Week 13%');
  });
});

describe('render: plain-text', () => {
  it('never emits ANSI even when a colored context is passed', () => {
    const out = render(model(), config({ theme: 'plain-text' }), colorCtx());
    expect(out).not.toContain(ESC);
    expect(out).toContain('Ctx 41% [');
    expect(out).toContain('#');
  });
});

describe('render: powerline', () => {
  it('includes the powerline separator when colored', () => {
    const out = render(model(), config({ theme: 'powerline' }), colorCtx());
    expect(out).toContain(String.fromCodePoint(0xe0b0));
    expect(out).toContain(ESC);
  });

  it('degrades to plain segments without color', () => {
    const out = render(model(), config({ theme: 'powerline', useColors: false }), plainCtx());
    expect(out).not.toContain(ESC);
    expect(out).toContain('CTX 41%');
  });
});

describe('render: nerd-font', () => {
  it('renders values and falls back to ASCII labels without icons', () => {
    const out = render(
      model(),
      config({ theme: 'nerd-font', useColors: false, useIcons: false }),
      plainCtx(),
    );
    expect(out).toContain('ctx 41%');
    expect(out).toContain('5h 28%');
    expect(out).toContain('7d 13%');
  });
});

describe('render: warnings and fallback', () => {
  it('adds a warning badge past the warn threshold', () => {
    const out = render(
      model({ context: 95 }),
      config({ theme: 'compact', useColors: true, useIcons: true }),
      colorCtx(),
    );
    expect(out).toContain('⚠');
  });

  it('falls back to the model name when every segment is hidden', () => {
    const out = render(
      model(),
      config({
        theme: 'compact',
        useColors: false,
        showModel: false,
        showBranch: false,
        showContext: false,
        showFiveHour: false,
        showWeekly: false,
        showCost: false,
        showWorkingDirectory: false,
      }),
      plainCtx(),
    );
    expect(out).toBe('Opus 4');
  });

  it('falls back to missingText for a completely empty model', () => {
    const empty: StatusModel = {
      modelName: null,
      branch: null,
      cwdName: null,
      cwdPath: null,
      context: null,
      fiveHour: null,
      weekly: null,
      fiveHourResetAt: null,
      weeklyResetAt: null,
      cost: null,
      linesAdded: null,
      linesRemoved: null,
      durationMs: null,
      version: null,
      sessionName: null,
      contextWindowSize: null,
      repo: null,
      contextTokens: null,
      outputStyle: null,
      effort: null,
      gitDirty: null,
    };
    const themes: Theme[] = ['compact', 'minimal', 'powerline', 'nerd-font', 'plain-text'];
    for (const theme of themes) {
      const out = render(empty, config({ theme, useColors: false }), plainCtx());
      // Never blank (a blank line hides the row); always at least the missing marker.
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
