import { useEffect, useState } from 'react';
import FilePreview from './FilePreview.jsx';

const labelFor = (name) => name.split('/').at(-1);
const formatBytes = (bytes) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function App() {
  const [available, setAvailable] = useState([]);
  const [blobInput, setBlobInput] = useState('');
  const [selected, setSelected] = useState('');
  const [info, setInfo] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const preview = (name) => {
    setSelected(name);
    setAttempt((value) => value + 1);
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.error || problem?.detail || `Upload failed (${response.status})`);
      }
      const result = await response.json();
      setAvailable((current) => [...new Set([...current, result.name])].sort());
      setBlobInput(result.name);
      preview(result.name);
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetch('/api/files').then((response) => response.ok ? response.json() : []).then(setAvailable).catch(() => setAvailable([]));
  }, []);
  useEffect(() => {
    if (!selected) { setInfo(null); return; }
    const controller = new AbortController();
    fetch(`/api/file/info/${encodeURIComponent(selected)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then(setInfo).catch(() => setInfo(null));
    return () => controller.abort();
  }, [selected]);

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true">P</span><span>FILE<span className="brand-light">/preview</span></span></div><span className="topbar-tag">Proof of concept</span></header>
    <main className="main-content">
      <section className="intro" aria-labelledby="page-title"><div className="eyebrow"><span className="eyebrow-dot"/> STORAGE → BACKEND → BROWSER</div><h1 id="page-title">Preview any file.<br/><em>Keep the flow moving.</em></h1><p>Compare HTML and PDF previews of Office files, and view emails, text, Markdown, XML, PDFs, and images.</p></section>
      <section className="workspace" aria-label="File preview workspace">
        <aside className="controls-panel">
          <div className="section-heading"><span className="step">01</span><div><h2>Choose a file</h2><p>PDF · Office · email · text · Markdown · XML · image</p></div></div>
          <label className="upload-control" htmlFor="upload-input"><strong>{uploading ? 'Adding file…' : 'Add your own file'}</strong><span>Files are copied into the local demo folder</span><input id="upload-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.xml,.eml,.msg" disabled={uploading} onChange={(event) => { uploadFile(event.target.files?.[0]); event.target.value = ''; }}/></label>
          {uploadError && <div className="preview-error" role="alert">{uploadError}</div>}
          <form className="blob-form" onSubmit={(event) => { event.preventDefault(); preview(blobInput.trim()); }}><label htmlFor="blob-name">Stored file name</label><input id="blob-name" value={blobInput} onChange={(event) => setBlobInput(event.target.value)} placeholder="sample-word.docx" autoComplete="off"/><button className="button button-primary" type="submit">Preview <span aria-hidden="true">↗</span></button></form>
          {available.length > 0 && <div className="sample-list"><div className="list-title">AVAILABLE LOCAL FILES</div>{available.map((name) => <button className={selected === name ? 'sample-item active' : 'sample-item'} key={name} type="button" onClick={() => { setBlobInput(name); preview(name); }}><span className="sample-type">{name.split('.').at(-1).toUpperCase()}</span><span>{labelFor(name)}</span><span aria-hidden="true">→</span></button>)}</div>}
          {selected && <div className="file-card"><div className="file-icon" aria-hidden="true">{selected.split('.').at(-1).toUpperCase()}</div><div className="file-details"><strong title={selected}>{selected}</strong><span>{info ? `${formatBytes(info.length)} · ${info.kind === 'office' ? 'Full HTML preview' : 'Preview available'}` : 'Checking file'}</span></div><button className="icon-button" type="button" aria-label="Clear preview" onClick={() => { setSelected(''); setBlobInput(''); }}>×</button></div>}
          <div className="privacy-note"><span className="privacy-icon" aria-hidden="true">✳</span><p><strong>Compare first and repeat loads</strong><br/>Select the same Office file again to see the HTML cache hit and conversion stats. Switch to Full PDF for the existing view.</p></div>
        </aside>
        <FilePreview blobName={selected} attempt={attempt}/>
      </section>
      <footer className="footer"><span>Universal File Preview POC</span><span>React · ASP.NET · Aspose · local source</span></footer>
    </main>
  </div>;
}
