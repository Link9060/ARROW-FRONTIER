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


test('dual-side hangars: saved industrial miner occupies lower bay and launches through lower airlock',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/');
  await page.locator('#start-btn').click();
  await page.locator('#save-toggle').click();
  await page.addInitScript(()=>{
    const key='arrow-frontier-expansion-v2';
    const raw=localStorage.getItem(key);
    if(!raw)throw new Error('Missing starter game save');
    const game=JSON.parse(raw);
    const miner=game.ships.find((ship:{id:string})=>ship.id==='miner');
    const scout=game.ships.find((ship:{id:string})=>ship.id==='scout');
    miner.docked=true;
    miner.berth=2;
    miner.mode='manual';
    scout.mode='hold';
    game.activeShipId='miner';
    game.savedAt=Date.now();
    localStorage.setItem(key,JSON.stringify(game));
  });
  await page.reload();
  await page.locator('#start-btn').click();
  await page.setViewportSize({width:1536,height:960});
  await expect(page.locator('#hangar-occupancy')).toContainText('3 / 4');
  await expect(page.locator('#hangar-summary')).toContainText('Hangar B');
  await expect(page.locator('#hangar-summary')).toContainText('MINER-02');
  await page.screenshot({path:'test-results/v06-dual-lower-berth.png'});
  await page.locator('#hangar-launch-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','transition');
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','flight',{timeout:40_000});
  // Assert actual world location, not just the HUD state.
  await expect.poll(async()=>{
    return await page.evaluate(()=>{
      const raw=localStorage.getItem('arrow-frontier-expansion-v2');
      if(!raw)return false;
      const state=JSON.parse(raw);
      const miner=state.ships.find((s:{id:string})=>s.id==='miner');
      return !miner.docked && miner.y>1600+690 && miner.berth===undefined;
    });
  },{timeout:8000}).toBe(true);
  await page.keyboard.down('w');
  try{
    // CI software rendering can run well below 30fps. This tests real ship
    // movement after clicking a focused launch button, not a fixed animation.
    await expect(page.locator('#pilot-tip')).toContainText('Within docking range',{timeout:22000});
  }finally{await page.keyboard.up('w');}
  await page.locator('#dock-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','interior',{timeout:50_000});
  await expect(page.locator('#hangar-summary')).toContainText('Hangar B');
  await expect(page.locator('#hangar-summary')).toContainText('MINER-02');
  await page.screenshot({path:'test-results/v06-dual-lower-return.png'});
  expect(errors).toEqual([]);
});


test('background miner continues flying while the player launches and docks',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('#start-btn').click();
  const miner=page.locator('.fleet-ship[data-ship-id="miner"]');
  await expect(miner).toHaveAttribute('data-order','mine');
  await page.locator('#hangar-launch-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','transition');
  const before={
    x:Number(await miner.getAttribute('data-world-x')),
    y:Number(await miner.getAttribute('data-world-y')),
    cargo:Number(await miner.getAttribute('data-cargo')),
  };
  // This used to fail: FlightScene skipped the entire simulation whenever
  // the active scout was in its multi-second launch cinematic.
  await expect.poll(async()=>{
    const x=Number(await miner.getAttribute('data-world-x'));
    const y=Number(await miner.getAttribute('data-world-y'));
    const cargo=Number(await miner.getAttribute('data-cargo'));
    // The miner may already be stationary at its ore deposit. Progress in
    // either position OR extracted cargo proves the whole fleet keeps ticking.
    return Math.hypot(x-before.x,y-before.y)>8 || cargo-before.cargo>.2;
  },{timeout:6500,intervals:[250,300,500]}).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','flight',{timeout:40_000});
  expect(errors).toEqual([]);
});

test('Fleet panel dispatches docked miner, recalls it and retains Hold without manual pilot switching',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('#start-btn').click();
  await page.locator('#save-toggle').click();
  await page.addInitScript(()=>{
    const key='arrow-frontier-expansion-v2';
    const json=localStorage.getItem(key);
    if(!json)throw new Error('Missing game save');
    const game=JSON.parse(json);
    const miner=game.ships.find((s:{id:string})=>s.id==='miner');
    miner.docked=true;
    miner.berth=2;
    miner.x=2200-192.5;
    miner.y=1600+106;
    miner.angle=Math.PI/2;
    miner.mode='hold';
    miner.order='hold';
    miner.turnaround=0;
    game.savedAt=Date.now();
    localStorage.setItem(key,JSON.stringify(game));
  });
  await page.reload();
  await page.locator('#start-btn').click();
  await page.locator('#fleet-toggle').click();
  const miner=page.locator('.fleet-ship[data-ship-id="miner"]');
  await expect(miner).toHaveAttribute('data-docked','true');
  await expect(miner.locator('.fleet-state')).toContainText('DOCKED');
  await expect(page.locator('.fleet-ship')).toHaveCount(2);
  const mine=page.locator('.fleet-entry[data-member-id="miner"] .fleet-order[data-fleet-order="mine"]');
  const recall=page.locator('.fleet-entry[data-member-id="miner"] .fleet-order[data-fleet-order="return"]');
  const hold=page.locator('.fleet-entry[data-member-id="miner"] .fleet-order[data-fleet-order="hold"]');
  await mine.click();
  await expect(miner).toHaveAttribute('data-order','mine');
  await expect(miner).toHaveAttribute('data-docked','false',{timeout:7000});
  await expect(page.locator('#hangar-summary')).toContainText('ARROW-01');
  await page.screenshot({path:'test-results/v063-fleet-mine.png'});
  await recall.click();
  await expect(miner).toHaveAttribute('data-order','return');
  await expect(miner).toHaveAttribute('data-docked','true',{timeout:45000});
  await expect(miner).toHaveAttribute('data-order','hold');
  await expect(miner.locator('.fleet-state')).toContainText('DOCKED');
  await page.screenshot({path:'test-results/v063-fleet-recalled.png'});
  await mine.click();
  await expect(miner).toHaveAttribute('data-docked','false',{timeout:7000});
  await hold.click();
  await expect(miner).toHaveAttribute('data-order','hold');
  // Hold must finish any occupied airlock route first; never freeze a ship
  // halfway across the landing gates.
  await expect(miner.locator('.fleet-state')).toContainText('HOLDING',{timeout:20000});
  expect(errors).toEqual([]);
});
