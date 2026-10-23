import fs from 'node:fs';
import path from 'node:path';

const targets = ['data/e2e-campus.json', 'test-results', 'playwright-report'];

for (const target of targets) {
  fs.rmSync(path.resolve(target), { recursive: true, force: true });
}

console.log('[e2e] 已清除舊的 E2E 資料檔與測試輸出');
