import { resolve } from 'node:path';
import { exit } from 'node:process';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';

const localInfo = JSON.parse(await readFile(resolve('package.json'), 'utf-8'));
const regInfo = await getPublishedVersion();

if (
  regInfo.error?.code === 'E404'
  || !regInfo.error && regInfo.version !== localInfo.version
) {
  console.log(`Publishing new version of ${localInfo.name}...`);
  exit(0);
} else {
  console.log(`Latest version of ${localInfo.name} already published.`);
  exit(1);
}

async function getPublishedVersion() {
  return new Promise((resolve) => {
    execFile('npm', ['view', localInfo.name, '--json'], {
      encoding: 'utf-8',
      shell: true,
    }, (err, stdout) => {
      resolve(JSON.parse(stdout));
    });
  });
}
