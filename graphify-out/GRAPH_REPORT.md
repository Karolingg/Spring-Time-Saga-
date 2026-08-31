# Graph Report - .  (2026-08-23)

## Corpus Check
- Large corpus: 172 files · ~571,014 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1048 nodes · 2075 edges · 67 communities (55 shown, 12 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 1% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.77)
- Token cost: 42,069 input · 0 output

## Community Hubs (Navigation)
- Scenario Test Harness
- Replay & Bottleneck Heatmaps
- Manual Drill Path Drawing
- Supabase Client & DB Types
- Autonomous Drill Runner
- Package Dependencies
- Project Docs & Dashboard Plan
- Simulation Data Service
- Campus Map View
- TypeScript Build Config
- Shared UI Primitives
- Auth Session & Rate Limiting
- Readiness Dashboard
- Run Comparison Page
- CSB/Library/Management Floorplans
- Analysis Summary & Trends
- Admin & AS Building Floorplans
- Settings & Profile Panels
- Risk Table & Run Visualization
- Icon Set & Metric Cards
- About & Analysis Hub Pages
- Domain Enums & Types
- Floor Graph Adapter & Audit
- Aggregate Zone Analysis
- Cross-Run Floor Heatmaps
- Navbar & Modal Shell
- Open Todos & Role Gaps
- Cultural/SocSci/Library Configs
- Zone Analysis Panel
- Earthquake Collapse Demo
- Printable Evacuation Report
- App Root Layout
- Exit Utilization Breakdown
- Onboarding State
- Admin Building Floor Loader
- Coding Conventions Guide
- Disaster Picker
- Toast Notifications
- Science Building Floors
- Dense Nav Graph Builder
- Floor Config Schema
- Building Nav Model
- Theme Context
- SOM Building 1 Floors
- Dashboard Drill Widgets
- Congestion Heatmap
- Campus Exterior Photos
- Liadlaw Hall Floors
- UP High School Floors
- Help & Onboarding Overlay
- AS East Wing Floors
- AS West Wing Floors
- ASX Building Floors
- Management Building Floors
- Academic Building Photos
- ESLint Config
- Next.js Config
- PostCSS Config
- SOM Building Photos
- SOM1 Floorplan Images
- Undergrad Floorplan Images
- UP High School Grounds Photos
- Next.js Boilerplate Icons
- Next.js & Vercel Logos
- CSS Module Typings
- Vitest Config
- Liadlaw Hall Entrance Photo

## God Nodes (most connected - your core abstractions)
1. `AutonomousScienceBuildingPage()` - 51 edges
2. `useAuth()` - 30 edges
3. `getNode()` - 29 edges
4. `getBuildingById()` - 24 edges
5. `createSimulation()` - 21 edges
6. `SimulationRunPage()` - 20 edges
7. `stepSimulation()` - 20 edges
8. `SpatialBottleneckHeatmap()` - 19 edges
9. `SimulationZone` - 18 edges
10. `edgeKey()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Folder Structure Template` --semantically_similar_to--> `EVACSIM Project Overview`  [INFERRED] [semantically similar]
  docs/coding-practices.md → AGENTS.md
- `API Calls In Services Only Rule` --semantically_similar_to--> `AGENTS.md Coding Conventions`  [INFERRED] [semantically similar]
  docs/coding-practices.md → AGENTS.md
- `Evacuated % Stat Card Fix` --semantically_similar_to--> `CSV Export Feature Spec`  [INFERRED] [semantically similar]
  DASHBOARD_IMPROVEMENTS.md → docs/feature-specs.md
- `AnalysisSummaryPage()` --calls--> `useAuth()`  [EXTRACTED]
  app/analysis/summary/page.tsx → src/hooks/useAuth.ts
