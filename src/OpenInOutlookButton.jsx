import { useState } from 'react';
import { getGraphAccessToken, isMicrosoftLoginConfigured } from './msalConfig.js';

function encodeBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export default function OpenInOutlookButton({ blobName }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');

  const openInOutlook = async () => {
    const outlookTab = window.open('about:blank', '_blank');
    if (outlookTab) {
      outlookTab.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening Outlook</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7f4;color:#294d34;font:16px Arial,sans-serif}.loading{display:flex;align-items:center;gap:14px;padding:24px}.spinner{width:22px;height:22px;border:3px solid #d8e4d9;border-top-color:#2e6842;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><main class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Preparing your Outlook draft…</span></main></body></html>`);
      outlookTab.document.close();
    }
    setBusy(true);
    setError('');
    setFallbackUrl('');
    try {
      const accessToken = await getGraphAccessToken();

      const mimeResponse = await fetch(`/api/file/email-mime/${encodeURIComponent(blobName)}`);
      if (!mimeResponse.ok) {
        const problem = await mimeResponse.json().catch(() => null);
        throw new Error(problem?.error || `Could not prepare email (${mimeResponse.status})`);
      }
      const mime = new Uint8Array(await mimeResponse.arrayBuffer());
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
        body: encodeBase64(mime),
      });
      const draft = await graphResponse.json().catch(() => null);
      if (!graphResponse.ok) throw new Error(draft?.error?.message || `Microsoft Graph failed (${graphResponse.status})`);
      if (!draft?.webLink) throw new Error('Graph created the draft but did not return an Outlook link.');

      if (outlookTab) outlookTab.location.href = draft.webLink;
      else setFallbackUrl(draft.webLink);
    } catch (cause) {
      outlookTab?.close();
      setError(cause.message || 'Could not open this email in Outlook.');
    } finally {
      setBusy(false);
    }
  };

  return <span className="outlook-action">
    <button type="button" className="preview-mode" onClick={openInOutlook} disabled={busy || !isMicrosoftLoginConfigured} title={!isMicrosoftLoginConfigured ? 'Microsoft sign-in is not configured' : undefined}>
      {busy ? 'Creating Outlook draft…' : 'Open in Outlook'}
    </button>
    {!isMicrosoftLoginConfigured && <small>Configure Entra IDs to enable</small>}
    {error && <small className="outlook-error" role="alert">{error}</small>}
    {fallbackUrl && <a className="action-link" href={fallbackUrl} target="_blank" rel="noopener noreferrer">Open Outlook draft</a>}
  </span>;
}
