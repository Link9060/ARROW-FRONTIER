# FRONTIER 0.5 · ARROW Interface Reset

**Scope:** A frontend rewrite focused on clarity, predictable navigation and shared spatial structure. The existing simulation, inventory, refining, fleet automation and save formats remain in place.

## Design rules
- **Black / white / quiet gray**, without blue neon, military interfaces or dense sci-fi terminology.
- **One focus per screen:** Space shows the active ship and cargo; aboard the mothership shows the ship and launch/room-management actions.
- **Navigation stays in one place:** Fleet (`C`), Build (`B`, while docked) and Save.
- **One primary action:** Launch when docked, Dock when flying. No duplicate action stacks or persistent four-panel dashboards.
- **Detail on demand:** Fleet and Build live in side drawers instead of occupying half the play space all the time.
- **Room locations are real:** Physical deck coordinates in the space scene and the 6×4 construction grid use the same mapping from `src/game/deckLayout.ts`.
- **Responsive stage:** Camera framing accounts for the HUD and drawer. Retina backing remains supported.
- **Touch is playable:** Directional flight pad and Mine control on coarse-pointer mobile screens. Interior still has two-finger pan, pinch zoom and Fit ship.
- **Save recovery:** Never overwrite a safe checkpoint during cinematic ship movement; recover older corrupted undocked hull positions when loading saved worlds.

## Player journey
1. Press **Enter Frontier**.
2. While aboard, see the real cutaway mothership and your parked vessel. **Launch ship** is the primary action. **Manage rooms** enters Build, opening a side inspector.
3. Build mode highlights available physical deck positions. The drawer also has an accurate map, blueprints, upgrade details and systems status.
4. Launch triggers the cinematic transition, returning to a full flight view.
5. The Flight HUD shows the active ship and cargo. WASD and mouse/Space on desktop; arrow touch controls and Mine on mobile.
6. Fly toward the mothership and dock. Inside the hangar, the roof dissolves, your ship parks in a berth, and the camera reveals the deck.
7. Fleet (`C`) gives access to autonomous ships, storage totals, power and a protected Reset save action.

## Verification
- Existing simulation tests and new physical deck/corrupted save tests must pass in CI.
- Desktop, laptop and mobile preview should load the game, Fleet and Build without console errors.
- Validate full launch/dock, ship switching, mobile flight and touch mining, camera movement, and construction.
- The project stays a local single-player browser prototype. There are no accounts, networked multiplayer universes, or real AI model token consumption in the game.

## Design debt / future work
- Hangar floor machinery and other rooms need richer but restrained graphics.
- The 6×4 deck is a physical schematic mapped around the central hangar, not yet navigable room interiors.
- World collisions and fleet traffic avoidance are not fully implemented.
- More robust end-to-end browser tests should be part of CI, not only manual review.
