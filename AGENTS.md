# AGENTS.md

## Repository Defaults

- Always use `bun` for package management, scripts, installs, and one-off commands in this repository.
- Do not use `npm`, `yarn`, or `pnpm` unless the user explicitly asks for one of them.
- Prefer Bun equivalents:
  - `bun install`
  - `bun add <pkg>`
  - `bun remove <pkg>`
  - `bun run <script>`
  - `bun x <command>`

## Command Guidance

- When the repo needs dependencies installed, use `bun install`.
- When running project scripts, use `bun run <script>`.
- When invoking local CLIs, prefer `bun x <tool>` if a direct `bun run` script is not available.
- When suggesting commands to the user, default to Bun-based commands.

## Project Intent

This repository is Bun-first. Any agent working in this repo should assume Bun is the standard runtime and package manager unless the user says otherwise.

## UI / UX Defaults

- Prioritize compact, information-dense overview screens over large hero/marketing-style layouts.
- Optimize for quick scanning: small cards, tight spacing, concise labels, and multiple useful data points visible without scrolling.
- In game-assistant views, put actionable gameplay information first (builds, runes, spells, stats, confidence/sample source) and keep explanatory text minimal.
- Avoid oversized typography or imagery unless the user explicitly asks for a presentation-style page.
- Avoid overusing separate card containers; group related data into fewer panels with subtle internal dividers/spacing.
- Center text and key content inside small overview cards unless a list/table layout clearly benefits from left alignment.