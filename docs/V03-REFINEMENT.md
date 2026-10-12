# FRONTIER v0.3: Flight, Command, and Docked Interior

This release focuses on presentation and correctness rather than new planets or multiplayer systems.

## User-visible changes

- **Opaque ARROW-shaped mothership** in space. The hull has a delta arrow silhouette, engine pods, cockpit plating, and exterior expansion panels. Rooms are no longer shown through the outer hull.
- **Docked-only interiors:** the module builder is available only while the actively controlled ship is docked. Press B or INTERIOR to enter. Undock, then interior access is rejected until the controlled ship returns.
- **Dedicated Flight interface:** only currently piloted ship data is displayed in a compact upper-left panel. Primary Launch / Dock buttons remain visible in a fixed action bar.
- **Dedicated Command interface:** press C or COMMAND for fleet switching, RAVIN automation, mothership resource stocks and power. No lengthy permanent mixed data column.
- **Dedicated Interior interface:** build connected rooms, review power, refine, and fabricate; the original 6×4 deck builder still works.
- **Canvas clarity:** native backing resolution scales with device pixel ratio (up to 2×), smooth antialiasing stays on, and camera zoom is adjusted for screen width.
- **Readable hierarchy:** most critical UI text is at least 11px, stronger headings and grouping, brighter contrast, compact contextual tips. Responsive modes for laptop and mobile.
- **Accurate production clock:** game-native automation and ore refining now use real elapsed frame time split into small substeps rather than clamping all long frames to 50 ms. This prevents silent slowdown on low-FPS machines. Manual piloting movement remains bounded per frame to avoid large displacements after stalls.
- **Docking clearances:** dock radius expands to contain the larger silhouette, launch position moves beyond the physical hull, and the cockpit camera follows the mothership while docked instead of tracking an invisible ship.

## Controls

| Action | Control |
|---|---|
| Pilot | WASD / arrows |
| Aim | Mouse |
| Mine asteroid | Hold click while targeting or SPACE for nearest deposit |
| Dock or launch | E / visible action bar |
| Switch ships | Q / Command panel |
| Fleet Command | C |
| Mothership Interior | B (while docked) |
| Save | Save button |
| Exit Command / Interior | Escape |

## Technical verification

- The preexisting simulation suite covers resource conservation, automation, room construction, power, fabrication and save migration.
- New regression tests verify dock-only interior access, instant ship switching permission changes, production consistency between 12 and 60 FPS, and non-finite frame inputs.
- GitHub Actions runs `npm test` and `npm run build` before merges. An additional browser visual pass should verify desktop/mobile density, interaction, and navigation after CI succeeds.

## Scope

This remains a local, browser-only prototype. Account synchronization, shared multiplayer, real AI inference, system travel and planet construction are still planned, not implemented. Game-native RAVIN automation remains fully deterministic and does not spend model API tokens.
