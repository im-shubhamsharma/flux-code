/**
 * Entry point.
 *
 * With a known subcommand as argv[2], run the CLI. Otherwise read the Status
 * Line JSON from stdin and print a single rendered status line. The render path
 * must NEVER throw or print to stderr in a way that blanks the row, so it is
 * wrapped defensively.
 */

import { runCli } from './cli';
import { loadConfig } from './config';
import { produceStatusLine } from './statusline';
import { readStdin, safeParseInput } from './utils';

const SUBCOMMANDS = new Set([
  'install',
  'uninstall',
  'preview',
  'doctor',
  'version',
  '--version',
  '-v',
  'help',
  '--help',
  '-h',
]);

function main(): void {
  const command = process.argv[2];

  if (command !== undefined && SUBCOMMANDS.has(command)) {
    process.exitCode = runCli(command, process.argv.slice(3));
    return;
  }

  // Status line mode.
  try {
    const input = safeParseInput(readStdin());
    const config = loadConfig();
    process.stdout.write(`${produceStatusLine(input, config)}\n`);
  } catch {
    // A blank line keeps the row present without surfacing an error.
    process.stdout.write('\n');
  }
}

main();
