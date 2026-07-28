# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # install dependencies
bun run dev          # dev server with HMR + browser console piped to the terminal
bun run start        # production mode (NODE_ENV=production, disables HMR)
bun run build        # static bundle into dist/ — this is what gets deployed
bun test             # run tests
bun test <pattern>   # run tests matching a file/name pattern
bun test -t "name"   # run a single test by name
bunx tsc --noEmit    # typecheck (tsconfig is noEmit; bun build does the bundling)
```

`PORT` overrides the default port 3000. The server binds `0.0.0.0` and prints a LAN URL in dev so the app can be opened from a phone on the same network.

There is no linter or formatter configured.

Deployment is static. `vercel.json` pins `bun run build` → `dist/`; the Bun server in `index.ts` is never deployed, so do not add server-side behaviour there and expect it in production.

## Architecture

Donezo is a single-page todo app with **no backend state** — `index.ts` is only a static host, and all data lives in the browser's `localStorage` under the key `todos:v1`.

- `index.ts` — the **dev** server. `Bun.serve()` with `/` (the HTML import), `/health`, and the two manifest icons. The `import index from './src/index.html'` line is what makes Bun bundle and transpile `app.ts` and `styles.css`; do not add a third-party bundler. The files under `src/` are bundler inputs — they are never served at their source paths. Deployment does not run this server; `bun run build` emits a static `dist/` instead.
- `src/manifest.webmanifest` + icons — make the app installable to a phone home screen, which on iOS also exempts it from the ~7-day eviction that would otherwise wipe `localStorage`. **`src/icon-192.png` and `src/icon-512.png` are deliberately served at fixed, unhashed paths** — every asset linked from the HTML gets content-hashed by the bundler, but the manifest is JSON that the bundler copies verbatim, so its internal `/icon-*.png` references would break against hashed names. They are wired up twice on purpose: a route in `index.ts` for dev, and a `cp` in the `build` script for production. Adding an icon to the manifest means updating both.
- `src/index.html` — markup plus a `<template id="todo-template">` that defines a todo row. Row structure is authored here, not generated in JS.
- `src/app.ts` — the entire app. Vanilla TS, no framework, no dependencies.
- `src/styles.css` — CSS custom properties in `:root` are mobile-first defaults, overridden at `min-width: 480px` and `768px`. Change spacing/sizing by editing those tokens rather than individual rules. Class names are BEM (`todo__checkbox`, `card__title`).
- `src/sw.ts` — the service worker, built as its own entry point so it gets a top-level worker scope and a stable unhashed `/sw.js` URL (that URL is how the browser distinguishes an update from a new registration). It needs `/// <reference lib="webworker" />`; the project's `lib` is DOM-only.
- `scripts/build.ts` — the static build. Wipes `dist/` first so stale hashed assets are never shipped, bundles the page and the worker separately, then copies the two fixed-name manifest icons.

### Offline

- **The worker precaches nothing** — it caches responses as they are requested, so offline works from the second visit on. A precache list would have to be regenerated every build to track the hashed filenames; for a single page that loads all its assets at once, runtime caching gets to the same place without coupling the worker to the build.
- **`index.html` is network-first, everything else is cache-first.** This split is the whole design: the HTML is the only file whose URL never changes, so a cached copy would pin the app to a previous deploy's asset names forever. Every other filename carries a content hash and therefore can never go stale.
- **Registration is gated on `location.protocol === 'https:'`** (`src/app.ts`, bottom), which excludes the dev server, where a cache layer would serve stale assets and defeat HMR. The side effect is that the worker cannot be exercised over `http://localhost` — verify it against a deployed build.
- Bump `CACHE` in `src/sw.ts` only to force every client onto a clean cache; ordinary deploys do not need it.

### Conventions in `src/app.ts`

- **Template cloning, not innerHTML.** `createRow()` clones `#todo-template` and fills it. Adding a field to a row means editing the template in `index.html` and the corresponding lookup in `createRow()`.
- **Event delegation.** All handlers are bound to the `#todo-list` element (`click`, `change`, `keydown`, `focusout`), never to individual rows. Buttons are identified by `data-action` attributes; the owning row is resolved via `rowOf()` → `closest('.todo')` and the model via `todoOf()` → `row.dataset.id`.
- **`todos` is always partitioned: active first, done last.** Every mutation must preserve this. Completing sends a todo to the very bottom, un-completing sends it to index 0, and new todos are inserted at `doneStart()` rather than appended. `sortByDone()` in `load()` repairs older stored data. The DOM mirrors the array exactly, so array and node moves happen together.
- **Reordering uses Pointer Events, never the HTML5 drag API**, which does not fire on touch devices — the app is mobile-first, so that would kill the feature on phones. The pointer is captured on `list` (which never moves) rather than the handle, since capture is lost when a captured element is reinserted. `dropTarget()` clamps every drop to the active region, so a drag cannot land in the done group. During a drag the DOM leads and `commitOrder()` reconciles the array once on release — the one place that inverts the usual direction.
- **Motion is FLIP, via the Web Animations API.** `withFlip()` moves rows first, then animates each displaced row from where it was to where it landed; `slide()` plays that travel. Rows are measured *with* any in-flight animation applied so an interrupted slide continues smoothly, and each is cancelled before its post-move measurement. The dragged row opts out and tracks the pointer through `dragOrigin`, rebased on every reorder so it never drifts from the finger. WAAPI animations outrank inline styles, so any running animation on a row must be cancelled before setting `style.transform` on it. `slide()` honours `prefers-reduced-motion` in JS — the reduced-motion block in `styles.css` cannot reach these.
- **Surgical DOM updates.** `renderAll()` runs once at startup. Mutations (`addTodo`, `deleteTodo`, `toggleTodo`, `commitEdit`) update the model, touch only the affected node, then call `save()`. Don't introduce a full re-render on every change.
- **`el()` throws on missing selectors** — it is the single point of DOM lookup and encodes the assumption that the markup is present.
- **Persistence is fail-soft.** `load()` validates every entry with the `isTodo()` type guard and discards junk; `save()` swallows quota/private-mode errors so the app keeps working in memory.
- **A first visit is seeded with demo todos** (`seed()`), because the app is a portfolio piece and reordering, completing and inline edit are all invisible on an empty list. First visit means the storage key is **absent** — an emptied list persists as `"[]"`, so deleting the examples keeps them gone. The unconditional `save()` beside `const todos = load()` is what writes that first `"[]"` into existence; it cannot move inside `load()`, which runs before `todos` is initialised.

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
