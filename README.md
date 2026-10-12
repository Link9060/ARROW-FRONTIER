# ARROW: FRONTIER
> **A persistent 2D space exploration, mining, fleet automation, economy, and civilization-building game within Project ARROW.**

**Status:** Playable browser prototype v0.6.2 (dual side hangars); major planned features remain unimplemented  
**Document:** Master game design README, version 0.1  
**Parent ecosystem:** Project ARROW / Resonant Assist  
**Game:** ARROW: FRONTIER (AF)  
**Core experience:** Build a mobile civilization, pilot ships manually, automate fleets with game-native RAVIN logic, explore and trade across star systems, and optionally enter a shared multiplayer multiverse.

> This README is a **design specification**, not a statement that these systems are already implemented. Sections distinguish **agreed direction**, **proposed implementation**, and **open decisions**. Numbers and sample names are placeholders for balancing.

## v0.6.2 · Dual Hangars and Central Modules

The ARROW hull now holds **two independent side hangars** (A in the upper wing, B in the lower wing), with the **6×4 player-selectable modular room grid in the center**. Both 4-bay starter and 12-bay upgraded configurations fit inside the actual logo silhouette. The old room IDs, upgrade levels, inventory and berth assignments are preserved.

Small scouts and miners are rescaled to their marked spaces. A 2-unit mining vessel now occupies a single visibly combined double parking cradle, exactly centered on its simulated berth. Side-specific autopilot, tractor beams, landing doors and departure coordinates serve each hangar independently. Central-core drawings, lighting, colliders, and berth geometry all read from a shared floorplan rather than multiple unrelated constants.

**Verification:** Dedicated layout-fit tests cover both wings and all custom modules; Playwright launches and re-docks a saved miner through the lower hangar as well as checking desktop, mobile and a 12-bay save.

See [dual-hangar design notes](docs/FRONTIER-V0.6.2-DUAL-HANGARS.md).

## v0.6.1 · Mothership Quality Pass

**Release objective:** Fix the player's reported stretched `Launching…` overlay, odd camera framing, disjointed interior rooms, and arbitrary parking geometry without breaking saves.

The white overlay bug is fixed at its CSS source. The mothership now opens without an intrusive automatic banner, uses dark contextual notifications, and moves from wide ship view into a controlled departure close-up before flying out. Rooms now appear as equipment on a common lower-wing engineering deck, while the command bridge, engine assemblies and core reactor are permanent physical architecture.

Hangar rows are separated into left and right parking banks with a clear central taxi aisle; the docking autopilot travels along that passage and turns into an assigned berth. Camera fit, airlock coordinates, animation and hull collision honor the full size of expanded 12-bay saves. Thin exhaust and runway lights make ships and docks feel active without visual clutter.

Three Chromium browser flows cover desktop flight/mining/docking, mobile controls, and a previously upgraded 12-bay world at **1536×960**. See [the QA checklist](docs/FRONTIER-V0.6.1-QUALITY-PASS.md).

**Still planned:** Richer mechanical room upgrades, docking traffic scheduling, ship-to-ship collisions, ambient sound, and further animation polish.

## v0.6 · Living Mothership (First Implementation Slice)

This version replaces improvised spacecraft with geometry **sourced from the real Project ARROW symbol**, shared between the enormous mothership, scout and industrial miner. The flagship has permanent forward command and rear propulsion areas, structural trusses, a physical upper-side hangar, bay rails, and a two-leaf door that opens for side arrivals and closes after launch.

Docking is guided through outer-space alignment arcs and a **visible tractor beam**. Travel duration comes from distance and speed rather than teleport-like fixed timers. The final ship position matches its reserved physical berth, and hangar expansions grow real side-pod geometry and relocate the airlock.

Mining uses traveling beam ignition and shutdown, a pulsing extraction core, asteroid impact particles and larger/smaller breakaway fragments. The background now uses subtle nebula haze and layered monochrome starfields instead of a heavy grid. Manual flight respects the hull collider. A Chromium browser test gate checks launch, approach, docking and mobile navigation.

**Still planned:** Full fixed-zone room migration, physically larger custom room upgrades, simultaneous fleet docking traffic, animated clamps, and sound. These are not included in the first v0.6 slice.

See the [Living Mothership blueprint](docs/FRONTIER-V0.6-BLUEPRINT.md).

## v0.5 · Minimal ARROW UI Reset

**FRONTIER's frontend has been rebuilt** to match the core ARROW design language: black, white, restrained typography and simple navigation. Flight, Fleet, Build and Mothership Interior have clear, distinct purposes rather than a permanent collection of sci-fi dashboards. The mothership now renders its rooms from the same physical 6×4 coordinates used for construction, and you can click connected deck positions directly while building.

Phones have actual touch movement and mining controls. The camera accounts for the interface, ships accelerate and decelerate more naturally, and interrupted docking saves are protected or recovered. Existing simulation, resource, RAVIN fleet, and ship upgrade mechanics are retained.

See [v0.5 design and implementation notes](docs/ARROW-UI-RESET-V05.md) for details. This remains an early private-universe prototype rather than a feature-complete game.

## v0.4 · Cinematic Hangar & Ship-Scale Navigation

**Playable improvement:** FRONTIER now has a vastly larger arrow-shaped mothership with a real, detailed hangar. Your piloted vessel approaches an upper airlock, the opaque roof fades into a cutaway, the ship slides into its own size-compatible parking berth and the camera zooms out to reveal the mothership interior. Launching reverses the physical transition. Other docked ships occupy separate marked bays. Expanding or upgrading the hangar adds parking capacity, with larger classes requiring multiple adjacent berth units.

**Touch and trackpad:** Two-finger drag pans across the interior; pinch zooms in/out. Trackpad scroll pans and pinch zooms. A three-button zoom/recenter control provides precise alternatives. Engineering is a side drawer that leaves the physical interior visible.

**Save compatibility:** The game migrates older world coordinates and docked ships into the enlarged physical mothership without resetting progression. All AI/autonomous fleet work remains deterministic and **uses no real RAVIN model API calls**.

