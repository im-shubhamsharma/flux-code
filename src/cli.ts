/**
 * Command-line subcommands (everything except the default status-line render).
 *
 * `install` writes the `statusLine` block into the user's Claude Code
 * settings.json. This is the ONLY supported way to enable a custom main status
 * line: per the official plugin reference, a plugin's settings.json may set
 * only `agent` and `subagentStatusLine`, never the main `statusLine`. `install`
 * also bridges our `refreshSeconds` config onto the API's `refreshInterval`.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, configPath, loadConfig } from './config';
import { produceStatusLine } from './statusline';
import type { StatusInput } from './types';

const SELF_PATH = fileURLToPath(import.meta.url);

function version(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readJson(path: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** The shell command Claude Code should run for the status line. */
function statusLineCommand(): string {
  if (process.platform === 'win32') {
    return `node "${SELF_PATH.replace(/\\/g, '/')}"`;
  }
  return `"${SELF_PATH}"`;
}

function settingsPath(scope: 'global' | 'project'): string {
  return scope === 'project'
    ? join(process.cwd(), '.claude', 'settings.json')
    : join(homedir(), '.claude', 'settings.json');
}

function runInstall(args: string[]): number {
  const scope: 'global' | 'project' = args.includes('--project') ? 'project' : 'global';
  const config = loadConfig();
  const settingsFile = settingsPath(scope);
  const settingsDir = dirname(settingsFile);

  mkdirSync(settingsDir, { recursive: true });

  const settings = readJson(settingsFile);
  if (existsSync(settingsFile)) {
    copyFileSync(settingsFile, `${settingsFile}.bak`);
  }

  settings.statusLine = {
    type: 'command',
    command: statusLineCommand(),
    refreshInterval: config.refreshSeconds,
  };

  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);

  // Seed a default config file so users have something to edit.
  const cfgPath = configPath();
  if (!existsSync(cfgPath)) {
    mkdirSync(dirname(cfgPath), { recursive: true });
    writeFileSync(cfgPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  }

  process.stdout.write(
    [
      'Flux Code installed.',
      '',
      `  settings : ${settingsFile}`,
      `  config   : ${cfgPath}`,
      `  refresh  : every ${config.refreshSeconds}s (statusLine.refreshInterval)`,
      '',
      'statusLine block written:',
      JSON.stringify(settings.statusLine, null, 2)
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n'),
      '',
      'Restart Claude Code (or send one message) to see the status line.',
      existsSync(`${settingsFile}.bak`) ? `A backup was saved to ${settingsFile}.bak` : '',
    ]
      .filter(Boolean)
      .join('\n') + '\n',
  );
  return 0;
}

function runUninstall(args: string[]): number {
  const scope: 'global' | 'project' = args.includes('--project') ? 'project' : 'global';
  const settingsFile = settingsPath(scope);
  if (!existsSync(settingsFile)) {
    process.stdout.write(`No settings file at ${settingsFile}; nothing to remove.\n`);
    return 0;
  }

  const settings = readJson(settingsFile);
  const statusLine = settings.statusLine as { command?: string } | undefined;
  const isOurs =
    typeof statusLine?.command === 'string' &&
    (statusLine.command.includes('flux-code') || statusLine.command.includes(SELF_PATH));

  if (!isOurs) {
    process.stdout.write('The configured statusLine is not Flux Code; leaving it untouched.\n');
    return 0;
  }

  copyFileSync(settingsFile, `${settingsFile}.bak`);
  delete settings.statusLine;
  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
  process.stdout.write(
    `Removed statusLine from ${settingsFile} (backup at ${settingsFile}.bak).\n`,
  );
  return 0;
}

