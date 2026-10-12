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
  // The world should be visible immediately; no unrequested onboarding
  // toast or giant bright overlay may cover the mothership.
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  await page.screenshot({path:'test-results/v06-desktop-interior.png'});

  await page.locator('#hangar-launch-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','transition');
  // Regression: the old transition toast had both top:88px and bottom:65px,
  // stretching into a huge white vertical panel.
  const toastBox=await page.locator('#toast').boundingBox();
  expect(toastBox).not.toBeNull();
  expect(toastBox!.height).toBeLessThan(65);
  expect(toastBox!.width).toBeLessThan(400);
  await page.screenshot({path:'test-results/v06-launch-transition.png'});
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','flight',{timeout:30_000});
  await expect(page.locator('#dock-btn')).toBeVisible();
  await page.screenshot({path:'test-results/v06-desktop-flight.png'});
  // The first ore field is physically in range of the newly launched scout.
  // Verify resource extraction through player keyboard input, not just an
  // isolated simulation function or a painted particle.
  await page.keyboard.down('Space');
  try {
    await expect.poll(async ()=>{
      const cargo=(await page.locator('#cargo').textContent())??'0 / 60';
      return Number(cargo.split('/')[0].trim())>0;
    },{timeout:12000}).toBe(true);
    await page.screenshot({path:'test-results/v06-desktop-mining.png'});
  } finally {
    await page.keyboard.up('Space');
  }

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


test('upgraded saved mothership stays readable and never stretches launch status',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('#start-btn').click();
  await page.locator('#save-toggle').click();
  // Inject on the NEXT document before Vite initializes. The previous
  // document's pagehide autosave otherwise overwrites test mutations.
  await page.addInitScript(()=>{
    const key='arrow-frontier-expansion-v2';
    const json=localStorage.getItem(key);
    if(!json)throw new Error('Expected starter save');
    const game=JSON.parse(json);
    const hangar=game.rooms.find((room:{type:string})=>room.type==='hangar');
    hangar.level=3;
    const extra=[
      {id:'room-5',type:'refinery',x:1,y:1,level:2,enabled:true},
      {id:'room-6',type:'fabricator',x:4,y:2,level:1,enabled:true},
      {id:'room-7',type:'storage',x:1,y:2,level:3,enabled:true},
      {id:'room-8',type:'reactor',x:4,y:1,level:2,enabled:true},
    ];
    game.rooms.push(...extra);
    game.nextRoomId=9;
    game.savedAt=Date.now();
    localStorage.setItem(key,JSON.stringify(game));
  });
  await page.reload();
  await page.locator('#start-btn').click();
  await expect(page.locator('#hangar-occupancy')).toContainText('/ 12');
  // Match the real player's large desktop screenshot rather than judging
  // the expanded flagship only in Playwright's small 1280x720 default.
  await page.setViewportSize({width:1536,height:960});
  await expect(page.locator('#hangar-occupancy')).toContainText('/ 12');
  await page.screenshot({path:'test-results/v06-upgraded-hangar.png'});
  await page.locator('#hangar-launch-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','transition');
  const bounds=await page.locator('#toast').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeLessThan(65);
  await page.screenshot({path:'test-results/v06-upgraded-launch.png'});
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','flight',{timeout:40_000});
  expect(errors).toEqual([]);
});
