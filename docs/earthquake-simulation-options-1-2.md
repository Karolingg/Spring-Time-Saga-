# Earthquake Simulation Improvements (Option 1 + Option 2)

## Goal
Make the earthquake scenario feel alive and distinct from fire by introducing evolving pressure during evacuation and a visible tremor phase. These changes target the autonomous earthquake flow and are meant to be low-effort, high-impact.

## Why this is needed
The earthquake scenario currently feels static because debris does not change after t=0. Fire stays interesting because smoke grows and forces mid-run reroutes. Earthquake needs evolving pressure as agents move, not only a delayed reaction time.

## Scope
- Scenario: earthquake only
- Pages: app/simulate/[id]/autonomous/page.tsx
- Engine behavior: src/simulation/engine.ts and hazard evaluation
- Floor data: src/simulation/floor-config/buildings/* (per-floor hazard configs)

---

## Option 1: Structural Collapse Over Time (Debris Growth)

### Summary
Give debris hazards a slow growth rate so the blocked graph changes mid-evacuation and forces rerouting.

### Implementation details
- Add a growth rate to earthquake debris hazards (example: growthRate: 0.3).
- Apply the growth rate during hazard updates so debris radius increases over time.
- This is a per-floor configuration change and should be tuned in each floor config where earthquake hazards are defined.

### Intended effect
- Routes that were valid early in the run become blocked later.
- Agents are forced to reroute as the debris expands.
- Earthquake now feels like a progressive event rather than a static layout.

### Acceptance criteria
- Debris hazards visibly expand during a run.
- At least one route becomes blocked after the run starts (not only at t=0).
- Rerouting events increase compared to the current behavior.

---

## Option 2: Tremor Phase With Movement Penalty

### Summary
Add an early "shaking" phase where all agents move slowly for the first ~10 seconds, then return to normal speed.

### Implementation details
- Add a global tremor window (example: first 10 seconds).
- During this phase, apply a speed multiplier to all agents (example: 0.3x).
- This is separate from reaction delay; it provides visible, shared slowdown after the run starts.

### Intended effect
- Earthquake feels physically distinct from fire.
- Stakeholders see movement hesitation and slower evacuation at the start.
- The scenario looks and feels like a quake, not just delayed fire logic.

### Acceptance criteria
- For the first ~10 seconds, agent movement is visibly slower than fire.
- After the tremor phase, speed returns to normal.
- The change is isolated to earthquake runs only.

---

## Recommendation
Implement Option 1 and Option 2 together.
- Option 1 alone fixes the static feeling with minimal effort.
- Option 2 adds clear, visible quake identity.
- Together, they make earthquake feel like a distinct scenario without adding complex new hazards.

---

## Out of scope (for now)
- Secondary fire or gas leak hazards
- New UI controls or difficulty settings
- Overhauling the hazard UI
