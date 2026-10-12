# v0.4 · A real mothership and cinematic hangar

**Status:** Implementation specification for the merged code after CI and browser verification.

## The important change

The mothership is now a **physical place in the same 2D world as your ship**, not an instantaneous dock flag or full-page room-grid menu. Its arrow-shaped exterior is roughly twenty times the length of a starter scout. The interior lives under a separate opaque roof layer. Landing lifts the roof visually, while keeping the game world and hangar coordinates consistent.

### Manual docking sequence

1. Pilot an undocked ship within the mothership's large docking approach radius.
2. Press **E** or **DOCK & UNLOAD**.
3. The ship enters a locked automatic approach: camera tracks the craft and zooms toward the upper airlock.
4. The ship aligns with the upper hull hatch.
5. The roof slowly fades to reveal machinery, internal rooms, hangar rails, bay markings, service lights and the lower deck.
6. The ship slides from the airlock into the **reserved, size-compatible numbered berth**.
7. The ship becomes docked; resources unload into mothership storage within storage limits.
8. The camera pulls back to reveal the entire mothership interior, including any other ships physically parked in their bays.
9. Ship controls switch to Hangar Mode. Players may launch, open the room engineering drawer, pan and zoom around the entire interior.

**Launch** is the reverse: camera moves toward the ship, ship taxis out through the airlock, opaque hull settles back over the interior and the camera returns to following the ship in space.

### Hangar berths

- Each starter level-1 hangar holds **four parking units**.
- A small scout consumes **one unit**. The initial industrial miner is a **two-unit** vessel; heavy/capital vessels can take **three** units.
- Wide ships require contiguous open spaces on one parking row.
- Each added hangar or hangar level adds four units, up to the current visually implemented limit of twelve.
- Every parked ship gets its own unique berth and world-space position. Assigned berths are preserved through save reloads when valid.
- Over-capacity docking is rejected rather than overlapping spacecraft or creating duplicated hangar inventory.
- Autonomous vessels also follow capacity rules. The visible cinematic is currently reserved for the manually piloted ship.

### Camera navigation

While docked and viewing the interior:
- **Two-finger drag:** pan in any direction.
- **Two-finger pinch:** manually zoom out or in.
- **Trackpad two-finger scroll:** pan horizontally/vertically.
- **Trackpad pinch / Ctrl+wheel:** zoom around the pointer.
- **+ / −:** step zoom.
- **RECENTER:** animate back to a full-ship overview.
- The camera retains a manually selected view until RECENTER, switching modes, or reentering a docked session.

The touch canvas deliberately disables native browser gesture scrolling **within the game surface** so gestures control the in-game camera instead. Page UI remains tappable.

### Interior and flight UX

- **Space:** opaque ARROW hull and freely piloted vessel. The deck plan is hidden.
- **Cinematic transition:** camera zoom, airlock entry/exit, ship taxi, partial roof reveal.
- **Interior:** full cutaway is visible with parked ships and a compact Hangar control panel. **B** opens an engineering drawer alongside the rendered ship, instead of hiding the scene behind a huge modal. **C** opens fleet command.
- Desktop HUD stays compact and mobile receives a collapsed action shelf to keep most of the scene visible.

### Save migration

The `worldRevision=4` flag upgrades the existing local save format in place:
- Moves the old world coordinates to the enlarged universe around the new home location.
- Moves old asteroid deposits out of the much larger physical mothership hull.
- Converts saved docked ships into real numbered berths without deleting their cargo or upgrades.
- Keeps prior inventory, rooms, mission state, and progression.
- Updates saves once; later reloads do not repeat the coordinate migration.

### Tests

`tests/cinematic-hangar.test.ts` covers unique berth positions, large-ship footprints, hangar full behavior, upgraded capacity, berth persistence, old save migration, and safe launch position. Existing tests continue to check mining, automation, refineries, construction, and save safety.

### Out of scope / planned

The v0.4 cinematic is **on a single local star-system scene**, not yet a 3D ship walk-through or networked fleet simulation. Automated ships are visually parked when docked but do not yet each play their own full taxi animation. Ship collisions with the mothership exterior, door damage states, sound design, animated engineering crew and large hangar traffic scheduling are future improvements.

No real RAVIN language model requests or usage credits are consumed by this system.
