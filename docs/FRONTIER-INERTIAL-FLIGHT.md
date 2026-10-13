# Inertial manual flight (Asteroids-inspired)

ARROW Frontier's manually controlled ships now have independent facing and
velocity. This is an original TypeScript implementation inspired by the
Asteroids-style browser bookmarklet, not a copy or injected third-party script.

## Controls
- **W / Up:** fire forward thrusters in the ship's current facing direction
- **A / Left:** rotate counterclockwise
- **D / Right:** rotate clockwise
- **S / Down:** brake without automatically reversing the ship
- **Space / Mine:** mine nearby resources, unchanged
- **E / Dock:** launch or start docking when in range, unchanged

The mobile four-button pad uses those same thrust/turn/brake commands.
Keyboard focus recovery and screen buttons share one set of inputs, so pressing
a key isn't counted twice.

## Flight feel
- Direction and heading can differ: release thrust to coast, then pivot and burn.
- Weak drag slowly dissipates momentum; deliberate braking is much stronger.
- Acceleration scales with existing per-ship speed, preserving class top speeds.
- Scout steering is faster than heavy miner steering.
- The engine flare shows actual manual thrust instead of movement while drifting.
- Motion integrates in 50ms steps and still uses existing mothership hull
  collision, world bounds, camera, and docking transitions.

## Boundaries and verification
This affects **only manual flight**. Autonomous mining, navigation, berths,
airlock routes, storage, upgrading and save structure are unchanged.
Run `npm run test`, `npm run build`, and the existing Playwright
flight/docking/mobile flows on this branch before merging. New deterministic
unit tests cover facing, turn-and-coast, diagonal burns, braking, top speed,
frame-rate consistency and invalid elapsed time.
