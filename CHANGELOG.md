# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-07-17

### Added

- **Three new opt-in segments** (all default off): `showLines` (lines added/removed,
  `+124 −18`), `showSessionTime` (elapsed session time), and `showBurnRate`
  (spend rate in USD per hour). All derived from existing `cost.*` payload
  fields. Rendered across every theme.
- **Usage notifications** (`notify`, default off): a desktop notification fires
  when the 5-hour or weekly usage first crosses a `notifyThresholds` level
  (default `[90]`). Deduplicated per session, re-arms when a window rolls over,
  and optionally rings the terminal bell (`notifyBell`). macOS uses `osascript`,
  Linux uses `notify-send`; failures are silent and never affect the status line.
- `doctor` now reports the notification configuration.

### Changed

- Release automation: a GitHub Actions workflow verifies the committed `dist/`
  is fresh and that versions match the tag, then publishes the GitHub release on
  every `v*` tag push.

## [1.1.0] - 2026-07-17

### Changed

- The default theme is now `compact` (single line) instead of the multi-line
  `default` dashboard.

### Added

- `hideUnavailable` config option (default `true`): the 5-hour and weekly
  segments are hidden until their data loads instead of showing a `--`
  placeholder, so a fresh session no longer flickers a "loading" state. Set it
  to `false` to restore the previous `--` behavior.

## [1.0.0] - 2026-07-16

### Added

- Status line renderer built on the official Claude Code Status Line JSON
  payload: `model`, `workspace`, `context_window`, `rate_limits`, and `cost`.
- Six themes: `default`, `compact`, `minimal`, `powerline`, `nerd-font`, and
  `plain-text`.
- Color-coded progress bars with configurable width and optional eighth-block
  partial fills.
- Reset countdowns for the 5-hour and weekly windows, derived from
  `rate_limits.*.resets_at`.
- Threshold-based colors (green, yellow, orange, red) and escalating warning
  badges at 80%, 90%, and 95%, with an optional blink at the flash threshold.
- Git branch segment, derived with `git branch --show-current` and cached per
  session, since the branch is not a native Status Line field.
- Graceful handling of missing fields: unavailable values render as `--`
  instead of throwing.
- `install`, `uninstall`, `preview`, `doctor`, `version`, and `help`
  subcommands. `install` writes the `statusLine` block into `settings.json` and
  bridges `refreshSeconds` onto `refreshInterval`.
- Config file at `~/.claude/flux-code.json`, overridable with
  `FLUX_CODE_CONFIG`.
- Claude Code plugin manifest, single-plugin marketplace, and a
  `/flux-code` setup command.
- Vitest unit tests, ESLint, Prettier, and a GitHub Actions CI matrix
  (Node 18, 20, 22).

[Unreleased]: https://github.com/im-shubhamsharma/flux-code/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/im-shubhamsharma/flux-code/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/im-shubhamsharma/flux-code/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/im-shubhamsharma/flux-code/releases/tag/v1.0.0
