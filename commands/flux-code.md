---
description: Set up, preview, or update the Flux Code status line
---

Help me configure the **Flux Code** status line for Claude Code.

This plugin ships a pre-built copy of the tool, so nothing needs to be installed from npm.

Do this:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" install`. This writes a `statusLine` block into my `~/.claude/settings.json` (pointing at this plugin's bundled script by absolute path) and seeds a default `~/.claude/flux-code.json`. It also saves a `.bak` of my current settings.
2. Show me a preview of every theme with `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" preview`.
3. Tell me to restart Claude Code (or send one message) for the status line to appear, and point me at `~/.claude/flux-code.json` so I can change the theme, layout, colors, progress width, and which segments show.

If a global `flux-code` binary is already on PATH (e.g. from `npm link`), you may run `flux-code install` / `flux-code preview` instead.

Constraints: only edit `settings.json` and the flux-code config file. Do not touch any database, and do not delete anything without asking.
