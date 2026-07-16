import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, loadConfig, mergeConfig } from '../src/config';

describe('mergeConfig', () => {
  it('returns defaults for an empty object', () => {
    expect(mergeConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('returns defaults for non-object input', () => {
    expect(mergeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(mergeConfig('nope')).toEqual(DEFAULT_CONFIG);
    expect(mergeConfig([1, 2, 3])).toEqual(DEFAULT_CONFIG);
  });

  it('does not mutate DEFAULT_CONFIG', () => {
    const merged = mergeConfig({ progressWidth: 20 });
    expect(merged.progressWidth).toBe(20);
    expect(DEFAULT_CONFIG.progressWidth).toBe(12);
  });

  it('applies valid boolean overrides', () => {
    const cfg = mergeConfig({ showCost: false, showWorkingDirectory: true });
    expect(cfg.showCost).toBe(false);
    expect(cfg.showWorkingDirectory).toBe(true);
  });

  it('ignores wrongly-typed fields', () => {
    const cfg = mergeConfig({ showModel: 'yes', progressWidth: 'wide', useColors: 1 });
    expect(cfg.showModel).toBe(true);
    expect(cfg.progressWidth).toBe(12);
    expect(cfg.useColors).toBe(true);
  });

  it('clamps refreshSeconds to a minimum of 1', () => {
    expect(mergeConfig({ refreshSeconds: 0 }).refreshSeconds).toBe(1);
    expect(mergeConfig({ refreshSeconds: -5 }).refreshSeconds).toBe(1);
    expect(mergeConfig({ refreshSeconds: 45 }).refreshSeconds).toBe(45);
  });

  it('clamps progressWidth to [1, 60]', () => {
    expect(mergeConfig({ progressWidth: 0 }).progressWidth).toBe(1);
    expect(mergeConfig({ progressWidth: 999 }).progressWidth).toBe(60);
  });

  it('treats layout as a theme alias when theme is absent', () => {
    expect(mergeConfig({ layout: 'compact' }).theme).toBe('compact');
  });

  it('lets an explicit theme win over layout', () => {
    const cfg = mergeConfig({ layout: 'compact', theme: 'minimal' });
    expect(cfg.theme).toBe('minimal');
    expect(cfg.layout).toBe('compact');
  });

  it('ignores an unknown theme', () => {
    expect(mergeConfig({ theme: 'rainbow' }).theme).toBe(DEFAULT_CONFIG.theme);
  });

  it('merges nested thresholds partially', () => {
    const cfg = mergeConfig({ colorThresholds: { orange: 75 } });
    expect(cfg.colorThresholds).toEqual({ yellow: 60, orange: 75, red: 90 });
  });
});

describe('loadConfig', () => {
  const created: string[] = [];
  afterEach(() => {
    delete process.env.FLUX_CODE_CONFIG;
    for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('reads config from the FLUX_CODE_CONFIG path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cum-cfg-'));
    created.push(dir);
    const file = join(dir, 'flux-code.json');
    writeFileSync(file, JSON.stringify({ theme: 'compact', progressWidth: 8 }));
    process.env.FLUX_CODE_CONFIG = file;

    const cfg = loadConfig();
    expect(cfg.theme).toBe('compact');
    expect(cfg.progressWidth).toBe(8);
  });

  it('falls back to defaults when the file is missing', () => {
    process.env.FLUX_CODE_CONFIG = join(tmpdir(), 'does-not-exist-xyz.json');
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('falls back to defaults when the file is malformed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cum-cfg-'));
    created.push(dir);
    const file = join(dir, 'flux-code.json');
    writeFileSync(file, '{ not valid json');
    process.env.FLUX_CODE_CONFIG = file;
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });
});
