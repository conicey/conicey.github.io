// api/request-token.js — Vercel serverless function
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

// 60-second in-memory cooldown (per serverless instance)
// For production, move this to Supabase too
let lastRequestTime = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cooldown check — 60 seconds between requests
  const now = Date.now();
  if (now - lastRequestTime < 60000) {
    const wait = Math.ceil((60000 - (now - lastRequestTime)) / 1000);
    return res.status(429).json({ error: `Please wait ${wait}s before requesting another token` });
  }
  lastRequestTime = now;

  // Generate token: 9-char_9-char_9-char x6 segments
  function randomSegment() {
    return crypto.randomBytes(7).toString('base64url').slice(0, 9);
  }
  const token = Array.from({ length: 6 }, randomSegment).join('_');

  // Hash it for storage
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Store hash in Supabase with 10-minute expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: dbError } = await supabase
    .from('auth_tokens')
    .insert({ token_hash: tokenHash, expires_at: expiresAt, used: false });

  if (dbError) {
    console.error('[request-token] DB error:', dbError);
    return res.status(500).json({ error: 'Failed to store token' });
  }

  // Build the email HTML — button copies token to clipboard and opens vault
  const vaultUrl = process.env.VAULT_URL || 'https://your-vault.vercel.app/vault';
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { background: #0a0a0a; color: #e0e0e0; font-family: 'JetBrains Mono', monospace; padding: 40px; }
        .box { max-width: 480px; margin: 0 auto; background: #111; border: 1px solid #222; border-radius: 8px; padding: 32px; }
        h2 { color: #fff; font-size: 18px; margin: 0 0 8px; }
        p  { color: #888; font-size: 13px; margin: 0 0 24px; }
        .btn {
          display: inline-block;
          background: #4ade80;
          color: #000;
          font-weight: 700;
          font-size: 14px;
          padding: 14px 28px;
          border-radius: 6px;
          text-decoration: none;
          cursor: pointer;
        }
        .note { margin-top: 20px; font-size: 11px; color: #555; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Vault Access Token</h2>
        <p>Click the button below. It will copy your access token to your clipboard and open the vault.</p>
        <a class="btn" href="${vaultUrl}?token=${encodeURIComponent(token)}">
          Copy Token &amp; Open Vault
        </a>
        <p class="note">This token expires in 10 minutes and can only be used once.<br>If you didn't request this, ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  const { error: emailError } = await resend.emails.send({
    from:    'Vault <onboarding@resend.dev>',
    to:      'conicey@null.net',
    subject: 'Vault Access Token',
    html:    emailHtml,
  });

  if (emailError) {
    console.error('[request-token] Email error:', emailError);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  return res.status(200).json({ success: true });
}
