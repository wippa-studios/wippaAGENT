# Real-time game systems

**What to do**

- Fix a frame budget and treat it as a contract. A 60 frame per second target on a 60 hertz display leaves roughly 16.6 milliseconds for everything: render, physics, animation, audio and gameplay logic. Spend it deliberately.

**The working stack**

- Engines: Unity with C#, Unreal with C++, Godot, and a custom engine only when the product is the engine. Unity ML-Agents and the Isaac simulator are the usual reinforcement learning targets in this space.
- Architecture: an entity component system where entity counts are high, with contiguous data and systems that scale to a thread; state machines and behaviour trees for gameplay logic; navigation meshes with pathfinding for the agents.
- Netcode: server authority with client prediction and server reconciliation, lag compensation for the shot that was on screen when it was fired, rollback for the cases where the correction is cheaper than the wait, interest management and delta compression to keep the bandwidth down, and matchmaking that balances latency and skill.
- Use an entity component system where the entity count is high and the behaviour set is varied. It keeps data contiguous and makes systems cheap to parallelise.
- Batch render work. Reduce draw calls by merging geometry and instancing, keep level of detail aggressive, and use occlusion culling for interior spaces.
- Profile on the target device with a real capture. The desktop editor profile is not the shipping profile.
- Build netcode on an explicit authority model. Decide what the server owns, what the client predicts, and what gets rolled back when the prediction was wrong.
- Scale multiplayer servers horizontally and make matchmaking aware of latency and skill.

**What to watch for**

- Physics broad phase cost. Use collision layers, sleeping bodies, fixed timesteps and simple colliders where possible.
- Thermal throttling and battery draw on mobile. Performance tiers and dynamic resolution exist for this reason.
- Asset download size, which dominates install conversion.
- Console certification requirements, which are non-negotiable and discovered late otherwise.
- Loot box and virtual currency regulations, which are jurisdiction-specific.

**How to verify**

- Frame time captured on the lowest supported hardware, with the slowest scenes identified.
- Network simulation under artificial latency, packet loss and jitter, with desync measured.
- Load time measured on a cold install.
- A soak of a full match to surface leaks and drift.

