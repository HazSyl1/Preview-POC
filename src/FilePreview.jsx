import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import HtmlPreview from './HtmlPreview.jsx';
import TextPreview from './TextPreview.jsx';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
const pdfOptions = { disableStream: true, disableAutoFetch: true };
const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function FilePreview({ blobName, attempt }) {
  const [state, setState] = useState({ status: 'idle', info: null, error: '', name: '' });
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [pageDraft, setPageDraft] = useState('1');
  const [width, setWidth] = useState(760);
  const [convertedSize, setConvertedSize] = useState({ status: 'idle', bytes: null });
  const [mode, setMode] = useState('html');
  const viewerRef = useRef(null);

  useEffect(() => setPageDraft(String(pageNumber)), [pageNumber]);

  const commitPage = () => {
    const requested = Number.parseInt(pageDraft, 10);
    if (!Number.isFinite(requested)) {
      setPageDraft(String(pageNumber));
      return;
    }
    const nextPage = Math.min(pageCount, Math.max(1, requested));
    setPageNumber(nextPage);
    setPageDraft(String(nextPage));
  };

  useEffect(() => {
    if (!viewerRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, [state.info]);

  useEffect(() => {
    if (!blobName) {
      setState({ status: 'idle', info: null, error: '', name: '' });
      return;
    }
    const controller = new AbortController();
    setConvertedSize({ status: 'idle', bytes: null });
    setMode('html');
    setPageCount(0);
    setPageNumber(1);
    setState({ status: 'checking', info: null, error: '', name: blobName });
    fetch(`/api/file/info/${encodeURIComponent(blobName)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const problem = await response.json().catch(() => null);
          throw new Error(problem?.error || `Preview request failed (${response.status})`);
        }
        return response.json();
      })
      .then((info) => setState({ status: 'loading', info, error: '', name: blobName }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', info: null, error: error.message, name: blobName });
      });
    return () => controller.abort();
  }, [blobName, attempt]);

  const previewUrl = blobName ? `/api/file/preview/${encodeURIComponent(blobName)}?attempt=${attempt}` : '';
  const openHtmlUrl = blobName ? `/api/file/preview-html/${encodeURIComponent(blobName)}?open=1` : '';
  const info = state.name === blobName ? state.info : null;
  const isConvertible = info?.kind === 'office' || info?.kind === 'email';
  useEffect(() => {
    if (!isConvertible || mode !== 'pdf') return;
    const controller = new AbortController();
    setConvertedSize({ status: 'loading', bytes: null });
    fetch(previewUrl, { headers: { Range: 'bytes=0-0' }, signal: controller.signal })
      .then(async (response) => {
        if (response.status !== 206) throw new Error(`PDF size request failed (${response.status})`);
        const bytes = Number(response.headers.get('X-Preview-Size-Bytes'));
        const conversionTimeMs = Number(response.headers.get('X-Preview-Conversion-Time-Ms'));
        const cacheHit = response.headers.get('X-Preview-Cache') === 'HIT';
        await response.body?.cancel();
        if (!Number.isFinite(bytes) || bytes <= 0) throw new Error('PDF size is unavailable');
        setConvertedSize({ status: 'ready', bytes, conversionTimeMs, cacheHit });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setConvertedSize({ status: 'error', bytes: null });
      });
    return () => controller.abort();
  }, [isConvertible, blobName, attempt, mode]);
  const isPdf = info?.kind === 'pdf' || (isConvertible && mode === 'pdf');
  const statusText = isConvertible && mode === 'html' ? 'Full HTML preview' : state.status === 'idle' ? 'Choose a stored file' : state.status === 'checking' ? 'Checking file…' : state.status === 'loading' ? 'Rendering preview…' : state.status === 'error' ? 'Preview unavailable' : 'Ready to review';

  return <section className="preview-panel" aria-labelledby="preview-title">
    <div className="preview-toolbar">
      <div className="preview-title-group"><span className="step">02</span><div><h2 id="preview-title">Document preview</h2><span className="status" role="status">{statusText}</span></div></div>
      {info && <div className="preview-actions">{isConvertible && <><button type="button" aria-pressed={mode === 'html'} className={mode === 'html' ? 'preview-mode active' : 'preview-mode'} onClick={() => setMode('html')}>Full HTML</button><button type="button" aria-pressed={mode === 'pdf'} className={mode === 'pdf' ? 'preview-mode active' : 'preview-mode'} onClick={() => setMode('pdf')}>Full PDF</button></>}<a className="action-link" href={isConvertible && mode === 'html' ? openHtmlUrl : previewUrl} target="_blank" rel="noopener noreferrer">{isConvertible && mode === 'html' ? 'Open HTML ↗' : isConvertible || info.kind === 'pdf' ? 'Open PDF ↗' : 'Open file ↗'}</a></div>}
    </div>
    {isConvertible && <div className="preview-sizes">{info.kind === 'email' ? `Full email view as ${mode.toUpperCase()}; attachment names are included.` : mode === 'html' ? 'Full view: all pages, slides, and sheets as HTML.' : 'Full view: all pages, slides, and sheets as PDF.'}</div>}
    {info?.kind === 'email' && info.evaluationMode && <div className="preview-sizes">Aspose.Email evaluation mode is active. Add an Aspose.Email license for unrestricted previews.</div>}
    {info && !isConvertible && <div className="preview-sizes"><span>Original: <strong>{formatSize(info.length)}</strong></span></div>}
    {isConvertible && mode === 'pdf' && <div className="html-stats" aria-label="PDF conversion performance stats">
      <span>Original <strong>{formatSize(info.length)}</strong><small>{info.length.toLocaleString()} bytes</small></span>
      <span>PDF <strong>{convertedSize.status === 'ready' ? formatSize(convertedSize.bytes) : convertedSize.status === 'error' ? 'Unavailable' : 'Calculating…'}</strong>{convertedSize.status === 'ready' && <small>{convertedSize.bytes.toLocaleString()} bytes</small>}</span>
      <span>Conversion <strong>{convertedSize.status === 'ready' ? `${convertedSize.conversionTimeMs.toLocaleString()} ms` : '—'}</strong></span>
      <span>Cache <strong>{convertedSize.status === 'ready' ? convertedSize.cacheHit ? 'Hit' : 'Miss' : '—'}</strong></span>
      <span>PDF pages <strong>{pageCount || '—'}</strong></span>
    </div>}
    {state.status === 'error' && <div className="preview-error" role="alert">{state.error}</div>}
    {!info && state.status !== 'error' && <div className="preview-empty"><div className="paper-stack" aria-hidden="true"><div className="paper paper-back"/><div className="paper paper-front"><div className="paper-header"><span/><span/></div><div className="paper-line wide"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-block"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-stamp">FILE</div></div></div><h3>Preview from storage</h3><p>Select a file to render it in the browser.</p></div>}
    {isConvertible && mode === 'html' && <HtmlPreview blobName={blobName} attempt={attempt} emailEvaluationMode={info.kind === 'email' && info.evaluationMode}/>}
    {isPdf && <div className="react-pdf-viewer" ref={viewerRef}>
      {pageCount > 0 && <div className="page-controls"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)}>← Previous</button><span>Page {pageNumber} of {pageCount}</span><button type="button" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((value) => value + 1)}>Next →</button><label className="page-jump">Jump to <input type="number" min="1" max={pageCount} value={pageDraft} aria-label="Page number" onChange={(event) => setPageDraft(event.target.value)} onBlur={commitPage} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setPageDraft(String(pageNumber)); }}/></label></div>}
      <Document key={previewUrl} file={previewUrl} options={pdfOptions} suspense={false} loading={<p className="viewer-message">Loading PDF…</p>} error={<p className="viewer-message error-message">Could not render this PDF.</p>} onLoadSuccess={({ numPages }) => { setPageCount(numPages); setState((current) => ({ ...current, status: 'ready' })); }} onLoadError={(error) => setState((current) => ({ ...current, status: 'error', error: error.message }))}>
        <Page pageNumber={pageNumber} width={Math.max(240, Math.min(760, width - 48))} renderTextLayer renderAnnotationLayer loading={<p className="viewer-message">Rendering page…</p>}/>
      </Document>
    </div>}
    {info?.kind === 'image' && <div className="image-preview"><img src={previewUrl} alt={`Preview of ${blobName}`} onLoad={() => setState((current) => ({ ...current, status: 'ready' }))}/></div>}
    {['text', 'markdown', 'xml'].includes(info?.kind) && <TextPreview blobName={blobName} attempt={attempt} kind={info.kind} onReady={() => setState((current) => ({ ...current, status: 'ready' }))}/>}
  </section>;
}
