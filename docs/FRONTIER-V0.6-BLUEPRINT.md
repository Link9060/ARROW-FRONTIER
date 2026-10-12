# FRONTIER v0.6 — Living Mothership

> **ARROW is a design system, not a decorative arrow.** This document is the implementation blueprint and release checklist for FRONTIER's physical spacecraft, cinematic docking, construction, effects, and atmosphere. It separates completed slice-one work from later phases. This is a playable browser prototype, not a multiplayer service.

**Original visual identity:** `Link9060/Resonant-Arrow/src/ArrowMark.jsx`

```svg
<svg viewBox="0 0 24 24"><path d="M3 5.2 21 12 3 18.8 8.2 12 3 5.2Z"/></svg>
```

All game spacecraft must be derived from this **exact path**, preserving the long pointed front, balanced shoulders and inward notch at the stern. The flagship is a larger, architecturally detailed version, not a new unrelated outline. `src/sim/arrowGeometry.ts` owns the canonical geometry.

## 1. Target experience

The first-time player should understand FRONTIER without memorizing an interface:

1. Spawn aboard the flagship with a small ARROW craft visible in its numbered docking berth.
2. See a real hangar and physically located systems, not floating text cards.
3. Press **Launch**. The ship is guided through a bay lane, side airlock and tractor clearance while the camera follows. The roof closes as the ship leaves.
4. Fly with WASD or touch controls; near an asteroid, hold Space/Mine to extract.
5. See a narrow mining beam ignite, collide, pulse, trail off, and leave fragments behind.
6. Return toward the huge flagship. Request **Dock** within range.
7. The autopilot rotates the craft, steers **outside the solid hull** along the approach arc, then uses a visible tractor emitter for the final upper-side entry.
8. The ship travels all the way to its reserved berth. No teleport to a pretend docking coordinate.
9. The opaque top hull fades into a cutaway interior, then the camera zooms out to reveal the command section, engineering, hangar, and constructed middle modules.
10. Pan and zoom naturally using two fingers or trackpad gestures. Build and expand actual physical spaces.

The world is black, deep and spacious; accents are greys and white, not glowing cyan panels.

## 2. Fixed mother-ship architecture

The mothership's local origin is its center, and +X is forward (nose to the right).

| Zone | Local target position (world units) | Physical identity | Future upgrades |
| --- | --- | --- | --- |
| Command bridge | +350, 0 | Forward pointed cockpit/command room | Refined antennae, extended bridge hardware |
| Two rear propulsion units | approximately −480, ±293 | Split-tail engine assemblies | Larger nozzles, conduits, exhaust |
| Central spine | approximately −120, 0 | Main corridor connecting bays | New branches to outer modules |
| Upper side hangar | approximately −115, −178 | Numbered berths, rails, doors, equipment | Added outer rows and hull plating |
| Tractor emitter | approximately −115, −379 initially | Fixed side-shoulder docking device | Relocates outward with hangar expansion |
| External airlock | approximately −115, −354 initially | Doors connecting hangar to flight | Relocates with physical hangar growth |

**Geometry owner:** `src/sim/arrowGeometry.ts` defines the true flagship logo outline and fixed anchors. `src/sim/hangar.ts` defines the real side entry, reserved parking units and dynamic expansion offsets.

**Important rule:** Do not create a second hardcoded position for a drawn ship port. The renderer, tractor beam and autopilot must all use `dockingPort(state)`. The rendered berth center must always equal `berthWorldPosition(ship)`.

### Hangar parking

Each hangar room level supports **four berth units**, with a current global limit of twelve. Scouts use one unit; industrial miners two; future heavy ships three. Contiguous berth assignment is atomic, and full hangars reject new arrivals. The first row is inside the upper wing; additional rows physically grow the upper-side pod. Expansion moves the airlock and tractor outward so incoming craft do not pass through the new parking spaces.

Existing saved rooms and berth IDs are preserved. The current v0.5 6×4 room grid remains usable while the full fixed-zone layout migration is designed and tested.

### Remaining architectural upgrade

