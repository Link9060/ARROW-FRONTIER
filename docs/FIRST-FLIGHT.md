# First Flight: implementation notes

This document covers the **implemented vertical slice**, not the full game concept in README.md.

## What works
- A scrollable 2D local-space field with 27 finite iron/copper asteroids.
- A visible four-compartment mothership cutaway (concept art, not a room builder).
- Two separate vessels: player-controlled hybrid scout and automated industrial miner.
- WASD/arrow movement; mouse aiming; hold mouse click on asteroid or SPACE to mine.
- Mining range, finite resources, limited cargo, mothership storage capacity.
- E/GUI launch and E/GUI dock; cargo unloads to the mothership on docking.
- Q/fleet list to transfer manual control and hand previous ship to deterministic RAVIN-style autopilot.
- Autonomous miners choose deposits, travel, mine, return, unload, and wait when storage fills.
- Local-browser autosave every 12 seconds, manual save, and save-reset confirmation.
- Offline catch-up for automated missions capped at two hours per return.
- Unit tests for conservation, limits, docking, ship switching, offline cap, and automation.

## What is *not* implemented
Multiplayer, private/shared multiverse gateway, real multiplayer accounts, remote saves, piracy/combat, room construction, trading, refineries, credits, ship purchasing, star/galaxy maps, sound design, and production-grade anti-cheat. The README is a design roadmap, not a feature completion list.

## Local development

Requires Node 22+ and npm.

1. `npm install`
2. `npm run dev`
3. Open the local URL reported by Vite.
4. Run `npm test` and `npm run build` before pushing.

## Deployment
The workflow verifies TypeScript, unit tests, and Vite build on PRs. Merging into main triggers a GitHub Pages deployment. Repository Settings -> Pages must use **GitHub Actions** as the source. The public URL, once enabled, should be `https://link9060.github.io/ARROW-FRONTIER/`.

## Save format
Prototype data lives only in that browser's `localStorage` under key `arrow-frontier-first-flight-v1`. Changing devices or clearing browser data removes the save. The client clock controls catch-up in this experimental local build; do not reuse that approach for multiplayer.

## The next milestone
Make the mothership compartments genuinely buildable/upgradable, add more ship equipment and resources, formalize fuel/power rules, improve mining feedback, and then add system-map travel.
