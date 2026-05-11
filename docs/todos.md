# Todo Fixes for Complete Functionality of Project

Bugs, Issues, or Functionalities that need to be implemented or fixed for the completion of the app to avoid shipping incomplete or buggy product to stakeholders.

# Agent Behavior Logic (Fire)

Agents are trapped once they enter the radius of the fire. However, there are certain scenarios in the simulation that they enter an exit with a fire or when inside the radius, the logic would be to go back one node

Solution:
- Create detector/predictor logic that given the n distance between the fire radius and the agent, increase movement speed to avoid being in the radius
- Fix logic when trapped inside fire to step back one node
- Provide grace period for when in fire, maybe 2-3 seconds that they can be in fire and increase movement speed 

# Aggregated Heatmap Run Results (To Do)
- Make a summarized heatmap of each floor of all buildings 

