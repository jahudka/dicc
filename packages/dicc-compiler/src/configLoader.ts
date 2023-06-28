import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { parse } from 'yaml';
import { Argv } from './argv';
import { DiccConfig, diccConfigSchema } from './types';

export class ConfigLoader {
  private readonly configPath: string;

  constructor(argv: Argv) {
    this.configPath = resolve(argv.configPath);
  }

  async load(): Promise<DiccConfig> {
    const data = await readFile(this.configPath, 'utf-8');
    const config = parse(data);
    return diccConfigSchema.parse(config);
  }
}
