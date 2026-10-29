import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function TextPreview({ blobName, attempt, kind, onReady }) {
  const [result, setResult] = useState({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ status: 'loading' });
    fetch(`/api/file/preview-text/${encodeURIComponent(blobName)}?attempt=${attempt}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Text preview failed (${response.status})`);
        setResult({ status: 'ready', data });
        onReady();
      })
      .catch((error) => { if (error.name !== 'AbortError') setResult({ status: 'error', error: error.message }); });
    return () => controller.abort();
  }, [blobName, attempt]);

  if (result.status === 'loading') return <p className="viewer-message">Loading text…</p>;
  if (result.status === 'error') return <div className="preview-error" role="alert">{result.error}</div>;
  const { content, parseWarning } = result.data;
  return <div className="text-preview">
    {parseWarning && <div className="preview-error" role="alert">{parseWarning}</div>}
    {kind === 'markdown'
      ? <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
        img: ({ alt }) => <span className="blocked-image">[Image: {alt || 'remote image blocked'}]</span>,
        a: ({ href, children }) => /^https?:\/\//i.test(href || '') || /^mailto:/i.test(href || '')
          ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      }}>{content}</ReactMarkdown></div>
      : <pre className="source-text"><code>{content}</code></pre>}
  </div>;
}
