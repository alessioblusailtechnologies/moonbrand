import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { FORMAT_ASPECT } from '@moonbrand/shared/domain/content';

// Su LinkedIn il carosello esce come documento: le slide riunite in un PDF, una per pagina, della misura della slide.
// Lo fa il codice e non Claude, così c'è sempre ed è uguale alle slide. Si prendono quelle nella proporzione di LinkedIn
// (4:5); se non ci sono, quelle della prima proporzione. Restituisce il percorso del PDF, o null se non ci sono slide.

export interface Slide {
  file: string;
  proporzione: string;
}

export async function carouselDocument(brandDir: string, slides: readonly Slide[], target: string): Promise<string | null> {
  const images = slides.filter((slide) => /\.(png|jpe?g)$/i.test(slide.file));
  if (images.length === 0) return null;
  const aspect = images.some((slide) => slide.proporzione === FORMAT_ASPECT.carousel.linkedin) ? FORMAT_ASPECT.carousel.linkedin : images[0]!.proporzione;
  const pdf = await PDFDocument.create();
  for (const slide of images.filter((item) => item.proporzione === aspect)) {
    const bytes = await readFile(path.join(brandDir, slide.file));
    const image = /\.png$/i.test(slide.file) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const output = path.join(brandDir, target);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, await pdf.save());
  return target;
}
