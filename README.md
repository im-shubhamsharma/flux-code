# Flux Code

A live status line for [Claude Code](https://code.claude.com) that shows your model, git branch, context window usage, 5-hour and weekly rate limits, reset countdowns, and session cost. It reads the official Status Line JSON payload on stdin and prints a formatted line. No polling, no `/usage` scraping, no undocumented APIs.

**📖 [Website &amp; docs → im-shubhamsharma.github.io/flux-code](https://im-shubhamsharma.github.io/flux-code/)**

[![CI](https://github.com/im-shubhamsharma/flux-code/actions/workflows/ci.yml/badge.svg)](https://github.com/im-shubhamsharma/flux-code/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

---

## What it shows

- Model name (bold)
- Git branch (blue)
- Context window usage with color-coded percentages
- 5-hour usage window — once it passes 50%, the segment also shows **how much time is left**, e.g. `5h 61% 2h 13m left`
- Weekly (7-day) usage window
- Session cost in USD
- Working directory (optional)

Every value comes from a field Claude Code documents. When a value is not yet available, the 5-hour, weekly, and cost segments are hidden until they load (set `hideUnavailable: false` to show them as `--` instead). Nothing ever fails on missing data.

## Preview

Every theme is a single line — the status line row in Claude Code is one row tall, so the tool never wastes vertical space. (The old multi-line `default` dashboard theme was removed in v1.4.0; configs that still name it fall back to `compact`.)

Compact theme — **the default**:

```text
Opus 4 | feature/auth | Ctx 41% | 5h 28% | Week 13% | $0.12
```

Once the 5-hour window passes 50%, its segment gains the time left, so you always know how long you have to manage your work:

```text
Opus 4 | feature/auth | Ctx 41% | 5h 61% 2h 13m left | Week 13% | $0.12
```

On a fresh session, before Claude Code reports your rate limits, the 5-hour, weekly, and cost segments are simply omitted (no `--` placeholder) and appear once the data loads:

```text
Opus 4 | main | Ctx 12%
```

Minimal theme:

```text
Opus 4 │ 5h 24% │ Week 11%
```

Plain-text theme (ASCII only, no color, safe for tmux, CI, and logs):

```text
Opus 4 | feature/auth | Ctx 82% [##########--] | 5h 61% | Week 19% | $0.12
```

`powerline` and `nerd-font` themes are also included. Run `flux-code preview` to see all five in your own terminal with color.

## How it reads your usage (and what the API supports)

This project is built only on fields in the official [Status Line reference](https://code.claude.com/docs/en/statusline). Here is exactly where each value comes from:

| What you see      | Source field                            | Native? | Notes                                            |
| ----------------- | --------------------------------------- | ------- | ------------------------------------------------ |
| Model             | `model.display_name`                    | Yes     |                                                  |
| Context usage     | `context_window.used_percentage`        | Yes     | Pre-calculated by Claude Code, input tokens only |
| 5-hour usage      | `rate_limits.five_hour.used_percentage` | Yes     | See availability note below                      |
| 5-hour reset      | `rate_limits.five_hour.resets_at`       | Yes     | Unix epoch seconds, rendered as a countdown      |
| Weekly usage      | `rate_limits.seven_day.used_percentage` | Yes     | The API calls this the 7-day window              |
| Weekly reset      | `rate_limits.seven_day.resets_at`       | Yes     |                                                  |
| Session cost      | `cost.total_cost_usd`                   | Yes     | Client-side estimate, resets on `/clear`         |
| Working directory | `workspace.current_dir`                 | Yes     |                                                  |
| Git branch        | (derived)                               | No      | See the note below                               |

Three limitations are worth knowing up front. None of them are worked around with hidden APIs.

1. **Git branch is not a Status Line field.** Claude Code sends `workspace.repo` (host, owner, name) and `worktree.branch` (only during `--worktree` sessions), but not the checked-out branch of a normal repo. This tool derives it by running `git branch --show-current`, the same approach the official examples use. The result is cached to a temp file keyed by `session_id` for 3 seconds so large repositories do not slow the status line.

2. **`rate_limits` appears only for Claude.ai Pro and Max subscribers, and only after the first API response.** Each window can be absent on its own. By default (`hideUnavailable: true`) a missing 5h or Week segment is hidden until it loads, so a fresh session shows no `--` flicker; set `hideUnavailable: false` to show `--` instead. If you sign in with an API key rather than a subscription, these fields never appear, so the segments simply stay hidden.

3. **A plugin cannot set the main status line.** The plugin reference states that a plugin's `settings.json` may set only `agent` and `subagentStatusLine`. So the main `statusLine` has to live in your own settings. The `flux-code install` command writes it there for you, and bridges your `refreshSeconds` config onto the API's `refreshInterval`.

## Requirements

- Node.js 18 or newer
- Claude Code 2.x (the `rate_limits` and `context_window` fields require a recent version)
- `git` on your PATH if you want the branch segment

## Install

### Option A: Claude Code plugin (recommended)

This repo is a self-contained Claude Code plugin: it ships a pre-built copy of the tool, so there is nothing to compile and no npm package to install. Inside Claude Code, run:

```text
/plugin marketplace add im-shubhamsharma/flux-code
/plugin install flux-code@flux-code
/flux-code
```

- `/plugin marketplace add …` registers this GitHub repo as a plugin marketplace.
- `/plugin install flux-code@flux-code` installs the plugin (`flux-code` is both the plugin name and the marketplace name).
- `/flux-code` runs the setup: it writes a `statusLine` block into `~/.claude/settings.json` (pointing at the plugin's bundled script by absolute path), backs up the previous file to `settings.json.bak`, and seeds a default `~/.claude/flux-code.json` you can edit.

Because a plugin cannot set the main status line itself (see limitation 3 above), the `/flux-code` command runs the installer for you. Restart Claude Code or send one message to see the status line.

To update later, run `/plugin marketplace update flux-code` and re-run `/flux-code`.

### Option B: From source (for development or manual setup)

Clone, build, and either link a global `flux-code` binary or run the installer directly:

```bash
git clone https://github.com/im-shubhamsharma/flux-code.git
cd flux-code
npm install
npm run build

# either link a global binary…
npm link
flux-code install

# …or run the built script directly without linking:
node dist/index.js install
```

`install` writes a `statusLine` block into `~/.claude/settings.json`, backs up the previous file to `settings.json.bak`, and seeds a default `~/.claude/flux-code.json`.

To scope it to a single project instead of your whole account:

```bash
flux-code install --project   # writes ./.claude/settings.json
```

### Option C: Manual settings.json

If you would rather wire it yourself, point `command` at the built script (use the absolute path to your checkout's `dist/index.js`) and add this to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/absolute/path/to/flux-code/dist/index.js",
    "refreshInterval": 30
  }
}
```

`refreshInterval` re-runs the command every N seconds so the reset countdowns tick while the session is idle. The minimum is 1. If you linked a global binary, you can use the plain name `flux-code` as the command instead.

### Per-platform notes

- **macOS and Linux**: the bundled `dist/index.js` is executable and starts with a `#!/usr/bin/env node` shebang, so the `install` command can point at it directly.
- **Windows**: Claude Code runs status line commands through Git Bash when it is installed, otherwise PowerShell. `install` writes the command as `node "C:/…/dist/index.js"` with forward slashes automatically.
- **nvm / fnm users**: if you installed a global binary via `npm link`, its path can change per Node version. If the status line goes blank after switching Node, re-run the installer (or `/flux-code`) to rewrite the absolute path. The plugin install path is unaffected because it points at the plugin's own bundled script.

## Configuration

Config lives at `~/.claude/flux-code.json`. Override the path with the `FLUX_CODE_CONFIG` environment variable. Every key is optional. Unknown or wrongly-typed keys are ignored, and a missing or malformed file falls back to defaults, so the status line never crashes on a bad config.

```json
{
  "layout": "compact",
  "theme": "compact",
  "showModel": true,
  "showBranch": true,
  "showContext": true,
  "showFiveHour": true,
  "showWeekly": true,
  "showCost": true,
  "showCountdown": true,
  "countdownAfterPercent": 50,
  "showWorkingDirectory": false,
  "hideUnavailable": true,
  "refreshSeconds": 30,
  "progressWidth": 12,
  "useColors": true,
  "useIcons": true,
  "flashOnCritical": true,
  "separator": " | ",
  "missingText": "--",
  "colorThresholds": { "yellow": 60, "orange": 80, "red": 90 },
  "warnThresholds": { "warn": 80, "danger": 90, "flash": 95 }
}
```

| Key                     | Type    | Default        | Meaning                                                                                                                                                                                                                                      |
| ----------------------- | ------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`                 | string  | `compact`      | One of the five themes below. Canonical selector.                                                                                                                                                                                            |
| `layout`                | string  | `compact`      | Alias for `compact` or `minimal`. Sets `theme` when `theme` is not given.                                                                                                                                                                    |
| `showModel`             | boolean | `true`         | Show the model name.                                                                                                                                                                                                                         |
| `showBranch`            | boolean | `true`         | Show the git branch. Set `false` to skip the git call entirely.                                                                                                                                                                              |
| `showContext`           | boolean | `true`         | Show context window usage.                                                                                                                                                                                                                   |
| `showFiveHour`          | boolean | `true`         | Show the 5-hour window.                                                                                                                                                                                                                      |
| `showWeekly`            | boolean | `true`         | Show the weekly window.                                                                                                                                                                                                                      |
| `showCost`              | boolean | `true`         | Show session cost when available.                                                                                                                                                                                                            |
| `showCountdown`         | boolean | `true`         | Show the 5-hour reset details once usage crosses `countdownAfterPercent`.                                                                                                                                                                    |
| `countdownAfterPercent` | number  | `50`           | 5-hour usage percentage above which the segment appends the time left, e.g. `2h 13m left`. `0` always shows it; `100` never does.                                                                                                            |
| `showWorkingDirectory`  | boolean | `false`        | Show the working directory.                                                                                                                                                                                                                  |
| `showLines`             | boolean | `false`        | Show lines added/removed this session (`+124 −18`), from `cost.total_lines_added/removed`.                                                                                                                                                   |
| `showSessionTime`       | boolean | `false`        | Show elapsed session time (`⏱ 2h 13m`), from `cost.total_duration_ms`.                                                                                                                                                                       |
| `showBurnRate`          | boolean | `false`        | Show spend rate in USD per hour (`$0.34/h`), from cost ÷ duration.                                                                                                                                                                           |
| `showRepo`              | boolean | `false`        | Show the repository as `owner/name` (`workspace.repo`).                                                                                                                                                                                      |
| `showTokens`            | boolean | `false`        | Show the context token count (`45.2k tok`), from `context_window.current_usage`.                                                                                                                                                             |
| `showVersion`           | boolean | `false`        | Show the Claude Code version (`v2.1.90`).                                                                                                                                                                                                    |
| `showOutputStyle`       | boolean | `false`        | Show the active output style (`output_style.name`).                                                                                                                                                                                          |
| `showEffort`            | boolean | `false`        | Show the thinking-effort level (`effort.level`).                                                                                                                                                                                             |
| `showGitDirty`          | boolean | `false`        | Show the count of uncommitted git changes (`±3`). Adds a `git status` call, cached per session.                                                                                                                                              |
| `hideUnavailable`       | boolean | `true`         | Hide the 5-hour and weekly segments until their data loads, instead of showing `--`. On a fresh session `rate_limits` only appears after the first API response; this avoids a "loading" flicker. Set `false` to always show them with `--`. |
| `notify`                | boolean | `false`        | Fire a desktop notification when 5-hour or weekly usage first crosses a `notifyThresholds` level. See [Usage notifications](#usage-notifications).                                                                                           |
| `notifyBell`            | boolean | `true`         | Also emit a terminal bell alongside a usage notification.                                                                                                                                                                                    |
| `notifyThresholds`      | array   | `[90]`         | Percent levels that trigger a notification, e.g. `[80, 95]`. Cleaned to whole numbers in 1–100.                                                                                                                                              |
| `refreshSeconds`        | number  | `30`           | Written to `statusLine.refreshInterval` by `install`. Minimum 1.                                                                                                                                                                             |
| `progressWidth`         | number  | `12`           | Progress bar width in characters. Clamped to 1-60.                                                                                                                                                                                           |
| `useColors`             | boolean | `true`         | ANSI colors. Also honors the `NO_COLOR` environment variable.                                                                                                                                                                                |
| `useIcons`              | boolean | `true`         | Emoji and Nerd Font glyphs.                                                                                                                                                                                                                  |
| `flashOnCritical`       | boolean | `true`         | Blink the warning icon past the flash threshold.                                                                                                                                                                                             |
| `separator`             | string  | `" \| "`       | Segment separator for the compact theme.                                                                                                                                                                                                     |
| `missingText`           | string  | `"--"`         | Text shown when a value is unavailable.                                                                                                                                                                                                      |
| `colorThresholds`       | object  | `60 / 80 / 90` | Percent boundaries for yellow, orange, and red.                                                                                                                                                                                              |
| `warnThresholds`        | object  | `80 / 90 / 95` | Percent boundaries for the warn, danger, and flash badges.                                                                                                                                                                                   |

## Extra segments

Several segments are available but off by default, so they don't lengthen the line unless you ask for them. Enable any of them in your config:

```json
{ "showLines": true, "showBurnRate": true, "showRepo": true, "showGitDirty": true }
```

Session activity (from the `cost.*` fields):

- **`showLines`** — lines added/removed this session, e.g. `+124 −18`.
- **`showSessionTime`** — elapsed session time, e.g. `2h 13m`.
- **`showBurnRate`** — spend rate in USD per hour, e.g. `$0.34/h` (needs at least ~30s of session time to extrapolate).

Context and repository:

- **`showRepo`** — the repository as `owner/name`, from `workspace.repo`.
- **`showTokens`** — tokens currently held in the context window, e.g. `45.2k tok`, from `context_window.current_usage`.
- **`showGitDirty`** — count of uncommitted changes, e.g. `±3` (hidden when the tree is clean). This runs `git status`, cached per session like the branch lookup.

Session metadata:

- **`showVersion`** — the Claude Code version, e.g. `v2.1.90`.
- **`showOutputStyle`** — the active output style, from `output_style.name`.
- **`showEffort`** — the thinking-effort level, from `effort.level`.

Every one of these comes from data Claude Code already provides (only `showGitDirty` adds a local `git` call) — no network, no scraping.

## Usage notifications

Get a desktop notification the moment your 5-hour or weekly usage crosses a threshold, so a rate limit never surprises you mid-task. It's off by default; enable it in your config:

```json
{ "notify": true, "notifyThresholds": [80, 95] }
```

- Fires once per threshold per window. Crossing 80% notifies; a later crossing of 95% notifies again; it won't re-notify on every refresh.
- Automatically re-arms when a window rolls over (its reset time changes), so each new 5-hour and weekly window can alert again.
- **macOS** uses `osascript`; **Linux** uses `notify-send` (install `libnotify` if missing). Other platforms fall back to the terminal bell only.
- `notifyBell` (default `true`) also rings the terminal bell. Set it `false` to stay silent.
- Notifications are best-effort and fully sandboxed: if the notifier is missing or fails, the status line renders exactly as normal.

## Themes

Set `theme` (or `layout`) to one of:

| Theme        | Shape                      | Best for                                 |
| ------------ | -------------------------- | ---------------------------------------- |
| `compact`    | One line, pipe-separated   | Keeping everything on one row            |
| `minimal`    | One line, thin separators  | Only the numbers that matter             |
| `powerline`  | One line, colored segments | Powerline or Nerd Font terminals         |
| `nerd-font`  | One line, glyph icons      | Nerd Font terminals                      |
| `plain-text` | ASCII only, no color       | tmux, CI logs, or terminals without ANSI |

All themes are single-line. The multi-line `default` dashboard was removed in v1.4.0 — it ate too much vertical space for a status line; a config that still says `"theme": "default"` falls back to `compact`.

## Progress bars

The `plain-text` theme renders an ASCII context bar whose width follows `progressWidth`:

```text
width 12, 82%   [##########--]
```

## Colors

Segment color follows usage against `colorThresholds`:

| Usage      | Color              |
| ---------- | ------------------ |
| 0 to 59%   | green              |
| 60 to 79%  | yellow             |
| 80 to 89%  | orange (256-color) |
| 90 to 100% | red                |

Reset countdowns are cyan, the model name is bold, and the branch is blue. Orange uses a 256-color code, which every modern terminal supports. Colors turn off when `useColors` is `false`, when the `NO_COLOR` environment variable is set, or when the theme is `plain-text`.

## Warnings

When a usage value crosses a `warnThresholds` boundary, a badge appears next to it:

- 80% and up: yellow warning icon
- 90% and up: red warning icon
- 95% and up: the icon blinks, if your terminal honors the ANSI blink code and `flashOnCritical` is on

## Commands

```text
flux-code                 Render a status line from JSON on stdin
flux-code install         Wire the status line into settings.json
flux-code install --project   Write to ./.claude/settings.json
flux-code uninstall       Remove the status line from settings.json
flux-code preview [theme] Preview one or all themes
flux-code doctor          Print resolved config and sample output
flux-code version         Print the version
flux-code help            Show help
```

Test it by hand with a mock payload:

```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"used_percentage":25},"session_id":"test"}' \
  | flux-code
```

## Customization examples

A quiet single-line setup with only the numbers:

```json
{ "theme": "minimal", "showBranch": false, "showContext": false }
```

Show the 5-hour reset time from the very first percent (or never):

```json
{ "countdownAfterPercent": 0 }
```

A monochrome line for a terminal without color:

```json
{ "theme": "plain-text" }
```

Warn earlier (yellow at 50%, red at 80%):

```json
{ "colorThresholds": { "yellow": 50, "orange": 70, "red": 80 } }
```

## Troubleshooting

- **The status line is blank.** Run `claude --debug` to see the exit code and stderr of the first invocation. Confirm the workspace trust dialog was accepted, since a status line command needs the same trust as hooks. Run `flux-code doctor` to print the resolved config and a sample render.
- **5h and Week never appear.** Rate limits appear only for Claude.ai Pro and Max subscribers, and only after the first API response of the session. API-key sign-ins do not get these fields, so with the default `hideUnavailable: true` the segments stay hidden. Set `hideUnavailable: false` if you would rather see them as `--`.
- **The branch is missing.** The directory must be a git repository, and `git` must be on PATH. Detached HEAD shows no branch. Set `showBranch: false` to hide the segment.
- **Countdowns do not tick while idle.** Set `refreshSeconds` (which `install` writes to `refreshInterval`) so the command re-runs on a timer.
- **Icons look like boxes.** The `nerd-font` and `powerline` themes need a Nerd Font. Switch to `compact` or `plain-text` if you do not have one.
- **Colors show as raw escape codes.** Your terminal may not support ANSI. Set `useColors: false` or use the `plain-text` theme.

## FAQ

**Does this call the `/usage` command or scrape anything?** No. It reads the `rate_limits` object that Claude Code already passes to the status line. There is no network call and no scraping.

**Does it cost API tokens?** No. The docs state the status line runs locally and does not consume API tokens.

**Why do the 5-hour and weekly numbers take a moment to appear when I first launch Claude Code?** Because the plugin does not fetch or calculate them — Claude Code hands them to the status line in its JSON payload (`rate_limits.five_hour` and `rate_limits.seven_day`), and it only fills those in **after the first API response of the session**. On a fresh launch, before your first request completes a round-trip, the fields are not in the payload yet, so there is nothing to show. They appear on the next render once your first message returns. The plugin itself renders instantly; nothing can make the data arrive sooner. This is also why `hideUnavailable` defaults to `true` — the segments stay hidden during that startup window instead of flashing `--`, then pop in when the data lands. (API-key sign-ins never receive `rate_limits`, so those segments stay hidden for the whole session.)

**Can the plugin set my status line automatically?** No, and no plugin can. Claude Code only lets a plugin ship `agent` and `subagentStatusLine` defaults. Use `flux-code install` to write the main `statusLine` into your settings.

**Why does cost reset when I run `/clear`?** That is Claude Code's behavior for `cost.total_cost_usd` since v2.1.211. This tool just displays the field.

**Weekly or 7-day?** Same window. The API field is `seven_day`. This tool labels it "Week" for brevity.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

The code is TypeScript, ESM, strict mode, with zero runtime dependencies. Modules:

| File                | Responsibility                               |
| ------------------- | -------------------------------------------- |
| `src/types.ts`      | Types for the Status Line payload and config |
| `src/config.ts`     | Load, validate, and merge config             |
| `src/colors.ts`     | ANSI palette and threshold coloring          |
| `src/progress.ts`   | Progress bar generation                      |
| `src/countdown.ts`  | Reset countdown and duration formatting      |
| `src/icons.ts`      | Emoji, Nerd Font, and Powerline glyph sets   |
| `src/utils.ts`      | stdin, JSON parsing, and git branch lookup   |
| `src/renderer.ts`   | Pure rendering for all five themes           |
| `src/statusline.ts` | Normalize a payload and render it            |
| `src/cli.ts`        | `install`, `uninstall`, `preview`, `doctor`  |
| `src/index.ts`      | Entry point                                  |

## License

MIT. See [LICENSE](./LICENSE).
