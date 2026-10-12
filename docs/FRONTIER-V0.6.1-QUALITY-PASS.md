# FRONTIER v0.6.1 · Game-quality cleanup

**Status:** QA candidate. Code stays in the `fix/v061-gameplay-art-direction` branch until tests and visual review are complete.

## Source of the redesign

The player's 1536×960 screenshots revealed a tall white **Launching…** rectangle, clipped and overcrowded camera transitions, floating room widgets, arbitrary spacecraft parking and disconnects between physical room geometry and navigation. A second screenshot showed a heavily upgraded 12-bay ship, so all changes must be tested using *both* a starter save and that large variant.

## Completed changes

1. **Status overlay:** Removed the CSS rule assigning both `top` and `bottom` to the toast during transitions. Bounded its width/height, changed the high-contrast white card to a discreet dark notification, and removed the automatic onboarding banner. The scene should visually be the focal point.
2. **Real interior deck:** Kept every legacy room id and its original 6×4 build coordinate, but drew its physical footprint in a single lower-wing engineering deck, inside the ARROW silhouette. Eliminated UI-like floating room cards and duplicated bridge/engine representations.
3. **Distinct fixed systems:** Dedicated mechanical engine housings and triple exhaust nozzles, angled bridge deck, reactor core, shared service gantry, and side hangar.
4. **Hangar traffic layout:** Left/right parking banks separated by a central taxi aisle, with larger industrial ships occupying paired banks. Expanded rows extend outward at the same spacing used by rendering, actual docking paths, and the hull collider.
5. **Consistent ship placement:** Parked ships inherit one centerline coordinate from berth geometry and face the airlock. Autopilot follows the real service aisle then turns into the assigned bay.
6. **Camera:** Dolly toward the parked ship before departure, ease to the flight camera, and avoid extreme closeup zoom. Interior auto-fit accounts for the actual size and airlock position of an upgraded 12-bay craft.
7. **World feedback:** Gentle engine/exhaust motion, physical hangar guidance lighting, dynamic small-ship aft thrusters, unobtrusive ship labels.
8. **Persistence:** Recover older interrupted cinematics based on actual hull collision instead of a guessed rectangle. Preserve a flying ship legitimately passing through the hollow ARROW rear notch.
9. **Regression gate:** Keep the full existing unit/production-build suite and add Playwright checks on a locally saved 12-bay mothership, launch toast dimensions, restored world state, desktop flight/mining/docking, and mobile controls at real viewport sizes.

## Shipping checklist

- [ ] CI unit tests pass
- [ ] CI `npm run build` passes
- [ ] Chromium launch / dock / mining / build / fleet passes
- [ ] Chromium mobile touch simulation passes
- [ ] Upgraded 12-bay persisted-world Chromium scenario passes
- [ ] Review screenshots at 1280×720, 1536×960 and 390×844 viewport sizes
- [ ] Confirm the existing main branch is unchanged until PR merge
- [ ] Merge and validate GitHub Pages deployment

## Known deeper-work items

This pass improves the actual playable top-down game, but not every future system is complete. Still on the roadmap: simultaneous multi-ship hangar traffic arbitration, animated mechanical parking clamps, custom module floor-area expansion, collisions among ships, ambient audio, and richer equipment animation. A full engine/renderer refactor should only follow after the game feels reliably good.

## Design acceptance

**No amount of green unit tests substitutes for visual inspection.** Release only if the mothership reads as one spacecraft with integrated compartments, starts without popups, and leaves/enters its physical hangar naturally. Where a previous failure is reproducible, the automated tests must capture it.
