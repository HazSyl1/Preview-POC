import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: npm run inspect -- "filename.xlsx" ["another-file.docx"]');
  process.exit(1);
}

for (const name of names) {
  const url = `http://localhost:5050/api/file/preview/${encodeURIComponent(name)}`;
  const started = performance.now();
  const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.startsWith('application/pdf'))
    throw new Error(`${name}: preview response is not a PDF`);
  const conversionSeconds = ((performance.now() - started) / 1000).toFixed(1);
  const pdfBytes = response.headers.get('content-range')?.split('/')[1] || response.headers.get('content-length');
  await response.arrayBuffer();
  const loadingTask = getDocument({ url, useSystemFonts: true, disableStream: true, disableAutoFetch: true });
  const document = await loadingTask.promise;
  console.log(`${name}: ${document.numPages} PDF page${document.numPages === 1 ? '' : 's'}, ${pdfBytes} bytes, first response ${conversionSeconds}s, cache ${response.headers.get('x-preview-cache')}`);
  await loadingTask.destroy();
}
