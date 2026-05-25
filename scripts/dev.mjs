import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function parseEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const values = {};

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) {
        values[key] = value;
      }
    }

    return values;
  } catch {
    return {};
  }
}

const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const envFiles = ['.env', '.env.local'];
const fileEnv = envFiles.reduce((accumulator, fileName) => {
  return { ...accumulator, ...parseEnvFile(resolve(workspaceRoot, fileName)) };
}, {});

const env = {
  ...process.env,
  ...fileEnv,
  NODE_ENV: 'development',
};

const nextBin = resolve(workspaceRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const command = process.platform === 'win32' ? process.execPath : process.execPath;
const args = [nextBin, 'dev'];

const child = spawn(command, args, {
  cwd: workspaceRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
