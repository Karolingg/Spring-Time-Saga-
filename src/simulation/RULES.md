Simulation Rule Set

1. World Rules
The floor is a navigation graph.

Each floor contains:

room nodes
corridor nodes
junction nodes
stairs nodes
exit nodes
Each node has:

id
type
capacity
position
optional room bounds for rendering
Each edge has:

from
to
distance
width
blockable
Hard rule:
Agents may only move:

from one node to a connected neighbor node
along existing edges only
If no edge exists, movement is illegal.
That means agents can never pass through walls.

2. Agent Spawn Rules
When the user selects a floor, the setup screen should ask for either:

total occupancy, or
per-room occupancy
Agents spawn only in room nodes.

Each agent gets:

start room
current node
speed
reaction delay
state
planned path
target exit
hazard exposure
reroute count
No drag-and-drop per agent.

3. Agent States
Each agent can be in one of these states:

waiting
moving
queued
rerouting
evacuated
trapped
optional injured
4. Start-of-Run Rules
At t=0:

hazards are initialized
occupancy counts are initialized
all agents are in waiting
After their reaction delay expires, each agent must:

inspect reachable exits
choose a route
begin moving along graph edges only
5. Route Choice Rules
For v1, each agent uses one of these policies:

fastest: shortest available path
safest: avoids hazard proximity first, then shortest path
balanced: combines distance, congestion, and hazard risk
Recommended default:

60% balanced
20% fastest
20% safest
Route selection must only consider:

connected nodes
unblocked edges
reachable exits
If no valid path exists, the agent becomes trapped.

6. Movement Rules
Agents do not move freely on the floor.
They move edge by edge.

Per tick:

agent checks next node in its path
if next edge is blocked, reroute
if next node is over capacity, queue
otherwise move along the edge
Movement amount per tick:

progress += effective_speed * dt / edge_distance

When progress reaches 1.0:

the agent arrives at the next node
occupancy transfers to that node
progress resets to 0
next edge begins
7. Capacity and Congestion Rules
Each node and edge contributes to congestion.

Suggested v1 rules:

node capacity comes directly from config
edge flow capacity is derived from width
Example:

narrow corridor = fewer agents can occupy/traverse efficiently
wide corridor = more flow
Effective speed is reduced by:

edge crowding
node crowding
nearby hazards
Simple formula:

effective_speed = base_speed x congestion_factor x hazard_factor

Where:

congestion_factor drops as occupancy rises
hazard_factor drops near fire/smoke/debris
Agents never clip through each other by ignoring capacity.

8. Queue Rules
If an agent wants to move into a full node or saturated edge:

it enters queued
it stays at the current node or edge end
it resumes only when capacity becomes available
This is important because queues are what create real bottlenecks.

9. Hazard Rules
Hazards can:

slow movement
increase exposure
block nodes
block edges
Examples:

fire/smoke near a corridor lowers speed
debris can hard-block a stair edge
spreading hazard can invalidate a previously valid route
If an agent’s next edge or target exit becomes unsafe/unreachable:

switch to rerouting
recalculate path from current node
If no legal reroute exists:

switch to trapped
10. Rerouting Rules
An agent reroutes when:

next edge becomes blocked
target exit becomes unreachable
hazard risk exceeds threshold
optional: congestion threshold becomes too high
Rerouting is always graph-constrained.
The agent may only choose a new path through connected legal nodes.

11. Exit Rules
An agent is evacuated only when it reaches an exit node.

Once evacuated:

it no longer affects congestion
its evacuation time is recorded
its chosen/actual exit is recorded
12. Failure Rules
An agent is trapped if:

no reachable exit exists
all legal paths are blocked
optional future rule: exposure exceeds survivable threshold