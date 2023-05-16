#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { container } from './container';

const args = parseArgs({
  options: {
    project: {
      type: 'string',
      short: 'p',
    },
    input: {
      type: 'string',
      short: 'i',
    },
    output: {
      type: 'string',
      short: 'o',
    },
    export: {
      type: 'string',
      short: 'e',
    },
  },
  strict: true,
});

(async () => {
  if (!args.values.input || !args.values.output) {
    console.log(`Usage: ${process.argv0} [-p|--project tsconfig.json] -i|--input <definitions.ts> -o|--output <container.ts></container.ts>`);
    process.exit(1);
  }

  container.register('options', args.values);
  const dicc = container.get('dicc');
  await dicc.compile();
})();
