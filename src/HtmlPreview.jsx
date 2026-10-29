import { useEffect, useState } from 'react';

const formatSize = (bytes) => bytes < 1024
  ? `${bytes} B`
  : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function emailFrameContent(content, showExternalImages) {
  const prepared = showExternalImages
    ? content.replace(/\sdata-external-src=/gi, ' src=')
    : content;
  const hiddenImages = showExternalImages
    ? '<style>img:not([src]){display:none!important}</style>'
    : '<style>img:not([src]),img[data-external-src]{display:none!important}</style>';
  return prepared.replace(/<head>/i, `<head>${hiddenImages}`);
}

export default function HtmlPreview({ blobName, attempt, emailEvaluationMode = false, showExternalImages = true, onToggleExternalImages }) {
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
  const isEmail = /\.(eml|msg)$/i.test(blobName);
  const externalImageCount = isEmail ? (result.content.match(/<img\b[^>]*\bdata-external-src="https?:\/\//gi) || []).length : 0;
  const unresolvedImageCount = isEmail ? (result.content.match(/<img\b(?![^>]*\ssrc=)(?![^>]*\sdata-external-src=)[^>]*>/gi) || []).length : 0;
  const frameContent = isEmail ? emailFrameContent(result.content, showExternalImages) : result.content;
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
    {result.status === 'ready' && externalImageCount > 0 && <div className="external-images-control">
      <button type="button" className={showExternalImages ? 'preview-mode active' : 'preview-mode'} aria-pressed={showExternalImages} onClick={onToggleExternalImages}>
        {showExternalImages ? 'Hide external images' : `Show external images (${externalImageCount})`}
      </button>
      <span>External images load from their original websites when shown.</span>
    </div>}
    {result.status === 'ready' && emailEvaluationMode && /\.msg$/i.test(blobName) && unresolvedImageCount > 0 && <div className="external-images-control" role="note">
      {unresolvedImageCount} inline image references could not be resolved. Aspose.Email evaluation mode extracts only three inline images or attachments from an MSG file; configure an Aspose.Email license to show them all.
    </div>}
    {result.status === 'ready' && <iframe
      key={`${blobName}:${attempt}:${showExternalImages}`}
      className="html-frame"
      title={`Full HTML preview of ${blobName}`}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={frameContent}
    />}
  </div>;
}
