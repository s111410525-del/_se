#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { createSeedDatabase } from './db/seed.js';
import { Store } from './db/store.js';

const HELP = `nqu-campus — 金門大學校務系統維護工具

用法：
  nqu-campus --reset     以示範資料覆寫資料檔
  nqu-campus --check     檢查資料檔是否存在且可解析
  nqu-campus --help      顯示本說明
`;

function main(argv: string[]): number {
  const config = loadConfig();
  const target = path.resolve(config.dataFile);

  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    return 0;
  }

  if (argv.includes('--reset')) {
    const store = new Store(target);
    store.reset(createSeedDatabase);
    process.stdout.write(`已重設資料檔：${target}\n`);
    return 0;
  }

  if (argv.includes('--check')) {
    if (!fs.existsSync(target)) {
      process.stderr.write(`找不到資料檔：${target}，可先執行 nqu-campus --reset\n`);
      return 1;
    }
    const store = new Store(target);
    store.load(createSeedDatabase);
    const db = store.data;
    process.stdout.write(
      `資料檔：${target}\n`
      + `使用者 ${db.users.length} 人、課程 ${db.courses.length} 門、`
      + `選課 ${db.enrollments.length} 筆、成績 ${db.scores.length} 筆、`
      + `公告 ${db.notices.length} 則、繳費單 ${db.bills.length} 張。\n`,
    );
    return 0;
  }

  process.stderr.write(HELP);
  return 2;
}

process.exit(main(process.argv.slice(2)));