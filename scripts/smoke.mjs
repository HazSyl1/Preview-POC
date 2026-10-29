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
for (const name of ['sample-pdf.pdf', 'sample-word.docx', 'sample-excel.xlsx', 'sample-slides.pptx', 'sample-notes.txt', 'sample-image.png', 'sample-markdown.md', 'sample-data.xml', 'sample-email.eml', 'sample-outlook.msg']) {
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

const eml = await (await request('/api/file/preview-email/sample-email.eml')).json();
assert.equal(eml.type, 'email');
assert.ok(eml.subject.startsWith('Email preview sample'));
assert.ok(eml.bodyHtml.includes('final message line'));
assert.ok(eml.bodyHtml.includes('data:image/png;base64,'));
assert.ok(!eml.bodyHtml.includes('tracker.example.test'));
assert.ok(!eml.bodyHtml.includes('<script'));
assert.deepEqual(eml.attachmentNames, ['notes.txt']);
const msg = await (await request('/api/file/preview-email/sample-outlook.msg')).json();
assert.equal(msg.type, 'email');
assert.ok(msg.subject.includes('HtmlSampleEmail'));
assert.ok(msg.attachmentNames.includes('SampleAttachment.pdf'));
assert.ok(msg.bodyHtml || msg.bodyText);
for (const [name, subject, attachment] of [
  ['sample-email.eml', 'Email preview sample', 'notes.txt'],
  ['sample-outlook.msg', 'HtmlSampleEmailWithAttachment', 'SampleAttachment.pdf'],
]) {
  const info = await (await request(`/api/file/info/${name}`)).json();
  assert.equal(info.kind, 'email');
  assert.equal(typeof info.evaluationMode, 'boolean');
  const html = await (await request(`/api/file/preview-html/${name}`)).json();
  assert.equal(html.type, 'html');
  assert.equal(html.stats.originalFileSizeBytes, info.length);
  assert.equal(html.stats.convertedSizeBytes, Buffer.byteLength(html.content));
  assert.equal(html.stats.pagesProcessed, 1);
  assert.equal(html.stats.totalPages, 1);
  assert.ok(html.content.includes(subject));
  assert.ok(html.content.includes(attachment));
  const repeat = await (await request(`/api/file/preview-html/${name}`)).json();
  assert.equal(repeat.stats.cacheHit, true);
  const pdfResponse = await request(`/api/file/preview/${name}`);
  assert.ok(pdfResponse.headers.get('content-type')?.startsWith('application/pdf'));
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdfBytes.toString('ascii', 0, 5), '%PDF-');
  assert.equal(Number(pdfResponse.headers.get('X-Preview-Size-Bytes')), pdfBytes.length);
  assert.ok(Number(pdfResponse.headers.get('X-Preview-Conversion-Time-Ms')) >= 0);
  const pdf = await getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise;
  assert.ok(pdf.numPages >= 1);
  const pdfText = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pdfText.push(content.items.map((item) => item.str).join(' '));
  }
  assert.ok(pdfText.join(' ').includes(subject), `${name}: PDF subject is missing`);
  assert.ok(pdfText.join(' ').includes(attachment), `${name}: PDF attachment name is missing`);
  console.log(`${name}: HTML ${html.stats.convertedSizeBytes} bytes, PDF ${pdfBytes.length} bytes / ${pdf.numPages} pages`);
}
assert.ok(eml.bodyHtml.includes('final message line'));
assert.ok(eml.bodyHtml.includes('data:image/png;base64,'));
assert.ok(!eml.bodyHtml.includes('tracker.example.test'));
assert.ok(!eml.bodyHtml.includes('<script'));
console.log('Aspose.Email HTML/PDF conversion, metadata, attachments, and sanitization: OK');

for (const [name, kind, ending] of [
  ['sample-notes.txt', 'text', 'No PDF conversion is needed.'],
  ['sample-markdown.md', 'markdown', 'The final line should be visible.'],
  ['sample-data.xml', 'xml', '</preview>'],
]) {
  const info = await (await request(`/api/file/info/${name}`)).json();
  assert.equal(info.kind, kind);
  const result = await (await request(`/api/file/preview-text/${name}`)).json();
  assert.equal(result.type, kind);
  assert.ok(result.content.trimEnd().endsWith(ending));
  assert.equal(result.parseWarning, null);
}
assert.equal((await fetch(`${api}/api/file/preview-text/sample-pdf.pdf`)).status, 400);
assert.equal((await fetch(`${api}/api/file/preview-email/sample-notes.txt`)).status, 400);

const invalidXml = await request('/api/files', { method: 'POST', headers: { 'X-File-Name': 'invalid.xml' }, body: '<root><unclosed></root>' });
const invalidXmlName = (await invalidXml.json()).name;
try {
  const result = await (await request(`/api/file/preview-text/${invalidXmlName}`)).json();
  assert.equal(result.content, '<root><unclosed></root>');
  assert.match(result.parseWarning, /could not be formatted/);
} finally { await unlink(join(samples, invalidXmlName)); }

const longText = `Start\n${'X'.repeat(200_000)}\nFinal line`;
const longUpload = await request('/api/files', { method: 'POST', headers: { 'X-File-Name': 'long.txt' }, body: longText });
const longName = (await longUpload.json()).name;
try {
  const result = await (await request(`/api/file/preview-text/${longName}`)).json();
  assert.equal(result.content, longText);
} finally { await unlink(join(samples, longName)); }
console.log('TXT, Markdown, XML, malformed XML, and full text content: OK');

const imageBytes = await readFile(join(samples, 'sample-image.png'));
for (const [extension, mime] of [['jpg', 'image/jpeg'], ['gif', 'image/gif'], ['webp', 'image/webp']]) {
  const uploaded = await request('/api/files', { method: 'POST', headers: { 'X-File-Name': `image-check.${extension}` }, body: imageBytes });
  const imageName = (await uploaded.json()).name;
  try {
    const info = await (await request(`/api/file/info/${imageName}`)).json();
    assert.equal(info.kind, 'image');
    const response = await request(`/api/file/preview/${imageName}`);
    assert.ok(response.headers.get('content-type')?.startsWith(mime));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), imageBytes);
  } finally { await unlink(join(samples, imageName)); }
}
console.log('JPEG, GIF, and WebP type routing and direct streaming: OK');

for (const [fileName, body, path, status] of [
  ['broken.msg', 'not an Outlook message', 'preview-email', 400],
  ['external.xml', '<!DOCTYPE root [<!ENTITY secret SYSTEM "file:///does-not-exist">]><root>&secret;</root>', 'preview-text', 200],
]) {
  const uploaded = await request('/api/files', { method: 'POST', headers: { 'X-File-Name': fileName }, body });
  const storedName = (await uploaded.json()).name;
  try {
    const response = await fetch(`${api}/api/file/${path}/${storedName}`);
    assert.equal(response.status, status);
    if (status === 200) {
      const result = await response.json();
      assert.equal(result.content, body);
      assert.ok(result.parseWarning);
    }
  } finally { await unlink(join(samples, storedName)); }
}
console.log('Malformed MSG and XML external entity handling: OK');
