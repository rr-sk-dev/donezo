# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # install dependencies
bun run dev          # dev server with HMR + browser console piped to the terminal
bun run start        # production mode (NODE_ENV=production, disables HMR)
bun test             # run tests
bun test <pattern>   # run tests matching a file/name pattern
bun test -t "name"   # run a single test by name
bunx tsc --noEmit    # typecheck (tsconfig is noEmit; there is no build step)
```

`PORT` overrides the default port 3000. The server binds `0.0.0.0` and prints a LAN URL in dev so the app can be opened from a phone on the same network.

There is no linter or formatter configured.

## Architecture

Donezo is a single-page todo app with **no backend state** — `index.ts` is only a static host, and all data lives in the browser's `localStorage` under the key `todos:v1`.

- `index.ts` — `Bun.serve()` with two routes: `/` (the HTML import) and `/health`. The `import index from './src/index.html'` line is what makes Bun bundle and transpile `app.ts` and `styles.css`; do not add a separate bundler or build step. The files under `src/` are bundler inputs — they are never served at their source paths.
- `src/index.html` — markup plus a `<template id="todo-template">` that defines a todo row. Row structure is authored here, not generated in JS.
- `src/app.ts` — the entire app. Vanilla TS, no framework, no dependencies.
- `src/styles.css` — CSS custom properties in `:root` are mobile-first defaults, overridden at `min-width: 480px` and `768px`. Change spacing/sizing by editing those tokens rather than individual rules. Class names are BEM (`todo__checkbox`, `card__title`).

### Conventions in `src/app.ts`

- **Template cloning, not innerHTML.** `createRow()` clones `#todo-template` and fills it. Adding a field to a row means editing the template in `index.html` and the corresponding lookup in `createRow()`.
- **Event delegation.** All handlers are bound to the `#todo-list` element (`click`, `change`, `keydown`, `focusout`), never to individual rows. Buttons are identified by `data-action` attributes; the owning row is resolved via `rowOf()` → `closest('.todo')` and the model via `todoOf()` → `row.dataset.id`.
- **`todos` is always partitioned: active first, done last.** Every mutation must preserve this. Completing sends a todo to the very bottom, un-completing sends it to index 0, and new todos are inserted at `doneStart()` rather than appended. `sortByDone()` in `load()` repairs older stored data. The DOM mirrors the array exactly, so array and node moves happen together.
- **Reordering uses Pointer Events, never the HTML5 drag API**, which does not fire on touch devices — the app is mobile-first, so that would kill the feature on phones. The pointer is captured on `list` (which never moves) rather than the handle, since capture is lost when a captured element is reinserted. `dropTarget()` clamps every drop to the active region, so a drag cannot land in the done group. During a drag the DOM leads and `commitOrder()` reconciles the array once on release — the one place that inverts the usual direction.
- **Motion is FLIP, via the Web Animations API.** `withFlip()` moves rows first, then animates each displaced row from where it was to where it landed; `slide()` plays that travel. Rows are measured *with* any in-flight animation applied so an interrupted slide continues smoothly, and each is cancelled before its post-move measurement. The dragged row opts out and tracks the pointer through `dragOrigin`, rebased on every reorder so it never drifts from the finger. WAAPI animations outrank inline styles, so any running animation on a row must be cancelled before setting `style.transform` on it. `slide()` honours `prefers-reduced-motion` in JS — the reduced-motion block in `styles.css` cannot reach these.
- **Surgical DOM updates.** `renderAll()` runs once at startup. Mutations (`addTodo`, `deleteTodo`, `toggleTodo`, `commitEdit`) update the model, touch only the affected node, then call `save()`. Don't introduce a full re-render on every change.
- **`el()` throws on missing selectors** — it is the single point of DOM lookup and encodes the assumption that the markup is present.
- **Persistence is fail-soft.** `load()` validates every entry with the `isTodo()` type guard and discards junk; `save()` swallows quota/private-mode errors so the app keeps working in memory.

## Bun usage

Default to Bun over Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

Bun API docs are available locally in `node_modules/bun-types/docs/**.mdx`.

## Testing

Tests use `bun:test`:

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```