**Not yet complete:** Re-map all custom rooms into a fixed bridge/engineering + central modular slots schema, migrate dense old grids safely, and ensure that construction changes matching hull plating, corridors, and collision boundaries. This is the next substantive v0.6 milestone. Do not imply the current 6×4 legacy builder is the final interior.

## 3. Physical docking choreography

**Default speed philosophy:** Speed is measured in world units/second. A waypoint duration is distance divided by prescribed speed, so a close craft does not take as long as a distant one. Typical assisted alignment is ~350–415 units/sec outside the hull; final taxi slows to ~95–145 units/sec.

### Docking stages (simulator-backed)

| Stage | Motion | Camera and effects |
| --- | --- | --- |
| Request | Check range and reserve a real berth before moving | Confirm request, freeze manual steering |
| Outer alignment | Move radially outward to a 780-unit clear ring, then follow the shortest arc to the airlock's bearing | Ship turns along route, camera follows. Avoid solid hull |
| Side approach | Fly toward a position outside the chosen airlock | Camera tightens slightly |
| Tractor acquisition | Reach the emitter's assist zone | A tapering white beam connects mothership to ship with a traveling energy pulse |
| Airlock | Cross through the visible entrance | Opaque roof begins to dissolve to reveal real hangar infrastructure |
| Parking | Follow a path to the allocated physical bay, respecting larger ship size | Camera follows into hangar; clamps and berth markings remain visible |
| Interior overview | Finish docking and unload within storage capacity | Camera pulls out smoothly to full interior; UI changes context |

**Implemented in slice 1:** `dockingRoute()` produces the clear outer arc and approach/taxi sequence, `FlightScene.flyRoute()` moves the actual ship with distance-derived durations and smoothly interpolated headings; `drawTractor()` renders a beam from the physical emitter. At the final waypoint the craft is already at its assigned berth before `dockShip()` updates its logical state.

**Launch reverses the stages** from berth through airlock and tractor clearance to the external departure marker. The berth remains occupied until the ship has exited.

**Unfinished improvements:** Door leaf animation; clamping machinery; full traffic lane scheduling so multiple simultaneous autonomous ships cannot cross the same doorway; no arbitrary collision clipping during tightly turning routes; contextual engine sounds. These are not yet considered implemented.

### Save and interruption safety

At the moment a cinematic begins, save the last stable world state. While the vessel moves through a temporary animation, suppress autosave of in-between coordinates. After a successful dock/departure, persist the new logical state. On reload, previous corrupted save positions should be recovered to a safe outside location. A future transition-state save model could resume a cinematic in progress, but must never leave a flying ship inside an opaque hull.

## 4. Small ship families

All hulls share the official ARROW path. Additional details may not replace that recognizable silhouette.

| Class | Target 2D length | Visual differences | Gameplay role |
| --- | ---: | --- | --- |
| Scout | 59 | Light, clean triangular hull, narrow cockpit slit | Fast exploration and light mining |
| Miner | 85 | Larger shoulders, small twin extraction hardware | Slower, larger cargo, stronger mining |
| Cargo (future) | 95–105 | Longer central storage chassis, paired containers | Large haul transfers |
| Fighter (future) | 70–85 | Narrower wings and secondary weapon mount | Combat and escort |
| Heavy (future) | 120+ | Larger notched twin-engine rear | Construction support and fleet centerpiece |

Rendering uses the logo source path at a chosen scale; every class should face the same local +X nose direction, then rotate toward its physical heading. Large ships need multi-unit berth reservations and adjusted landing routes.

## 5. Mining and debris VFX

**Goal:** Industrial extraction, not an arcade laser toggle.

- **Ignition (0–140 ms):** A narrow tapered front travels from emitter to rock; very faint outer halo.
- **First contact:** Small ring shockwave at the actual asteroid hit point plus two or three white/gray rock sparks.
- **Continuous extraction:** Beam stays thin, with a bright pulse traveling from shooter to contact. Sparks and small debris emit periodically as real cargo is extracted.
- **Shutdown:** The final pulse travels toward the rock, the tail of the beam advances, then the impact emits a few extra sparks. The laser must not disappear instantaneously.
- **Depletion:** The real asteroid's finite ore reaches zero; its sprite disappears while large fragments and smaller particles split outward and fade independently.
- **Performance:** Bounded effect pool (currently 180 particles), time-based decay, no per-frame texture allocation, one Graphics effect layer. Future large-scale battles should employ pooling and visibility culling.