- `AggregateZoneStat` --references--> `RiskLevel`  [EXTRACTED]
  components/analysis/AggregateAnalysis.tsx → src/schema/enums.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Building/Floor Authoring Workflow** — docs_adding_building_floors_guide, docs_adding_building_floors_floorconfig_schema, public_coord_helper_tool, src_simulation_rules_world_rules [INFERRED 0.85]
- **Earthquake Hazard Dynamics Design** — docs_earthquake_simulation_options_1_2_option1_debris_growth, docs_earthquake_simulation_options_1_2_option2_tremor_phase, src_simulation_rules_hazard_rules, src_simulation_rules_rerouting_rules [INFERRED 0.85]
- **Deployment Readiness Documentation Chain** — readme_database_setup, docs_deployment_readiness_guide, docs_vercel_deployment_guide, docs_supabase_setup_guide_steps [INFERRED 0.85]
- **AS Building Floor Set (East+West, 1-3)** — public_floorplans_as_east_wing_1st_floor_building, public_floorplans_as_east_wing_2nd_floor_building, public_floorplans_as_east_wing_3rd_floor_building, public_floorplans_as_west_wing_1st_floor_building, public_floorplans_as_west_wing_2nd_floor_building, public_floorplans_as_west_wing_3rd_floor_building, concept_building_as [INFERRED 0.85]
- **Campus-wide Floorplan Set for Evacuation Simulation** — public_floorplans_as_east_wing_1st_floor_building, public_floorplans_as_west_wing_1st_floor_building, public_floorplans_asx_1st_floor_building, public_floorplans_admin_1st_floor_building, concept_evacuation_route [INFERRED 0.75]
- **ASX Building Floor Set** — public_floorplans_asx_1st_floor_building, public_floorplans_asx_2nd_floor_building, concept_building_asx [INFERRED 0.85]
- **Admin Building Floor Set** — public_floorplans_admin_1st_floor_building, public_floorplans_admin_2nd_floor_building, concept_building_admin [INFERRED 0.85]
- **CSB Building Floor Set (2nd-6th)** — public_floorplans_csb_2nd_floor, public_floorplans_csb_3rd_floor, public_floorplans_csb_4th_floor, public_floorplans_csb_5th_floor, public_floorplans_csb_6th_floor, concept_building_csb [INFERRED 0.85]
- **Chunk 3 Campus Floorplan Set** — public_floorplans_csb_2nd_floor, public_floorplans_csb_3rd_floor, public_floorplans_csb_4th_floor, public_floorplans_csb_5th_floor, public_floorplans_csb_6th_floor, public_floorplans_library_1st_floor, public_floorplans_library_2nd_floor, public_floorplans_management_1st_floor, public_floorplans_management_2nd_floor, public_floorplans_socialsciences_1st_floor, public_floorplans_socialsciences_2nd_floor, concept_evacuation_simulation [INFERRED 0.75]
- **Library Building Floor Set (1st-2nd)** — public_floorplans_library_1st_floor, public_floorplans_library_2nd_floor, concept_building_library [INFERRED 0.85]
- **Management Building Floor Set (1st-2nd)** — public_floorplans_management_1st_floor, public_floorplans_management_2nd_floor, concept_building_management [INFERRED 0.85]
- **Social Sciences Building Floor Set (1st-2nd, placeholders)** — public_floorplans_socialsciences_1st_floor, public_floorplans_socialsciences_2nd_floor, concept_building_socialsciences [EXTRACTED 1.00]
- **Som1 Building Floor Plans (1st & 2nd Floor)** — public_floorplans_som1_1st_floor, public_floorplans_som1_2nd_floor [INFERRED 0.85]
- **UG Building Floor Plans (1st & 2nd Floor)** — public_floorplans_ug_1st_floor, public_floorplans_ug_2nd_floor [INFERRED 0.85]
- **UP Cebu Campus Buildings for Evacuation Simulation** — public_floorplans_admin_building, public_floorplans_admin_field, public_floorplans_as_east_wing, public_floorplans_as_west_wing, public_floorplans_asx, public_floorplans_liadlaw_hall, public_floorplans_som1_1st_floor, public_floorplans_ug_1st_floor [INFERRED 0.65]
- **AS Building Complex (East Wing, West Wing, Annex, Parking)** — public_floorplans_as_east_wing, public_floorplans_as_west_wing, public_floorplans_asx, public_floorplans_as_parking [INFERRED 0.75]
- **UP Cebu Campus Building Photos** — public_floorplans_management, public_floorplans_science_building, public_floorplans_social_sciences, public_floorplans_som_building_1, public_floorplans_up_cebu_library [INFERRED 0.75]
- **Next.js Default Boilerplate Icon Set** — public_globe_svg, public_next_svg, public_vercel_svg, public_window_svg [INFERRED 0.85]
- **Unresolved Building Floorplan Asset and Mapping Gaps** — docs_todos_science_building_floorplan_asset, docs_todos_social_sciences_floorplan_mapping, docs_todos_up_high_school_floorplan_mapping, docs_todos_to_floor_model, docs_todos_floorplan_mapping [INFERRED 0.85]
- **Role Model and App View Scoping Decisions** — docs_todos_admin_vs_user_app_view, docs_todos_administrator_role_label, docs_todos_role_permission_system, docs_todos_settings_page [INFERRED 0.85]

