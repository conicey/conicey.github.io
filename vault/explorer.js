/**
 * explorer.js — File explorer rendering + interaction
 */

const Explorer = (() => {

  const ICONS = {
    folder:  `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M1.5 3.75A1.5 1.5 0 0 1 3 2.25H7.5L9.75 4.5H15A1.5 1.5 0 0 1 16.5 6v7.5a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5z"/></svg>`,
    note:    `<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="2.25" y="2.25" width="13.5" height="13.5" rx="1.5"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="5" y1="9" x2="13" y2="9"/><line x1="5" y1="12" x2="9" y2="12"/></svg>`,
    code:    `<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="4,4.5 1.5,9 4,13.5"/><polyline points="14,4.5 16.5,9 14,13.5"/><line x1="10.5" y1="2.25" x2="7.5" y2="15.75"/></svg>`,
    image:   `<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="1.5" y="3" width="15" height="12" rx="1.5"/><circle cx="6" cy="7.5" r="1.5"/><path d="M1.5 12l4-4 3 3 2.5-2.5L16.5 13"/></svg>`,
    file:    `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3.75 2.25h7.5L15 6v9.75a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V3a.75.75 0 0 1 .75-.75z"/><polyline points="11.25,2.25 11.25,6.75 15,6.75"/></svg>`,
    generic: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="8" width="28" height="24" rx="2" stroke-width="1"/><line x1="11" y1="15" x2="29" y2="15" stroke-width="1"/><line x1="11" y1="19" x2="29" y2="19" stroke-width="1"/><line x1="11" y1="23" x2="22" y2="23" stroke-width="1"/></svg>`,
  };

  let _fileInput = null;
  let _els = {};

  function _cacheEls() {
    _els = {
      folderTree:     document.getElementById('folder-tree'),
      sectionFolders: document.getElementById('section-folders'),
      sectionFiles:   document.getElementById('section-files'),
      gridFolders:    document.getElementById('grid-folders'),
      gridFiles:      document.getElementById('grid-files'),
      emptyState:     document.getElementById('empty-state'),
      breadcrumb:     document.getElementById('breadcrumb'),
      detailEmpty:    document.getElementById('detail-empty'),
      detailContent:  document.getElementById('detail-content'),
      detailName:     document.getElementById('detail-name'),
      detailType:     document.getElementById('detail-type'),
      detailPreview:  document.getElementById('detail-preview'),
      detailMeta:     document.getElementById('detail-meta'),
      detailActions:  document.getElementById('detail-actions'),
      ctxMenu:        document.getElementById('context-menu'),
      storageLabel:   document.getElementById('storage-label'),
      storageFill:    document.getElementById('storage-fill'),
      searchInput:    document.getElementById('search-input'),
    };
  }

  function _createFileInput() {
    _fileInput = document.createElement('input');
    _fileInput.type     = 'file';
    _fileInput.multiple = true;
    _fileInput.style.display = 'none';
    document.body.appendChild(_fileInput);
    _fileInput.addEventListener('change', _handleFileInputChange);
  }

  function init() {
    _cacheEls();
    _createFileInput();
    _bindActionBar();
    _bindContextMenu();
    _bindSearch();
    renderAll();
  }

  function renderAll() {
    _renderSidebar();
    _renderGrid();
    _renderBreadcrumb();
    _renderDetail();
  }

  // ── Sidebar ──────────────────────────────────────────────────
  function _renderSidebar() {
    const items    = State.get('items');
    const activeId = State.get('activeFolderId');
    const folders  = items.filter(i => i.type === 'folder');

    let html = _sidebarItem({ id: 'root', name: 'All Files', icon: ICONS.folder, count: items.length, activeId, indent: 0 });
    folders.forEach(f => {
      const childCount = items.filter(i => i.parentId === f.id).length;
      html += _sidebarItem({ id: f.id, name: f.name, icon: ICONS.folder, count: childCount, activeId, indent: 1 });
    });

    _els.folderTree.innerHTML = html;
    _els.folderTree.querySelectorAll('[data-folder-id]').forEach(el => {
      el.addEventListener('click', () => {
        State.navigateToFolder(el.dataset.folderId, el.dataset.folderName);
        renderAll();
      });
    });

    _updateStorageBar();
  }

  function _updateStorageBar() {
    const items = State.get('items');
    const totalBytes = items.reduce((sum, i) => sum + (i.size || 0), 0);
    const limitBytes = 50 * 1024 * 1024;
    const pct = Math.min((totalBytes / limitBytes) * 100, 100).toFixed(1);
    _els.storageLabel.textContent = `Storage · ${_formatBytes(totalBytes)} / 50 MB`;
    _els.storageFill.style.width  = pct + '%';
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
    _els.sectionFiles.classList.toggle('hidden', files.length === 0);

    _els.gridFolders.innerHTML = folders.map(f => _fileCard(f)).join('');
    _els.gridFiles.innerHTML   = files.map(f => _fileCard(f)).join('');

    document.querySelectorAll('.file-card').forEach(card => {
      const id = card.dataset.itemId;

      card.addEventListener('click', () => {
        const item = State.getItem(id);
        if (!item) return;

        if (item.type === 'folder') {
          State.navigateToFolder(item.id, item.name);
          renderAll();
          return;
        }

        document.querySelectorAll('.file-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        State.set('selectedItemId', id);
        _renderDetail();
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        State.set('contextTargetId', id);
        _openContextMenu(e.clientX, e.clientY);
      });
    });
  }

  function _fileCard(item) {
    const typeClass  = item.type in ICONS ? item.type : 'file';
    const meta       = _formatMeta(item);
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
    el.className     = 'detail-preview';
    el.style.cssText = '';
    el.innerHTML     = '';

    if (item.type === 'note') {
      el.classList.add('detail-preview--note');
      const textarea = document.createElement('textarea');
      textarea.className   = 'note-viewer';
      textarea.value       = item.content || '';
      textarea.placeholder = 'Start writing…';
      textarea.style.cssText = 'width:100%;height:100%;border:none;background:transparent;color:inherit;font-family:inherit;font-size:inherit;resize:none;outline:none;padding:12px 14px;box-sizing:border-box;';
      textarea.addEventListener('input', () => _autoSave(item, textarea.value));
      el.appendChild(textarea);

    } else if (item.type === 'code') {
      el.classList.add('detail-preview--code');
      const textarea = document.createElement('textarea');
      textarea.className   = 'code-viewer';
      textarea.value       = item.content || '';
      textarea.placeholder = '// Start coding…';
      textarea.style.cssText = 'width:100%;height:100%;border:none;background:transparent;color:inherit;font-family:var(--font-mono);font-size:12px;resize:none;outline:none;padding:12px 14px;box-sizing:border-box;';
      textarea.addEventListener('input', () => _autoSave(item, textarea.value));
      el.appendChild(textarea);

    } else if (item.type === 'image' && item.storagePath) {
      const url = API.getPublicUrl(item.storagePath);
      const img = document.createElement('img');
      img.src   = url;
      img.alt   = item.name;
      img.style.cssText = 'max-width:100%;max-height:220px;object-fit:contain;border-radius:4px;display:block;margin:auto;';
      el.appendChild(img);

    } else if (item.storagePath) {
      // Generic uploaded file — show icon + download hint
      el.innerHTML = `<div style="text-align:center;padding:20px;">${ICONS.file}<p style="margin-top:8px;font-size:11px;color:var(--text-muted);">Use Download to save this file</p></div>`;

    } else {
      el.innerHTML = `<div style="text-align:center;padding:20px;">${ICONS.generic}</div>`;
    }
  }

  // Auto-save debounced
  let _saveTimer = null;
  function _autoSave(item, value) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      try {
        State.updateItem(item.id, { content: value, updatedAt: new Date().toISOString() });
        await API.updateItem(item.id, { content: value, updated_at: new Date().toISOString() });
        Toast.show('Saved');
      } catch (err) {
        console.error('[Explorer] auto-save failed:', err);
        Toast.show('Save failed', true);
      }
    }, 800);
  }

  function _renderDetailMeta(item) {
    const rows = [
      { key: 'Type',     value: item.type },
      { key: 'Size',     value: item.size != null ? _formatBytes(item.size) : '—' },
      { key: 'Created',  value: item.createdAt  ? _formatDate(item.createdAt)  : '—' },
      { key: 'Modified', value: item.updatedAt  ? _formatDate(item.updatedAt)  : '—' },
    ];
    _els.detailMeta.innerHTML = rows.map(r => `
      <div class="meta-row">
        <span class="meta-key">${_esc(r.key)}</span>
        <span class="meta-val">${_esc(r.value)}</span>
      </div>`).join('');
  }

  function _renderDetailActions(item) {
    const canDownload = item.type !== 'folder';

    let html = '';

    if (item.type === 'folder') {
      html += `<button class="detail-action-btn" data-detail-action="open">Open Folder</button>`;
    }

    if (canDownload) {
      html += `
        <button class="detail-action-btn" data-detail-action="download">
          <svg viewBox="0 0 11 11" aria-hidden="true"><path d="M5.5 2v5M3 5.5l2.5 2.5 2.5-2.5"/><path d="M2 8.5h7"/></svg>
          Download
        </button>`;
    }

    html += `
      <button class="detail-action-btn" data-detail-action="rename">
        <svg viewBox="0 0 11 11" aria-hidden="true"><path d="M7 1.5l2.5 2.5-5 5H2V6.5z"/></svg>
        Rename
      </button>
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
      // Only folders use this now — files are shown inline on click
      if (item.type === 'folder') {
        State.navigateToFolder(item.id, item.name);
        renderAll();
      }
    } else if (action === 'download') {
      _downloadItem(item);
    } else if (action === 'rename') {
      _renameItem(item);
    } else if (action === 'delete') {
      _deleteItem(item);
    }
  }

  // ── Upload ───────────────────────────────────────────────────
  function _triggerUpload() {
    _fileInput.value = '';
    _fileInput.click();
  }

  async function _handleFileInputChange() {
    const files = Array.from(_fileInput.files);
    if (!files.length) return;
    for (const file of files) {
      await _uploadFile(file);
    }
  }

  async function _uploadFile(file) {
    const activeFolderId = State.get('activeFolderId');
    const folder = activeFolderId !== 'root' ? activeFolderId + '/' : '';
    const path   = folder + Date.now() + '_' + file.name;

    Toast.show('Uploading ' + file.name + '…');

    try {
      await API.uploadFile(file, path);

      let type = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type === 'text/plain' || file.name.endsWith('.md')) type = 'note';

      const payload = {
        type,
        name:         file.name,
        parent_id:    activeFolderId === 'root' ? null : activeFolderId,
        content:      null,
        storage_path: path,
        size:         file.size,
        lang:         null,
      };

      const saved = await API.createItem(payload);
      State.addItem(_normalize(saved));
      renderAll();
      Toast.show(file.name + ' uploaded');

    } catch (err) {
      console.error('[Explorer] upload failed:', err);
      Toast.show('Upload failed: ' + file.name, true);
    }
  }

  // ── Download ─────────────────────────────────────────────────
  async function _downloadItem(item) {
    if (!item.storagePath) {
      if (item.content != null) {
        const blob = new Blob([item.content], { type: 'text/plain' });
        _triggerBlobDownload(blob, item.name);
      } else {
        Toast.show('Nothing to download');
      }
      return;
    }

    try {
      Toast.show('Downloading…');
      const url  = API.getPublicUrl(item.storagePath);
      const res  = await fetch(url);
      const blob = await res.blob();
      _triggerBlobDownload(blob, item.name);
    } catch (err) {
      console.error('[Explorer] download failed:', err);
      Toast.show('Download failed', true);
    }
  }

  function _triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Rename ───────────────────────────────────────────────────
  async function _renameItem(item) {
    const name = await Modal.open({
      title: 'Rename', subtitle: 'Enter a new name',
      placeholder: item.name, initial: item.name, confirmLabel: 'Rename',
    });
    if (!name || name === item.name) return;

    State.updateItem(item.id, { name, updatedAt: new Date().toISOString() });
    renderAll();

    try {
      await API.updateItem(item.id, { name, updated_at: new Date().toISOString() });
      Toast.show('Renamed to "' + name + '"');
    } catch (err) {
      console.error('[Explorer] rename failed:', err);
      State.updateItem(item.id, { name: item.name });
      renderAll();
      Toast.show('Rename failed — reverted', true);
    }
  }

  // ── Action bar ───────────────────────────────────────────────
  function _bindActionBar() {
    document.getElementById('btn-new-folder').addEventListener('click', async () => {
      const name = await Modal.open({
        title: 'New Folder', subtitle: 'Enter a name for the new folder',
        placeholder: 'Folder name', confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'folder', name });
    });

    document.getElementById('btn-new-note').addEventListener('click', async () => {
      const name = await Modal.open({
        title: 'New Note', subtitle: 'Enter a title for the note',
        placeholder: 'Note title', confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'note', name: name.endsWith('.md') ? name : name + '.md', content: '' });
    });

    document.getElementById('btn-new-code').addEventListener('click', async () => {
      const name = await Modal.open({
        title: 'New Code Snippet', subtitle: 'Enter a filename (include extension, e.g. script.py)',
        placeholder: 'filename.py', confirmLabel: 'Create',
      });
      if (!name) return;
      _createItem({ type: 'code', name, content: '// New snippet\n' });
    });

    document.getElementById('btn-upload').addEventListener('click', () => {
      _triggerUpload();
    });
  }

  // ── Normalization (DB → State) ───────────────────────────────
  function _normalize(row) {
    return {
      id:          row.id,
      type:        row.type,
      name:        row.name,
      parentId:    row.parent_id    ?? null,
      content:     row.content      ?? null,
      storagePath: row.storage_path ?? null,
      size:        row.size         ?? null,
      lang:        row.lang         ?? null,
      createdAt:   row.created_at   ?? null,
      updatedAt:   row.updated_at   ?? null,
    };
  }

  // ── Create item ──────────────────────────────────────────────
  async function _createItem({ type, name, content = null }) {
    const activeFolderId = State.get('activeFolderId');
    const payload = {
      type,
      name,
      parent_id:    activeFolderId === 'root' ? null : activeFolderId,
      content,
      storage_path: null,
      size:         null,
      lang:         null,
    };
    try {
      const saved = await API.createItem(payload);
      State.addItem(_normalize(saved));
      // Auto-select newly created note/code so it opens immediately
      if (type === 'note' || type === 'code') {
        State.set('selectedItemId', saved.id);
      }
      renderAll();
      Toast.show('"' + name + '" created');
    } catch (err) {
      console.error('[Explorer] createItem failed:', err);
      Toast.show('Failed to create "' + name + '"', true);
    }
  }

  // ── Delete item ──────────────────────────────────────────────
  async function _deleteItem(item) {
    State.removeItem(item.id);
    renderAll();

    try {
      if (item.storagePath) {
        await API.deleteFile(item.storagePath);
      }
      await API.deleteItem(item.id);
      Toast.show('"' + item.name + '" deleted');
    } catch (err) {
      console.error('[Explorer] deleteItem failed:', err);
      State.addItem(item);
      renderAll();
      Toast.show('Failed to delete "' + item.name + '" — restored', true);
    }
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
        // Select and show in detail panel
        State.set('selectedItemId', item.id);
        _renderDetail();
      }
    });

    document.getElementById('ctx-rename').addEventListener('click', async () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (!item) return;
      _renameItem(item);
    });

    document.getElementById('ctx-duplicate').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (!item) return;
      _createItem({ type: item.type, name: 'Copy of ' + item.name, content: item.content });
    });

    document.getElementById('ctx-download').addEventListener('click', () => {
      const item = State.getItem(State.get('contextTargetId'));
      _closeContextMenu();
      if (!item) return;
      _downloadItem(item);
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
    const left = Math.min(x, window.innerWidth  - 178 - margin);
    const top  = Math.min(y, window.innerHeight - 210 - margin);
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
  }

  function _closeContextMenu() {
    _els.ctxMenu.setAttribute('hidden', '');
    State.set('contextTargetId', null);
  }

  // ── Utilities ────────────────────────────────────────────────
  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
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
    } catch { return '—'; }
  }

  return { init, renderAll };
})();
