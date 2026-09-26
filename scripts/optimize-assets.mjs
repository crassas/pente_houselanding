import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const jobs = [
  ['public/images/pentehouse-interior.jpg','public/images/pentehouse-interior.webp',1600,82],
  ['public/images/pentehouse-exterior.jpg','public/images/pentehouse-exterior.webp',1200,82],
  ['public/images/pentehouse-tour-poster.jpg','public/images/pentehouse-tour-poster.webp',900,80],
  ['public/images/rascal-profile.png','public/images/rascal-profile.webp',700,85],
  ['public/images/grenha-profile.png','public/images/grenha-profile.webp',700,85],
];

for (const [input, output, width, quality] of jobs) {
  await sharp(path.join(root,input), { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toFile(path.join(root,output));
}
console.log('Optimized Pente House production imagery.');
