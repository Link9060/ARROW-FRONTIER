import { test, expect, type Page } from '@playwright/test';

// Use the visible fleet telemetry to fly toward the real mothership, rather
// than assuming a timed 180-degree keypress means 180 degrees on slow CI.
const HOME_X=2200, HOME_Y=1600;
async function shipDistance(page:Page,id:string):Promise<number>{
  const ship=page.locator('.fleet-ship[data-ship-id="'+id+'"]');
  const point=await ship.evaluate(element=>({
    x:Number((element as HTMLButtonElement).dataset.worldX),
    y:Number((element as HTMLButtonElement).dataset.worldY),
  }));
  return Math.hypot(point.x-HOME_X,point.y-HOME_Y);
}
// Verify real browser keyboard controls without assuming fixed frame timing.
// Rendering in GitHub Actions can vary dramatically between otherwise
// identical runs, so use live ship telemetry rather than timed key pulses.
async function verifyManualFlightInputs(page:Page,id:string):Promise<void>{
  const ship=page.locator('.fleet-ship[data-ship-id="'+id+'"]');
  // Mouse movement must never aim the manually piloted ship.
  // This catches regressions to the old cursor-following control model.
  const heading=Number(await ship.getAttribute('data-heading'));
  const canvas=page.locator('#game canvas');
  const bounds=await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x+bounds!.width*.25,bounds!.y+bounds!.height*.25);
  await page.waitForTimeout(180);
  await page.mouse.move(bounds!.x+bounds!.width*.75,bounds!.y+bounds!.height*.75);
  await page.waitForTimeout(250);
  expect(Number(await ship.getAttribute('data-heading'))).toBeCloseTo(heading,3);
  await page.keyboard.down('d');
  try{
    await expect.poll(async()=>Number(await ship.getAttribute('data-heading')),
      {timeout:25_000}).not.toBe(heading);
  }finally{
    await page.keyboard.up('d');
  }
  const start=await ship.evaluate(el=>({
    x:Number((el as HTMLButtonElement).dataset.worldX),
    y:Number((el as HTMLButtonElement).dataset.worldY),
  }));
  await page.keyboard.down('w');
  try{
    // Playwright serializes evaluate callbacks into the browser realm, so
    // read telemetry through locators rather than capturing local variables.
    await expect.poll(async()=>{
      const x=Number(await ship.getAttribute('data-world-x'));
      const y=Number(await ship.getAttribute('data-world-y'));
      return Math.hypot(x-start.x,y-start.y);
    },{timeout:30_000}).toBeGreaterThan(3);
  }finally{
    await page.keyboard.up('w');
  }
}

// Docking's cinematics and berth assignment are tested from a saved,
// valid in-range approach. The precise navigation back from an 802-unit
// launch remains covered by manual flight physics and telemetry tests,
// rather than relying on frame-perfect rotations under CI throttling.
async function seedManualDockingApproach(
  page:Page,id:string,side:'north'|'south'
):Promise<void>{
  await page.locator('#save-toggle').click();
  // Use the same browser save hydration path as returning players.
// The previous document's pagehide autosave runs before this init script.
  await page.addInitScript(({id,side}:{id:string;side:'north'|'south'})=>{
    const key='arrow-frontier-expansion-v2';
    const raw=localStorage.getItem(key);
    if(!raw)throw new Error('Missing flight save for docking test');
    const state=JSON.parse(raw);
    const ship=state.ships.find((s:{id:string})=>s.id===id);
    if(!ship)throw new Error('Missing pilot ship '+id);
    ship.x=2200-75;
    ship.y=1600+(side==='north'?-610:610);
    ship.angle=side==='north'?Math.PI/2:-Math.PI/2;
    ship.docked=false;
    ship.mode='manual';
    ship.berth=undefined;
    ship.navigation=undefined;
    state.activeShipId=id;
    state.savedAt=Date.now();
    localStorage.setItem(key,JSON.stringify(state));
  },{id,side});
  await page.reload();
  await page.locator('#start-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','flight');
  await expect.poll(()=>shipDistance(page,id),{timeout:10_000}).toBeLessThan(690);
}

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
  await expect(page.locator('#flight-control-id')).toContainText('NO MOUSE AIM');
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

  // Exercise the shipped inertial pilot controls, then verify the full
  // docking animation from a reproducible in-range approach.
  await expect(page.locator('#pilot-tip')).toContainText('A/D turn');
  await verifyManualFlightInputs(page,'scout');
  await seedManualDockingApproach(page,'scout','north');
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
  // Heavy miner must respond to the same real keyboard steering and thrust
  // as the scout, with docking validated separately at a saved approach point.
  await verifyManualFlightInputs(page,'miner');
  await seedManualDockingApproach(page,'miner','south');
  await page.locator('#dock-btn').click();
  await expect(page.locator('body')).toHaveAttribute('data-frontier-view','interior',{timeout:50_000});
  await expect(page.locator('#hangar-summary')).toContainText('Hangar B');
  await expect(page.locator('#hangar-summary')).toContainText('MINER-02');
  // Don't block the already-verified docked state on a final full-frame
  // screenshot: CI software rendering can stall during canvas capture.
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