See [v0.4 cinematic docking notes](docs/CINEMATIC-DOCKING-V04.md). This remains an early single-player browser prototype, not the planned multiplayer space sandbox.

## v0.3 · Visual & Gameplay Refinement

**Released direction:** Sharper Retina/high-density canvas rendering, a larger opaque arrow-shaped mothership exterior, a compact Flight HUD, separate Fleet Command (C), and a mothership Interior screen (B) **only while the controlled ship is docked**. Primary launch and dock controls remain visible. The game simulation advances with elapsed time, keeping refining and fleet missions consistent at low frame rates. New automated tests cover frame-rate consistency and interior permissions.

See [v0.3 implementation notes](docs/V03-REFINEMENT.md) for details. This remains a local single-player prototype; the original long-term game design below includes planned, unimplemented features.

## Current playable implementation

**v0.2 · Mothership Expansion (October 2026):** A browser-based Phaser prototype currently includes manual 2D ship piloting, asteroid mining, docking and cargo unloading, two ships with instant control switching, deterministic game-native RAVIN mining automation, versioned local saves with offline catch-up, a connected 6×4 mothership room builder, power priorities, expanded storage, ore-to-alloy refineries, and docked ship upgrades through a fabricator.

**Important:** This is a small private-universe local prototype. It does **not** yet implement planets, a system/galaxy map, accounts, shared multiplayer worlds, market trading, piracy, conquest, or portals. See [Mothership Expansion implementation notes](docs/MOTHERSHIP-V02.md) and [First Flight notes](docs/FIRST-FLIGHT.md).

---

