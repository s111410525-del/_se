import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from '../helpers.js';

test('沒有 CSRF 權杖的 POST 會被拒絕', async () => {
  const harness = await startHarness();
  try {
    const res = await harness.browser.postWithoutCsrf('/login', {
      username: 'lena',
      password: 'job1234',
    });
    assert.equal(res.status, 403);
    assert.match(await res.text(), /安全驗證失敗/);
  } finally {
    await harness.close();
  }
});

test('求職者註冊後自動登入，登出後需重新登入', async () => {
  const harness = await startHarness();
  try {
    const register = await harness.browser.post(
      '/register',
      {
        role: 'seeker',
        username: 'newseeker',
        name: '新求職者',
        email: 'newseeker@example.com',
        password: 'password1',
        confirmPassword: 'password1',
        agree: '1',
      },
      '/register',
    );
    assert.equal(register.status, 303);
    assert.equal(register.headers.get('location'), '/dashboard');

    const created = harness.app.store.data.users.find((user) => user.username === 'newseeker');
    assert.ok(created !== undefined);
    assert.equal(created.role, 'seeker');
    assert.equal(created.company, '');
    assert.equal(created.balance, 0);

    const dashboard = await harness.browser.follow('/dashboard');
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /新求職者/);

    const profile = await harness.browser.post(
      '/profile',
      { name: '更新後的名字', email: 'newseeker@example.com', company: '', bio: '喜歡打造產品。', avatar: '🧑' },
      '/profile',
    );
    assert.equal(profile.status, 303);
    assert.equal(harness.app.store.data.users.find((user) => user.id === created.id)?.name, '更新後的名字');

    const logout = await harness.browser.post('/logout', {}, '/profile');
    assert.equal(logout.status, 303);
    assert.equal(logout.headers.get('location'), '/login');

    const blocked = await harness.browser.get('/dashboard');
    assert.equal(blocked.status, 303);
    assert.match(blocked.headers.get('location') ?? '', /^\/login\?next=/);

    const wrong = await harness.browser.login('newseeker', 'wrong-password');
    assert.equal(wrong.status, 401);

    const login = await harness.browser.login('newseeker', 'password1');
    assert.equal(login.status, 303);
    assert.equal(login.headers.get('location'), '/');
  } finally {
    await harness.close();
  }
});

test('企業註冊需要公司名稱，成功後會進入徵才中心', async () => {
  const harness = await startHarness();
  try {
    const missingCompany = await harness.browser.post(
      '/register',
      {
        role: 'employer',
        username: 'newshop',
        name: '新公司聯絡人',
        email: 'newshop@example.com',
        company: '',
        password: 'password1',
        confirmPassword: 'password1',
        agree: '1',
      },
      '/register',
    );
    assert.equal(missingCompany.status, 400);
    assert.match(await missingCompany.text(), /公司名稱/);

    const register = await harness.browser.post(
      '/register',
      {
        role: 'employer',
        username: 'newshop',
        name: '新公司聯絡人',
        email: 'newshop@example.com',
        company: '新創測試公司',
        password: 'password1',
        confirmPassword: 'password1',
        agree: '1',
      },
      '/register',
    );
    assert.equal(register.status, 303);
    assert.equal(register.headers.get('location'), '/employer');

    const employer = harness.app.store.data.users.find((user) => user.username === 'newshop');
    assert.ok(employer !== undefined);
    assert.equal(employer.role, 'employer');
    assert.equal(employer.company, '新創測試公司');
    assert.equal(employer.avatar, '🏢');
  } finally {
    await harness.close();
  }
});

test('重複帳號與不一致的密碼會回報錯誤', async () => {
  const harness = await startHarness();
  try {
    const duplicate = await harness.browser.post(
      '/register',
      {
        role: 'seeker',
        username: 'lena',
        name: '冒牌 Lena',
        email: 'fake-lena@example.com',
        password: 'password1',
        confirmPassword: 'password1',
        agree: '1',
      },
      '/register',
    );
    assert.equal(duplicate.status, 409);
    assert.match(await duplicate.text(), /已經有人使用/);

    const mismatch = await harness.browser.post(
      '/register',
      {
        role: 'seeker',
        username: 'mismatch',
        name: '密碼不一致',
        email: 'mismatch@example.com',
        password: 'password1',
        confirmPassword: 'password2',
        agree: '1',
      },
      '/register',
    );
    assert.equal(mismatch.status, 400);
    assert.match(await mismatch.text(), /兩次輸入的密碼不一致/);
  } finally {
    await harness.close();
  }
});
