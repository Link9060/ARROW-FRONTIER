# FRONTIER 0.6.2 · Inside the ARROW

The mothership is no longer a single upper parking garage with a detached lower room deck. It now has **one central configurable fuselage** between **two mirrored physical hangars**.

## Coordinates and source of truth

Use `src/sim/flagshipLayout.ts` for all physical hangar coordinates. This is shared by berth allocation, dock/launch routes, art, effects and colliders. `src/game/deckLayout.ts` places the unchanged saved 6×4 room grid in the center.

ARROW faces +X, with the bridge in the narrow front and split-tail engines in the rear. Upper/North uses negative Y and Lower/South positive Y.

| System | Coordinates (ship-local) |
| --- | --- |
| Central modular deck | X −242..+270; Y −59..+59 |
| North Hangar A | X −282..−62; Y −77 up to −134/−189/−244 by capacity |
| South Hangar B | X −282..−62; Y +77 down to +134/+189/+244 |
| Berth columns (both hangars) | X −240, −145 |
| Berth row depths, mirrored | ±106, ±161, ±216 |
| North/South airlocks | X −75, Y ±250 |
| Tractor emitters | X −75, Y ±272 |
| Approach points | X −75, Y ±480 |
| External release | X −75, Y ±802 |

The core leaves enough clearance for ships taxiing along either wing, without sliding through installed rooms. The 4/8/12 berth levels install **two new bays per side** with each expansion. These compartments grow *inward within the actual ARROW logo*, not as rectangles that extend beyond the hull.

## Bay assignment and ship scaling

Legacy berth indices remain unchanged:
- 0,1: North A, inner tier
- 2,3: South B, inner tier
- 4,5: North A, second tier
- 6,7: South B, second tier
- 8,9: North A, outer tier
- 10,11: South B, outer tier

Small scout hulls render at 39 world units in length; industrial miners at 48. Both fit inside the ~77×52 bay. A large ship spanning two adjacent indices gets one physically **merged, centered two-bay cradle**. In-flight visual scale stays consistent with parked scale.

South parked ships face +Y; North parked ships face −Y. On save load, valid old assignments are preserved but ships are moved to the new true berth centers.

## Docking and launch

1. Request docking while inside normal range.
2. Find a contiguous berth. The reserved index determines the side.
3. Fly out and around the capital hull using a safe outer arc toward that side.
4. Align and follow its tractor emitter toward its side airlock.
5. Move down a free service lane at X −75. Travel to the reserved row's open approach lane, cross to the allocated berth center and park.
6. Camera reveals the physical hangar while the hull fades away.
7. Launch reverses the route **through the SAME side**; the ship is released outside the hull facing the side it exited.

The roof's two independent airlock-door sets open and close during cinematics. The tractor beam originates from the selected side, never from a fixed upper-side emitter.

## Center deck

All player-selected rooms remain at their saved integer 6×4 positions. The visual module footprint and clickable hit target use the same `deckCellPoint()` coordinate. Building and upgrading do not silently move a room. Starter bridge, reactor, hangar and storage logic remain intact; the command nose and split engine fins are visual fixed architecture surrounding the central deck.

## Release gates

- Unit: every bay, both complete floors, all 24 room cells and core deck corners must be inside the concave ARROW outline.
- Unit: both sides have correct parking headings and side-specific tractor/airlock/departure points.
- Unit: 2-unit ships remain centered and keep save assignments.
- Browser: baseline desktop launch, mine, return, dock, Build, Fleet.
- Browser: true small-screen touch launch/navigation.
- Browser: upgraded 12-bay local save rendered at 1536×960.
- Browser: reload with a docked **South Hangar miner**, launch into southern space, manually return to dock range and land back in South.

Do not ship because a TypeScript build passed. Review screenshots for legibility and visible spatial consistency. Preserve the public main branch until this series passes.
