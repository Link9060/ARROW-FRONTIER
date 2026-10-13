# FRONTIER v0.6.4 · Contextual construction

The Build tab is now **deck-first**, not a permanent combination of module catalog, room settings, power readouts and ship upgrades.

## Default state

Opening Build shows only:
- A title, one-line guidance and the existing 6 × 4 deck grid.
- Installed rooms with room codes and levels.
- Clickable **+** markers only next to existing rooms.
- Nonadjacent cells marked unavailable until the ship expands.

The initial screen does **not** show a module catalog, power block, refinery production ledger, persistent room details or ship upgrades.

## Click a +, browse, confirm

1. Select an available **+** in the 6 × 4 deck, or its matching marker in the actual mothership interior.
2. The five buildable rooms are listed by name and code. **No materials are spent merely by selecting the slot.**
3. Select one of the listed rooms to expand its information dropdown.
4. The expanded sheet includes a room purpose, required **construction materials** with needed/owned counts, benefits, drawbacks, ongoing material and power inputs, and the output or benefit it actually provides.
5. Only **Build Room** spends inventory and installs a module. The button is disabled while required materials are missing. Inventory readiness refreshes while the panel is open.
6. After building, the same selected cell becomes an installed room, not another build slot.

Clicking an installed room opens its status and a **Room information** dropdown. Its **Upgrade** dropdown reveals next-level output, required upgrade costs and an explicit Upgrade action. Reactive machinery can still be enabled or disabled.

## Correct economics

Module descriptions reflect the current simulation, not speculative features:
- Warehouse: 200 storage capacity at level 1, +150 at each later level; does not generate ore.
- Reactor: 22 base power; +10 per additional level; no ongoing material usage.
- Refinery: consumes 2 iron + 1 copper per alloy; each room level produces up to 1 alloy per 4 seconds.
- Fabricator: consumes power to enable ship upgrade actions, but does not produce alloy passively. Individual installed upgrades cost separate materials.
- Hangar: +4 parking units per module level, subject to the full 12-bay hull capacity; does not automatically produce ships.
- Command Bridge: starting core module with 3 power demand and fleet/navigation support.

## Feature relocation

**Ship upgrades are in Fleet**, beneath its power information. They only become available after the player builds and powers a Fabricator; upgrade costs and ship docking restrictions are unchanged. The Build tab remains strictly for the mothership grid and the contextual room controls selected from it.

## Regression gate

- Existing desktop, mobile, upgraded-hangar and fleet e2e playthroughs.
- Grid has exactly 24 slots and no permanent options on Build open.
- Adjacent + opens the five room choices; selecting one opens the true cost/operation dropdown.
- Browsing never mutates storage or builds rooms.
- Explicit Build spends resources once and installs the selected room in its chosen saved position.
- Installed-room upgrade and activation remain accessible through the selected room only.
- Fabricator ship upgrades work from Fleet, not Build.
- At narrow phone widths, expanded material rows and confirm buttons remain usable.
