# Graph Report - .  (2026-07-30)

## Corpus Check
- Large corpus: 170 files · ~570,080 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1034 nodes · 2042 edges · 77 communities (60 shown, 17 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 1% AMBIGUOUS · INFERRED: 113 edges (avg confidence: 0.77)
- Token cost: 755,137 input · 0 output

## Community Hubs (Navigation)
- Simulation Run Page & Pathfinding
- Aggregate Heatmaps & Spatial Grid
- Autonomous Sim Page & Analytics
- Dashboard Home & Onboarding
- Project Docs & Design Rationale
- Simulation Engine Core
- Simulation Service (DB Layer)
- TypeScript Config
- Compare Runs Page
- Autonomous Test Scripts & Hazard Physics
- Auth & Session Timeout
- CSB/Library/Management Floorplan Concepts
- Campus Map Page & Assembly Points
- AS/Admin/ASX Floorplan Concepts
- Hybrid Grid Test Scripts
- Package Dev Dependencies
- Building Analytics Scoring
- Simulation Schema Enums & Types
- Help Page Icons
- Exit Utilization & Building Model
- About/Analysis Hub Pages
- Building Risk Table & Run Visualization
- Package Runtime Dependencies (Map/Viz Libs)
- Analysis Runs Page
- Settings Page & User Service
- Building Trends Analysis
- Evacuation Report Page
- Auth Callback & Read Cache
- Floor Config to Building Model Adapter
- Aggregate Analysis Component
- Floor Graph Audit Scripts
- Hazard Placement Logic
- ASX Floor Config & Dense Graph
- Navbar & Confirm Modal
- Supabase Database Types
- App Layout & Providers
- Zone Analysis Panel
- MapView Component
- CSV Export Service
- Package Metadata & Scripts
- Audit Log Schema & Service
- Building Floor Config Loaders
- Coding Guidelines Docs
- Disaster Picker Page
- Earthquake Collapse Demo Script
- Toast Notification Context
- Cached Read Helpers
- Science Building Floor Config
- Floor Config Types
- Theme Context
- SOM Building 1 Floor Config
- Congestion Heatmap Component
- Building Photo Images
- Liadlaw Hall Floor Config
- UP High School Floor Config
- AS East Wing Floor Config
- AS West Wing Floor Config
- Admin Building Floor Config
- Social Sciences Floor Config
- Building Photo Images (Misc)
- ESLint Config
- Leaflet Dependency
- Mapbox GL Dependency
- Next.js Config
- React DOM Dependency
- Supabase JS Client
- React Type Defs
- PostCSS Config
- Building Photo Images (Misc 2)
- SOM1 Floorplan Images
- UG Floorplan Images
- Campus Field Photos
- Next.js Boilerplate Icons A
- Next.js Boilerplate Icons B
- Styles Type Declarations
- Vitest Config
- Liadlaw Hall Photo

## God Nodes (most connected - your core abstractions)
1. `AutonomousScienceBuildingPage()` - 47 edges
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
- `BuildingRiskTable()` --indirect_call--> `riskColor()`  [INFERRED]
  components/analysis/BuildingRiskTable.tsx → app/analysis/reports/[runId]/page.tsx
- `API Calls In Services Only Rule` --semantically_similar_to--> `AGENTS.md Coding Conventions`  [INFERRED] [semantically similar]
  docs/coding-practices.md → AGENTS.md
- `Evacuated % Stat Card Fix` --semantically_similar_to--> `CSV Export Feature Spec`  [INFERRED] [semantically similar]
  DASHBOARD_IMPROVEMENTS.md → docs/feature-specs.md
- `AggregateAnalysis()` --indirect_call--> `riskColor()`  [INFERRED]
  components/analysis/AggregateAnalysis.tsx → app/analysis/reports/[runId]/page.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Deployment Readiness Documentation Chain** — readme_database_setup, docs_deployment_readiness_guide, docs_vercel_deployment_guide, docs_supabase_setup_guide_steps [INFERRED 0.85]
- **Building/Floor Authoring Workflow** — docs_adding_building_floors_guide, docs_adding_building_floors_floorconfig_schema, public_coord_helper_tool, src_simulation_rules_world_rules [INFERRED 0.85]
- **Earthquake Hazard Dynamics Design** — docs_earthquake_simulation_options_1_2_option1_debris_growth, docs_earthquake_simulation_options_1_2_option2_tremor_phase, src_simulation_rules_hazard_rules, src_simulation_rules_rerouting_rules [INFERRED 0.85]
- **AS Building Floor Set (East+West, 1-3)** — public_floorplans_as_east_wing_1st_floor_building, public_floorplans_as_east_wing_2nd_floor_building, public_floorplans_as_east_wing_3rd_floor_building, public_floorplans_as_west_wing_1st_floor_building, public_floorplans_as_west_wing_2nd_floor_building, public_floorplans_as_west_wing_3rd_floor_building, concept_building_as [INFERRED 0.85]
- **ASX Building Floor Set** — public_floorplans_asx_1st_floor_building, public_floorplans_asx_2nd_floor_building, concept_building_asx [INFERRED 0.85]
- **Admin Building Floor Set** — public_floorplans_admin_1st_floor_building, public_floorplans_admin_2nd_floor_building, concept_building_admin [INFERRED 0.85]
- **Campus-wide Floorplan Set for Evacuation Simulation** — public_floorplans_as_east_wing_1st_floor_building, public_floorplans_as_west_wing_1st_floor_building, public_floorplans_asx_1st_floor_building, public_floorplans_admin_1st_floor_building, concept_evacuation_route [INFERRED 0.75]
- **CSB Building Floor Set (2nd-6th)** — public_floorplans_csb_2nd_floor, public_floorplans_csb_3rd_floor, public_floorplans_csb_4th_floor, public_floorplans_csb_5th_floor, public_floorplans_csb_6th_floor, concept_building_csb [INFERRED 0.85]
- **Library Building Floor Set (1st-2nd)** — public_floorplans_library_1st_floor, public_floorplans_library_2nd_floor, concept_building_library [INFERRED 0.85]
- **Management Building Floor Set (1st-2nd)** — public_floorplans_management_1st_floor, public_floorplans_management_2nd_floor, concept_building_management [INFERRED 0.85]
- **Social Sciences Building Floor Set (1st-2nd, placeholders)** — public_floorplans_socialsciences_1st_floor, public_floorplans_socialsciences_2nd_floor, concept_building_socialsciences [EXTRACTED 1.00]
- **Chunk 3 Campus Floorplan Set** — public_floorplans_csb_2nd_floor, public_floorplans_csb_3rd_floor, public_floorplans_csb_4th_floor, public_floorplans_csb_5th_floor, public_floorplans_csb_6th_floor, public_floorplans_library_1st_floor, public_floorplans_library_2nd_floor, public_floorplans_management_1st_floor, public_floorplans_management_2nd_floor, public_floorplans_socialsciences_1st_floor, public_floorplans_socialsciences_2nd_floor, concept_evacuation_simulation [INFERRED 0.75]
- **Som1 Building Floor Plans (1st & 2nd Floor)** — public_floorplans_som1_1st_floor, public_floorplans_som1_2nd_floor [INFERRED 0.85]
- **UG Building Floor Plans (1st & 2nd Floor)** — public_floorplans_ug_1st_floor, public_floorplans_ug_2nd_floor [INFERRED 0.85]
- **AS Building Complex (East Wing, West Wing, Annex, Parking)** — public_floorplans_as_east_wing, public_floorplans_as_west_wing, public_floorplans_asx, public_floorplans_as_parking [INFERRED 0.75]
- **UP Cebu Campus Buildings for Evacuation Simulation** — public_floorplans_admin_building, public_floorplans_admin_field, public_floorplans_as_east_wing, public_floorplans_as_west_wing, public_floorplans_asx, public_floorplans_liadlaw_hall, public_floorplans_som1_1st_floor, public_floorplans_ug_1st_floor [INFERRED 0.65]
- **UP Cebu Campus Building Photos** — public_floorplans_management, public_floorplans_science_building, public_floorplans_social_sciences, public_floorplans_som_building_1, public_floorplans_up_cebu_library [INFERRED 0.75]
- **Next.js Default Boilerplate Icon Set** — public_globe_svg, public_next_svg, public_vercel_svg, public_window_svg [INFERRED 0.85]

## Communities (77 total, 17 thin omitted)

### Community 0 - "Simulation Run Page & Pathfinding"
Cohesion: 0.06
Nodes (46): analyzeRoutes(), avoidForbiddenZones(), buildForbiddenRects(), buildFullPath(), buildNodeOnlyReroutePath(), buildNodeProgressPreviewPath(), buildObstaclesFromPlaced(), computePathBlockT() (+38 more)

### Community 1 - "Aggregate Heatmaps & Spatial Grid"
Cohesion: 0.06
Nodes (43): AggregateFloorHeatmapsProps, BuildingGroup, FloorHeatmapView(), getHeatColor(), ResolvedFloorHeatmap, StatChipProps, allocateAgentsToRooms(), getHeatColor() (+35 more)

### Community 2 - "Autonomous Sim Page & Analytics"
Cohesion: 0.08
Nodes (47): AutonomousScienceBuildingPage(), clamp(), clampHazardPosition(), createHazardDragImage(), describeExitUsage(), DISASTER_META, DisasterType, formatSeconds() (+39 more)

### Community 3 - "Dashboard Home & Onboarding"
Cohesion: 0.07
Nodes (34): HelpPage(), AggregateStats, BuildingCoverage, buildStatCards(), compareDelta(), ComparisonPreview(), computeReadiness(), DashboardPage() (+26 more)

### Community 4 - "Project Docs & Design Rationale"
Cohesion: 0.06
Nodes (44): EVACSIM Project Overview, Known Incomplete Or Risky Areas, Simulation Persistence Flow, EVACSIM Tech Stack, Analysis Hub Live Stats Strip, Evacuated % Stat Card Fix, PageHeader Button Group Restructure, Summary Layer Accent Differentiation (+36 more)

### Community 5 - "Simulation Engine Core"
Cohesion: 0.11
Nodes (39): centralOrExitEdge(), exitEdge(), getEdgeIntensity(), edgeKey(), getNode(), AGENT_TYPE_CONFIG, AGENT_TYPE_DISTRIBUTION, agentHasEscapeRoute() (+31 more)

### Community 6 - "Simulation Service (DB Layer)"
Cohesion: 0.10
Nodes (29): logAction(), clearBuildingScoreCache(), aggregateCache, buildingNameFromId(), clearAggregateCache(), clearAnalysisCaches(), DashboardBuildingCoverage, deleteSimulationRun() (+21 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 8 - "Compare Runs Page"
Cohesion: 0.10
Nodes (16): buildComparisonWarnings(), buildZoneDeltas(), CompareHeatmaps(), CompareRunsPage(), CompareWarning, ComparisonWarnings(), describeRun(), Direction (+8 more)

### Community 9 - "Autonomous Test Scripts & Hazard Physics"
Cohesion: 0.12
Nodes (22): building, centralEdges(), { createSimulation, evaluateSimulation, stepSimulation }, edgeMidpointHazards(), exitEdge(), { getBuildingById, getNode }, { hazardGrowthRate, hazardMaxRadius }, makeHazard() (+14 more)

### Community 10 - "Auth & Session Timeout"
Cohesion: 0.13
Nodes (15): SessionTimeoutModal(), SessionTimeoutModalProps, RATE_LIMIT_ACTIONS, AuthContext, AuthContextValue, AuthProvider(), clearTimeoutStorage(), isAuthRoute() (+7 more)

### Community 11 - "CSB/Library/Management Floorplan Concepts"
Cohesion: 0.18
Nodes (22): CSB Building, Library Building, Management Building, Social Sciences Building, Classroom (generic labeled room block, CSB/Library/Management floors), Corridor / Hallway (generic room block, CSB floors), Evacuation Simulation (Spring Time Saga), Exit / Egress Path (green highlighted corridor, Management floors) (+14 more)

### Community 12 - "Campus Map Page & Assembly Points"
Cohesion: 0.16
Nodes (16): boundsCenter(), BuildingBounds, CAMPUS_BUILDINGS, CAMPUS_CENTER, CampusBuilding, gradeAccent(), MapPage(), RISK_COLORS (+8 more)

### Community 13 - "AS/Admin/ASX Floorplan Concepts"
Cohesion: 0.22
Nodes (20): Admin Building, AS Building (Academic/Science), ASX Building (AS Extension), East Wing, Evacuation Route / Exit Path, Multi-Story Building Model, Room / Zone (generic), Stairwell (+12 more)

### Community 14 - "Hybrid Grid Test Scripts"
Cohesion: 0.13
Nodes (19): assert, building, { createSimulation, evaluateSimulation, stepSimulation }, firstCell, fs, { getAgentRenderPosition }, { getBuildingById, getNode }, {
  GRID_COLS,
  GRID_ROWS,
  createSpatialGridTrace,
  densityCellsFromTrace,
  pointToGridCell,
  updateSpatialGridTrace,
} (+11 more)

### Community 15 - "Package Dev Dependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, supabase, tailwindcss, @tailwindcss/postcss (+11 more)

### Community 16 - "Building Analytics Scoring"
Cohesion: 0.15
Nodes (18): applyCoverageCap(), BnRow, BuildingScore, buildingScoreCache, clamp(), clamp01(), ConfigRow, fetchRunRows() (+10 more)

### Community 17 - "Simulation Schema Enums & Types"
Cohesion: 0.17
Nodes (16): MetricDef, AggregateZoneStat, DISASTER_TYPES, DisasterType, RISK_LEVELS, RiskLevel, SEVERITY_LEVELS, SeverityLevel (+8 more)

### Community 18 - "Help Page Icons"
Cohesion: 0.11
Nodes (4): METRIC_BOX, SECTION_CARD, SECTION_TITLE, SUBSECTION_TITLE

### Community 19 - "Exit Utilization & Building Model"
Cohesion: 0.14
Nodes (15): EXIT_COLORS, ExitRow, ExitUtilizationBreakdown(), ExitUtilizationBreakdownProps, UtilResult, distributeAgentsByCapacity(), findShortestPathToExitWeighted(), getExits() (+7 more)

### Community 20 - "About/Analysis Hub Pages"
Cohesion: 0.18
Nodes (11): AboutPage(), divider, sectionDesc, sectionTitle, AnalysisPage(), FeatureButtonProps, HubStats, relativeTime() (+3 more)

### Community 21 - "Building Risk Table & Run Visualization"
Cohesion: 0.17
Nodes (14): BuildingRiskTable(), BuildingRiskTableProps, RISK_COLORS, TABLE_COLUMNS, RunReplayProps, RunVisualizationProps, TabButtonProps, ViewMode (+6 more)

### Community 22 - "Package Runtime Dependencies (Map/Viz Libs)"
Cohesion: 0.12
Nodes (17): d3, next, dependencies, d3, next, pixi.js, react, react-leaflet (+9 more)

### Community 23 - "Analysis Runs Page"
Cohesion: 0.15
Nodes (8): PageHeaderProps, RunControlsProps, RunHistoryItem, SECTION_CARD, SummaryStatsProps, darkenHex(), FeatureContainer(), FeatureContainerProps

### Community 24 - "Settings Page & User Service"
Cohesion: 0.18
Nodes (14): AnalysisRunsPage(), btnPrimary(), divider, labelStyle, navIcons, ProfilePanel(), Section, sectionDesc (+6 more)

### Community 25 - "Building Trends Analysis"
Cohesion: 0.16
Nodes (9): AnalysisSummaryPage(), BuildingTrends(), Direction, evacRate(), MetricDeltaProps, ResolvedTrend, TrendCard(), BuildingFloorTrend (+1 more)

### Community 26 - "Evacuation Report Page"
Cohesion: 0.21
Nodes (10): describeDisaster(), describeNarrative(), EvacuationReportPage(), formatDateTime(), riskColor(), topZones(), AggregateFloorHeatmaps(), RunVisualization() (+2 more)

### Community 27 - "Auth Callback & Read Cache"
Cohesion: 0.23
Nodes (7): supabase, CacheEntry, ReadThroughCache, clearProfileCache(), profileCache, updateUserEmail(), updateUserProfile()

### Community 28 - "Floor Config to Building Model Adapter"
Cohesion: 0.23
Nodes (13): getFloor(), AdapterOptions, buildBuildingModel(), BUILDING_NAMES, capacityFromKind(), floorConfigToFloorModel(), FLOORPLAN_SRC_BY_BUILDING, nodeTypeFromKind() (+5 more)

### Community 29 - "Aggregate Analysis Component"
Cohesion: 0.21
Nodes (10): actionSentence(), AggregateAnalysis(), AggregateAnalysisProps, BandDef, bandFor(), BandKey, BANDS, friendlyType() (+2 more)

### Community 30 - "Floor Graph Audit Scripts"
Cohesion: 0.21
Nodes (7): TARGETS, CULTURAL_CENTER_1F, CULTURAL_CENTER_FLOORS, BUILDING_FLOORS, MANAGEMENT_1F, MANAGEMENT_2F, MANAGEMENT_FLOORS

### Community 31 - "Hazard Placement Logic"
Cohesion: 0.15
Nodes (11): HazardZone, ActiveHazard, SimConfig, computeFireSeverity(), DEFAULT_RADII, getHazardStorageKey(), HazardDisaster, HazardPlan (+3 more)

### Community 32 - "ASX Floor Config & Dense Graph"
Cohesion: 0.24
Nodes (11): ASX_1F, ASX_2F, ASX_FLOORS, defaultEdgeWidth(), defaultNodeCapacity(), doorPoint(), entryPointFor(), inferNodeKind() (+3 more)

### Community 33 - "Navbar & Confirm Modal"
Cohesion: 0.26
Nodes (9): ConfirmModal(), ConfirmModalProps, NAV_SECTIONS, Navbar(), NavItem, renderNavContent(), useTheme(), FOCUSABLE_SELECTOR (+1 more)

### Community 34 - "Supabase Database Types"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 35 - "App Layout & Providers"
Cohesion: 0.27
Nodes (6): inter, metadata, viewport, AppShell(), Providers(), useIsMobile()

### Community 36 - "Zone Analysis Panel"
Cohesion: 0.29
Nodes (7): actionSentence(), bandFor(), BANDS, friendlyType(), Props, RISK_COLORS, ZoneAnalysisPanel()

### Community 37 - "MapView Component"
Cohesion: 0.24
Nodes (9): AssemblyMarker, FALLBACK_CENTER, MAP_STYLES, MapMarker, MapRegion, MapStyleOption, MapView(), MapViewProps (+1 more)

### Community 38 - "CSV Export Service"
Cohesion: 0.33
Nodes (8): PageHeader(), buildRunCsv(), buildRunCsvFilename(), csvCell(), csvRow(), downloadRunCsv(), RUN_HEADERS, ZONE_HEADERS

### Community 39 - "Package Metadata & Scripts"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 40 - "Audit Log Schema & Service"
Cohesion: 0.31
Nodes (7): AuditLog, DensityCell, RunTag, getAuditLog(), getUserAuditLog(), Row, toAuditLog()

### Community 41 - "Building Floor Config Loaders"
Cohesion: 0.22
Nodes (6): BUILDING_FLOOR_LOADERS, FloorConfigLoader, UP_CEBU_LIBRARY_1F, UP_CEBU_LIBRARY_2F, UP_CEBU_LIBRARY_FLOORS, FloorConfig

### Community 42 - "Coding Guidelines Docs"
Cohesion: 0.25
Nodes (8): AGENTS.md Coding Conventions, Files/Folders To Avoid Changing, Card Class Example, Function Size/Single-Responsibility Rules, Clean Code Naming Conventions, Dumb Components Rule, Separation of Concerns Principle, API Calls In Services Only Rule

### Community 43 - "Disaster Picker Page"
Cohesion: 0.39
Nodes (6): AUTONOMOUS_BUILDING_IDS, Disaster, DisasterPickerPage(), DISASTERS, floorLabel(), getSimulationRoute()

### Community 44 - "Earthquake Collapse Demo Script"
Cohesion: 0.25
Nodes (6): agentsPerRoom, floor, fragileEdges, rooms, SCENARIOS, QuakeScenario

### Community 45 - "Toast Notification Context"
Cohesion: 0.25
Nodes (7): AUTO_DISMISS_MS, TOAST_ICONS, ToastContext, ToastContextValue, ToastItem, ToastProvider(), ToastType

### Community 46 - "Cached Read Helpers"
Cohesion: 0.39
Nodes (7): getBuildingScore(), getCurrentUserCacheKey(), fetchFullRun(), getLatestSimulationRun(), getRunsByTag(), getSimulationRun(), getUserProfile()

### Community 47 - "Science Building Floor Config"
Cohesion: 0.25
Nodes (7): SCIENCE_1F, SCIENCE_2F, SCIENCE_3F, SCIENCE_4F, SCIENCE_5F, SCIENCE_6F, SCIENCE_BUILDING_FLOORS

### Community 48 - "Floor Config Types"
Cohesion: 0.25
Nodes (7): CorridorNeighborDef, CorridorNodeKind, DisasterType, ExitDef, ObstacleDef, Point, RoomDef

### Community 49 - "Theme Context"
Cohesion: 0.38
Nodes (6): applyTheme(), readStoredTheme(), Theme, ThemeContext, ThemeContextValue, ThemeProvider()

### Community 50 - "SOM Building 1 Floor Config"
Cohesion: 0.29
Nodes (4): SOM_BUILDING_1_1F, SOM_BUILDING_1_2F, SOM_BUILDING_1_3F, SOM_BUILDING_1_FLOORS

### Community 51 - "Congestion Heatmap Component"
Cohesion: 0.47
Nodes (5): CongestionHeatmap(), CongestionHeatmapProps, getIntensityColor(), INTENSITY_COLORS, LEGEND_ITEMS

### Community 52 - "Building Photo Images"
Cohesion: 0.40
Nodes (6): Administration Building (UP Cebu) Entrance Photo, Admin Building Field / Open Grounds with Stage, AS Building East Wing Exterior, AS Building Parking / Road Area (UP Marker), AS Building West Wing Exterior, AS Building Courtyard/Annex Entrance (ASX)

### Community 53 - "Liadlaw Hall Floor Config"
Cohesion: 0.33
Nodes (3): LIADLAW_HALL_1F, LIADLAW_HALL_2F, LIADLAW_HALL_FLOORS

### Community 54 - "UP High School Floor Config"
Cohesion: 0.33
Nodes (3): UP_HIGH_SCHOOL_1F, UP_HIGH_SCHOOL_2F, UP_HIGH_SCHOOL_FLOORS

### Community 55 - "AS East Wing Floor Config"
Cohesion: 0.40
Nodes (4): AS_EAST_WING_1F, AS_EAST_WING_2F, AS_EAST_WING_3F, AS_EAST_WING_FLOORS

### Community 56 - "AS West Wing Floor Config"
Cohesion: 0.40
Nodes (4): AS_WEST_WING_1F, AS_WEST_WING_2F, AS_WEST_WING_3F, AS_WEST_WING_FLOORS

### Community 57 - "Admin Building Floor Config"
Cohesion: 0.50
Nodes (3): ADMIN_1F, ADMIN_2F, ADMIN_BUILDING_FLOORS

### Community 58 - "Social Sciences Floor Config"
Cohesion: 0.50
Nodes (3): SOCIAL_SCIENCES_1F, SOCIAL_SCIENCES_2F, SOCIAL_SCIENCES_FLOORS

### Community 59 - "Building Photo Images (Misc)"
Cohesion: 0.67
Nodes (3): College of Science Building Atrium (UP Cebu), Undergraduate Building / The Joya Gallery (UP Cebu), UP Cebu Library / Academic Building Exterior

## Ambiguous Edges - Review These
- `Generic File Icon` → `Multi-Story Building Model`  [AMBIGUOUS]
  public/file.svg · relation: conceptually_related_to
- `AS East Wing - 2nd Floor Plan` → `Stairwell`  [AMBIGUOUS]
  public/floorplans/AS East Wing 2nd floor.svg · relation: conceptually_related_to
- `AS West Wing - 3rd Floor Plan` → `Stairwell`  [AMBIGUOUS]
  public/floorplans/AS West Wing 3rd floor.svg · relation: conceptually_related_to
- `Admin Building - 1st Floor Plan` → `Stairwell`  [AMBIGUOUS]
  public/floorplans/Admin 1st floor.svg · relation: conceptually_related_to
- `CSB 2nd Floor Plan` → `Social Sciences 1st Floor Plan (placeholder)`  [AMBIGUOUS]
  public/floorplans/SocialSciences 1st floor.svg · relation: semantically_similar_to
- `Social Sciences 1st Floor Plan (placeholder)` → `Evacuation Simulation (Spring Time Saga)`  [AMBIGUOUS]
  public/floorplans/SocialSciences 1st floor.svg · relation: conceptually_related_to
- `Social Sciences 2nd Floor Plan (placeholder)` → `Evacuation Simulation (Spring Time Saga)`  [AMBIGUOUS]
  public/floorplans/SocialSciences 2nd floor.svg · relation: conceptually_related_to
- `Administration Building (UP Cebu) Entrance Photo` → `AS Building Parking / Road Area (UP Marker)`  [AMBIGUOUS]
  public/floorplans/as-parking.png · relation: conceptually_related_to
- `AS Building East Wing Exterior` → `AS Building Parking / Road Area (UP Marker)`  [AMBIGUOUS]
  public/floorplans/as-parking.png · relation: conceptually_related_to
- `College of Science Building Atrium (UP Cebu)` → `UP Cebu Library / Academic Building Exterior`  [AMBIGUOUS]
  public/floorplans/up-cebu-library.png · relation: conceptually_related_to
- `UP High School Open Grounds/Quadrangle` → `Volleyball/Tennis Court Area`  [AMBIGUOUS]
  public/floorplans/up-high-open.png · relation: conceptually_related_to

## Knowledge Gaps
- **310 isolated node(s):** `sectionTitle`, `sectionDesc`, `divider`, `SECTION_CARD`, `Direction` (+305 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Generic File Icon` and `Multi-Story Building Model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `AS East Wing - 2nd Floor Plan` and `Stairwell`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `AS West Wing - 3rd Floor Plan` and `Stairwell`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Admin Building - 1st Floor Plan` and `Stairwell`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `CSB 2nd Floor Plan` and `Social Sciences 1st Floor Plan (placeholder)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Social Sciences 1st Floor Plan (placeholder)` and `Evacuation Simulation (Spring Time Saga)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Social Sciences 2nd Floor Plan (placeholder)` and `Evacuation Simulation (Spring Time Saga)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._