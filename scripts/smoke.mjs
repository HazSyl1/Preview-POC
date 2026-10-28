import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const api = process.env.PREVIEW_API_URL || 'http://localhost:5050';
const samples = join(process.cwd(), 'backend', 'Preview.Api', 'samples');

async function request(path, options) {
  const response = await fetch(api + path, options);
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response;
}

const list = await (await request('/api/files')).json();
for (const name of ['sample-pdf.pdf', 'sample-word.docx', 'sample-excel.xlsx', 'sample-slides.pptx', 'sample-notes.txt', 'sample-image.png']) {
  assert.ok(list.includes(name), `${name} was not generated`);
}

for (const [name, processed, total, lastContent] of [
  ['sample-word.docx', 7, 7, 'page 7'],
  ['sample-excel.xlsx', 3, 3, 'This second sheet is included'],
  ['sample-slides.pptx', 7, 7, 'slide 7'],
]) {
  const path = `/api/file/preview-html/${name}`;
  const first = await (await request(path)).json();
  assert.equal(first.type, 'html');
  assert.equal(first.stats.pagesProcessed, processed);
  assert.equal(first.stats.totalPages, total);
  assert.equal(typeof first.stats.cacheHit, 'boolean');
  assert.ok(first.stats.originalFileSizeBytes > 0);
  assert.equal(first.stats.convertedSizeBytes, Buffer.byteLength(first.content, 'utf8'));
  assert.ok(first.content.includes(lastContent), `${name}: final content is missing`);
  const repeat = await (await request(path)).json();
  assert.equal(repeat.stats.cacheHit, true);
  assert.equal(repeat.content, first.content);
  console.log(`${name}: HTML ${processed}/${total}, ${first.stats.convertedSizeBytes} bytes, ${first.stats.conversionTimeMs} ms, cache HIT on repeat`);
}
const pdfNote = await (await request('/api/file/preview-html/sample-pdf.pdf')).json();
assert.equal(pdfNote.type, 'pdf');
assert.equal(pdfNote.content, null);
assert.equal((await fetch(`${api}/api/file/preview-html/sample-notes.txt`)).status, 400);
if (process.env.CHECK_LARGE_HTML === '1' && list.includes('40mb.xlsx')) {
  const large = await fetch(`${api}/api/file/preview-html/40mb.xlsx`);
  assert.equal(large.status, 413);
  console.log('40mb.xlsx: full HTML exceeds the JSON preview size limit (413)');
}

for (const [name, type, minimumPages] of [
  ['sample-pdf.pdf', 'application/pdf', 1],
  ['sample-word.docx', 'application/pdf', 7],
  ['sample-excel.xlsx', 'application/pdf', 2],
  ['sample-slides.pptx', 'application/pdf', 7],
  ['sample-notes.txt', 'text/plain', null],
  ['sample-image.png', 'image/png', null],
]) {
  const response = await request(`/api/file/preview/${name}`);
  assert.ok(response.headers.get('content-type')?.startsWith(type), `${name}: wrong type`);
  const body = Buffer.from(await response.arrayBuffer());
  if (type === 'application/pdf') {
    assert.ok(body.toString('ascii', 0, 5) === '%PDF-', `${name}: no PDF header`);
    const pdf = await getDocument({ data: new Uint8Array(body), useSystemFonts: true }).promise;
    assert.ok(pdf.numPages >= minimumPages, `${name}: expected at least ${minimumPages} PDF pages, got ${pdf.numPages}`);
    if (name === 'sample-excel.xlsx') {
      const pageText = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pageText.push(content.items.map((item) => item.str).join(' '));
      }
      assert.ok(pageText.some((text) => text.toLowerCase().includes('first sheet')), 'First Excel sheet missing');
      assert.ok(pageText.some((text) => text.toLowerCase().includes('second sheet')), 'Second Excel sheet missing');
    }
  }
  console.log(`${name}: ${response.status}, ${body.length} bytes, ${type}`);
}

const repeat = await request('/api/file/preview/sample-word.docx');
assert.equal(repeat.headers.get('x-preview-cache'), 'HIT');
await repeat.arrayBuffer();
console.log('Word repeat request: cache HIT');

const partial = await request('/api/file/preview/sample-pdf.pdf', { headers: { Range: 'bytes=0-99' } });
assert.equal(partial.status, 206);
assert.equal((await partial.arrayBuffer()).byteLength, 100);
console.log('PDF byte-range request: 206');

const upload = await request('/api/files', {
  method: 'POST',
  headers: { 'X-File-Name': encodeURIComponent('smoke-test.txt'), 'Content-Type': 'application/octet-stream' },
  body: 'Hello from the upload smoke test',
});
const { name } = await upload.json();
try {
  assert.equal(await (await request(`/api/file/preview/${name}`)).text(), 'Hello from the upload smoke test');
  assert.equal((await readFile(join(samples, name), 'utf8')), 'Hello from the upload smoke test');
  console.log('Local upload and preview: OK');
} finally {
  await unlink(join(samples, name));
}

const missing = await fetch(`${api}/api/file/info/does-not-exist.pdf`);
assert.equal(missing.status, 404);
console.log('Missing file: 404');
