---
description: Set up, preview, or update the Flux Code status line
---

Help me configure the **Flux Code** status line for Claude Code.

Do this:

1. Check whether the CLI is on PATH: run `command -v flux-code`.
2. If it is not installed, install it globally with `npm install -g flux-code`. Ask me first if I use a different package manager.
   - If this plugin ships a built copy, you can instead run `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" install`.
3. Run `flux-code install`. This writes a `statusLine` block into my `~/.claude/settings.json` and seeds a default `~/.claude/flux-code.json`. It also saves a `.bak` of my current settings.
4. Show me a preview of every theme with `flux-code preview`.
5. Tell me to restart Claude Code (or send one message) for the status line to appear, and point me at `~/.claude/flux-code.json` so I can change the theme, layout, colors, progress width, and which segments show.

Constraints: only edit `settings.json` and the flux-code config file. Do not touch any database, and do not delete anything without asking.