## Communities (67 total, 12 thin omitted)

### Community 0 - "Scenario Test Harness"
Cohesion: 0.06
Nodes (65): building, centralEdges(), { createSimulation, evaluateSimulation, stepSimulation }, edgeMidpointHazards(), exitEdge(), { getBuildingById, getNode }, { hazardGrowthRate, hazardMaxRadius }, makeHazard() (+57 more)

### Community 1 - "Replay & Bottleneck Heatmaps"
Cohesion: 0.06
Nodes (54): allocateAgentsToRooms(), getHeatColor(), HEATMAP_LEGEND, LayerToggleProps, PillProps, PLAYBACK_SPEEDS, RunReplay(), bandFor() (+46 more)

### Community 2 - "Manual Drill Path Drawing"
Cohesion: 0.06
Nodes (48): analyzeRoutes(), avoidForbiddenZones(), buildForbiddenRects(), buildFullPath(), buildNodeOnlyReroutePath(), buildNodeProgressPreviewPath(), buildObstaclesFromPlaced(), computePathBlockT() (+40 more)

### Community 3 - "Supabase Client & DB Types"
Cohesion: 0.05
Nodes (48): supabase, AuditLog, DensityCell, RunTag, CompositeTypes, Constants, Database, DatabaseWithoutInternals (+40 more)

### Community 4 - "Autonomous Drill Runner"
Cohesion: 0.07
Nodes (48): AutonomousScienceBuildingPage(), clamp(), clampHazardPosition(), createHazardDragImage(), describeExitUsage(), DISASTER_META, DisasterType, formatSeconds() (+40 more)

### Community 5 - "Package Dependencies"
Cohesion: 0.04
Nodes (48): d3, eslint, eslint-config-next, mapbox-gl, next, dependencies, d3, mapbox-gl (+40 more)

### Community 6 - "Project Docs & Dashboard Plan"
Cohesion: 0.06
Nodes (43): EVACSIM Project Overview, Known Incomplete Or Risky Areas, Simulation Persistence Flow, EVACSIM Tech Stack, Analysis Hub Live Stats Strip, Evacuated % Stat Card Fix, PageHeader Button Group Restructure, Summary Layer Accent Differentiation (+35 more)

### Community 7 - "Simulation Data Service"
Cohesion: 0.10
Nodes (36): logAction(), aggregateCache, buildingNameFromId(), clearAggregateCache(), clearAnalysisCaches(), clearSimulationReadCache(), createSimulationRun(), DashboardBuildingCoverage (+28 more)

