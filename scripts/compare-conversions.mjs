import { mkdir, readFile, writeFile } from 'node:fs/promises';

const api = process.env.PREVIEW_API_URL || 'http://localhost:5050';
const args = process.argv.slice(2);
const formatOnly = args[0] === '--format-only';
const emailsOnly = args[0] === '--emails';
const defaultNames = [
  'sample-word.docx',
  'React Boilerplate Walkthrough & Agent Overview.docx',
  'sample-excel.xlsx',
  'Excel-sample1.xlsx',
  'Excel-sample2.xlsx',
  '20mb.xlsx',
  'sample-slides.pptx',
  'AI-Hackathon-Proposal-Template-EPAM.pptx',
  '40mb.xlsx',
  'sample-email.eml',
  'sample-outlook.msg',
];
const names = formatOnly ? [] : emailsOnly
  ? (await (await fetch(`${api}/api/files`)).json()).filter((name) => /\.(eml|msg)$/i.test(name))
  : args.length ? args : defaultNames;
const saved = (formatOnly || args.length)
  ? JSON.parse(await readFile('artifacts/conversion-comparison.json', 'utf8'))
  : null;

const elapsed = (started) => Math.round(performance.now() - started);
const overflowBytes = (message) => {
  const match = /export is ([\d,]+) bytes/i.exec(message || '');
  return match ? Number(match[1].replaceAll(',', '')) : null;
};

async function fileInfo(name) {
  const response = await fetch(`${api}/api/file/info/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`${name}: file info returned HTTP ${response.status}`);
  const info = await response.json();
  if (!['office', 'email'].includes(info.kind)) throw new Error(`${name}: expected an Office or email file`);
  return info;
}

async function measureHtml(name) {
  const started = performance.now();
  try {
    const response = await fetch(`${api}/api/file/preview-html/${encodeURIComponent(name)}`);
    const body = await response.json().catch(() => null);
    const requestTimeMs = elapsed(started);
    if (!response.ok || body?.type !== 'html')
      return { error: body?.error || body?.message || `HTTP ${response.status}`, httpStatus: response.status, requestTimeMs, generatedSizeBytes: overflowBytes(body?.error) };
    return {
      sizeBytes: body.stats.convertedSizeBytes,
      conversionTimeMs: body.stats.conversionTimeMs,
      requestTimeMs,
      processed: body.stats.pagesProcessed,
      total: body.stats.totalPages,
    };
  } catch (error) {
    return { error: error.message, requestTimeMs: elapsed(started) };
  }
}

async function measurePdf(name, originalSizeBytes, kind) {
  if (kind === 'office' && originalSizeBytes >= 30 * 1024 * 1024)
    return { skipped: true, error: 'Full PDF conversion skipped after the 40 MB trial failed above 7 GB of API working memory.', requestTimeMs: null };
  const rangeOnly = originalSizeBytes >= 10 * 1024 * 1024;
  const started = performance.now();
  try {
    const response = await fetch(`${api}/api/file/preview/${encodeURIComponent(name)}`,
      rangeOnly ? { headers: { Range: 'bytes=0-0' } } : undefined);
    if (!response.ok) return { error: `HTTP ${response.status}`, httpStatus: response.status, requestTimeMs: elapsed(started) };
    if (rangeOnly && response.status !== 206) throw new Error(`Expected a PDF range response, got HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const requestTimeMs = elapsed(started);
    const sizeBytes = Number(response.headers.get('X-Preview-Size-Bytes'));
    const conversionTimeMs = Number(response.headers.get('X-Preview-Conversion-Time-Ms'));
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || !Number.isFinite(conversionTimeMs))
      throw new Error('PDF conversion stats are missing');
    if (!rangeOnly && sizeBytes !== bytes.length) throw new Error('PDF size header does not match the response');

    return {
      sizeBytes,
      conversionTimeMs,
      requestTimeMs,
      requestMode: rangeOnly ? 'range (first byte)' : 'full download',
    };
  } catch (error) {
    return { error: error.message, requestTimeMs: elapsed(started) };
  }
}

const results = saved?.results ?? [];
for (const result of results) {
  if (!result.html.error && result.html.processed !== result.html.total)
    throw new Error(`${result.name}: saved HTML result is partial; rerun full-file conversion before formatting the report`);
}
if (!formatOnly) {
  for (const name of names) {
    const info = await fileInfo(name);
    console.log(`Measuring ${name} (${info.length.toLocaleString('en-US')} bytes)...`);
    const html = await measureHtml(name);
    if (!html.error && html.processed !== html.total)
      throw new Error(`${name}: HTML conversion processed ${html.processed} of ${html.total}; full-file export is required`);
    const pdf = await measurePdf(name, info.length, info.kind);
    const entry = { name, type: name.split('.').at(-1).toUpperCase(), originalSizeBytes: info.length, evaluationMode: info.evaluationMode, html, pdf };
    const previous = results.findIndex((item) => item.name === name);
    if (previous >= 0) results[previous] = entry;
    else results.push(entry);
    console.log(`  HTML: ${html.error ? `error: ${html.error}` : `${html.sizeBytes.toLocaleString('en-US')} bytes`}; PDF: ${pdf.error ? `error: ${pdf.error}` : `${pdf.sizeBytes.toLocaleString('en-US')} bytes`}`);
  }
}

