/**
 * app.js — Application bootstrap
 * Auth: email OTP, clipboard-only unlock
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──────────────────────────────────────────────────
  const loginScreen = document.getElementById('screen-login');
  const vaultScreen = document.getElementById('screen-vault');
  const step1       = document.getElementById('login-step-1');
  const step2       = document.getElementById('login-step-2');
  const btnRequest  = document.getElementById('btn-request-token');
  const btnUnlock   = document.getElementById('btn-unlock');
  const btnBack     = document.getElementById('btn-back');
  const btnLock     = document.getElementById('btn-lock');
  const countdown   = document.getElementById('login-countdown');
  const statusDot   = document.getElementById('login-status-dot');
  const statusText  = document.getElementById('login-status-text');

  // ── Init modules ──────────────────────────────────────────────
  Toast.init();
  Modal.init();
  Explorer.init();

  let _countdownInterval = null;

  // ── Auto-unlock if token in URL (from email button) ───────────
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken  = urlParams.get('token');
  if (urlToken) {
    // Copy to clipboard silently, then show step 2 ready to unlock
    navigator.clipboard.writeText(urlToken).catch(() => {});
    // Clean URL so token isn't visible
    window.history.replaceState({}, '', window.location.pathname);
    // Show step 2 with token pre-loaded
    step1.classList.remove('active');
    step2.classList.add('active');
    step1.setAttribute('aria-hidden', 'true');
    step2.setAttribute('aria-hidden', 'false');
    statusDot.className    = 'status-dot status-dot--ready';
    statusText.textContent = 'Token copied — click Paste & Unlock';
    btnUnlock.disabled = false;
    startCountdown(600);
  }

  // ── Load items ────────────────────────────────────────────────
  async function loadItems() {
    const { data, error } = await window.supabaseClient
      .from('files').select('*');
    if (error) throw error;
    return data || [];
  }

  function normalizeRow(row) {
    return {
      id:          row.id,
      type:        row.type,
      name:        row.name,
      parentId:    row.parent_id    ?? null,
      content:     row.content      ?? null,
      storagePath: row.storage_path ?? null,
      size:        row.size         ?? null,
      lang:        row.lang         ?? null,
      sort_order:  row.sort_order   ?? 0,
      createdAt:   row.created_at   ?? null,
      updatedAt:   row.updated_at   ?? null,
    };
  }

  // ── Step 1: Request token ─────────────────────────────────────
  btnRequest.addEventListener('click', async () => {
    btnRequest.disabled    = true;
    btnRequest.textContent = 'Sending…';

    try {
      const res  = await fetch('/api/request-token', { method: 'POST' });
      const json = await res.json();

      if (!res.ok) {
        Toast.show(json.error || 'Failed to send token');
        return;
      }

      step1.classList.remove('active');
      step2.classList.add('active');
      step1.setAttribute('aria-hidden', 'true');
      step2.setAttribute('aria-hidden', 'false');

      statusDot.className    = 'status-dot status-dot--ready';
      statusText.textContent = 'Check your email';
      btnUnlock.disabled     = false;

      startCountdown(600);
      Toast.show('Token emailed — check your inbox');

    } catch (err) {
      console.error('[app] Request token failed:', err);
      Toast.show('Failed to send — try again');
    } finally {
      btnRequest.disabled    = false;
      btnRequest.textContent = 'Request Access Token';
    }
  });

  // ── Step 2: Paste & Unlock ────────────────────────────────────
  btnUnlock.addEventListener('click', async () => {
    btnUnlock.disabled     = true;
    btnUnlock.textContent  = 'Checking…';

    try {
      let token;
      try {
        token = await navigator.clipboard.readText();
      } catch {
        Toast.show('Clipboard access denied — allow it in your browser and retry');
        btnUnlock.disabled    = false;
        btnUnlock.textContent = 'Paste & Unlock';
        return;
      }

      token = token.trim();
      if (!token) {
        Toast.show('Clipboard empty — copy token from email first');
        btnUnlock.disabled    = false;
        btnUnlock.textContent = 'Paste & Unlock';
        return;
      }

      const res  = await fetch('/api/verify-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      });
      const json = await res.json();

      if (!res.ok || !json.valid) {
        Toast.show(json.error || 'Access denied');
        btnUnlock.disabled    = false;
        btnUnlock.textContent = 'Paste & Unlock';
        return;
      }

      // ── Unlock vault ──────────────────────────────────────────
      if (_countdownInterval) clearInterval(_countdownInterval);
      State.set('sessionToken', 'session-' + Date.now());
      loginScreen.classList.add('hidden');
      vaultScreen.classList.remove('hidden');

      try {
        const rows  = await loadItems();
        const items = rows.map(normalizeRow);
        State.set('items', items);
        Explorer.renderAll();
      } catch (err) {
        console.error('[app] Failed to load items:', err);
        Explorer.renderAll();
      }

      Toast.show('Vault unlocked');

    } catch (err) {
      console.error('[app] Unlock error:', err);
      Toast.show('Something went wrong — try again');
      btnUnlock.disabled    = false;
      btnUnlock.textContent = 'Paste & Unlock';
    }
  });

  // ── Back ──────────────────────────────────────────────────────
  btnBack.addEventListener('click', () => {
    if (_countdownInterval) clearInterval(_countdownInterval);
    step2.classList.remove('active');
    step1.classList.add('active');
    step2.setAttribute('aria-hidden', 'true');
    step1.setAttribute('aria-hidden', 'false');
    btnUnlock.disabled = true;
  });

  // ── Lock vault ────────────────────────────────────────────────
  btnLock.addEventListener('click', () => {
    State.logout();
    vaultScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    step1.classList.add('active');
    step2.classList.remove('active');
    step1.setAttribute('aria-hidden', 'false');
    step2.setAttribute('aria-hidden', 'true');
    btnUnlock.disabled = true;
    Toast.show('Vault locked');
  });

  // ── Countdown ─────────────────────────────────────────────────
  function startCountdown(seconds) {
    if (_countdownInterval) clearInterval(_countdownInterval);
    let remaining = seconds;
    countdown.classList.remove('countdown-value--expired');

    _countdownInterval = setInterval(() => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      countdown.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      remaining--;

      if (remaining < 0) {
        clearInterval(_countdownInterval);
        countdown.textContent = 'Expired';
        countdown.classList.add('countdown-value--expired');
        btnUnlock.disabled = true;
      }
    }, 1000);
  }

});