### Community 8 - "Campus Map View"
Cohesion: 0.09
Nodes (28): boundsCenter(), BuildingBounds, CAMPUS_BUILDINGS, CAMPUS_CENTER, CampusBuilding, gradeAccent(), gradeInk(), MapPage() (+20 more)

### Community 9 - "TypeScript Build Config"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 10 - "Shared UI Primitives"
Cohesion: 0.11
Nodes (16): PageHeader(), PageHeaderProps, RunControlsProps, RunHistoryItem, SECTION_CARD, SummaryStatsProps, darkenHex(), FeatureContainer() (+8 more)

### Community 11 - "Auth Session & Rate Limiting"
Cohesion: 0.13
Nodes (15): SessionTimeoutModal(), SessionTimeoutModalProps, RATE_LIMIT_ACTIONS, AuthContext, AuthContextValue, AuthProvider(), clearTimeoutStorage(), isAuthRoute() (+7 more)

### Community 12 - "Readiness Dashboard"
Cohesion: 0.12
Nodes (15): AggregateStats, BuildingCoverage, buildStatCards(), computeReadiness(), DashboardPage(), DISASTER_ICON, getGreeting(), nameFromEmail() (+7 more)

### Community 13 - "Run Comparison Page"
Cohesion: 0.10
Nodes (14): buildComparisonWarnings(), buildZoneDeltas(), CompareRunsPage(), CompareWarning, ComparisonWarnings(), Direction, formatHistoryLabel(), METRICS (+6 more)

### Community 14 - "CSB/Library/Management Floorplans"
Cohesion: 0.18
Nodes (22): CSB Building, Library Building, Management Building, Social Sciences Building, Classroom (generic labeled room block, CSB/Library/Management floors), Corridor / Hallway (generic room block, CSB floors), Evacuation Simulation (Spring Time Saga), Exit / Egress Path (green highlighted corridor, Management floors) (+14 more)

### Community 15 - "Analysis Summary & Trends"
Cohesion: 0.13
Nodes (14): CompareHeatmaps(), describeRun(), AnalysisSummaryPage(), AggregateFloorHeatmaps(), BuildingTrends(), Direction, evacRate(), MetricDeltaProps (+6 more)

### Community 16 - "Admin & AS Building Floorplans"
Cohesion: 0.22
Nodes (20): Admin Building, AS Building (Academic/Science), ASX Building (AS Extension), East Wing, Evacuation Route / Exit Path, Multi-Story Building Model, Room / Zone (generic), Stairwell (+12 more)

### Community 17 - "Settings & Profile Panels"
Cohesion: 0.15
Nodes (17): AnalysisRunsPage(), btnPrimary(), divider, labelStyle, navIcons, ProfilePanel(), roleLabel(), Section (+9 more)

### Community 18 - "Risk Table & Run Visualization"
Cohesion: 0.15
Nodes (15): BuildingRiskTableProps, RISK_COLORS, RISK_TEXT_COLORS, TABLE_COLUMNS, RunReplayProps, RunVisualization(), RunVisualizationProps, TabButtonProps (+7 more)

### Community 19 - "Icon Set & Metric Cards"
Cohesion: 0.11
Nodes (4): METRIC_BOX, SECTION_CARD, SECTION_TITLE, SUBSECTION_TITLE

### Community 20 - "About & Analysis Hub Pages"
Cohesion: 0.18
Nodes (11): AboutPage(), divider, sectionDesc, sectionTitle, AnalysisPage(), FeatureButtonProps, HubStats, relativeTime() (+3 more)

### Community 21 - "Domain Enums & Types"
Cohesion: 0.18
Nodes (15): MetricDef, DISASTER_TYPES, DisasterType, RISK_LEVELS, RiskLevel, SEVERITY_LEVELS, SeverityLevel, SIMULATION_STATUSES (+7 more)

