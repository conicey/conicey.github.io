/**
 * app.js — Application bootstrap
 *
 * Handles login flow and Supabase integration.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ────────────────────────────────────────────
  // DOM refs
  // ────────────────────────────────────────────
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
  const statusDot  = document.getElementById('login-status-dot');
  const statusText = document.getElementById('login-status-text');

  // ────────────────────────────────────────────
  // INIT MODULES
  // ────────────────────────────────────────────
  Toast.init();
  Modal.init();
  EXPLORER.init();

  // ────────────────────────────────────────────
  // SUPABASE FUNCTIONS
  // ────────────────────────────────────────────
  async function loadItems() {
    const { data, error } = await window.supabaseClient
      .from('files')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  // ────────────────────────────────────────────
  // LOGIN FLOW
  // ────────────────────────────────────────────
  btnRequest.addEventListener('click', async () => {
    document.activeElement.blur();
    
    // Hide step 1, show step 2
    step1.classList.remove('active');
    step2.classList.add('active');
    step1.setAttribute('aria-hidden', 'true');
    step2.setAttribute('aria-hidden', 'false');

    // Reset inputs
    tokenInput.value = '';
    btnUnlock.disabled = true;

    // Update status
    statusDot.className = 'status-dot status-dot--ready';
    statusText.textContent = 'Ready to paste token';

    // Start countdown
    startCountdown(300);
    Toast.show('Token ready - paste it above');
  });

  tokenInput.addEventListener('input', () => {
    btnUnlock.disabled = tokenInput.value.trim().length < 4;
  });

  btnBack.addEventListener('click', () => {
    step2.classList.remove('active');
    step1.classList.add('active');
    step2.setAttribute('aria-hidden', 'true');
    step1.setAttribute('aria-hidden', 'false');

    tokenInput.value = '';
    btnUnlock.disabled = true;
  });

  btnUnlock.addEventListener('click', async () => {
    btnUnlock.disabled = true;
    
    try {
      // Temporary session token
      State.set('sessionToken', 'temporary-session-' + Date.now());

      // Switch screens
      loginScreen.classList.add('hidden');
      vaultScreen.classList.remove('hidden');

      // Load from Supabase
      try {
        const items = await loadItems();

        State.set('items', items.map(row => ({
          id:          row.id,
          type:        row.type,
          name:        row.name,
          parent_id:   row.parent_id   ?? null,
          content:     row.content     ?? null,
          storagePath: row.storage_path ?? null,
          size:        row.size        ?? null,
          created_at:  row.created_at  ?? null,
        })));

        EXPLORER.render();
        console.log('Loaded from Supabase:', items);
      } catch (err) {
        console.error('Failed to load Supabase data:', err);
        EXPLORER.render();
      }

      Toast.show('Vault unlocked');
    } catch (err) {
      console.error('Unlock error:', err);
      Toast.show('Failed to unlock vault', 'error');
      btnUnlock.disabled = false;
    }
  });

  // ────────────────────────────────────────────
  // LOCK VAULT
  // ────────────────────────────────────────────
  btnLock.addEventListener('click', () => {
    State.set('sessionToken', null);
    State.set('currentFolderId', null);
    State.set('selectedItemId', null);

    vaultScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');

    step1.classList.add('active');
    step2.classList.remove('active');
    step1.setAttribute('aria-hidden', 'false');
    step2.setAttribute('aria-hidden', 'true');

    tokenInput.value = '';
    btnUnlock.disabled = true;
    Toast.show('Vault locked');
  });

  // ────────────────────────────────────────────
  // COUNTDOWN TIMER
  // ────────────────────────────────────────────
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

});
