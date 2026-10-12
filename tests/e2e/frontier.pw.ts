import { test, expect } from '@playwright/test';

test('real desktop flight, departure, side docking and interior controls', async ({page})=>{
  const errors:string[]=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('#start-btn')).toBeVisible();
  await page.locator('#start-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','interior');
  await expect(page.locator('#hangar-launch-btn')).toBeVisible();
  await expect(page.locator('#hangar-occupancy')).toContainText('BAYS');
  await page.screenshot({path:'test-results/v06-desktop-interior.png'});

  await page.locator('#hangar-launch-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','transition');
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','flight',{timeout:30_000});
  await expect(page.locator('#dock-btn')).toBeVisible();
  await page.screenshot({path:'test-results/v06-desktop-flight.png'});

  // Start outside the enlarged mothership hull. Approach in manual flight.
  await page.keyboard.down('s');
  try {
    await expect(page.locator('#pilot-tip')).toContainText('Within docking range',{
      timeout:12_000,
    });
  } finally {
    await page.keyboard.up('s');
  }
  await page.locator('#dock-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','transition');
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','interior',{timeout:40_000});
  await expect(page.locator('#hangar-summary')).toContainText('Bay');
  await expect(page.locator('#hangar-launch-btn')).toBeVisible();
  await page.screenshot({path:'test-results/v06-desktop-parked.png'});

  await page.locator('#build-toggle').click();
  await expect(page.locator('#builder-panel')).toHaveClass(/open/);
  await expect(page.locator('#room-grid .module-cell')).toHaveCount(24);
  await page.locator('#builder-close').click();
  await expect(page.locator('#builder-panel')).not.toHaveClass(/open/);

  await page.locator('#fleet-toggle').click();
  await expect(page.locator('#fleet-panel')).toHaveClass(/open/);
  await expect(page.locator('#fleet .fleet-ship')).toHaveCount(2);
  await page.locator('#fleet-close').click();
  expect(errors).toEqual([]);
});

test.describe('small touch viewport',()=>{
  test.use({viewport:{width:390,height:844},deviceScaleFactor:2,
    isMobile:true,hasTouch:true});
  test('interior is legible, touch piloting controls exist and UI does not crash',async({page})=>{
    const errors:string[]=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto('/');
    await page.locator('#start-btn').click();
    await expect(page.locator('body')).toHaveAttribute('data-frontier-view','interior');
    await expect(page.locator('#camera-tools')).toBeVisible();
    await page.screenshot({path:'test-results/v06-mobile-interior.png'});
    await expect(page.locator('#recenter-btn')).toBeVisible();
    await page.locator('#hangar-launch-btn').click();
    await expect(page.locator('body')).toHaveAttribute('data-frontier-view','flight',{timeout:30_000});
    await expect(page.locator('#mobile-flight')).toBeVisible();
    await page.screenshot({path:'test-results/v06-mobile-flight.png'});
    await expect(page.locator('#touch-mine')).toBeVisible();
    await page.locator('[data-move="right"]').tap();
    await page.locator('#touch-mine').tap();
    expect(errors).toEqual([]);
  });
});
