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
    version: '2.1.90',
    sessionName: null,
    contextWindowSize: 200000,
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

  it('shows -- for a missing rate limit window', () => {
    const out = render(
      model({ fiveHour: null, weekly: null }),
      config({ theme: 'compact', useColors: false, useIcons: false, showCost: false }),
      plainCtx(),
    );
    expect(out).toContain('5h --');
    expect(out).toContain('Week --');
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
});

describe('render: default (multi-line)', () => {
  it('emits multiple rows including labels, percentage and countdown', () => {
    const out = render(
      model(),
      config({ theme: 'default', useColors: false, useIcons: false }),
      plainCtx(),
    );
    const lines = out.split('\n');
    expect(lines).toContain('Opus 4');
    expect(lines).toContain('feature/auth');
    expect(out).toContain('Context');
    expect(out).toContain('41%');
    expect(out).toContain('Resets in 2h 13m');
    expect(out).toContain('Resets in 5d 0h');
  });

  it('omits the countdown row when the reset is unavailable', () => {
    const out = render(
      model({ fiveHourResetAt: null, weeklyResetAt: null }),
      config({ theme: 'default', useColors: false, useIcons: false }),
      plainCtx(),
    );
    expect(out).not.toContain('Resets');
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
      version: null,
      sessionName: null,
      contextWindowSize: null,
    };
    const themes: Theme[] = [
      'default',
      'compact',
      'minimal',
      'powerline',
      'nerd-font',
      'plain-text',
    ];
    for (const theme of themes) {
      const out = render(empty, config({ theme, useColors: false }), plainCtx());
      // Never blank (a blank line hides the row); always at least the missing marker.
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
