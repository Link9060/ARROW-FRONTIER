import {test,expect} from '@playwright/test';

test('system map navigation, five orbiting planets and destination travel survive reload',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('#start-btn').click();
  await page.keyboard.press('m');
  const overlay=page.locator('#system-map');
  await expect(overlay).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','system');
  await expect(page.locator('.system-body.planet')).toHaveCount(5);
  await expect(page.locator('.system-body.moon')).toHaveCount(4);
  await expect(page.locator('.system-body.belt')).toHaveCount(2);
  await expect(page.locator('#system-travel')).toBeDisabled();

  await overlay.locator('.system-destination[data-destination="aurex"]').click();
  await expect(page.locator('#system-destination-name')).toHaveText('Aurex');
  await expect(page.locator('#system-ore')).toHaveText('COPPER');
  await expect(page.locator('#system-travel')).toBeEnabled();
  await page.locator('#system-travel').click();
  await expect(overlay).toBeHidden();
  await expect(page.locator('#current-location-label')).toHaveText('AUREX');
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','interior');
  const first=await page.evaluate(()=>{
    const game=JSON.parse(localStorage.getItem('arrow-frontier-expansion-v2')!);
    return {id:game.currentDestinationId,asteroids:game.asteroids.length};
  });
  expect(first).toEqual({id:'aurex',asteroids:39});

  await page.locator('#map-toggle').click();
  await overlay.locator('.system-destination[data-destination="inner-belt"]').click();
  await page.locator('#system-travel').click();
  await expect(page.locator('#current-location-label')).toHaveText('INNER BELT');
  await page.reload();
  await page.locator('#start-btn').click();
  await expect(page.locator('#current-location-label')).toHaveText('INNER BELT');

  await page.keyboard.press('m');
  await overlay.locator('.system-destination[data-destination="aurex"]').click();
  await page.locator('#system-travel').click();
  await expect(page.locator('#current-location-label')).toHaveText('AUREX');
  expect(errors).toEqual([]);
});
