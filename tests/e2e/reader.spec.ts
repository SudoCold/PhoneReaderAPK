import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.getByRole('button', { name: 'Read Six words, then a picture', exact: true })).toBeVisible(); });

test('tap right and left through six words, leftover words, then an image', async ({ page }) => {
  await page.getByRole('button', { name: 'Read Six words, then a picture', exact: true }).click();
  await expect(page.locator('.reading-words')).toHaveText('the quick brown fox jumps over');
  const stage = await page.locator('.reading-stage').boundingBox();
  await page.mouse.click(stage!.x + stage!.width * .8, stage!.y + stage!.height * .5);
  await expect(page.locator('.reading-words')).toHaveText('the lazy dog');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-figure img')).toBeVisible();
  await page.getByRole('button', { name: 'View image', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('slider', { name: 'Zoom', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Return to reading' }).click();
  await page.getByTestId('previous-zone').click();
  await expect(page.locator('.reading-words')).toHaveText('the lazy dog');
  await page.getByTestId('previous-zone').click();
  await expect(page.locator('.reading-words')).toHaveText('the quick brown fox jumps over');
  await expect(page.getByTestId('previous-zone')).toBeDisabled();
});

test('restores position after reload and changes chunk size without losing the image', async ({ page }) => {
  await page.getByRole('button', { name: 'Read Six words, then a picture', exact: true }).click();
  await page.getByTestId('next-zone').click();
  await page.getByRole('button', { name: 'Back to library' }).click();
  await page.waitForTimeout(250);
  await page.reload();
  await page.getByRole('button', { name: 'Read Six words, then a picture', exact: true }).click();
  await expect(page.locator('.reading-words')).toHaveText('the lazy dog');
  await page.getByRole('button', { name: 'Reading preferences' }).click();
  await page.getByRole('slider', { name: 'Words per tap', exact: true }).fill('3');
  await page.getByRole('button', { name: 'Back to reading', exact: true }).click();
  await expect(page.locator('.reading-words')).toHaveText('the lazy dog');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-figure img')).toBeVisible();
});

test('pasted text keeps an attached image between chunks and persists offline', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a reading', exact: true }).click();
  await page.getByRole('tab', { name: 'Paste text' }).click();
  await page.getByLabel('Title (optional)').fill('My fox story');
  await page.getByLabel('Your text', { exact: true }).fill('the quick brown fox jumps over the lazy dog');
  // A real small PNG attachment, added after the last word.
  await page.locator('.attach-button input').setInputFiles({ name: 'fox.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Add to my library' }).click();
  await page.getByRole('button', { name: 'Read My fox story', exact: true }).click();
  await expect(page.locator('.reading-words')).toHaveText('the quick brown fox jumps over');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-words')).toHaveText('the lazy dog');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-figure img')).toBeVisible();
  await page.getByTestId('next-zone').click();
  await expect(page.getByRole('heading', { name: 'One read. A little richer.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my library' }).click();
  await page.getByRole('button', { name: 'Finished', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read My fox story', exact: true })).toBeVisible();
});

test('auto-read pauses on images until a right tap', async ({ page }) => {
  await page.getByRole('button', { name: 'Read Six words, then a picture', exact: true }).click();
  await page.getByRole('button', { name: 'Start auto-read' }).click();
  await expect(page.locator('.reading-figure img')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1600);
  await expect(page.locator('.reading-figure img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start auto-read' })).toHaveCount(0);
  await page.getByTestId('next-zone').click();
  await expect(page.getByRole('heading', { name: 'One read. A little richer.' })).toBeVisible();
});

test('phone, landscape and large text layouts fit; dark mode persists', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'test-results/origin-library.png', scale: 'css' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Evening', exact: true }).click();
  await page.getByRole('slider', { name: 'Text size', exact: true }).fill('64');
  await page.getByRole('slider', { name: 'Words per tap', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Read The art of noticing', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.setViewportSize({ width: 812, height: 375 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.getByTestId('next-zone').click();
  await page.getByRole('button', { name: 'Back to library' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('default six-word reading fills one phone screen without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('button', { name: 'Read Six words, then a picture', exact: true }).click();
  await expect(page.locator('.reading-words')).toHaveText('the quick brown fox jumps over');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/origin-six-words.png', scale: 'css' });
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-words')).toHaveText('the lazy dog');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-figure img')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/origin-image.png', scale: 'css' });
});

test('PDF import preserves text, embedded image and following text order', async ({ page }) => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([600, 800]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  sheet.drawText('the quick brown fox jumps over the lazy dog', { x: 40, y: 720, size: 16, font });
  const png = await pdf.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  sheet.drawImage(png, { x: 40, y: 450, width: 220, height: 160 });
  sheet.drawText('And then the story goes on.', { x: 40, y: 380, size: 16, font });
  const scan = pdf.addPage([600, 800]);
  scan.drawRectangle({ x: 80, y: 150, width: 400, height: 500, color: rgb(.2, .4, .3) });
  await page.getByRole('button', { name: 'Add a reading', exact: true }).click();
  await page.getByLabel('Select documents and images').setInputFiles({ name: 'A fox in a PDF.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByRole('button', { name: 'Add to my library' }).click();
  await page.getByRole('button', { name: 'Read A fox in a PDF', exact: true }).click();
  await expect(page.locator('.reading-words')).toHaveText('the quick brown fox jumps over');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-words')).toHaveText('the lazy dog');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-figure img')).toHaveAttribute('alt', 'Image 1 on page 1');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-words')).toHaveText('And then the story goes on.');
  await page.getByTestId('next-zone').click();
  await expect(page.locator('.reading-figure img')).toHaveAttribute('alt', 'Page 2 of A fox in a PDF.pdf');
});
