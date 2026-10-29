import { useEffect, useState } from 'react';

export default function EmailPreview({ blobName, attempt, onReady }) {
  const [result, setResult] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ status: 'loading' });
    fetch(`/api/file/preview-email/${encodeURIComponent(blobName)}?attempt=${attempt}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Email preview failed (${response.status})`);
        setResult({ status: 'ready', data });
        onReady();
      })
      .catch((error) => { if (error.name !== 'AbortError') setResult({ status: 'error', error: error.message }); });
    return () => controller.abort();
  }, [blobName, attempt]);

  if (result.status === 'loading') return <p className="viewer-message">Opening email…</p>;
  if (result.status === 'error') return <div className="preview-error" role="alert">{result.error}</div>;
  const email = result.data;
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'"><style>body{font:14px/1.55 Arial,sans-serif;color:#243329;margin:24px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${email.bodyHtml}</body></html>`;
  return <div className="email-preview">
    <div className="email-headers">
      <h3>{email.subject || '(No subject)'}</h3>
      <dl><dt>From</dt><dd>{email.from || '—'}</dd><dt>To</dt><dd>{email.to || '—'}</dd>
        {email.cc && <><dt>Cc</dt><dd>{email.cc}</dd></>}
        {email.date && <><dt>Date</dt><dd>{new Date(email.date).toLocaleString()}</dd></>}</dl>
    </div>
    {email.bodyHtml ? <iframe className="email-frame" sandbox="" title={`Email body of ${blobName}`} srcDoc={srcDoc}/>
      : <pre className="source-text email-text">{email.bodyText || '(Empty message)'}</pre>}
    <div className="email-attachments"><strong>Attachments ({email.attachmentNames.length})</strong>
      {email.attachmentNames.length > 0 && <ul>{email.attachmentNames.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul>}
    </div>
  </div>;
}