### Community 22 - "Floor Graph Adapter & Audit"
Cohesion: 0.19
Nodes (13): TARGETS, BUILDING_FLOORS, AdapterOptions, BUILDING_NAMES, capacityFromKind(), floorConfigToFloorModel(), FLOORPLAN_SRC_BY_BUILDING, nodeTypeFromKind() (+5 more)

### Community 23 - "Aggregate Zone Analysis"
Cohesion: 0.17
Nodes (12): actionSentence(), AggregateAnalysis(), AggregateAnalysisProps, AggregateZoneStat, BandDef, bandFor(), BandKey, BANDS (+4 more)

### Community 24 - "Cross-Run Floor Heatmaps"
Cohesion: 0.24
Nodes (9): AggregateFloorHeatmapsProps, BuildingGroup, FloorHeatmapView(), getHeatColor(), ResolvedFloorHeatmap, StatChipProps, AggregateFloorHeatmap, BuildingModel (+1 more)

### Community 25 - "Navbar & Modal Shell"
Cohesion: 0.26
Nodes (9): ConfirmModal(), ConfirmModalProps, NAV_SECTIONS, Navbar(), NavItem, renderNavContent(), useTheme(), FOCUSABLE_SELECTOR (+1 more)

### Community 26 - "Open Todos & Role Gaps"
Cohesion: 0.30
Nodes (12): Admin App View vs User App View Decision, Hardcoded Administrator Role Label, Earthquake Simulation, Building Floorplan Mapping, Open Items, Role and Permission System, Missing science-building 1st Floor Floorplan Asset, Settings Page (+4 more)

### Community 27 - "Cultural/SocSci/Library Configs"
Cohesion: 0.21
Nodes (8): CULTURAL_CENTER_1F, CULTURAL_CENTER_FLOORS, SOCIAL_SCIENCES_1F, SOCIAL_SCIENCES_2F, SOCIAL_SCIENCES_FLOORS, UP_CEBU_LIBRARY_1F, UP_CEBU_LIBRARY_2F, UP_CEBU_LIBRARY_FLOORS

### Community 28 - "Zone Analysis Panel"
Cohesion: 0.25
Nodes (8): actionSentence(), bandFor(), BANDS, friendlyType(), Props, RISK_COLORS, RISK_TEXT_COLORS, ZoneAnalysisPanel()

### Community 29 - "Earthquake Collapse Demo"
Cohesion: 0.20
Nodes (9): agentsPerRoom, floor, fragileEdges, getFloor(), rooms, SCENARIOS, QuakeScenario, buildBuildingModel() (+1 more)

### Community 30 - "Printable Evacuation Report"
Cohesion: 0.31
Nodes (6): describeDisaster(), describeNarrative(), EvacuationReportPage(), formatDateTime(), riskColor(), topZones()

### Community 31 - "App Root Layout"
Cohesion: 0.27
Nodes (6): inter, metadata, viewport, AppShell(), Providers(), useIsMobile()

### Community 32 - "Exit Utilization Breakdown"
Cohesion: 0.22
Nodes (8): EXIT_COLORS, ExitRow, ExitUtilizationBreakdown(), ExitUtilizationBreakdownProps, UtilResult, distributeAgentsByCapacity(), floor, hazards

### Community 33 - "Onboarding State"
Cohesion: 0.31
Nodes (7): cloneInitialSteps(), getInitialOnboardingState(), INITIAL_STEPS, OnboardingContext, OnboardingContextType, OnboardingProvider(), OnboardingStep

### Community 34 - "Admin Building Floor Loader"
Cohesion: 0.22
Nodes (6): ADMIN_1F, ADMIN_2F, ADMIN_BUILDING_FLOORS, BUILDING_FLOOR_LOADERS, FloorConfigLoader, FloorConfig

### Community 35 - "Coding Conventions Guide"
Cohesion: 0.25
Nodes (8): AGENTS.md Coding Conventions, Files/Folders To Avoid Changing, Card Class Example, Function Size/Single-Responsibility Rules, Clean Code Naming Conventions, Dumb Components Rule, Separation of Concerns Principle, API Calls In Services Only Rule

