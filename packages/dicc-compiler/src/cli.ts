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
    map: {
      type: 'string',
      short: 'm',
    },
  },
  strict: true,
});

type Args = typeof args.values;

(async ({ project, input, output, export: export_, map }: Args) => {
  if (!input || !output) {
    console.log(`Usage: ${process.argv0} [-p|--project <tsconfig.json>] -i|--input <definitions.ts> -o|--output <container.ts> [-e|--export <export name>] [-m|--map <map name>]`);
    process.exit(1);
  }

  container.register('options', {
    project,
    input,
    output,
    export: export_ ?? 'container',
    map: map ?? 'Services',
  });

  const dicc = container.get('dicc');
  await dicc.compile();
})(args.values);
