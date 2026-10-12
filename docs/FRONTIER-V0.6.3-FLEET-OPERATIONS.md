# FRONTIER v0.6.3 · Fleet operations

The intent is that **docking the ship you pilot never stops the rest of your fleet**. Every autonomous craft keeps its own mission, physical route and inventory while you watch or fly.

## Controls

Open **Fleet** (or press C) to see every ship, its cargo, current task and operational status. Each ship has three independent orders:

- **Mine:** Leave the hangar, mine the nearest available asteroid, return when cargo fills, unload, wait briefly, and automatically redeploy. The same order remains active until changed. Newly commanded miners do **not** require manual launch/pilot switching.
- **Return:** Stop mining, follow the physical return route, dock, unload and stay parked. A return ordered while launching waits until the ship safely clears its door before heading back.
- **Hold:** Stop and maintain position if in space, or remain docked if already parked. If inside an airlock, finish that route first so the ship never stalls across a hatch.

Click a ship's main row to pilot it directly. For safety, you cannot assume manual control midway through another ship's automated hangar taxi. If you issue an order to the ship you're currently piloting, FRONTIER first hands manual control to an available alternate ship, then dispatches your previous one.

**Send idle ships mining** bulk-dispatches any held nonactive ships.

## Autonomous state machine

Each non-player ship has an optional saved `order`, `turnaround` and `navigation`. Existing v0.6.2 saves with `mode: "auto"` and no `order` implicitly remain on a Mine mission.

The route is fully physical, not a teleport:
`Parked → Launch taxi → Side airlock → Exterior clearance → Mine → Return to docking ring → Outer alignment arc → Side tractor → Airlock → Berth → Unload → Turnaround → Launch again`

Approach, berth and exit coordinates come from the same north/south hangar geometry that powers the player's cinematic. The **active** ship is omitted from autonomous simulation, but all other ships continue moving during docking, undocking and interior camera transitions. Ships reserve parking slots while navigating through an airlock, so a second ship cannot claim an occupied berth. In-progress paths save and reload without emergency repositioning.

## Honest waiting states

Miners do not silently lose their task when temporarily unable to work:

- **Storage full:** Wait docked with undelivered cargo. When capacity becomes available, unload and resume the Mine order.
- **Deposits exhausted:** Return and wait docked. Preserve Mine as a standing order should deposits later become available.
- **Hangar full:** Stay outside the dock, reserve no conflicting berth, retry once a space opens.
- **Manual Hold/Return:** Stop only when explicitly directed by the player.

The status field shows why a ship is waiting, the cargo carried, and whether it is navigating a hangar, actively mining, or returning.

## Release checks

- Unit: command docked ship directly; repeat at least two complete cargo trips; preserve resource balances; recover from full storage; recall/hold; validate legacy saves.
- Unit: physical exit is frame-rate independent, increments by bounded world-space distances and retains berth reservations until clearance.
- Unit: save and reload while a secondary ship is still traveling through the side hangar.
- Browser: run the active ship's launch/dock cinematic while confirming another ship's world position continues to change.
- Browser: assign Mine / Return / Hold from the Fleet panel without taking manual control of the miner.
- Browser: existing desktop, mobile, fully expanded 12-bay, and lower-side docking playthroughs remain green.

Known later work: multi-ship traffic priority queues, audio cues, distinct asteroid target assignments for busy fleets, richer autonomous docking clamps and fuel logistics. This milestone does **not** imply server-side simulation or multiplayer; fleet work runs locally in the browser and capped offline simulation.
