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
  // Init all modules  ← THIS WAS THE MISSING FIX
  // ─────────────────────────────────────────────
  Toast.init();
  Modal.init();
  Explorer.init();

  // ─────────────────────────────────────────────
  // Fake login flow (TEMP — replace with Supabase)
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

  btnUnlock.addEventListener('click', () => {
    // TEMP AUTH — replace with real Supabase JWT validation
    State.set('sessionToken', 'temporary-session');

    loginScreen.classList.add('hidden');
    vaultScreen.classList.remove('hidden');

    loadMockData();
    Explorer.renderAll();

    Toast.show('Vault unlocked');
  });

  // ─────────────────────────────────────────────
  // Lock vault
  // ─────────────────────────────────────────────
  btnLock.addEventListener('click', () => {
    State.set('sessionToken', null);

    vaultScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');

    tokenInput.value = '';
    Toast.show('Vault locked');
  });

  // ─────────────────────────────────────────────
  // Countdown timer
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
  // Mock data (TEMP — replace with Supabase fetch)
  // ─────────────────────────────────────────────
  function loadMockData() {
    if (State.get('items').length > 0) return;

    const now      = State.now();
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
