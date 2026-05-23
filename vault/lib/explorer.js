/**
 * explorer.js – File explorer rendering + interaction
 *
 * Owns everything inside the vault screen:
 * sidebar folder tree, file grid, detail panel,
 * context menu, action bar, search filtering.
 *
 * FEATURES:
 * - Real Supabase Storage uploads/downloads
 * - Drag-and-drop to move files/folders
 * - Inline preview & edit for text/images
 * - Auto-save for text files
 */

const EXPLORER = {
  currentFolderId: null,
  selectedItemId: null,
  draggedItemId: null,
  items: [],
  contextMenuTarget: null,

  init() {
    this.attachEventListeners();
    State.subscribe(() => this.render());
  },

  attachEventListeners() {
    document.getElementById('btn-new-folder').addEventListener('click', () => this.promptNewFolder());
    document.getElementById('btn-upload').addEventListener('click', () => this.promptUpload());
    document.getElementById('btn-new-note').addEventListener('click', () => this.promptNewNote());
    document.getElementById('btn-new-code').addEventListener('click', () => this.promptNewCode());
    document.getElementById('search-input').addEventListener('input', () => this.render());
    document.getElementById('btn-lock').addEventListener('click', () => State.logout());

    // Context menu
    document.getElementById('ctx-open').addEventListener('click', () => this.handleContextOpen());
    document.getElementById('ctx-rename').addEventListener('click', () => this.promptRename());
    document.getElementById('ctx-duplicate').addEventListener('click', () => this.handleDuplicate());
    document.getElementById('ctx-download').addEventListener('click', () => this.handleDownload());
    document.getElementById('ctx-delete').addEventListener('click', () => this.handleDelete());

    document.addEventListener('click', (e) => this.hideContextMenu(e));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideContextMenu();
    });
  },

  async render() {
    try {
      const items = State.get('items') || [];
      this.items = items;
      this.currentFolderId = State.get('currentFolderId');

      this.renderBreadcrumb();
      this.renderSidebar();
      this.renderFileGrid();
      this.updateStorageBar();
    } catch (err) {
      console.error('Render error:', err);
    }
  },

  renderBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    const path = [];
    let currentId = this.currentFolderId;

    while (currentId) {
      const item = this.items.find(i => i.id === currentId);
      if (!item) break;
      path.unshift(item);
      currentId = item.parent_id;
    }

    breadcrumb.innerHTML = `
      <span class="crumb active" data-id="null">root</span>
      ${path.map(p => `<span class="crumb-sep">/</span><span class="crumb" data-id="${p.id}">${p.name}</span>`).join('')}
    `;

    breadcrumb.querySelectorAll('.crumb').forEach(crumb => {
      crumb.addEventListener('click', () => {
        const id = crumb.dataset.id === 'null' ? null : crumb.dataset.id;
        State.set('currentFolderId', id);
      });
    });
  },

  renderSidebar() {
    const folderTree = document.getElementById('folder-tree');
    const folders = this.items.filter(i => i.type === 'folder' && !i.parent_id);
    folderTree.innerHTML = folders.map(f => this.renderTreeItem(f)).join('');

    folderTree.querySelectorAll('.tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        State.set('currentFolderId', id);
      });
    });
  },

  renderTreeItem(folder, depth = 0) {
    const children = this.items.filter(i => i.parent_id === folder.id);
    const hasChildren = children.some(c => c.type === 'folder');
    const isActive = folder.id === this.currentFolderId;

    return `
      <div
        class="tree-item ${isActive ? 'active' : ''} tree-item--indent${Math.min(depth, 2)}"
        data-id="${folder.id}"
        draggable="true"
      >
        <svg viewBox="0 0 12 10" aria-hidden="true">
          <path d="M1 2.5A1 1 0 0 1 2 1.5h3L6.5 3H10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/>
        </svg>
        <span>${folder.name}</span>
        ${children.length > 0 ? `<span class="tree-count">${children.length}</span>` : ''}
      </div>
      ${children.filter(c => c.type === 'folder').map(c => this.renderTreeItem(c, depth + 1)).join('')}
    `;
  },

  renderFileGrid() {
    const fileArea = document.getElementById('file-area');
    const search = document.getElementById('search-input').value.toLowerCase();

    const currentItems = this.items.filter(i => {
      const matchesFolder = i.parent_id === this.currentFolderId;
      const matchesSearch = search === '' || i.name.toLowerCase().includes(search);
      return matchesFolder && matchesSearch;
    });

    const folders = currentItems.filter(i => i.type === 'folder');
    const files = currentItems.filter(i => i.type !== 'folder');

    const isEmpty = folders.length === 0 && files.length === 0;
    document.getElementById('empty-state').style.display = isEmpty ? 'flex' : 'none';

    if (folders.length > 0) {
      document.getElementById('section-folders').classList.remove('hidden');
      document.getElementById('grid-folders').innerHTML = folders.map(f => this.renderFileCard(f)).join('');
    } else {
      document.getElementById('section-folders').classList.add('hidden');
    }

    if (files.length > 0) {
      document.getElementById('section-files').classList.remove('hidden');
      document.getElementById('grid-files').innerHTML = files.map(f => this.renderFileCard(f)).join('');
    } else {
      document.getElementById('section-files').classList.add('hidden');
    }

    // Attach event listeners to all cards
    fileArea.querySelectorAll('.file-card').forEach(card => {
      const id = card.dataset.id;

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectItem(id);
      });

      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const item = this.items.find(i => i.id === id);
        if (item.type === 'folder') {
          State.set('currentFolderId', id);
        }
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectItem(id);
        this.showContextMenu(e);
      });

      card.addEventListener('dragstart', (e) => {
        this.draggedItemId = id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const item = this.items.find(i => i.id === id);
        if (item.type === 'folder') {
          card.style.borderColor = 'var(--accent)';
        }
      });

      card.addEventListener('dragleave', () => {
        card.style.borderColor = '';
      });

      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.style.borderColor = '';
        const draggedId = this.draggedItemId;
        const targetItem = this.items.find(i => i.id === id);

        if (targetItem.type === 'folder' && draggedId !== id) {
          const draggedItem = this.items.find(i => i.id === draggedId);
          await API.updateItem(draggedId, { parent_id: id });
          draggedItem.parent_id = id;
          this.render();
          Toast.show('Item moved successfully');
        }
      });
    });

    // Attach drag-drop to tree items
    document.querySelectorAll('.tree-item').forEach(treeItem => {
      treeItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        treeItem.style.backgroundColor = 'var(--accent-dim)';
      });

      treeItem.addEventListener('dragleave', () => {
        treeItem.style.backgroundColor = '';
      });

      treeItem.addEventListener('drop', async (e) => {
        e.preventDefault();
        treeItem.style.backgroundColor = '';
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = treeItem.dataset.id;

        if (draggedId !== targetId) {
          const draggedItem = this.items.find(i => i.id === draggedId);
          await API.updateItem(draggedId, { parent_id: targetId });
          draggedItem.parent_id = targetId;
          this.render();
          Toast.show('Item moved successfully');
        }
      });
    });
  },

  renderFileCard(item) {
    const isSelected = item.id === this.selectedItemId;
    const icon = this.getIconForType(item.type);
    const meta = item.type === 'folder' ? `${item.children || 0} items` : this.formatSize(item.size || 0);

    return `
      <div class="file-card ${isSelected ? 'selected' : ''}" data-id="${item.id}">
        <div class="fc-icon fc-icon--${this.getIconClass(item.type)}">${icon}</div>
        <div class="fc-name" title="${item.name}">${item.name}</div>
        <div class="fc-meta">${meta}</div>
      </div>
    `;
  },

  getIconForType(type) {
    const icons = {
      folder: '<svg viewBox="0 0 12 10"><path d="M1 2.5A1 1 0 0 1 2 1.5h3L6.5 3H10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/></svg>',
      note: '<svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/><line x1="3" y1="4" x2="9" y2="4"/><line x1="3" y1="6.5" x2="9" y2="6.5"/><line x1="3" y1="9" x2="6" y2="9"/></svg>',
      code: '<svg viewBox="0 0 12 12"><polyline points="3,3.5 1,6 3,8.5"/><polyline points="9,3.5 11,6 9,8.5"/><line x1="7" y1="2" x2="5" y2="10"/></svg>',
      image: '<svg viewBox="0 0 12 10"><rect x="1" y="1" width="10" height="8" rx="1"/><circle cx="3.5" cy="3.5" r="1"/><path d="M1 9l3-3 2 2 5-5"/></svg>',
    };
    return icons[type] || '<svg viewBox="0 0 12 12"><rect x="1" y="2" width="10" height="9" rx="1"/><line x1="4" y1="4" x2="8" y2="4"/></svg>';
  },

  getIconClass(type) {
    if (type === 'folder') return 'folder';
    if (type === 'note') return 'note';
    if (type === 'code') return 'code';
    if (type === 'image') return 'image';
    return 'file';
  },

  selectItem(id) {
    this.selectedItemId = id;
    const item = this.items.find(i => i.id === id);
    this.renderDetailPanel(item);
    this.render();
  },

  renderDetailPanel(item) {
    const detailContent = document.getElementById('detail-content');
    const detailEmpty = document.getElementById('detail-empty');

    if (!item) {
      detailContent.classList.add('hidden');
      detailEmpty.classList.remove('hidden');
      return;
    }

    detailEmpty.classList.add('hidden');
    detailContent.classList.remove('hidden');

    document.getElementById('detail-name').textContent = item.name;
    document.getElementById('detail-type').textContent = item.type.toUpperCase();

    this.renderDetailPreview(item);
    this.renderDetailMeta(item);
    this.renderDetailActions(item);
  },

  renderDetailPreview(item) {
    const preview = document.getElementById('detail-preview');
    preview.innerHTML = '';

    if (item.type === 'folder') {
      const children = this.items.filter(i => i.parent_id === item.id).length;
      preview.innerHTML = `<p style="color: var(--text-muted); font-family: var(--font-mono); font-size: 10px;">${children} items</p>`;
    } else if (item.type === 'image') {
      const url = item.storagePath ? API.getPublicUrl(item.storagePath) : null;
      if (url) {
        preview.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: contain;" alt="${item.name}" />`;
      } else {
        preview.innerHTML = `<svg viewBox="0 0 32 32" style="width: 28px; height: 28px; stroke: var(--text-muted);"><rect x="4" y="4" width="24" height="24" rx="2"/><circle cx="10" cy="10" r="2"/><path d="M28 24l-6-8-8 10-6-4L4 24"/></svg>`;
      }
      preview.classList.add('detail-preview--image');
    } else if (item.type === 'note' || item.type === 'code') {
      const textarea = document.createElement('textarea');
      textarea.className = item.type === 'code' ? 'code-viewer' : 'note-viewer';
      textarea.value = item.content || '';
      textarea.style.width = '100%';
      textarea.style.height = '100%';
      textarea.style.border = 'none';
      textarea.style.background = 'transparent';
      textarea.style.color = 'inherit';
      textarea.style.fontFamily = item.type === 'code' ? 'var(--font-mono)' : 'inherit';
      textarea.style.resize = 'none';
      textarea.style.outline = 'none';
      textarea.style.padding = '11px 13px';

      // Auto-save on change
      textarea.addEventListener('change', async () => {
        try {
          const storagePath = `${item.type}s/${item.id}`;
          await API.updateFileContent(storagePath, textarea.value);
          item.content = textarea.value;
          await API.updateItem(item.id, { content: textarea.value });
          Toast.show('Changes saved');
        } catch (err) {
          Toast.show('Failed to save changes', 'error');
          console.error(err);
        }
      });

      preview.appendChild(textarea);
      preview.classList.add(`detail-preview--${item.type}`);
    }
  },

  renderDetailMeta(item) {
    const meta = document.getElementById('detail-meta');
    const rows = [];

    if (item.type !== 'folder') {
      if (item.size) rows.push(['Size', this.formatSize(item.size)]);
      if (item.created_at) rows.push(['Created', new Date(item.created_at).toLocaleDateString()]);
    }

    meta.innerHTML = rows.map(([key, val]) => `
      <div class="meta-row">
        <div class="meta-key">${key}</div>
        <div class="meta-val">${val}</div>
      </div>
    `).join('');
  },

  renderDetailActions(item) {
    const actions = document.getElementById('detail-actions');
    let html = '';

    if (item.type === 'folder') {
      html += '<button class="detail-action-btn" data-action="open-folder">Open Folder</button>';
    } else {
      html += '<button class="detail-action-btn" data-action="download">Download</button>';
      html += '<button class="detail-action-btn" data-action="rename">Rename</button>';
    }
    html += '<button class="detail-action-btn detail-action-btn--danger" data-action="delete">Delete</button>';

    actions.innerHTML = html;

    actions.querySelectorAll('.detail-action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        switch (action) {
          case 'open-folder':
            State.set('currentFolderId', item.id);
            break;
          case 'download':
            await this._downloadItem(item);
            break;
          case 'rename':
            this.promptRenameForItem(item);
            break;
          case 'delete':
            await this._deleteItem(item);
            break;
        }
      });
    });
  },

  showContextMenu(e) {
    const menu = document.getElementById('context-menu');
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.removeAttribute('hidden');
  },

  hideContextMenu(e) {
    if (e && e.type === 'click' && (e.target.closest('.ctx-item') || e.target.closest('.file-card'))) return;
    document.getElementById('context-menu').setAttribute('hidden', '');
  },

  async promptNewFolder() {
    const name = await Modal.prompt('New Folder', 'Enter folder name:', 'Untitled Folder');
    if (!name) return;

    try {
      const item = await API.createItem({
        name,
        type: 'folder',
        parent_id: this.currentFolderId,
        created_at: new Date().toISOString(),
      });
      this.items.push(item);
      this.render();
      Toast.show('Folder created');
    } catch (err) {
      Toast.show('Failed to create folder', 'error');
    }
  },

  async promptUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        Toast.show('Uploading...');
        const storagePath = `uploads/${Date.now()}_${file.name}`;
        const url = await API.uploadFile(file, storagePath);

        const isImage = file.type.startsWith('image/');
        const item = await API.createItem({
          name: file.name,
          type: isImage ? 'image' : 'file',
          parent_id: this.currentFolderId,
          storagePath,
          size: file.size,
          created_at: new Date().toISOString(),
        });

        this.items.push(item);
        this.render();
        Toast.show('File uploaded successfully');
      } catch (err) {
        Toast.show('Upload failed', 'error');
        console.error(err);
      }
    });
    input.click();
  },

  async promptNewNote() {
    const name = await Modal.prompt('New Note', 'Enter note name:', 'Untitled Note');
    if (!name) return;

    try {
      const item = await API.createItem({
        name,
        type: 'note',
        parent_id: this.currentFolderId,
        content: '',
        created_at: new Date().toISOString(),
      });
      this.items.push(item);
      this.render();
      this.selectItem(item.id);
      Toast.show('Note created');
    } catch (err) {
      Toast.show('Failed to create note', 'error');
    }
  },

  async promptNewCode() {
    const name = await Modal.prompt('New Code Snippet', 'Enter snippet name:', 'Untitled Code');
    if (!name) return;

    try {
      const item = await API.createItem({
        name,
        type: 'code',
        parent_id: this.currentFolderId,
        content: '',
        created_at: new Date().toISOString(),
      });
      this.items.push(item);
      this.render();
      this.selectItem(item.id);
      Toast.show('Code snippet created');
    } catch (err) {
      Toast.show('Failed to create code snippet', 'error');
    }
  },

  handleContextOpen() {
    const item = this.items.find(i => i.id === this.selectedItemId);
    if (!item) return;
    if (item.type === 'folder') {
      State.set('currentFolderId', item.id);
    }
  },

  async promptRename() {
    const item = this.items.find(i => i.id === this.selectedItemId);
    if (!item) return;
    await this.promptRenameForItem(item);
  },

  async promptRenameForItem(item) {
    const newName = await Modal.prompt('Rename', 'Enter new name:', item.name);
    if (!newName || newName === item.name) return;

    try {
      await API.updateItem(item.id, { name: newName });
      item.name = newName;
      this.render();
      Toast.show('Renamed successfully');
    } catch (err) {
      Toast.show('Failed to rename', 'error');
    }
  },

  async handleDuplicate() {
    const item = this.items.find(i => i.id === this.selectedItemId);
    if (!item) return;

    try {
      const newItem = { ...item };
      delete newItem.id;
      newItem.name = `${item.name} (copy)`;
      newItem.created_at = new Date().toISOString();
      const created = await API.createItem(newItem);
      this.items.push(created);
      this.render();
      Toast.show('Item duplicated');
    } catch (err) {
      Toast.show('Failed to duplicate', 'error');
    }
  },

  async handleDownload() {
    const item = this.items.find(i => i.id === this.selectedItemId);
    if (!item) return;
    await this._downloadItem(item);
  },

  async _downloadItem(item) {
    try {
      Toast.show('Downloading...');
      let blob;

      if (item.storagePath) {
        blob = await API.downloadFile(item.storagePath);
      } else if (item.content) {
        blob = new Blob([item.content], { type: 'text/plain' });
      } else {
        Toast.show('No content to download', 'error');
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
      window.URL.revokeObjectURL(url);
      Toast.show('Downloaded');
    } catch (err) {
      Toast.show('Download failed', 'error');
      console.error(err);
    }
  },

  async handleDelete() {
    const item = this.items.find(i => i.id === this.selectedItemId);
    if (!item) return;
    await this._deleteItem(item);
  },

  async _deleteItem(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;

    try {
      if (item.storagePath) {
        await API.deleteFile(item.storagePath);
      }
      await API.deleteItem(item.id);
      this.items = this.items.filter(i => i.id !== item.id);
      this.selectedItemId = null;
      this.render();
      Toast.show('Item deleted');
    } catch (err) {
      Toast.show('Failed to delete', 'error');
      console.error(err);
    }
  },

  updateStorageBar() {
    const totalSize = this.items.reduce((sum, i) => sum + (i.size || 0), 0);
    const maxStorage = 1024 * 1024 * 100; // 100 MB
    const percent = Math.min((totalSize / maxStorage) * 100, 100);
    document.getElementById('storage-fill').style.width = percent + '%';
    document.getElementById('storage-label').textContent = `Storage: ${this.formatSize(totalSize)} / ${this.formatSize(maxStorage)}`;
  },

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};

document.addEventListener('DOMContentLoaded', () => EXPLORER.init());