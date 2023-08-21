import { parseArgs } from 'util';

export class Argv {
  readonly configPath: string;

  constructor() {
    const args = parseArgs({
      strict: true,
      allowPositionals: true,
    });

    if (args.positionals.length > 1) {
      throw new Error('Invalid number of arguments, expected 0-1');
    }

    this.configPath = args.positionals[0] ?? 'dicc.yaml';
  }
}