const formatBytes = (bytes) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
  : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${bytes} B`;
const exactSize = (bytes) => `${bytes.toLocaleString('en-US')} bytes (${formatBytes(bytes)})`;
const safe = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
function metricRow(format, metric, evaluationMode = false) {
  if (metric.error) {
    const generatedSizeBytes = metric.generatedSizeBytes ?? (format === 'HTML' ? overflowBytes(metric.error) : null);
    const output = generatedSizeBytes === null ? '—' : `${exactSize(generatedSizeBytes)} (not served)`;
    const result = metric.skipped ? 'Not measured' : metric.httpStatus === 413 ? 'HTTP 413: response too large' : `Error${metric.httpStatus ? ` ${metric.httpStatus}` : ''}: ${metric.error}`;
    return `| ${format} | ${output} | — | ${metric.requestTimeMs === null ? '—' : `${metric.requestTimeMs.toLocaleString('en-US')} ms`} | ${safe(result)} |`;
  }
  return `| ${format} | ${exactSize(metric.sizeBytes)} | ${metric.conversionTimeMs.toLocaleString('en-US')} ms | ${metric.requestTimeMs.toLocaleString('en-US')} ms | ${evaluationMode ? 'Aspose.Email evaluation mode' : 'Complete'} |`;
}

const generatedAt = formatOnly ? saved.generatedAt : new Date().toISOString();
const lines = [
  '# File conversion comparison',
  '',
  `Measured: ${generatedAt}`,
  '',
  'HTML and PDF conversions cover the complete source document or email body. Email attachment names are included; attachment contents are not rendered. The values are a snapshot of the endpoints at measurement time.',
  '',
];
const largeExcel = results.filter((item) => (item.type === 'XLS' || item.type === 'XLSX') && item.originalSizeBytes >= 10 * 1024 * 1024);
if (largeExcel.length) {
  lines.push(
    '## Large Excel files',
    '',
    '| File | Original | HTML output | HTML conversion | PDF output | PDF conversion |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  );
  for (const { name, originalSizeBytes, html, pdf } of largeExcel) {
    const overflowSize = html.generatedSizeBytes ?? overflowBytes(html.error);
    const htmlOutput = html.error
      ? overflowSize === null ? `Error ${html.httpStatus ?? ''}` : `${formatBytes(overflowSize)} generated; HTTP ${html.httpStatus}`
      : formatBytes(html.sizeBytes);
    lines.push(`| ${safe(name)} | ${formatBytes(originalSizeBytes)} | ${htmlOutput} | ${html.error ? '—' : `${html.conversionTimeMs.toLocaleString('en-US')} ms`} | ${pdf.error ? 'Not measured' : formatBytes(pdf.sizeBytes)} | ${pdf.error ? '—' : `${pdf.conversionTimeMs.toLocaleString('en-US')} ms`} |`);
  }
  if (largeExcel.some((item) => item.name === '40mb.xlsx'))
    lines.push('', 'The 40 MB HTML output exceeded the endpoint’s 100 MiB JSON limit and was not served. Its full PDF conversion was attempted but the request failed after API working memory exceeded 7 GB.', '');
}
for (const type of [...new Set(results.map((item) => item.type))]) {
  lines.push(`## ${type}`, '');
  for (const { name, originalSizeBytes, evaluationMode, html, pdf } of results.filter((item) => item.type === type)) {
    lines.push(
      `### ${safe(name)}`,
      '',
      `Original: **${exactSize(originalSizeBytes)}**`,
      '',
      '| Format | Output | Conversion | Request | Result |',
      '| --- | ---: | ---: | ---: | --- |',
      metricRow('HTML', html, evaluationMode),
      metricRow('PDF', pdf, evaluationMode),
      '',
    );
  }
}
lines.push(
  '**Timing:** Conversion is the server-recorded export time; request is the measured time to receive the response.',
  '',
  '**Large PDFs:** For inputs from 10 to 30 MiB, the script requests only the first PDF byte. This still triggers full server conversion and reports the complete output size and conversion time, while avoiding a large download.',
  '',
);

await mkdir('artifacts', { recursive: true });
for (const result of results) {
  delete result.html.cacheHit;
  delete result.pdf.cacheHit;
}
await writeFile('artifacts/conversion-comparison.json', JSON.stringify({ generatedAt, results }, null, 2));
await writeFile('artifacts/conversion-report.md', lines.join('\n'));
console.log(formatOnly ? 'Formatted artifacts/conversion-report.md from saved JSON' : 'Saved artifacts/conversion-report.md and artifacts/conversion-comparison.json');
