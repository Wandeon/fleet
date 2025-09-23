import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: __dirname,
      stdio: 'inherit',
      shell: isWindows,
      ...options,
    });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

const commands = [
  { name: 'playwright', cmd: isWindows ? 'npx.cmd' : 'npx', args: ['playwright', 'test'] },
  { name: 'audio', cmd: isWindows ? 'bash.exe' : 'bash', args: ['./audio.test.sh'] },
];

const results = [];

for (const entry of commands) {
  const code = await runCommand(entry.cmd, entry.args);
  results.push({ name: entry.name, code });
}

try {
  await import('./summarize.js');
} catch (err) {
  console.error('Failed to generate acceptance summary:', err);
  results.push({ name: 'summary', code: 2 });
}

let finalCode = 0;
for (const result of results) {
  if (result.name === 'audio') {
    if (result.code === 2) {
      finalCode = 2;
    } else if (result.code === 1 && finalCode < 1) {
      finalCode = 1;
    }
  } else {
    if (result.code !== 0) {
      finalCode = 2;
    }
  }
}

process.exit(finalCode);
