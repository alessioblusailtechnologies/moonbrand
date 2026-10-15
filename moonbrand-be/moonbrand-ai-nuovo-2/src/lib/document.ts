import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { channelFiles, FORMAT_ASPECT, sortFiles, type ContentFile } from '@moonbrand/shared/domain/content';

// Su LinkedIn il carosello è un documento: le slide di LinkedIn (le sue, o quelle condivise nella sua proporzione) riunite
// in un PDF, una per pagina, della misura della slide. Lo fa moonbrand e non Claude, così c'è sempre ed è uguale alle slide.
// Restituisce il file del documento, o null se non ci sono slide da riunire.
export async function carouselDocument(brandDir: string, files: readonly ContentFile[], target: string): Promise<ContentFile | null> {
  const aspect = FORMAT_ASPECT.carousel.linkedin as ContentFile['aspect'];
  const slides = sortFiles(channelFiles(files, 'carousel', 'linkedin').filter((file) => file.role === 'slide'));
  if (slides.length === 0) return null;
  const pdf = await PDFDocument.create();
  for (const slide of slides) {
    const bytes = await readFile(path.join(brandDir, slide.file));
    const image = path.extname(slide.file).toLowerCase() === '.png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const output = path.join(brandDir, target);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, await pdf.save());
  return { file: target, role: 'document', index: 0, aspect };
}
