import { describe, expect, it } from 'vitest';
import { bg256ForPercent, colorForPercent, createAnsi } from '../src/colors';
import { DEFAULT_CONFIG } from '../src/config';

const TH = DEFAULT_CONFIG.colorThresholds; // { yellow: 60, orange: 80, red: 90 }
const ESC = String.fromCharCode(27);

describe('createAnsi', () => {
  it('returns text unchanged when disabled', () => {
    const ansi = createAnsi(false);
    expect(ansi.red('hi')).toBe('hi');
    expect(ansi.bold('hi')).toBe('hi');
    expect(ansi.seq(31)).toBe('');
    expect(ansi.reset()).toBe('');
  });

  it('wraps text in SGR codes when enabled', () => {
    const ansi = createAnsi(true);
    const red = ansi.red('hi');
    expect(red).toContain(`${ESC}[31m`);
    expect(red).toContain('hi');
    expect(red).toContain(`${ESC}[0m`);
  });

  it('encodes 256-color orange', () => {
    expect(createAnsi(true).orange('x')).toContain(`${ESC}[38;5;208m`);
  });
});

describe('colorForPercent', () => {
  const ansi = createAnsi(true);
  const codeOf = (pct: number | null): string => colorForPercent(ansi, pct, TH)('x');

  it('is green below the yellow threshold', () => {
    expect(codeOf(59)).toContain(`${ESC}[32m`);
  });

  it('is yellow from 60 to below 80', () => {
    expect(codeOf(60)).toContain(`${ESC}[33m`);
    expect(codeOf(79)).toContain(`${ESC}[33m`);
  });

  it('is orange from 80 to below 90', () => {
    expect(codeOf(80)).toContain(`${ESC}[38;5;208m`);
    expect(codeOf(89)).toContain(`${ESC}[38;5;208m`);
  });

  it('is red at 90 and above', () => {
    expect(codeOf(90)).toContain(`${ESC}[31m`);
    expect(codeOf(100)).toContain(`${ESC}[31m`);
  });

  it('is gray for a null percentage', () => {
    expect(codeOf(null)).toContain(`${ESC}[90m`);
  });
});

describe('bg256ForPercent', () => {
  it('maps thresholds to background color codes', () => {
    expect(bg256ForPercent(10, TH)).toBe(34); // green
    expect(bg256ForPercent(65, TH)).toBe(220); // yellow
    expect(bg256ForPercent(85, TH)).toBe(208); // orange
    expect(bg256ForPercent(95, TH)).toBe(196); // red
    expect(bg256ForPercent(null, TH)).toBe(240); // gray
  });
});
