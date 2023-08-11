#!/usr/bin/env node

import { container } from './container';

(async () => {
  const dicc = await container.get('dicc');
  await dicc.compile();
})();
