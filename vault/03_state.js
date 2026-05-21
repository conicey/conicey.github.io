/**
 * state.js — Centralized application state
 * Single source of truth. No DOM access. No side-effects. Pure data.
 */

const State = (() => {
  const _state = {
    sessionToken:   null,
    activeFolderId: 'root',
    breadcrumb:     [{ id: 'root', name: 'root' }],
    selectedItemId: null,
    searchQuery:    '',
    viewMode:       'grid',
    modalOpen:      false,
    contextTargetId: null,
    items:          [],
  };

  function get(key) {
    return _state[key];
  }

  function getAll() {
    return Object.assign({}, _state);
  }

  function getItem(id) {
    return _state.items.find(item => item.id === id) || null;
  }

  function getItemsInActiveFolder() {
    const folderId = _state.activeFolderId;
    const query    = _state.searchQuery.toLowerCase();

    return _state.items.filter(item => {
      const inFolder = item.parentId === (folderId === 'root' ? null : folderId);
      if (!query) return inFolder;
      return inFolder && item.name.toLowerCase().includes(query);
    });
  }

  function set(key, value) {
    if (!(key in _state)) {
      console.warn('[State] Unknown key:', key);
      return;
    }
    _state[key] = value;
  }

  function navigateToFolder(id, name) {
    _state.activeFolderId = id;
    _state.selectedItemId = null;

    if (id === 'root') {
      _state.breadcrumb = [{ id: 'root', name: 'root' }];
    } else {
      const existingIndex = _state.breadcrumb.findIndex(c => c.id === id);
      if (existingIndex !== -1) {
        _state.breadcrumb = _state.breadcrumb.slice(0, existingIndex + 1);
      } else {
        _state.breadcrumb.push({ id, name });
      }
    }
  }

  function addItem(item) {
    _state.items.push(item);
  }

  function removeItem(id) {
    _state.items = _state.items.filter(item => item.id !== id);
    if (_state.selectedItemId === id)  _state.selectedItemId  = null;
    if (_state.contextTargetId === id) _state.contextTargetId = null;
  }

  function updateItem(id, patch) {
    const index = _state.items.findIndex(item => item.id === id);
    if (index === -1) return;
    _state.items[index] = Object.assign({}, _state.items[index], patch);
  }

  function makeId() {
    return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  function now() {
    return new Date().toISOString();
  }

  return {
    get, getAll, getItem, getItemsInActiveFolder,
    set, navigateToFolder, addItem, removeItem, updateItem,
    makeId, now,
  };
})();
