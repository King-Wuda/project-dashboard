// File-backed store for the Node server: one JSON document, atomic writes.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StoreCore, ValidationError, decodeEditor } from './store-core.mjs';

export { ValidationError, decodeEditor };

export class Store extends StoreCore {
  constructor(dir, seedPaths) {
    const file = join(dir, 'store.json');
    mkdirSync(dir, { recursive: true });
    const write = (doc) => {
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(doc));
      renameSync(tmp, file);
    };
    let doc;
    let seeded = false;
    if (existsSync(file)) {
      doc = JSON.parse(readFileSync(file, 'utf8'));
    } else {
      const seed = seedPaths.find(existsSync);
      if (!seed) throw new Error(`No seed data found (looked in: ${seedPaths.join(', ')})`);
      doc = JSON.parse(readFileSync(seed, 'utf8'));
      doc.meta.seededFrom = seed;
      doc.history = [];
      seeded = true;
    }
    super(doc, write);
    this.file = file;
    if (seeded) this.save();
  }
}
