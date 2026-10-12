# ARROW: FRONTIER v0.2 · Mothership Expansion

Status: **merged into main; all automated simulation tests and the production build passed. Public-browser playtesting is still recommended.**

## What's new

- Open the **MOTHERSHIP** panel from the top navigation, sidebar, or `B` key.
- See a 6×4 blueprint grid. Select a room type, then click an **empty connected slot** to place it.
- The mothership exterior in the flight scene immediately reflects installed rooms, their upgrades, and whether they are powered.
- Build storage modules, fusion reactors, ore refineries, and a ship fabricator.
- Every room consumes real iron/copper/alloy according to its recipe. Construction cannot overdraft inventory.
- Storage expands by 200 per additional level-1 warehouse; upgrading a warehouse adds 150 per level.
- Reactors produce 22 power, increasing by 10 for each level; the command/hangar/storage rooms receive power priority, then refineries and fabricators.
- Disabled or underpowered production modules do not function. Rooms are retained rather than destroyed.
- Refining produces **one alloy from two iron and one copper every four seconds**, multiplied by powered refinery level. It continues during permitted offline progress, capped at two hours of simulated time per load.
- Powered fabricators can install up to three mining laser upgrades or three cargo upgrades on *docked* ships.
- Existing v0.1 saves are migrated to version 2 while preserving stored ore, ships, asteroids, and mining progress. The original v0.1 save key remains as a backup.
- Add a **resume idle automation** button for non-active ships.
- Extended unit tests for valid placements, material conservation, power priorities, refining, upgrades, offline manufacture, and migration.

## Interaction guide

1. Mine enough iron and copper and return to the mothership to unload.
2. Open **MOTHERSHIP** (or press `B`) and select **Ore Refinery**.
3. Click an adjacent empty grid cell. The cost is deducted immediately and the refinery becomes visible in space.
4. Watch the alloy count increase as long as the refinery is powered and has enough inputs.
5. Build a **Ship Fabricator** once you have alloy.
6. Dock a ship, choose it in the fabricator panel, and improve its mining speed or cargo capacity.
7. Add storage and reactors as the mothership grows. Upgrade constructed rooms when you can afford the materials.

## Design rules

| Module | Construction cost (iron / copper / alloy) | Base energy | Effect |
| --- | --- | --- | --- |
| Cargo Warehouse | 22 / 8 / 0 | 1 | +200 storage, +150 on upgrade |
| Fusion Reactor | 34 / 14 / 0 | generates 22 | +10 output per upgrade |
| Ore Refinery | 28 / 18 / 0 | 8 | 1 alloy / 4 seconds per level |
| Ship Fabricator | 44 / 22 / 4 | 7 | Allows docked ship upgrades |
| Command Bridge | Starter | 3 | Core, not constructible |
| Main Hangar | Starter | 3 | Core, not constructible |

Construction connects orthogonally (not diagonally). Rooms cannot overlap or leave the grid. Power priority is deterministic; underpowered structures appear dimmed. No actual RAVIN model API keys or calls are used.

## Limitations

This remains a browser-hosted **single-player prototype**, not a secure persistent online game. Data lives in localStorage and offline catch-up uses the client clock. The room builder is a functional grid-based subsystem, not a freeform interior editor. Repair bays, fully navigable interiors, crew, sound, reactors requiring fuel, trade, planets, multi-system travel, account sync, and multiplayer are not implemented. An expanded rendering/production system is an important foundation, not final balancing.

Run `npm install`, `npm test`, and `npm run build` locally. CI checks all changes and deploying to GitHub Pages requires the repository Pages source to be set to GitHub Actions.
