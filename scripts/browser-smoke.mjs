import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const edgePath = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
async function jumpToLastPage(page, minimumPages) {
  const label = await page.locator('.page-controls span').textContent();
  const count = Number(label.match(/of (\d+)/)?.[1]);
  assert.ok(count >= minimumPages, `Expected at least ${minimumPages} pages, got ${count}`);
  const input = page.getByRole('spinbutton', { name: 'Page number' });
  await input.fill(String(count));
  await input.press('Enter');
  await page.getByText(`Page ${count} of ${count}`).waitFor();
  await page.locator('.react-pdf__Page canvas').waitFor();
  return count;
}
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 950 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.PREVIEW_WEB_URL || 'http://127.0.0.1:5175/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /sample-word\.docx/ }).click();
  await page.locator('iframe.html-frame').waitFor();
  await page.locator('.html-stats').getByText('7 / 7').waitFor();
  assert.equal(await page.locator('iframe.html-frame').getAttribute('sandbox'), '');
  assert.ok((await page.locator('iframe.html-frame').getAttribute('srcdoc')).includes('page 7'));
  await page.getByRole('button', { name: /sample-word\.docx/ }).click();
  await page.locator('.html-stats').getByText('Hit').waitFor();
  await page.getByRole('button', { name: 'Full PDF' }).click();
  await page.getByText('Ready to review').waitFor();
  const pdfStats = page.locator('[aria-label="PDF conversion performance stats"]');
  await pdfStats.waitFor();
  assert.match(await pdfStats.textContent(), /Conversion\s+[\d,]+ ms/);
  await page.getByText(/Page 1 of [7-9]\d*/).waitFor();
  assert.ok(await page.locator('.react-pdf__Page canvas').isVisible());
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: join('artifacts', 'word-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText(/Page 2 of [7-9]\d*/).waitFor();
  await jumpToLastPage(page, 7);

  await page.getByRole('button', { name: /sample-excel\.xlsx/ }).click();
  await page.locator('.html-stats').getByText('3 / 3').waitFor();
  const excelFrame = page.frameLocator('iframe.html-frame');
  await excelFrame.getByText('All sheets should appear in the preview.').waitFor({ state: 'visible' });
  await excelFrame.getByText('This second sheet is included in the preview.').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Full PDF' }).click();
  await page.getByText('Ready to review').waitFor();
  await page.getByText(/Page 1 of [2-9]\d*/).waitFor();
  await jumpToLastPage(page, 2);

  await page.getByRole('button', { name: /sample-slides\.pptx/ }).click();
  await page.locator('.html-stats').getByText('7 / 7').waitFor();
  await page.getByRole('button', { name: 'Full PDF' }).click();
  await page.getByText(/Page 1 of [7-9]\d*/).waitFor();
  await jumpToLastPage(page, 7);

  await page.getByRole('button', { name: /sample-pdf\.pdf/ }).click();
  await page.getByText('Page 1 of 1').waitFor();

  await page.getByRole('button', { name: /sample-image\.png/ }).click();
  await page.locator('.image-preview img').waitFor();
  assert.ok(await page.locator('.image-preview img').evaluate((image) => image.naturalWidth > 0));
  await page.getByRole('button', { name: /sample-notes\.txt/ }).click();
  await page.locator('.source-text').getByText(/No PDF conversion is needed/).waitFor();
  await page.getByRole('button', { name: /sample-markdown\.md/ }).click();
  await page.locator('.markdown-body strong').getByText('formatted').waitFor();
  await page.locator('.markdown-body').getByText('The final line should be visible.').waitFor();
  await page.getByRole('button', { name: /sample-data\.xml/ }).click();
  await page.locator('.source-text').getByText(/Final item/).waitFor();
  await page.getByRole('button', { name: /sample-email\.eml/ }).click();
  await page.locator('.html-stats').getByText('1 / 1').waitFor();
  const emailFrame = page.locator('iframe.html-frame');
  await emailFrame.waitFor();
  assert.equal(await emailFrame.getAttribute('sandbox'), '');
  const emailHtml = await emailFrame.getAttribute('srcdoc');
  assert.ok(emailHtml.includes('final message line'));
  assert.ok(emailHtml.includes('data:image/png;base64,'));
  assert.ok(emailHtml.includes('data-external-src="https://tracker.example.test/pixel.png"'));
  assert.ok(!emailHtml.includes(' src="https://tracker.example.test/pixel.png"'));
  await page.frameLocator('iframe.html-frame').getByText('notes.txt').waitFor();
  await page.getByRole('button', { name: 'Full PDF' }).click();
  await page.getByText(/Page 1 of \d+/).waitFor();
  assert.ok(await page.locator('.react-pdf__Page canvas').isVisible());
  assert.match(await page.locator('[aria-label="PDF conversion performance stats"]').textContent(), /Conversion\s+[\d,]+ ms/);
  await page.getByRole('button', { name: /sample-outlook\.msg/ }).click();
  await page.locator('.html-stats').getByText('1 / 1').waitFor();
  await page.frameLocator('iframe.html-frame').getByText(/HtmlSampleEmailWithAttachment/).waitFor();
  await page.frameLocator('iframe.html-frame').getByText('SampleAttachment.pdf').waitFor();
  await page.getByRole('button', { name: 'Full PDF' }).click();
  await page.getByText(/Page 1 of \d+/).waitFor();
  assert.deepEqual(errors, []);
  console.log('React preview: Office, PDF, image, TXT, Markdown, XML, EML, and MSG opened without page errors');
  console.log('Screenshot: artifacts/word-preview.png');
} finally {
  await browser.close();
}
