# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/im-shubhamsharma/flux-code/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/im-shubhamsharma/flux-code/releases/tag/v1.0.0