### Community 36 - "Disaster Picker"
Cohesion: 0.39
Nodes (6): AUTONOMOUS_BUILDING_IDS, Disaster, DisasterPickerPage(), DISASTERS, floorLabel(), getSimulationRoute()

### Community 37 - "Toast Notifications"
Cohesion: 0.25
Nodes (7): AUTO_DISMISS_MS, TOAST_ICONS, ToastContext, ToastContextValue, ToastItem, ToastProvider(), ToastType

### Community 38 - "Science Building Floors"
Cohesion: 0.25
Nodes (7): SCIENCE_1F, SCIENCE_2F, SCIENCE_3F, SCIENCE_4F, SCIENCE_5F, SCIENCE_6F, SCIENCE_BUILDING_FLOORS

### Community 39 - "Dense Nav Graph Builder"
Cohesion: 0.46
Nodes (7): defaultEdgeWidth(), defaultNodeCapacity(), doorPoint(), entryPointFor(), inferNodeKind(), normalizeCorridorNode(), withDenseGraph()

### Community 40 - "Floor Config Schema"
Cohesion: 0.25
Nodes (7): CorridorNeighborDef, CorridorNode, CorridorNodeKind, DisasterType, ExitDef, ObstacleDef, RoomDef

### Community 41 - "Building Nav Model"
Cohesion: 0.29
Nodes (6): HotNode, getExits(), HazardForecast, NavEdge, NavNode, WeightedPathOptions

### Community 42 - "Theme Context"
Cohesion: 0.38
Nodes (6): applyTheme(), readStoredTheme(), Theme, ThemeContext, ThemeContextValue, ThemeProvider()

### Community 43 - "SOM Building 1 Floors"
Cohesion: 0.29
Nodes (4): SOM_BUILDING_1_1F, SOM_BUILDING_1_2F, SOM_BUILDING_1_3F, SOM_BUILDING_1_FLOORS

### Community 44 - "Dashboard Drill Widgets"
Cohesion: 0.33
Nodes (6): compareDelta(), ComparisonPreview(), DrillTimeline(), evacRate(), RunCard(), timeAgo()

### Community 45 - "Congestion Heatmap"
Cohesion: 0.47
Nodes (5): CongestionHeatmap(), CongestionHeatmapProps, getIntensityColor(), INTENSITY_COLORS, LEGEND_ITEMS

### Community 46 - "Campus Exterior Photos"
Cohesion: 0.40
Nodes (6): Administration Building (UP Cebu) Entrance Photo, Admin Building Field / Open Grounds with Stage, AS Building East Wing Exterior, AS Building Parking / Road Area (UP Marker), AS Building West Wing Exterior, AS Building Courtyard/Annex Entrance (ASX)

### Community 47 - "Liadlaw Hall Floors"
Cohesion: 0.33
Nodes (3): LIADLAW_HALL_1F, LIADLAW_HALL_2F, LIADLAW_HALL_FLOORS

### Community 48 - "UP High School Floors"
Cohesion: 0.33
Nodes (3): UP_HIGH_SCHOOL_1F, UP_HIGH_SCHOOL_2F, UP_HIGH_SCHOOL_FLOORS

### Community 49 - "Help & Onboarding Overlay"
Cohesion: 0.50
Nodes (4): HelpPage(), OnboardingOverlay(), OnboardingOverlayProps, useOnboarding()

### Community 50 - "AS East Wing Floors"
Cohesion: 0.40
Nodes (4): AS_EAST_WING_1F, AS_EAST_WING_2F, AS_EAST_WING_3F, AS_EAST_WING_FLOORS

### Community 51 - "AS West Wing Floors"
Cohesion: 0.40
Nodes (4): AS_WEST_WING_1F, AS_WEST_WING_2F, AS_WEST_WING_3F, AS_WEST_WING_FLOORS