## Contents
1. [Vision and design pillars](#1-vision-and-design-pillars)
2. [Player fantasy and gameplay loop](#2-player-fantasy-and-gameplay-loop)
3. [Visual direction and presentation](#3-visual-direction-and-presentation)
4. [Mothership and room construction](#4-mothership-and-room-construction)
5. [Ship classes and equipment](#5-ship-classes-and-equipment)
6. [Hybrid manual and autonomous control](#6-hybrid-manual-and-autonomous-control)
7. [RAVIN game controller and API boundaries](#7-ravin-game-controller-and-api-boundaries)
8. [Instant ship switching](#8-instant-ship-switching)
9. [Navigation and travel](#9-navigation-and-travel)
10. [Mining and resource depletion](#10-mining-and-resource-depletion)
11. [Manufacturing, repair, power, and logistics](#11-manufacturing-repair-power-and-logistics)
12. [Economy, markets, and trade](#12-economy-markets-and-trade)
13. [Pirates, hazards, and combat](#13-pirates-hazards-and-combat)
14. [Planets, settlements, and colonization](#14-planets-settlements-and-colonization)
15. [Private universes and shared multiplayer](#15-private-universes-and-shared-multiplayer)
16. [Multiverse gateway and asset transfer](#16-multiverse-gateway-and-asset-transfer)
17. [Multiplayer fleets and offline persistence](#17-multiplayer-fleets-and-offline-persistence)
18. [Territory, alliances, and co-owned colonies](#18-territory-alliances-and-co-owned-colonies)
19. [Player docking and cooperative play](#19-player-docking-and-cooperative-play)
20. [Mothership emergency retreat](#20-mothership-emergency-retreat)
21. [Offline simulation and safety rules](#21-offline-simulation-and-safety-rules)
22. [Progression, research, and endgame](#22-progression-research-and-endgame)
23. [User interface and accessibility](#23-user-interface-and-accessibility)
24. [Technical architecture](#24-technical-architecture)
25. [Security, fairness, and economy integrity](#25-security-fairness-and-economy-integrity)
26. [First playable vertical slice](#26-first-playable-vertical-slice)
27. [Development roadmap](#27-development-roadmap)
28. [Open questions and design decisions](#28-open-questions-and-design-decisions)
29. [Glossary](#29-glossary)

---

## 1. Vision and design pillars

FRONTIER begins with a small ARROW mothership containing only essential rooms and one or more small vessels. The player launches a ship, visits asteroid fields and planets, extracts materials, returns to storage, expands the mothership, builds or buys specialized ships, establishes supply chains, and eventually develops a civilization spread across many locations. There are two complementary play styles: directly pilot ships and personally perform missions, or issue instructions and let automated ships carry out work in parallel.

The game's signature feature is **one civilization, many simultaneously operating vessels, and instant player control of any eligible vessel**. The player's perspective is not bound to a human avatar inside a cockpit. RAVIN is the fictional operating intelligence across the fleet; the player can take control of a vessel while other ships continue following orders.

### Design pillars
- **Hybrid control:** Active piloting and strategic automation are both fully supported; neither should feel like a lesser mode.
- **A physical home:** The modular mothership is a place with visible rooms, working equipment, hangars, and ships entering and leaving, not just an upgrade screen.
- **Consequential decisions:** Power, cargo, fuel, ship specialization, route risk, materials, and market prices interact.
- **Living worlds:** Finite deposits, settlements, trade networks, colonies, factions, and discoveries make space feel occupied and changeable.
- **Persistent but respectful:** Productive missions continue while offline; players are protected from hostile attacks while absent.
- **Private-first, multiplayer-optional:** A personal universe is always available; multiplayer is a deliberate choice through a gateway.
- **Efficient intelligence:** Routine in-game RAVIN operations require **zero calls to real RAVIN model APIs**.
- **Progressive scope:** A small, enjoyable browser-playable loop must work before adding multiplayer-scale complexity.

### Inspiration, not replication
The modular side-view growth evokes classic tower-building games. Ship survival and encounters evoke space roguelikes, while exploration, markets, and territorial strategy evoke space sandbox and grand-strategy games. FRONTIER should have its own original art, code, UI, economy, and mechanics.

## 2. Player fantasy and gameplay loop

**Starting state:** A modest mothership with a command center, hangar, engine room, small storage room, sleeping/operations quarters, and a basic power system. The starter craft may be an ARROW-branded multipurpose vessel; more classes unlock through play.

**Core loop:**
1. Review available power, inventory, fleet condition, and nearby destinations.
2. Select a ship in the hangar and launch into local 2D space.
3. Scan asteroids, mine materials, explore, dock, or complete a trade.
4. Return to the mothership or deliver to a station.
5. Unload and process resources; sell some for credits and retain others for construction.
6. Build rooms, improve equipment, repair ships, and increase fleet capacity.
7. Assign repetitive tasks to automated ships, allowing several missions to proceed at once.
8. Expand into additional planets, stations, colonies, star systems, and eventually the multiplayer multiverse.
9. Repeat at larger scale with more complicated logistical and economic choices.

**Long-term fantasy:** A tiny mining operation becomes a self-sustaining interstellar civilization with specialized fleets, colonies, allies, trade routes, research facilities, and a mothership capable of extraordinary intergalactic travel.

## 3. Visual direction and presentation

FRONTIER is a **2D game**, visually consistent with the wider ARROW ecosystem: predominantly black and white, subtle gray hierarchy, fine lines, clean geometric silhouettes, orbital arcs, restrained glow, particles, and smooth transitions.

### Views
- **Mothership side cutaway:** A tower-builder-like cross-section of stacked/connected rooms; construction visibly changes the ship.
- **Local flight view:** 2D ships, asteroids, stations, planetary approaches, mining beams, docking points, combat effects.
- **System map:** A clear orbital diagram with destinations, routes, fuel, ETA, and risk.
- **Galaxy map:** A network of star systems with exploration state, distances, access restrictions, and transit routes.
- **Fleet command:** A list/map of every owned ship, its mission, location, cargo, health, and autonomy status.
- **Colonies and settlements:** Expandable modular structures, production buildings, ownership, and defense.

Animations should communicate actual state: docking, cargo movement, power usage, reactor activity, damage, launches, travel, and portal activation. Avoid effects that sacrifice responsiveness on modest laptops or mobile devices. Respect reduced-motion settings.

## 4. Mothership and room construction

The mothership is the primary mobile base and a core progression object. Players begin with essential modules and **expand/add rooms**, choosing the function of each new space. Rooms differ in build cost, power usage, footprint, upgrades, production, and strategic utility.

### Starting modules
| Room | Purpose | Design considerations |
| --- | --- | --- |
| Command center | Fleet overview, navigation, directives | Required to manage operations |
| Hangar | Stores, launches, and receives small ships | Capacity and docking throughput |
| Engine room | Mothership mobility and transit | Fuel and power demand |
| Small storage | Holds cargo and materials | Finite inventory capacity |
| Sleeping/operations quarters | Crew-themed operations or service capacity | Whether human crew exists is not finalized |
| Basic reactor | Generates power | Fuel, output, and upgrade limits |

### Expansion candidates
- **Refinery:** Converts raw ore into refined resources.
- **Research laboratory:** Unlocks blueprints, advanced drives, and technologies.
- **Shipyard/fabricator:** Builds or upgrades vessels from materials.
- **Repair bay:** Repairs docked ships with time and material costs.
- **Shield generator:** Improves mothership defense and escape resilience.
- **Additional hangars:** Increase simultaneous docking and stored-ship capacity.
- **Cargo warehouse:** Increases storage limits.
- **Scanner/observatory:** Improves resource detection and discovery.
- **Trade terminal:** Handles market orders and logistics.
- **Advanced reactor:** Supports energy-intensive facilities.
- **Gateway chamber:** Late-game multiverse or long-range portal technology.

### Room mechanics
- Construction consumes materials/credits and may require build time.
- Active rooms draw power; reactors supply finite output.
- Low power triggers explicit prioritization, shutdown, or degraded operation.
- Room footprint and adjacency can matter: hangars near cargo bays might move goods faster, for example.
- Damage may temporarily interrupt services.
- Room upgrades change capacity, efficiency, power usage, or throughput.
- Production requires input materials, output space, and sufficient power.
- The ship should visually grow as rooms are added; not all rooms need identical shapes.
- Build mode should preview placement validity, connections, power impact, and total cost before confirming.

**Proposed balancing principle:** Expansion always offers a benefit and a cost; there should be no universally optimal room layout.

## 5. Ship classes and equipment

Ships are separately owned assets with hull condition, fuel/energy, cargo, equipment, location, autonomy setting, and current mission. Players may buy, build, repair, upgrade, dock, deploy, or lose them.

| Class | Primary role | Weakness |
| --- | --- | --- |
| Scout | Fast exploration and scanning | Limited cargo and defense |
| Miner | Efficient resource extraction | Vulnerable while mining |
| Cargo/hauler | Moving and selling large loads | Poor combat capability |
| Fighter | Combat and escorts | Limited industrial utility |
| Hybrid/multipurpose | Flexible starter and general tasks | Less efficient than specialists |
| Capital/specialized | Advanced large-scale operations | High cost and upkeep |

### Ship systems
- Hull integrity and armor
- Shields where equipped
- Engine thrust, maneuverability, travel speed
- Fuel and power capacity/consumption
- Cargo capacity and item mass/volume (exact model TBD)
- Mining tools and extraction rate
- Weapons and defensive modules
- Scanners and navigation equipment
- Docking compatibility and repair requirements
- Blueprint, class, upgrade slots, and optional cosmetics

A better mining laser can extract faster but consume more energy. Larger cargo modules extend trips but may slow ships. Fast engines may be less fuel-efficient. Each configuration should have clear strengths and weaknesses.

**Ship destruction:** Ordinary deployed ships can be lost in active play, including their unsecured cargo and installed equipment. The player can then switch to another surviving ship, colony, or mothership. Mothership destruction follows a special retreat rule described later.

## 6. Hybrid manual and autonomous control

The player can personally pilot any eligible owned ship while others execute automated orders.

### Control modes
**Manual:** Player controls steering, thrust, mining, weapons, navigation, and docking. RAVIN displays informational warnings but does not override ordinary inputs.

**Assisted:** Player retains control while game logic helps maintain heading, navigate toward a chosen destination, mine a selected target, or manage routine operations. Manual input should immediately override assistance.

**Autonomous:** The ship follows a selected mission and priorities: travel, mine, unload, trade, repair, refuel, explore, or escort where permitted. Missions can be paused, resumed, reprioritized, or canceled.

### Control invariants
- At most one ship is manually controlled by a player at a time.
- All other ships continue their assigned tasks.
- The former manually controlled ship resumes its prior mission or safely holds position when control switches.
- Autopilot should obey capacity, fuel, route, permissions, and danger constraints.
- Ships cannot manufacture resources or complete travel instantaneously.
- A ship without a valid route or necessary resources enters an understandable waiting/error state.
- The UI always makes clear whether a ship is manual, assisted, autonomous, idle, blocked, or in transit.

## 7. RAVIN game controller and API boundaries

**Firm requirement: FRONTIER must not consume the real RAVIN model quota for ordinary game activity.** The parent ARROW/RAVIN ecosystem has valuable AI capacity intended for real assistant functions. A fleet of hundreds of ships must not generate thousands of model calls.

### Two separate systems
1. **RAVIN proper:** The actual intelligence service and its limited API/model usage for real user needs.
2. **FRONTIER RAVIN Controller:** A deterministic, game-native automation engine that presents itself as the fleet's intelligence but uses **no model API**.

### What game-native RAVIN does
- State-machine/behavior-tree mission execution
- Route selection and pathfinding
- Resource target selection and reserve management
- Mining until cargo, fuel, or deposit limits
- Unloading and approved market delivery
- Automatic repair/refuel requests
- Fleet task scheduling and priority handling
- Risk avoidance and mission interruption
- Status notifications using templates and live game state
- Offline mission progression

### Directive examples
- Keep titanium reserves above a player-selected target.
- Mine iron until cargo is full, then return home.
- Sell excess copper at approved markets.
- Maintain a minimum fuel reserve.
- Prefer resource acquisition, profit, exploration, or balanced operation.
- Avoid danger or defend/retreat when online.
- Do not enter hostile or contested territory while offline.

### Possible future real-AI integration
An optional conversational planning feature could translate a natural-language order into structured game directives. **Not part of the first release.** If added, it must be explicit, separately metered, rate-limited, server-mediated, and never share unrestricted access to the main RAVIN credentials. Normal play must remain fully functional if the AI service is unavailable. Do not embed secrets in the browser.

## 8. Instant ship switching

**Agreed mechanic:** Player control transfers instantly between eligible owned ships anywhere in the universe, without physically moving a human pilot.

### Sequence
1. Open fleet list or map.
2. Select an owned ship.
3. Save current ship state and restore its automation/hold behavior.
4. Transition camera outward to system/galaxy view.
5. Move camera to the selected ship's location.
6. Load local scene and grant direct manual control.

The visual transition can target approximately 1–2 seconds when assets are available; actual duration depends on network/loading. No real AI call is needed.

**Cross-universe nuance:** A player can manage their private mothership and remotely select a ship deployed in multiplayer. Taking manual control of that multiplayer ship makes it actively present and vulnerable under multiplayer combat rules. Network connectivity and server authority determine what can be controlled; do not pretend offline actions are real-time remote control.

## 9. Navigation and travel

**Agreed design:** Three levels of navigation combine hands-on local flying with map-based long-distance transit.

### Local space
A continuous 2D scene around a specific asteroid field, planet, station, or mothership. Player can steer, accelerate, brake, scan, mine, fight, and dock. Local areas should have identifiable points of interest and collision rules.

### Star system map
Select planets, belts, stations, colonies, and other destinations. Preview route, estimated time, fuel, risk, and relevant discoveries. Long travel happens as a mission with progress rather than requiring the player to fly through huge stretches of empty space.

### Galaxy map
Navigate between star systems when ship drives/technology permit. More advanced mothership drives and eventual gateway technology unlock much longer-range travel.

### Travel behavior
- Manual launch from hangar leads to local 2D flight.
- Entering long-distance transit hands navigation to the game controller.
- During transit, player may watch a brief animation, manage the mothership, or switch ships.
- On arrival, the ship enters the target local scene.
- While **online**, travel may be interrupted by pirates, distress calls, discoveries, or hazards.
- While **offline**, protected civilian missions continue without hostile encounters.
- Fuel, range, route restrictions, and ETA are enforced.
- No invented instant travel except explicitly defined gateway/fast-travel systems.

### Planet bases and fast travel
Colonies and bases can become logistical anchors, repair/refuel points, and travel destinations. A base does not automatically eliminate all distance, fuel, or transit costs. Exact fast-travel rules remain to be balanced.

## 10. Mining and resource depletion

Mining is a primary early-game activity and should be satisfying manually as well as automatically.

### Manual mining
Approach a deposit, scan composition, aim a mining tool, extract resources over time, monitor energy/heat or tool limitations, and stop when the deposit is exhausted or cargo fills. Better scanners reveal valuable deposits; upgraded tools unlock tougher materials.

### Automated mining
The controller selects valid deposits, navigates to them, mines at a rate determined by equipment, tracks remaining deposit quantities, and returns/unloads/sells/waits according to instructions.

### Initial candidate materials
| Material | Early design role |
| --- | --- |
| Iron | Basic rooms, hulls, structures |
| Copper | Electronics, wiring, power systems |
| Titanium | Advanced hulls, upgraded equipment |
| Uranium | Advanced reactor/fuel technology |
| Exotic matter | Rare late-game experimental and gateway research |

These are **candidate game resources**, not final chemistry or balancing specifications.

### Finite resources
Asteroids and planetary deposits have finite reserves. Extracted resources reduce those reserves. A planet may become economically depleted, but depletion should not automatically physically destroy the planet. Planetary destruction is a separate rare late-game mechanic. Depletion encourages exploration, relocation, trade, recycling, and eventually advanced extraction technology.

### Additional possible depth
Resource purity, rarity, hazards, refining loss, scanning uncertainty, mining permits, contested deposits, and regeneration only where explicitly justified by game lore.

## 11. Manufacturing, repair, power, and logistics

### Production chains
Raw ore -> storage -> refinery -> refined materials -> room construction / ship production / repairs / trade.

### Power
Reactors generate finite power. Engines, shields, mining tools, refineries, and other modules draw it. Insufficient supply should produce clear tradeoffs, not mysterious failures.

### Repairs
Damaged ships require a compatible bay or station, materials, credits where applicable, and elapsed time. Repair queues and progress continue offline. Missing parts or insufficient capacity pause the job.

### Cargo movement
Materials must occupy a real inventory at a real location: ship cargo, mothership warehouse, station, or colony. Transfers require proximity/docking, a delivery mission, or an explicitly unlocked technology. Never duplicate items during transit.

### Automated logistics
Ships can run repeatable routes between mines, refineries, colonies, and markets. Each route has assigned cargo rules, destinations, reserve thresholds, fuel policies, and failure handling.

## 12. Economy, markets, and trade

Civilized planets, towns, stations, and player settlements provide markets where ships can buy/sell resources, equipment, fuel, and blueprints.

### Economic mechanics
- Credits as a spendable currency.
- Local prices influenced by supply and demand.
- Different settlements specialize in different resources and products.
- Trade routes can exploit price differences but cost time/fuel and carry risk.
- Players may buy or build ships and upgrades.
- Production and repairs consume materials and remove value from circulation.
- Taxes, fees, tariffs, and transaction limits are balancing options.
- Markets should clearly show buy/sell prices and available quantities.

**Example only:** Buy titanium for 30 credits at one market, sell for 75 at another, but account for transport fuel, fees, and potential pirate danger.

### Private-to-shared economy challenge
Private mining must remain meaningful, but unlimited risk-free resource import could destabilize a shared market. Proposed mitigations include finite deposits, production rates, shipping costs, economic sinks, transaction controls, and multiplayer-only rare blueprints or materials. Avoid invalidating peaceful private progression.

## 13. Pirates, hazards, and combat

Pirates may intercept online travelers, attack exposed ships, control dangerous routes, or occupy bases. Their behavior creates reasons to use fighter escorts, scanners, defenses, and safer paths.

### Online encounter flow
1. Ship enters a risky route or local area.
2. A possible encounter is rolled or triggered by world state.
3. Player receives warning and options: flee, manually pilot, fight, negotiate/trade where appropriate, or allow configured autopilot behavior.
4. Encounter resolves using actual equipment, tactics, health, and environmental conditions.
5. Damage, cargo loss, repair needs, salvage, or rewards persist.

### Combat roles
- Fighters protect mining and cargo ships.
- Escorts may accompany transports.
- Shields and armor absorb damage differently.
- Ship destruction loses the deployed ship and unsecured cargo.
- Emergency recovery/salvage technology is a future upgrade candidate.

**Offline rule:** No hostile attacks against absent players' protected ships or mothership; offline ships cannot attack others either. See sections 17 and 21 for multiplayer fairness.

## 14. Planets, settlements, and colonization

Planets have different terrain/resource profiles, civilizations, settlements, environmental constraints, and market opportunities.

### Planet archetypes
- Barren mineral-rich worlds
- Inhabited trade/civilization worlds
- Frozen resource worlds
- Anomalous worlds with unusual discoveries

### Settlements
Pre-existing towns and stations can offer markets, repair services, equipment, missions, and faction relationships. Not every planet is unoccupied or freely claimable.

### Player colonies
Players can establish planetary bases for extraction, storage, manufacturing, trading, and fast-travel/logistics. Colonies have buildable facilities, energy demands, output, upkeep, permissions, and defenses.

### Ownership hierarchy
Owning a city does not automatically mean owning its planet. A planet can have multiple settlements with different owners; an orbital station can be independently owned. This enables diplomacy and conflict below the planetary scale.

### Planet engineering and destruction
**Late-game concept, not MVP:** Players may eventually terraform or construct artificial worlds using immense resources and advanced research. Planet destruction should be exceptionally difficult, governed by strict multiplayer world-event rules, and never a cheap griefing tool. Severe planetary damage may be restorable. Whether full destruction is ever allowed in the shared world is still an open decision.

## 15. Private universes and shared multiplayer

**Agreed:** Each player has a private universe, plus an optional shared multiplayer multiverse accessible through a gateway/toggle.

### Private universe
- Other players cannot see, invade, or alter its assets, colonies, stations, or worlds.
- Personal mining, trading, construction, exploration, and automated fleet tasks are available.
- The mothership is a safe home and default return point.
- The player can remain entirely single-player.
- Private simulation and progression continue while offline within resource/time constraints.

### Shared multiverse
- A persistent multiplayer environment containing players, planets, stations, cities, colonies, fleets, markets, and contested territory.
- Players can trade, fight, cooperate, dock, form alliances, and establish joint colonies.
- Territory may change hands under defined capture rules.
- Some rare rewards/blueprints or unique opportunities may incentivize, but should not require, multiplayer participation.
- World simulation and economy must be authoritative and synchronized across players.

### Multiplayer is a deliberate opt-in
Entering shared space must clearly communicate combat risk, cargo transfer, and asset exposure. The private universe must never become attackable as a side effect of opting into multiplayer.

## 16. Multiverse gateway and asset transfer

The gateway should be represented physically as a portal/multiverse drive rather than a bare menu teleport. A console can initiate transfer, show manifest and destination, and play an ARROW-styled transition.

### Transfer from private to shared
- Mothership transfers to multiplayer.
- Ships **physically docked aboard** the mothership transfer with it.
- Stored cargo aboard transfers with it.
- Credits remain associated with the player account and usable according to economy rules.
- Undocked ships and private colonies remain in their original universe and continue valid tasks.
- The player can choose how to prepare cargo and docking manifest before transit.

### Returning to private
- Mothership and all docked ships aboard return.
- Stored cargo returns with the mothership.
- Deployed ships left in shared space **stay in shared space**.
- Multiplayer colonies and shared-world property remain in that world.
- No asset should exist in two realms simultaneously.

### Transfer safeguards
- Confirm manifest and destination.
- Enforce storage/docking capacity and eligibility.
- Use server-side atomic transactions or recoverable transfer states.
- Persist origin/destination and transfer history.
- Prevent duplication from disconnects or retry requests.
- Block or defer unsafe transfer during active combat as defined in the combat/logout rules.

## 17. Multiplayer fleets and offline persistence

**Agreed recent decision:** Logging out while in multiplayer automatically returns the mothership to the player's private universe. **Ships deployed outside the mothership remain in multiplayer and continue assigned tasks.**

| Asset | On multiplayer logout |
| --- | --- |
| Mothership | Automatically returns to private universe |
| Ships docked in mothership | Return with mothership |
| Cargo stored aboard mothership | Returns with mothership |
| Credits | Remain account-owned |
| Deployed mining ships | Remain in multiplayer; keep mining if permitted |
| Deployed haulers | Remain; keep approved deliveries/trading |
| Deployed repair jobs | Continue at compatible locations |
| Deployed scouts | Continue safe exploration where permitted |
| Multiplayer colonies | Remain in shared world |
| Ships without valid missions | Safely hold, dock, or wait |

### Offline protections and limitations
- Offline ships are not attackable by pirates or players.
- Offline ships cannot attack, blockade, capture territory, or obstruct players.
- Ships in contested resource zones may move to protected/safe deposits rather than monopolize territory.
- Production is bounded by finite cargo, fuel, deposit, market, and storage capacity.
- Players may return to their private mothership and remotely issue fleet directives.
- If the player manually switches to a shared-world ship, that ship becomes an active multiplayer vessel subject to combat.

### Important anti-exploit requirement
Disconnecting mid-combat must **not** grant instant invulnerability. A short, clearly signaled combat-logout resolution/grace period should finish before protection/retreat applies. Unexpected connection loss and server failure require fair recovery behavior. Exact timers remain to be designed.

## 18. Territory, alliances, and co-owned colonies

### Claimable assets
Asteroid fields, stations, colonies, cities, planets, and eventually systems may have separate ownership/claim rules. Planetary ownership is harder than station ownership; planetary destruction is harder still.

### Capture and defense
Conquest should require preparation, supplies, meaningful risk, and clearly communicated objectives. Protected offline players should not wake to find their entire civilization erased. **Proposed:** Scheduled contest windows or consent-based siege rules for persistent settlements.

### Alliances
Players can create groups for coordinated defense, trade, colonization, and expeditions. Permissions must govern who can build, withdraw, sell, invite, and initiate conflict.

### Joint colonies
Two or more players can found and co-own a colony, share construction costs, allocate production, and establish ownership percentages or governance agreements. Example: 50/50 co-ownership, with explicit contribution and withdrawal rules.

**Essential protections:** A co-owner must not be able to silently empty shared storage, unilaterally erase the colony, or expel partners without agreed authority. Support auditable transactions, role permissions, and dispute/exit procedures.

## 19. Player docking and cooperative play

### Small-ship docking
Players may request permission to dock their vessel at another player's mothership or station. Approved visitors can trade, repair, refuel, join missions, transfer cargo with permission, and view public rooms.

### Mothership-to-mothership docking
**Proposed later feature:** Temporary linked motherships form a mobile logistics/trading hub. Docking requires mutual approval, compatible ports, capacity checks, and safe undocking procedures.

### Cooperative missions
Players can escort one another, operate mining fleets together, share navigation intel, jointly develop colonies, and participate in alliance expeditions.

### Permissions
Separate public viewing, docking, storage access, ship servicing, trade, construction, and fleet management. Docking alone must never grant access to private inventory or administrative controls.

## 20. Mothership emergency retreat

**Agreed choice: Option B, emergency retreat.** The mothership is the player's long-term headquarters and should not be permanently lost in an ordinary multiplayer defeat.

### Proposed behavior
- At critical hull integrity, emergency multiverse drive initiates retreat to the player's private universe.
- Surviving docked ships aboard retreat with it.
- Mothership returns heavily damaged and may require extensive repairs before another multiplayer expedition.
- Retreat consumes resources/fuel and may lose some unsecured cargo, subject to balancing.
- Deployed ships not docked aboard are not automatically teleported home.
- Players receive a clear damage/repair summary.

### Design constraints
The retreat cannot be an effortless instant escape button. It should have transparent prerequisites, counterplay or risk during active combat, and meaningful costs, while still preserving the mothership itself. Exact critical-hull threshold, activation delay, cargo-loss formula, and multiplayer escape rules remain **TBD**.

## 21. Offline simulation and safety rules

Offline gameplay is a major feature, not an afterthought. Players should be able to close the browser and return to completed mining, deliveries, refining, repairs, and construction.

### Offline-allowed
- Mining at permitted deposits
- Civilian travel and deliveries
- Trading under existing orders and market constraints
- Ship repair/refueling
- Refining and production
- Room/colony construction
- Safe exploration under approved policies
- Mission completion and return/docking

### Offline-disallowed
- Being attacked by pirates or other players
- Attacking players or pirates
- Capturing territory or starting sieges
- Blockading or obstructing shared-world traffic
- Invulnerable occupation of contested deposits
- Any action that requires a real-time player choice and has no safe preconfigured default

### Catch-up simulation
Do **not** run high-frequency physics for every offline ship. Save authoritative mission state and timestamps. On reconnect, compute progress by processing scheduled events and resource constraints in chronological order:
1. Validate elapsed server time.
2. Process route arrival/departure events.
3. Calculate extraction/production only while inputs, fuel, power, capacity, and deposits permit.
4. Resolve unloading, approved trades, repairs, and queued construction.
5. Apply safe mission transitions; pause blocked missions.
6. Record events and present a concise return summary.

For shared multiplayer, server-side jobs or event-based updates may be needed to keep shared market inventory and resource deposits consistent while owners are absent. Catch-up cannot blindly create items if another player already consumed the same shared deposit.

### Welcome-back report
Summarize elapsed time, resources mined, credits earned/spent, deliveries completed, repairs finished, construction finished, discoveries, and blocked missions. Show a chronological activity log. Example values are illustrative, not guaranteed earnings.

### Safety/fairness
- Protection is automatic and does not require consumable shields or subscription fees.
- Offline state is determined server-side, not solely by a browser flag.
- Combat logout needs an anti-abuse resolution policy.
- Avoid designing offline progression around constant check-ins or punishing sleep/school time.
- Decide whether an offline catch-up cap is needed for balance; don't assume infinite production.

## 22. Progression, research, and endgame

### Early game
One mothership, one starter craft, nearby asteroid deposits, iron/copper mining, simple room upgrades, and basic trade.

### Midgame
Specialized mining/hauling/fighter ships, multiple simultaneous missions, refining chains, improved scanners, ship construction, trading hubs, repair bays, and colonies.

### Advanced game
Factions, alliances, territory, research labs, advanced ship drives, remote logistics, industrial colonies, and large fleets.

### Late game
A rare-resource research path unlocks a **mothership portal/gateway system** for travel far beyond normal ship range, potentially between distant galaxies. The mothership's special long-range ability makes it the centerpiece of major expeditions. Artificial planet construction/terraforming and tightly controlled planetary devastation are possible endgame concepts.

### Research tree
Suggested branches: propulsion, extraction, energy, manufacturing, navigation, defense, logistics, colony development, and exotic gateway science. Research costs time, facilities, materials, and discoveries.

**Separate portal concepts:** (1) the gateway connecting private and multiplayer realms, and (2) late-game long-range intergalactic travel. They can share lore/visual language but should have distinct unlocks and gameplay rules. Whether multiplayer entry requires late-game progression is an open decision; a reasonable option is earlier access to shared space with advanced galaxy jumping reserved for later.

## 23. User interface and accessibility

### Primary screens
- Mothership cutaway/build mode
- Hangar and ship editor
- Local pilot HUD
- Fleet list/command console
- Star system map
- Galaxy map
- Resource inventory and storage
- Market/trade screen
- Colony management
- Research tree
- Multiverse transfer manifest
- Multiplayer alliance/permissions interface
- Offline report and event log
- Settings, controls, and accessibility

### HUD essentials
Ship name/class, hull, shields, fuel, energy, cargo, speed, current objective, navigation marker, autonomy state, and danger warnings.

### Interaction
Keyboard/manual piloting for desktop, mouse-driven UI, controller support as a later option, and touch-friendly management where feasible. Avoid assuming all mobile devices can comfortably run precision flight controls.

### UX requirements
- Never conceal the cost of a transfer, trade, construction, or irreversible action.
- Show exactly which universe owns each ship and where it is.
- Distinguish protected offline operations from active PvP vulnerability.
- Provide pause/resume/cancel controls for missions.
- Show why a mission is blocked.
- Use performant particle effects and reduced-motion support.
- Match ARROW's monochrome visual identity while keeping status indicators legible.

## 24. Technical architecture

**Proposed stack, not yet implemented:** Browser-based 2D game using Phaser (or a comparable lightweight 2D renderer), integrated with Project ARROW's Entertainment Mode. Frontend framework and backend infrastructure should be chosen after inspecting the ARROW repository and hosting constraints.

### Major subsystems
- **Rendering/client:** Local flight, mothership, maps, animations, HUD.
- **Game state:** Ships, rooms, inventory, colonies, technologies, ownership.
- **Mission controller:** Deterministic RAVIN-style AI logic and behavior trees/state machines.
- **Navigation:** Local pathfinding, route planning, ETA/fuel estimation.
- **Economy:** Markets, prices, inventory transfers, production, trade.
- **Persistence:** Account-bound saves, events, versioned migrations.
- **Offline progression:** Server-authoritative elapsed-time calculations and queued events.
- **Multiplayer authority:** Shared-world actions, combat, ownership, synchronization.
- **ARROW integration:** Authentication, entry from Entertainment Mode, consistent design, and strict isolation from real productivity data.
- **Telemetry/testing:** Error tracking, economy integrity metrics, load tests, and simulation determinism tests.

### Suggested data entities
`Player`, `Universe`, `StarSystem`, `Location`, `Planet`, `Deposit`, `Mothership`, `Room`, `Ship`, `Equipment`, `Inventory`, `CargoTransfer`, `Mission`, `Route`, `Market`, `TradeOrder`, `Colony`, `OwnershipShare`, `Alliance`, `CombatEncounter`, `ResearchUnlock`, `GatewayTransfer`, `EventLog`.

### Important data invariants
- Every physical asset belongs to exactly one universe/location at a time.
- Every resource quantity is conserved across transfers unless legitimately produced, consumed, bought, sold, or lost.
- Mothership/ship dock relationships are explicit and validated.
- Player account credits cannot be duplicated by gateway retries.
- One manual control session per player, with authoritative handoff.
- No offline hostile actions against protected owners.
- Client-provided time, inventory, damage, and credits are never trusted as authoritative.
- Game saves cannot modify ARROW calendar, Relay chats, notes, or other productivity records.

### Performance strategy
Use fixed-step simulation for active local physics, coarse/event-driven progression for distant ships, and timestamp-based catch-up for offline missions. Load only relevant local scenes; keep strategic data lightweight. A large fleet should not require a language-model call or per-frame remote simulation for every ship.

## 25. Security, fairness, and economy integrity

- Server validates all purchases, mining output, trades, combat outcomes, ownership changes, and gateway transfers.
- Use transactional or idempotent transfer operations with unique IDs and rollback/recovery states.
- Prevent duplicate inventory from retries, disconnects, or simultaneous docking.
- Require explicit permissions for shared storage, colony withdrawals, docking, and alliance administration.
- Separate private-world and shared-world access controls.
- Protect accounts against unauthorized ship control.
- Use rate limits for orders, market activity, and future optional AI planning.
- Store no real RAVIN API credentials in client code; the game controller does not need them.
- Consider abuse reporting, moderation, griefing prevention, and audit trails before launching public multiplayer.
- Test edge cases: combat disconnect, gateway failure, two ships mining one finite deposit, full destination warehouse, offline repairs without materials, concurrent trade fills, ownership revocation during construction, and ship destruction during transit.

## 26. First playable vertical slice

**Goal:** Validate the fun of piloting, mining, unloading, upgrading, and handing work to automation. Not a full universe.

### Initial content
- One starter mothership with roughly six essential rooms
- One small local asteroid field
- One starter multipurpose ship and a second controllable ship
- Iron and copper deposits with finite quantities
- Basic cargo, fuel/energy, hull, storage, and docking
- Keyboard ship movement and mining controls
- A working manual/assisted/autonomous control selector
- Basic RAVIN mining/return mission logic without model APIs
- Instant switching between the two ships
- One room upgrade/construction action
- Save/load and a simple elapsed-time offline progress test
- Basic system map linking mothership and asteroid field

### Vertical-slice acceptance tests
1. Launch from hangar and fly around the field.
2. Mine a finite deposit; cargo and deposit quantities update correctly.
3. Fill cargo; RAVIN can return and unload.
4. Switch to another ship without losing the first ship's mission.
5. Construct/upgrade a room only with sufficient resources/power.
6. Close and reopen the game; inventory and ship state persist.
7. Offline mining progresses only until real constraints are hit.
8. No real RAVIN API calls occur.
9. No resources duplicate across ship/mothership transfers.
10. UI remains usable at common desktop sizes.

## 27. Development roadmap

| Stage | Focus | Deliverable |
| --- | --- | --- |
| **0.1 Foundation** | Mothership, 2D flight, mining, resources, ship switching | Playable local loop |
| **0.2 Fleet** | Multiple ships, directives, automation, offline catch-up, repairs | Persistent small fleet |
| **0.3 Universe** | System navigation, planets, trading, economy, colonies, pirates | Single-player sandbox |
| **0.4 Gateway** | Realm model, transfer manifest, asset ownership, protected logout | Private/shared transfer infrastructure |
| **0.5 Multiplayer** | Shared travel, player trade, docking, alliances, cooperative colonies | Controlled multiplayer test |
| **0.6 Conflict** | PvP, territorial rules, scheduled contests, emergency retreat | Balanced multiplayer conflict |
| **1.0 FRONTIER** | Polished experience, progression, research, galaxy exploration | Public release candidate |
| **Beyond 1.0** | Long-range intergalactic gateways, artificial planets, major world events | Expanded endgame |

Version labels are planning targets, not release promises. Build and test private/single-player foundations before shipping multiplayer.

## 28. Open questions and design decisions

### Already agreed in conversation
- 2D game with ARROW visual language.
- Modular, expandable mothership with functional rooms and power.
- Multiple specialized ships and manual piloting.
- RAVIN-style autonomous fleets with **no routine real model API usage**.
- Instant manual control switching among owned ships.
- Three navigation scales: local flight, system map, galaxy map.
- Mining, trading, finite deposits, colonies, pirates, and ship-loss stakes.
- Private universes protected from other players.
- Optional shared multiplayer multiverse.
- Gateway transfers mothership, aboard cargo, and docked ships.
- Undocked ships remain in their original realm.
- On multiplayer logout, mothership automatically returns home; deployed multiplayer ships stay and work.
- Offline civilian operations continue; hostile attacks against absent players are disallowed.
- Mothership defeat triggers **emergency retreat**, not permanent mothership destruction.
- Cooperative colonies, docking, alliances, and territorial ownership are desired multiplayer directions.
- Rare late-game intergalactic travel technology is a desired expansion.

### Still to decide
1. Does a private universe use procedural generation, a fixed seed, or authored starting systems?
2. What are the exact room grid, dimensions, adjacency, and power rules?
3. Is the starter ship always ARROW-branded and what are its starting stats?
4. Which ship systems consume fuel versus electrical energy?
5. What are precise mining rates, material recipes, and deposit depletion rules?
6. What are the exact offline catch-up limits, if any?
7. How long does combat-logout resolution last, and how do server disconnects behave?
8. How are offline protected ships displayed and routed in contested multiplayer areas?
9. Can players access shared space early or only after researching a gateway?
10. Are credits fully global across realms, or subject to fees and limits?
11. How do shared markets avoid inflation from private production?
12. How does a joint colony divide output, resolve disputes, and handle abandoned ownership?
13. How are territory captures scheduled and defended fairly?
14. Is permanent destruction of player-built planets ever allowed?
15. What are the exact emergency retreat costs, delays, and failure states?
16. How do docking and undocking work in active combat?
17. How much physical simulation is used for ships outside the player's local scene?
18. Which backend and database best fit ARROW's existing authentication and deployment?
19. How will public multiplayer moderation and anti-cheat work?
20. What is the minimum viable mobile experience?

## 29. Glossary

- **AF / FRONTIER:** ARROW: FRONTIER, the game.
- **ARROW:** Parent ecosystem that hosts the game's Entertainment Mode.
- **Mothership:** Player's expandable mobile headquarters.
- **RAVIN Controller:** In-game deterministic automation, not the real model API.
- **Pilot Mode:** Direct control of one ship.
- **Mothership Mode:** Build and operate rooms and internal logistics.
- **Command Mode:** Fleet, maps, directives, and remote missions.
- **Local Space:** Directly navigable 2D area.
- **System Map:** Travel between destinations in one star system.
- **Galaxy Map:** Travel between star systems.
- **Private Universe:** Personal, non-invadable game world.
- **Shared Multiverse:** Opt-in persistent multiplayer environment.
- **Gateway:** Realm transfer and, later, related long-range travel technology.
- **Deployed Ship:** A vessel outside the mothership, remaining at its own location.
- **Docked Ship:** A vessel physically stored in a mothership/station hangar.
- **Emergency Retreat:** Mothership preservation system after critical multiplayer damage.
- **Offline Catch-up:** Time-based progress computation while the player is absent.

---

## Project principles

1. **Make the first 10 minutes fun before building the first 100 star systems.**
2. **Every resource and ship must have a traceable location and owner.**
3. **Offline progress should reward planning, not punish real-life absence.**
4. **Real RAVIN AI capacity is reserved for real RAVIN needs.**
5. **Private worlds are sacred; multiplayer is optional and consent-based.**
6. **The mothership is a persistent home, not a disposable unit.**
7. **Build robust single-player simulation before attempting a massive shared universe.**

*This README captures the current FRONTIER concept and should evolve as prototypes validate or change individual mechanics.*
