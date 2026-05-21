/**
 * state.js — Centralized application state
 *
 * Single source of truth for the vault UI.
 * No DOM access. No side-effects. Pure data.
 *
 * All mutations go through the exported setters so that
 * callers (app.js, explorer.js) can react to changes cleanly.
 *
 * TODO(backend): When Supabase is integrated, the `items` array
 * will be replaced by real-time data from Supabase subscriptions.
 * The shape of each item here mirrors the intended DB schema.
 */

const State = (() => {
  // ── Internal state ───────────────────────────────────────────
  const _state = {
    /** Auth ─────────────────────────────────────────────────── */
    // TODO(backend): sessionToken comes from Supabase JWT after
    // a successful POST to /functions/v1/validate-token
    sessionToken: null,

    /** Navigation ───────────────────────────────────────────── */
    // The currently active folder id. 'root' is the top level.
    // TODO(backend): folder ids will be real UUIDs from Supabase.
    activeFolderId: 'root',

    // Flat breadcrumb trail: [{ id, name }]
    breadcrumb: [{ id: 'root', name: 'root' }],

    /** Selection ────────────────────────────────────────────── */
    // The id of the currently selected file/folder card, or null.
    selectedItemId: null,

    /** Search ───────────────────────────────────────────────── */
    searchQuery: '',

    /** View mode ────────────────────────────────────────────── */
    // 'grid' or 'list' — currently only grid is implemented.
    viewMode: 'grid',

    /** Modal ────────────────────────────────────────────────── */
    modalOpen: false,

    /** Context menu ─────────────────────────────────────────── */
    // Id of the item the context menu was opened on.
    contextTargetId: null,

    /** Items ────────────────────────────────────────────────── */
    // Flat array of all vault items (folders + files).
    // Shape mirrors the Supabase `files` and `folders` tables.
    //
    // TODO(backend): replace with real data fetched from Supabase.
    // Each item loaded from DB should conform to this shape:
    // {
    //   id:         string (uuid),
    //   type:       'folder' | 'note' | 'code' | 'image' | 'file',
    //   name:       string,
    //   parentId:   string | null,   // null = root
    //   content:    string | null,   // for notes/code stored in DB
    //   storagePath: string | null,  // for files in Supabase Storage
    //   size:       number | null,   // bytes
    //   lang:       string | null,   // for code snippets
    //   createdAt:  string (ISO),
    //   updatedAt:  string (ISO),
    // }
    items: [],
  };

  // ── Getters ─────────────────────────────────────────────────
  function get(key) {
    return _state[key];
  }

  function getAll() {
    // Return a shallow copy to prevent direct mutation.
    return Object.assign({}, _state);
  }

  function getItem(id) {
    return _state.items.find(item => item.id === id) || null;
  }

  /** Returns items whose parentId matches the active folder. */
  function getItemsInActiveFolder() {
    const folderId = _state.activeFolderId;
    const query    = _state.searchQuery.toLowerCase();

    return _state.items.filter(item => {
      const inFolder = item.parentId === (folderId === 'root' ? null : folderId);
      if (!query) return inFolder;
      return inFolder && item.name.toLowerCase().includes(query);
    });
  }

  // ── Setters ─────────────────────────────────────────────────
  function set(key, value) {
    if (!(key in _state)) {
      console.warn('[State] Unknown key:', key);
      return;
    }
    _state[key] = value;
  }

  /** Navigate to a folder by id. Updates breadcrumb. */
  function navigateToFolder(id, name) {
    _state.activeFolderId = id;
    _state.selectedItemId = null;

    if (id === 'root') {
      _state.breadcrumb = [{ id: 'root', name: 'root' }];
    } else {
      const existingIndex = _state.breadcrumb.findIndex(c => c.id === id);
      if (existingIndex !== -1) {
        // Navigating back — trim the trail.
        _state.breadcrumb = _state.breadcrumb.slice(0, existingIndex + 1);
      } else {
        _state.breadcrumb.push({ id, name });
      }
    }
  }

  /** Add a new item to the items array (optimistic UI). */
  function addItem(item) {
    _state.items.push(item);
  }

  /** Remove an item by id (optimistic UI). */
  function removeItem(id) {
    _state.items = _state.items.filter(item => item.id !== id);
    if (_state.selectedItemId === id) _state.selectedItemId = null;
    if (_state.contextTargetId === id) _state.contextTargetId = null;
  }

  /** Update a field on an existing item. */
  function updateItem(id, patch) {
    const index = _state.items.findIndex(item => item.id === id);
    if (index === -1) return;
    _state.items[index] = Object.assign({}, _state.items[index], patch);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function makeId() {
    // Temporary local id generator.
    // TODO(backend): remove — real ids come from Supabase INSERT response.
    return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  function now() {
    return new Date().toISOString();
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    get,
    getAll,
    getItem,
    getItemsInActiveFolder,
    set,
    navigateToFolder,
    addItem,
    removeItem,
    updateItem,
    makeId,
    now,
  };
})();
