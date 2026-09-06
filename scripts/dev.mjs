import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { generateStoryMap } from './story-map-content.mjs';
generateStoryMap();
let timer;
const watcher = watch('docs/slices', { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { generateStoryMap(); }
    catch (error) { console.error('Story-map content invalid; fix the Markdown to refresh the map.', error.message); }
  }, 150);
});
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...process.argv.slice(2)], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { watcher.close(); clearTimeout(timer); process.exit(code ?? 0); });