### Community 52 - "ASX Building Floors"
Cohesion: 0.50
Nodes (3): ASX_1F, ASX_2F, ASX_FLOORS

### Community 53 - "Management Building Floors"
Cohesion: 0.50
Nodes (3): MANAGEMENT_1F, MANAGEMENT_2F, MANAGEMENT_FLOORS

### Community 54 - "Academic Building Photos"
Cohesion: 0.67
Nodes (3): College of Science Building Atrium (UP Cebu), Undergraduate Building / The Joya Gallery (UP Cebu), UP Cebu Library / Academic Building Exterior

## Ambiguous Edges - Review These
- `Generic File Icon` → `Multi-Story Building Model`  [AMBIGUOUS]
  public/file.svg · relation: conceptually_related_to
- `AS East Wing - 2nd Floor Plan` → `Stairwell`  [AMBIGUOUS]
  public/floorplans/AS East Wing 2nd floor.svg · relation: conceptually_related_to
- `Stairwell` → `Admin Building - 1st Floor Plan`  [AMBIGUOUS]
  public/floorplans/Admin 1st floor.svg · relation: conceptually_related_to
- `Stairwell` → `AS West Wing - 3rd Floor Plan`  [AMBIGUOUS]
  public/floorplans/AS West Wing 3rd floor.svg · relation: conceptually_related_to
- `CSB 2nd Floor Plan` → `Social Sciences 1st Floor Plan (placeholder)`  [AMBIGUOUS]
  public/floorplans/SocialSciences 1st floor.svg · relation: semantically_similar_to
- `Evacuation Simulation (Spring Time Saga)` → `Social Sciences 1st Floor Plan (placeholder)`  [AMBIGUOUS]
  public/floorplans/SocialSciences 1st floor.svg · relation: conceptually_related_to
- `Evacuation Simulation (Spring Time Saga)` → `Social Sciences 2nd Floor Plan (placeholder)`  [AMBIGUOUS]
  public/floorplans/SocialSciences 2nd floor.svg · relation: conceptually_related_to
- `Administration Building (UP Cebu) Entrance Photo` → `AS Building Parking / Road Area (UP Marker)`  [AMBIGUOUS]
  public/floorplans/as-parking.png · relation: conceptually_related_to
- `AS Building East Wing Exterior` → `AS Building Parking / Road Area (UP Marker)`  [AMBIGUOUS]
  public/floorplans/as-parking.png · relation: conceptually_related_to
- `College of Science Building Atrium (UP Cebu)` → `UP Cebu Library / Academic Building Exterior`  [AMBIGUOUS]
  public/floorplans/up-cebu-library.png · relation: conceptually_related_to
- `UP High School Open Grounds/Quadrangle` → `Volleyball/Tennis Court Area`  [AMBIGUOUS]
  public/floorplans/up-high-open.png · relation: conceptually_related_to
- `Earthquake Simulation` → `Building Floorplan Mapping`  [AMBIGUOUS]
  docs/todos.md · relation: conceptually_related_to
- `to-floor-model.ts` → `Missing up-high-school Floorplan Mapping`  [AMBIGUOUS]
  docs/todos.md · relation: shares_data_with

## Knowledge Gaps
- **313 isolated node(s):** `sectionTitle`, `sectionDesc`, `divider`, `SECTION_CARD`, `Direction` (+308 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Generic File Icon` and `Multi-Story Building Model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `AS East Wing - 2nd Floor Plan` and `Stairwell`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Stairwell` and `Admin Building - 1st Floor Plan`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Stairwell` and `AS West Wing - 3rd Floor Plan`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `CSB 2nd Floor Plan` and `Social Sciences 1st Floor Plan (placeholder)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Evacuation Simulation (Spring Time Saga)` and `Social Sciences 1st Floor Plan (placeholder)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Evacuation Simulation (Spring Time Saga)` and `Social Sciences 2nd Floor Plan (placeholder)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._