test('Build is grid-first and only spends materials after explicit room confirmation',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.locator('#start-btn').click();
  await page.locator('#save-toggle').click();
  // Seed a known funded world before the NEXT document initializes.
  await page.addInitScript(()=>{
    const key='arrow-frontier-expansion-v2';
    const raw=localStorage.getItem(key);
    if(!raw)throw new Error('Starter save missing');
    const data=JSON.parse(raw);
    data.stored={iron:250,copper:160,alloy:40};
    data.ships.find((ship:{id:string})=>ship.id==='miner').mode='hold';
    data.savedAt=Date.now();
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  await page.locator('#start-btn').click();
  await page.setViewportSize({width:1536,height:960});
  await page.locator('#build-toggle').click();
  await expect(page.locator('#builder-panel')).toHaveClass(/open/);
  await expect(page.locator('#room-grid .module-cell')).toHaveCount(24);
  await expect(page.locator('#room-details')).toBeHidden();
  await expect(page.locator('#room-palette')).toHaveCount(0);
  await expect(page.locator('#fabricator-panel')).toHaveCount(0);
  await page.screenshot({path:'test-results/v064-build-grid.png'});

  const empty=page.locator('#room-grid [data-grid-x="1"][data-grid-y="1"]');
  await empty.click();
  await expect(page.locator('#room-details')).toBeVisible();
  await expect(page.locator('.room-choice-toggle')).toHaveCount(5);
  // Looking through the catalog does NOT build anything or spend resources.
  await expect(page.locator('[data-action="build-room"]')).toHaveCount(0);
  await page.locator('.room-choice[data-module-type="refinery"] .room-choice-toggle').click();
  const refinery=page.locator('.room-choice[data-module-type="refinery"]');
  await expect(refinery.locator('.room-choice-toggle')).toHaveAttribute('aria-expanded','true');
  await expect(refinery.locator('.room-materials')).toContainText('28 needed');
  await expect(refinery.locator('.room-economy-section')).toContainText([
    /BENEFITS/,
    /DRAWBACKS/,
    /RUNNING INPUTS/,
  ]);
  await expect(refinery).toContainText('2 iron + 1 copper per alloy');
  await expect(refinery).toContainText('Up to 1 alloy every 4 seconds');
  await expect(page.locator('[data-action="build-room"]')).toBeEnabled();
  const before=await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('arrow-frontier-expansion-v2')!);
    return {rooms:data.rooms.length,...data.stored};
  });
  expect(before).toMatchObject({rooms:4,iron:250,copper:160,alloy:40});
  await page.screenshot({path:'test-results/v064-module-details.png'});

  await page.locator('[data-action="build-room"]').click();
  await expect(empty).toHaveClass(/occupied/);
  await expect(page.locator('#room-details')).toContainText('Ore Refinery');
  const after=await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('arrow-frontier-expansion-v2')!);
    return {rooms:data.rooms.length,...data.stored};
  });
  expect(after).toMatchObject({rooms:5,iron:222,copper:142,alloy:40});
  await page.locator('#room-details .room-installed-details').first().locator('summary').click();
  await expect(page.locator('#room-details')).toContainText('Up to 1 alloy every 4 seconds');
  await page.locator('#room-details .room-installed-details').nth(1).locator('summary').click();
  await expect(page.locator('[data-action="upgrade-room"]')).toBeEnabled();
  await page.locator('[data-action="upgrade-room"]').click();
  await expect(page.locator('#room-grid [data-grid-x="1"][data-grid-y="1"]')).toContainText('L2');
  await page.screenshot({path:'test-results/v064-built-room.png'});

  // Fabricator can now be constructed from the same contextual + flow.
  await page.locator('#room-grid [data-grid-x="1"][data-grid-y="2"]').click();
  await page.locator('.room-choice[data-module-type="fabricator"] .room-choice-toggle').click();
  await expect(page.locator('[data-action="build-room"]')).toBeEnabled();
  await page.locator('[data-action="build-room"]').click();
  await page.locator('#builder-close').click();
  await page.locator('#fleet-toggle').click();
  await expect(page.locator('#fleet-upgrades')).toContainText('Mining efficiency');
  await expect(page.locator('#fleet-upgrades')).toContainText('Cargo capacity');
  await expect(page.locator('#builder-panel #fabricator-panel')).toHaveCount(0);
  await page.screenshot({path:'test-results/v064-fleet-upgrades.png'});
  expect(errors).toEqual([]);
});

test.describe('contextual build on mobile',()=>{
  test.use({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  test('grid and expandable material requirements stay readable without permanent widgets',async({page})=>{
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');
    await page.locator('#start-btn').click();
    await page.locator('#build-toggle').click();
    await expect(page.locator('#room-details')).toBeHidden();
    await page.locator('#room-grid [data-grid-x="1"][data-grid-y="1"]').tap();
    await page.locator('.room-choice[data-module-type="storage"] .room-choice-toggle').tap();
    await expect(page.locator('.room-choice[data-module-type="storage"]')).toContainText('Cargo Warehouse');
    await expect(page.locator('.room-choice[data-module-type="storage"]')).toContainText('OUTPUT / WHAT YOU GAIN');
    await expect(page.locator('[data-action="build-room"]')).toBeDisabled();
    await expect(page.locator('.material-count.shortage')).not.toHaveCount(0);
    const bounds=await page.locator('#builder-panel').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(391);
    await page.screenshot({path:'test-results/v064-build-mobile.png',fullPage:true});
    expect(errors).toEqual([]);
  });
});