function mockInput(kind: 'rich' | 'sparse'): StatusInput {
  const now = Math.floor(Date.now() / 1000);
  if (kind === 'sparse') {
    return {
      model: { id: 'claude-opus-4-8', display_name: 'Opus 4' },
      workspace: { current_dir: join(homedir(), 'code', 'flux') },
      context_window: { used_percentage: 12, context_window_size: 200000 },
      // No rate_limits (e.g. API-key user or before first response) and no cost.
    };
  }
  return {
    model: { id: 'claude-opus-4-8', display_name: 'Opus 4' },
    workspace: { current_dir: join(homedir(), 'code', 'flux') },
    context_window: { used_percentage: 82, context_window_size: 200000 },
    cost: { total_cost_usd: 0.1234, total_duration_ms: 133000 },
    rate_limits: {
      five_hour: { used_percentage: 61, resets_at: now + 2 * 3600 + 13 * 60 },
      seven_day: { used_percentage: 19, resets_at: now + 5 * 86400 },
    },
  };
}

const PREVIEW_THEMES = [
  'default',
  'compact',
  'minimal',
  'powerline',
  'nerd-font',
  'plain-text',
] as const;

function runPreview(args: string[]): number {
  const requested = args.find((a) => !a.startsWith('-'));
  const themes = requested ? [requested] : PREVIEW_THEMES;
  const base = loadConfig();
  // A synthetic branch so the preview is stable and does not shell out to git.
  const branchName = 'feature/request-flow';

  for (const theme of themes) {
    if (!(PREVIEW_THEMES as readonly string[]).includes(theme)) {
      process.stderr.write(`Unknown theme "${theme}". Options: ${PREVIEW_THEMES.join(', ')}\n`);
      return 1;
    }
    const config = { ...base, theme: theme as (typeof PREVIEW_THEMES)[number], showBranch: true };
    process.stdout.write(`\n=== ${theme} ===\n`);
    // Render with a fixed model by injecting the branch through the payload's worktree field.
    const input = mockInput('rich');
    input.worktree = { branch: branchName };
    process.stdout.write(produceStatusLine(input, config) + '\n');
  }
  process.stdout.write('\n');
  return 0;
}

function runDoctor(): number {
  const config = loadConfig();
  const globalSettings = settingsPath('global');
  const settings = readJson(globalSettings);
  const statusLine = settings.statusLine as { command?: string } | undefined;
  const lines: string[] = [
    `Flux Code v${version()}`,
    '',
    `Config file      : ${configPath()}`,
    `Settings file    : ${globalSettings}`,
    `statusLine set   : ${statusLine ? 'yes' : 'no'}`,
    `statusLine cmd   : ${statusLine?.command ?? '(none)'}`,
    `Resolved theme   : ${config.theme}`,
    `Progress width   : ${config.progressWidth}`,
    `Colors           : ${config.useColors ? 'on' : 'off'}`,
    `Node             : ${process.version}`,
    '',
    'Sample render (rich payload):',
    produceStatusLine(mockInput('rich'), config)
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n'),
    '',
    'Sample render (sparse payload, no rate_limits/cost):',
    produceStatusLine(mockInput('sparse'), config)
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n'),
  ];
  process.stdout.write(lines.join('\n') + '\n');
  return 0;
}

function runHelp(): number {
  process.stdout.write(
    `flux-code v${version()}
A live Claude Code status line: model, git branch, context window, 5-hour and
weekly usage, reset countdowns, and session cost.

USAGE
  flux-code                 Render a status line from JSON on stdin
                                       (this is what Claude Code invokes).
  flux-code install         Wire the status line into settings.json.
  flux-code install --project  Write to ./.claude/settings.json.
  flux-code uninstall       Remove the status line from settings.json.
  flux-code preview [theme] Preview one or all themes.
  flux-code doctor          Print resolved config and sample output.
  flux-code version         Print the version.
  flux-code help            Show this help.

CONFIG
  ~/.claude/flux-code.json  (override with FLUX_CODE_CONFIG)

THEMES
  default, compact, minimal, powerline, nerd-font, plain-text
`,
  );
  return 0;
}

/** Dispatch a subcommand. Returns a process exit code. */
export function runCli(command: string, args: string[]): number {
  switch (command) {
    case 'install':
      return runInstall(args);
    case 'uninstall':
      return runUninstall(args);
    case 'preview':
      return runPreview(args);
    case 'doctor':
      return runDoctor();
    case 'version':
    case '--version':
    case '-v':
      process.stdout.write(`${version()}\n`);
      return 0;
    case 'help':
    case '--help':
    case '-h':
    default:
      return runHelp();
  }
}
