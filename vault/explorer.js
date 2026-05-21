/**
 * explorer.js — File explorer rendering + interaction
 *
 * Owns everything inside the vault screen:
 *   - sidebar folder tree
 *   - file grid (folders + files sections)
 *   - detail panel
 *   - context menu
 *   - action bar button handlers
 *   - search filtering
 *
 * Reads from State; mutates State; re-renders on demand.
 * DOM is rebuilt only where needed (targeted render functions).
 *
 * TODO(backend): Every action that mutates State also needs a
 * corresponding Supabase call via api.js (future file).
 * Each integration point is marked with TODO(backend).
 */

const Explorer = (() => {

  // ── SVG icon paths (inline, no dependency) ──────────────────
  const ICONS = {
    folder: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M1.5 3.75A1.5 1.5 0 0 1 3 2.25H7.5L9.75 4.5H15A1.5 1.5 0 0 1 16.5 6v7.5a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5z"/></svg>`,
    note:   `<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="2.25" y="2.25" width="13.5" height="13.5" rx="1.5"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="5" y1="9" x2="13" y2="9"/><line x1="5" y1="12" x2="9" y2="12"/></svg>`,
    code:   `<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="4,4.5 1.5,9 4,13.5"/><polyline points="14,4.5 16.5,9 14,13.5"/><line x1="10.5" y1="2.25" x2="7.5" y2="15.75"/></svg>`,
    image:  `<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="1.5" y="3" width="15" height="12" rx="1.5"/><circle cx="6" cy="7.5" r="1.5"/><path d="M1.5 12l4-4 3 3 2.5-2.5L16.5 13"/></svg>`,
    file:   `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3.75 2.25h7.5L15 6v9.75a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V3a.75.75 0 0 1 .75-.75z"/><polyline points="11.25,2.25 11.25,6.75 15,6.75"/></svg>`,
    generic: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="8" width="28" height="24" rx="2" stroke-width="1"/><line x1="11" y1="15" x2="29" y2="15" stroke-width="1"/><line x1="11" y1="19" x2="29" y2="19" stroke-width="1"/><line x1="11" y1="23" x2="22" y2="23" stroke-width="1"/></svg>`,
  };

  // ── DOM refs ─────────────────────────────────────────────────
  let _els = {};

  function _cacheEls() {
    _els = {
      folderTree:      document.getElementById('folder-tree'),
      sectionFolders:  document.getElementById('section-folders'),
      sectionFiles:    document.getElementById('section-files'),
      gridFolders:     document.getElementById('grid-folders'),
      gridFiles:       document.getElementById('grid-files'),
      emptyState:      document.getElementById('empty-state'),
      breadcrumb:      document.getElementById('breadcrumb'),
      detailEmpty:     document.getElementById('detail-empty'),
      detailContent:   document.getElementById('detail-content'),
      detailName:      document.getElementById('detail-name'),
      detailType:      document.getElementById('detail-type'),
      detailPreview:   document.getElementById('detail-preview'),
      detailMeta:      document.getElementById('detail-meta'),
      detailActions:   document.getElementById('detail-actions'),
      ctxMenu:         document.getElementById('context-menu'),
      storageLabel:    document.getElementById('storage-label'),
      storageFill:     document.getElementById('storage-fill'),
      searchInput:     document.getElementById('search-input'),
    };
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    _cacheEls();
    _bindActionBar();
    _bindContextMenu();
    _bindSearch();
    // Render the initial empty/ready state.
    renderAll();
  }

  // ── Full render ──────────────────────────────────────────────
  /** Call after any State change that affects the explorer. */
  function renderAll() {
    _renderSidebar();
    _renderGrid();
    _renderBreadcrumb();
    _renderDetail();
  }

  // ── Sidebar ──────────────────────────────────────────────────
  function _renderSidebar() {
    const items     = State.get('items');
    const activeId  = State.get('activeFolderId');
    const folders   = items.filter(i => i.type === 'folder');

    // Build a flat list in tree order (root pseudo-folder first,
    // then real folders, then nested ones sorted under parents).
    // This is a simple flat representation — deep nesting is a
    // future concern once the DB tree query is implemented.
    // TODO(backend): replace with recursive DB query via Supabase
    // `folders` table with parent_id traversal.

    let html = _sidebarItem({ id: 'root', name: 'All Files', icon: ICONS.folder, count: items.length, activeId, indent: 0 });
    folders.forEach(f => {
      const childCount = items.filter(i => i.parentId === f.id).length;
      html += _sidebarItem({ id: f.id, name: f.name, icon: ICONS.folder, count: childCount, activeId, indent: 1 });
    });

    _els.folderTree.innerHTML = html;

    // Bind click handlers on the rendered items.
    _els.folderTree.querySelectorAll('[data-folder-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id   = el.dataset.folderId;
        const name = el.dataset.folderName;
        State.navigateToFolder(id, name);
        renderAll();
      });
    });

    // Storage bar
    // TODO(backend): real usage from Supabase Storage API
    _els.storageLabel.textContent = 'Storage · connect Supabase';
    _els.storageFill.style.width  = '0%';
  }

  function _sidebarItem({ id, name, icon, count, activeId, indent }) {
    const isActive    = id === activeId ? 'active' : '';
    const indentClass = indent === 1 ? 'tree-item--indent1' : indent === 2 ? 'tree-item--indent2' : '';
    return `<div
      class="tree-item ${isActive} ${indentClass}"
      data-folder-id="${_esc(id)}"
      data-folder-name="${_esc(name)}"
      role="treeitem"
      aria-selected="${id === activeId}"
      tabindex="0"
    >${icon}<span>${_esc(name)}</span><span class="tree-count">${count}</span></div>`;
  }

  // ── Grid ─────────────────────────────────────────────────────
  function _renderGrid() {
    const all     = State.getItemsInActiveFolder();
    const folders = all.filter(i => i.type === 'folder');
    const files   = all.filter(i => i.type !== 'folder');
    const isEmpty = all.length === 0;

    _els.emptyState.classList.toggle('hidden', !isEmpty);
    _els.sectionFolders.classList.toggle('hidden', folders.length === 0);
    _els.sectionFiles.classList.toggle('hidden',   files.length === 0);

    _els.gridFolders.innerHTML = folders.map(f => _fileCard(f)).join('');
    _els.gridFiles.innerHTML   = files.map(f => _fileCard(f)).join('');

    // Bind card interactions after render.
    document.querySelectorAll('.file-card').forEach(card => {
      const id = card.dataset.itemId;

      card.addEventListener('click', (e) => {
        // Deselect all, select this one.
        document.querySelectorAll('.file-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        State.set('selectedItemId', id);
        _renderDetail();
      });

      card.addEventListener('dblclick', () => {
        const item = State.getItem(id);
        if (item && item.type === 'folder') {
          State.navigateToFolder(item.id, item.name);
          renderAll();
        }
        // TODO(backend): for files, open a viewer/editor panel
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        State.set('contextTargetId', id);
        _openContextMenu(e.clientX, e.clientY);
      });
    });
  }

  function _fileCard(item) {
    const typeClass = item.type in ICONS ? item.type : 'file';
    const meta      = _formatMeta(item);
    const isSelected = State.get('selectedItemId') === item.id;
    return `<div
      class="file-card ${isSelected ? 'selected' : ''}"
      data-item-id="${_esc(item.id)}"
      tabindex="0"
      role="button"
      aria-label="${_esc(item.name)}"
    >
      <span class="fc-badge">${_esc(item.type)}</span>
      <div class="fc-icon fc-icon--${_esc(typeClass)}">${ICONS[typeClass] || ICONS.file}</div>
      <div class="fc-name" title="${_esc(item.name)}">${_esc(item.name)}</div>
      <div class="fc-meta">${_esc(meta)}</div>
    </div>`;
  }

  // ── Breadcrumb ───────────────────────────────────────────────
  function _renderBreadcrumb() {
    const trail = State.get('breadcrumb');
    _els.breadcrumb.innerHTML = trail.map((crumb, i) => {
      const isLast = i === trail.length - 1;
      const sep    = i > 0 ? '<span class="crumb-sep" aria-hidden="true">/</span>' : '';
      return `${sep}<span
        class="crumb ${isLast ? 'active' : ''}"
        data-crumb-id="${_esc(crumb.id)}"
        data-crumb-name="${_esc(crumb.name)}"
        ${isLast ? '' : 'tabindex="0" role="link"'}
      >${_esc(crumb.name)}</span>`;
    }).join('');

    // Clicking a non-final crumb navigates back.
    _els.breadcrumb.querySelectorAll('[data-crumb-id]').forEach(el => {
      if (el.classList.contains('active')) return;
      el.addEventListener('click', () => {
        State.navigateToFolder(el.dataset.crumbId, el.dataset.crumbName);
        renderAll();
      });
    });
  }

  // ── Detail panel ─────────────────────────────────────────────
  function _renderDetail() {
    const id   = State.get('selectedItemId');
    const item = id ? State.getItem(id) : null;

    const isEmpty = !item;
    _els.detailEmpty.classList.toggle('hidden', !isEmpty);
    _els.detailContent.classList.toggle('hidden', isEmpty);
    if (isEmpty) return;

    _els.detailName.textContent = item.name;
    _els.detailType.textContent = item.type.toUpperCase();

    _renderDetailPreview(item);
    _renderDetailMeta(item);
    _renderDetailActions(item);
  }

  function _renderDetailPreview(item) {
    const el = _els.detailPreview;
    // Clear previous styles and content.
    el.className       = 'detail-preview';
    el.style.cssText   = '';
    el.innerHTML       = '';

    if (item.type === 'code' && item.content != null) {
      el.classList.add('detail-preview--code');
      const pre = document.createElement('pre');
      pre.className   = 'code-viewer';
      pre.textContent = item.content;
      el.appendChild(pre);
    } else if (item.type === 'note' && item.content != null) {
      el.classList.add('detail-preview--note');
      const div = document.createElement('div');
      div.className   = 'note-viewer';
      div.textContent = item.content;
      el.appendChild(div);
    } else {
      // Generic icon preview.
      el.innerHTML = ICONS.generic;
    }
  }

  function _renderDetailMeta(item) {
    const rows = [
      { key: 'Type',     value: item.type },
      { key: 'Size',     value: item.size != null ? _formatBytes(item.size) : '—' },
      { key: 'Created',  value: item.createdAt ? _formatDate(item.createdAt) : '—' },
      { key: 'Modified', value: item.updatedAt ? _formatDate(item.updatedAt) : '—' },
    ];
    _els.detailMeta.innerHTML = rows.map(r => `
      <div class="meta-row">
        <span class="meta-key">${_esc(r.key)}</span>
        <span class="meta-val">${_esc(r.value)}</span>
      </div>`).join('');
  }

  function _renderDetailActions(item) {
    const canDownload = item.type !== 'folder' && item.storagePath;

    let html = `
      <button class="detail-action-btn" data-detail-action="open">
        <svg viewBox="0 0 11 11" aria-hidden="true"><path d="M2 5.5h7M6 2.5l3 3-3 3"/></svg>
        Open
      </button>`;

    // TODO(backend): download via Supabase Storage signed URL
    if (canDownload) {
      html += `
        <button class="detail-action-btn" data-detail-action="download">
          <svg viewBox="0 0 11 11" aria-hidden="true"><path d="M5.5 2v5M3 5.5l2.5 2.5 2.5-2.5"/><path d="M2 8.5h7"/></svg>
          Download
        </button>`;
    }

    // TODO(backend): DELETE from Supabase `files` or `folders` table + Storage
    html += `
      <button class="detail-action-btn detail-action-btn--danger" data-detail-action="delete">
        <svg viewBox="0 0 11 11" aria-hidden="true"><path d="M2 2.5h7M4.5 2.5V1.5h2v1M3.5 4l.5 5M7.5 4l-.5 5M2.5 2.5l.5 7h5l.5-7"/></svg>
        Delete
      </button>`;

    _els.detailActions.innerHTML = html;

    _els.detailActions.querySelectorAll('[data-detail-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.detailAction;
        const item   = State.getItem(State.get('selectedItemId'));
        if (!item) return;
        _handleDetailAction(action, item);
      });
    });
  }

  function _handleDetailAction(action, item) {
    if (action === 'open') {
      if (item.type === 'folder') {
        State.navigateToFolder(item.id, item.name);
        renderAll();
      } else {
        // TODO(backend): open file viewer / note editor
        Toast.show('Open — connect Supabase to view files');
      }
    } else if (action === 'download') {
      // TODO(backend): get signed URL from Supabase Storage
      Toast.show('Download — connect Supabase Storage');
    } else if (action === 'delete') {
      _deleteItem(item);
    }
  }

  // ── Action bar ───────────────────────────────────────────────
  function _bindActionBar() {
    document.getElementById('btn-new-folder').addEventListener('click', async () => {
      const name = await Modal.open({
        title:        'New Folder',
        subtitle:     'Enter a name for the new folder',
        placeholder:  'Folder name',
        confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'folder', name });
    });

    document.getElementById('btn-new-note').addEventListener('click', async () => {
      const name = await Modal.open({
        title:        'New Note',
        subtitle:     'Enter a title for the note',
        placeholder:  'Note title',
        confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'note', name: name.endsWith('.md') ? name : name + '.md', content: '' });
    });

    document.getElementById('btn-new-code').addEventListener('click', async () => {
      const name = await Modal.open({
        title:        'New Code Snippet',
        subtitle:     'Enter a filename (include extension, e.g. script.py)',
        placeholder:  'filename.py',
        confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'code', name, content: '// New snippet\n' });
    });

    document.getElementById('btn-upload').addEventListener('click', () => {
      // TODO(backend): trigger Supabase Storage upload flow
      Toast.show('Upload — connect Supabase Storage to enable');
    });

    document.getElementById('btn-sessions').addEventListener('click', () => {
      // TODO(backend): open session management view from Supabase sessions table
      Toast.show('Sessions — connect Supabase to manage sessions');
    });
  }

  // ── Create item ──────────────────────────────────────────────
  function _createItem({ type, name, content = null }) {
    const activeFolderId = State.get('activeFolderId');
    const item = {
      id:          State.makeId(),
      type,
      name,
      parentId:    activeFolderId === 'root' ? null : activeFolderId,
      content,
      storagePath: null,
      size:        null,
      lang:        null,
      createdAt:   State.now(),
      updatedAt:   State.now(),
    };

    // Optimistic UI update.
    State.addItem(item);
    renderAll();
    Toast.show('"' + name + '" created');

    // TODO(backend): call api.js to INSERT into Supabase.
    // On success: update item.id with real UUID from DB response.
    // On failure: State.removeItem(item.id) and Toast.show('...', true).
  }

  // ── Delete item ──────────────────────────────────────────────
  function _deleteItem(item) {
    // Optimistic UI: remove immediately.
    State.removeItem(item.id);
    renderAll();
    Toast.show('"' + item.name + '" deleted');

    // TODO(backend): call api.js to DELETE from Supabase.
    // On failure: State.addItem(item) to restore, show error toast.
  }

  // ── Search ───────────────────────────────────────────────────
  function _bindSearch() {
    _els.searchInput.addEventListener('input', (e) => {
      State.set('searchQuery', e.target.value);
      _renderGrid();
    });
  }

  // ── Context menu ─────────────────────────────────────────────
  function _bindContextMenu() {
    const menu = _els.ctxMenu;

    // Close on any click outside the menu.
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) _closeContextMenu();
    });

    document.getElementById('ctx-open').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      if (!item) return;
      _closeContextMenu();
      if (item.type === 'folder') {
        State.navigateToFolder(item.id, item.name);
        renderAll();
      } else {
        Toast.show('Open — connect Supabase to view files');
      }
    });

    document.getElementById('ctx-rename').addEventListener('click', async () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (!item) return;
      const name = await Modal.open({
        title:        'Rename',
        subtitle:     'Enter a new name',
        placeholder:  item.name,
        initial:      item.name,
        confirmLabel: 'Rename',
      });
      if (!name || name === item.name) return;
      State.updateItem(item.id, { name, updatedAt: State.now() });
      renderAll();
      Toast.show('Renamed to "' + name + '"');
      // TODO(backend): UPDATE Supabase record
    });

    document.getElementById('ctx-duplicate').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (!item) return;
      const copy = Object.assign({}, item, {
        id:        State.makeId(),
        name:      'Copy of ' + item.name,
        createdAt: State.now(),
        updatedAt: State.now(),
      });
      State.addItem(copy);
      renderAll();
      Toast.show('Duplicated "' + item.name + '"');
      // TODO(backend): INSERT copy into Supabase
    });

    document.getElementById('ctx-download').addEventListener('click', () => {
      _closeContextMenu();
      Toast.show('Download — connect Supabase Storage');
      // TODO(backend): get signed URL from Supabase Storage
    });

    document.getElementById('ctx-delete').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (!item) return;
      _deleteItem(item);
    });
  }

  function _openContextMenu(x, y) {
    const menu   = _els.ctxMenu;
    const margin = 8;
    menu.removeAttribute('hidden');

    // Prevent menu from going off-screen.
    const menuW = 170;
    const menuH = 200;
    const left  = Math.min(x, window.innerWidth  - menuW - margin);
    const top   = Math.min(y, window.innerHeight - menuH - margin);

    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }

  function _closeContextMenu() {
    _els.ctxMenu.setAttribute('hidden', '');
    State.set('contextTargetId', null);
  }

  // ── Utilities ────────────────────────────────────────────────
  /** Escape a value for safe insertion as HTML text content. */
  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _formatMeta(item) {
    if (item.type === 'folder') {
      const count = State.get('items').filter(i => i.parentId === item.id).length;
      return count + ' items';
    }
    return item.size != null ? _formatBytes(item.size) : '';
  }

  function _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k     = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i     = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function _formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  // ── Public API ───────────────────────────────────────────────
  return { init, renderAll };
})();
