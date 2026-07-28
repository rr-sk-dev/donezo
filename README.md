# donezo

A small todo app. Vanilla TypeScript, no framework, no dependencies — served by [Bun](https://bun.com).

Todos are stored in the browser's `localStorage`, so there's no database and no accounts. Clearing site data clears your todos.

## Getting started

```bash
bun install
bun run dev
```

Open http://localhost:3000. The dev server has hot reload, and it prints a LAN address too, so you can open the app on your phone if it's on the same network.

To run in production mode (no hot reload):

```bash
bun run start
```

Set `PORT` to use a different port:

```bash
PORT=8080 bun run dev
```

## Features

- Add, edit, complete, and delete todos
- Edit inline by clicking the pencil — <kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels, and an empty value reverts rather than deleting
- Reorder open todos by dragging the handle, or by focusing it and pressing <kbd>↑</kbd>/<kbd>↓</kbd>
- Completed todos drop to the bottom and are not reorderable
- Todos persist across reloads
- Responsive down to phone widths, with keyboard and screen-reader support

## Project layout

```
index.ts            Bun.serve() — serves the page, nothing else
src/index.html      markup + the <template> used for each todo row
src/app.ts          the whole app: state, rendering, events, persistence
src/styles.css      CSS custom properties, mobile-first
```

Bun bundles and transpiles `app.ts` and `styles.css` automatically via the HTML import in `index.ts`. There's no build step.

## Other commands

```bash
bun test            # run tests
bunx tsc --noEmit   # typecheck
```