Slice-one files: `src/game/MiningEffects.ts` and `src/game/FlightScene.ts`. Permanent resources remain authoritative in `src/sim/engine.ts`, independent of the rendering.

## 6. Space atmosphere

Use the original Project ARROW website's quiet negative-space direction: near-black backdrop, faint monochrome nebula clouds, multiple parallax star layers, a few subtle arrow-shaped motes, and nearly invisible navigation arcs.

- Avoid a heavy evenly spaced square grid.
- Favor stable seeded star positions, not frame-to-frame random twinkling.
- Keep foreground effects sparse enough to retain visual contrast with the ship.
- Render no enormous gradient canvases for every effect; static Graphics and preallocated layers are sufficient for the first release.

## 7. Delivery milestones

### Slice 1: source logo, real side docking, effects and atmosphere
- [x] Find exact ARROW SVG source path from parent repo
- [x] Extract reusable logo-derived geometry
- [x] Draw flagship and two starter ship classes from the shared geometry
- [x] Side hangar, bridge and engine zones
- [x] Distance/speed-based autopilot route that avoids the main hull via outer clearance arc
- [x] Tractor beam acquisition/tether stage and physical berth arrival
- [x] Physical hangar row expansion and synced airlock offsets
- [x] Collision against logo hull and side pod for manual piloting
- [x] Laser pulse, afterglow, dust and asteroid breakup
- [x] Layered restrained starfield
- [x] Simulation regression tests
- [ ] Chromium end-to-end checks verified green and screenshot review
- [ ] Merge only after CI and browser checks pass

### Slice 2: believable fixed compartments and modular growth
- [ ] Move fixed command bridge and engine room out of arbitrary player-builder slots
- [ ] Define central modular slots with valid expansion and corridor access
- [ ] Deterministic room save migration with no lost installed modules, levels or resources
- [ ] Actual physical dimensions and hull connectors expand when rooms are built or upgraded
- [ ] Hangar doors and clamps respond to dock and launch state
- [ ] Physical room selection with highlight matching the exact deck slot
- [ ] UI acceptance: no floating controls obstruct required gameplay

### Slice 3: fleet traffic, sound and polish
- [ ] Serialize automated and manually piloted arrivals at a single hangar entrance
- [ ] Prevent ships from crossing an occupied bay or passing through another vessel
- [ ] Add minimal sounds with mute setting and no forced autoplay
- [ ] Rework animation easing after browser observation
- [ ] Profile CPU, GPU and low-memory mobile devices
- [ ] Ship class upgrade visuals and new player onboarding

## 8. Release gates

**Simulation:** `npm run test` checks conservation of ore, storage limits, upgrades, berth collision/reconciliation, legacy migration, logo path, physical docking route, energy pulses, and hull collision.

**Build:** `npm run build` must pass strict TypeScript and Vite production compilation.

**Browser:** `npm run test:e2e` runs Chromium desktop and mobile viewports; verifies start, launch, real docking completion, hangar actions, fleet/build controls, and no uncaught JavaScript errors. Run screenshots after changing UI or geometry, not just before major releases.

**Manual:** Verify pointer mining, visual tractor attachment, a bay assigned to a two-unit miner, expansion with parked ships, reload during docking, two-finger gestures and performance on an actual phone. Automated success is not a substitute for visual inspection.

**Shipping rule:** The main public branch is updated only when the current slice's tests pass. Features still planned should remain explicitly labeled in documentation rather than being presented as deployed.

---

**Out of scope:** Multiplayer systems, accounts, physically simulated crew, planet colonization, full 3D ship interiors, open-world conquest and real external RAVIN API calls. The current RAVIN fleet automation is deterministic local gameplay and does not consume model tokens.
