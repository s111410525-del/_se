import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#f_username').fill(username);
  await page.locator('#f_password').fill('nqu1234');
  await page.getByRole('button', { name: '登入' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('教師端完整流程', () => {
  test('輸入並公布成績後，學生可以看到成績', async ({ page }) => {
    await login(page, 'tchen');
    await expect(page.getByRole('heading', { name: /你好，陳鍾誠 老師/u })).toBeVisible();

    await page.getByRole('link', { name: '成績', exact: true }).click();
    await expect(page).toHaveURL('/grades');
    const courseRow = page.locator('li.course-item', { hasText: 'CS101' });
    await courseRow.getByRole('link', { name: '成績管理' }).click();

    await expect(page).toHaveURL('/grades/course/c_cs101');
    const studentRow = page.locator('tr', { hasText: '劉承恩' });
    await studentRow.getByRole('link', { name: '編輯' }).click();

    await expect(page).toHaveURL('/grades/course/c_cs101/student/u_s005');
    await page.locator('input[name="score_0"]').fill('88');
    await page.locator('input[name="weight_0"]').fill('40');
    await page.locator('input[name="score_1"]').fill('92');
    await page.locator('input[name="weight_1"]').fill('60');
    await page.getByRole('button', { name: '儲存成績' }).click();

    await expect(page).toHaveURL('/grades/course/c_cs101');
    await expect(page.getByRole('alert')).toContainText('已儲存');
    await expect(studentRow).toContainText('90.4');
    await expect(studentRow.getByRole('button', { name: '公布' })).toBeVisible();

    await studentRow.getByRole('button', { name: '公布' }).click();
    await expect(page.getByRole('alert')).toContainText('已更新成績公布狀態');
    await expect(studentRow.getByRole('button', { name: '取消公布' })).toBeVisible();

    await page.getByRole('button', { name: '登出' }).click();
    await login(page, 's005');
    await page.getByRole('link', { name: '成績', exact: true }).click();

    const publishedRow = page.locator('tr', { hasText: 'CS101' });
    await expect(publishedRow).toContainText('90.4');
    await expect(publishedRow).toContainText('A');
  });
});
