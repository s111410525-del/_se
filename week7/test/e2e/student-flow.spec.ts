import { expect, test } from '@playwright/test';

test.describe('學生端完整流程', () => {
  test('登入後可以查課、選課、看課表、看成績與繳費', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/登入.*金門大學校務系統/u);

    await page.locator('#f_username').fill('s001');
    await page.locator('#f_password').fill('nqu1234');
    await page.getByRole('button', { name: '登入' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /你好，陳秉硯/u })).toBeVisible();
    await expect(page.getByText('本學期學分')).toBeVisible();

    await page.getByRole('link', { name: '課程查詢', exact: true }).click();
    await expect(page).toHaveURL(/\/courses/u);
    await page.locator('#f_q').fill('CS399');
    await page.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText('專題實務').first()).toBeVisible();

    await page.getByRole('link', { name: '選課', exact: true }).click();
    const target = page.locator('li.course-item', { hasText: 'CS399' });
    await expect(target).toBeVisible();
    await target.getByRole('button', { name: '選課' }).click();

    await expect(page).toHaveURL('/enrollment');
    await expect(page.getByRole('alert')).toContainText('選課成功');
    await expect(page.locator('tr', { hasText: 'CS399' })).toContainText('正取');

    await page.getByRole('link', { name: '課表', exact: true }).click();
    await expect(page.getByRole('heading', { name: '本週課表' })).toBeVisible();
    await expect(page.getByText('專題實務').first()).toBeVisible();

    await page.getByRole('link', { name: '成績', exact: true }).click();
    await expect(page.getByRole('cell', { name: /CS101/u })).toBeVisible();
    await expect(page.getByText('尚未公布').first()).toBeVisible();

    await page.getByRole('link', { name: '繳費', exact: true }).click();
    await expect(page.getByRole('heading', { name: /115-1 學雜費明細/u })).toBeVisible();
    await page.getByRole('button', { name: '確認繳費' }).click();
    await expect(page.getByRole('alert')).toContainText('繳費成功');
    await expect(page.getByText('繳費紀錄')).toBeVisible();

    await page.getByRole('button', { name: '登出' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: '登入校園入口' })).toBeVisible();
  });
});
