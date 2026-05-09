# Stakeholder Scenarios for Autonomous Hazard Placement

This note is for demoing the autonomous simulation with drag-and-drop hazards. In the autonomous page, placed hazards are converted into runtime hazard zones and passed to the engine as the active hazard plan for that run. If stakeholders do not place hazards, the run behaves as a clean evacuation baseline.

## What Stakeholders Can Change

- Select the disaster type: fire or earthquake.
- Select a floor/building that has an autonomous floor model.
- Set total occupancy and optionally pin specific room populations.
- Drag multiple hazards onto the floor plan before launching the run.
- Re-run the same floor with different hazard layouts to compare evacuation time, reroutes, exposure, trapped count, exit usage, and congestion heatmaps.

## Hazard Behavior

Fire drills support:

- Fire: hard-blocks graph edges touched by the fire radius. Agents must reroute; if no legal exit route remains, they become trapped.
- Smoke: soft-blocks graph edges. Agents prefer clean detours, move slower near/through smoke, and accumulate exposure. Smoke alone should not create a trapped/fail outcome.

Earthquake drills support:

- Debris: hard-blocks graph edges touched by the debris radius. This is the main earthquake failure hazard.
- Dust: displayed using the smoke hazard type. It slows movement and increases exposure, but remains traversable.

## Fire Scenario Recipes

### 1. Single Exit Compromise

Stakeholder action:

- Place one Fire hazard on the approach to a main exit.
- Place one Smoke hazard in the adjacent corridor.
- Use Medium or High occupancy.

Expected simulation result:

- Agents reroute away from the compromised exit.
- Exit usage should shift toward remaining exits.
- The run should usually complete unless the fire also blocks the only legal route for some rooms.

Stakeholder discussion:

- Which exits absorb displaced occupants?
- Does signage or staff direction need to steer occupants away from the blocked exit earlier?

### 2. Smoke-Filled Corridor Stress Test

Stakeholder action:

- Place two or three Smoke hazards along a central corridor.
- Keep exits physically reachable.
- Use High or Full occupancy.

Expected simulation result:

- Evacuation time and exposure rise.
- Congestion increases near detours and narrow connectors.
- Agents should not fail only because of smoke, since smoke is modeled as soft-blocking.

Stakeholder discussion:

- Which corridor becomes the slowest segment?
- Where should ventilation, alarm zoning, or staff guidance be prioritized?

### 3. Fire Near a Room Cluster

Stakeholder action:

- Place Fire between a room cluster and its nearest exit path.
- Place Smoke on the alternate path.
- Pin a higher population in the affected rooms.

Expected simulation result:

- Affected rooms reroute around the fire.
- Alternate corridors may become bottlenecks.
- Some agents may become trapped only if the fire blocks every legal graph path from their current room cluster to an exit.

Stakeholder discussion:

- Are secondary routes visible and usable from that room cluster?
- Which room populations are most sensitive to a localized hazard?

### 4. Fire Fail Scenario

Stakeholder action:

- Place Fire hazards on all exit approach connectors, or on the few chokepoint corridors that separate occupied rooms from every exit.
- Avoid relying on Smoke for the fail condition.
- Use Medium or High occupancy so the trapped count is easy to see.

Expected simulation result:

- The valid fail signal is a nonzero Trapped count and evaluator feedback that evacuees could not reach an exit.
- Reroutes may appear first, then agents become trapped once no hard-block-free path remains.

Stakeholder discussion:

- Which hard-blocked corridor or exit connector made the floor non-evacuable?
- What physical mitigation would restore at least one independent egress route?

## Earthquake Scenario Recipes

### 1. Blocked Stairwell

Stakeholder action:

- Place Debris on one stairwell or exit approach.
- Place Dust in the central corridor.
- Use Medium occupancy.

Expected simulation result:

- Agents avoid the blocked stairwell and redistribute to other exits.
- Dust increases exposure and slows movement but should not trap agents by itself.

Stakeholder discussion:

- Which stair becomes overloaded?
- Does the building need a clearer fallback stair plan?

### 2. Central Corridor Collapse

Stakeholder action:

- Place Debris across the central corridor or landing that connects both sides of the floor.
- Keep at least one exit reachable on each side if testing partial isolation.
- Use High occupancy.

Expected simulation result:

- Occupants on each side must use exits reachable from their side.
- If a side has no reachable exit after the debris placement, only that side should produce trapped agents.

Stakeholder discussion:

- Are both halves of the floor independently evacuable?
- Which rooms depend on a single corridor connector?

### 3. Aftershock-Like Secondary Blockage

Stakeholder action:

- Place one Debris hazard near the initially preferred stair.
- Place another Debris hazard near an alternate route before launching the run to approximate a compound blockage.
- Add Dust along the detour.

Expected simulation result:

- Reroutes increase sharply.
- Evacuation time rises.
- Trapping is valid only if debris removes all hard-block-free routes to exits.

Stakeholder discussion:

- Does the evacuation plan still work if a first-choice stair and backup path are both compromised?
- Where would staff need to redirect occupants?

### 4. Earthquake Fail Scenario

Stakeholder action:

- Place Debris on every exit/stair connector, or place debris on central graph chokepoints that isolate rooms from all exits.
- Do not count Dust as a failure hazard.
- Use Medium or High occupancy.

Expected simulation result:

- The valid fail signal is one or more trapped agents.
- The run ends when every agent is either evacuated or trapped.

Stakeholder discussion:

- Which rooms lose all legal egress?
- Which added exit, stair access, or corridor reinforcement would prevent the fail condition?

## Is the Fail Scenario Valid?

Yes, with a specific constraint: the fail scenario is valid only when hard-blocking hazards remove all legal graph routes from at least one occupied room/current agent position to every exit.

Valid fail examples:

- Fire drill: Fire hazards block all exit connectors or the only corridor bridge from occupied rooms to exits.
- Earthquake drill: Debris hazards block all stair/exit connectors or isolate a room cluster from every exit.
- Partial fail: One side of a floor is isolated by fire/debris while another side still evacuates.

Invalid fail examples:

- Smoke or Dust alone causes slow movement/exposure but is still traversable, so it should not be treated as a trapped/fail scenario.
- A hazard visually overlaps a floor area but does not cover the midpoint of any blockable navigation edge; the engine may not treat that as a blocked route.
- One exit is blocked but another hard-block-free path remains; the expected outcome is rerouting, not failure.

For stakeholder demos, describe "fail" as an egress-unreachable stress test, not as a prediction of injury or casualty. The current engine marks agents as trapped when no reachable exit exists or all legal paths are hard-blocked; it does not currently fail agents based on survivability/exposure thresholds.
