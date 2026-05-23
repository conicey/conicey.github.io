/**
 * state.js — Centralized application state
 * Single source of truth. No DOM access. No side-effects. Pure data.
 */

const State = (() => {
  const _state = {
    sessionToken:     null,
    currentFolderId:  null,
    selectedItemId:   null,
    searchQuery:      '',
    items:            [],
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

  function set(key, value) {
    if (!(key in _state)) {
      console.warn('[State] Unknown key:', key);
      return;
    }
    _state[key] = value;
  }

  function addItem(item) {
    _state.items.push(item);
  }

  function removeItem(id) {
    _state.items = _state.items.filter(item => item.id !== id);
    if (_state.selectedItemId === id) _state.selectedItemId = null;
  }

  function updateItem(id, patch) {
    const index = _state.items.findIndex(item => item.id === id);
    if (index === -1) return;
    _state.items[index] = Object.assign({}, _state.items[index], patch);
  }

  function logout() {
    _state.sessionToken = null;
    _state.currentFolderId = null;
    _state.selectedItemId = null;
    _state.items = [];
  }

  return {
    get, getAll, getItem, set, addItem, removeItem, updateItem, logout,
  };
})();