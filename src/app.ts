type Todo = {
  id: string;
  title: string;
  done: boolean;
};

const STORAGE_KEY = 'todos:v1';

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
function el<T extends Element>(selector: string, root: ParentNode = document): T {
  const node = root.querySelector<T>(selector);

  if (!node) {
    throw new Error(`Missing element: ${selector}`);
  }

  return node;
}

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------
   Persistence
------------------------------------------------------------------ */
function isTodo(value: unknown): value is Todo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Todo>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.done === 'boolean'
  );
}

function sortByDone(list: Todo[]): Todo[] {
  return [...list.filter((todo) => !todo.done), ...list.filter((todo) => todo.done)];
}

function load(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? sortByDone(parsed.filter(isTodo)) : [];
  } catch {
    return [];
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // Storage full or blocked (private mode) — the app keeps working in memory.
  }
}

/* ------------------------------------------------------------------
   State + DOM
------------------------------------------------------------------ */
const todos: Todo[] = load();

const form = el<HTMLFormElement>('#todo-form');
const input = el<HTMLInputElement>('#todo-input');
const list = el<HTMLUListElement>('#todo-list');
const emptyState = el<HTMLParagraphElement>('#empty-state');
const template = el<HTMLTemplateElement>('#todo-template');

function rowOf(target: EventTarget | null): HTMLLIElement | null {
  return target instanceof Element ? target.closest<HTMLLIElement>('.todo') : null;
}

function todoOf(row: HTMLLIElement): Todo | undefined {
  return todos.find((todo) => todo.id === row.dataset.id);
}

function doneStart(): number {
  const index = todos.findIndex((todo) => todo.done);
  return index === -1 ? todos.length : index;
}

/* ------------------------------------------------------------------
   Rendering
------------------------------------------------------------------ */
function createRow(todo: Todo): HTMLLIElement {
  const row = template.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
  row.dataset.id = todo.id;
  el<HTMLElement>('[data-title]', row).textContent = todo.title;
  el<HTMLInputElement>('.todo__checkbox', row).checked = todo.done;
  return row;
}

function syncEmptyState(): void {
  const hasTodos = todos.length > 0;
  list.hidden = !hasTodos;
  emptyState.hidden = hasTodos;
}

function renderAll(): void {
  const fragment = document.createDocumentFragment();

  for (const todo of todos) {
    fragment.append(createRow(todo));
  }

  list.replaceChildren(fragment);
  syncEmptyState();
}

/* ------------------------------------------------------------------
   Commands
------------------------------------------------------------------ */
function addTodo(title: string): void {
  const todo: Todo = { id: createId(), title, done: false };
  const index = doneStart();

  todos.splice(index, 0, todo);
  list.insertBefore(createRow(todo), list.children[index] ?? null);
  save();
  syncEmptyState();
}

function deleteTodo(row: HTMLLIElement): void {
  const index = todos.findIndex((todo) => todo.id === row.dataset.id);

  if (index === -1) {
    return;
  }

  todos.splice(index, 1);
  row.remove();
  save();
  syncEmptyState();
}

function toggleTodo(row: HTMLLIElement, done: boolean): void {
  const index = todos.findIndex((todo) => todo.id === row.dataset.id);
  const todo = todos[index];

  if (!todo) {
    return;
  }

  todo.done = done;

  const checkbox = el<HTMLInputElement>('.todo__checkbox', row);
  const refocus = document.activeElement === checkbox;

  todos.splice(index, 1);

  if (done) {
    todos.push(todo);
    list.append(row);
  } else {
    todos.unshift(todo);
    list.prepend(row);
  }

  if (refocus) {
    checkbox.focus();
  }

  save();
}

function startEdit(row: HTMLLIElement): void {
  const todo = todoOf(row);

  if (!todo) {
    return;
  }

  const title = el<HTMLElement>('[data-title]', row);
  const editor = el<HTMLInputElement>('[data-edit]', row);

  editor.value = todo.title;
  title.hidden = true;
  editor.hidden = false;
  editor.focus();
  editor.select();
}

function commitEdit(row: HTMLLIElement): void {
  const todo = todoOf(row);

  if (!todo) {
    return;
  }

  const title = el<HTMLElement>('[data-title]', row);
  const editor = el<HTMLInputElement>('[data-edit]', row);
  const next = editor.value.trim();

  // An empty value reverts instead of destroying the todo.
  if (next && next !== todo.title) {
    todo.title = next;
    title.textContent = next;
    save();
  }

  editor.hidden = true;
  title.hidden = false;
}

/* ------------------------------------------------------------------
   Events
------------------------------------------------------------------ */
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = input.value.trim();

  if (!title) {
    return;
  }

  addTodo(title);
  input.value = '';
  input.focus();
});

list.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[data-action]')
      : null;
  const row = rowOf(button);

  if (!button || !row) {
    return;
  }

  if (button.dataset.action === 'edit') {
    startEdit(row);
  }

  if (button.dataset.action === 'delete') {
    deleteTodo(row);
  }
});

list.addEventListener('change', (event) => {
  const checkbox = event.target;
  const row = rowOf(checkbox);

  if (!(checkbox instanceof HTMLInputElement) || !row) {
    return;
  }

  if (!checkbox.classList.contains('todo__checkbox')) {
    return;
  }

  toggleTodo(row, checkbox.checked);
});

list.addEventListener('keydown', (event) => {
  const editor = event.target;
  const row = rowOf(editor);

  if (!(editor instanceof HTMLInputElement) || !editor.matches('[data-edit]') || !row) {
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    editor.blur();
  } else if (event.key === 'Escape') {
    const todo = todoOf(row);

    if (todo) {
      editor.value = todo.title;
    }

    editor.blur();
  }
});

list.addEventListener('focusout', (event) => {
  const editor = event.target;
  const row = rowOf(editor);

  if (!(editor instanceof HTMLInputElement) || !editor.matches('[data-edit]') || !row) {
    return;
  }

  commitEdit(row);
});

renderAll();
