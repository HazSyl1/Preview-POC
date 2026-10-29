import { useEffect, useState } from 'react';

const formatSize = (bytes) => bytes < 1024
  ? `${bytes} B`
  : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function HtmlPreview({ blobName, attempt }) {
  const [result, setResult] = useState({ status: 'loading', content: '', stats: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ status: 'loading', content: '', stats: null, error: '' });
    fetch(`/api/file/preview-html/${encodeURIComponent(blobName)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || `HTML preview failed (${response.status})`);
        if (body?.type !== 'html') throw new Error(body?.message || 'HTML preview is unavailable');
        return body;
      })
      .then(({ content, stats }) => setResult({ status: 'ready', content, stats, error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ status: 'error', content: '', stats: null, error: error.message });
      });
    return () => controller.abort();
  }, [blobName, attempt]);

  const unit = /\.xls(x)?$/i.test(blobName) ? 'sheets' : /\.ppt(x)?$/i.test(blobName) ? 'slides' : /\.(eml|msg)$/i.test(blobName) ? 'messages' : 'pages';
  const { stats } = result;

  return <div className="html-preview">
    {result.status === 'loading' && <p className="viewer-message" role="status">Converting the full file…</p>}
    {result.status === 'error' && <div className="preview-error" role="alert">{result.error}</div>}
    {stats && <div className="html-stats" aria-label="HTML preview performance stats">
      <span>Original <strong>{formatSize(stats.originalFileSizeBytes)}</strong><small>{stats.originalFileSizeBytes.toLocaleString()} bytes</small></span>
      <span>HTML <strong>{formatSize(stats.convertedSizeBytes)}</strong><small>{stats.convertedSizeBytes.toLocaleString()} bytes</small></span>
      <span>Conversion <strong>{stats.conversionTimeMs.toLocaleString()} ms</strong></span>
      <span>Cache <strong>{stats.cacheHit ? 'Hit' : 'Miss'}</strong></span>
      <span>{unit[0].toUpperCase() + unit.slice(1)} <strong>{stats.pagesProcessed} / {stats.totalPages}</strong></span>
    </div>}
    {result.status === 'ready' && <iframe
      key={`${blobName}:${attempt}`}
      className="html-frame"
      title={`Full HTML preview of ${blobName}`}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={result.content}
    />}
  </div>;
}
