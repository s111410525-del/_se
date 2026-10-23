import { expect, test, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#f_username').fill('admin');
  await page.locator('#f_password').fill('nqu1234');
  await page.getByRole('button', { name: '登入' }).click();
  await expect(page.getByRole('heading', { name: '教務管理系統' })).toBeVisible();
}

test.describe('教務端完整流程', () => {
  test('可以新增課程並在課程查詢看到', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('link', { name: '系統管理', exact: true }).click();
    await page.getByRole('link', { name: '課程管理', exact: true }).click();
    await expect(page).toHaveURL('/admin/courses');

    await page.locator('#f_code').fill('E2E101');
    await page.locator('#f_name').fill('端對端測試實務');
    await page.locator('#f_englishName').fill('E2E Testing Practice');
    await page.locator('#f_credits').fill('2');
    await page.locator('#f_term').selectOption('115-1');
    await page.locator('#f_category').selectOption('選修');
    await page.locator('#f_teacherId').selectOption('u_tchen');
    await page.locator('#f_capacity').fill('20');
    await page.locator('#f_location').fill('資訊大樓 A501');
    await page.locator('#f_day').selectOption('5');
    await page.locator('#f_start').selectOption('11');
    await page.locator('#f_periods').selectOption('1');
    await page.locator('#f_prerequisites').fill('CS101、CS210');
    await page.getByRole('button', { name: '開課' }).click();

    await expect(page).toHaveURL('/admin/courses');
    await expect(page.locator('tr', { hasText: 'E2E101' })).toContainText('端對端測試實務');

    await page.getByRole('link', { name: '課程查詢', exact: true }).click();
    await page.locator('#f_q').fill('E2E101');
    await page.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText('端對端測試實務').first()).toBeVisible();
  });

  test('可以發布、置頂再刪除公告', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('link', { name: '公告', exact: true }).click();
    await expect(page).toHaveURL('/notices');

    const form = page.locator('form[action="/admin/notices"]');
    await form.locator('#f_title').fill('E2E 測試公告');
    await form.locator('#f_category').selectOption('公告');
    await form.locator('#f_body').fill('這則公告由 Playwright E2E 測試建立。');
    await page.getByLabel('設為置頂公告').check();
    await page.getByRole('button', { name: '發布公告' }).click();

    await expect(page).toHaveURL('/notices');
    const row = page.locator('tr', { hasText: 'E2E 測試公告' });
    await expect(row).toBeVisible();
    await expect(page.locator('tbody tr').first()).toContainText('E2E 測試公告');
    await expect(row.getByRole('button', { name: '取消置頂' })).toBeVisible();

    await row.getByRole('button', { name: '取消置頂' }).click();
    await expect(page.getByRole('alert')).toContainText('已更新公告置頂狀態');
    await expect(row.getByRole('button', { name: '置頂', exact: true })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: '刪除' }).click();
    await expect(page.getByRole('alert')).toContainText('公告已刪除');
    await expect(page.locator('tr', { hasText: 'E2E 測試公告' })).toHaveCount(0);
  });
});
