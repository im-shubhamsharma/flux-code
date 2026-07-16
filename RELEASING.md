# Releasing

Flux Code is distributed as a self-contained Claude Code plugin from this
GitHub repo. There is no npm publish step: the built `dist/` is committed so the
plugin works with no build. The `package.json` version and the plugin manifest
version must match, because Claude Code pins plugin updates to `plugin.json`.

## Steps

1. Make sure the working tree is clean and CI is green on `main`.

2. Run the full local check and rebuild the bundled script:

   ```bash
   npm ci
   npm run format:check
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

3. Bump the version in three places so they stay in sync:
   - `package.json` `version`
   - `.claude-plugin/plugin.json` `version`
   - a new dated section in `CHANGELOG.md`

4. Commit the version bump **together with the rebuilt `dist/`** so installed
   plugins pick up the new code:

   ```bash
   git add dist package.json .claude-plugin/plugin.json CHANGELOG.md
   git commit -m "Release v<version>"
   ```

5. Tag and push, then create the GitHub release:

   ```bash
   git tag "v$(node -p "require('./package.json').version")"
   git push --follow-tags
   gh release create "v$(node -p "require('./package.json').version")" \
     --title "v$(node -p "require('./package.json').version")" \
     --notes "See CHANGELOG.md"
   ```

Users update with `/plugin marketplace update flux-code`.

## Plugin version behavior

Claude Code pins the plugin to the `version` in `plugin.json`. Users receive an
update only when you bump that field, so it must move with every release. If you
leave `version` unset, Claude Code falls back to the git commit SHA and treats
every commit as a new version. This project sets `version` explicitly, so keep
it in step with `package.json`.

## The bundled build

The committed `dist/index.js` is a single bundled file with a
`#!/usr/bin/env node` shebang and no runtime dependencies. Always rebuild it
(`npm run build`) and commit the result whenever you change anything under
`src/`, or installed plugins will run stale code.

## Optional: publishing to npm

The package is npm-ready (`bin`, `files`, and `publishConfig` are set) if you
ever want a global `npm install -g flux-code` path in addition to the plugin.
Log in with `npm whoami`, then `npm publish` — `prepublishOnly` rebuilds `dist/`
first. This is not required for the plugin to work.
