/**
 * app.js — Application bootstrap
 *
 * Temporary frontend-only boot logic.
 * No backend yet. Simulates auth + loads demo data.
 *
 * TODO(backend): Replace ALL fake auth and mock data with Supabase.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────
  // DOM refs
  // ─────────────────────────────────────────────
  const loginScreen = document.getElementById('screen-login');
  const vaultScreen = document.getElementById('screen-vault');

  const step1 = document.getElementById('login-step-1');
  const step2 = document.getElementById('login-step-2');

  const btnRequest = document.getElementById('btn-request-token');
  const btnUnlock  = document.getElementById('btn-unlock');
  const btnBack    = document.getElementById('btn-back');
  const btnLock    = document.getElementById('btn-lock');

  const tokenInput = document.getElementById('token-input');
  const countdown  = document.getElementById('login-countdown');

  // ─────────────────────────────────────────────
  // INIT MODULES
  // ─────────────────────────────────────────────
  Toast.init();
  Modal.init();
  Explorer.init();

  // ─────────────────────────────────────────────
  // SUPABASE FUNCTIONS (NEW STEP 2)
  // ─────────────────────────────────────────────
  async function loadItems() {
    const { data, error } = await supabase
      .from('files')
      .select('*');

    if (error) throw error;
    return data;
  }

  async function createItem(item) {
    const { data, error } = await supabase
      .from('files')
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─────────────────────────────────────────────
  // LOGIN FLOW
  // ─────────────────────────────────────────────
  btnRequest.addEventListener('click', () => {
    step1.classList.remove('active');
    step2.classList.add('active');

    step1.setAttribute('aria-hidden', 'true');
    step2.setAttribute('aria-hidden', 'false');

    startCountdown(300);
    Toast.show('Temporary token generated');
  });

  tokenInput.addEventListener('input', () => {
    btnUnlock.disabled = tokenInput.value.trim().length < 4;
  });

  btnBack.addEventListener('click', () => {
    step2.classList.remove('active');
    step1.classList.add('active');

    tokenInput.value  = '';
    btnUnlock.disabled = true;
  });

  btnUnlock.addEventListener('click', async () => {

    // TEMP AUTH
    State.set('sessionToken', 'temporary-session');

    loginScreen.classList.add('hidden');
    vaultScreen.classList.remove('hidden');

    // ─────────────────────────────────────────────
    // STEP 2: LOAD FROM SUPABASE (REPLACES MOCK DATA)
    // ─────────────────────────────────────────────
    try {
      const items = await loadItems();

      State.set('items', items);

      Explorer.renderAll();

      console.log("Loaded from Supabase:", items);

    } catch (err) {
      console.error("Failed to load Supabase data:", err);

      // fallback to mock data if DB fails
      loadMockData();
      Explorer.renderAll();
    }

    Toast.show('Vault unlocked');
  });

  // ─────────────────────────────────────────────
  // LOCK VAULT
  // ─────────────────────────────────────────────
  btnLock.addEventListener('click', () => {
    State.set('sessionToken', null);

    vaultScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');

    tokenInput.value = '';
    Toast.show('Vault locked');
  });

  // ─────────────────────────────────────────────
  // COUNTDOWN TIMER
  // ─────────────────────────────────────────────
  function startCountdown(seconds) {
    let remaining = seconds;

    const interval = setInterval(() => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;

      countdown.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      remaining--;

      if (remaining < 0) {
        clearInterval(interval);
        countdown.textContent = 'Expired';
        countdown.classList.add('countdown-value--expired');
      }
    }, 1000);
  }

  // ─────────────────────────────────────────────
  // MOCK DATA (fallback only)
  // ─────────────────────────────────────────────
  function loadMockData() {
    if (State.get('items').length > 0) return;

    const now = State.now();
    const folderId = State.makeId();

    State.addItem({
      id: folderId, type: 'folder', name: 'Projects',
      parentId: null, content: null, storagePath: null,
      size: null, lang: null, createdAt: now, updatedAt: now,
    });

    State.addItem({
      id: State.makeId(), type: 'note', name: 'README.md',
      parentId: null,
      content: `# Vault\n\nTemporary frontend-only build.\n\nWaiting for Supabase backend integration.`,
      storagePath: null, size: 1200, lang: null, createdAt: now, updatedAt: now,
    });

    State.addItem({
      id: State.makeId(), type: 'code', name: 'main.js',
      parentId: folderId,
      content: `console.log("Vault initialized");`,
      storagePath: null, size: 430, lang: 'javascript', createdAt: now, updatedAt: now,
    });
  }

});
