# Releasing

This project publishes to npm and tags a GitHub release. Both the npm package
version and the plugin manifest version must match.

## Before you start

- Replace every `im-shubhamsharma` placeholder with the real GitHub owner in:
  `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `README.md`, and `CHANGELOG.md`.
- Confirm you are logged in to npm: `npm whoami`.

## Steps

1. Make sure the working tree is clean and CI is green on `main`.

2. Run the full local check:

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

   `npm version <patch|minor|major>` updates `package.json` and creates a git
   tag. Update `plugin.json` and `CHANGELOG.md` by hand to match, or amend the
   version commit before pushing.

4. Publish to npm. `prepublishOnly` runs the build, so `dist/` is always fresh:

   ```bash
   npm publish
   ```

5. Push the tag and create the GitHub release:

   ```bash
   git push --follow-tags
   gh release create "v$(node -p "require('./package.json').version")" \
     --title "v$(node -p "require('./package.json').version")" \
     --notes "See CHANGELOG.md"
   ```

## Plugin version behavior

Claude Code pins the plugin to the `version` in `plugin.json`. Users receive an
update only when you bump that field, so it must move with every release. If you
leave `version` unset, Claude Code falls back to the git commit SHA and treats
every commit as a new version. This project sets `version` explicitly, so keep
it in step with `package.json`.

## What gets published

The npm tarball ships only what the `files` field lists: `dist/`, `README.md`,
`LICENSE`, `CHANGELOG.md`, and `flux-code.example.json`. The built
`dist/index.js` is a single bundled file with a `#!/usr/bin/env node` shebang
and no runtime dependencies.
