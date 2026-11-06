import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase } from '../../src/db/seed.js';
import { needUser } from '../../src/services/accounts.js';
import {
  categoryCounts,
  createJob,
  filterJobs,
  parseCategory,
  parseEmploymentType,
  publishedJobs,
  type JobFormInput,
} from '../../src/services/jobs.js';
import { startAdminPromotion } from '../../src/services/promotion.js';

const NOW = '2026-01-02T00:00:00.000Z';

function input(overrides: Partial<JobFormInput>): JobFormInput {
  return {
    title: '測試職缺',
    category: 'tech',
    employmentType: 'full-time',
    location: '台北市',
    description: '工作內容',
    requirements: '工作要求',
    benefits: '福利',
    tags: [],
    salaryMin: 40000,
    salaryMax: 60000,
    salaryNote: '',
    published: true,
    ...overrides,
  };
}

function baseFilters() {
  return {
    q: '',
    category: '',
    employmentType: '',
    location: '',
    salaryMin: 0,
    sort: 'newest' as const,
  };
}

test('關鍵字、分類、工作型態與月薪條件可以組合篩選', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const tech = createJob(db, dean, input({
    title: '資深 TypeScript 工程師',
    category: 'tech',
    employmentType: 'full-time',
    location: '台北市信義區',
    description: '開發雲端產品與設計系統。',
    tags: ['TypeScript', 'Node.js'],
    salaryMin: 80000,
    salaryMax: 120000,
  }), NOW);
  const design = createJob(db, dean, input({
    title: '品牌視覺設計師',
    category: 'design',
    employmentType: 'part-time',
    location: '台中市',
    description: '負責品牌視覺與插畫。',
    salaryMin: 30000,
    salaryMax: 45000,
  }), NOW);

  const byQuery = filterJobs(db, [tech, design], { ...baseFilters(), q: 'typescript' }, Date.parse(NOW));
  assert.deepEqual(byQuery.map((job) => job.id), [tech.id]);

  const byCategory = filterJobs(db, [tech, design], { ...baseFilters(), category: 'design' }, Date.parse(NOW));
  assert.deepEqual(byCategory.map((job) => job.id), [design.id]);

  const byType = filterJobs(db, [tech, design], { ...baseFilters(), employmentType: 'part-time' }, Date.parse(NOW));
  assert.deepEqual(byType.map((job) => job.id), [design.id]);

  const byLocation = filterJobs(db, [tech, design], { ...baseFilters(), location: '台中' }, Date.parse(NOW));
  assert.deepEqual(byLocation.map((job) => job.id), [design.id]);

  const bySalary = filterJobs(db, [tech, design], { ...baseFilters(), salaryMin: 70000 }, Date.parse(NOW));
  assert.deepEqual(bySalary.map((job) => job.id), [tech.id]);
});

test('推薦排序會把曝光中的職缺排在前面，薪資排序由高到低', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const high = createJob(db, dean, input({
    title: '高薪後端工程師',
    salaryMin: 90000,
    salaryMax: 130000,
  }), NOW);
  const low = createJob(db, dean, input({
    title: '入門前端工程師',
    salaryMin: 35000,
    salaryMax: 50000,
  }), NOW);
  startAdminPromotion(db, low, NOW);

  const recommend = filterJobs(
    db,
    [high, low],
    { ...baseFilters(), sort: 'recommend' },
    Date.parse(NOW),
  );
  assert.equal(recommend[0]?.id, low.id);

  const salary = filterJobs(
    db,
    [low, high],
    { ...baseFilters(), sort: 'salary' },
    Date.parse(NOW),
  );
  assert.equal(salary[0]?.id, high.id);
});

test('分類統計只計算公開職缺，查詢參數會過濾非法值', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');
  const before = new Map(categoryCounts(db).map((entry) => [entry.category, entry.count]));
  createJob(db, dean, input({ title: '公開科技職缺', category: 'tech' }), NOW);
  createJob(db, dean, input({ title: '關閉科技職缺', category: 'tech', published: false }), NOW);
  createJob(db, dean, input({ title: '公開設計職缺', category: 'design' }), NOW);

  const counts = categoryCounts(db);
  assert.equal((counts.find((entry) => entry.category === 'tech')?.count ?? 0) - (before.get('tech') ?? 0), 1);
  assert.equal((counts.find((entry) => entry.category === 'design')?.count ?? 0) - (before.get('design') ?? 0), 1);
  assert.equal(publishedJobs(db).some((job) => job.title === '關閉科技職缺'), false);

  assert.equal(parseCategory('tech'), 'tech');
  assert.equal(parseCategory('不存在'), '');
  assert.equal(parseEmploymentType('contract'), 'contract');
  assert.equal(parseEmploymentType('不存在'), '');
});

test('職缺驗證會拒絕顛倒的薪資區間與過多標籤', () => {
  const db = createSeedDatabase();
  const dean = needUser(db, 'u_dean');

  assert.throws(
    () => createJob(db, dean, input({ salaryMin: 90000, salaryMax: 50000 }), NOW),
    /月薪下限不可高於上限/,
  );
  assert.throws(
    () => createJob(db, dean, input({ tags: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }), NOW),
    /標籤最多/,
  );
});
