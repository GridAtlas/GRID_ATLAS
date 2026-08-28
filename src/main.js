import {
  CloudApiError,
  cloudPayloadToPointList,
  createCloudClient,
  pointListToCloudPayload
} from "./cloud-client.js?v=4";
import { cloudAuthConfig, cloudAuthUrlState, createCloudAuthClient } from "./cloud-auth.js?v=2";
import {
  GRIDATLAS_MIME_TYPE,
  GRIDATLAS_URL_PARAMETER,
  GridAtlasImportError,
  buildGridAtlasArchive,
  decodeGridAtlasUrlPayload,
  gridAtlasDocumentDigest,
  readGridAtlasFile
} from "./gridatlas-import.js?v=2";
import {
  dataUrlToBlob,
  getGridAtlasAsset,
  gridAtlasAssetUrl,
  hydrateGridAtlasAssets,
  putGridAtlasAsset,
  storeGridAtlasDataUrl
} from "./gridatlas-assets.js?v=1";
import {
  GRIDATLAS_ANALYSIS_EXTENSION,
  buildGridAtlasAnalysisLayer,
  normalizeGridAtlasLineColor,
  readGridAtlasAnalysisLayer,
  withoutGridAtlasAnalysisLayer
} from "./gridatlas-analysis.js?v=2";
import {
  analysisLineEndpointIdentityKey,
  analysisVertexPlaceRef,
  createAnalysisFigure,
  createAnalysisLine,
  figureEdges,
  figureVertexWalk,
  normalizeAnalysisFigure,
  normalizeAnalysisLine,
  normalizeAnalysisVertex,
  removeAnalysisFigureVertex
} from "./analysis-layer.js?v=1";
import { chooseAnalysisHit } from "./analysis-hit-priority.js?v=1";
import { resolveLineBodyDragCandidate } from "./drag-hit-testing.js?v=1";
import { externalMapUrl } from "./external-map-url.js?v=1";
import { analyzeLineIntersection, analyzeOpenPath, analyzeSegmentShape, vincentyDistanceMeters } from "./shape-analysis.js?v=1";
import {
  BARRIER_CONFIG,
  appendBarrierEvent,
  barrierFigureId,
  barrierStoneIds,
  createBarrierLog,
  dissolveBarrier,
  grantBarrierStock,
  maxVerticesForRank,
  registerBarrier,
  sanitizeBarrierLog,
  stoneCapFor,
  stoneDisplayCount,
  stoneExactCount,
  stoneIdFromTile,
  stockCapForRank,
  tileCenterGeo,
  tileBounds,
  tileIdFromGeo,
  ryumyakuScatterForRank,
  perimeterLimitKmForRank,
  validateBarrierVertices
} from "./barrier.js?v=1";
import { barrierFitsPerimeter, polygonSelfIntersects, scoreBarrier } from "./barrier-score.js?v=1";
import {
  BARRIER_EVALUATION_CONFIG,
  createKekkaishiStatus,
  currentBarrierPower,
  evaluateBarrierLog,
  liveCumulativeBarrierSpirit,
  barrierRankStoneProgress,
  rankForKekkaishi,
  rankForBarrier,
  rankAchievementDays,
  settleBarrierSpirit
} from "./barrier-evaluation.js?v=1";

const STORAGE_KEY = "grid-atlas-workspace-v2";
const THEME_KEY = "grid-atlas-theme";
const LANGUAGE_KEY = "grid-atlas-language";
const DISTANCE_UNIT_KEY = "grid-atlas-distance-unit";
const ROUTE_RETURN_KEY = "grid-atlas-route-return";
const MAP_PROVIDER_KEY = "grid-atlas-map-provider";
const POINT_INFO_MAP_RETURN_KEY = "grid-atlas-point-info-map-return";
const MAP_PROVIDER_GOOGLE = "google";
const MAP_PROVIDER_APPLE = "apple";
const GRIDATLAS_PRESET_PARAMETER = "preset";
const PUBLIC_PRESET_DIRECTORY = "presets";
const PUBLIC_PRESET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const GPS_ENABLED_KEY = "grid-atlas-gps-enabled";
const BARRIER_LOG_KEY = "grid-atlas-barrier-log-v1";
const LEGACY_TRAVERSE_LOG_KEY = "grid-atlas-traverse-log-v1";
const KEKKAI_TESTER_ENABLED_KEY = "grid-atlas-kekkai-tester-enabled";
const KEKKAI_POINT_LIST_NAME = "結界アトラス";
const LEGACY_DRAGON_EYE_LIST_NAME = "結界モード龍脈眼";
const DRAGON_EYE_SHAPES = Object.freeze({
  triangle: Object.freeze({ sides: 3, rotation: -Math.PI / 2, glyph: "△", ja: "正三角形", en: "Equilateral triangle" }),
  square: Object.freeze({ sides: 4, rotation: Math.PI / 4, glyph: "□", ja: "正方形", en: "Square" }),
  diamond: Object.freeze({ sides: 4, rotation: 0, glyph: "◇", ja: "ひし形", en: "Diamond" }),
  pentagon: Object.freeze({ sides: 5, rotation: -Math.PI / 2, glyph: "⬠", ja: "正五角形", en: "Regular pentagon" }),
  hexagon: Object.freeze({ sides: 6, rotation: 0, glyph: "⬡", ja: "正六角形", en: "Regular hexagon" }),
  heptagon: Object.freeze({ sides: 7, rotation: -Math.PI / 2, glyph: "７", ja: "正七角形", en: "Regular heptagon" }),
  octagon: Object.freeze({ sides: 8, rotation: Math.PI / 8, glyph: "８", ja: "正八角形", en: "Regular octagon" }),
  pentagram: Object.freeze({ sides: 5, rotation: -Math.PI / 2, glyph: "✦", ja: "五芒星", en: "Pentagram", linkPattern: "pentagram", skip: 2 }),
  hexagram: Object.freeze({ sides: 6, rotation: Math.PI / 6, glyph: "✡", ja: "六芒星", en: "Hexagram", linkPattern: "hexagram", skip: 2 }),
  octagram: Object.freeze({ sides: 8, rotation: Math.PI / 8, glyph: "✳", ja: "八芒星", en: "Octagram", linkPattern: "octagram", skip: 3 }),
  octagram2: Object.freeze({ sides: 8, rotation: Math.PI / 8, glyph: "✥", ja: "八芒星", en: "Octagram", linkPattern: "octagram2", skip: 2 })
});

const DRAGON_EYE_SHAPE_PREVIEW_POINTS = Object.freeze({
  triangle: "50,10 91,84 9,84",
  square: "17,17 83,17 83,83 17,83",
  diamond: "50,10 90,50 50,90 10,50",
  pentagon: "50,9 89,38 74,86 26,86 11,38",
  hexagon: "50,9 86,30 86,70 50,91 14,70 14,30",
  heptagon: "50,8 89,30 80,76 50,92 20,76 11,30",
  octagon: "30,10 70,10 90,30 90,70 70,90 30,90 10,70 10,30",
  pentagram: "50,8 60,36 90,36 66,53 76,83 50,64 24,83 34,53 10,36 40,36",
  hexagram: "50,8 86,70 14,70 50,8 86,30 14,30",
  octagram: "50,7 58,31 72,13 68,38 93,31 71,50 93,69 68,62 72,87 58,69 50,93 42,69 28,87 32,62 7,69 29,50 7,31 32,38 28,13 42,31",
  octagram2: "30,10 90,50 30,90 10,30 70,10 90,70 50,90 10,50"
});

const CLOUD_ACCESS_TOKEN_KEY = "grid-atlas-cloud-access-token";
const CLOUD_PASSWORD_SETUP_KEY_PREFIX = "grid-atlas-cloud-password-set:";
const CLOUD_SIGNUP_PENDING_KEY = "grid-atlas-cloud-signup-pending";
const CLOUD_PRODUCTION_API_URL = "https://grid-atlas-cloud-staging.kazki1981.workers.dev";
const CLOUD_SHARE_URL_PARAMETER = "share";
const CLOUD_AUTO_REFRESH_INTERVAL_MS = 30_000;
const PASTEL_THEME = "pastel";
const RETRO_THEME = "retro";
const BASIC_THEME = "basic";
const KEKKAI_THEME = "kekkai";
const KEKKAI_MODE = "kekkai";
const KEKKAI_TITLE_URL = "https://gridatlas.github.io/KEKKAI/";
const JA_LANGUAGE = "ja";
const EN_LANGUAGE = "en";
const WEB_VERSION = "0.2621";
let cloudProgressClearTimer = null;
const LINE_COLOR_OPTIONS = Object.freeze([
  { value: "#e53935", ja: "赤", en: "Red" },
  { value: "#fb8c00", ja: "オレンジ", en: "Orange" },
  { value: "#fdd835", ja: "黄色", en: "Yellow" },
  { value: "#43a047", ja: "緑", en: "Green" },
  { value: "#00897b", ja: "青緑", en: "Teal" },
  { value: "#1e88e5", ja: "青", en: "Blue" },
  { value: "#3949ab", ja: "紺", en: "Navy" },
  { value: "#8e24aa", ja: "紫", en: "Purple" },
  { value: "#d81b60", ja: "ピンク", en: "Pink" },
  { value: "#546e7a", ja: "グレー", en: "Gray" }
]);
const MOBILE_EMPTY_VALUE = "-";
const METRIC_UNIT = "metric";
const IMPERIAL_UNIT = "imperial";
const POINT_RADIUS = 8;
const BARRIER_TILE_MIN_SCREEN_SIZE = POINT_RADIUS * 2 + 8;
const BARRIER_SINGLE_TILE_TARGET_RATIO = 0.28;
const BARRIER_SINGLE_TILE_MIN_SCREEN_SIZE = 140;
const BARRIER_SINGLE_TILE_MAX_SCREEN_SIZE = 220;
const ATLAS_MODE_LONG_PRESS_MS = 3000;
const BARRIER_LINK_DIAMOND_MS = 500;
const BARRIER_LINK_COMPLETION_MS = 1100;
const BARRIER_LINK_RELEASE_DRIFT_TOLERANCE = 28;
const BARRIER_LINK_ERROR_MESSAGE_MS = 4200;
const BARRIER_LINK_ORANGE = "#f28a2e";
const BARRIER_LINK_CORE = "#fff0cc";
const BARRIER_LINK_GLOW = "rgb(255 138 46 / 0.98)";
const BARRIER_LINK_ROOM_BG = "#160c22";
const BARRIER_LINK_ROOM_BORDER = "#7d3bb0";
const BARRIER_LINK_ROOM_INNER_BORDER = "#b56be5";
const POINT_SELECTION_RING_RADIUS = POINT_RADIUS + 2;
const LINE_SELECTION_HIT_RADIUS = 16;
const POINT_SELECTION_RING_WIDTH = 4;
const POINTER_MOVE_THRESHOLD = 3;
const RANGE_SELECTION_LONG_PRESS_MS = 450;
const LINE_DRAG_LONG_PRESS_MS = 400;
const LINE_INFO_LONG_PRESS_MS = 1000;
const RANGE_SELECTION_MIN_SIZE = 8;
const CURRENT_LOCATION_ID = "__current_location__";
const LOADED_OBSERVATION_PREFIX = "__loaded_observation__";
const DEFAULT_POINT_LIST_ID = "local";
const NEW_POINT_LIST_ID = "__new_point_list__";
const FOLLOW_SCALE_MANUAL = "manual";
const FOLLOW_SCALE_CENTER = "center";
const FOLLOW_SCALE_TARGET = "target";
const CURRENT_LOCATION_GRID_SCALE = 0.7;
const DRAGON_EYE_SIZE_PERCENT_STEP = 10;
const DRAGON_EYE_MIN_SIZE_PERCENT = 10;
const DRAGON_EYE_ROTATION_STEP_DEGREES = 15;
const EARTH_RADIUS_METERS = 6371008.8;
const MERCATOR_RADIUS = 6378137;
const MAX_MERCATOR_LAT = 85.05112878;
const TARGET_DISTANCE_STEPS = [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000];
const TARGET_ARRIVAL_METERS = 25;
const OBSERVATION_MIN_STEP_METERS = 15;
const OBSERVATION_ACCURACY_FACTOR = 1.5;
const OBSERVATION_MAX_ACCURACY_METERS = 50;
const OBSERVATION_MAX_POINTS = 2000;
const OBSERVATION_GAP_THRESHOLD_MS = 30 * 1000;
const LOCATION_STALE_AFTER_MS = 30 * 1000;
const DEFAULT_GEO = { lat: 35.681236, lng: 139.767125 };
const DEFAULT_CENTER = { x: 0, y: 0 };
const MOBILE_GRID_PAGES = ["grid", "points", "lists"];

const canvas = document.querySelector("#gridCanvas");
const context = canvas.getContext("2d");
let canvasMetrics = {
  width: 0,
  height: 0,
  dpr: 1
};
let canvasResizeFrame = 0;
let canvasResizeObserver = null;
let locationGlowFrame = 0;

const elements = {
  actionAnalyzeButton: document.querySelector("#actionAnalyzeButton"),
  actionLinkButton: document.querySelector("#actionLinkButton"),
  actionLinkLabel: document.querySelector("#actionLinkLabel"),
  actionRegisterButton: document.querySelector("#actionRegisterButton"),
  actionRouteButton: document.querySelector("#actionRouteButton"),
  actionRouteLabel: document.querySelector("#actionRouteLabel"),
  pointTransferDialog: document.querySelector("#pointTransferDialog"),
  storageTransferDialog: document.querySelector("#storageTransferDialog"),
  storageTransferDialogTitle: document.querySelector("#storageTransferDialogTitle"),
  storageTransferDialogHint: document.querySelector("#storageTransferDialogHint"),
  storageTransferDestinationList: document.querySelector("#storageTransferDestinationList"),
  storageTransferMoveButton: document.querySelector("#storageTransferMoveButton"),
  storageTransferCopyButton: document.querySelector("#storageTransferCopyButton"),
  storageTransferCancelButton: document.querySelector("#storageTransferCancelButton"),
  pointTransferDialogTitle: document.querySelector("#pointTransferDialogTitle"),
  pointTransferDialogHint: document.querySelector("#pointTransferDialogHint"),
  pointTransferDestinationList: document.querySelector("#pointTransferDestinationList"),
  createPointTransferListButton: document.querySelector("#createPointTransferListButton"),
  cancelPointTransferButton: document.querySelector("#cancelPointTransferButton"),
  geometryDestinationDialog: document.querySelector("#geometryDestinationDialog"),
  geometryDestinationDialogTitle: document.querySelector("#geometryDestinationDialogTitle"),
  geometryDestinationDialogHint: document.querySelector("#geometryDestinationDialogHint"),
  geometryDestinationList: document.querySelector("#geometryDestinationList"),
  cancelGeometryDestinationButton: document.querySelector("#cancelGeometryDestinationButton"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmDialogTitle: document.querySelector("#confirmDialogTitle"),
  confirmDialogMessage: document.querySelector("#confirmDialogMessage"),
  confirmDialogCancelButton: document.querySelector("#confirmDialogCancelButton"),
  confirmDialogDeleteLinksButton: document.querySelector("#confirmDialogDeleteLinksButton"),
  confirmDialogDeletePointsButton: document.querySelector("#confirmDialogDeletePointsButton"),
  confirmDialogDeleteFiguresButton: document.querySelector("#confirmDialogDeleteFiguresButton"),
  confirmDialogDeleteAllButton: document.querySelector("#confirmDialogDeleteAllButton"),
  confirmDialogConfirmButton: document.querySelector("#confirmDialogConfirmButton"),
  textInputDialog: document.querySelector("#textInputDialog"),
  textInputDialogTitle: document.querySelector("#textInputDialogTitle"),
  textInputDialogMessage: document.querySelector("#textInputDialogMessage"),
  textInputDialogLabel: document.querySelector("#textInputDialogLabel"),
  textInputDialogValue: document.querySelector("#textInputDialogValue"),
  textInputDialogText: document.querySelector("#textInputDialogText"),
  textInputDialogCancelButton: document.querySelector("#textInputDialogCancelButton"),
  textInputDialogSubmitButton: document.querySelector("#textInputDialogSubmitButton"),
  textInputDialogDefaultActions: document.querySelector("#textInputDialogDefaultActions"),
  textInputDialogShareActions: document.querySelector("#textInputDialogShareActions"),
  textInputShareFileButton: document.querySelector("#textInputShareFileButton"),
  textInputShareImageButton: document.querySelector("#textInputShareImageButton"),
  textInputShareCloudButton: document.querySelector("#textInputShareCloudButton"),
  actionCopyToListButton: document.querySelector("#actionCopyToListButton"),
  actionMoveToListButton: document.querySelector("#actionMoveToListButton"),
  actionShareSelectedButton: document.querySelector("#actionShareSelectedButton"),
  actionInvertButton: document.querySelector("#actionInvertButton"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  actionCenterButton: document.querySelector("#actionCenterButton"),
  actionMapButton: document.querySelector("#actionMapButton"),
  actionBar: document.querySelector(".actionbar"),
  traverseActionBar: document.querySelector("#traverseActionBar"),
  traverseBottomCancelButton: document.querySelector("#traverseBottomCancelButton"),
  traverseBottomCancelLabel: document.querySelector("#traverseBottomCancelLabel"),
  traverseBottomConfirmButton: document.querySelector("#traverseBottomConfirmButton"),
  traverseBottomConfirmLabel: document.querySelector("#traverseBottomConfirmLabel"),
  dragonEyeDialog: document.querySelector("#dragonEyeDialog"),
  dragonEyeAvailability: document.querySelector("#dragonEyeAvailability"),
  dragonEyeShapeOptions: document.querySelector("#dragonEyeShapeOptions"),
  dragonEyeControlDialog: document.querySelector("#dragonEyeControlDialog"),
  dragonEyeControlStatus: document.querySelector("#dragonEyeControlStatus"),
  dragonEyeControlCloseButton: document.querySelector("#dragonEyeControlCloseButton"),
  dragonEyeShrinkButton: document.querySelector("#dragonEyeShrinkButton"),
  dragonEyeExpandButton: document.querySelector("#dragonEyeExpandButton"),
  dragonEyeRotateCounterclockwiseButton: document.querySelector("#dragonEyeRotateCounterclockwiseButton"),
  dragonEyeRotateClockwiseButton: document.querySelector("#dragonEyeRotateClockwiseButton"),
  traverseDragonEyeButton: document.querySelector("#traverseDragonEyeButton"),
  traversePlacementViewButton: document.querySelector("#traversePlacementViewButton"),
  traverseCreateBarrierButton: document.querySelector("#traverseCreateBarrierButton"),
  traverseDissolveBarrierButton: document.querySelector("#traverseDissolveBarrierButton"),
  traverseStockValue: document.querySelector("#traverseStockValue"),
  traverseInstalledValue: document.querySelector("#traverseInstalledValue"),
  traverseLocationValue: document.querySelector("#traverseLocationValue"),
  traverseBarrierRequirement: document.querySelector("#traverseBarrierRequirement"),
  traverseQuantityDialog: document.querySelector("#traverseQuantityDialog"),
  traverseQuantityDialogTitle: document.querySelector("#traverseQuantityDialogTitle"),
  traverseQuantityDialogMessage: document.querySelector("#traverseQuantityDialogMessage"),
  traverseQuantityDecreaseButton: document.querySelector("#traverseQuantityDecreaseButton"),
  traverseQuantityIncreaseButton: document.querySelector("#traverseQuantityIncreaseButton"),
  traverseQuantityValue: document.querySelector("#traverseQuantityValue"),
  traverseQuantityCancelButton: document.querySelector("#traverseQuantityCancelButton"),
  traverseQuantityConfirmButton: document.querySelector("#traverseQuantityConfirmButton"),
  barrierPinDialog: document.querySelector("#barrierPinDialog"),
  barrierPinTitle: document.querySelector("#barrierPinTitle"),
  barrierPinTargetFieldset: document.querySelector("#barrierPinTargetFieldset"),
  barrierPinTargetPending: document.querySelector("#barrierPinTargetPending"),
  barrierPinTargetCurrent: document.querySelector("#barrierPinTargetCurrent"),
  barrierPinTargetStatus: document.querySelector("#barrierPinTargetStatus"),
  barrierPinCancelButton: document.querySelector("#barrierPinCancelButton"),
  barrierPinCancelButtonBottom: document.querySelector("#barrierPinCancelButtonBottom"),
  barrierPinConfirmButton: document.querySelector("#barrierPinConfirmButton"),
  editionBadge: document.querySelector("#editionBadge"),
  webVersionBadge: document.querySelector("#webVersionBadge"),
  settingsMenu: document.querySelector("#settingsMenu"),
  settingsMenuButton: document.querySelector("#settingsMenuButton"),
  openGridAtlasButton: document.querySelector("#openGridAtlasButton"),
  kekkaiReturnTitleButton: document.querySelector("#kekkaiReturnTitleButton"),
  openCloudButton: document.querySelector("#openCloudButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  cloudDialog: document.querySelector("#cloudDialog"),
  closeCloudButton: document.querySelector("#closeCloudButton"),
  cloudDialogBody: document.querySelector("#cloudDialogBody"),
  brandTitle: document.querySelector("#brandTitle"),
  cloudSharesSection: document.querySelector("#cloudSharesSection"),
  cloudSharesList: document.querySelector("#cloudSharesList"),
  shareImagePreviewDialog: document.querySelector("#shareImagePreviewDialog"),
  shareImagePreviewImage: document.querySelector("#shareImagePreviewImage"),
  cloudTesterSignupDialog: document.querySelector("#cloudTesterSignupDialog"),
  closeCloudTesterSignupButton: document.querySelector("#closeCloudTesterSignupButton"),
  cloudTesterSignupDialogBody: document.querySelector("#cloudTesterSignupDialogBody"),
  settingsThemeField: document.querySelector("#settingsThemeField"),
  settingsThemeSelect: document.querySelector("#settingsThemeSelect"),
  settingsLanguageSelect: document.querySelector("#settingsLanguageSelect"),
  settingsUnitSelect: document.querySelector("#settingsUnitSelect"),
  settingsGpsEnabled: document.querySelector("#settingsGpsEnabled"),
  settingsMapProviderSelect: document.querySelector("#settingsMapProviderSelect"),
  kekkaiTesterField: document.querySelector("#kekkaiTesterField"),
  kekkaiTesterEnabled: document.querySelector("#kekkaiTesterEnabled"),
  systemUpdateButton: document.querySelector("#systemUpdateButton"),
  systemUpdateStatus: document.querySelector("#systemUpdateStatus"),
  systemUpdateVersion: document.querySelector("#systemUpdateVersion"),
  statusLine: document.querySelector("#statusLine"),
  selectionInfoText: document.querySelector("#selectionInfoText"),
  mobileDisplayedPointCount: document.querySelector("#mobileDisplayedPointCount"),
  mobileSelectedPointCount: document.querySelector("#mobileSelectedPointCount"),
  mobilePointDistance: document.querySelector("#mobilePointDistance"),
  mobileFirstSelection: document.querySelector("#mobileFirstSelection"),
  mobileLastSelection: document.querySelector("#mobileLastSelection"),
  mobileDistanceType: document.querySelector("#mobileDistanceType"),
  sidebarSelectedTitle: document.querySelector("#sidebarSelectedTitle"),
  mapColumn: document.querySelector(".map-column"),
  sidebar: document.querySelector(".sidebar"),
  mobilePageTabs: Array.from(document.querySelectorAll("[data-mobile-page]")),
  mobilePanels: Array.from(document.querySelectorAll("[data-mobile-panel]")),
  mobileGridTabs: Array.from(document.querySelectorAll("[data-mobile-grid-page]")),
  mobileGridPanels: Array.from(document.querySelectorAll("[data-mobile-grid-panel]")),
  mobilePointCount: document.querySelector("#mobilePointCount"),
  mobilePointItems: document.querySelector("#mobilePointItems"),
  pointRegistrationDialog: document.querySelector("#pointRegistrationDialog"),
  pointForm: document.querySelector("#pointForm"),
  closePointRegistrationButton: document.querySelector("#closePointRegistrationButton"),
  pointTitle: document.querySelector("#pointTitle"),
  pointLat: document.querySelector("#pointLat"),
  pointLng: document.querySelector("#pointLng"),
  pointPhoto: document.querySelector("#pointPhoto"),
  pointNote: document.querySelector("#pointNote"),
  pointDestinationListSelect: document.querySelector("#pointDestinationListSelect"),
  pointSubmitButton: document.querySelector("#pointSubmitButton"),
  readClipboardButton: document.querySelector("#readClipboardButton"),
  shareImportStatus: document.querySelector("#shareImportStatus"),
  gridAtlasDropOverlay: document.querySelector("#gridAtlasDropOverlay"),
  pointInfoDialog: document.querySelector("#pointInfoDialog"),
  pointListPreviewDialog: document.querySelector("#pointListPreviewDialog"),
  pointListPreviewDialogTitle: document.querySelector("#pointListPreviewDialogTitle"),
  pointListPreviewCount: document.querySelector("#pointListPreviewCount"),
  pointListPreviewItems: document.querySelector("#pointListPreviewItems"),
  pointInfoPhoto: document.querySelector("#pointInfoPhoto"),
  pointInfoSummaryTitle: document.querySelector("#pointInfoSummaryTitle"),
  pointInfoName: document.querySelector("#pointInfoName"),
  pointInfoComment: document.querySelector("#pointInfoComment"),
  pointInfoCoords: document.querySelector("#pointInfoCoords"),
  pointInfoList: document.querySelector("#pointInfoList"),
  pointInfoCreated: document.querySelector("#pointInfoCreated"),
  pointInfoUpdated: document.querySelector("#pointInfoUpdated"),
  pointInfoDistance: document.querySelector("#pointInfoDistance"),
  pointInfoEditButton: document.querySelector("#pointInfoEditButton"),
  pointInfoMapButton: document.querySelector("#pointInfoMapButton"),
  gridPointQuickDialog: document.querySelector("#gridPointQuickDialog"),
  gridPointQuickName: document.querySelector("#gridPointQuickName"),
  gridPointQuickList: document.querySelector("#gridPointQuickList"),
  gridPointQuickStartButton: document.querySelector("#gridPointQuickStartButton"),
  gridPointQuickStartLabel: document.querySelector("#gridPointQuickStartLabel"),
  gridPointQuickTargetButton: document.querySelector("#gridPointQuickTargetButton"),
  gridPointQuickTargetLabel: document.querySelector("#gridPointQuickTargetLabel"),
  gridPointQuickEditButton: document.querySelector("#gridPointQuickEditButton"),
  gridPointQuickEditLabel: document.querySelector("#gridPointQuickEditLabel"),
  gridPointQuickTrackButton: document.querySelector("#gridPointQuickTrackButton"),
  gridPointQuickTrackLabel: document.querySelector("#gridPointQuickTrackLabel"),
  gridPointQuickInfoButton: document.querySelector("#gridPointQuickInfoButton"),
  gridPointQuickInfoLabel: document.querySelector("#gridPointQuickInfoLabel"),
  gridBarrierStoneQuickDialog: document.querySelector("#gridPointQuickDialog"),
  gridBarrierStoneQuickName: document.querySelector("#gridPointQuickName"),
  gridBarrierStoneQuickInfo: document.querySelector("#gridPointQuickList"),
  gridBarrierStoneQuickPlaceButton: document.querySelector("#gridBarrierStoneQuickPlaceButton"),
  gridBarrierStoneQuickPlaceLabel: document.querySelector("#gridBarrierStoneQuickPlaceLabel"),
  gridBarrierStoneQuickPickButton: document.querySelector("#gridBarrierStoneQuickPickButton"),
  gridBarrierStoneQuickPickLabel: document.querySelector("#gridBarrierStoneQuickPickLabel"),
  gridBarrierStoneQuickEditButton: document.querySelector("#gridBarrierStoneQuickEditButton"),
  gridBarrierStoneQuickEditLabel: document.querySelector("#gridBarrierStoneQuickEditLabel"),
  gridBarrierStoneQuickMemoButton: document.querySelector("#gridBarrierStoneQuickMemoButton"),
  gridBarrierStoneQuickMemoLabel: document.querySelector("#gridBarrierStoneQuickMemoLabel"),
  gridBarrierStoneQuickMapButton: document.querySelector("#gridBarrierStoneQuickMapButton"),
  gridBarrierStoneQuickMapLabel: document.querySelector("#gridBarrierStoneQuickMapLabel"),
  gridPointHoverLabel: document.querySelector("#gridPointHoverLabel"),
  gridLinkQuickDialog: document.querySelector("#gridLinkQuickDialog"),
  gridLinkQuickName: document.querySelector("#gridLinkQuickName"),
  gridLinkQuickDistance: document.querySelector("#gridLinkQuickDistance"),
  gridLinkQuickEndpoints: document.querySelector("#gridLinkQuickEndpoints"),
  gridLinkQuickColorButton: document.querySelector("#gridLinkQuickColorButton"),
  gridLinkQuickColorLabel: document.querySelector("#gridLinkQuickColorLabel"),
  gridLinkQuickColorMark: document.querySelector("#gridLinkQuickColorMark"),
  gridLinkQuickDeleteButton: document.querySelector("#gridLinkQuickDeleteButton"),
  gridLinkQuickDeleteLabel: document.querySelector("#gridLinkQuickDeleteLabel"),
  gridFigureQuickDialog: document.querySelector("#gridFigureQuickDialog"),
  gridFigureQuickName: document.querySelector("#gridFigureQuickName"),
  gridFigureQuickInfo: document.querySelector("#gridFigureQuickInfo"),
  gridFigureQuickMemoButton: document.querySelector("#gridFigureQuickMemoButton"),
  gridFigureQuickMemoLabel: document.querySelector("#gridFigureQuickMemoLabel"),
  gridFigureQuickDeleteVertexButton: document.querySelector("#gridFigureQuickDeleteVertexButton"),
  gridFigureQuickDeleteVertexLabel: document.querySelector("#gridFigureQuickDeleteVertexLabel"),
  gridFigureQuickDeleteButton: document.querySelector("#gridFigureQuickDeleteButton"),
  gridFigureQuickDeleteIcon: document.querySelector("#gridFigureQuickDeleteIcon"),
  gridFigureQuickDeleteLabel: document.querySelector("#gridFigureQuickDeleteLabel"),
  gridLinkColorDialog: document.querySelector("#gridLinkColorDialog"),
  gridLinkColorDialogTitle: document.querySelector("#gridLinkColorDialogTitle"),
  gridLinkColorDialogMessage: document.querySelector("#gridLinkColorDialogMessage"),
  gridLinkColorPalette: document.querySelector("#gridLinkColorPalette"),
  gridLinkColorSegmentOption: document.querySelector("#gridLinkColorSegmentOption"),
  gridLinkColorSegmentLabel: document.querySelector("#gridLinkColorSegmentLabel"),
  gridLinkColorShapeOption: document.querySelector("#gridLinkColorShapeOption"),
  gridLinkColorShapeLabel: document.querySelector("#gridLinkColorShapeLabel"),
  gridLinkColorCancelButton: document.querySelector("#gridLinkColorCancelButton"),
  gridLinkColorApplyButton: document.querySelector("#gridLinkColorApplyButton"),
  analysisDialog: document.querySelector("#analysisDialog"),
  analysisDialogTitle: document.querySelector("#analysisDialogTitle"),
  analysisDialogContent: document.querySelector("#analysisDialogContent"),
  analysisDialogCopyStatus: document.querySelector("#analysisDialogCopyStatus"),
  analysisDialogCopyButton: document.querySelector("#analysisDialogCopyButton"),
  appToast: document.querySelector("#appToast"),
  cloudProgress: document.querySelector("#cloudProgress"),
  cloudProgressTitle: document.querySelector("#cloudProgressTitle"),
  cloudProgressPattern: document.querySelector("#cloudProgressPattern"),
  useLocationButton: document.querySelector("#useLocationButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  fitButton: document.querySelector("#fitButton"),
  originButton: document.querySelector("#originButton"),
  emptyDetails: document.querySelector("#emptyDetails"),
  pointDetails: document.querySelector("#pointDetails"),
  barrierDetails: document.querySelector("#barrierDetails"),
  barrierDetailTitle: document.querySelector("#barrierDetailTitle"),
  barrierDetailRank: document.querySelector("#barrierDetailRank"),
  barrierDetailPower: document.querySelector("#barrierDetailPower"),
  barrierRankProgress: document.querySelector("#barrierRankProgress"),
  kekkaishiStatusDialog: document.querySelector("#kekkaishiStatusDialog"),
  kekkaishiStatusRank: document.querySelector("#kekkaishiStatusRank"),
  kekkaishiStatusLifetime: document.querySelector("#kekkaishiStatusLifetime"),
  kekkaishiStatusCurrentPower: document.querySelector("#kekkaishiStatusCurrentPower"),
  kekkaishiStatusDailyPower: document.querySelector("#kekkaishiStatusDailyPower"),
  kekkaishiStatusCount: document.querySelector("#kekkaishiStatusCount"),
  kekkaishiStatusCurrentRank: document.querySelector("#kekkaishiStatusCurrentRank"),
  kekkaishiStatusCurrentDetails: document.querySelector("#kekkaishiStatusCurrentDetails"),
  kekkaishiStatusCurrentShapes: document.querySelector("#kekkaishiStatusCurrentShapes"),
  kekkaishiStatusNextShapesPanel: document.querySelector("#kekkaishiStatusNextShapesPanel"),
  kekkaishiStatusNextRank: document.querySelector("#kekkaishiStatusNextRank"),
  kekkaishiStatusNextDetails: document.querySelector("#kekkaishiStatusNextDetails"),
  kekkaishiStatusNextShapes: document.querySelector("#kekkaishiStatusNextShapes"),
  kekkaishiStatusProgressNextRank: document.querySelector("#kekkaishiStatusProgressNextRank"),
  kekkaishiStatusProgressValue: document.querySelector("#kekkaishiStatusProgressValue"),
  kekkaishiStatusProgressBar: document.querySelector("#kekkaishiStatusProgressBar"),
  kekkaishiStatusProgress: document.querySelector("#kekkaishiStatusProgress"),
  closeKekkaishiStatusButton: document.querySelector("#closeKekkaishiStatusButton"),
  shareKekkaishiStatusButton: document.querySelector("#shareKekkaishiStatusButton"),
  barrierDetailDensity: document.querySelector("#barrierDetailDensity"),
  barrierDetailArea: document.querySelector("#barrierDetailArea"),
  barrierDetailStones: document.querySelector("#barrierDetailStones"),
  barrierDetailShape: document.querySelector("#barrierDetailShape"),
  barrierDetailBeauty: document.querySelector("#barrierDetailBeauty"),
  barrierDetailScale: document.querySelector("#barrierDetailScale"),
  barrierShareButton: document.querySelector("#barrierShareButton"),
  selectionHeading: document.querySelector("#selectionHeading"),
  detailPhoto: document.querySelector("#detailPhoto"),
  detailTitleLabel: document.querySelector("#detailTitleLabel"),
  detailTitle: document.querySelector("#detailTitle"),
  detailCoordsLabel: document.querySelector("#detailCoordsLabel"),
  detailCoords: document.querySelector("#detailCoords"),
  detailCreatedLabel: document.querySelector("#detailCreatedLabel"),
  detailCreated: document.querySelector("#detailCreated"),
  detailNoteLabel: document.querySelector("#detailNoteLabel"),
  detailNote: document.querySelector("#detailNote"),
  mapOpenActions: document.querySelector("#mapOpenActions"),
  targetActions: document.querySelector("#targetActions"),
  routeStartPointButton: document.querySelector("#routeStartPointButton"),
  targetPointButton: document.querySelector("#targetPointButton"),
  openAppleMapsButton: document.querySelector("#openAppleMapsButton"),
  openGoogleMapsButton: document.querySelector("#openGoogleMapsButton"),
  deletePointButton: document.querySelector("#deletePointButton"),
  pointCount: document.querySelector("#pointCount"),
  linkCount: document.querySelector("#linkCount"),
  totalDistance: document.querySelector("#totalDistance"),
  longestDistance: document.querySelector("#longestDistance"),
  linkList: document.querySelector("#linkList"),
  routeSelectedCount: document.querySelector("#routeSelectedCount"),
  routeStartSelect: document.querySelector("#routeStartSelect"),
  routeReturnToStart: document.querySelector("#routeReturnToStart"),
  computeRouteButton: document.querySelector("#computeRouteButton"),
  clearRouteSelectionButton: document.querySelector("#clearRouteSelectionButton"),
  routeSummary: document.querySelector("#routeSummary"),
  routeList: document.querySelector("#routeList"),
  newPointListButtons: Array.from(document.querySelectorAll("[data-new-point-list]")),
  selectAllListButtons: Array.from(document.querySelectorAll("[data-select-all-lists]")),
  clearAllListButtons: Array.from(document.querySelectorAll("[data-clear-all-lists]")),

  pointImportFile: document.querySelector("#pointImportFile"),
  storageListContainers: Array.from(document.querySelectorAll("[data-storage-list-items]")),

  cloudAuthPanel: document.querySelector("#cloudAuthPanel"),
  cloudAccessCodeSection: document.querySelector("#cloudAccessCodeSection"),
  cloudAuthEmail: document.querySelector("#cloudAuthEmail"),
  cloudAuthPassword: document.querySelector("#cloudAuthPassword"),
  cloudEmailField: document.querySelector("#cloudEmailField"),
  cloudPasswordField: document.querySelector("#cloudPasswordField"),
  cloudAuthActions: document.querySelector("#cloudAuthActions"),
  cloudSignUpButton: document.querySelector("#cloudSignUpButton"),
  cloudSignInButton: document.querySelector("#cloudSignInButton"),
  cloudSignOutButton: document.querySelector("#cloudSignOutButton"),
  cloudAuthStatus: document.querySelector("#cloudAuthStatus"),
  cloudSessionBadge: document.querySelector("#cloudSessionBadge"),
  cloudSessionCard: document.querySelector("#cloudSessionCard"),
  cloudSessionEmail: document.querySelector("#cloudSessionEmail"),
  cloudPasswordPanel: document.querySelector("#cloudPasswordPanel"),
  cloudPasswordPanelTitle: document.querySelector("#cloudPasswordPanelTitle"),
  cloudNewPassword: document.querySelector("#cloudNewPassword"),
  cloudNewPasswordConfirm: document.querySelector("#cloudNewPasswordConfirm"),
  cloudSetPasswordButton: document.querySelector("#cloudSetPasswordButton"),
  cloudPasswordStatus: document.querySelector("#cloudPasswordStatus"),
  cloudAccessToken: document.querySelector("#cloudAccessToken"),
  cloudTesterStatus: document.querySelector("#cloudTesterStatus"),
  cloudTesterSignupButton: document.querySelector("#cloudTesterSignupButton"),
  cloudTesterSignupPanel: document.querySelector("#cloudTesterSignupPanel"),
  cloudTesterSignupGridName: document.querySelector("#cloudTesterSignupGridName"),
  cloudTesterSignupEmail: document.querySelector("#cloudTesterSignupEmail"),
  cloudTesterSignupSubmitButton: document.querySelector("#cloudTesterSignupSubmitButton"),
  cloudTesterSignupCancelButton: document.querySelector("#cloudTesterSignupCancelButton"),
  cloudTesterSignupStatus: document.querySelector("#cloudTesterSignupStatus"),
  cloudTesterSignupCompletePanel: document.querySelector("#cloudTesterSignupCompletePanel"),
  cloudTesterSignupCompleteTitle: document.querySelector("#cloudTesterSignupCompleteTitle"),
  cloudTesterSignupCompleteMessage: document.querySelector("#cloudTesterSignupCompleteMessage"),
  cloudTesterSignupCompleteCloseButton: document.querySelector("#cloudTesterSignupCompleteCloseButton"),
  cloudConnectButton: document.querySelector("#cloudConnectButton"),
  cloudLastFetched: document.querySelector("#cloudLastFetched"),

  cloudStatuses: Array.from(document.querySelectorAll("[data-cloud-status]")),
};

const ICON_NAMESPACE = "http://www.w3.org/2000/svg";
function createIcon(name) {
  const icon = document.createElementNS(ICON_NAMESPACE, "svg");
  icon.classList.add("ui-icon");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(ICON_NAMESPACE, "use");
  const href = "#icon-" + name;
  use.setAttribute("href", href);
  use.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  icon.append(use);
  return icon;
}
const state = {
  version: 3,
  language: JA_LANGUAGE,
  distanceUnit: METRIC_UNIT,
  mapProvider: MAP_PROVIDER_GOOGLE,
  points: [],
  pointLists: [],
  activePointListId: DEFAULT_POINT_LIST_ID,
  favoriteListIds: new Set(),
  storageListSectionCollapsed: {},
  pointDestinationListId: null,

  pointTransferDestinationListId: "",
  pendingPointTransferMode: null,
  pendingGeometryDestination: null,
  pendingStorageTransfer: null,
  cloud: {
    connected: false,
    authConfigured: false,
    authClient: null,
    authSession: null,
    authUser: null,
    passwordRecoveryActive: false,
    signupPasswordSetupActive: false,
    testerSignupComplete: false,
    testerCode: "",
    testerActive: false,
    testerError: "",
    canUseMine: false,
    authBusy: false,
    authPending: false,
    busy: false,
    apiUrl: "",
    lists: [],
    pointLists: [],
    pointRows: [],
    shares: [],
    lastFetchedAt: 0,
    lastAutoRefreshAt: 0,
    hiddenListIds: new Set(),
    testerSharedListIds: new Set(),
    listOrder: [],
  },
  transientAnalysisIds: new Set(),
  mode: "inspect",
  mobilePage: "map",
  mobileGridPage: "grid",
  mobilePointPreviewStorageId: null,
  pointInfoReturnContext: null,
  pointInfoTargetId: null,
  pointInfoReturnPhase: null,
  gridPointQuickPointId: null,
  gridPointQuickStoneId: null,
  gridBarrierStoneQuickStoneId: null,
  gridLinkQuickLinkId: null,
  gridFigureQuickFigureId: null,
  gridFigureQuickVertexIndex: null,
  gridFigureQuickBarrierId: null,
  kekkaishiStatusAnimation: {
    frameId: null,
    current: null,
    target: null,
    startedAt: null,
    lastPainted: ""
  },
  gridLinkColorLinkId: null,
  gridPointHoverPointId: null,
  pointInfoBackdropClickPending: false,
  pointInfoBackdropClickSuppressed: false,
  selection: [],
  selectedPointId: null,
  selectedLinkId: null,
  selectedFigureId: null,
  pendingLinkPointId: null,
  routeSelectionIds: [],
  routeStartPointId: null,
  routeStartSnapshot: null,
  routeReturnToStart: true,
  routeResult: null,
  targetPointId: null,
  observationStartId: null,
  observationTargetId: null,
  observationStart: null,
  observationTrail: [],
  loadedObservations: [],
  traverseMode: false,
  kekkaiTesterEnabled: false,
  traverseLog: null,
  barrierSelection: [],
  selectedBarrierId: null,
  barrierFitStage: "all",
  barrierPlacementView: false,
  barrierPinMode: false,
  barrierPinTarget: null,
  barrierDissolveMode: false,
  barrierLinkingMode: false,
  barrierLinkPath: [],
  barrierLinkCandidateStoneId: null,
  barrierLinkPendingStoneId: null,
  barrierLinkPendingStartedAt: null,
  barrierLinkPendingDurationMs: null,
  barrierLinkHoldFrameId: null,
  barrierLinkSettledDiamonds: [],
  barrierLinkDiamondAnimations: [],
  barrierLinkDiamondFrameId: null,
  barrierLinkCompletion: null,
  barrierLinkError: null,
  barrierLinkErrorTimerId: null,
  barrierLinkPreview: false,
  barrierLinkSourceSelection: [],
  barrierStoneGlyphMode: new Set(),
  traverseQuantityAction: null,
  traverseQuantityTargetTileId: null,
  traverseQuantityTemporaryGeo: null,
  traverseQuantity: 1,
  traverseQuantityMax: 1,
  traversePlaceViewSnapshot: null,
  traverseBusy: false,
  dragonEye: {
    active: false,
    shape: null,
    center: null,
    radius: 0,
    rotation: 0,
    scatter: 0,
    rankIndex: 0,
    rankName: null,
    perimeterLimitKm: 0
  },
  editingPointId: null,
  pendingGeo: null,
  gpsEnabled: false,
  deviceHeading: null,
  movementHeading: null,
  deviceHeadingListening: false,
  deviceHeadingPermissionRequested: false,
  lastLocationUpdateAt: null,
  lastLocationError: null,
  followCurrentLocation: false,
  screenFollowCurrentLocation: false,
  screenFollowCurrentLocationAt100m: false,
  locationWatchId: null,
  locationFollowFillForm: false,
  locationFollowScaleMode: FOLLOW_SCALE_MANUAL,
  projection: {
    mode: "local",
    centerGeo: DEFAULT_GEO,
    version: 1
  },
  viewport: {
    x: DEFAULT_CENTER.x,
    y: DEFAULT_CENTER.y,
    scale: 0.7
  },
  pointer: createPointerGestureState()
};

let appToastTimerId = 0;
let pendingConfirmResolve = null;
let pendingTraverseModeToggle = null;
let pendingTextInputResolve = null;
let pendingTextInputOptions = null;
let pointSubmitInFlight = null;
let activeStorageListDrag = null;
let activePointIndexDrag = null;
let atlasModePressTimerId = 0;
let atlasModePressPointerId = null;
let atlasModePressTitle = null;
let atlasModeLongPressTriggered = false;

Object.defineProperty(state, "links", {
  configurable: true,
  get() {
    return listedAnalysisItems("lines");
  },
  set(value) {
    replaceListedAnalysisItems("lines", value);
  }
});

Object.defineProperty(state, "figures", {
  configurable: true,
  get() {
    return listedAnalysisItems("figures");
  },
  set(value) {
    replaceListedAnalysisItems("figures", value);
  }
});

const ANALYSIS_OWNER_LIST_ID = Symbol("analysisOwnerListId");

function markAnalysisOwner(item, listId) {
  if (!item || !listId) return item;
  Object.defineProperty(item, ANALYSIS_OWNER_LIST_ID, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: listId
  });
  return item;
}

function analysisOwnerListId(item) {
  return typeof item?.[ANALYSIS_OWNER_LIST_ID] === "string" ? item[ANALYSIS_OWNER_LIST_ID] : "";
}

function listedAnalysisItems(kind) {
  return state.pointLists.flatMap((list) => (
    (Array.isArray(list[kind]) ? list[kind] : []).map((item) => markAnalysisOwner(item, list.id))
  ));
}

function activeAnalysisPointList() {
  ensurePointLists();
  const active = state.pointLists.find((list) => list.id === state.activePointListId && list.editable);
  return active || state.pointLists.find((list) => list.editable) || createLocalPointList();
}

function analysisDestinationList(item) {
  if (item?.layer === "barrier" || item?.barrierId) return kekkaiPointList();
  const owned = state.pointLists.find((list) => list.id === analysisOwnerListId(item));
  return owned || activeAnalysisPointList();
}

function replaceListedAnalysisItems(kind, values) {
  const previousOwners = new Map(listedAnalysisItems(kind).map((item) => [item.id, analysisOwnerListId(item)]));
  for (const list of state.pointLists) list[kind] = [];
  for (const item of Array.isArray(values) ? values : []) {
    if (!item) continue;
    const ownerId = analysisOwnerListId(item) || previousOwners.get(item.id);
    const destination = state.pointLists.find((list) => list.id === ownerId) || analysisDestinationList(item);
    if (!destination) continue;
    destination[kind].push(markAnalysisOwner(item, destination.id));
  }
}

function appendListedAnalysisItem(kind, item, list = analysisDestinationList(item)) {
  if (!item || !list) return null;
  if (!Array.isArray(list[kind])) list[kind] = [];
  list[kind].push(markAnalysisOwner(item, list.id));
  return item;
}

function isVisibleAnalysisItem(item) {
  const list = state.pointLists.find((candidate) => candidate.id === analysisOwnerListId(item));
  return Boolean(list && list.visible !== false && (!state.traverseMode || list.reservedKind === "kekkai"));
}

const CANVAS_PALETTES = {
  pastel: {
    gridMinor: "#f2dce6",
    gridMajor: "#dda7bd",
    link: "#5e9f9a",
    linkSelected: "#6f9b78",
    route: "#8f7cbd",
    target: "#e8907e",
    targetSoft: "rgb(232 144 126 / 0.2)",
    targetGuide: "rgb(124 108 131 / 0.72)",
    targetFill: "#e8907e",
    observationBaseline: "rgb(197 111 133 / 0.34)",
    observationTrail: "#c56f85",
    observationGapLine: "rgb(128 128 128 / 0.72)",
    currentFill: "#f5ce6a",
    currentStale: "#a68f85",
    pendingFill: "rgb(216 111 155 / 0.22)",
    pendingStroke: "rgb(216 111 155 / 0.62)",
    pointFill: "#d86f9b",
    pointBaseStroke: "#fffafd",
    routeStart: "#6d9bc3",
    routeSelected: "#9b8bc7",
    pendingPointStroke: "#5e9f9a",
    traverseFill: "#5e9f9a",
    barrierCell: "#4d9bd8",
    barrierCellSelected: BARRIER_LINK_ORANGE,
    selected: "#9f4772",
    badgeFill: "#fffafd",
    badgeText: "#67548f",
    badgeStartFill: "#8f7cbd",
    badgeStartText: "#ffffff"
  },
  retro: {
    gridMinor: "rgb(44 255 100 / 0.14)",
    gridMajor: "rgb(69 255 124 / 0.36)",
    link: "#29ff68",
    linkSelected: "#d6ffe0",
    route: "#7dff9b",
    target: "#ff8a1c",
    targetSoft: "rgb(255 138 28 / 0.18)",
    targetGuide: "rgb(214 255 224 / 0.62)",
    targetFill: "#ff8a1c",
    observationBaseline: "rgb(214 255 224 / 0.28)",
    observationTrail: "#fff35a",
    observationGapLine: "rgb(128 128 128 / 0.72)",
    currentFill: "#fff35a",
    currentStale: "#9db4a3",
    pendingFill: "rgb(44 255 100 / 0.18)",
    pendingStroke: "rgb(119 255 153 / 0.72)",
    pointFill: "#23ff5e",
    pointBaseStroke: "#020806",
    routeStart: "#2ddfff",
    routeSelected: "#8dffaa",
    pendingPointStroke: "#d6ffe0",
    traverseFill: "#29ff68",
    barrierCell: "#4db7ef",
    barrierCellSelected: BARRIER_LINK_ORANGE,
    selected: "#ffffff",
    badgeFill: "#020806",
    badgeText: "#d6ffe0",
    badgeStartFill: "#2cff64",
    badgeStartText: "#020806"
  },
  basic: {
    gridMinor: "#d9d2c2",
    gridMajor: "#9eb3bd",
    link: "#0f8b8d",
    linkSelected: "#2563eb",
    route: "#7c5eb6",
    target: "#dc2626",
    targetSoft: "rgb(220 38 38 / 0.16)",
    targetGuide: "rgb(36 49 58 / 0.58)",
    targetFill: "#dc2626",
    observationBaseline: "rgb(135 104 94 / 0.32)",
    observationTrail: "#b45309",
    observationGapLine: "rgb(128 128 128 / 0.72)",
    currentFill: "#f59e0b",
    currentStale: "#8b8176",
    pendingFill: "rgb(37 99 235 / 0.16)",
    pendingStroke: "rgb(37 99 235 / 0.58)",
    pointFill: "#2563eb",
    pointBaseStroke: "#fffaf0",
    routeStart: "#0f766e",
    routeSelected: "#7c3aed",
    pendingPointStroke: "#0f8b8d",
    traverseFill: "#0f8b8d",
    barrierCell: "#4d9bd8",
    barrierCellSelected: BARRIER_LINK_ORANGE,
    selected: "#111827",
    badgeFill: "#fffaf0",
    badgeText: "#24313a",
    badgeStartFill: "#2563eb",
    badgeStartText: "#ffffff"
  },
  kekkai: {
    gridMinor: "rgb(126 75 170 / 0.12)",
    gridMajor: "rgb(180 125 210 / 0.38)",
    link: "#8f5ca9",
    linkSelected: "#d8c5e2",
    route: "#b78bc9",
    target: "#ff9fce",
    targetSoft: "rgb(255 159 206 / 0.2)",
    targetGuide: "rgb(240 217 255 / 0.68)",
    targetFill: "#ff9fce",
    observationBaseline: "rgb(240 217 255 / 0.3)",
    observationTrail: "#ffd166",
    observationGapLine: "rgb(128 128 128 / 0.72)",
    currentFill: "#ffd166",
    currentStale: "#b6a0c4",
    pendingFill: "rgb(196 132 255 / 0.2)",
    pendingStroke: "rgb(232 195 255 / 0.78)",
    pointFill: "#a85dcc",
    pointBaseStroke: "#050207",
    routeStart: "#65e0ff",
    routeSelected: "#e1b7ff",
    pendingPointStroke: "#f0d9ff",
    traverseFill: "#a85dcc",
    barrierCell: "#4d9bd8",
    barrierCellSelected: BARRIER_LINK_ORANGE,
    selected: "#ffffff",
    badgeFill: "#050207",
    badgeText: "#f0d9ff",
    badgeStartFill: "#c884ff",
    badgeStartText: "#160c22"
  }
};

const TRANSLATIONS = {
  ja: {
    "settings.title": "設定",
    "settings.menu": "メニュー",
    "settings.openGridAtlas": ".gridatlasを開く",
    "settings.design": "デザイン",
    "settings.language": "言語",
    "settings.units": "距離単位",
    "settings.gps": "GPS機能を使用",
    "settings.mapProvider": "地図サービス",
    "settings.mapGoogle": "Googleマップ",
    "settings.mapApple": "Appleマップ",
    "settings.themeBasic": "ベーシック",
    "settings.themePastel": "パステル",
    "settings.themeRetro": "レトロ",
    "settings.languageJa": "日本語",
    "settings.languageEn": "English",
    "settings.unitsMetric": "km",
    "settings.unitsImperial": "mile",
    "systemUpdate.label": "システム更新",
    "systemUpdate.action": "更新",
    "systemUpdate.notice": "最新版を確認して更新します。",
    "systemUpdate.version": "WEB版",
    "systemUpdate.checking": "更新を確認しています…",
    "systemUpdate.applying": "更新を適用しています…",
    "systemUpdate.latest": "最新版です。",
    "systemUpdate.reloading": "更新しました。再読み込みします…",
    "systemUpdate.unsupported": "この環境ではシステム更新を利用できません。",
    "systemUpdate.failed": "更新を確認できませんでした。通信状態を確認してください。",
    "edition.web": "WEB版",
    "page.analysis": "分析",
    "page.data": "データ",
    "page.grid": "グリッド",
    "page.points": "地点",
    "page.lists": "リスト",
    "summary.selected": "選択中",
    "summary.info": "情報",
    "mobileOverview.selection": "選択地点",
    "mobileOverview.displayed": "表示地点",
    "mobileOverview.selected": "選択地点",
    "mobileOverview.distance": "距離",
    "mobileOverview.distanceType": "距離種別",
    "mobileOverview.firstSelection": "初回選択",
    "mobileOverview.lastSelection": "最終選択",
    "state.unselected": "未選択",
    "state.noPoints": "地点なし",
    "action.register": "登録",
    "action.connect": "接続",
    "action.center": "中心",
    "action.clear": "解除",
    "action.start": "起点",
    "action.target": "対象",
    "action.track": "追跡",
    "action.route": "巡回",
    "action.analyze": "分析",
    "action.analyzeTitle": "選択した線分・図形を分析",
    "action.traverse": "結界",
    "action.barrier": "結界を張る",

    "action.cancel": "キャンセル",
    "traverse.bottomCancel": "やめる",
    "traverse.bottomClear": "選択解除",
    "traverse.bottomPlace": "この形で置く",
    "traverse.bottomUndo": "1本もどる",
    "traverse.bottomMake": "結界にする",
    "traverse.bottomDissolve": "解く",
    "traverse.bottomConfirm": "確定",
    "action.done": "決定",
    "action.apply": "適用",
    "action.copyToList": "コピー",
    "action.moveToList": "移動",
    "action.share": "共有",
    "action.shareSelected": "共有",
    "action.shareSelectedTitle": "選択した地点・線・図形を共有",
    "action.invert": "反転",
    "action.invertTitle": "表示中の地点の選択を反転",
    "action.info": "情報",
    "action.delete": "削除",
    "delete.linksOnly": "線分",
    "delete.pointsOnly": "地点",
    "delete.figuresOnly": "図形",
    "delete.all": "すべて",
    "delete.uneditablePoints": "選択した地点のうち{count}点は編集できないリストに含まれるため削除できません。",
    "action.edit": "編集",
    "action.rename": "命名",
    "action.memo": "メモ",
    "action.map": "地図",
    "section.pointSource": "地点取得",
    "button.clipboard": "クリップボード",
    "button.currentLocation": "現在地",
    "import.drop.title": ".gridatlasを読み込み",
    "import.drop.description": "この画面にドロップしてください",
    "import.gridatlas.success": "{count}件のスポットリストを読み込みました",
    "import.gridatlas.urlSuccess": "リンクからスポットリストを読み込みました",
    "import.gridatlas.presetSuccess": "紹介用プリセット「{name}」を読み込みました",
    "import.gridatlas.error": "スポットリストを読み込めませんでした",
    "button.submitRegister": "登録",
    "button.update": "更新",
    "button.appleMaps": "Appleマップ",
    "button.googleMaps": "Googleマップ",
    "button.setTarget": "ターゲットにする",
    "button.clearTarget": "ターゲット解除",
    "button.setStart": "起点にする",
    "button.clearStart": "起点解除",
    "button.stopTracking": "追跡を停止",
    "button.optimize": "最適順",
    "button.clear": "解除",
    "panel.register": "地点登録",
    "panel.details": "選択地点",
    "panel.multiSelect": "複数選択",
    "panel.selectedLine": "選択線",
    "panel.observationResult": "観察結果",
    "panel.analysis": "分析",
    "panel.route": "巡回ルート",
    "panel.data": "データ",
    "panel.points": "地点一覧",
    "panel.lists": "リスト一覧",
    "field.title": "見出し",
    "field.lat": "緯度",
    "field.lng": "経度",
    "field.photo": "写真",
    "field.note": "コメント",
    "list.destination": "登録先リスト",
    "list.newOption": "新しいリスト",
    "list.nameRequired": "リスト名を入力してください",
    "list.movedPoint": "「{name}」へ地点を移動しました",
    "field.coords": "緯度経度",
    "field.created": "登録",
    "field.count": "件数",
    "field.order": "順序",
    "field.operation": "操作",
    "field.name": "名前",
    "field.actualDistance": "実距離",
    "field.record": "記録",
    "field.result": "結果",
    "field.line": "線",
    "field.distance": "距離",
    "field.endpoints": "端点",
    "info.dialogTitle": "地点情報",
    "info.summary": "選択地点",
    "info.displayTarget": "表示地点",
    "info.other": "その他情報",
    "info.list": "リスト",
    "info.updated": "更新",
    "info.distanceFromCurrent": "現在地から",
    "info.noPhoto": "写真なし",
    "info.noComment": "コメントなし",
    "info.unavailable": "選択地点の情報を表示できません",
    "line.infoTitle": "線の情報",
    "line.deleteConfirm": "この線を削除しますか？",
    "line.deleted": "線を削除しました",
    "line.color": "色",
    "line.colorTitle": "線の色を変更",
    "line.colorMessage": "色を適用する範囲を選択してください。",
    "line.colorScope": "適用範囲",
    "line.colorSegment": "この線分だけ",
    "line.colorShape": "同じ図形全体（{count}本）",
    "line.colorNoShape": "この線分は図形に属していません",
    "line.colorApplied": "線の色を変更しました",
    "line.closeShapeTitle": "図形を閉じますか？",
    "line.closeShapeMessage": "3地点以上が選択されています。最後の地点から起点へ接続して図形を閉じますか？",
    "line.destinationTitle": "図形の格納先を選択",
    "line.destinationMessage": "複数のリストから地点を選択しています。線分と図形を格納するリストを選択してください。",
    "line.destinationLabel": "図形の格納先リスト",
    "line.destinationEmpty": "格納先にできるリストがありません。",
    "line.connected": "{count}本の線分を接続しました",
    "line.alreadyConnected": "選択した地点は、このリストではすでに接続されています",
    "line.dragStatus": "接続先を変更中：{name} にドロップ",
    "line.reconnected": "「{old}」を「{new}」へ接続変更しました",
    "line.invalidTarget": "別の地点へドロップしてください",
    "line.duplicateTarget": "その2地点を結ぶ線はすでにあります",
    "figure.deleteVertex": "この頂点を削除",
    "figure.delete": "図形を削除",
    "figure.vertexCount": "{count}頂点",
    "figure.vertexDeleted": "図形の頂点を削除しました",
    "figure.deleteConfirm": "この図形を削除しますか？",
    "figure.deleteVertexConfirm": "この頂点を削除しますか？",
    "barrier.dissolve": "結界を解く",
    "barrier.dissolveConfirm": "この結界を解きますか？結界石はその場に残ります。",
    "barrier.dissolved": "結界を解きました",
    "analysis.dialogTitle": "分析結果",
    "analysis.lineTitle": "交差角",
    "analysis.polygonTitle": "図形の分析",
    "analysis.noSelection": "2本以上の線分を選択してください",
    "analysis.lineHint": "2本の線分の分析結果を表示します。",
    "analysis.polygonHint": "図形の分析結果を表示します。",
    "analysis.measurementDeclaration": "図形: {shape}",
    "analysis.measurementBasis": "{shape} · 内角 {angle} · 対角÷辺 {ratio}",
    "analysis.figure": "図形",
    "analysis.selfIntersectionLabel": "自己交差",
    "analysis.selfIntersectionYes": "あり",
    "analysis.selfIntersectionNo": "なし",
    "analysis.shapeClosed": "閉じた線分群",
    "analysis.shapeOpen": "閉じた線分群として測定できません",
    "analysis.shapeOpenHint": "3本以上の選択線が、各地点で2本ずつ接続する閉路になっている必要があります。",
    "analysis.pathTitle": "直線度分析",
    "analysis.pathHint": "開いた経路を、等間隔に並ぶ直線として測定します。",
    "analysis.pathDeclaration": "直線として測りました（開いた経路・{vertices}地点／線{edges}本）",
    "analysis.pathBasis": "基準は等間隔に並んだ{vertices}地点。大円（測地線）上で測っています",
    "analysis.pathNotScreen": "画面上の直線ではありません",
    "analysis.pathDeviation": "直線からのずれ",
    "analysis.spacingVariation": "間隔のばらつき",
    "analysis.averageDeviation": "平均",
    "analysis.maximumDeviation": "最大",
    "analysis.endpointDistance": "端点間距離",
    "analysis.pathLengthRatio": "経路長 ÷ 端点間距離",
    "analysis.bearing": "方位角",
    "analysis.farthestPoint": "最も外れた地点",
    "analysis.screenLineBasis": "画面上の直線（等角航路）を基準にすると",
    "analysis.foldedPath": "経路が折り返しています",
    "analysis.twoPointStraight": "2地点は必ず一直線です",
    "analysis.pathUnavailable": "開いた単純経路として測定できません",
    "analysis.polygonKicker": "測定対象",
    "analysis.generalTitle": "基本情報",
    "analysis.shapeFeaturesTitle": "形状の特徴",
    "analysis.resultTitle": "結果",
    "analysis.comparisonTitle": "比較基準",
    "analysis.reference": "参考値",
    "analysis.referenceScore": "参考整い度",
    "analysis.regularityScore": "整い度",
    "analysis.referenceScoreDefinition": "整い度は、基準形に対する角度と辺長のそろい方を0〜100で示す参考値です。",
    "analysis.copy": "結果をコピー",
    "analysis.copied": "分析結果をコピーしました",
    "analysis.copyFailed": "コピーできませんでした",
    "analysis.copyUnavailable": "このブラウザではコピーできません",
    "analysis.intersection": "交差点",
    "analysis.angle": "角度",
    "analysis.segment": "線分",
    "analysis.notCrossing": "線分同士は交差していません",
    "analysis.parallel": "平行な線分です",
    "analysis.collinear": "同一直線上の線分です",
    "analysis.extension": "延長線上では交わりますが、線分の範囲外です",
    "analysis.score": "近似度",
    "analysis.shape": "形状",
    "analysis.sides": "辺の長さ",
    "analysis.sideBalance": "辺のそろい方",
    "analysis.angleBalance": "角のそろい方",
    "analysis.idealAngle": "理想の内角",
    "analysis.meanSide": "平均辺長",
    "analysis.perimeter": "周長",
    "analysis.perimeterDisplay": "周囲長",
    "analysis.area": "面積",
    "analysis.vertexCount": "頂点数",
    "analysis.edgeCount": "辺数",
    "analysis.longestSide": "最長辺",
    "analysis.shortestSide": "最短辺",
    "analysis.areaUnavailable": "自己交差する図形のため、面積は算出していません。",
    "analysis.areaUnavailableShort": "算出不可",
    "analysis.sideVariation": "辺のばらつき",
    "analysis.angleVariation": "角のばらつき",
    "analysis.maxAngleDeviation": "角度の最大ずれ",
    "analysis.angleDeviationRate": "基準角に対する割合",
    "analysis.referenceDiagonalRatio": "基準 対角÷辺",
    "analysis.vertex": "頂点",
    "analysis.veryClose": "とても近い",
    "analysis.close": "近い",
    "analysis.somewhatDifferent": "やや異なる",
    "analysis.different": "差があります",
    "analysis.regularTriangle": "正三角形",
    "analysis.square": "正方形",
    "analysis.regularPentagon": "正五角形",
    "analysis.regularPolygon": "正{n}角形",
    "analysis.selfCrossingPolygon": "自己交差する{n}角形",
    "analysis.starPolygon": "正{n}芒星",
    "analysis.coordinates": "緯度経度",
    "metric.points": "地点",
    "metric.links": "線",
    "metric.total": "合計",
    "metric.longest": "最長",
    "route.startPoint": "スタート地点",
    "route.returnToStart": "最後にスタート地点へ戻る",
    "route.summaryDefault": "地点を選んで巡回を押す",
    "route.needStart": "起点を指定して2点以上選択",
    "route.needTwo": "2点以上を選択すると巡回を実行",
    "route.ready": "巡回で最適順を計算",
    "route.exact": "厳密",
    "route.heuristic": "近似",
    "route.return": "戻る",
    "route.total": "合計",
    "route.start": "スタート",
    "route.fromPrevious": "前地点から",
    "route.toStart": "スタートへ",
    "data.pointLists": "地点リスト",
    "data.cloud": "マイリスト（クラウド）",
    "data.grid": "グリッド",
    "cloud.menuTitle": "クラウド",
    "cloud.open": "ログイン設定",
    "cloud.authTitle": "ログイン設定",
    "cloud.email": "メールアドレス（ID）",
    "cloud.password": "パスワード",
    "cloud.signUp": "登録",
    "cloud.signIn": "ログイン",
    "cloud.signOut": "ログアウト",
    "cloud.accessCodeAdvanced": "テスター権限",
    "cloud.experimental": "実験機能",
    "cloud.dataNotice": "接続中のマイリスト（クラウド）です。",
    "cloud.pointSource": "マイリスト（クラウド）",
    "cloud.apiUrl": "Cloud API URL",
    "cloud.accessToken": "アクセスコード",
    "cloud.testerCode": "テスター権限コード",
    "cloud.authenticate": "認証",
    "cloud.connect": "接続",
    "cloud.testerGranted": "テスター権限あり",
    "cloud.testerSignup": "個別IDを設定",
    "cloud.testerSignupTitle": "個別IDの設定",
    "cloud.gridName": "表示名（ニックネーム）",
    "cloud.sendConfirmation": "アカウント設定メールを送信",
    "cloud.close": "閉じる",
    "cloud.sharesTitle": "発行済みリンク",
    "cloud.refresh": "更新",
    "cloud.disconnect": "切断",
    "cloud.neverFetched": "まだクラウドを確認していません",
    "cloud.lastFetched": "最終確認 {time}",
    "cloud.advanced": "接続設定",
    "cloud.localList": "クラウドへ移動する端末内リスト",
    "cloud.save": "マイリスト（クラウド）として保存",
    "cloud.delete": "マイリスト（クラウド）から削除",
    "cloud.empty": "マイリスト（クラウド）なし",
    "storage.notice": "テスターは、端末内・マイリスト（クラウド）・共有リスト（テスター間実験）の間でリストを移動またはコピーできます。",
    "storage.location": "保存場所",
    "storage.device": "端末",
    "storage.cloud": "クラウド",
    "storage.both": "端末＋クラウド",
    "storage.cloudReadProgress": "クラウド読込中",
    "storage.cloudOperationProgress": "クラウド操作中",
    "storage.processingProgress": "処理しています",
    "storage.moveCloud": "クラウド保管へ移動",
    "storage.move": "移動",
    "storage.moveDevice": "端末に移動",
    "storage.connectFirst": "先にクラウドへ接続してください",
    "storage.importMoveOnly": "インポートリストは、個別の転送操作でマイリストへ移動またはコピーできます。",
    "storage.dragHint": "リストをタップするとグリッド表示をオン／オフできます。長押しすると地点一覧を表示します。少し長押ししてからドラッグすると、移動先を選んで移動またはコピーできます。",
    "storage.dragReordering": "クラウドに並び順を保存中",
    "storage.dragReordered": "リストの順番を変更しました",
    "storage.dragMoveCloud": "クラウド保管へ移動",
    "storage.dragMoveDevice": "端末へ移動",
    "storage.transferTitle": "リストの移動／コピー",
    "storage.transferHint": "「{name}」を{target}へ移動またはコピーします。",
    "storage.transferDestinationLabel": "コピー／移動先のリスト枠",
    "storage.transferSelectTarget": "「{name}」のコピー／移動先のリスト枠を選択してください。",
    "storage.transferTargetSelected": "「{target}」を選択中です。移動またはコピーを押してください。",
    "storage.transferNoTarget": "コピー／移動できるリスト枠がありません。",
    "storage.transferFrameCount": "{count}リスト",
    "storage.transferMove": "移動",
    "storage.transferCopy": "コピー",
    "storage.dragImportedDestination": "インポートリストはコピー先・移動先にできません。",
    "storage.targetMineDevice": "マイリスト（端末内）",
    "storage.targetMineCloud": "マイリスト（クラウド）",
    "storage.targetTesterShared": "共有リスト（テスター間実験）",
    "list.new": "新規",
    "list.selectAll": "全選択",
    "list.selectAllTitle": "すべてのリストをグリッドに表示",
    "list.clearAll": "全解除",
    "list.clearAllTitle": "すべてのリストをグリッドから非表示",
    "list.newPrompt": "新しいリストの名前",
    "list.created": "新しいリストを作成し、登録先にしました",
    "list.active": "地点登録先",
    "list.syncEnable": "クラウドへ移動",
    "list.syncDisable": "端末へ移動",
    "list.copy": "コピー",
    "list.export": "共有",
    "list.exportDialogTitle": "共有の確認",
    "list.exportPrivacy": "地点名・緯度経度・コメント・保存済み画像を含みます。選択共有では選択した線・図形も含みます。",
    "list.exportConfirm": "このリストを共有しますか？",
    "list.exportSummary": "「{name}」の{count}点",
    "list.exported": "共有ファイルを保存しました",
    "list.exportCompleted": "共有しました",
    "list.exportFailed": "共有ファイルを作成できませんでした。リスト内容を確認してください",
    "list.exportImage": "画像",
    "list.exportImageShared": "画像を共有しました",
    "list.exportImageDownloaded": "画像を保存しました",
    "list.exportCloud": "短縮URL",
    "list.exportCloudCreated": "短縮URLをコピーしました",
    "list.shareSelectedNamePrompt": "共有するリスト名",
    "list.shareSelectedDefaultName": "選択項目",
    "list.shareSelectedUnavailable": "共有する地点・線・図形を選択してください",
    "list.shareUnavailable": "共有できるリストデータがありません",
    "list.edit": "編集",
    "list.rename": "リスト名を変更",
    "list.renamePrompt": "新しいリスト名",
    "list.transfer": "リストをコピー／移動",
    "list.setHome": "地点登録先に設定",
    "list.unsetHome": "地点登録先の設定を解除",
    "list.destinationLocked": "地点登録先に設定されています",
    "list.favorite": "お気に入り",
    "list.addFavorite": "お気に入りに追加",
    "list.removeFavorite": "お気に入りから外す",
    "list.favoriteStatus": "お気に入り",
    "list.delete": "削除",
    "list.showOnGrid": "グリッドに表示",
    "list.selectOnGrid": "このリストを選択してグリッド表示",

    "list.visible": "グリッド表示中",
    "list.hidden": "グリッドで非表示",

    "list.transferNoSelection": "別のリストへ移せる地点を選択してください",
    "list.transferSelectDestination": "コピー／移動先を選択してください",

    "list.transferDialogCopyTitle": "コピー先を選択",
    "list.transferDialogMoveTitle": "移動先を選択",
    "list.transferDialogHint": "登録済みリストから選択するか、新しいリストを作成できます。",
    "list.transferDialogNew": "新しいリストを作成",
    "list.transferDialogEmpty": "選択できるリストがありません",
    "list.copiedPoints": "「{name}」へ{count}地点をコピーしました",
    "list.movedPoints": "「{name}」へ{count}地点を移動しました",
    "list.section.mineDevice": "マイリスト（端末内）",
    "list.section.mineCloud": "マイリスト（クラウド）",
    "list.section.testerShared": "共有リスト（テスター間実験）",
    "list.section.imported": "インポートリスト",

    "list.none": "リストなし",
    "status.grid": "格子",
    "status.rangeSelect": "範囲選択中",
    "label.points": "点",
    "label.links": "線",
    "label.observations": "観察",
    "label.selected": "選択",
    "label.sequence": "選択順",
    "label.linkTotal": "線合計",
    "label.betweenTwo": "2点間",
    "label.fromCurrent": "現在地から",
    "label.accuracy": "精度",
    "label.gps": "GPS",
    "label.none": "なし",
    "message.loadedObservation": "読み込み観察",
    "message.pointUnavailable": "地点を確認できません",
    "message.linkUnavailable": "線を確認できません",
    "message.quickHint": "接続、リスト間コピー／移動、共有、巡回、削除、解除をクイックボタンで実行できます。",
    "message.mapRouteHint": "地図では選択順に、出発地 → 経由地 → 目的地としてルート検索します",
    "message.currentLocation": "現在地",
    "message.lastObservedLocation": "最終観測位置",
  "traverse.noLocation": "現在地を取得してから結界石を操作してください",
    "traverse.gpsUnavailable": "この端末では現在地を取得できません",
    "traverse.accuracyError": "位置情報の精度が低いため、結界石を操作できません",
    "traverse.stockEmpty": "置ける結界石がありません",
    "traverse.noStone": "このタイルに結界石がありません",
    "traverse.stockLabel": "結界石 {amount} / {cap}",
    "kekkaiTester.toggle": "結界テスターをONにする",
    "kekkaiTester.hint": "仮ポイントへ置く / 結界石の保有 ♾️",
    "kekkaiTester.enabled": "結界テスターをONにしました",
    "kekkaiTester.disabled": "結界テスターをOFFにしました",
    "traverse.stoneTile": "結界石タイル",
    "traverse.stoneCount": "石 {count}個",
    "traverse.vertex": "頂点",
    "traverse.tileMismatch": "そのタイルの位置で操作してください",
    "traverse.place": "結界石を置く",
    "traverse.pick": "結界石を拾う",
    "traverse.pinTitle": "ピンを打つ",
    "traverse.pinMessage": "見出しと登録位置を設定してください。",
    "traverse.pinTarget": "登録位置",
    "traverse.pinPending": "仮ポイント",
    "traverse.pinCurrent": "現在地",
    "traverse.pinNoTarget": "現在地を取得するか、仮ポイントを作成してからピンを打ってください",
    "traverse.pinRegistered": "ピンを登録しました",
    "traverse.vertexFitUnavailable": "頂点セルがありません",
    "traverse.placementView": "配置をみる",
    "traverse.placementViewExit": "結界メニューへ戻る",
    "traverse.connect": "結界を結ぶ",
    "traverse.cancel": "キャンセル",
    "traverse.returnTitle": "タイトルに戻る",
    "traverse.status": "ステータス",
    "traverse.menuTitle": "結界操作",
    "dragonEye.open": "龍脈眼",
    "dragonEye.title": "龍脈眼の形を選択",
    "dragonEye.message": "形を選ぶとグリッド上で移動・拡縮できます。",
    "dragonEye.rankInfo": "{rank}級 · 辺長合計上限 {perimeter} · 精度 誤差{scatter}% · 回転 {rotation}",
    "dragonEye.perimeterLimit": "辺長合計の限界（上限{perimeter}）",
      "dragonEye.rotationOn": "解放",
      "dragonEye.rotationLocked": "E級で解放",
    "dragonEye.confirm": "確定",
    "dragonEye.cancel": "解除",
    "dragonEye.triangle": "正三角形",
    "dragonEye.square": "正方形",
    "dragonEye.diamond": "ひし形",
    "dragonEye.pentagon": "正五角形",
      "dragonEye.hexagon": "正六角形",
      "dragonEye.heptagon": "正七角形",
      "dragonEye.octagon": "正八角形",
    "dragonEye.pentagram": "五芒星",
    "dragonEye.hexagram": "六芒星",
    "dragonEye.octagram": "八芒星",
    "dragonEye.octagram2": "八芒星",
      "dragonEye.secret": "シークレット",
    "dragonEye.placed": "龍脈眼を{count}地点として保存しました",
    "traverse.modeOnTitle": "結界モードに切り替えますか？",
    "traverse.modeOffTitle": "結界モードを終了しますか？",
    "traverse.modeOnMessage": "結界石の操作が有効になります。",
    "traverse.modeOffMessage": "通常モードに戻ります。",
    "traverse.modeOnConfirm": "切り替える",
    "traverse.modeOffConfirm": "終了する",
    "traverse.summary": "手持ち{stock}個 / 設置済{installed}個 / {locations}箇所",
    "traverse.stoneStatus": "結界石の状況",
    "traverse.stockShort": "手持ち",
    "traverse.installedShort": "設置済み",
    "traverse.locationsShort": "箇所",
    "traverse.quantityTitle": "個数を選択",
    "traverse.quantityMessage": "操作する個数を選んでください。",
    "traverse.quantityDecrease": "1個減らす",
    "traverse.quantityIncrease": "1個増やす",
    "traverse.linkReady": "起点の結界石からドラッグしてください",
    "traverse.linkOriginSelected": "起点を選択しました。次の結界石へドラッグしてください",
    "traverse.linkReturnHint": "起点に戻って指を離すと結界が完成します",
    "traverse.linkReturnRequired": "最後は起点に戻って指を離してください",
    "traverse.linkDwell": "結界石をなぞっています…",
    "traverse.undo": "ひとつ戻す",
    "traverse.stockFull": "結界石ストックが満タンです",
    "traverse.capReached": "このタイルの結界石は上限です",
    "traverse.barrier": "結界",
    "barrier.createTitle": "結界を結ぶ",
    "barrier.createMessage": "起点に戻ると、選択した結界石をつないで結界を結びます。",
    "barrier.nameLabel": "結界名",
    "barrier.defaultName": "新しい結界",
    "barrier.created": "結界を張りました",
    "barrier.dissolveHint": "解く結界を選択してください",
    "barrier.selectToDissolve": "結界を選択してください",
    "barrier.tooFew": "頂点が足りない！結界には3つ以上必要！",
    "barrier.needLocations": "結界を結ぶには、あと{count}箇所に結界石を置いてください。",
    "barrier.tooMany": "大きすぎる！結界師のクラスが足りない！（最大{max}頂点）",
    "barrier.rankVertexLimit": "大きすぎる！結界師のクラスが足りない！",
    "barrier.perimeterExceeded": "大きすぎる！結界師のクラスが足りない！辺長合計が上限を超えています（{perimeter} / 上限{limit}）",
    "barrier.crossLinkLocked": "交差結びはまだ使えない！結界師のクラスが足りない！（結界師のクラス{rank}で解放）",
    "barrier.stoneUsed": "その結界石は使用中！別の結界石を選んで！",
    "barrier.missingStone": "結界石が見つからない！もう一度なぞって！",
    "barrier.selection": "結界石を{count}個選択中"
    ,"barrier.scoreTitle": "結界力"
    ,"barrier.scoreDensity": "濃度"
    ,"barrier.scoreArea": "面積"
    ,"barrier.scoreStones": "実効石数 / 総石数"
    ,"barrier.scoreShape": "形状係数"
    ,"barrier.scoreBeauty": "美しさ係数"
    ,"barrier.scoreScale": "規模係数"
    ,"barrier.rankNext": "次のランク「{rank}」まで"
    ,"barrier.rankPower": "力"
    ,"barrier.rankDays": "発動日数"
    ,"barrier.daysUnit": "日"
    ,"barrier.rankMax": "最高ランク"
    ,"barrier.rankStones": "石をあと{count}個積むと届きます（配給{days}日ぶん）"
    ,"barrier.rankUnreachable": "この形では届きません（満杯でも{power}力）"
    ,"barrier.rankPowerWait": "結界力が届いてから進みます"
    ,"barrier.guardianTitle": "守護点"
    ,"barrier.guardianUnset": "未設定（重心を基準に計算）"
    ,"barrier.guardianSet": "守護点を地図で指定"
    ,"barrier.guardianChangeLabel": "ラベルを変更"
    ,"barrier.guardianRemove": "守護点を削除"
    ,"barrier.guardianPlacementHint": "地図上の守る場所をタップしてください"
    ,"barrier.guardianPlaced": "守護点を設定しました"
    ,"barrier.guardianUpdated": "守護点ラベルを更新しました"
    ,"barrier.guardianRemoved": "守護点を削除しました"
    ,"barrier.guardianLabel": "守護点ラベル"
    ,"barrier.guardianDefaultLabel": ""
    ,"barrier.guardianRemoveConfirm": "この結界の守護点を削除しますか？"
    ,"barrier.share": "画像を共有"
    ,"barrier.shared": "結界画像を共有しました"
    ,"barrier.downloaded": "結界画像をPNG保存しました"
    ,"barrier.shareFailed": "結界画像の作成に失敗しました"
    ,"barrier.shareText": "GRID ATLAS「{name}」｜{rank} {power}力 #GRIDATLAS #結界"
    ,"kekkaishi.title": "結界師ステータス"
    ,"kekkaishi.rank": "結界師ランク"
    ,"kekkaishi.achievedDays": "（{days}日で到達）"
    ,"kekkaishi.lifetime": "累積結界霊量"
    ,"kekkaishi.currentDailyPower": "現在の総結界霊量"
    ,"kekkaishi.createdCount": "作成した結界"
    ,"kekkaishi.activeCount": "発動中の結界数"
    ,"kekkaishi.next": "次のランクまで"
    ,"kekkaishi.shapesTitle": "結界術と能力"
    ,"kekkaishi.shapesHint": "使用できる結界術と、次のクラスで追加される結界術。"
    ,"kekkaishi.currentShapes": "使用できる結界術"
    ,"kekkaishi.nextShapes": "次のクラスで追加される結界術"
    ,"kekkaishi.progressTitle": "次のクラスまで"
    ,"kekkaishi.perimeterLimit": "辺長合計上限"
    ,"kekkaishi.maxVertices": "最大頂点"
    ,"kekkaishi.stoneCap": "石上限"
    ,"kekkaishi.stones": "結界石"
    ,"kekkaishi.stockCap": "保有上限"
    ,"kekkaishi.vertexCap": "頂点上限"
    ,"kekkaishi.scatter": "龍脈眼精度"
    ,"kekkaishi.scatterValue": "誤差{scatter}%"
    ,"kekkaishi.edgeGuide": "正多角形の1辺目安"
    ,"kekkaishi.progressLifetime": "累積"
    ,"kekkaishi.dailyPower": "前日の結界霊量"
    ,"kekkaishi.dailyUnit": "Pt/日"
    ,"kekkaishi.progressDays": "現在のペースであと{days}日"
    ,"kekkaishi.noDailyPower": "結界を張ると進みます"
    ,"kekkaishi.unlocks": "使用できる結界術: {shapes} / 辺長合計上限{perimeter} / 正多角形の1辺目安{edges} / 最大{vertices}頂点 / 結界石（保有上限{stock} / 頂点上限{vertex}） / 龍脈眼精度 誤差{scatter}%"
    ,"kekkaishi.nextUnlocks": "次のクラスで追加される結界術: {shapes} / 辺長合計上限{perimeter} / 正多角形の1辺目安{edges} / 最大{vertices}頂点 / 結界石（保有上限{stock} / 頂点上限{vertex}） / 龍脈眼精度 誤差{scatter}%"
    ,"kekkaishi.rankMax": "最高ランク"
    ,"kekkaishi.share": "ステータスを共有"
    ,"kekkaishi.shared": "ステータス画像を共有しました"
    ,"kekkaishi.downloaded": "ステータス画像を保存しました"
    ,"kekkaishi.shareFailed": "ステータス画像の作成に失敗しました"
    ,"kekkaishi.shareText": "GRID ATLAS 結界師ランク {rank}｜累積 {power} #GRIDATLAS #結界"
  },
  en: {
    "settings.title": "Settings",
    "settings.menu": "Menu",
    "settings.openGridAtlas": "Open .gridatlas",
    "settings.design": "Design",
    "settings.language": "Language",
    "settings.units": "Distance Unit",
    "settings.gps": "Use GPS",
    "settings.mapProvider": "Map service",
    "settings.mapGoogle": "Google Maps",
    "settings.mapApple": "Apple Maps",
    "settings.themeBasic": "Basic",
    "settings.themePastel": "Pastel",
    "settings.themeRetro": "Retro",
    "settings.languageJa": "Japanese",
    "settings.languageEn": "English",
    "settings.unitsMetric": "km",
    "settings.unitsImperial": "mile",
    "systemUpdate.label": "System update",
    "systemUpdate.action": "Update",
    "systemUpdate.notice": "Checks for the latest version and applies the update.",
    "systemUpdate.version": "Web version",
    "systemUpdate.checking": "Checking for updates…",
    "systemUpdate.applying": "Applying the update…",
    "systemUpdate.latest": "You are up to date.",
    "systemUpdate.reloading": "Updated. Reloading…",
    "systemUpdate.unsupported": "System updates are unavailable in this environment.",
    "systemUpdate.failed": "Could not check for updates. Check your connection.",
    "edition.web": "Web",
    "page.analysis": "Analysis",
    "page.data": "Data",
    "page.grid": "Grid",
    "page.points": "Points",
    "page.lists": "Lists",
    "summary.selected": "Selected",
    "summary.info": "Info",
    "mobileOverview.selection": "Selected point",
    "mobileOverview.displayed": "Shown",
    "mobileOverview.selected": "Selected",
    "mobileOverview.distance": "Distance",
    "mobileOverview.distanceType": "Distance type",
    "mobileOverview.firstSelection": "Initial",
    "mobileOverview.lastSelection": "Last",
    "state.unselected": "None",
    "state.noPoints": "No points",
    "action.register": "Add",
    "action.connect": "Link",
    "action.center": "Center",
    "action.clear": "Clear",
    "action.start": "Start",
    "action.target": "Target",
    "action.track": "Track",
    "action.route": "Route",
    "action.analyze": "Analyze",
    "action.analyzeTitle": "Analyze selected lines or shape",
    "action.traverse": "Barrier",
    "action.barrier": "Create barrier",

    "action.cancel": "Cancel",
    "traverse.bottomCancel": "Stop",
    "traverse.bottomClear": "Clear selection",
    "traverse.bottomPlace": "Place this shape",
    "traverse.bottomUndo": "Undo one line",
    "traverse.bottomMake": "Make barrier",
    "traverse.bottomDissolve": "Dissolve",
    "traverse.bottomConfirm": "Confirm",
    "action.done": "Done",
    "action.apply": "Apply",
    "action.copyToList": "Copy",
    "action.moveToList": "Move",
    "action.share": "Share",
    "action.shareSelected": "Share",
    "action.shareSelectedTitle": "Share selected points, lines, and figures",
    "action.invert": "Invert",
    "action.invertTitle": "Invert selection of displayed points",
    "action.info": "Info",
    "action.delete": "Delete",
    "delete.linksOnly": "Lines",
    "delete.pointsOnly": "Points",
    "delete.figuresOnly": "Figures",
    "delete.all": "All",
    "delete.uneditablePoints": "{count} selected point(s) cannot be deleted because they belong to a non-editable list.",
    "action.edit": "Edit",
    "action.rename": "Name",
    "action.memo": "Memo",
    "action.map": "Map",
    "section.pointSource": "Get location",
    "button.clipboard": "Clipboard",
    "button.currentLocation": "Current",
    "import.drop.title": "Import .gridatlas",
    "import.drop.description": "Drop it anywhere on this screen",
    "import.gridatlas.success": "Imported {count} spot list(s)",
    "import.gridatlas.urlSuccess": "Imported a spot list from the link",
    "import.gridatlas.presetSuccess": "Imported the introduction preset “{name}”",
    "import.gridatlas.error": "Could not import the spot list",
    "button.submitRegister": "Add",
    "button.update": "Update",
    "button.appleMaps": "Apple Maps",
    "button.googleMaps": "Google Maps",
    "button.setTarget": "Set Target",
    "button.clearTarget": "Clear Target",
    "button.setStart": "Set Start",
    "button.clearStart": "Clear Start",
    "button.stopTracking": "Stop Tracking",
    "button.optimize": "Optimize",
    "button.clear": "Clear",
    "panel.register": "Add Point",
    "panel.details": "Selected Point",
    "panel.multiSelect": "Multiple Selection",
    "panel.selectedLine": "Selected Line",
    "panel.observationResult": "Observation Result",
    "panel.analysis": "Analysis",
    "panel.route": "Route",
    "panel.data": "Data",
    "panel.points": "Points",
    "panel.lists": "Lists",
    "field.title": "Title",
    "field.lat": "Latitude",
    "field.lng": "Longitude",
    "field.photo": "Photo",
    "field.note": "Comment",
    "list.destination": "Destination list",
    "list.newOption": "New list",
    "list.nameRequired": "Enter a list name",
    "list.movedPoint": "Moved the point to “{name}”",
    "field.coords": "Coordinates",
    "field.created": "Created",
    "field.count": "Count",
    "field.order": "Order",
    "field.operation": "Action",
    "field.name": "Name",
    "field.actualDistance": "Actual",
    "field.record": "Record",
    "field.result": "Result",
    "field.line": "Line",
    "field.distance": "Distance",
    "field.endpoints": "Endpoints",
    "info.dialogTitle": "Point Info",
    "info.summary": "Selected Point",
    "info.displayTarget": "Displayed Point",
    "info.other": "Other Info",
    "info.list": "List",
    "info.updated": "Updated",
    "info.distanceFromCurrent": "From current",
    "info.noPhoto": "No photo",
    "info.noComment": "No comment",
    "info.unavailable": "Selected point info is unavailable",
    "line.infoTitle": "Line Info",
    "line.deleteConfirm": "Delete this line?",
    "line.deleted": "Line deleted",
    "line.color": "Color",
    "line.colorTitle": "Change line color",
    "line.colorMessage": "Choose where to apply the color.",
    "line.colorScope": "Apply to",
    "line.colorSegment": "This segment only",
    "line.colorShape": "Entire shape ({count} segments)",
    "line.colorNoShape": "This segment is not part of a shape",
    "line.colorApplied": "Line color changed",
    "line.closeShapeTitle": "Close the shape?",
    "line.closeShapeMessage": "Three or more points are selected. Close the shape by connecting the last point back to the first?",
    "line.destinationTitle": "Choose geometry destination",
    "line.destinationMessage": "The selected points belong to multiple lists. Choose the list that will store the lines and figure.",
    "line.destinationLabel": "Geometry destination list",
    "line.destinationEmpty": "There are no lists available to store this geometry.",
    "line.connected": "Connected {count} line(s)",
    "line.alreadyConnected": "The selected points are already connected in this list",
    "line.dragStatus": "Changing connection: drop on {name}",
    "line.reconnected": "Changed the connection from “{old}” to “{new}”",
    "line.invalidTarget": "Drop on a different point",
    "line.duplicateTarget": "A line between those points already exists",
    "figure.deleteVertex": "Delete this vertex",
    "figure.delete": "Delete figure",
    "figure.vertexCount": "{count} vertices",
    "figure.vertexDeleted": "Figure vertex deleted",
    "figure.deleteConfirm": "Delete this figure?",
    "figure.deleteVertexConfirm": "Delete this vertex?",
    "barrier.dissolve": "Dissolve barrier",
    "barrier.dissolveConfirm": "Dissolve this barrier? The barrier stones will remain in place.",
    "barrier.dissolved": "Barrier dissolved",
    "analysis.dialogTitle": "Analysis result",
    "analysis.lineTitle": "Crossing angle",
    "analysis.polygonTitle": "Shape analysis",
    "analysis.noSelection": "Select two or more segments",
    "analysis.lineHint": "Shows the analysis result for the two segments.",
    "analysis.polygonHint": "Shows the analysis result for the shape.",
    "analysis.measurementDeclaration": "Figure: {shape}",
    "analysis.measurementBasis": "{shape} · interior angle {angle} · diagonal/side {ratio}",
    "analysis.figure": "Figure",
    "analysis.selfIntersectionLabel": "Self-intersection",
    "analysis.selfIntersectionYes": "Yes",
    "analysis.selfIntersectionNo": "No",
    "analysis.shapeClosed": "closed segment set",
    "analysis.shapeOpen": "Cannot measure as a closed segment set",
    "analysis.shapeOpenHint": "Three or more selected segments must form a cycle with exactly two connections at each point.",
    "analysis.pathTitle": "Straightness analysis",
    "analysis.pathHint": "Measures an open path against an equally spaced straight line.",
    "analysis.pathDeclaration": "Measured as a straight path ({vertices} points / {edges} segments)",
    "analysis.pathBasis": "Baseline: {vertices} equally spaced points on a great circle",
    "analysis.pathNotScreen": "This is not a straight line on screen",
    "analysis.pathDeviation": "Deviation from great circle",
    "analysis.spacingVariation": "Spacing variation",
    "analysis.averageDeviation": "RMS",
    "analysis.maximumDeviation": "Max",
    "analysis.endpointDistance": "Endpoint distance",
    "analysis.pathLengthRatio": "Path length ÷ endpoint distance",
    "analysis.bearing": "Bearing",
    "analysis.farthestPoint": "Farthest point",
    "analysis.screenLineBasis": "Using the screen line (rhumb line) as the baseline",
    "analysis.foldedPath": "The path folds back on itself",
    "analysis.twoPointStraight": "Two points are always exactly straight",
    "analysis.pathUnavailable": "Cannot measure as a simple open path",
    "analysis.polygonKicker": "Measured target",
    "analysis.generalTitle": "General information",
    "analysis.shapeFeaturesTitle": "Shape features",
    "analysis.resultTitle": "Result",
    "analysis.comparisonTitle": "Comparison baseline",
    "analysis.reference": "Reference",
    "analysis.referenceScore": "Reference fit",
    "analysis.regularityScore": "Regularity",
    "analysis.referenceScoreDefinition": "Regularity is a reference value from 0 to 100 showing how evenly the angles and side lengths match the reference shape.",
    "analysis.copy": "Copy result",
    "analysis.copied": "Analysis result copied",
    "analysis.copyFailed": "Could not copy the result",
    "analysis.copyUnavailable": "Copy is not available in this browser",
    "analysis.intersection": "Intersection",
    "analysis.angle": "Angle",
    "analysis.segment": "Segment",
    "analysis.notCrossing": "The selected segments do not cross",
    "analysis.parallel": "The segments are parallel",
    "analysis.collinear": "The segments are collinear",
    "analysis.extension": "Their extensions meet, but the finite segments do not",
    "analysis.score": "Fit",
    "analysis.shape": "Shape",
    "analysis.sides": "Side lengths",
    "analysis.sideBalance": "Side balance",
    "analysis.angleBalance": "Angle balance",
    "analysis.idealAngle": "Ideal interior angle",
    "analysis.meanSide": "Average side",
    "analysis.perimeter": "Perimeter",
    "analysis.perimeterDisplay": "Perimeter",
    "analysis.area": "Area",
    "analysis.vertexCount": "Vertices",
    "analysis.edgeCount": "Edges",
    "analysis.longestSide": "Longest side",
    "analysis.shortestSide": "Shortest side",
    "analysis.areaUnavailable": "Area is not calculated for self-intersecting shapes.",
    "analysis.areaUnavailableShort": "Unavailable",
    "analysis.sideVariation": "Side variation",
    "analysis.angleVariation": "Angle variation",
    "analysis.maxAngleDeviation": "Maximum angle deviation",
    "analysis.angleDeviationRate": "Relative to reference angle",
    "analysis.referenceDiagonalRatio": "Reference diagonal/side",
    "analysis.vertex": "Vertex",
    "analysis.veryClose": "Very close",
    "analysis.close": "Close",
    "analysis.somewhatDifferent": "Somewhat different",
    "analysis.different": "Different",
    "analysis.regularTriangle": "Equilateral triangle",
    "analysis.square": "Square",
    "analysis.regularPentagon": "Regular pentagon",
    "analysis.regularPolygon": "Regular {n}-gon",
    "analysis.selfCrossingPolygon": "Self-crossing {n}-gon",
    "analysis.starPolygon": "Regular {n}-point star",
    "analysis.coordinates": "Coordinates",
    "metric.points": "Points",
    "metric.links": "Lines",
    "metric.total": "Total",
    "metric.longest": "Longest",
    "route.startPoint": "Start Point",
    "route.returnToStart": "Return to start",
    "route.summaryDefault": "Select points and tap Route",
    "route.needStart": "Set a start and select 2+ points",
    "route.needTwo": "Select 2+ points to route",
    "route.ready": "Ready to optimize",
    "route.exact": "Exact",
    "route.heuristic": "Approx",
    "route.return": "Return",
    "route.total": "Total",
    "route.start": "Start",
    "route.fromPrevious": "From previous",
    "route.toStart": "To start",
    "data.pointLists": "Point Lists",
    "data.cloud": "My Lists (Cloud)",
    "data.grid": "Grid",
    "cloud.menuTitle": "Cloud",
    "cloud.open": "Login settings",
    "cloud.authTitle": "Login settings",
    "cloud.email": "Email address (ID)",
    "cloud.password": "Password",
    "cloud.signUp": "Sign up",
    "cloud.signIn": "Sign in",
    "cloud.signOut": "Sign out",
    "cloud.accessCodeAdvanced": "Tester permission",
    "cloud.experimental": "Experimental",
    "cloud.dataNotice": "My Lists stored in the connected cloud.",
    "cloud.pointSource": "My List (Cloud)",
    "cloud.apiUrl": "Cloud API URL",
    "cloud.accessToken": "Access code",
    "cloud.testerCode": "Tester permission code",
    "cloud.authenticate": "Authenticate",
    "cloud.connect": "Connect",
    "cloud.testerGranted": "Tester permission active",
    "cloud.testerSignup": "Set up individual ID",
    "cloud.testerSignupTitle": "Set up individual ID",
    "cloud.gridName": "Display name (nickname)",
    "cloud.sendConfirmation": "Send account setup email",
    "cloud.close": "Close",
    "cloud.sharesTitle": "Issued links",
    "cloud.refresh": "Refresh",
    "cloud.disconnect": "Disconnect",
    "cloud.neverFetched": "Cloud has not been checked yet",
    "cloud.lastFetched": "Last checked {time}",
    "cloud.advanced": "Connection settings",
    "cloud.localList": "Device list to move to cloud",
    "cloud.save": "Save as My List (Cloud)",
    "cloud.delete": "Delete from My Lists (Cloud)",
    "cloud.empty": "No My Lists (Cloud)",
    "storage.notice": "Testers can move or copy lists between the device, My Lists (Cloud), and Shared Lists (Tester Experiment).",
    "storage.location": "Storage",
    "storage.device": "Device",
    "storage.cloud": "Cloud",
    "storage.both": "Device + Cloud",
    "storage.cloudReadProgress": "Loading cloud data",
    "storage.cloudOperationProgress": "Cloud operation in progress",
    "storage.processingProgress": "Processing",
    "storage.moveCloud": "Move to cloud storage",
    "storage.move": "Move",
    "storage.moveDevice": "Move to device",
    "storage.connectFirst": "Connect to the cloud first",
    "storage.importMoveOnly": "Move or copy imported lists to My Lists from the individual transfer dialog.",
    "storage.dragHint": "Tap a list to toggle its grid display. Long-press to show its places. Hold briefly, then drag to choose a destination and move or copy the list.",
    "storage.dragReordering": "Saving list order to the cloud",
    "storage.dragReordered": "List order updated",
    "storage.dragMoveCloud": "Move to cloud storage",
    "storage.dragMoveDevice": "Move to device",
    "storage.transferTitle": "List transfer",
    "storage.transferHint": "Move or copy “{name}” to {target}.",
    "storage.transferDestinationLabel": "List section for copy or move",
    "storage.transferSelectTarget": "Choose a list section for copying or moving “{name}”.",
    "storage.transferTargetSelected": "“{target}” is selected. Press Move or Copy to continue.",
    "storage.transferNoTarget": "There are no list sections available for copying or moving.",
    "storage.transferFrameCount": "{count} list(s)",
    "storage.transferMove": "Move",
    "storage.transferCopy": "Copy",
    "storage.dragImportedDestination": "Imported Lists cannot be a copy or move destination.",
    "storage.targetMineDevice": "My Lists (Device)",
    "storage.targetMineCloud": "My Lists (Cloud)",
    "storage.targetTesterShared": "Shared Lists (Tester Experiment)",
    "list.new": "New",
    "list.selectAll": "Select all",
    "list.selectAllTitle": "Show all lists on the grid",
    "list.clearAll": "Clear all",
    "list.clearAllTitle": "Hide all lists from the grid",
    "list.newPrompt": "Name the new list",
    "list.created": "Created a new list and set it as the destination",
    "list.active": "Destination",
    "list.syncEnable": "Move to cloud",
    "list.syncDisable": "Move to device",
    "list.copy": "Copy",
    "list.export": "Share",
    "list.exportDialogTitle": "Confirm sharing",
    "list.exportPrivacy": "Includes names, coordinates, notes, and saved images. Selected lines and figures are included for selection sharing.",
    "list.exportConfirm": "Share this list?",
    "list.exportSummary": "{count} point(s) in “{name}”",
    "list.exported": "Saved the shared file",
    "list.exportCompleted": "Shared",
    "list.exportFailed": "Could not create the shared file. Check the list contents",
    "list.exportImage": "Image",
    "list.exportImageShared": "Image shared",
    "list.exportImageDownloaded": "Image saved",
    "list.exportCloud": "Short URL",
    "list.exportCloudCreated": "Short URL copied",
    "list.shareSelectedNamePrompt": "Name for the shared list",
    "list.shareSelectedDefaultName": "Selected items",
    "list.shareSelectedUnavailable": "Select points, lines, or figures to share",
    "list.shareUnavailable": "No list data is available to share",
    "list.edit": "Edit",
    "list.rename": "Rename list",
    "list.renamePrompt": "New list name",
    "list.transfer": "Copy or move list",
    "list.setHome": "Set as point registration destination",
    "list.unsetHome": "Unset point registration destination",
    "list.destinationLocked": "This list is set as the point registration destination",
    "list.favorite": "Favorite",
    "list.addFavorite": "Add to favorites",
    "list.removeFavorite": "Remove from favorites",
    "list.favoriteStatus": "Favorite",
    "list.delete": "Delete",
    "list.showOnGrid": "Show on grid",
    "list.selectOnGrid": "Select this list on the grid",

    "list.visible": "Shown on grid",
    "list.hidden": "Hidden from grid",

    "list.transferNoSelection": "Select points that can be transferred to another list",
    "list.transferSelectDestination": "Select a destination list first",

    "list.transferDialogCopyTitle": "Choose a copy destination",
    "list.transferDialogMoveTitle": "Choose a move destination",
    "list.transferDialogHint": "Choose an existing list or create a new one.",
    "list.transferDialogNew": "Create a new list",
    "list.transferDialogEmpty": "No lists available",
    "list.copiedPoints": "Copied {count} point(s) to “{name}”",
    "list.movedPoints": "Moved {count} point(s) to “{name}”",
    "list.section.mineDevice": "My Lists (Device)",
    "list.section.mineCloud": "My Lists (Cloud)",
    "list.section.testerShared": "Shared Lists (Tester Experiment)",
    "list.section.imported": "Imported Lists",

    "list.none": "No lists",
    "status.grid": "Grid",
    "status.rangeSelect": "Selecting range",
    "label.points": "pts",
    "label.links": "lines",
    "label.observations": "observations",
    "label.selected": "Selected",
    "label.sequence": "Sequence",
    "label.linkTotal": "Line total",
    "label.betweenTwo": "Between",
    "label.fromCurrent": "From current",
    "label.accuracy": "Accuracy",
    "label.gps": "GPS",
    "label.none": "None",
    "message.loadedObservation": "Loaded observation",
    "message.pointUnavailable": "Point unavailable",
    "message.linkUnavailable": "Line unavailable",
    "message.quickHint": "Use quick buttons to link, copy or move between lists, share, route, delete, or clear.",
    "message.mapRouteHint": "The map searches a route in selected order: origin, waypoints, then destination.",
    "message.currentLocation": "Current location",
    "message.lastObservedLocation": "Last observed position",
    "traverse.noLocation": "Get your current location before placing or picking up a stone",
    "traverse.gpsUnavailable": "Current location is unavailable on this device",
    "traverse.accuracyError": "Location accuracy is too low to operate a barrier stone",
    "traverse.stockEmpty": "No barrier stones available to place",
    "traverse.noStone": "There is no barrier stone on this tile",
    "traverse.stockLabel": "Barrier stones {amount} / {cap}",
    "kekkaiTester.toggle": "Enable barrier tester",
    "kekkaiTester.hint": "Place at temporary points / barrier stones ♾️",
    "kekkaiTester.enabled": "Barrier tester enabled",
    "kekkaiTester.disabled": "Barrier tester disabled",
    "traverse.stoneTile": "Barrier stone tile",
    "traverse.stoneCount": "{count} stone(s)",
    "traverse.vertex": "Vertex",
    "traverse.tileMismatch": "Move to this tile to operate it",
    "traverse.place": "Place barrier stone",
    "traverse.pick": "Pick up barrier stone",
    "traverse.pinTitle": "Place a pin",
    "traverse.pinMessage": "Set a heading and registration location.",
    "traverse.pinTarget": "Registration location",
    "traverse.pinPending": "Temporary point",
    "traverse.pinCurrent": "Current location",
    "traverse.pinNoTarget": "Get your current location or create a temporary point before placing a pin.",
    "traverse.pinRegistered": "Pin registered",
    "traverse.vertexFitUnavailable": "There are no vertex cells.",
    "traverse.placementView": "View placement",
    "traverse.placementViewExit": "Back to barrier menu",
    "traverse.connect": "Bind barrier",
    "traverse.cancel": "Cancel",
    "traverse.returnTitle": "Back to title",
    "traverse.status": "Status",
    "traverse.menuTitle": "Barrier operation",
    "dragonEye.open": "Dragon eye",
    "dragonEye.title": "Choose a Dragon Eye shape",
    "dragonEye.message": "Choose a shape, then drag or pinch it on the grid.",
    "dragonEye.rankInfo": "Rank {rank} · edge-sum limit {perimeter} · accuracy {scatter}% error · rotation {rotation}",
    "dragonEye.perimeterLimit": "Edge-sum limit ({perimeter})",
      "dragonEye.rotationOn": "unlocked",
      "dragonEye.rotationLocked": "unlocks at E",
    "dragonEye.confirm": "Confirm",
    "dragonEye.cancel": "Cancel",
    "dragonEye.triangle": "Equilateral triangle",
    "dragonEye.square": "Square",
    "dragonEye.diamond": "Diamond",
    "dragonEye.pentagon": "Regular pentagon",
      "dragonEye.hexagon": "Regular hexagon",
      "dragonEye.heptagon": "Regular heptagon",
      "dragonEye.octagon": "Regular octagon",
    "dragonEye.pentagram": "Pentagram",
    "dragonEye.hexagram": "Hexagram",
    "dragonEye.octagram": "Octagram",
    "dragonEye.octagram2": "Octagram",
      "dragonEye.secret": "SECRET",
    "dragonEye.placed": "Saved the Dragon Eye as {count} points",
    "traverse.modeOnTitle": "Switch to barrier mode?",
    "traverse.modeOffTitle": "Exit barrier mode?",
    "traverse.modeOnMessage": "Barrier stone controls will be enabled.",
    "traverse.modeOffMessage": "The app will return to normal mode.",
    "traverse.modeOnConfirm": "Switch",
    "traverse.modeOffConfirm": "Exit",
    "traverse.summary": "Hand {stock} / placed {installed} / {locations} locations",
    "traverse.stoneStatus": "Barrier stone status",
    "traverse.stockShort": "Hand",
    "traverse.installedShort": "Placed",
    "traverse.locationsShort": "Locations",
    "traverse.quantityTitle": "Choose quantity",
    "traverse.quantityMessage": "Choose how many stones to operate.",
    "traverse.quantityDecrease": "Decrease by one",
    "traverse.quantityIncrease": "Increase by one",
    "traverse.linkReady": "Drag from an origin barrier stone",
    "traverse.linkOriginSelected": "Origin selected. Drag to the next barrier stone",
    "traverse.linkReturnHint": "Return to the origin and release to complete the barrier",
    "traverse.linkReturnRequired": "Return to the origin before releasing",
    "traverse.linkDwell": "Tracing barrier stones…",
    "traverse.undo": "Undo last segment",
    "traverse.stockFull": "Barrier stone stock is full",
    "traverse.capReached": "This tile has reached its barrier-stone cap",
    "traverse.barrier": "Barrier",
    "barrier.createTitle": "Bind barrier",
    "barrier.createMessage": "Return to the origin to bind the selected barrier stones.",
    "barrier.nameLabel": "Barrier name",
    "barrier.defaultName": "New barrier",
    "barrier.created": "Barrier created",
    "barrier.dissolveHint": "Select a barrier to dissolve",
    "barrier.selectToDissolve": "Select a barrier first",
    "barrier.tooFew": "Not enough vertices! A barrier needs at least three!",
    "barrier.needLocations": "Place barrier stones at {count} more locations to bind a barrier.",
    "barrier.tooMany": "Too large! Your barrier-master class is not high enough! (Max {max} vertices)",
    "barrier.rankVertexLimit": "Too large! Your barrier-master class is not high enough!",
    "barrier.perimeterExceeded": "Too large! Your barrier-master class is not high enough! The edge-sum limit is exceeded ({perimeter} / limit {limit})",
    "barrier.crossLinkLocked": "Cross-linking is not unlocked yet! Your barrier-master class is not high enough! (Unlocks at barrier-master class {rank})",
    "barrier.stoneUsed": "That barrier stone is already in use! Choose another one!",
    "barrier.missingStone": "The barrier stone was not found! Trace it again!",
    "barrier.selection": "{count} barrier stone(s) selected"
    ,"barrier.scoreTitle": "Barrier power"
    ,"barrier.scoreDensity": "Density"
    ,"barrier.scoreArea": "Area"
    ,"barrier.scoreStones": "Effective / total stones"
    ,"barrier.scoreShape": "Shape factor"
    ,"barrier.scoreBeauty": "Beauty factor"
    ,"barrier.scoreScale": "Scale factor"
    ,"barrier.rankNext": "To the next rank: {rank}"
    ,"barrier.rankPower": "Power"
    ,"barrier.rankDays": "Active days"
    ,"barrier.daysUnit": "days"
    ,"barrier.rankMax": "Maximum rank"
    ,"barrier.rankStones": "Add {count} more stone(s) to reach it ({days} days of supply)"
    ,"barrier.rankUnreachable": "This shape cannot reach it (only {power} power when full)"
    ,"barrier.rankPowerWait": "Active days progress after reaching the power threshold"
    ,"barrier.guardianTitle": "Guardian point"
    ,"barrier.guardianUnset": "Not set (uses the centroid)"
    ,"barrier.guardianSet": "Choose guardian on map"
    ,"barrier.guardianChangeLabel": "Change label"
    ,"barrier.guardianRemove": "Remove guardian"
    ,"barrier.guardianPlacementHint": "Tap the place to protect on the map"
    ,"barrier.guardianPlaced": "Guardian point set"
    ,"barrier.guardianUpdated": "Guardian label updated"
    ,"barrier.guardianRemoved": "Guardian point removed"
    ,"barrier.guardianLabel": "Guardian label"
    ,"barrier.guardianDefaultLabel": ""
    ,"barrier.guardianRemoveConfirm": "Remove this barrier's guardian point?"
    ,"barrier.share": "Share image"
    ,"barrier.shared": "Barrier image shared"
    ,"barrier.downloaded": "Barrier image saved as PNG"
    ,"barrier.shareFailed": "Could not create the barrier image"
    ,"barrier.shareText": "GRID ATLAS \"{name}\" | {rank} {power} power #GRIDATLAS #Barrier"
    ,"kekkaishi.title": "Kekkaishi status"
    ,"kekkaishi.rank": "Kekkaishi rank"
    ,"kekkaishi.achievedDays": "({days} days to reach)"
    ,"kekkaishi.lifetime": "Cumulative barrier spirit"
    ,"kekkaishi.currentDailyPower": "Current total barrier spirit"
    ,"kekkaishi.createdCount": "Barriers created"
    ,"kekkaishi.activeCount": "Active barriers"
    ,"kekkaishi.next": "To the next rank"
    ,"kekkaishi.shapesTitle": "Barrier techniques and abilities"
    ,"kekkaishi.shapesHint": "Usable barrier techniques and those added by the next class."
    ,"kekkaishi.currentShapes": "Usable barrier techniques"
    ,"kekkaishi.nextShapes": "Barrier techniques added by the next class"
    ,"kekkaishi.progressTitle": "To the next class"
    ,"kekkaishi.perimeterLimit": "Edge-sum limit"
    ,"kekkaishi.maxVertices": "Max vertices"
    ,"kekkaishi.stoneCap": "Stone cap"
    ,"kekkaishi.stones": "Barrier stones"
    ,"kekkaishi.stockCap": "Holding cap"
    ,"kekkaishi.vertexCap": "Vertex cap"
    ,"kekkaishi.scatter": "Dragon Eye accuracy"
    ,"kekkaishi.scatterValue": "{scatter}% error"
    ,"kekkaishi.edgeGuide": "Regular-polygon side guide"
    ,"kekkaishi.progressLifetime": "Lifetime"
    ,"kekkaishi.dailyPower": "Previous day's barrier spirit"
    ,"kekkaishi.dailyUnit": "Pt/day"
    ,"kekkaishi.progressDays": "At this pace: {days} more days"
    ,"kekkaishi.noDailyPower": "Create a barrier to make progress"
    ,"kekkaishi.unlocks": "Usable barrier techniques: {shapes} / edge-sum limit {perimeter} / regular-polygon side guide {edges} / max {vertices} vertices / barrier stones (holding cap {stock} / vertex cap {vertex}) / Dragon Eye accuracy {scatter}% error"
    ,"kekkaishi.nextUnlocks": "Barrier techniques added by the next class: {shapes} / edge-sum limit {perimeter} / regular-polygon side guide {edges} / max {vertices} vertices / barrier stones (holding cap {stock} / vertex cap {vertex}) / Dragon Eye accuracy {scatter}% error"
    ,"kekkaishi.rankMax": "Maximum rank"
    ,"kekkaishi.share": "Share status"
    ,"kekkaishi.shared": "Status image shared"
    ,"kekkaishi.downloaded": "Status image downloaded"
    ,"kekkaishi.shareFailed": "Could not create the status image"
    ,"kekkaishi.shareText": "GRID ATLAS Kekkaishi rank {rank} | lifetime {power} #GRIDATLAS #Barrier"
  }
};

function activeLanguage() {
  return state.language === EN_LANGUAGE ? EN_LANGUAGE : JA_LANGUAGE;
}

function t(key) {
  return TRANSLATIONS[activeLanguage()]?.[key] ?? TRANSLATIONS.ja[key] ?? key;
}

function applyStaticTranslations() {
  document.documentElement.lang = activeLanguage();
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const labelNode = element.querySelector("[data-i18n]");
    if (labelNode) {
      labelNode.textContent = t(element.dataset.i18n);
    } else {
      element.textContent = t(element.dataset.i18n);
    }
  }
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
  elements.settingsMenuButton.title = t("settings.title");
  if (elements.editionBadge) {
    elements.editionBadge.textContent = t("edition.web");
  }
  syncBrandIdentity();
}

function syncBrandIdentity() {
  if (!elements.brandTitle) return;
  const kekkai = currentTheme() === KEKKAI_THEME;
  elements.brandTitle.textContent = kekkai ? "結界アトラス" : "GRID ATLAS";
  elements.brandTitle.setAttribute("aria-label", elements.brandTitle.textContent);
}

function setLanguage(language, options = {}) {
  state.language = language === EN_LANGUAGE ? EN_LANGUAGE : JA_LANGUAGE;
  if (options.persist !== false) {
    try {
      localStorage.setItem(LANGUAGE_KEY, state.language);
    } catch {}
  }
  applyStaticTranslations();
  syncSettingsControls();
  renderCloudLastFetched();
}

function setDistanceUnit(unit, options = {}) {
  state.distanceUnit = unit === IMPERIAL_UNIT ? IMPERIAL_UNIT : METRIC_UNIT;
  if (options.persist !== false) {
    try {
      localStorage.setItem(DISTANCE_UNIT_KEY, state.distanceUnit);
    } catch {}
  }
  syncSettingsControls();
}

function setRouteReturnToStart(value, options = {}) {
  state.routeReturnToStart = Boolean(value);
  if (options.persist !== false) {
    try {
      localStorage.setItem(ROUTE_RETURN_KEY, String(state.routeReturnToStart));
    } catch {}
  }
  syncSettingsControls();
}

function setMapProvider(provider, options = {}) {
  state.mapProvider = provider === MAP_PROVIDER_APPLE ? MAP_PROVIDER_APPLE : MAP_PROVIDER_GOOGLE;
  if (options.persist !== false) {
    try {
      localStorage.setItem(MAP_PROVIDER_KEY, state.mapProvider);
    } catch {}
  }
  syncSettingsControls();
}

async function setGpsEnabled(value, options = {}) {
  const enabled = Boolean(value);
  if (enabled === state.gpsEnabled && options.force !== true) {
    syncSettingsControls();
    return true;
  }

  if (!enabled) {
    if (state.followCurrentLocation) {
      await toggleLocationFollow();
      if (state.followCurrentLocation) {
        syncSettingsControls();
        return false;
      }
    }
    if (state.screenFollowCurrentLocation) {
      stopScreenFollow({ render: false });
    }
    state.gpsEnabled = false;
    if (state.locationWatchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(state.locationWatchId);
    }
    state.locationWatchId = null;
    state.currentGeo = null;
    stopDeviceHeading();
    state.selection = state.selection.filter((entry) => entry.id !== CURRENT_LOCATION_ID);
    normalizeSelection();
  } else {
    state.gpsEnabled = true;
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(GPS_ENABLED_KEY, String(state.gpsEnabled));
    } catch {}
  }

  syncSettingsControls();
  if (state.gpsEnabled && options.request !== false) {
    requestCurrentLocation({ fillForm: false, center: false, showButtonState: false });
  }
  if (options.render !== false) {
    render();
  }
  return true;
}
function syncSettingsControls() {
  if (elements.settingsThemeField) elements.settingsThemeField.hidden = currentTheme() === KEKKAI_THEME;
  elements.settingsThemeSelect.value = currentTheme() === KEKKAI_THEME ? RETRO_THEME : currentTheme();
  elements.settingsLanguageSelect.value = activeLanguage();
  elements.settingsUnitSelect.value = state.distanceUnit;
  elements.settingsGpsEnabled.checked = state.gpsEnabled;
  elements.settingsMapProviderSelect.value = state.mapProvider;
  elements.routeReturnToStart.checked = state.routeReturnToStart;
  const testerAvailable = state.traverseMode && state.cloud.testerActive;
  if (elements.kekkaiTesterField) elements.kekkaiTesterField.hidden = !testerAvailable;
  if (elements.kekkaiTesterEnabled) {
    elements.kekkaiTesterEnabled.checked = testerAvailable && state.kekkaiTesterEnabled;
    elements.kekkaiTesterEnabled.disabled = !testerAvailable;
  }
}

function kekkaiTesterModeActive() {
  return state.traverseMode && state.cloud.testerActive && state.kekkaiTesterEnabled;
}

function setKekkaiTesterEnabled(enabled, options = {}) {
  const next = Boolean(enabled) && state.traverseMode && state.cloud.testerActive;
  const changed = state.kekkaiTesterEnabled !== next;
  state.kekkaiTesterEnabled = next;
  if (!next && state.barrierPlacementView) exitBarrierPlacementView();
  if (options.persist !== false) {
    try {
      localStorage.setItem(KEKKAI_TESTER_ENABLED_KEY, String(next));
    } catch {}
  }
  syncSettingsControls();
  if (options.render !== false) render();
  if (changed && options.announce !== false) showAppToast(t(next ? "kekkaiTester.enabled" : "kekkaiTester.disabled"));
}

function loadTraverseLog() {
  const storedLogs = [BARRIER_LOG_KEY, LEGACY_TRAVERSE_LOG_KEY]
    .map((key) => {
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    });
  const raw = storedLogs.find((candidate) => (
    candidate?.type === "barrier-log" || candidate?.type === "traverse-log"
  )) || null;
  let result;
  try {
    result = sanitizeBarrierLog(raw);
  } catch (error) {
    console.warn("GRID ATLAS barrier log recovery failed", error);
    result = { log: createBarrierLog(), changed: true };
  }
  state.traverseLog = result.log;
  const figuresChanged = syncBarrierFiguresFromLog();
  const evaluation = evaluateBarrierLog(state.traverseLog);
  if (result.changed || !raw || evaluation.changed) persistTraverseLog();
  if (figuresChanged) persistWorkspace();
}

function barrierFigureForId(barrierId) {
  const figureId = state.traverseLog?.barriers?.[barrierId]?.figureId || barrierFigureId(barrierId);
  return figureId ? findFigure(figureId) : null;
}

function barrierFigureVertices(barrier) {
  return barrier?.figureId
    ? state.figures.find((figure) => figure.id === barrier.figureId)?.vertices || []
    : [];
}

function syncBarrierFiguresFromLog() {
  if (!state.traverseLog) return false;
  const expected = new Map();
  for (const [barrierId, barrier] of Object.entries(state.traverseLog.barriers || {})) {
    const figureId = barrier.figureId || barrierFigureId(barrierId);
    if (!figureId) continue;
    barrier.figureId = figureId;
    const vertices = barrierStoneIds(barrier).map((stoneId) => {
      const geo = tileCenterGeo(state.traverseLog.stones?.[stoneId]?.tile);
      return geo ? normalizeAnalysisVertex({
        ...geo,
        name: "結界頂点",
        note: state.traverseLog.stones?.[stoneId]?.note || "",
        placeRef: null
      }) : null;
    }).filter(Boolean);
    if (vertices.length < 3) continue;
    expected.set(figureId, createAnalysisFigure({
      id: figureId,
      vertices,
      note: barrier.note || "",
      createdAt: barrier.createdAt,
      skip: Math.max(1, Number(barrier.skip) || 1),
      layer: "barrier",
      barrierId
    }));
  }
  const nextFigures = state.figures
    .filter((figure) => figure.layer !== "barrier" && !figure.barrierId && !expected.has(figure.id))
    .concat([...expected.values()].filter(Boolean));
  const changed = JSON.stringify(nextFigures) !== JSON.stringify(state.figures);
  if (changed) state.figures = nextFigures;
  Object.defineProperty(state.traverseLog, "figures", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: state.figures
  });
  return changed;
}

function persistTraverseLog() {
  if (!state.traverseLog) return;
  try {
    localStorage.setItem(BARRIER_LOG_KEY, JSON.stringify(state.traverseLog));
  } catch {}
}

function refreshTraverseStock() {
  if (!state.traverseLog) return false;
  const changed = grantBarrierStock(state.traverseLog);
  if (changed) persistTraverseLog();
  return changed;
}

function installedBarrierStoneEntries() {
  return Object.entries(state.traverseLog?.stones || {})
    .filter(([, stone]) => stoneDisplayCount(stone) > 0);
}

function usedBarrierStoneIds() {
  return new Set(Object.values(state.traverseLog?.barriers || {})
    .flatMap((barrier) => barrierStoneIds(barrier)));
}

function availableBarrierStoneIds() {
  const used = usedBarrierStoneIds();
  return installedBarrierStoneEntries()
    .map(([stoneId]) => stoneId)
    .filter((stoneId) => !used.has(stoneId));
}

function actionQuantityLimit(action, options = {}) {
  const amount = Math.max(0, Math.floor(Number(options.amount) || 0));
  const count = stoneDisplayCount(options.stone);
  const unlimitedStock = options.unlimitedStock === true;
  if (action === "place") {
    const cap = options.stoneCap ?? BARRIER_CONFIG.stoneCapLoose;
    const room = Math.max(0, cap - count);
    return unlimitedStock ? room : Math.min(amount, room);
  }
  if (unlimitedStock) return count;
  const stockRoom = Math.max(0, stockCapForRank(currentKekkaishiRankInfo().rank.index) - amount);
  return options.stone && count > 0 ? Math.max(0, Math.min(count, stockRoom)) : 0;
}

function currentTraverseActionContext(targetTileId = null) {
  const currentTile = typeof targetTileId === "string" && targetTileId
    ? targetTileId
    : state.currentGeo ? tileIdFromGeo(state.currentGeo) : null;
  const stoneId = currentTile ? stoneIdFromTile(currentTile) : null;
  const stone = stoneId ? state.traverseLog?.stones?.[stoneId] : null;
  const stoneCap = stoneId ? stoneCapFor(state.traverseLog, stoneId, currentKekkaishiRankInfo().rank.index) : null;
  const unlimitedStock = kekkaiTesterModeActive();
  return {
    amount: Math.max(0, Math.floor(Number(state.traverseLog?.stock?.amount) || 0)),
    currentTile,
    stoneId,
    stone,
    stoneCap,
    unlimitedStock
  };
}

function traverseQuantityLimit(action, targetTileId = null) {
  const context = currentTraverseActionContext(targetTileId);
  return actionQuantityLimit(action, {
    amount: context.amount,
    stone: context.stone,
    stoneCap: context.stoneCap,
    unlimitedStock: context.unlimitedStock
  });
}

function renderTraverseQuantityDialog() {
  const action = state.traverseQuantityAction;
  if (!action) return;
  const titleKey = action === "place" ? "traverse.place" : "traverse.pick";
  if (elements.traverseQuantityDialogTitle) elements.traverseQuantityDialogTitle.textContent = t(titleKey);
  if (elements.traverseQuantityDialogMessage) elements.traverseQuantityDialogMessage.textContent = t("traverse.quantityMessage");
  if (elements.traverseQuantityValue) elements.traverseQuantityValue.textContent = String(state.traverseQuantity);
  if (elements.traverseQuantityDecreaseButton) {
    elements.traverseQuantityDecreaseButton.disabled = state.traverseQuantity <= 1;
    elements.traverseQuantityDecreaseButton.setAttribute("aria-label", t("traverse.quantityDecrease"));
  }
  if (elements.traverseQuantityIncreaseButton) {
    elements.traverseQuantityIncreaseButton.disabled = state.traverseQuantity >= state.traverseQuantityMax;
    elements.traverseQuantityIncreaseButton.setAttribute("aria-label", t("traverse.quantityIncrease"));
  }
  if (elements.traverseQuantityConfirmButton) {
    elements.traverseQuantityConfirmButton.disabled = state.traverseQuantityMax < 1;
  }
}

function captureTraversePlaceView() {
  if (state.traversePlaceViewSnapshot) return;
  state.traversePlaceViewSnapshot = {
    centerGeo: { ...projectionCenterGeo() },
    viewport: { ...state.viewport },
    screenFollowCurrentLocation: state.screenFollowCurrentLocation,
    screenFollowCurrentLocationAt100m: state.screenFollowCurrentLocationAt100m,
    locationFollowScaleMode: state.locationFollowScaleMode,
    placed: false
  };
}

function clearTraversePlaceViewSnapshot() {
  state.traversePlaceViewSnapshot = null;
}

function restoreTraversePlaceView() {
  const snapshot = state.traversePlaceViewSnapshot;
  clearTraversePlaceViewSnapshot();
  if (!snapshot) return;
  setProjectionCenterGeo(snapshot.centerGeo);
  state.viewport = { ...snapshot.viewport };
  state.screenFollowCurrentLocation = snapshot.screenFollowCurrentLocation;
  state.screenFollowCurrentLocationAt100m = snapshot.screenFollowCurrentLocationAt100m;
  state.locationFollowScaleMode = snapshot.locationFollowScaleMode;
  render();
}

function closeTraverseQuantityDialog(options = {}) {
  const dialog = elements.traverseQuantityDialog;
  const wasOpen = Boolean(dialog?.open);
  const action = state.traverseQuantityAction;
  elements.traverseQuantityDialog?.classList.remove("is-placement-overlay");
  elements.traverseQuantityDialog?.classList.remove("is-actionbar-overlay");
  elements.traverseQuantityDialog?.style.removeProperty("--traverse-quantity-left");
  elements.traverseQuantityDialog?.style.removeProperty("--traverse-quantity-top");
  elements.traverseQuantityDialog?.style.removeProperty("--traverse-quantity-width");
  elements.traverseQuantityDialog?.style.removeProperty("--traverse-quantity-height");
  elements.actionBar?.classList.remove("is-quantity-dialog-open");
  state.traverseQuantityAction = null;
  state.traverseQuantityTargetTileId = null;
  state.traverseQuantityTemporaryGeo = null;
  state.traverseQuantity = 1;
  state.traverseQuantityMax = 1;
  if (wasOpen) dialog.close("cancel");
  if (action === "place" && options.restorePlaceView === true) restoreTraversePlaceView();
}

function openTraverseQuantityDialog(action, options = {}) {
  if (!state.traverseMode || state.traverseBusy || !elements.traverseQuantityDialog) return false;
  const targetTileId = typeof options.targetTileId === "string" && options.targetTileId
    ? options.targetTileId
    : null;
  const temporaryGeo = validGeo(options.temporaryGeo) ? normalizeGeo(options.temporaryGeo) : null;
  const context = currentTraverseActionContext(targetTileId);
  const max = traverseQuantityLimit(action, targetTileId);
  if (max < 1) {
    const message = action === "place"
      ? !context.unlimitedStock && context.amount < 1 ? t("traverse.stockEmpty") : t("traverse.capReached")
      : context.stone ? t("traverse.stockFull") : t("traverse.noStone");
    showAppToast(message, { error: true });
    render();
    return false;
  }
  if (action === "place" && !temporaryGeo) {
    captureTraversePlaceView();
    centerAndFollowCurrentLocation();
  }
  state.traverseQuantityAction = action;
  state.traverseQuantityTargetTileId = targetTileId;
  state.traverseQuantityTemporaryGeo = temporaryGeo;
  state.traverseQuantityMax = max;
  state.traverseQuantity = 1;
  const placementOverlay = action === "place";
  elements.traverseQuantityDialog.classList.toggle("is-placement-overlay", placementOverlay);
  elements.traverseQuantityDialog.classList.toggle("is-actionbar-overlay", placementOverlay);
  elements.actionBar?.classList.toggle("is-quantity-dialog-open", placementOverlay);
  renderTraverseQuantityDialog();
  if (!elements.traverseQuantityDialog.open) {
    if (placementOverlay) elements.traverseQuantityDialog.show();
    else elements.traverseQuantityDialog.showModal();
  }
  render();
  if (placementOverlay) window.requestAnimationFrame(syncTraverseQuantityDialogPosition);
  elements.traverseQuantityIncreaseButton?.focus();
  return true;
}

function syncTraverseQuantityDialogPosition() {
  syncTraverseQuantityDialogPositionFor(elements.traverseQuantityDialog);
  syncActionbarOverlayPositionFor(elements.dragonEyeDialog);
  syncActionbarOverlayPositionFor(elements.dragonEyeControlDialog);
}

function syncTraverseQuantityDialogPositionFor(dialog) {
  if (!dialog?.open) return;
  if (dialog.classList.contains("is-actionbar-overlay")) {
    syncActionbarOverlayPositionFor(dialog);
    return;
  }
  if (!dialog.classList.contains("is-placement-overlay")) return;
  const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
  const bars = [elements.actionBar, elements.traverseActionBar]
    .map((element) => element?.getBoundingClientRect())
    .filter((rect) => rect && rect.width > 0 && rect.height > 0 && rect.top < viewportHeight);
  const coveredTop = bars.reduce(
    (top, rect) => Math.min(top, Math.max(0, rect.top)),
    viewportHeight
  );
  const bottomOffset = Math.max(0, Math.ceil(viewportHeight - coveredTop) + 8);
  dialog.style.setProperty("--traverse-quantity-bottom", `${bottomOffset}px`);
}

function syncActionbarOverlayPositionFor(dialog) {
  if (!dialog?.open || !dialog.classList.contains("is-actionbar-overlay")) return;
  const actionBarRect = elements.actionBar?.getBoundingClientRect();
  if (!actionBarRect || actionBarRect.width <= 0 || actionBarRect.height <= 0) return;
  dialog.style.setProperty("--traverse-quantity-left", `${Math.round(actionBarRect.left)}px`);
  dialog.style.setProperty("--traverse-quantity-top", `${Math.round(actionBarRect.top)}px`);
  dialog.style.setProperty("--traverse-quantity-width", `${Math.round(actionBarRect.width)}px`);
  dialog.style.setProperty("--traverse-quantity-height", `${Math.round(actionBarRect.height)}px`);
}

function adjustTraverseQuantity(delta) {
  if (!state.traverseQuantityAction) return;
  state.traverseQuantity = Math.min(
    state.traverseQuantityMax,
    Math.max(1, state.traverseQuantity + delta)
  );
  renderTraverseQuantityDialog();
}

function confirmTraverseQuantity() {
  const action = state.traverseQuantityAction;
  const targetTileId = state.traverseQuantityTargetTileId;
  const temporaryGeo = state.traverseQuantityTemporaryGeo;
  const quantity = state.traverseQuantity;
  if (!action || quantity < 1) return;
  closeTraverseQuantityDialog();
  void performTraverseStoneAction(action, quantity, targetTileId, { temporaryGeo });
}

function resetBarrierLinkState() {
  clearDragLongPressTimer(state.pointer?.drag);
  clearBarrierLinkHoldVisual();
  if (state.barrierLinkErrorTimerId !== null) {
    window.clearTimeout(state.barrierLinkErrorTimerId);
  }
  state.barrierLinkErrorTimerId = null;
  state.barrierLinkError = null;
  if (state.pointer?.drag?.barrierLink) state.pointer.drag.barrierLink = false;
  state.barrierLinkingMode = false;
  state.barrierLinkPath = [];
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPendingStoneId = null;
  state.barrierLinkPendingStartedAt = null;
  state.barrierLinkPendingDurationMs = null;
  state.barrierLinkSettledDiamonds = [];
  state.barrierLinkDiamondAnimations = [];
  if (state.barrierLinkDiamondFrameId !== null) {
    window.cancelAnimationFrame(state.barrierLinkDiamondFrameId);
  }
  state.barrierLinkDiamondFrameId = null;
  state.barrierLinkCompletion = null;
  state.barrierLinkPreview = false;
  canvas?.classList.remove("is-barrier-linking");
}

function resetDragonEyeState() {
  closeDragonEyeControlPanel();
  state.dragonEye.active = false;
  state.dragonEye.shape = null;
  state.dragonEye.center = null;
  state.dragonEye.radius = 0;
  state.dragonEye.rotation = 0;
  state.dragonEye.scatter = 0;
  state.dragonEye.rankIndex = 0;
  state.dragonEye.rankName = null;
  state.dragonEye.perimeterLimitKm = 0;
  state.pointer.pinch = null;
  if (state.pointer.drag?.dragonEye) state.pointer.drag.dragonEye = false;
}

function dragonEyeShapesForRank(rankIndex) {
  const maxVertices = maxVerticesForRank(rankIndex);
  const shapes = ["triangle"];
  if (maxVertices >= 4) shapes.push("square", "diamond");
  if (maxVertices >= 5) shapes.push("pentagon");
  if (maxVertices >= 6) shapes.push("hexagon");
  if (maxVertices >= 7) shapes.push("heptagon");
  if (maxVertices >= 8) shapes.push("octagon");
  if (rankIndex >= BARRIER_CONFIG.crossLinkFromRank && maxVertices >= 5) shapes.push("pentagram");
  if (rankIndex >= 12 && maxVertices >= 6) shapes.push("hexagram");
  if (rankIndex >= 13 && maxVertices >= 8) shapes.push("octagram");
  if (rankIndex >= 14 && maxVertices >= 8) shapes.push("octagram2");
  return Object.freeze([...new Set(shapes)]);
}

function dragonEyeRankInfo() {
  const status = state.traverseLog?.kekkaishi || createKekkaishiStatus();
  const rank = rankForKekkaishi(status);
  const rankIndex = rank.index;
  const maxVertices = maxVerticesForRank(rankIndex);
  return {
    rank,
    rankIndex,
    maxVertices,
    perimeterLimitKm: perimeterLimitKmForRank(rankIndex),
    scatter: ryumyakuScatterForRank(rankIndex),
    rotationUnlocked: rankIndex >= BARRIER_CONFIG.rotationFromRank,
    shapes: dragonEyeShapesForRank(rankIndex)
  };
}

function currentKekkaishiRankInfo() {
  const status = state.traverseLog?.kekkaishi || createKekkaishiStatus();
  const rank = rankForKekkaishi(status);
  return {
    rank,
    maxVertices: maxVerticesForRank(rank.index),
    perimeterLimitKm: perimeterLimitKmForRank(rank.index),
    stoneCapVertex: Number(BARRIER_CONFIG.stoneCapVertexByRank[rank.index]) || BARRIER_CONFIG.stoneCapVertex
  };
}

function renderDragonEyeShapeOptions() {
  const info = dragonEyeRankInfo();
  if (elements.dragonEyeAvailability) {
    elements.dragonEyeAvailability.textContent = t("dragonEye.rankInfo")
      .replace("{rank}", info.rank.name)
      .replace("{perimeter}", formatBarrierDistance(info.perimeterLimitKm))
      .replace("{scatter}", String(Math.round(info.scatter * 100)))
      .replace("{rotation}", info.rotationUnlocked ? t("dragonEye.rotationOn") : t("dragonEye.rotationLocked"));
  }
  elements.dragonEyeShapeOptions?.querySelectorAll("[data-dragon-eye-shape]").forEach((option) => {
    const shape = option.dataset.dragonEyeShape;
    const available = info.shapes.includes(shape);
    const label = t(`dragonEye.${shape}`);
    const labelNode = option.querySelector("[data-dragon-eye-label]");
    option.disabled = !available;
    option.classList.toggle("is-locked", !available);
    option.setAttribute("aria-label", available ? label : t("dragonEye.secret"));
    if (labelNode) labelNode.textContent = available ? label : "";
    option.title = "";
  });
}

function dragonEyeDefinition() {
  return DRAGON_EYE_SHAPES[state.dragonEye.shape] || null;
}

function dragonEyeMaxRadius(definition, perimeterLimitKm) {
  if (!definition) return 0;
  const sides = Math.max(3, Number(definition.sides) || 0);
  const perimeterFactor = sides * 2 * Math.sin(Math.PI / sides);
  return perimeterFactor > 0 ? Math.max(1, Number(perimeterLimitKm) * 1000 / perimeterFactor) : 0;
}

function dragonEyeRadiusForSizePercent(percent, definition = dragonEyeDefinition(), perimeterLimitKm = dragonEyeRankInfo().perimeterLimitKm) {
  const max = dragonEyeMaxRadius(definition, perimeterLimitKm);
  const normalizedPercent = Math.min(100, Math.max(DRAGON_EYE_MIN_SIZE_PERCENT, Number(percent) || DRAGON_EYE_MIN_SIZE_PERCENT));
  return max * normalizedPercent / 100;
}

function dragonEyeSizePercent(radius = state.dragonEye.radius, definition = dragonEyeDefinition(), perimeterLimitKm = dragonEyeRankInfo().perimeterLimitKm) {
  const max = dragonEyeMaxRadius(definition, perimeterLimitKm);
  if (max <= 0) return DRAGON_EYE_MIN_SIZE_PERCENT;
  const rawPercent = Number(radius) / max * 100;
  const snappedPercent = Math.round(rawPercent / DRAGON_EYE_SIZE_PERCENT_STEP) * DRAGON_EYE_SIZE_PERCENT_STEP;
  return Math.min(100, Math.max(DRAGON_EYE_MIN_SIZE_PERCENT, snappedPercent));
}

function dragonEyeSideLength(radius, definition = dragonEyeDefinition()) {
  if (!definition) return 0;
  const sides = Math.max(3, Number(definition.sides) || 0);
  return Math.max(0, Number(radius) || 0) * 2 * Math.sin(Math.PI / sides);
}

function dragonEyeRadiusBounds() {
  const definition = dragonEyeDefinition();
  const info = dragonEyeRankInfo();
  const max = dragonEyeMaxRadius(definition, info.perimeterLimitKm);
  const min = dragonEyeRadiusForSizePercent(DRAGON_EYE_MIN_SIZE_PERCENT, definition, info.perimeterLimitKm);
  return { min, max };
}

function dragonEyeWorldVertices() {
  const definition = dragonEyeDefinition();
  const center = state.dragonEye.center;
  const radius = Math.min(Number(state.dragonEye.radius), dragonEyeMaxRadius(definition, dragonEyeRankInfo().perimeterLimitKm));
  if (!definition || !center || !Number.isFinite(radius) || radius <= 0) return [];
  const baseVertices = Array.from({ length: definition.sides }, (_, index) => {
    const angle = definition.rotation + state.dragonEye.rotation + (Math.PI * 2 * index) / definition.sides;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
  return baseVertices;
}

function dragonEyePathVertices() {
  const definition = dragonEyeDefinition();
  const vertices = dragonEyeWorldVertices();
  const skip = Math.max(1, Number(definition?.skip) || 1);
  if (skip === 1 || vertices.length < 3) return vertices;
  const visited = new Set();
  const components = [];
  for (let start = 0; start < vertices.length; start += 1) {
    if (visited.has(start)) continue;
    const component = [];
    let index = start;
    do {
      component.push(index);
      visited.add(index);
      index = (index + skip) % vertices.length;
    } while (index !== start && component.length <= vertices.length);
    components.push(component);
  }
  const walk = [...components[0]];
  for (let index = 1; index < components.length; index += 1) walk.push(components[index - 1][0], ...components[index]);
  if (components.length > 1) walk.push(components.at(-1)[0]);
  return walk.map((index) => vertices[index]);
}

function dragonEyeScreenVertices() {
  return dragonEyePathVertices().map(worldToScreen);
}

function isInsideDragonEye(screenPoint) {
  if (!state.dragonEye.active) return false;
  const vertices = dragonEyeScreenVertices();
  return vertices.length >= 3 && pointInPolygon(screenPoint, vertices);
}

function beginDragonEye(shape) {
  if (!state.traverseMode || state.traverseBusy || !DRAGON_EYE_SHAPES[shape]) return;
  const rankInfo = dragonEyeRankInfo();
  if (!rankInfo.shapes.includes(shape)) {
    showAppToast(t("dragonEye.secret"), { error: true });
    renderDragonEyeShapeOptions();
    return;
  }
  const size = canvasSize();
  const definition = DRAGON_EYE_SHAPES[shape];
  const maxRadius = dragonEyeMaxRadius(definition, rankInfo.perimeterLimitKm);
  const initialRadius = Math.min(maxRadius, Math.min(size.width, size.height) * 0.24 / Math.max(0.01, state.viewport.scale));
  const initialPercent = dragonEyeSizePercent(initialRadius, definition, rankInfo.perimeterLimitKm);
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  state.dragonEye = {
    active: true,
    shape,
    center: screenToWorld({ x: size.width / 2, y: size.height / 2 }),
    radius: dragonEyeRadiusForSizePercent(initialPercent, definition, rankInfo.perimeterLimitKm),
    rotation: 0,
    scatter: rankInfo.scatter,
    rankIndex: rankInfo.rankIndex,
    rankName: rankInfo.rank.name,
    perimeterLimitKm: rankInfo.perimeterLimitKm
  };
  if (elements.dragonEyeDialog?.open) elements.dragonEyeDialog.close("shape-selected");
  render();
  openDragonEyeControlPanel();
}

function clearDragonEyeDialogOverlay() {
  const dialog = elements.dragonEyeDialog;
  if (!dialog) return;
  dialog.classList.remove("is-actionbar-overlay");
  dialog.style.removeProperty("--traverse-quantity-left");
  dialog.style.removeProperty("--traverse-quantity-top");
  dialog.style.removeProperty("--traverse-quantity-width");
  dialog.style.removeProperty("--traverse-quantity-height");
  if (!elements.dragonEyeControlDialog?.open) {
    elements.actionBar?.classList.remove("is-actionbar-overlay-open");
  }
}

function openDragonEyeDialog() {
  if (!state.traverseMode || state.traverseBusy || !elements.dragonEyeDialog) return;
  renderDragonEyeShapeOptions();
  elements.dragonEyeDialog.classList.add("is-actionbar-overlay");
  elements.actionBar?.classList.add("is-actionbar-overlay-open");
  if (!elements.dragonEyeDialog.open) elements.dragonEyeDialog.show();
  window.requestAnimationFrame(() => syncActionbarOverlayPositionFor(elements.dragonEyeDialog));
}

function cancelDragonEye() {
  if (!state.dragonEye.active) return;
  resetDragonEyeState();
  returnToTraverseActionMenu();
}

function normalizedDragonEyeRotationDegrees() {
  const degrees = Math.round((Number(state.dragonEye.rotation) || 0) * 180 / Math.PI);
  return ((degrees % 360) + 360) % 360;
}

function formatDragonEyeRadius(radiusMeters) {
  const meters = Math.max(0, Number(radiusMeters) || 0);
  return meters < 1000 ? `${Math.round(meters)} m` : formatBarrierDistance(meters / 1000);
}

function renderDragonEyeControlPanel() {
  if (!elements.dragonEyeControlDialog) return;
  const { min, max } = dragonEyeRadiusBounds();
  const radius = Math.min(max, Math.max(min, Number(state.dragonEye.radius) || min));
  const percent = dragonEyeSizePercent(radius);
  const sideLength = dragonEyeSideLength(radius);
  if (elements.dragonEyeControlStatus) {
    elements.dragonEyeControlStatus.textContent = `1辺 ${percent}% (${formatDragonEyeRadius(sideLength)}) ・ ${normalizedDragonEyeRotationDegrees()}°`;
  }
  const rotationUnlocked = dragonEyeRankInfo().rotationUnlocked;
  elements.dragonEyeShrinkButton.disabled = !state.dragonEye.active || percent <= DRAGON_EYE_MIN_SIZE_PERCENT;
  elements.dragonEyeExpandButton.disabled = !state.dragonEye.active || percent >= 100;
  elements.dragonEyeRotateCounterclockwiseButton.disabled = !state.dragonEye.active || !rotationUnlocked;
  elements.dragonEyeRotateClockwiseButton.disabled = !state.dragonEye.active || !rotationUnlocked;
}

function openDragonEyeControlPanel() {
  const dialog = elements.dragonEyeControlDialog;
  if (!state.dragonEye.active || !dialog) return;
  dialog.classList.add("is-actionbar-overlay");
  elements.actionBar?.classList.add("is-actionbar-overlay-open");
  renderDragonEyeControlPanel();
  if (!dialog.open) dialog.show();
  window.requestAnimationFrame(() => syncActionbarOverlayPositionFor(dialog));
}

function closeDragonEyeControlPanel() {
  const dialog = elements.dragonEyeControlDialog;
  if (!dialog) return;
  dialog.classList.remove("is-actionbar-overlay");
  dialog.style.removeProperty("--traverse-quantity-left");
  dialog.style.removeProperty("--traverse-quantity-top");
  dialog.style.removeProperty("--traverse-quantity-width");
  dialog.style.removeProperty("--traverse-quantity-height");
  elements.actionBar?.classList.remove("is-actionbar-overlay-open");
  if (dialog.open) dialog.close("close");
}

function adjustDragonEyeRadius(direction) {
  if (!state.dragonEye.active) return;
  const nextPercent = dragonEyeSizePercent() + (direction > 0 ? DRAGON_EYE_SIZE_PERCENT_STEP : -DRAGON_EYE_SIZE_PERCENT_STEP);
  state.dragonEye.radius = dragonEyeRadiusForSizePercent(nextPercent);
  renderDragonEyeControlPanel();
  draw();
}

function rotateDragonEye(direction) {
  if (!state.dragonEye.active || !dragonEyeRankInfo().rotationUnlocked) return;
  const radians = DRAGON_EYE_ROTATION_STEP_DEGREES * Math.PI / 180;
  state.dragonEye.rotation = (Number(state.dragonEye.rotation) || 0) + (direction > 0 ? -radians : radians);
  renderDragonEyeControlPanel();
  draw();
}

function dragonEyePlacementVertex(vertex) {
  const scatter = Math.max(0, Number(state.dragonEye.scatter) || dragonEyeRankInfo().scatter);
  if (scatter <= 0) return vertex;
  const vertices = dragonEyeWorldVertices();
  const center = state.dragonEye.center || vertices.reduce((sum, point) => ({ x: sum.x + point.x / vertices.length, y: sum.y + point.y / vertices.length }), { x: 0, y: 0 });
  const meanRadius = vertices.reduce((sum, point) => sum + Math.hypot(point.x - center.x, point.y - center.y), 0) / Math.max(1, vertices.length);
  const angle = Math.random() * Math.PI * 2;
  const distance = meanRadius * scatter;
  return {
    x: vertex.x + Math.cos(angle) * distance,
    y: vertex.y + Math.sin(angle) * distance
  };
}

function commitDragonEye() {
  const vertices = dragonEyeWorldVertices();
  const definition = dragonEyeDefinition();
  if (!state.dragonEye.active || vertices.length < 3 || !definition) return;

  const now = new Date().toISOString();
  const placementVertices = vertices.map(dragonEyePlacementVertex);
  const list = kekkaiPointList();
  list.visible = true;
  list.updatedAt = now;
  const scatterPercent = Math.round((Number(state.dragonEye.scatter) || dragonEyeRankInfo().scatter) * 100);
  const createdPoints = placementVertices.map((vertex, index) => {
    const geo = normalizeGeo(unprojectWorld(vertex.x, vertex.y));
    return {
      id: createId(),
      x: vertex.x,
      y: vertex.y,
      title: `龍脈眼 ${definition.glyph} ${index + 1}`,
      note: `${KEKKAI_POINT_LIST_NAME} / ${definition.ja} / ${state.dragonEye.rankName || dragonEyeRankInfo().rank.name}級 / 周長上限${formatBarrierDistance(state.dragonEye.perimeterLimitKm || dragonEyeRankInfo().perimeterLimitKm)} / 精度 誤差${scatterPercent}%`,
      photo: "",
      photoName: "",
      photoAssetId: "",
      gridAtlas: null,
      geo,
      createdAt: now,
      updatedAt: now
    };
  });
  list.points.push(...createdPoints);
  state.selection = createdPoints.map((point) => ({ type: "point", id: point.id }));
  state.selectedPointId = createdPoints[0]?.id || null;
  state.selectedLinkId = null;
  resetDragonEyeState();
  refreshVisiblePoints();
  persistWorkspace();
  showAppToast(t("dragonEye.placed").replace("{count}", String(createdPoints.length)), { duration: 6000 });
  returnToTraverseActionMenu();
}

function beginBarrierLinking() {
  if (!state.traverseMode || state.traverseBusy) return false;
  if (availableBarrierStoneIds().length < 3) {
    showAppToast(t("barrier.tooFew"), { error: true });
    return false;
  }
  state.barrierLinkingMode = true;
  state.barrierLinkPath = [];
  state.barrierSelection = [];
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPendingStoneId = null;
  clearBarrierLinkHoldVisual();
  state.selectedBarrierId = null;
  showAppToast(t("traverse.linkReady"));
  fitBarrierPlacementView({ linkOnly: true });
  return true;
}

function applyTraverseModeToggle(enabled) {
  const nextMode = Boolean(enabled);
  if (state.traverseMode !== nextMode) {
    setTraverseMode(nextMode);
  } else if (nextMode) {
    // A native dialog can resolve its promise and close event in a different
    // order on touch browsers. Re-apply the mobile surface even when the
    // mode flag was already set by the confirm-button handler.
    setMobilePage("map");
    setMobileGridPage("grid");
    renderTraverseBottomActions();
    syncTraverseModeUi();
  } else {
    renderTraverseBottomActions();
    syncTraverseModeUi();
  }
  syncSettingsControls();
}

function setTraverseMode(enabled) {
  const nextMode = Boolean(enabled);
  if (nextMode) {
    setTheme(KEKKAI_THEME, { persist: false });
  }
  if (state.barrierPinMode) closeBarrierPinDialog();
  state.traverseMode = nextMode;
  if (!nextMode) {
    loadTheme({ ignoreKekkaishiLaunch: true });
  }
  if (state.traverseMode) {
    // The action button lives inside the grid panel on mobile. Keep the
    // confirmation flow intact, but always return to that panel after the
    // user confirms the mode change so the button cannot remain off-screen.
    setMobilePage("map");
    setMobileGridPage("grid");
  }
  state.barrierPlacementView = false;
  state.barrierFitStage = "all";
  state.barrierDissolveMode = false;
  state.barrierPinMode = false;
  resetBarrierLinkState();
  state.barrierLinkSourceSelection = [];
  resetDragonEyeState();
  state.barrierSelection = [];
  state.selectedBarrierId = null;
  if (state.traverseMode) {
    if (evaluateBarrierLog(state.traverseLog).changed) persistTraverseLog();
    refreshTraverseStock();
  }
  // Set the mode surface before the full render as well as after it. This
  // keeps the action button visible if a touch browser delays or interrupts
  // the surrounding render while the confirmation dialog is closing.
  syncTraverseModeUi();
  render();
  syncTraverseModeUi();
  const settledMode = state.traverseMode;
  window.requestAnimationFrame(() => {
    if (state.traverseMode !== settledMode) return;
    renderTraverseBottomActions();
    syncTraverseModeUi();
  });
}

async function requestTraverseModeToggle() {
  // The mode state is authoritative. Repair the visible badge before
  // calculating the next mode so a stale cached label cannot contradict the
  // confirmation dialog.
  syncTraverseModeUi();
  const nextMode = !state.traverseMode;
  pendingTraverseModeToggle = nextMode;
  const confirmed = await requestConfirm({
    title: t(nextMode ? "traverse.modeOnTitle" : "traverse.modeOffTitle"),
    message: t(nextMode ? "traverse.modeOnMessage" : "traverse.modeOffMessage"),
    cancelLabel: t("action.cancel"),
    confirmLabel: t(nextMode ? "traverse.modeOnConfirm" : "traverse.modeOffConfirm"),
    danger: false
  });
  if (!confirmed) {
    pendingTraverseModeToggle = null;
    syncSettingsControls();
    return;
  }
  pendingTraverseModeToggle = null;
  // The confirm-button handler may already have applied this transition for
  // touch browsers. Applying it again is intentional and idempotent: it
  // repairs the visible surface after the dialog has fully settled.
  applyTraverseModeToggle(nextMode);
}

function loadPreferences() {
  let language = JA_LANGUAGE;
  let unit = METRIC_UNIT;
  let returnToStart = true;
  let gpsEnabled = false;
  let mapProvider = defaultMapProvider();
  try {
    language = localStorage.getItem(LANGUAGE_KEY) === EN_LANGUAGE ? EN_LANGUAGE : JA_LANGUAGE;
    unit = localStorage.getItem(DISTANCE_UNIT_KEY) === IMPERIAL_UNIT ? IMPERIAL_UNIT : METRIC_UNIT;
    returnToStart = localStorage.getItem(ROUTE_RETURN_KEY) === "true";
    gpsEnabled = localStorage.getItem(GPS_ENABLED_KEY) === "true";
    state.kekkaiTesterEnabled = localStorage.getItem(KEKKAI_TESTER_ENABLED_KEY) === "true";
    const savedMapProvider = localStorage.getItem(MAP_PROVIDER_KEY);
    if (savedMapProvider === MAP_PROVIDER_APPLE || savedMapProvider === MAP_PROVIDER_GOOGLE) {
      mapProvider = savedMapProvider;
    }
  } catch {}

  setLanguage(language, { persist: false });
  setDistanceUnit(unit, { persist: false });
  setRouteReturnToStart(returnToStart, { persist: false });
  setMapProvider(mapProvider, { persist: false });
  state.gpsEnabled = gpsEnabled;
}

function setSettingsMenuOpen(open) {
  elements.settingsPanel.hidden = !open;
  elements.settingsMenuButton.setAttribute("aria-expanded", String(open));
}

function moveCloudAuthPanelToDialog() {
  if (!elements.cloudAuthPanel || !elements.cloudDialogBody) return;
  if (elements.cloudAuthPanel.parentElement !== elements.cloudDialogBody) {
    elements.cloudDialogBody.append(elements.cloudAuthPanel);
  }
}

function moveCloudPasswordPanelToAuth() {
  if (elements.cloudPasswordPanel && elements.cloudAuthPanel && elements.cloudPasswordPanel.parentElement !== elements.cloudAuthPanel) {
    elements.cloudAuthPanel.append(elements.cloudPasswordPanel);
  }
}

function moveCloudPasswordPanelToTesterDialog() {
  if (elements.cloudPasswordPanel && elements.cloudTesterSignupDialogBody && elements.cloudPasswordPanel.parentElement !== elements.cloudTesterSignupDialogBody) {
    elements.cloudTesterSignupDialogBody.append(elements.cloudPasswordPanel);
  }
}

function setCloudDialogOpen(open) {
  if (!elements.cloudDialog) return;
  if (open) {
    moveCloudAuthPanelToDialog();
    moveCloudPasswordPanelToAuth();
    setSettingsMenuOpen(false);
    if (!elements.cloudDialog.open) elements.cloudDialog.showModal();
    void refreshCloudShares();
    return;
  }
  if (elements.cloudDialog.open) elements.cloudDialog.close();
}

function toggleSettingsMenu() {
  const open = elements.settingsPanel.hidden;
  if (open) syncSettingsControls();
  setSettingsMenuOpen(open);
}
function currentTheme() {
  const theme = document.documentElement.dataset.theme;
  return theme === RETRO_THEME || theme === BASIC_THEME || theme === KEKKAI_THEME ? theme : PASTEL_THEME;
}

function canvasPalette() {
  return CANVAS_PALETTES[currentTheme()];
}

function loadTheme(options = {}) {
  if (!options.ignoreKekkaishiLaunch && hasKekkaishiLaunchMode()) {
    setTheme(KEKKAI_THEME, { persist: false });
    return;
  }
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {}

  setTheme(saved === BASIC_THEME || saved === "atlas-paper" || saved === "paper" ? BASIC_THEME : saved === PASTEL_THEME || saved === "light" ? PASTEL_THEME : RETRO_THEME, { persist: false });
}

function setTheme(theme, options = {}) {
  const normalized = theme === KEKKAI_THEME
    ? KEKKAI_THEME
    : theme === BASIC_THEME || theme === "atlas-paper" || theme === "paper"
      ? BASIC_THEME
      : theme === RETRO_THEME
        ? RETRO_THEME
        : PASTEL_THEME;
  document.documentElement.dataset.theme = normalized;
  syncBrandIdentity();
  const themeColor = normalized === KEKKAI_THEME
    ? "#5b2a86"
    : normalized === RETRO_THEME
      ? "#020806"
      : normalized === BASIC_THEME
        ? "#f5efe3"
        : "#d86f9b";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);

  if (options.persist !== false && normalized !== KEKKAI_THEME) {
    localStorage.setItem(THEME_KEY, normalized);
  }

  if (elements.editionBadge) {
    elements.editionBadge.textContent = t("edition.web");
  }
  if (elements.settingsThemeSelect) {
    elements.settingsThemeSelect.value = normalized;
  }
  if (elements.settingsThemeField) {
    elements.settingsThemeField.hidden = Boolean(state.traverseMode);
  }
}

function toggleTheme() {
  setTheme(currentTheme() === RETRO_THEME || currentTheme() === KEKKAI_THEME ? PASTEL_THEME : RETRO_THEME);
  render();
}

function hasKekkaishiLaunchMode() {
  return new URLSearchParams(window.location.search).get("mode") === KEKKAI_MODE;
}

function applyKekkaishiLaunchMode() {
  if (!hasKekkaishiLaunchMode()) return false;
  setTheme(KEKKAI_THEME, { persist: false });
  setTraverseMode(true);
  return true;
}

function createId() {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function loadWorkspace() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("grid-atlas-workspace-v1");
  if (!raw) {
    applyWorkspace({
      pointLists: [createLocalPointList()],
      activePointListId: DEFAULT_POINT_LIST_ID
    });
    persistWorkspace();
    return;
  }

  try {
    applyWorkspace(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function applyWorkspace(workspace) {
  const origin = validGeo(workspace.origin) ? workspace.origin : null;
  const existingPointIds = new Set();
  state.version = 4;
  state.cloud.hiddenListIds = new Set(
    Array.isArray(workspace.cloudHiddenListIds)
      ? workspace.cloudHiddenListIds.filter((id) => typeof id === "string" && id)
      : []
  );
  state.cloud.testerSharedListIds = new Set(
    Array.isArray(workspace.testerSharedCloudListIds)
      ? workspace.testerSharedCloudListIds.filter((id) => typeof id === "string" && id)
      : []
  );
  state.cloud.listOrder = Array.isArray(workspace.cloudListOrder)
    ? workspace.cloudListOrder.filter((id) => typeof id === "string" && id)
    : [];
  state.favoriteListIds = new Set(
    Array.isArray(workspace.favoriteListIds)
      ? workspace.favoriteListIds.filter((id) => typeof id === "string" && id)
      : []
  );
  state.storageListSectionCollapsed = workspace.storageListSectionCollapsed
    && typeof workspace.storageListSectionCollapsed === "object"
    ? Object.fromEntries(
      Object.entries(workspace.storageListSectionCollapsed)
        .filter(([key, collapsed]) => typeof key === "string" && Boolean(collapsed))
    )
    : {};

  if (Array.isArray(workspace.pointLists)) {
    state.pointLists = workspace.pointLists
      .map((list, index) => normalizePointList(list, existingPointIds, index === 0 ? "マイ地点" : `地点リスト ${index + 1}`))
      .filter(Boolean);
  } else {
    const points = Array.isArray(workspace.points)
      ? workspace.points.map((point) => normalizePoint(point, origin)).filter(Boolean)
      : [];
    for (const point of points) {
      while (existingPointIds.has(point.id)) {
        point.id = createId();
      }
      existingPointIds.add(point.id);
    }
    state.pointLists = [createLocalPointList(points)];
  }

  for (const list of state.pointLists) {
    if (list.id === DEFAULT_POINT_LIST_ID) {
      list.editable = true;
      list.source = "local";
      list.importedAt = "";
      continue;
    }
    // Detach legacy cloud links so device and cloud lists are independent.
    list.cloudId = "";
    list.cloudScope = "";
    list.cloudRevision = null;
    list.cloudUpdatedAt = "";
    const imported = list.source === "import" || Boolean(list.importedAt);
    list.editable = !imported;
    list.source = imported ? "import" : "local";
    if (!imported) list.importedAt = "";
  }
  ensurePointLists();
  state.activePointListId = workspace.activePointListId === null
    ? null
    : typeof workspace.activePointListId === "string"
      && (
        state.pointLists.some((list) => list.id === workspace.activePointListId && list.editable)
        || workspace.activePointListId.startsWith("cloud:")
      )
      ? workspace.activePointListId
      : DEFAULT_POINT_LIST_ID;
  const legacyDragonEyePointsMigrated = migrateLegacyDragonEyePointLists();
  const duplicateListsCoalesced = coalesceDuplicateLocalLists();
  const activeListVisibilityChanged = ensureActivePointListVisible();
  refreshVisiblePoints();
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.selectedFigureId = null;
  state.pendingLinkPointId = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  state.routeReturnToStart = false;
  state.routeResult = null;
  state.targetPointId = null;
  resetObservationTrail();
  state.editingPointId = null;
  state.pendingGeo = null;
  if (activeListVisibilityChanged || duplicateListsCoalesced || legacyDragonEyePointsMigrated) {
    persistWorkspace();
  }
}

function normalizePoint(point, origin) {
  const geo = pointGeoFromAny(point, origin);
  if (!geo) {
    return null;
  }

  const projected = projectLatLng(geo.lat, geo.lng);
  const createdAt = point.createdAt || point.updatedAt || new Date().toISOString();
  return {
    id: point.id || createId(),
    x: projected.x,
    y: projected.y,
    title: typeof point.title === "string" && point.title.trim() ? point.title.trim() : "Point",
    note: typeof point.note === "string" ? point.note : "",
    photo: typeof point.photo === "string" ? point.photo : "",
    photoName: typeof point.photoName === "string" ? point.photoName : "",
    photoAssetId: typeof point.photoAssetId === "string" ? point.photoAssetId : "",
    gridAtlas: point.gridAtlas && typeof point.gridAtlas === "object" ? clonePlain(point.gridAtlas) : null,
    geo,
    createdAt,
    updatedAt: point.updatedAt || ""
  };
}

function createPointList(options = {}) {
  const now = new Date().toISOString();
  return {
    id: typeof options.id === "string" && options.id ? options.id : createId(),
    name: typeof options.name === "string" && options.name.trim() ? options.name.trim() : "地点リスト",
    description: typeof options.description === "string" ? options.description : "",
    author: typeof options.author === "string" ? options.author : "",
    visible: options.visible !== false,
    editable: Boolean(options.editable),
    source: typeof options.source === "string" ? options.source : "import",
    storagePlaceholder: options.storagePlaceholder === true,
    cloudId: typeof options.cloudId === "string" ? options.cloudId : "",
    cloudScope: options.cloudScope === "mine" ? "mine" : "",
    cloudRevision: Number.isInteger(options.cloudRevision) ? options.cloudRevision : null,
    cloudUpdatedAt: typeof options.cloudUpdatedAt === "string" ? options.cloudUpdatedAt : "",
    gridAtlas: options.gridAtlas && typeof options.gridAtlas === "object" ? clonePlain(options.gridAtlas) : null,
    importedAt: typeof options.importedAt === "string" ? options.importedAt : now,
    createdAt: typeof options.createdAt === "string" ? options.createdAt : now,
    updatedAt: typeof options.updatedAt === "string" ? options.updatedAt : now,
    points: Array.isArray(options.points) ? options.points : [],
    lines: Array.isArray(options.lines) ? options.lines.map(normalizeAnalysisLine).filter(Boolean) : [],
    figures: Array.isArray(options.figures) ? options.figures.map(normalizeAnalysisFigure).filter(Boolean) : [],
    reservedKind: options.reservedKind === "kekkai" ? "kekkai" : ""
  };
}

function createLocalPointList(points = []) {
  return createPointList({
    id: DEFAULT_POINT_LIST_ID,
    name: "マイ地点",
    visible: true,
    editable: true,
    source: "local",
    importedAt: "",
    points
  });
}

function ensurePointLists() {
  if (!Array.isArray(state.pointLists)) {
    state.pointLists = [];
  }

  if (state.pointLists.length === 0) {
    state.pointLists = [createLocalPointList(Array.isArray(state.points) ? state.points : [])];
  }

  if (!state.pointLists.some((list) => list.id === DEFAULT_POINT_LIST_ID)) {
    state.pointLists.unshift(createLocalPointList());
  }
}

function visiblePointLists() {
  ensurePointLists();
  if (state.traverseMode) return [kekkaiPointList()];
  return state.pointLists.filter((list) => list.visible !== false);
}

function allPointListPoints() {
  ensurePointLists();
  return state.pointLists.flatMap((list) => list.points);
}

function visiblePointIdSet() {
  return new Set(visibleSelectablePoints().map((point) => point.id));
}

function refreshVisiblePoints() {
  state.points = visiblePointLists().flatMap((list) => list.points);
}

function cloudListVisible(cloudId) {
  return typeof cloudId === "string" && !state.cloud.hiddenListIds.has(cloudId);
}

function visibleCloudPointLists() {
  return !state.traverseMode && state.cloud.connected
    ? state.cloud.pointLists.filter((list) => cloudListVisible(list.cloudId || list.id))
    : [];
}

function visibleCloudPointRows() {
  return visibleCloudPointLists().flatMap((list) => (
    list.points.map((point) => ({ point, list, isCloud: true }))
  ));
}

function findCloudPointInLists(pointId, lists) {
  for (const list of lists) {
    const point = findPointIn(pointId, list.points);
    if (point) {
      return point;
    }
  }
  return null;
}

function findVisibleCloudPoint(pointId) {
  return findCloudPointInLists(pointId, visibleCloudPointLists());
}

function cloudPointListForPoint(pointId) {
  return state.cloud.pointLists.find((list) => findPointIn(pointId, list.points)) ?? null;
}

async function cloudPhotoAssetsForList(list, cloudId, client, options = {}) {
  const photoAssets = new Map();
  const photoPoints = (Array.isArray(list?.points) ? list.points : [])
    .filter((point) => point.cloudPhoto || point.photoAssetId || point.photo);
  const total = photoPoints.length;
  let completed = 0;
  options.onProgress?.(completed, total);

  for (const point of photoPoints) {
    if (point.cloudPhoto) {
      photoAssets.set(point.id, point.cloudPhoto);
      completed += 1;
      options.onProgress?.(completed, total);
      continue;
    }
    if (!point.photoAssetId && point.photo) {
      await ensureStoredPointPhoto(point);
    }
    if (point.photoAssetId) {
      const localAsset = await getGridAtlasAsset(point.photoAssetId);
      if (!localAsset?.blob) {
        if (!point.cloudPhoto) {
          throw new CloudApiError(cloudText(
            `「${point.title || "名称なし"}」の画像を端末から読み出せません。画像を復元してからクラウドを更新してください。`,
            `The image for “${point.title || "Untitled"}” is missing on this device. Restore it before updating the cloud list.`
          ));
        }
      } else {
        const uploaded = await client.uploadAsset(cloudId, localAsset.id, localAsset.blob, {
          name: localAsset.name,
          mediaType: localAsset.mediaType
        });
        if (uploaded?.id) {
          photoAssets.set(point.id, {
            assetId: uploaded.id,
            mediaType: uploaded.mediaType || localAsset.mediaType,
            name: uploaded.name || localAsset.name || "",
            byteLength: uploaded.byteLength || localAsset.byteLength
          });
        }
      }
    }
    completed += 1;
    options.onProgress?.(completed, total);
  }
  return photoAssets;
}

async function cloudPayloadWithPhotos(list, cloudId, client) {
  const photoAssets = await cloudPhotoAssetsForList(list, cloudId, client, {
    onProgress: (completed, total) => {
      if (total <= 0) return;
      setCloudProgress(
        completed,
        total,
        "processing"
      );
    }
  });
  return pointListToCloudPayload({ ...list, cloudId }, pointGeo, { photoAssets });
}

async function hydrateCloudPointListAssets(list, client, options = {}) {
  const photoPoints = (list?.points || []).filter((point) => point.photoAssetId);
  let completed = 0;
  const total = photoPoints.length;
  options.onProgress?.(completed, total);
  await Promise.all(photoPoints.map(async (point) => {
    try {
      const blob = await client.getAsset(list.cloudId, point.photoAssetId);
      const local = await putGridAtlasAsset(blob, {
        name: point.photoName,
        mediaType: blob.type
      });
      point.photoAssetId = local.id;
      point.photo = await gridAtlasAssetUrl(local.id);
    } catch (error) {
      console.warn("GRID ATLAS cloud photo hydration failed", error);
      if (options.required === true) {
        throw new CloudApiError(cloudText(
          `「${point.title || "名称なし"}」の画像を端末へ保存できませんでした。クラウド側のリストは保持しています。`,
          `Could not save the image for “${point.title || "Untitled"}” to this device. The cloud list was kept.`
        ));
      }
    } finally {
      completed += 1;
      options.onProgress?.(completed, total);
    }
  }));
  return list;
}

async function updateCloudPointList(list, nextList, options = {}) {
  const cloudId = list?.cloudId || list?.id;
  const meta = state.cloud.lists.find((item) => item.id === cloudId);
  if (!state.cloud.connected || !cloudId || !meta) {
    setCloudStatus(t("storage.connectFirst"), { error: true });
    return false;
  }

  setCloudBusy(true);
  const progressKind = options.progressKind || "operation";
  setCloudProgress(0, 3, progressKind);
  let payload;
  let client;
  try {
    client = cloudClientFromInputs();
    payload = await cloudPayloadWithPhotos(nextList, cloudId, client);
  } catch (error) {
    setCloudBusy(false);
    setCloudStatus(cloudErrorMessage(error), { error: true });
    return false;
  }

  let updated = false;
  try {
    setCloudProgress(1, 3, "operation");
    await client.updateList(cloudId, meta.revision, payload);
    updated = true;
    setCloudProgress(2, 3, "read");
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  }

  if (updated) {
    await refreshCloudLists({ quiet: true, keepBusy: true });
    setCloudProgress(3, 3, "operation");
    setCloudStatus(options.message || cloudText("マイリスト（クラウド）を更新しました", "My List (Cloud) updated"));
  }
  setCloudBusy(false);
  return updated;
}
function findCloudPointAny(pointId) {
  return findCloudPointInLists(pointId, state.cloud.pointLists);
}

function repairLocalCloudPointIdCollisions() {
  const cloudPointIds = new Set(state.cloud.pointLists.flatMap((list) => list.points.map((point) => point.id)));
  if (cloudPointIds.size === 0) return false;
  const reservedIds = new Set([
    ...state.pointLists.flatMap((list) => list.points.map((point) => point.id)),
    ...cloudPointIds
  ]);
  let changed = false;

  const remapReferences = (previousId, nextId) => {
    remapPointIdInLinks(previousId, nextId);
    state.selection = state.selection.map((entry) => (
      entry.type === "point" && entry.id === previousId ? { ...entry, id: nextId } : entry
    ));
    state.routeSelectionIds = state.routeSelectionIds.map((id) => id === previousId ? nextId : id);
    if (state.selectedPointId === previousId) state.selectedPointId = nextId;
    if (state.pendingLinkPointId === previousId) state.pendingLinkPointId = nextId;
    if (state.routeStartPointId === previousId) state.routeStartPointId = nextId;
    if (state.targetPointId === previousId) state.targetPointId = nextId;
    if (state.editingPointId === previousId) state.editingPointId = nextId;
    if (state.gridPointHoverPointId === previousId) state.gridPointHoverPointId = nextId;
    if (state.gridPointQuickPointId === previousId) state.gridPointQuickPointId = nextId;
    if (state.pointInfoTargetId === previousId) state.pointInfoTargetId = nextId;
    if (state.pointInfoReturnContext?.pointId === previousId) state.pointInfoReturnContext.pointId = nextId;
    if (Array.isArray(state.pointInfoReturnContext?.selection)) {
      state.pointInfoReturnContext.selection = state.pointInfoReturnContext.selection.map((entry) => (
        entry.type === "point" && entry.id === previousId ? { ...entry, id: nextId } : entry
      ));
    }
    if (Array.isArray(state.routeResult?.pointIds)) {
      state.routeResult.pointIds = state.routeResult.pointIds.map((id) => id === previousId ? nextId : id);
    }
  };

  for (const list of state.pointLists) {
    for (const point of list.points) {
      if (!cloudPointIds.has(point.id)) continue;
      const previousId = point.id;
      let nextId = createId();
      while (reservedIds.has(nextId)) nextId = createId();
      reservedIds.add(nextId);
      point.id = nextId;
      remapReferences(previousId, nextId);
      changed = true;
    }
  }

  if (changed) {
    refreshVisiblePoints();
    normalizeSelection();
  }
  return changed;
}

function visibleCloudPoints() {
  const localPointIds = new Set(state.points.map((point) => point.id));
  return visibleCloudPointLists()
    .flatMap((list) => list.points)
    .map(syncProjectedPoint)
    .filter(Boolean)
    .filter((point) => !localPointIds.has(point.id));
}

function visibleSelectablePoints() {
  return [...state.points, ...visibleCloudPoints()];
}

function pointListStorageKey(list) {
  return list?.source === "cloud" ? `cloud:${list.cloudId || list.id}` : list?.id || "";
}

function editablePointLists() {
  ensurePointLists();
  return [
    ...state.pointLists.filter((list) => list.editable),
    ...state.cloud.pointLists.filter((list) => list.editable)
  ];
}

function pointListByStorageKey(storageKey) {
  return editablePointLists().find((list) => pointListStorageKey(list) === storageKey) ?? null;
}

function isEmptyStoragePlaceholder(list) {
  return Boolean(list?.storagePlaceholder && Array.isArray(list.points) && list.points.length === 0);
}

function registrationDestinationPointLists() {
  return editablePointLists().filter((list) => !isEmptyStoragePlaceholder(list));
}

function defaultPointDestinationListId() {
  const home = pointListByStorageKey(state.activePointListId);
  return home && !isEmptyStoragePlaceholder(home) ? pointListStorageKey(home) : NEW_POINT_LIST_ID;
}

function comparableListName(name) {
  return String(name || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase();
}

function remapLocalListReferences(previousId, nextId) {
  if (state.activePointListId === previousId) state.activePointListId = nextId;
  if (state.pointDestinationListId === previousId) state.pointDestinationListId = nextId;
  if (state.pointTransferDestinationListId === previousId) state.pointTransferDestinationListId = nextId;
  if (state.mobilePointPreviewStorageId === previousId) state.mobilePointPreviewStorageId = nextId;
  if (state.favoriteListIds.has(previousId)) {
    state.favoriteListIds.delete(previousId);
    state.favoriteListIds.add(nextId);
  }
}

function coalesceDuplicateLocalLists() {
  const groups = new Map();
  for (const list of state.pointLists) {
    if (list.source !== "local" || !list.editable) continue;
    const key = comparableListName(list.name);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(list);
    groups.set(key, group);
  }

  const removedIds = new Set();
  let changed = false;
  for (const lists of groups.values()) {
    if (lists.length < 2) continue;
    const canonical = lists.find((list) => (
      list.id === state.activePointListId
      || list.id === state.pointDestinationListId
      || list.id === state.pointTransferDestinationListId
    )) || lists[0];
    const canonicalPointIds = new Set(canonical.points.map((point) => point.id));
    for (const duplicate of lists) {
      if (duplicate === canonical) continue;
      for (const point of duplicate.points) {
        while (canonicalPointIds.has(point.id)) {
          point.id = createId();
        }
        canonicalPointIds.add(point.id);
        canonical.points.push(point);
      }
      canonical.updatedAt = [canonical.updatedAt, duplicate.updatedAt].filter(Boolean).sort().at(-1) || canonical.updatedAt;
      remapLocalListReferences(duplicate.id, canonical.id);
      removedIds.add(duplicate.id);
      changed = true;
    }
  }

  if (removedIds.size > 0) {
    state.pointLists = state.pointLists.filter((list) => !removedIds.has(list.id));
  }
  return changed;
}

function createNamedLocalPointList(name) {
  const normalizedName = String(name || "").trim();
  const existing = state.pointLists.find((list) => (
    list.source === "local"
    && list.editable
    && comparableListName(list.name) === comparableListName(normalizedName)
  ));
  if (existing) {
    const repaired = coalesceDuplicateLocalLists();
    if (repaired) persistWorkspace();
    return state.pointLists.find((list) => (
      list.source === "local"
      && list.editable
      && comparableListName(list.name) === comparableListName(normalizedName)
    )) || existing;
  }

  const now = new Date().toISOString();
  const list = createPointList({
    name: normalizedName,
    visible: true,
    editable: true,
    source: "local",
    importedAt: "",
    createdAt: now,
    updatedAt: now,
    points: []
  });
  state.pointLists.push(list);
  persistWorkspace();
  return list;
}

function kekkaiPointList() {
  let list = state.pointLists.find((item) => item.reservedKind === "kekkai")
    || state.pointLists.find((item) => comparableListName(item.name) === comparableListName(KEKKAI_POINT_LIST_NAME));
  if (!list) list = createNamedLocalPointList(KEKKAI_POINT_LIST_NAME);
  list.reservedKind = "kekkai";
  list.visible = true;
  return list;
}

function migrateLegacyDragonEyePointLists() {
  const legacyLists = state.pointLists.filter((list) => (
    list.source === "local"
    && list.editable
    && comparableListName(list.name) === comparableListName(LEGACY_DRAGON_EYE_LIST_NAME)
  ));
  if (legacyLists.length === 0) return false;

  const destination = kekkaiPointList();
  const destinationPointIds = new Set(destination.points.map((point) => point.id));
  for (const legacy of legacyLists) {
    for (const point of legacy.points) {
      while (destinationPointIds.has(point.id)) point.id = createId();
      destinationPointIds.add(point.id);
      destination.points.push(point);
    }
    destination.updatedAt = [destination.updatedAt, legacy.updatedAt].filter(Boolean).sort().at(-1) || destination.updatedAt;
    remapLocalListReferences(legacy.id, destination.id);
  }
  state.pointLists = state.pointLists.filter((list) => !legacyLists.includes(list));
  return true;
}

async function promptNewPointListForRegistration() {
  const suggestedName = cloudText("新しいリスト", "New list");
  const input = await requestTextInput({
    title: t("list.newPrompt"),
    label: t("field.name"),
    defaultValue: suggestedName,
    submitLabel: cloudText("作成", "Create")
  });
  if (input === null) return null;
  const name = input.trim();
  if (!name) {
    elements.shareImportStatus.value = t("list.nameRequired");
    return null;
  }
  return createNamedLocalPointList(name);
}

function localPointList() {
  ensurePointLists();
  let list = pointListByStorageKey(state.activePointListId);
  if (!list) {
    list = state.pointLists.find((item) => item.id === DEFAULT_POINT_LIST_ID && item.editable)
      ?? state.pointLists.find((item) => item.editable)
      ?? state.cloud.pointLists.find((item) => item.editable);
  }
  if (!list) {
    list = createLocalPointList();
    state.pointLists.unshift(list);
  }
  state.activePointListId = pointListStorageKey(list);
  return list;
}

function ensureActivePointListVisible() {
  const list = pointListByStorageKey(state.activePointListId);
  if (!list) return false;

  if (list.source === "cloud") {
    const cloudId = list.cloudId || list.id;
    const wasHidden = state.cloud.hiddenListIds.has(cloudId);
    state.cloud.hiddenListIds.delete(cloudId);
    return wasHidden;
  }

  if (list.visible === false) {
    list.visible = true;
    list.updatedAt = new Date().toISOString();
    return true;
  }
  return false;
}

function setActivePointList(listId) {
  const list = pointListByStorageKey(listId);
  if (!list || state.activePointListId === pointListStorageKey(list)) return;
  state.activePointListId = pointListStorageKey(list);
  ensureActivePointListVisible();
  persistWorkspace();
  render();
}

function syncPointFormDestinationWithHome(previousHomeKey) {
  if (state.editingPointId) return;
  const previousDefault = previousHomeKey || NEW_POINT_LIST_ID;
  if (state.pointDestinationListId !== previousDefault) return;
  const home = pointListByStorageKey(state.activePointListId);
  state.pointDestinationListId = home ? pointListStorageKey(home) : NEW_POINT_LIST_ID;
}

function toggleActivePointList(listId) {
  const list = pointListByStorageKey(listId);
  if (!list) return;
  const previousHomeKey = state.activePointListId;
  const key = pointListStorageKey(list);
  state.activePointListId = state.activePointListId === key ? null : key;
  if (state.activePointListId === key) {
    ensureActivePointListVisible();
  }
  syncPointFormDestinationWithHome(previousHomeKey);
  persistWorkspace();
  render();
}
async function createNewPointList() {
  const suggestedName = cloudText("新しいリスト", "New list");
  const input = await requestTextInput({
    title: t("list.newPrompt"),
    label: t("field.name"),
    defaultValue: suggestedName,
    submitLabel: cloudText("作成", "Create")
  });
  if (input === null) return;
  const name = input.trim() || suggestedName;
  const list = createNamedLocalPointList(name);
  state.activePointListId = list.id;
  persistWorkspace();
  setCloudStatus(t("list.created"));
  render();
}

function uniqueCopiedListName(sourceName) {
  const baseName = String(sourceName || cloudText("地点リスト", "Point list")).trim();
  const stem = activeLanguage() === EN_LANGUAGE ? `${baseName} copy` : `${baseName} のコピー`;
  const existingNames = new Set(state.pointLists.map((list) => list.name));
  if (!existingNames.has(stem)) return stem;
  let index = 2;
  while (existingNames.has(`${stem} ${index}`)) index += 1;
  return `${stem} ${index}`;
}

function copyStorageList(storageId) {
  const entry = findStorageListEntry(storageId);
  const source = entry?.local ?? entry?.preview ?? null;
  if (!source) return;
  const now = new Date().toISOString();
  const points = source.points.map((point) => ({
    ...clonePlain(point),
    id: createId(),
    updatedAt: now
  }));
  const copy = createPointList({
    name: uniqueCopiedListName(source.name),
    description: source.description,
    author: source.author,
    visible: true,
    editable: true,
    source: "local",
    importedAt: "",
    createdAt: now,
    updatedAt: now,
    points
  });
  state.pointLists.push(copy);
  state.activePointListId = copy.id;
  refreshVisiblePoints();
  persistWorkspace();
  setCloudStatus(cloudText(`「${copy.name}」を作成し、登録先にしました`, `Created “${copy.name}” and set it as the destination`));
  render();
}

function pointTransferDestinationList() {
  return pointListByStorageKey(state.pointTransferDestinationListId);
}

function transferableSelectedPoints(destinationList = null, mode = "copy") {
  normalizeSelection();
  return selectedPointIds()
    .filter((pointId) => pointId !== CURRENT_LOCATION_ID)
    .map((pointId) => {
      const point = findPointAny(pointId);
      const sourceList = pointListForPoint(pointId);
      return { point, sourceList };
    })
    .filter(({ point, sourceList }) => Boolean(point && sourceList && (mode !== "move" || sourceList.editable) && (!destinationList || sourceList !== destinationList)));
}

function beginPointTransfer(mode) {
  const candidates = transferableSelectedPoints(null, mode);
  if (candidates.length === 0) {
    showAppToast(t("list.transferNoSelection"), { error: true });
    render();
    return;
  }

  state.pendingPointTransferMode = mode;
  state.pointTransferDestinationListId = "";
  render();
  requestAnimationFrame(() => {
    if (!elements.pointTransferDialog.open) elements.pointTransferDialog.showModal();
    const firstDestination = elements.pointTransferDestinationList.querySelector("button");
    firstDestination?.focus();
  });
}

function cancelPointTransfer() {
  state.pendingPointTransferMode = null;
  state.pointTransferDestinationListId = "";
  if (elements.pointTransferDialog.open) elements.pointTransferDialog.close("cancel");
  render();
}

async function createPointTransferDestinationList() {
  if (!state.pendingPointTransferMode) return;
  const suggestedName = cloudText("新しいリスト", "New list");
  const input = await requestTextInput({
    title: t("list.newPrompt"),
    label: t("field.name"),
    defaultValue: suggestedName,
    submitLabel: cloudText("作成", "Create")
  });
  if (input === null) return;
  const name = input.trim() || suggestedName;
  const list = createNamedLocalPointList(name);
  state.pointTransferDestinationListId = list.id;
  persistWorkspace();
  choosePointTransferDestination();
}

function choosePointTransferDestination() {
  const mode = state.pendingPointTransferMode;
  if (!mode || !pointTransferDestinationList()) return;
  state.pendingPointTransferMode = null;
  if (elements.pointTransferDialog.open) elements.pointTransferDialog.close("selected");
  void transferSelectedPointsToActiveList(mode);
}

function renderPointTransferDialog() {
  const mode = state.pendingPointTransferMode;
  const editableLists = editablePointLists();
  elements.pointTransferDialogTitle.textContent = mode === "move"
    ? t("list.transferDialogMoveTitle")
    : mode === "copy"
      ? t("list.transferDialogCopyTitle")
      : "";
  elements.pointTransferDialogHint.textContent = mode ? t("list.transferDialogHint") : "";
  elements.pointTransferDestinationList.replaceChildren();
  if (editableLists.length === 0 && mode) {
    const empty = document.createElement("div");
    empty.className = "point-transfer-dialog-empty";
    empty.textContent = t("list.transferDialogEmpty");
    elements.pointTransferDestinationList.append(empty);
  }
  for (const list of editableLists) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "point-transfer-destination-button";
    button.dataset.destinationListId = pointListStorageKey(list);
    const name = document.createElement("span");
    name.className = "point-transfer-destination-name";
    name.textContent = list.name;
    const count = document.createElement("span");
    count.className = "point-transfer-destination-count";
    count.textContent = `${list.points.length}${t("label.points")}`;
    button.append(name, count);
    button.addEventListener("click", () => {
      state.pointTransferDestinationListId = pointListStorageKey(list);
      choosePointTransferDestination();
    });
    button.disabled = !mode;
    elements.pointTransferDestinationList.append(button);
  }
  elements.createPointTransferListButton.disabled = !mode;
}

async function transferSelectedPointsToActiveList(mode) {
  const destinationList = pointTransferDestinationList();
  if (!destinationList) {
    showAppToast(t("list.transferSelectDestination"), { error: true });
    render();
    return;
  }
  const candidates = transferableSelectedPoints(destinationList, mode);
  if (candidates.length === 0) {
    showAppToast(t("list.transferNoSelection"), { error: true });
    render();
    return;
  }

  const syncLists = new Set([destinationList, ...candidates.map(({ sourceList }) => sourceList)]
    .filter((list) => list?.source === "cloud"));
  const now = new Date().toISOString();
  let transferredIds;
  if (mode === "copy") {
    const copies = candidates.map(({ point }) => ({
      ...clonePlain(point),
      id: createId(),
      updatedAt: now
    }));
    destinationList.points.push(...copies);
    transferredIds = copies.map((point) => point.id);
  } else {
    const sourceLists = new Set(candidates.map(({ sourceList }) => sourceList));
    for (const sourceList of sourceLists) {
      sourceList.points = sourceList.points.filter((point) => (
        !candidates.some((candidate) => candidate.sourceList === sourceList && candidate.point.id === point.id)
      ));
      sourceList.updatedAt = now;
    }
    destinationList.points.push(...candidates.map(({ point }) => point));
    transferredIds = candidates.map(({ point }) => point.id);
  }

  destinationList.updatedAt = now;
  refreshVisiblePoints();
  state.selection = transferredIds.map((id) => ({ type: "point", id }));
  normalizeSelection();
  persistWorkspace();
  for (const list of syncLists) {
    const current = state.cloud.pointLists.find((item) => (item.cloudId || item.id) === (list.cloudId || list.id)) || list;
    if (!(await updateCloudPointList(current, current))) { render(); return; }
  }
  showAppToast(t(mode === "copy" ? "list.copiedPoints" : "list.movedPoints")
    .replace("{name}", destinationList.name)
    .replace("{count}", String(transferredIds.length)));
  render();
}

function geometryStorageLists() {
  ensurePointLists();
  return state.pointLists.filter((list) => list.reservedKind !== "kekkai");
}

function geometryDestinationForPoints(pointIds) {
  const sourceLists = pointIds
    .map(pointListForPoint)
    .filter(Boolean);
  const sourceKeys = new Set(sourceLists.map(pointListStorageKey).filter(Boolean));

  if (sourceKeys.size === 1) {
    const sourceKey = sourceKeys.values().next().value;
    const sourceList = state.pointLists.find((list) => pointListStorageKey(list) === sourceKey);
    if (sourceList) return sourceList;
  }

  return state.pointLists.find((list) => (
    list.id === state.activePointListId && list.editable && list.reservedKind !== "kekkai"
  )) ?? null;
}

function beginGeometryDestinationSelection(pointIds, closeShape) {
  state.pendingGeometryDestination = { pointIds: [...pointIds], closeShape };
  render();
  requestAnimationFrame(() => {
    if (!elements.geometryDestinationDialog.open) elements.geometryDestinationDialog.showModal();
    (elements.geometryDestinationList.querySelector("button") || elements.cancelGeometryDestinationButton)?.focus();
  });
}

function cancelGeometryDestinationSelection() {
  state.pendingGeometryDestination = null;
  if (elements.geometryDestinationDialog.open) elements.geometryDestinationDialog.close("cancel");
  render();
}

function chooseGeometryDestination(listId) {
  const pending = state.pendingGeometryDestination;
  const destination = geometryStorageLists().find((list) => list.id === listId);
  if (!pending || !destination) return;
  state.pendingGeometryDestination = null;
  if (elements.geometryDestinationDialog.open) elements.geometryDestinationDialog.close("selected");
  finishConnectingSelectedPoints(pending.pointIds, pending.closeShape, destination);
}

function renderGeometryDestinationDialog() {
  const pending = state.pendingGeometryDestination;
  elements.geometryDestinationDialogTitle.textContent = t("line.destinationTitle");
  elements.geometryDestinationDialogHint.textContent = pending ? t("line.destinationMessage") : "";
  elements.geometryDestinationList.setAttribute("aria-label", t("line.destinationLabel"));
  elements.geometryDestinationList.replaceChildren();

  if (pending && geometryStorageLists().length === 0) {
    const empty = document.createElement("div");
    empty.className = "point-transfer-dialog-empty";
    empty.textContent = t("line.destinationEmpty");
    elements.geometryDestinationList.append(empty);
  }

  for (const list of geometryStorageLists()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "point-transfer-destination-button";
    button.dataset.geometryDestinationListId = list.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", `${list.name} ${list.points.length}${t("label.points")}`);
    const name = document.createElement("span");
    name.className = "point-transfer-destination-name";
    name.textContent = list.name;
    const count = document.createElement("span");
    count.className = "point-transfer-destination-count";
    count.textContent = `${list.points.length}${t("label.points")}`;
    button.append(name, count);
    button.addEventListener("click", () => chooseGeometryDestination(list.id));
    button.disabled = !pending;
    elements.geometryDestinationList.append(button);
  }
}

function pointListForPoint(pointId) {
  ensurePointLists();
  return state.pointLists.find((list) => list.points.some((point) => point.id === pointId))
    ?? state.cloud.pointLists.find((list) => list.points.some((point) => point.id === pointId))
    ?? null;
}

function findPointAny(pointId) {
  return [...allPointListPoints(), ...state.cloud.pointLists.flatMap((list) => list.points)]
    .find((point) => point.id === pointId) ?? null;
}
function pointEditable(pointId) {
  const list = pointListForPoint(pointId);
  return Boolean(list?.editable);
}

function normalizePointList(list, existingPointIds = new Set(), fallbackName = "地点リスト") {
  const rawPoints = Array.isArray(list?.points) ? list.points : [];
  const points = rawPoints.map((point) => normalizePoint(point, null)).filter(Boolean);
  for (const point of points) {
    while (existingPointIds.has(point.id)) {
      point.id = createId();
    }
    existingPointIds.add(point.id);
  }

  const normalized = createPointList({
    id: typeof list?.id === "string" && list.id ? list.id : createId(),
    name: typeof list?.name === "string" && list.name.trim() ? list.name.trim() : fallbackName,
    description: typeof list?.description === "string" ? list.description : "",
    author: typeof list?.author === "string" ? list.author : "",
    visible: list?.visible !== false,
    editable: Boolean(list?.editable),
    source: typeof list?.source === "string" ? list.source : "import",
    storagePlaceholder: list?.storagePlaceholder === true,
    cloudId: typeof list?.cloudId === "string" ? list.cloudId : "",
    cloudScope: list?.cloudScope === "mine" ? "mine" : "",
    cloudRevision: Number.isInteger(list?.cloudRevision) ? list.cloudRevision : null,
    cloudUpdatedAt: typeof list?.cloudUpdatedAt === "string" ? list.cloudUpdatedAt : "",
    gridAtlas: list?.gridAtlas && typeof list.gridAtlas === "object" ? clonePlain(list.gridAtlas) : null,
    importedAt: typeof list?.importedAt === "string" ? list.importedAt : new Date().toISOString(),
    createdAt: typeof list?.createdAt === "string" ? list.createdAt : new Date().toISOString(),
    updatedAt: typeof list?.updatedAt === "string" ? list.updatedAt : new Date().toISOString(),
    points,
    lines: Array.isArray(list?.lines) ? list.lines : [],
    figures: Array.isArray(list?.figures) ? list.figures : [],
    reservedKind: list?.reservedKind === "kekkai" ? "kekkai" : ""
  });

  if (normalized.id === DEFAULT_POINT_LIST_ID) {
    normalized.name = normalized.name || "マイ地点";
    normalized.editable = true;
    normalized.source = "local";
  }

  return normalized;
}

function pruneHiddenPointReferences() {
  const current = currentLocationPoint();
  const visibleIds = visiblePointIdSet();
  if (current) {
    visibleIds.add(CURRENT_LOCATION_ID);
  }
  const pointInfoReturnSelectionIds = new Set(
    (state.pointInfoReturnContext?.selection || [])
      .filter((entry) => entry?.type === "point")
      .map((entry) => entry.id)
  );
  state.selection = state.selection.filter((entry) => (
    entry.type !== "point"
    || visibleIds.has(entry.id)
    || pointInfoReturnSelectionIds.has(entry.id)
  ));
  state.routeSelectionIds = state.routeSelectionIds.filter((id) => visibleIds.has(id));

  if (state.routeStartPointId && state.routeStartPointId !== CURRENT_LOCATION_ID && !visibleIds.has(state.routeStartPointId)) {
    clearRouteStartState();
  }

  if (state.targetPointId && !visibleIds.has(state.targetPointId)) {
    clearTarget({ render: false });
  }

  if (state.routeResult?.pointIds?.some((id) => !visibleIds.has(id))) {
    state.routeResult = null;
  }
}

function safeFilenamePart(value) {
  return String(value || "list")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "list";
}

function cssColorVariable(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function barrierShareColors() {
  const palette = canvasPalette();
  return {
    background: cssColorVariable("--canvas-bg", "#fbf7fb"),
    surface: cssColorVariable("--surface", "#fffafd"),
    surfaceStrong: cssColorVariable("--surface-strong", "#f2e9f5"),
    line: cssColorVariable("--line", "#decfe2"),
    text: cssColorVariable("--text", "#433a49"),
    muted: cssColorVariable("--muted", "#7c6c83"),
    accent: palette.traverseFill,
    accentStrong: cssColorVariable("--accent-strong", palette.selected)
  };
}

function barrierShareGeometry(score) {
  const barrier = state.traverseLog?.barriers?.[score?.barrierId];
  if (!barrier) return [];
  const figure = barrierFigureForId(score.barrierId);
  return barrierStoneIds(barrier).map((stoneId, index) => ({
    geo: figure?.vertices?.[index]
      ? { lat: figure.vertices[index].lat, lng: figure.vertices[index].lng }
      : tileCenterGeo(state.traverseLog?.stones?.[stoneId]?.tile),
    count: stoneDisplayCount(state.traverseLog?.stones?.[stoneId])
  })).filter((vertex) => vertex.geo);
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png");
  });
}

async function renderBarrierShareImage(score) {
  const geometry = barrierShareGeometry(score);
  if (geometry.length < 3) throw new Error("Barrier geometry unavailable");

  const width = 1200;
  const height = 900;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  const colors = barrierShareColors();
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = colors.line;
  context.lineWidth = 2;
  context.strokeRect(32, 32, width - 64, height - 64);

  const title = score.name || t("barrier.defaultName");
  context.fillStyle = colors.muted;
  context.font = "700 22px system-ui, sans-serif";
  context.fillText("GRID ATLAS / 結界", 82, 86);
  context.fillStyle = colors.text;
  context.font = "800 42px system-ui, sans-serif";
  context.fillText(title.slice(0, 24), 82, 136);

  const originLat = geometry.reduce((sum, vertex) => sum + vertex.geo.lat, 0) / geometry.length;
  const originLng = geometry.reduce((sum, vertex) => sum + vertex.geo.lng, 0) / geometry.length;
  const local = geometry.map((vertex) => ({
    x: (vertex.geo.lng - originLng) * Math.cos(originLat * Math.PI / 180),
    y: originLat - vertex.geo.lat,
      count: stoneDisplayCount(vertex)
  }));
  const minX = Math.min(...local.map((point) => point.x));
  const maxX = Math.max(...local.map((point) => point.x));
  const minY = Math.min(...local.map((point) => point.y));
  const maxY = Math.max(...local.map((point) => point.y));
  const rangeX = Math.max(maxX - minX, 0.000001);
  const rangeY = Math.max(maxY - minY, 0.000001);
  const mapLeft = 120;
  const mapTop = 184;
  const mapWidth = 720;
  const mapHeight = 470;
  const mapPoints = local.map((point) => ({
    x: mapLeft + ((point.x - minX) / rangeX) * mapWidth,
    y: mapTop + ((point.y - minY) / rangeY) * mapHeight,
    count: point.count
  }));

  context.beginPath();
  context.moveTo(mapPoints[0].x, mapPoints[0].y);
  for (const point of mapPoints.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = colors.accent;
  context.globalAlpha = 0.2;
  context.fill("nonzero");
  context.globalAlpha = 1;
  context.strokeStyle = colors.accent;
  context.lineWidth = 8;
  context.lineJoin = "round";
  context.stroke();

  for (const point of mapPoints) {
    context.beginPath();
    context.fillStyle = colors.surface;
    context.strokeStyle = colors.accentStrong;
    context.lineWidth = 5;
    context.arc(point.x, point.y, 18, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = colors.text;
    context.font = "800 18px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(point.count), point.x, point.y);
  }
  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  const cardLeft = 890;
  const cardTop = 184;
  const cardWidth = 220;
  const cardHeight = 118;
  const stats = [
    [t("barrier.scoreTitle"), `${formatScoreValue(score.power)} 力`],
    [t("barrier.scoreArea"), `${formatAreaValue(score.areaKm2)} km²`],
    [t("barrier.scoreStones"), `${Math.floor(score.effectiveStoneCount)} / ${score.stoneCount}`]
  ];
  stats.forEach(([label, value], index) => {
    const top = cardTop + index * (cardHeight + 18);
    context.fillStyle = colors.surface;
    context.fillRect(cardLeft, top, cardWidth, cardHeight);
    context.strokeStyle = colors.line;
    context.lineWidth = 2;
    context.strokeRect(cardLeft, top, cardWidth, cardHeight);
    context.fillStyle = colors.muted;
    context.font = "700 18px system-ui, sans-serif";
    context.fillText(label, cardLeft + 22, top + 34);
    context.fillStyle = colors.text;
    context.font = "800 30px system-ui, sans-serif";
    context.fillText(value, cardLeft + 22, top + 82);
  });

  context.fillStyle = colors.accentStrong;
  context.font = "800 32px system-ui, sans-serif";
  const rank = rankForBarrier(state.traverseLog, score.barrierId);
  context.fillText(`${rank.name}（${rank.reading}）`, 120, 720);
  context.fillStyle = colors.muted;
  context.font = "600 18px system-ui, sans-serif";
  context.fillText(`${t("barrier.scoreShape")} ${formatFactor(score.shapeCoefficient)}  /  ${t("barrier.scoreBeauty")} ${formatFactor(score.beautyCoefficient)}`, 120, 758);
  context.fillText("gridatlas.github.io/GRID_ATLAS/", 120, 824);
  context.textAlign = "right";
  context.fillText("#GRIDATLAS  #結界", 1080, 824);

  return canvasToPngBlob(canvas);
}

async function shareSelectedBarrierImage() {
  const score = state.selectedBarrierId ? scoreBarrier(state.traverseLog, state.selectedBarrierId) : null;
  if (!score) {
    setShareFeedback(t("barrier.shareFailed"), { error: true });
    return;
  }

  try {
    const blob = await renderBarrierShareImage(score);
    const file = new File([blob], `grid-atlas-kekkai-${safeFilenamePart(score.name || t("barrier.defaultName"))}.png`, { type: "image/png" });
    const canShareFile = typeof navigator.share === "function"
      && (!navigator.canShare || navigator.canShare({ files: [file] }));
    if (canShareFile) {
      try {
        const shareText = t("barrier.shareText")
          .replace("{name}", score.name || t("barrier.defaultName"))
          .replace("{rank}", rankForBarrier(state.traverseLog, score.barrierId).name)
          .replace("{power}", formatScoreValue(score.power));
        await navigator.share({ files: [file], title: `GRID ATLAS — ${score.name || t("barrier.defaultName")}`, text: shareText });
        setShareFeedback(t("barrier.shared"));
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.warn("GRID ATLAS barrier image share failed; falling back to download", error);
      }
    }
    downloadGridAtlasFile(file);
    setShareFeedback(t("barrier.downloaded"));
  } catch (error) {
    console.warn("GRID ATLAS barrier image export failed", error);
    setShareFeedback(t("barrier.shareFailed"), { error: true });
  }
}

function syncProjectedPoint(point) {
  if (!point || typeof point !== "object") {
    return null;
  }

  const geo = pointGeoFromAny(point, null);
  if (!geo) {
    return null;
  }

  const projected = projectGeo(geo);
  point.geo = geo;
  point.x = projected.x;
  point.y = projected.y;
  return point;
}

function syncProjectedCoordinates() {
  ensurePointLists();
  for (const point of allPointListPoints()) {
    syncProjectedPoint(point);
  }
  for (const list of state.cloud.pointLists) {
    for (const point of list.points) {
      syncProjectedPoint(point);
    }
  }

  syncProjectedPoint(state.routeStartSnapshot);
  syncProjectedPoint(state.observationStart);
  for (const point of state.observationTrail) {
    syncProjectedPoint(point);
  }

  for (const observation of state.loadedObservations) {
    syncProjectedPoint(observation.start);
    syncProjectedPoint(observation.target);
    if (Array.isArray(observation.trail)) {
      for (const point of observation.trail) {
        syncProjectedPoint(point);
      }
    }
  }
}
function pointGeoFromAny(point, origin) {
  if (validGeo(point.geo)) {
    return normalizeGeo(point.geo);
  }

  if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    return normalizeGeo({ lat: point.lat, lng: point.lng, accuracy: point.accuracy });
  }

  if (origin && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const lat = origin.lat + point.y / 111320;
    const lng = origin.lng + point.x / (111320 * Math.cos((origin.lat * Math.PI) / 180));
    return normalizeGeo({ lat, lng });
  }

  if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
    return normalizeGeo(unprojectMercator(point.x, point.y));
  }

  return null;
}

function workspaceSnapshot() {
  ensurePointLists();
  const transientAnalysisIds = state.transientAnalysisIds;
  const pointLists = state.pointLists.filter((list) => list.transient !== true).map((list) => ({
    ...(({ transientAnalysisIds: _transientAnalysisIds, ...persistedList }) => persistedList)(list),
    lines: (list.lines || []).filter((line) => !transientAnalysisIds.has(line.id)).map(clonePlain),
    figures: (list.figures || []).filter((figure) => !transientAnalysisIds.has(figure.id)).map(clonePlain),
    points: list.points.map((point) => ({
      ...point,
      photo: point.photoAssetId ? "" : point.photo
    }))
  }));
  return {
    version: 4,
    projection: { mode: "local", version: 1 },
    pointLists,
    activePointListId: state.activePointListId,
    favoriteListIds: [...state.favoriteListIds],
    storageListSectionCollapsed: { ...state.storageListSectionCollapsed },
    cloudHiddenListIds: [...state.cloud.hiddenListIds],
    testerSharedCloudListIds: [...state.cloud.testerSharedListIds],
    cloudListOrder: [...state.cloud.listOrder]
  };
}

function persistWorkspace() {
  if (state.traverseLog) state.traverseLog.figures = state.figures;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceSnapshot()));
}

async function hydrateWorkspaceAssetPhotos() {
  const changed = await hydrateGridAtlasAssets(state.pointLists);
  if (changed) persistWorkspace();
  refreshVisiblePoints();
  render();
}

async function hydratePointPhotoForDisplay(point) {
  if (!point || !point.photoAssetId) return false;
  const url = await gridAtlasAssetUrl(point.photoAssetId);
  if (url) {
    if (point.photo === url) return false;
    point.photo = url;
    return true;
  }
  if (point.photo) {
    point.photo = "";
    return true;
  }
  return false;
}

function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  canvasMetrics = { width, height, dpr };

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeCanvas() {
  syncCanvasSize();
  syncTraverseQuantityDialogPosition();
  draw();
}

function scheduleCanvasResize() {
  if (canvasResizeFrame) {
    return;
  }

  canvasResizeFrame = window.requestAnimationFrame(() => {
    canvasResizeFrame = 0;
    resizeCanvas();
  });
}

function canvasSize() {
  if (canvasMetrics.width > 0 && canvasMetrics.height > 0) {
    return {
      width: canvasMetrics.width,
      height: canvasMetrics.height
    };
  }

  const rect = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  };
}

function clampScale(scale) {
  return Math.min(24, Math.max(0.000006, scale));
}

function worldToScreen(point) {
  const size = canvasSize();
  return {
    x: size.width / 2 + (point.x - state.viewport.x) * state.viewport.scale,
    y: size.height / 2 - (point.y - state.viewport.y) * state.viewport.scale
  };
}

function screenToWorld(point) {
  const size = canvasSize();
  return {
    x: state.viewport.x + (point.x - size.width / 2) / state.viewport.scale,
    y: state.viewport.y - (point.y - size.height / 2) / state.viewport.scale
  };
}

function chooseGridStep() {
  const candidates = [
    1, 2, 5, 10, 20, 50, 100, 200, 500,
    1000, 2000, 5000, 10000, 20000, 50000,
    100000, 200000, 500000, 1000000, 2000000,
    5000000, 10000000
  ];
  return candidates.find((step) => step * state.viewport.scale >= 48) ?? 20000000;
}

function viewportCenterGeo() {
  return unprojectWorld(state.viewport.x, state.viewport.y);
}

function drawGrid(width, height) {
  const majorGroundStep = chooseGridStep();
  const majorStep = majorGroundStep;
  const minorStep = majorStep / 5;
  const topLeft = screenToWorld({ x: 0, y: 0 });
  const bottomRight = screenToWorld({ x: width, y: height });

  const colors = canvasPalette();
  const barrierLinkVisualActive = state.barrierLinkPath.length > 0
    || Boolean(state.barrierLinkPendingStoneId && state.barrierLinkPendingStartedAt)
    || state.barrierLinkDiamondAnimations.length > 0
    || Boolean(state.barrierLinkCompletion);
  const gridMinor = barrierLinkVisualActive ? "rgb(242 138 46 / 0.2)" : colors.gridMinor;
  const gridMajor = barrierLinkVisualActive ? "rgb(242 138 46 / 0.48)" : colors.gridMajor;
  const gridGlow = currentTheme() === KEKKAI_THEME && !barrierLinkVisualActive;
  if (gridGlow) {
    context.save();
    context.shadowColor = "rgb(150 82 190 / 0.4)";
    context.shadowBlur = 5;
  }
  drawGridLines(topLeft, bottomRight, minorStep, gridMinor, 1);
  drawGridLines(topLeft, bottomRight, majorStep, gridMajor, 1.25);
  if (gridGlow) context.restore();
}

function traverseTilePolygon(tileId) {
  const bounds = tileBounds(tileId);
  if (!bounds || bounds.z !== BARRIER_CONFIG.dataZoom) return null;
  return tileBoundaryGeos(tileId).map((corner) => projectLatLng(corner.lat, corner.lng)).map(worldToScreen);
}

function tileBoundaryGeos(tileId) {
  const bounds = tileBounds(tileId);
  if (!bounds) return [];
  return (bounds.corners || [
    { lat: bounds.north, lng: bounds.west },
    { lat: bounds.north, lng: bounds.east },
    { lat: bounds.south, lng: bounds.east },
    { lat: bounds.south, lng: bounds.west }
  ]).filter(validGeo);
}

function displayedTraverseTilePolygon(tileId) {
  const polygon = traverseTilePolygon(tileId);
  if (!polygon) return null;
  return polygon;
}

function drawTraversePolygon(points, options = {}) {
  if (!points || points.length !== 4) return;
  const center = points.reduce((sum, point) => ({
    x: sum.x + point.x / points.length,
    y: sum.y + point.y / points.length
  }), { x: 0, y: 0 });
  const scale = Number.isFinite(options.scale) ? options.scale : 1;
  const scaled = points.map((point) => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale
  }));

  context.beginPath();
  context.moveTo(scaled[0].x, scaled[0].y);
  for (const point of scaled.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  if (options.fill) context.fill();
  if (options.stroke) context.stroke();
}

function drawTraverseStones(options = {}) {
  if (!state.traverseMode || !state.traverseLog) return;
  const colors = canvasPalette();
  const availableOnly = options.availableOnly === true;
  const roomStoneIds = state.barrierLinkPreview
    ? new Set(state.barrierLinkSourceSelection.length > 0
      ? state.barrierLinkSourceSelection
      : state.barrierSelection)
    : null;
  const availableStoneIds = availableOnly
    ? (roomStoneIds || new Set(availableBarrierStoneIds()))
    : null;
  for (const stone of Object.values(state.traverseLog?.stones || {})) {
    const stoneId = stoneIdFromTile(stone.tile);
    if (stoneDisplayCount(stone) <= 0) continue;
    if (availableStoneIds && !availableStoneIds.has(stoneId)) continue;
    if (roomStoneIds && !roomStoneIds.has(stoneId)) continue;
    const polygon = displayedTraverseTilePolygon(stone.tile);
    if (!polygon) continue;
    if (state.barrierLinkPreview) {
      drawBarrierLinkRoomStone(barrierStoneScreenCenter(stoneId));
      continue;
    }
    const selected = stoneId
      ? state.barrierSelection.includes(stoneId) || stoneId === state.barrierLinkCandidateStoneId
        || stoneId === state.barrierLinkPendingStoneId
      : false;
    const activated = Boolean(stoneId && barrierIdForStone(state.traverseLog, stoneId));
    const cellColor = activated
      ? BARRIER_LINK_ORANGE
      : selected ? colors.barrierCellSelected : colors.barrierCell;
    const diagonal = Math.hypot(polygon[2].x - polygon[0].x, polygon[2].y - polygon[0].y);
    const glyphMode = state.barrierStoneGlyphMode.has(stoneId);
    if (glyphMode ? diagonal > BARRIER_TILE_MIN_SCREEN_SIZE * 1.2 : diagonal < BARRIER_TILE_MIN_SCREEN_SIZE * 0.8) {
      if (glyphMode) state.barrierStoneGlyphMode.delete(stoneId);
      else state.barrierStoneGlyphMode.add(stoneId);
    }
    const useGlyph = state.barrierStoneGlyphMode.has(stoneId);
    context.save();
    if (useGlyph) {
      const center = polygon.reduce((sum, point) => ({
        x: sum.x + point.x / polygon.length,
        y: sum.y + point.y / polygon.length
      }), { x: 0, y: 0 });
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "20px sans-serif";
      context.globalAlpha = selected ? 1 : 0.94;
      context.fillStyle = cellColor;
      context.fillText("◆", center.x, center.y);
      context.restore();
      continue;
    }
    context.fillStyle = cellColor;
    const barrierGlow = activated ? activeBarrierGlow() : 0;
    context.globalAlpha = selected ? 0.32 : activated ? 0.25 + barrierGlow * 0.1 : 0.2;
    drawTraversePolygon(polygon, { fill: true });
    context.globalAlpha = activated ? 0.72 + barrierGlow * 0.18 : 0.72;
    context.strokeStyle = cellColor;
    context.lineWidth = selected || activated ? 2.75 : 1.25;
    if (activated) {
      context.shadowColor = cellColor;
      context.shadowBlur = 8 + barrierGlow * 10;
    }
    drawTraversePolygon(polygon, { stroke: true });
    drawTraverseTileCount(polygon, stoneDisplayCount(stone), colors, cellColor);
    context.restore();
  }
}

function drawTraverseTiles() {
  if (!state.traverseMode || !state.traverseLog) return;
  const colors = canvasPalette();
  drawTraverseStones();
  drawTraverseBarriers();

  const currentGeo = state.currentGeo;
  const currentTileId = currentGeo ? tileIdFromGeo(currentGeo) : null;
  const preview = currentTileId ? traverseTilePolygon(currentTileId) : null;
  if (!preview) return;
  const placing = state.traverseQuantityAction === "place";
  context.save();
  context.fillStyle = colors.barrierCell;
  context.globalAlpha = placing ? 0.14 : 0.06;
  drawTraversePolygon(preview, { fill: true });
  context.globalAlpha = placing ? 0.96 : 0.56;
  context.strokeStyle = placing ? colors.barrierCellSelected : colors.barrierCell;
  context.lineWidth = placing ? 1.8 : 1.2;
  context.setLineDash([4, 4]);
  drawTraversePolygon(preview, { stroke: true });
  context.setLineDash([]);
  context.restore();
  if (placing) drawBarrierPlacementDiamond(preview, colors);
}

function drawBarrierPlacementDiamond(polygon, colors) {
  if (!Array.isArray(polygon) || polygon.length < 4) return;
  const center = polygon.reduce((sum, point) => ({
    x: sum.x + point.x / polygon.length,
    y: sum.y + point.y / polygon.length
  }), { x: 0, y: 0 });
  const width = Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x));
  const height = Math.max(...polygon.map((point) => point.y)) - Math.min(...polygon.map((point) => point.y));
  const radius = Math.max(18, Math.min(72, Math.max(width, height) * 0.62));
  const points = [
    { x: center.x, y: center.y - radius },
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
    { x: center.x - radius, y: center.y }
  ];

  context.save();
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = colors.barrierCellSelected;
  context.globalAlpha = 0.05;
  context.fill();
  context.globalAlpha = 0.96;
  context.strokeStyle = colors.barrierCellSelected;
  context.lineWidth = 1.8;
  context.setLineDash([5, 4]);
  context.stroke();
  context.restore();
}

function drawDragonEyePreview() {
  if (!state.dragonEye.active) return;
  const vertices = dragonEyeScreenVertices();
  if (vertices.length < 3) return;
  const colors = canvasPalette();
  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.18;
  context.fillStyle = colors.selected || "#c76cff";
  context.beginPath();
  context.moveTo(vertices[0].x, vertices[0].y);
  for (const vertex of vertices.slice(1)) context.lineTo(vertex.x, vertex.y);
  context.closePath();
  context.fill();
  context.restore();
}

function barrierStoneScreenCenter(stoneId) {
  const stone = state.traverseLog?.stones?.[stoneId];
  const geo = stone ? tileCenterGeo(stone.tile) : null;
  const projected = geo ? projectLatLng(geo.lat, geo.lng) : null;
  return projected ? worldToScreen(projected) : null;
}

function barrierLinkRoomFrame(size = canvasSize()) {
  const margin = Math.max(18, Math.min(34, Math.min(size.width, size.height) * 0.05));
  return {
    x: margin,
    y: margin,
    width: Math.max(1, size.width - margin * 2),
    height: Math.max(1, size.height - margin * 2)
  };
}

function isInsideBarrierLinkRoom(point, size = canvasSize()) {
  const frame = barrierLinkRoomFrame(size);
  return point.x >= frame.x
    && point.x <= frame.x + frame.width
    && point.y >= frame.y
    && point.y <= frame.y + frame.height;
}

function drawBarrierLinkRoom(size) {
  const frame = barrierLinkRoomFrame(size);
  context.save();
  context.fillStyle = BARRIER_LINK_ROOM_BG;
  context.fillRect(0, 0, size.width, size.height);
  context.strokeStyle = BARRIER_LINK_ROOM_BORDER;
  context.lineWidth = 2.5;
  context.shadowColor = "rgb(125 59 176 / 0.52)";
  context.shadowBlur = 18;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);
  context.shadowBlur = 0;
  const inset = 10;
  context.strokeStyle = BARRIER_LINK_ROOM_INNER_BORDER;
  context.lineWidth = 1.5;
  context.globalAlpha = 0.9;
  context.strokeRect(
    frame.x + inset,
    frame.y + inset,
    Math.max(1, frame.width - inset * 2),
    Math.max(1, frame.height - inset * 2)
  );
  context.restore();
}

function drawBarrierLinkRoomStone(center) {
  if (!center) return;
  const radius = Math.max(10, Math.min(17, Math.min(canvas.width, canvas.height) * 0.024));
  const points = [
    { x: center.x, y: center.y - radius },
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
    { x: center.x - radius, y: center.y }
  ];
  context.save();
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = "#8f49c6";
  context.globalAlpha = 0.96;
  context.shadowColor = "rgb(181 107 229 / 0.96)";
  context.shadowBlur = 20;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "#edc9ff";
  context.lineWidth = 2.2;
  context.stroke();
  context.restore();
}

function strokeBarrierLinkPoints(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  if (options.close) context.closePath();
  const width = Number.isFinite(options.width) ? options.width : 2.2;
  const glow = Number.isFinite(options.glow) ? options.glow : 28;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = BARRIER_LINK_GLOW;
  context.lineWidth = width + 4;
  context.shadowColor = BARRIER_LINK_GLOW;
  context.shadowBlur = glow;
  context.stroke();
  context.strokeStyle = BARRIER_LINK_CORE;
  context.lineWidth = width;
  context.shadowColor = "rgb(255 240 204 / 0.96)";
  context.shadowBlur = 5;
  context.stroke();
}

function drawBarrierLinkPath(path, options = {}) {
  const vertices = path.map(barrierStoneScreenCenter).filter(Boolean);
  strokeBarrierLinkPoints(vertices, options);
}

function barrierLinkStrokePoints(path, progress) {
  const vertices = path.map(barrierStoneScreenCenter).filter(Boolean);
  if (vertices.length < 2) return [];

  const boundedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const segments = vertices.map((from, index) => {
    const to = vertices[(index + 1) % vertices.length];
    return {
      from,
      to,
      length: Math.hypot(to.x - from.x, to.y - from.y)
    };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = totalLength * boundedProgress;
  const points = [vertices[0]];

  for (const segment of segments) {
    if (remaining <= 0) break;
    if (segment.length <= remaining) {
      points.push(segment.to);
      remaining -= segment.length;
      continue;
    }

    const ratio = segment.length > 0 ? remaining / segment.length : 0;
    points.push({
      x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
      y: segment.from.y + (segment.to.y - segment.from.y) * ratio
    });
    break;
  }

  return points;
}

function drawBarrierLinkStrokeProgress(path, progress, options = {}) {
  const points = barrierLinkStrokePoints(path, progress);
  if (points.length < 2) return points;
  strokeBarrierLinkPoints(points, options);
  return points;
}

function barrierLinkDiamondPoints(center, radius, rotation = 0) {
  return Array.from({ length: 4 }, (_, index) => {
    const angle = -Math.PI / 2 + rotation + index * Math.PI / 2;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

function drawBarrierLinkSettledDiamond(entry) {
  const center = barrierStoneScreenCenter(entry?.stoneId);
  if (!center) return;
  const radius = Math.max(20, Math.min(32, BARRIER_TILE_MIN_SCREEN_SIZE * 1.25));
  const points = barrierLinkDiamondPoints(center, radius, Number(entry.rotation) || 0);
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = BARRIER_LINK_GLOW;
  context.lineWidth = 4.5;
  context.shadowColor = BARRIER_LINK_GLOW;
  context.shadowBlur = 16;
  context.stroke();
  context.strokeStyle = BARRIER_LINK_CORE;
  context.lineWidth = 1.8;
  context.shadowColor = "rgb(255 240 204 / 0.98)";
  context.shadowBlur = 6;
  context.stroke();
}

function drawBarrierLinkErrorDiamond(stoneId) {
  const center = barrierStoneScreenCenter(stoneId);
  if (!center) return;
  const radius = Math.max(20, Math.min(32, BARRIER_TILE_MIN_SCREEN_SIZE * 1.25));
  const points = barrierLinkDiamondPoints(center, radius);
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "rgb(102 76 112 / 0.9)";
  context.lineWidth = 2;
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.stroke();
}

function drawBarrierLinkFuse(path, pointer = null, options = {}) {
  if (!Array.isArray(path) || path.length < 1) return;
  const vertices = path.map(barrierStoneScreenCenter).filter(Boolean);
  if (vertices.length < 1) return;
  context.save();
  const muted = options.muted === true;
  context.globalAlpha = muted ? 0.74 : 0.44;
  context.strokeStyle = muted ? "rgb(102 76 112 / 0.9)" : "rgb(242 138 46 / 0.86)";
  context.lineWidth = 1.35;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([3, 6]);
  context.beginPath();
  context.moveTo(vertices[0].x, vertices[0].y);
  for (const vertex of vertices.slice(1)) context.lineTo(vertex.x, vertex.y);
  if (options.close && vertices.length >= 2) context.closePath();
  if (pointer && !options.close) {
    const from = vertices.at(-1);
    if (Math.hypot(pointer.x - from.x, pointer.y - from.y) >= 2) {
      context.lineTo(pointer.x, pointer.y);
    }
  }
  context.stroke();
  context.restore();
}

function drawBarrierLinkDiamondProgress(entry) {
  const center = barrierStoneScreenCenter(entry?.stoneId);
  const startedAt = Number(entry?.startedAt);
  if (!center || !Number.isFinite(startedAt)) return;
  const duration = BARRIER_LINK_DIAMOND_MS;
  const progress = Math.min(1, Math.max(0, (performance.now() - startedAt) / duration));
  const radius = Math.max(20, Math.min(32, BARRIER_TILE_MIN_SCREEN_SIZE * 1.25));
  const points = barrierLinkDiamondPoints(center, radius);
  const pathProgress = progress * points.length;
  let head = points[0];

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 0; index < points.length; index += 1) {
    const segmentProgress = Math.min(1, Math.max(0, pathProgress - index));
    if (segmentProgress <= 0) break;
    const from = points[index];
    const to = points[(index + 1) % points.length];
    head = {
      x: from.x + (to.x - from.x) * segmentProgress,
      y: from.y + (to.y - from.y) * segmentProgress
    };
    context.lineTo(head.x, head.y);
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = BARRIER_LINK_GLOW;
  context.lineWidth = 4.5;
  context.shadowColor = BARRIER_LINK_GLOW;
  context.shadowBlur = 16;
  context.stroke();
  context.strokeStyle = BARRIER_LINK_CORE;
  context.lineWidth = 1.8;
  context.shadowColor = "rgb(255 240 204 / 0.98)";
  context.shadowBlur = 6;
  context.stroke();

  context.beginPath();
  context.arc(head.x, head.y, 2.8, 0, Math.PI * 2);
  context.fillStyle = "#fff9e9";
  context.shadowColor = BARRIER_LINK_GLOW;
  context.shadowBlur = 16;
  context.fill();
}

function drawBarrierLinkGesture() {
  const error = state.barrierLinkError;
  const completion = state.barrierLinkCompletion;
  const path = completion?.path || state.barrierLinkPath;
  if (error) {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    drawBarrierLinkFuse(error.path, null, { close: true, muted: true });
    for (const stoneId of error.path) {
      drawBarrierLinkErrorDiamond(stoneId);
    }
    context.restore();
    return;
  }
  if (!state.barrierLinkingMode && !completion && state.barrierLinkDiamondAnimations.length === 0) return;

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = completion ? 0.74 : 0.98;

  for (const entry of state.barrierLinkSettledDiamonds) {
    drawBarrierLinkSettledDiamond(entry);
  }

  for (const entry of state.barrierLinkDiamondAnimations) {
    drawBarrierLinkDiamondProgress(entry);
  }

  if (!completion && state.barrierLinkingMode && state.pointer.drag?.barrierLinkStarted) {
    drawBarrierLinkFuse(path, state.pointer.drag.last);
  }

  if (completion) {
    drawBarrierLinkFuse(path, null, { close: true });
    const progress = Math.min(1, Math.max(0, (performance.now() - completion.startedAt) / BARRIER_LINK_COMPLETION_MS));
    const points = drawBarrierLinkStrokeProgress(path, progress, { width: 2.4, glow: 32 });
    if (points.length >= 3) {
      context.globalAlpha = 0.1 + progress * 0.22;
      context.fillStyle = BARRIER_LINK_ORANGE;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.closePath();
      context.fill();
    }
  }
  context.restore();
}

function drawTraverseTileCount(polygon, count, colors, color = colors.barrierCell) {
  const right = Math.max(...polygon.map((point) => point.x)) - 5;
  const bottom = Math.max(...polygon.map((point) => point.y)) - 5;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.font = "800 14px ui-monospace, SFMono-Regular, Consolas, monospace";
  context.lineWidth = 4;
  context.strokeStyle = colors.pointBaseStroke;
  context.strokeText(String(count), right, bottom);
  context.fillStyle = color;
  context.fillText(String(count), right, bottom);
}

function drawTraverseBarriers() {
  const colors = canvasPalette();
  const glow = activeBarrierGlow();
  for (const [barrierId, barrier] of Object.entries(state.traverseLog?.barriers || {})) {
    const vertices = barrierFigureVertices(barrier)
      .map((vertex) => projectLatLng(vertex.lat, vertex.lng))
      .map(worldToScreen);
    if (vertices.length < 3) continue;
    context.save();
    context.beginPath();
    context.moveTo(vertices[0].x, vertices[0].y);
    for (const vertex of vertices.slice(1)) context.lineTo(vertex.x, vertex.y);
    context.closePath();
    const selected = barrierId === state.selectedBarrierId;
    context.fillStyle = BARRIER_LINK_ORANGE;
    context.globalAlpha = selected ? 0.32 : 0.16 + glow * 0.08;
    context.fill("nonzero");
    context.globalCompositeOperation = "screen";
    context.globalAlpha = 0.24 + glow * 0.18;
    context.strokeStyle = BARRIER_LINK_ORANGE;
    context.lineWidth = selected ? 2.8 : 1.5 + glow * 0.8;
    context.shadowColor = BARRIER_LINK_ORANGE;
    context.shadowBlur = 8 + glow * 10;
    context.stroke();
    context.restore();
  }
}

function drawTraverseGuardians() {
  const colors = canvasPalette();
  for (const [barrierId, barrier] of Object.entries(state.traverseLog?.barriers || {})) {
    const guardian = barrier?.guardian;
    if (!guardian) continue;
    const projected = projectLatLng(guardian.lat, guardian.lng);
    if (!projected) continue;
    const point = worldToScreen(projected);
    const selected = barrierId === state.selectedBarrierId;
    context.save();
    context.translate(point.x, point.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = colors.badgeStartFill || colors.selected;
    context.strokeStyle = colors.pointBaseStroke;
    context.lineWidth = selected ? 3 : 2;
    context.globalAlpha = selected ? 1 : 0.8;
    context.fillRect(-7, -7, 14, 14);
    context.strokeRect(-7, -7, 14, 14);
    context.restore();
    if (selected && guardian.label) {
      context.save();
      context.fillStyle = colors.text || colors.selected;
      context.font = "700 12px system-ui, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "bottom";
      context.fillText(guardian.label.slice(0, 24), point.x + 10, point.y - 8);
      context.restore();
    }
  }
}

function drawGridLines(topLeft, bottomRight, step, color, lineWidth) {
  const minX = Math.floor(topLeft.x / step) * step;
  const maxX = Math.ceil(bottomRight.x / step) * step;
  const minY = Math.floor(bottomRight.y / step) * step;
  const maxY = Math.ceil(topLeft.y / step) * step;
  const size = canvasSize();

  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;

  for (let x = minX; x <= maxX; x += step) {
    const screen = worldToScreen({ x, y: 0 });
    context.moveTo(screen.x, 0);
    context.lineTo(screen.x, size.height);
  }

  for (let y = minY; y <= maxY; y += step) {
    const screen = worldToScreen({ x: 0, y });
    context.moveTo(0, screen.y);
    context.lineTo(size.width, screen.y);
  }

  context.stroke();
}

function runtimeAnalysisVertex(vertex) {
  const normalized = normalizeAnalysisVertex(vertex);
  if (!normalized) return null;
  const geo = { lat: normalized.lat, lng: normalized.lng };
  return {
    ...normalized,
    id: normalized.placeRef || "",
    title: normalized.name,
    geo,
    endpointKey: normalized.key,
    ...projectLatLng(normalized.lat, normalized.lng)
  };
}

function figureRuntimeVertices(figure) {
  return Array.isArray(figure?.vertices)
    ? figure.vertices.map(runtimeAnalysisVertex).filter(Boolean)
    : [];
}

function figureSegments(figure) {
  return figureEdges(figure).map((edge) => {
    const a = runtimeAnalysisVertex(edge.a);
    const b = runtimeAnalysisVertex(edge.b);
    return a && b ? { a, b } : null;
  }).filter(Boolean);
}

function drawFigures() {
  const colors = canvasPalette();
  for (const figure of state.figures.filter(isVisibleAnalysisItem)) {
    // 結界モードでは専用の発光表現で描く。本体モードでは、結界図形も
    // 所属する「結界アトラス」リストの表示状態に従う通常の図形として描く。
    if (state.traverseMode && (figure.layer === "barrier" || figure.barrierId)) continue;
    const vertices = figureRuntimeVertices(figure);
    if (vertices.length < 2) continue;

    const points = vertices.map(worldToScreen);
    const isSelected = isFigureSelected(figure.id);
    const stroke = normalizeGridAtlasLineColor(figure.color)
      || (isSelected ? colors.linkSelected : colors.link);
    context.save();
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    if (points.length >= 3) {
      context.closePath();
      context.globalAlpha = isSelected ? 0.22 : 0.1;
      context.fillStyle = stroke;
      context.fill();
      context.globalAlpha = 1;
    }
    context.restore();
  }
}

function drawLinks() {
  for (const link of state.links.filter(isVisibleAnalysisItem)) {
    const endpoints = linkEndpoints(link);
    if (!endpoints) {
      continue;
    }

    const start = worldToScreen(endpoints.a);
    const end = worldToScreen(endpoints.b);
    const isSelected = isLinkSelected(link.id);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    const colors = canvasPalette();
    context.strokeStyle = normalizeGridAtlasLineColor(link.color) || colors.link;
    context.lineWidth = isSelected ? 5 : 2.4;
    context.stroke();
  }
}

function drawLineDragPreview() {
  const drag = state.pointer.drag?.lineDrag;
  if (!drag) return;

  const link = findLink(drag.linkId);
  const fixed = link ? linkEndpoint(link, drag.fixedSide) : null;
  if (!fixed) return;

  const start = worldToScreen(fixed);
  const target = drag.targetPointId ? findPoint(drag.targetPointId) : null;
  const end = target ? worldToScreen(target) : drag.current;
  const colors = canvasPalette();

  context.save();
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.strokeStyle = colors.linkSelected;
  context.lineWidth = 4;
  context.setLineDash([9, 6]);
  context.stroke();
  context.setLineDash([]);

  if (target) {
    context.beginPath();
    context.arc(end.x, end.y, POINT_RADIUS + 9, 0, Math.PI * 2);
    context.strokeStyle = colors.selected;
    context.lineWidth = 2.5;
    context.stroke();
  }
  context.restore();
}

function drawTargetLine() {
  const anchor = routeStartPoint();
  const target = targetPoint();
  if (!observationEndpointsDistinct(anchor, target)) {
    return;
  }

  const start = worldToScreen(anchor);
  const end = worldToScreen(target);
  const lineEnd = targetLineEndPoint(start, end);
  const colors = canvasPalette();

  context.save();
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(lineEnd.x, lineEnd.y);
  const guideColor = colors.targetGuide ?? colors.target;
  context.strokeStyle = guideColor;
  context.lineWidth = 2.8;
  context.setLineDash([7, 6]);
  context.stroke();
  context.setLineDash([]);
  drawArrowHead(start, lineEnd, guideColor);

  if (!isPointSelected(target.id)) {
    context.beginPath();
    context.arc(end.x, end.y, POINT_RADIUS + 8, 0, Math.PI * 2);
    context.strokeStyle = colors.targetSoft;
    context.lineWidth = POINT_SELECTION_RING_WIDTH;
    context.stroke();
  }
  context.restore();
}

function targetLineEndPoint(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= POINT_RADIUS + 12) {
    return end;
  }

  const offset = POINT_RADIUS + 5;
  return {
    x: end.x - (dx / distance) * offset,
    y: end.y - (dy / distance) * offset
  };
}

function drawArrowHead(start, tip, color) {
  const dx = tip.x - start.x;
  const dy = tip.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return;
  }

  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;
  const length = 13;
  const width = 7;
  const base = {
    x: tip.x - ux * length,
    y: tip.y - uy * length
  };

  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(base.x + px * width, base.y + py * width);
  context.lineTo(base.x - px * width, base.y - py * width);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function activeObservationLayer() {
  const start = observationStartPoint();
  const target = targetPoint();
  const current = observationModeActive() ? currentLocationPoint() : null;
  const points = observationDisplayPathPoints(current);
  if (!start || points.length < 2) {
    return null;
  }

  return { id: "__active_observation__", start, target, points, loaded: false };
}

function loadedObservationLayer(observation) {
  if (!observation || !observation.start || !Array.isArray(observation.trail) || observation.trail.length === 0) {
    return null;
  }

  return {
    id: observation.id,
    start: observation.start,
    target: observation.target ?? null,
    points: [observation.start, ...observation.trail],
    loaded: true
  };
}

function loadedObservationLayers() {
  return state.loadedObservations.map(loadedObservationLayer).filter(Boolean);
}

function visibleObservationLayers() {
  const layers = loadedObservationLayers();
  const active = activeObservationLayer();
  if (active) {
    layers.push(active);
  }
  return layers;
}

function observationPointTimestamp(point) {
  const timestamp = Date.parse(point?.recordedAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function drawObservationSegment(points, strokeStyle, lineWidth, lineDash) {
  if (points.length < 2) {
    return;
  }

  context.beginPath();
  points.forEach((point, index) => {
    const screen = worldToScreen(point);
    if (index === 0) {
      context.moveTo(screen.x, screen.y);
    } else {
      context.lineTo(screen.x, screen.y);
    }
  });
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.setLineDash(lineDash);
  context.stroke();
}

function drawObservationTrail(layer, isSelected, colors) {
  const observedStroke = isSelected ? colors.selected : colors.observationTrail;
  const observedWidth = layer.loaded ? (isSelected ? 4.2 : 2.8) : 3.4;
  let observedSegment = [layer.points[0]];

  for (let index = 1; index < layer.points.length; index += 1) {
    const from = layer.points[index - 1];
    const to = layer.points[index];
    const fromAt = observationPointTimestamp(from);
    const toAt = observationPointTimestamp(to);
    const isGap = fromAt !== null && toAt !== null && toAt - fromAt >= OBSERVATION_GAP_THRESHOLD_MS;

    if (!isGap) {
      observedSegment.push(to);
      continue;
    }

    drawObservationSegment(observedSegment, observedStroke, observedWidth, [4, 4]);
    drawObservationSegment([from, to], colors.observationGapLine, 1.6, [2, 5]);
    observedSegment = [to];
  }

  drawObservationSegment(observedSegment, observedStroke, observedWidth, [4, 4]);
}

function drawObservationLayer(layer) {
  const colors = canvasPalette();
  const isSelected = layer.loaded && isLoadedObservationSelected(layer.id);
  const startScreen = worldToScreen(layer.start);
  const targetScreen = layer.target ? worldToScreen(layer.target) : null;

  context.save();
  if (targetScreen) {
    context.beginPath();
    context.moveTo(startScreen.x, startScreen.y);
    context.lineTo(targetScreen.x, targetScreen.y);
    context.strokeStyle = isSelected ? colors.selected : colors.observationBaseline;
    context.lineWidth = isSelected ? 3 : 2.2;
    context.setLineDash([12, 8]);
    context.stroke();
  }

  drawObservationTrail(layer, isSelected, colors);
  context.restore();
}

function drawObservationPath() {
  for (const layer of visibleObservationLayers()) {
    drawObservationLayer(layer);
  }
}
function drawRouteResult() {
  const points = routeResultPoints();
  if (points.length < 2) {
    return;
  }

  context.save();
  context.beginPath();
  points.forEach((point, index) => {
    const screen = worldToScreen(point);
    if (index === 0) {
      context.moveTo(screen.x, screen.y);
    } else {
      context.lineTo(screen.x, screen.y);
    }
  });
  if (state.routeResult.returnToStart) {
    const first = worldToScreen(points[0]);
    context.lineTo(first.x, first.y);
  }
  context.strokeStyle = canvasPalette().route;
  context.lineWidth = 3.2;
  context.setLineDash([10, 7]);
  context.stroke();
  context.restore();
}

function currentLocationStatus() {
  if (!validGeo(state.currentGeo)) {
    return "waiting";
  }

  if (state.lastLocationError) {
    return "stale";
  }

  if (!state.followCurrentLocation && !state.screenFollowCurrentLocation) {
    return "observed";
  }

  const updatedAt = Number(state.lastLocationUpdateAt);
  return Number.isFinite(updatedAt) && Date.now() - updatedAt <= LOCATION_STALE_AFTER_MS ? "fresh" : "stale";
}

function currentLocationIsFresh() {
  return currentLocationStatus() === "fresh";
}

function currentLocationLabel() {
  return currentLocationStatus() === "stale" ? t("message.lastObservedLocation") : t("message.currentLocation");
}
function currentLocationGlowActive() {
  return Boolean(currentLocationPoint()) && currentLocationIsFresh() && (state.followCurrentLocation || state.screenFollowCurrentLocation);
}

function activeBarrierGlowActive() {
  return state.traverseMode
    && !state.barrierLinkPreview
    && Object.keys(state.traverseLog?.barriers || {}).length > 0;
}

function activeBarrierGlow() {
  const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return 0.5;
  const phase = (performance.now() % 5200) / 5200;
  return (Math.sin(phase * Math.PI * 2) + 1) / 2;
}

function drawCurrentLocationGlow(screen, colors) {
  if (!currentLocationGlowActive()) {
    return;
  }

  const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phase = reduceMotion ? 0.5 : (performance.now() % 1500) / 1500;
  const pulse = reduceMotion ? 0.35 : (Math.sin(phase * Math.PI * 2) + 1) / 2;
  context.save();
  context.fillStyle = colors.currentFill;
  context.globalAlpha = 0.08 + pulse * 0.1;
  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS + 9 + pulse * 7, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 0.28 + pulse * 0.2;
  context.lineWidth = 2;
  context.strokeStyle = colors.currentFill;
  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS + 4 + pulse * 4, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function syncLocationGlowAnimation() {
  const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shouldAnimate = (currentLocationGlowActive() || activeBarrierGlowActive()) && !reducedMotion;
  if (!shouldAnimate) {
    if (locationGlowFrame) {
      cancelAnimationFrame(locationGlowFrame);
      locationGlowFrame = 0;
    }
    return;
  }

  if (locationGlowFrame) {
    return;
  }

  const animate = () => {
    if (!currentLocationGlowActive() && !activeBarrierGlowActive()) {
      draw();
      renderStatus();
      locationGlowFrame = 0;
      return;
    }
    draw();
    locationGlowFrame = requestAnimationFrame(animate);
  };
  locationGlowFrame = requestAnimationFrame(animate);
}

function normalizeHeading(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return (numeric % 360 + 360) % 360;
}

function deviceOrientationHeading(event) {
  const compassHeading = normalizeHeading(event.webkitCompassHeading);
  if (compassHeading !== null) {
    return compassHeading;
  }

  if (event.alpha === null || event.alpha === undefined || event.absolute === false) {
    return null;
  }

  const alpha = Number(event.alpha);
  const beta = event.beta === null || event.beta === undefined ? null : Number(event.beta);
  const gamma = event.gamma === null || event.gamma === undefined ? null : Number(event.gamma);
  if (!Number.isFinite(alpha)) {
    return null;
  }

  if (Number.isFinite(beta) && Number.isFinite(gamma)) {
    const radians = Math.PI / 180;
    const x = beta * radians;
    const y = gamma * radians;
    const z = alpha * radians;
    const cosX = Math.cos(x);
    const cosY = Math.cos(y);
    const cosZ = Math.cos(z);
    const sinX = Math.sin(x);
    const sinY = Math.sin(y);
    const sinZ = Math.sin(z);
    const vectorX = -cosZ * sinY - sinZ * sinX * cosY;
    const vectorY = -sinZ * sinY + cosZ * sinX * cosY;
    if (Math.hypot(vectorX, vectorY) > 1e-6) {
      return normalizeHeading(Math.atan2(vectorX, vectorY) / radians);
    }
  }

  return normalizeHeading(360 - alpha);
}

function handleDeviceOrientation(event) {
  if (!state.gpsEnabled) {
    return;
  }

  const heading = deviceOrientationHeading(event);
  if (heading === null) {
    return;
  }

  state.deviceHeading = heading;
  if (currentLocationPoint()) {
    draw();
  }
}

function startDeviceHeading() {
  if (state.deviceHeadingListening) {
    return;
  }

  const attach = () => {
    if (state.deviceHeadingListening) {
      return;
    }
    window.addEventListener("deviceorientationabsolute", handleDeviceOrientation, true);
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    state.deviceHeadingListening = true;
  };

  const orientationEvent = window.DeviceOrientationEvent;
  if (typeof orientationEvent?.requestPermission === "function") {
    if (state.deviceHeadingPermissionRequested) {
      return;
    }
    state.deviceHeadingPermissionRequested = true;
    orientationEvent.requestPermission().then((permission) => {
      if (permission === "granted") {
        attach();
      }
    }).catch(() => {});
    return;
  }

  attach();
}

function stopDeviceHeading() {
  if (state.deviceHeadingListening) {
    window.removeEventListener("deviceorientationabsolute", handleDeviceOrientation, true);
    window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  }
  state.deviceHeadingListening = false;
  state.deviceHeading = null;
  state.movementHeading = null;
}

function currentLocationHeading() {
  return state.deviceHeading ?? state.movementHeading;
}

function drawCurrentLocationHeading(screen, colors, isStale) {
  const heading = currentLocationHeading();
  if (heading === null) {
    return;
  }

  const angle = heading * Math.PI / 180;
  const direction = { x: Math.sin(angle), y: -Math.cos(angle) };
  const perpendicular = { x: Math.cos(angle), y: Math.sin(angle) };
  const baseDistance = POINT_RADIUS + 4;
  const tipDistance = POINT_RADIUS + 12;
  const halfWidth = 4;

  context.save();
  context.beginPath();
  context.moveTo(screen.x + direction.x * tipDistance, screen.y + direction.y * tipDistance);
  context.lineTo(
    screen.x + direction.x * baseDistance + perpendicular.x * halfWidth,
    screen.y + direction.y * baseDistance + perpendicular.y * halfWidth
  );
  context.lineTo(
    screen.x + direction.x * baseDistance - perpendicular.x * halfWidth,
    screen.y + direction.y * baseDistance - perpendicular.y * halfWidth
  );
  context.closePath();
  context.fillStyle = isStale ? colors.currentStale : colors.currentFill;
  context.globalAlpha = isStale ? 0.5 : 0.95;
  context.fill();
  context.globalAlpha = 1;
  context.restore();
}

function drawPointSelectionRing(screen, colors) {
  context.beginPath();
  context.arc(screen.x, screen.y, POINT_SELECTION_RING_RADIUS, 0, Math.PI * 2);
  context.lineWidth = POINT_SELECTION_RING_WIDTH;
  context.strokeStyle = colors.selected;
  context.stroke();
}

function drawCurrentLocation() {
  const location = currentLocationPoint();
  if (!location) {
    return;
  }

  const colors = canvasPalette();
  const screen = worldToScreen(location);
  const isSelected = isPointSelected(CURRENT_LOCATION_ID);
  const isStale = currentLocationStatus() === "stale";

  drawCurrentLocationGlow(screen, colors);
  drawCurrentLocationHeading(screen, colors, isStale);

  context.save();
  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
  if (isStale) {
    context.fillStyle = colors.currentStale;
    context.globalAlpha = 0.18;
    context.fill();
    if (!isSelected) {
      context.globalAlpha = 0.92;
      context.lineWidth = 2;
      context.strokeStyle = colors.currentStale;
      context.setLineDash([3, 3]);
      context.stroke();
      context.setLineDash([]);
    }
    context.beginPath();
    context.moveTo(screen.x - POINT_RADIUS - 5, screen.y);
    context.lineTo(screen.x + POINT_RADIUS + 5, screen.y);
    context.moveTo(screen.x, screen.y - POINT_RADIUS - 5);
    context.lineTo(screen.x, screen.y + POINT_RADIUS + 5);
    context.stroke();
  } else {
    context.fillStyle = colors.currentFill;
    context.fill();
  }

  if (isSelected) {
    drawPointSelectionRing(screen, colors);
  }
  context.restore();
}
function drawRouteStartSnapshot() {
  const snapshot = currentRouteStartSnapshot();
  if (!snapshot) {
    return;
  }

  const colors = canvasPalette();
  const screen = worldToScreen(snapshot);
  context.save();
  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
  context.fillStyle = colors.routeStart;
  context.fill();
  context.restore();
}
function drawPendingPoint() {
  if (!validGeo(state.pendingGeo)) {
    return;
  }

  const colors = canvasPalette();
  const projected = projectLatLng(state.pendingGeo.lat, state.pendingGeo.lng);
  const screen = worldToScreen(projected);
  context.save();
  context.beginPath();
  context.arc(screen.x, screen.y, 10, 0, Math.PI * 2);
  context.fillStyle = colors.pendingFill;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = colors.pendingStroke;
  context.setLineDash([4, 4]);
  context.stroke();
  context.restore();
}
function isPriorityPoint(point) {
  return point.id === state.targetPointId || point.id === state.routeStartPointId;
}

function drawPointMarker(point, colors) {
  const screen = worldToScreen(point);
  const isTarget = point.id === state.targetPointId;
  const isRouteStart = point.id === state.routeStartPointId;
  const isSelected = isPointSelected(point.id);
  context.beginPath();
  context.arc(screen.x, screen.y, POINT_RADIUS, 0, Math.PI * 2);
  context.fillStyle = isTarget ? colors.targetFill : isRouteStart ? colors.routeStart : colors.pointFill;
  context.fill();

  if (isSelected) {
    drawPointSelectionRing(screen, colors);
  }
}

function drawPoints(options = {}) {
  const colors = canvasPalette();
  const priority = Boolean(options.priority);
  for (const point of state.points) {
    if (isPriorityPoint(point) !== priority) {
      continue;
    }

    drawPointMarker(point, colors);
  }
}

function drawCloudPoints(options = {}) {
  const colors = canvasPalette();
  const priority = Boolean(options.priority);
  for (const point of visibleCloudPoints()) {
    if (isPriorityPoint(point) !== priority) {
      continue;
    }
    drawPointMarker(point, colors);
  }
}

function drawRouteBadges() {
  const colors = canvasPalette();
  const ids = state.routeResult?.pointIds ?? [];
  ids.forEach((pointId, index) => {
    const point = findPoint(pointId);
    if (!point) {
      return;
    }

    const screen = worldToScreen(point);
    const label = String(index);
    context.beginPath();
    context.arc(screen.x + 12, screen.y - 12, 9, 0, Math.PI * 2);
    context.fillStyle = index === 0 ? colors.badgeStartFill : colors.badgeFill;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = colors.badgeStartFill;
    context.stroke();
    context.fillStyle = index === 0 ? colors.badgeStartText : colors.badgeText;
    context.font = "700 11px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, screen.x + 12, screen.y - 12);
  });
}

function draw() {
  const size = canvasSize();
  context.clearRect(0, 0, size.width, size.height);
  if (state.barrierLinkPreview) {
    drawBarrierLinkRoom(size);
    drawTraverseStones({ availableOnly: true });
    drawBarrierLinkGesture();
    return;
  }
  drawGrid(size.width, size.height);
  if (state.barrierDissolveMode) {
    drawTraverseBarriers();
    return;
  }
  if (state.barrierLinkingMode) {
    drawTraverseStones({ availableOnly: true });
    drawBarrierLinkGesture();
    return;
  }
  if (state.barrierPlacementView) {
    drawTraverseTiles();
    return;
  }
  drawDragonEyePreview();
  drawBarrierLinkGesture();
  drawFigures();
  drawLinks();
  drawLineDragPreview();
  drawRouteResult();
  drawObservationPath();
  drawTargetLine();
  drawCloudPoints();
  drawPoints();
  drawCurrentLocation();
  drawPendingPoint();
  drawRouteStartSnapshot();
  drawCloudPoints({ priority: true });
  drawPoints({ priority: true });
  if (state.traverseMode) {
    // Keep barrier cells visually in front when a pin or current location
    // shares the same tile.
    drawTraverseTiles();
  }
  drawRouteBadges();
  drawRangeSelection();
}

function drawRangeSelection() {
  const range = state.pointer.range;
  if (!range) {
    return;
  }

  const left = Math.min(range.start.x, range.current.x);
  const top = Math.min(range.start.y, range.current.y);
  const width = Math.abs(range.current.x - range.start.x);
  const height = Math.abs(range.current.y - range.start.y);
  const colors = canvasPalette();

  context.save();
  context.fillStyle = colors.selected;
  context.globalAlpha = 0.12;
  context.fillRect(left, top, width, height);
  context.globalAlpha = 0.9;
  context.strokeStyle = colors.selected;
  context.lineWidth = 1.5;
  context.setLineDash([6, 4]);
  context.strokeRect(left + 0.5, top + 0.5, width, height);
  context.restore();
}

function render() {
  // Keep the barrier control authoritative even when a cloud/tester list
  // refresh causes additional rendering work below it.
  renderTraverseBottomActions();
  syncTraverseModeUi();
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  normalizeSelection();
  syncCanvasSize();
  draw();
  renderDetails();
  renderKekkaishiStatusDialog();
  renderAnalysis();
  renderRoute();
  renderPointDestinationSelect();
  renderStorageLists();
  renderPointIndex();
  renderPointListPreview();
  renderMobileGridTabs();
  renderSelectedSummary();
  renderMobileOverview();
  renderSelectionInfo();
  renderStatus();
  renderTraverseBottomActions();
  syncTraverseModeUi();
  renderFitButton();
  renderWebVersion();
  renderActionButtons();
  renderPointInfoDialog();
  renderGridPointQuickDialog();
  renderGridBarrierStoneQuickDialog();
  renderGridLinkQuickDialog();
  renderGridFigureQuickDialog();
  renderGridLinkColorDialog();
  renderSelectionAnalysisDialog();
  if (state.barrierPinMode) renderBarrierPinDialog();
  syncSettingsControls();
  syncLocationGlowAnimation();
}

function renderSelectedSummary() {
  const pointTitles = selectedPointIds().map(findPoint).filter(Boolean).map((point) => point.title);
  let title = t("state.unselected");
  if (pointTitles.length === 1) {
    title = pointTitles[0];
  } else if (pointTitles.length > 1) {
    title = activeLanguage() === EN_LANGUAGE
      ? `${pointTitles[0]} +${pointTitles.length - 1}`
      : `${pointTitles[0]}・他${pointTitles.length - 1}点`;
  } else if (state.selection.length > 0) {
    title = state.selection.map(selectionTitle).join(", ");
  }
  elements.sidebarSelectedTitle.textContent = title;
}

function renderMobileOverview() {
  const visiblePointCount = visibleSelectablePoints().length;
  const selectedPoints = selectedPointIds().map(findPoint).filter(Boolean);
  const selectedLinks = selectedLinkIds().map(findLink).filter(Boolean);
  const distanceState = mobileDistanceState(selectedPoints, selectedLinks);
  const firstSelection = state.selection.at(0);
  const lastSelection = selectedPoints.length === 1 ? null : state.selection.at(-1);
  const setSummaryValue = (element, value, isPlaceholder = false) => {
    element.textContent = value;
    element.classList.toggle("is-empty-value", isPlaceholder);
  };

  elements.mobileDisplayedPointCount.textContent = String(visiblePointCount);
  elements.mobileSelectedPointCount.textContent = String(selectedPoints.length);
  setSummaryValue(
    elements.mobilePointDistance,
    Number.isFinite(distanceState.distance) ? formatDistance(distanceState.distance) : MOBILE_EMPTY_VALUE,
    !Number.isFinite(distanceState.distance)
  );
  setSummaryValue(
    elements.mobileFirstSelection,
    firstSelection ? selectionTitle(firstSelection) : MOBILE_EMPTY_VALUE,
    !firstSelection
  );
  setSummaryValue(
    elements.mobileLastSelection,
    selectedPoints.length === 1 ? "" : lastSelection ? selectionTitle(lastSelection) : MOBILE_EMPTY_VALUE,
    selectedPoints.length !== 1 && !lastSelection
  );
  setSummaryValue(elements.mobileDistanceType, distanceState.type, distanceState.type === MOBILE_EMPTY_VALUE);
}

function mobileDistanceState(selectedPoints, selectedLinks) {
  if (selectedPoints.length === 2) {
    return {
      distance: distanceBetween(selectedPoints[0], selectedPoints[1]),
      type: t("label.betweenTwo")
    };
  }

  if (selectedPoints.length > 2) {
    return {
      distance: pointSequenceDistance(selectedPoints),
      type: t("label.sequence")
    };
  }

  if (selectedPoints.length === 1) {
    const current = currentLocationPoint();
    if (current) {
      return {
        distance: distanceBetween(current, selectedPoints[0]),
        type: t("label.fromCurrent")
      };
    }
  }

  const linkDistance = selectedLinksDistance(selectedLinks);
  if (Number.isFinite(linkDistance)) {
    return { distance: linkDistance, type: t("label.linkTotal") };
  }

  return { distance: NaN, type: MOBILE_EMPTY_VALUE };
}

function validMobilePageName(value) {
  return ["map", "register", "data"].includes(value);
}

function setMobilePage(name) {
  const pageName = validMobilePageName(name) ? name : "map";
  const mapActive = pageName === "map";
  state.mobilePage = pageName;

  for (const tab of elements.mobilePageTabs) {
    const active = tab.dataset.mobilePage === pageName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  }

  elements.mapColumn.classList.toggle("is-mobile-page-active", mapActive);
  elements.sidebar.classList.toggle("is-mobile-page-active", !mapActive);

  for (const panel of elements.mobilePanels) {
    panel.classList.toggle("is-mobile-active", !mapActive && panel.dataset.mobilePanel === pageName);
  }

  syncMobileGridTabSelection();
  renderTraverseBottomActions();

  if (mapActive) {
    scheduleCanvasResize();
  }

}

function validMobileGridPageName(value) {
  return MOBILE_GRID_PAGES.includes(value);
}

function syncMobileGridTabSelection() {
  const mapActive = state.mobilePage === "map";
  document.documentElement.classList.toggle(
    "is-mobile-list-page",
    mapActive && state.mobileGridPage === "lists"
  );

  for (const tab of elements.mobileGridTabs) {
    const active = !state.traverseMode && mapActive && tab.dataset.mobileGridPage === state.mobileGridPage;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  }
}

function isTraverseGridSurfaceActive() {
  return !mobilePageUiActive()
    || (state.mobilePage === "map" && state.mobileGridPage === "grid");
}

function setMobileGridPage(name) {
  const pageName = state.traverseMode
    ? "grid"
    : validMobileGridPageName(name) ? name : "grid";
  state.mobileGridPage = pageName;
  syncMobileGridTabSelection();

  for (const panel of elements.mobileGridPanels) {
    panel.classList.toggle("is-mobile-grid-active", panel.dataset.mobileGridPanel === pageName);
  }
  renderTraverseBottomActions();

  if (pageName === "grid") {
    scheduleCanvasResize();
  }
}

function clearAtlasModeLongPress() {
  if (atlasModePressTimerId) window.clearTimeout(atlasModePressTimerId);
  atlasModePressTimerId = 0;
  atlasModePressPointerId = null;
  atlasModePressTitle = null;
  atlasModeLongPressTriggered = false;
}

function startAtlasModeLongPress(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  clearAtlasModeLongPress();
  atlasModePressPointerId = event.pointerId;
  atlasModePressTitle = event.currentTarget;
  atlasModePressTimerId = window.setTimeout(() => {
    if (!atlasModePressTitle || atlasModePressPointerId !== event.pointerId) return;
    atlasModePressTimerId = 0;
    atlasModeLongPressTriggered = true;
    syncTraverseModeUi();
    setMobilePage("map");
    setMobileGridPage("grid");
    void requestTraverseModeToggle();
  }, ATLAS_MODE_LONG_PRESS_MS);
}

function finishAtlasModeLongPress(event) {
  if (event.type === "pointerleave" && event.pointerType !== "mouse") return;
  if (atlasModePressPointerId !== null && event.pointerId !== atlasModePressPointerId) return;
  if (atlasModePressTimerId) window.clearTimeout(atlasModePressTimerId);
  atlasModePressTimerId = 0;
  atlasModePressPointerId = null;
  atlasModePressTitle = null;
  if (atlasModeLongPressTriggered) event.preventDefault();
  atlasModeLongPressTriggered = false;
}

function handleMobileGridTabClick(tab) {
  setMobileGridPage(tab.dataset.mobileGridPage);
  if (tab.closest(".sidebar")) {
    setMobilePage("map");
  }
  if (tab.dataset.mobileGridPage === "lists") {
    maybeRefreshCloudListsForListPage();
  }
}

function renderMobileGridTabs() {
  setMobileGridPage(state.mobileGridPage);
}

function initMobilePages() {
  setMobilePage("map");
  setMobileGridPage("grid");
}

function mobilePageUiActive() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 860px)").matches;
}

function renderSelectionInfo() {
  elements.selectionInfoText.textContent = selectionInfoText();
}

function selectionInfoText() {
  if (state.selectedBarrierId) {
    const score = scoreBarrier(state.traverseLog, state.selectedBarrierId);
    if (score) {
      const rank = rankForBarrier(state.traverseLog, score.barrierId);
      return `${score.name || t("barrier.defaultName")} | ${rank.name} ${formatScoreValue(score.power)}`;
    }
  }
  if (state.barrierSelection.length > 0) {
    return state.barrierSelection.length > 0
      ? t("barrier.selection").replace("{count}", String(state.barrierSelection.length))
      : t("state.unselected");
  }

  const observationText = observationInfoText();
  if (observationText) {
    return observationText;
  }

  const followText = followStateInfoText();
  if (state.selection.length === 0) {
    return followText || t("state.unselected");
  }

  const points = selectedPointIds().map(findPoint).filter(Boolean);
  const links = selectedLinkIds().map(findLink).filter(Boolean);
  const figures = selectedFigureIds().map(findFigure).filter(Boolean);
  const observations = selectedObservationIds();

  if (state.selection.length === 1) {
    const entry = state.selection[0];
    if (entry.type === "observation") {
      return loadedObservationInfoText(findLoadedObservation(entry.id)) || t("message.loadedObservation");
    }

    if (entry.type === "point") {
      const point = findPoint(entry.id);
      return point ? pointSelectionInfo(point) : t("message.pointUnavailable");
    }

    if (entry.type === "figure") {
      const figure = findFigure(entry.id);
      return figure ? figureSelectionInfo(figure) : t("analysis.figure");
    }

    const link = findLink(entry.id);
    return link ? linkSelectionInfo(link) : t("message.linkUnavailable");
  }

  if (points.length === 2 && links.length === 0) {
    return `${points[0].title} - ${points[1].title} | ${t("label.betweenTwo")} ${formatDistance(distanceBetween(points[0], points[1]))}`;
  }

  const parts = [];
  const countParts = [];
  if (points.length > 0) {
    countParts.push(`${points.length}${t("label.points")}`);
  }
  if (links.length > 0) {
    countParts.push(`${links.length}${t("label.links")}`);
  }
  if (figures.length > 0) {
    countParts.push(`${figures.length}${t("analysis.figure")}`);
  }
  if (observations.length > 0) {
    countParts.push(`${observations.length}${t("label.observations")}`);
  }
  if (countParts.length > 0) {
    parts.push(`${t("label.selected")} ${countParts.join(" / ")}`);
  }

  if (points.length > 1) {
    parts.push(`${t("label.sequence")} ${formatDistance(pointSequenceDistance(points))}`);
  }

  const linkTotal = selectedLinksDistance(links);
  if (Number.isFinite(linkTotal)) {
    parts.push(`${t("label.linkTotal")} ${formatDistance(linkTotal)}`);
  }

  return parts.join(" | ") || t("summary.selected");
}

function followStateInfoText() {
  if (!state.followCurrentLocation) {
    return "";
  }

  const start = observationStartPoint();
  const target = targetPoint();
  if (start && target) {
    return `観察中 ${start.title} → ${target.title}`;
  }
  if (start) {
    return `観察中 ${start.title}から`;
  }
  if (target) {
    return `追跡準備中 現在地 → ${target.title}`;
  }

  return "追跡準備中 現在地";
}

function pointSelectionInfo(point) {
  const geo = pointGeo(point);
  const coords = `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}`;
  const accuracy = Number.isFinite(geo.accuracy) ? ` | ${t("label.accuracy")} ±${formatDistance(geo.accuracy)}` : "";

  if (point.id === CURRENT_LOCATION_ID) {
    return `${point.title} | ${coords}${accuracy}`;
  }

  const current = currentLocationPoint();
  if (current) {
    return `${point.title} | ${t("label.fromCurrent")} ${formatDistance(distanceBetween(current, point))} | ${coords}`;
  }

  return `${point.title} | ${coords}`;
}

function linkSelectionInfo(link) {
  const endpoints = linkEndpoints(link);
  if (!endpoints) {
    return t("message.linkUnavailable");
  }

  return `${linkTitle(link)} | ${t("field.distance")} ${formatDistance(distanceBetween(endpoints.a, endpoints.b))}`;
}

function figureSelectionInfo(figure) {
  const segments = figureSegments(figure);
  const analysis = analyzeSegmentShape(segments);
  const name = figure.name || t("analysis.figure");
  if (analysis?.valid) {
    return `${name} | ${analysis.vertexCount}${t("analysis.vertexCount")} | ${t("analysis.area")} ${formatAreaValue(analysis.area)}`;
  }
  return `${name} | ${figure.vertices.length}${t("analysis.vertexCount")}`;
}

function pointSequenceDistance(points) {
  return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0);
}

function selectedLinksDistance(links) {
  if (links.length === 0) {
    return NaN;
  }

  return links.reduce((total, link) => {
    const endpoints = linkEndpoints(link);
    return endpoints ? total + distanceBetween(endpoints.a, endpoints.b) : total;
  }, 0);
}

function renderStatus() {
  if (state.barrierDissolveMode) {
    const selectedBarrier = state.selectedBarrierId
      ? state.traverseLog?.barriers?.[state.selectedBarrierId]
      : null;
    elements.statusLine.value = selectedBarrier
      ? `${selectedBarrier.name || t("barrier.defaultName")} · ${t("barrier.dissolve")}`
      : t("barrier.dissolveHint");
    return;
  }
  if (state.barrierLinkingMode) {
    elements.statusLine.value = state.barrierLinkPath.length > 0
      ? t("traverse.linkReturnHint")
      : t("traverse.linkReady");
    return;
  }
  if (state.pointer.range) {
    elements.statusLine.value = t("status.rangeSelect");
    return;
  }

  const lineDrag = state.pointer.drag?.lineDrag;
  if (lineDrag) {
    const target = lineDrag.targetPointId ? findPoint(lineDrag.targetPointId) : null;
    elements.statusLine.value = t("line.dragStatus").replace("{name}", target?.title || "…");
    return;
  }

  elements.statusLine.value = formatDistance(chooseGridStep());
}

function setTraverseBottomVisibility(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.style.display = visible ? "grid" : "none";
  element.style.visibility = visible ? "visible" : "hidden";
  element.setAttribute("aria-hidden", String(!visible));
}

function setTraverseBottomButtonVisibility(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.style.display = visible ? "" : "none";
  element.style.visibility = visible ? "visible" : "hidden";
}

function syncTraverseBottomActionVisibility(visible) {
  setTraverseBottomVisibility(elements.traverseActionBar, visible);
}

function syncTraverseModeUi() {
  const enabled = Boolean(state.traverseMode);
  const visible = enabled && mobilePageUiActive();
  syncTraverseBottomActionVisibility(visible);
  document.documentElement.classList.toggle("is-traverse-mode", enabled);
  if (elements.kekkaiReturnTitleButton) elements.kekkaiReturnTitleButton.hidden = !enabled;
}

function renderTraverseBottomActions() {
  const cancelButton = elements.traverseBottomCancelButton;
  const confirmButton = elements.traverseBottomConfirmButton;
  if (!cancelButton || !confirmButton) return;

  const visible = state.traverseMode && mobilePageUiActive();
  syncTraverseBottomActionVisibility(visible);
  const contextActive = visible && (
    state.dragonEye.active
    || state.barrierLinkPreview
    || state.barrierDissolveMode
    || state.barrierPlacementView
  );
  setTraverseBottomButtonVisibility(cancelButton, contextActive);
  setTraverseBottomButtonVisibility(confirmButton, contextActive);
  cancelButton.classList.remove("is-dragon-eye-active", "is-placement-view-active", "is-barrier-dissolve-active");
  confirmButton.classList.remove("is-dragon-eye-active", "is-placement-view-active", "is-barrier-dissolve-active");
  if (!contextActive) return;

  refreshTraverseStock();
  const dragonEyeActive = Boolean(state.dragonEye.active);
  const barrierLinkActive = Boolean(state.barrierLinkPreview);
  const barrierDissolveActive = Boolean(state.barrierDissolveMode);
  const placementActive = Boolean(state.barrierPlacementView);
  const linkCanUndo = barrierLinkActive && state.barrierLinkPath.length > 1;
  const linkCanConfirm = barrierLinkActive
    && !state.barrierLinkingMode
    && !state.barrierLinkCompletion
    && state.barrierSelection.length >= 3;

  let cancelLabel = t("traverse.bottomClear");
  let confirmLabel = t("traverse.bottomConfirm");
  if (dragonEyeActive) {
    cancelLabel = t("traverse.bottomCancel");
    confirmLabel = t("traverse.bottomPlace");
  } else if (barrierLinkActive) {
    cancelLabel = linkCanUndo ? t("traverse.bottomUndo") : t("traverse.bottomCancel");
    confirmLabel = t("traverse.bottomMake");
  } else if (barrierDissolveActive) {
    cancelLabel = t("traverse.bottomCancel");
    confirmLabel = t("traverse.bottomDissolve");
  } else if (placementActive) {
    cancelLabel = t("traverse.bottomCancel");
    confirmLabel = t("traverse.bottomConfirm");
  }

  elements.traverseBottomCancelLabel.textContent = cancelLabel;
  elements.traverseBottomConfirmLabel.textContent = confirmLabel;
  cancelButton.disabled = state.traverseBusy || (barrierLinkActive && Boolean(state.barrierLinkCompletion));
  confirmButton.disabled = state.traverseBusy
    || (barrierDissolveActive && !state.selectedBarrierId)
    || (barrierLinkActive && !linkCanConfirm)
    || !dragonEyeActive && !barrierLinkActive && !barrierDissolveActive && !placementActive;
  cancelButton.setAttribute("aria-label", cancelLabel);
  cancelButton.title = cancelLabel;
  confirmButton.setAttribute("aria-label", confirmLabel);
  confirmButton.title = confirmLabel;
  confirmButton.classList.toggle("is-dragon-eye-active", dragonEyeActive);
  confirmButton.classList.toggle("is-placement-view-active", placementActive);
  confirmButton.classList.toggle("is-barrier-dissolve-active", barrierDissolveActive);
}

function returnToTraverseActionMenu() {
  if (!state.traverseMode || state.traverseBusy) return;
  if (state.traversePlaceViewSnapshot) {
    if (state.traversePlaceViewSnapshot.placed) clearTraversePlaceViewSnapshot();
    else restoreTraversePlaceView();
  }
  render();
}

function fitBarrierPlacementView(options = {}) {
  const dissolveOnly = options.dissolveOnly === true;
  const linkOnly = options.linkOnly === true;
  const selectedOnly = options.selectedOnly === true;
  const room = options.room === true;
  syncCanvasSize();
  pauseLocationFollowForManualView();
  const selectedLinkStoneIds = room && state.barrierLinkSourceSelection.length > 0
    ? state.barrierLinkSourceSelection
    : state.barrierSelection;
  const availableStoneIds = linkOnly
    ? new Set(selectedOnly ? selectedLinkStoneIds : availableBarrierStoneIds())
    : null;
  const visibleStones = Object.values(state.traverseLog?.stones || {})
    .filter((stone) => stoneDisplayCount(stone) > 0)
    .filter((stone) => !availableStoneIds || availableStoneIds.has(stoneIdFromTile(stone.tile)))
    .map((stone) => ({ stone, geo: tileCenterGeo(stone.tile) }))
    .filter(({ geo }) => validGeo(geo));
  const cellGeos = visibleStones.flatMap(({ stone }) => tileBoundaryGeos(stone.tile));
  const barrierGeos = Object.values(state.traverseLog?.barriers || {})
    .flatMap((barrier) => barrierFigureVertices(barrier)
      .map((vertex) => ({ lat: vertex.lat, lng: vertex.lng }))
      .filter(validGeo));
  const geos = dissolveOnly
    ? barrierGeos
    : linkOnly
      ? cellGeos
      : [...cellGeos, ...barrierGeos];
  if (geos.length === 0) {
    render();
    return;
  }

  const centerGeo = geographicCenter(geos.map((geo) => ({ geo })));
  if (centerGeo) setProjectionCenterGeo(centerGeo);
  const projected = geos.map((geo) => projectGeo(geo));
  const size = canvasSize();

  if (visibleStones.length === 1 && !dissolveOnly) {
    const bounds = tileBounds(visibleStones[0]?.stone.tile);
    const tile = bounds ? tileBoundaryGeos(visibleStones[0].stone.tile)
      .map((corner) => projectLatLng(corner.lat, corner.lng)) : [];
    const tileWidth = tile.length > 0
      ? Math.max(...tile.map((point) => point.x)) - Math.min(...tile.map((point) => point.x))
      : 0;
    const tileHeight = tile.length > 0
      ? Math.max(...tile.map((point) => point.y)) - Math.min(...tile.map((point) => point.y))
      : 0;
    const targetSize = Math.min(
      BARRIER_SINGLE_TILE_MAX_SCREEN_SIZE,
      Math.max(BARRIER_SINGLE_TILE_MIN_SCREEN_SIZE, Math.min(size.width, size.height) * BARRIER_SINGLE_TILE_TARGET_RATIO)
    );

    if (tileWidth > 0 && tileHeight > 0) {
      const center = projectGeo(visibleStones[0].geo);
      state.viewport.x = center.x;
      state.viewport.y = center.y;
      state.viewport.scale = clampScale(targetSize / Math.max(tileWidth, tileHeight));
      render();
      return;
    }
  }

  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const frame = room ? barrierLinkRoomFrame(size) : null;
  const padding = room
    ? Math.min(92, Math.max(48, Math.min(frame.width, frame.height) * 0.12))
    : Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, (frame?.width || size.width) - padding * 2);
  const availableHeight = Math.max(64, (frame?.height || size.height) - padding * 2);
  const spanX = Math.max(60, maxX - minX);
  const spanY = Math.max(60, maxY - minY);

  state.viewport.x = (minX + maxX) / 2;
  state.viewport.y = (minY + maxY) / 2;
  state.viewport.scale = clampScale(Math.min(availableWidth / spanX, availableHeight / spanY));
  render();
}

function enterBarrierPlacementView() {
  if (!state.traverseMode || state.traverseBusy) return;
  if (!isTraverseGridSurfaceActive()) {
    setMobilePage("map");
    setMobileGridPage("grid");
  }
  resetBarrierLinkState();
  state.barrierLinkSourceSelection = [];
  resetDragonEyeState();
  state.barrierDissolveMode = false;
  state.barrierPlacementView = true;
  fitBarrierPlacementView();
}

function exitBarrierPlacementView() {
  if (!state.barrierPlacementView) return;
  state.barrierPlacementView = false;
  state.pointer.drag = null;
  render();
}

function enterBarrierDissolveMode() {
  if (!state.traverseMode || state.traverseBusy) return;
  if (Object.keys(state.traverseLog?.barriers || {}).length === 0) {
    showAppToast(t("barrier.selectToDissolve"), { error: true });
    return;
  }
  if (!isTraverseGridSurfaceActive()) {
    setMobilePage("map");
    setMobileGridPage("grid");
  }
  resetBarrierLinkState();
  state.barrierLinkSourceSelection = [];
  resetDragonEyeState();
  state.barrierPlacementView = false;
  state.barrierDissolveMode = true;
  state.barrierSelection = [];
  state.selectedBarrierId = null;
  fitBarrierPlacementView({ dissolveOnly: true });
}

function cancelBarrierDissolveMode() {
  if (!state.barrierDissolveMode) return;
  state.barrierDissolveMode = false;
  state.selectedBarrierId = null;
  state.barrierSelection = [];
  state.pointer.drag = null;
  render();
}

function commitBarrierDissolve() {
  if (!state.barrierDissolveMode) return;
  const barrierId = state.selectedBarrierId;
  if (!barrierId || !state.traverseLog?.barriers?.[barrierId]) {
    showAppToast(t("barrier.selectToDissolve"), { error: true });
    return;
  }

  const dissolveAt = Date.now();
  const evaluation = evaluateBarrierLog(state.traverseLog, dissolveAt);
  const settled = settleBarrierSpirit(state.traverseLog, barrierId, dissolveAt);
  const result = dissolveBarrier(state.traverseLog, barrierId, dissolveAt);
  if (!result.ok) return;
  syncBarrierFiguresFromLog();
  persistWorkspace();
  if (evaluation.changed || settled.changed || result.ok) persistTraverseLog();
  state.barrierDissolveMode = false;
  state.selectedBarrierId = null;
  state.barrierSelection = [];
  state.pointer.drag = null;
  render();
  showAppToast(t("barrier.dissolved"));
}

function handleTraverseBottomCancel() {
  if (state.dragonEye.active) {
    cancelDragonEye();
    return;
  }
  if (state.barrierLinkPreview) {
    if (state.barrierLinkPath.length > 1) {
      undoBarrierLinkSegment();
    } else {
      cancelBarrierSelectionPreview();
    }
    return;
  }
  if (state.barrierDissolveMode) {
    cancelBarrierDissolveMode();
    return;
  }
  if (state.barrierPlacementView) {
    exitBarrierPlacementView();
    return;
  }
  clearSelection();
}

function handleTraverseBottomConfirm() {
  if (state.dragonEye.active) {
    commitDragonEye();
    return;
  }
  if (state.barrierLinkPreview) {
    const canConfirm = !state.barrierLinkingMode
      && !state.barrierLinkCompletion
      && state.barrierSelection.length >= 3;
    if (canConfirm) void createBarrierFromSelection();
    return;
  }
  if (state.barrierDissolveMode) {
    commitBarrierDissolve();
  }
}

function returnToKekkaiTitle() {
  window.location.assign(KEKKAI_TITLE_URL);
}

function performTraverseStoneAction(action, requestedQuantity = 1, targetTileId = null, options = {}) {
  if (!state.traverseMode || state.traverseBusy || !state.traverseLog) return;
  const unlimitedStock = kekkaiTesterModeActive();
  const testerPlacement = action === "place"
    && unlimitedStock
    && validGeo(options.temporaryGeo);
  refreshTraverseStock();
  const quantity = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
  if (action === "place" && !unlimitedStock && (state.traverseLog.stock?.amount ?? 0) <= 0) {
    showAppToast(t("traverse.stockEmpty"), { error: true });
    returnToTraverseActionMenu();
    return;
  }

  const applyAtGeo = (geo) => {
    const tileId = tileIdFromGeo(geo);
    if (!tileId) {
      state.traverseBusy = false;
      showAppToast(t("traverse.gpsUnavailable"), { error: true });
      returnToTraverseActionMenu();
      return;
    }
    if (targetTileId && tileId !== targetTileId) {
      state.traverseBusy = false;
      showAppToast(t("traverse.tileMismatch"), { error: true });
      returnToTraverseActionMenu();
      return;
    }

    const stoneId = stoneIdFromTile(tileId);
    let stone = stoneId ? state.traverseLog.stones[stoneId] : null;
    if (action === "place") {
      const stoneCap = stoneCapFor(state.traverseLog, stoneId, currentKekkaishiRankInfo().rank.index);
      const limit = actionQuantityLimit("place", {
        amount: state.traverseLog.stock.amount,
        stone,
        stoneCap,
        unlimitedStock
      });
      if (limit <= 0) {
        state.traverseBusy = false;
        showAppToast(t("traverse.capReached"), { error: true });
        returnToTraverseActionMenu();
        return;
      }
      const count = Math.min(quantity, limit);
      for (let index = 0; index < count; index += 1) {
        const now = new Date().toISOString();
        const nextStone = stone ?? {
          tile: tileId,
          lat: null,
          lng: null,
          countExact: 0,
          count: 0,
          firstAt: now,
          lastAt: now
        };
        nextStone.countExact = stoneExactCount(nextStone) + 1;
        nextStone.count = stoneDisplayCount(nextStone);
        nextStone.firstAt ||= now;
        nextStone.lastAt = now;
        state.traverseLog.stones[stoneId] = nextStone;
        stone = nextStone;
        if (!unlimitedStock) state.traverseLog.stock.amount = Math.max(0, state.traverseLog.stock.amount - 1);
        appendBarrierEvent(state.traverseLog, {
          type: "stone-placed",
          at: now,
          tile: tileId,
          stoneId,
          barrierId: barrierIdForStone(state.traverseLog, stoneId),
          amount: 1,
          countExact: nextStone.countExact
        });
      }
    } else {
      const limit = actionQuantityLimit("pick", {
        amount: state.traverseLog.stock.amount,
        stone,
        stoneCap: stoneCapFor(state.traverseLog, stoneId, currentKekkaishiRankInfo().rank.index),
        unlimitedStock
      });
      if (limit <= 0) {
        state.traverseBusy = false;
        showAppToast(stone ? t("traverse.stockFull") : t("traverse.noStone"), { error: true });
        returnToTraverseActionMenu();
        return;
      }
      const count = Math.min(quantity, limit);
      for (let index = 0; index < count; index += 1) {
        const now = new Date().toISOString();
        const isVertex = stoneCapFor(state.traverseLog, stoneId, currentKekkaishiRankInfo().rank.index) > BARRIER_CONFIG.stoneCapLoose;
        stone.countExact = Math.max(isVertex ? 1 : 0, stoneExactCount(stone) - 1);
        stone.count = stoneDisplayCount(stone);
        stone.lastAt = now;
        if (stone.countExact <= 0) delete state.traverseLog.stones[stoneId];
        if (!unlimitedStock) {
          state.traverseLog.stock.amount = Math.min(stockCapForRank(currentKekkaishiRankInfo().rank.index), state.traverseLog.stock.amount + 1);
        }
        appendBarrierEvent(state.traverseLog, {
          type: "stone-picked",
          at: now,
          tile: tileId,
          stoneId,
          barrierId: barrierIdForStone(state.traverseLog, stoneId),
          amount: 1,
          countExact: stone.countExact
        });
        if (stone.countExact <= 0) break;
      }
    }
    if (testerPlacement) {
      state.pendingGeo = geo;
    } else {
      state.currentGeo = geo;
      state.lastLocationUpdateAt = Date.now();
      state.lastLocationError = null;
    }
    persistTraverseLog();
    state.traverseBusy = false;
    if (action === "place" && state.traversePlaceViewSnapshot) state.traversePlaceViewSnapshot.placed = true;
    returnToTraverseActionMenu();
  };

  state.traverseBusy = true;
  render();
  if (testerPlacement) {
    applyAtGeo(normalizeGeo(options.temporaryGeo));
    return;
  }
  if (!navigator.geolocation?.getCurrentPosition) {
    state.traverseBusy = false;
    showAppToast(t("traverse.gpsUnavailable"), { error: true });
    returnToTraverseActionMenu();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const accuracy = Number(position.coords?.accuracy);
      if (!Number.isFinite(accuracy) || accuracy > BARRIER_CONFIG.accuracyThresholdMeters) {
        state.traverseBusy = false;
        showAppToast(t("traverse.accuracyError"), { error: true });
        returnToTraverseActionMenu();
        return;
      }
      applyAtGeo(normalizeGeo({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy
      }));
    },
    () => {
      state.traverseBusy = false;
      showAppToast(t("traverse.gpsUnavailable"), { error: true });
      returnToTraverseActionMenu();
    },
    geolocationOptions()
  );
}

function barrierIdForStone(log, stoneId) {
  return Object.entries(log?.barriers || {})
    .find(([, barrier]) => barrierStoneIds(barrier).includes(stoneId))?.[0] || null;
}

function beginBarrierSelectionPreview() {
  if (!state.traverseMode || state.traverseBusy || state.barrierSelection.length < 2) return false;
  state.barrierLinkSourceSelection = [...state.barrierSelection];
  state.barrierLinkPreview = true;
  state.barrierLinkPath = [];
  state.barrierLinkingMode = true;
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPendingStoneId = null;
  state.barrierLinkSettledDiamonds = [];
  state.barrierLinkDiamondAnimations = [];
  if (state.barrierLinkDiamondFrameId !== null) {
    window.cancelAnimationFrame(state.barrierLinkDiamondFrameId);
  }
  state.barrierLinkDiamondFrameId = null;
  state.selectedBarrierId = null;
  canvas.classList.add("is-barrier-linking");
  showAppToast(t("traverse.linkReady"));
  fitBarrierPlacementView({ linkOnly: true, selectedOnly: true, room: true });
  render();
  return true;
}

function confirmBarrierSelectionPreview() {
  return Boolean(state.barrierLinkPreview);
}

function cancelBarrierSelectionPreview() {
  if (!state.barrierLinkPreview) return;
  const sourceSelection = [...state.barrierLinkSourceSelection];
  resetBarrierLinkState();
  state.barrierLinkSourceSelection = [];
  state.barrierSelection = sourceSelection;
  state.pointer.drag = null;
  render();
}

function undoBarrierLinkSegment() {
  if (!state.barrierLinkPreview || state.barrierLinkPath.length <= 1) return;
  clearBarrierLinkHoldVisual();
  state.barrierLinkPath = state.barrierLinkPath.slice(0, -1);
  state.barrierLinkSettledDiamonds = state.barrierLinkSettledDiamonds.filter((entry) => (
    state.barrierLinkPath.includes(entry.stoneId)
  ));
  state.barrierSelection = state.barrierLinkPath.length > 0
    ? [...state.barrierLinkPath]
    : [...state.barrierLinkSourceSelection];
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPendingStoneId = null;
  if (state.pointer.drag?.barrierLink) {
    state.pointer.drag.barrierLinkStarted = false;
    state.pointer.drag.barrierLink = false;
    state.pointer.drag = null;
  }
  state.barrierLinkingMode = true;
  canvas.classList.add("is-barrier-linking");
  showAppToast(t("traverse.linkReady"));
  render();
}

function selectedBarrierStoneTile() {
  const stoneId = state.barrierSelection[0];
  return stoneId ? state.traverseLog?.stones?.[stoneId]?.tile || null : null;
}

function testerPlacementHasMultipleSelection() {
  const selectionCount = state.selection.length
    + state.barrierSelection.length
    + (state.selectedBarrierId ? 1 : 0);
  return selectionCount > 1;
}

function testerPlacementTarget() {
  if (!kekkaiTesterModeActive()) return null;
  if (testerPlacementHasMultipleSelection()) return null;

  const point = lastSelectedPoint();
  const pinnedGeo = point && !point.isVirtual ? pointGeo(point) : null;
  if (validGeo(pinnedGeo)) {
    const geo = normalizeGeo(pinnedGeo);
    return {
      kind: "pin",
      geo,
      tileId: tileIdFromGeo(geo),
      label: `地点「${point.title || "無題"}」`
    };
  }

  if (state.barrierSelection.length === 1) {
    const tileId = selectedBarrierStoneTile();
    const geo = tileId ? tileCenterGeo(tileId) : null;
    if (validGeo(geo)) {
      return { kind: "cell", geo: normalizeGeo(geo), tileId, label: "セル" };
    }
  }

  if (validGeo(state.pendingGeo)) {
    const geo = normalizeGeo(state.pendingGeo);
    return {
      kind: "temporary",
      geo,
      tileId: tileIdFromGeo(geo),
      label: "仮ポイント"
    };
  }

  return null;
}

function barrierPinTargets() {
  const targets = [];
  if (validGeo(state.pendingGeo)) {
    targets.push({ id: "pending", geo: normalizeGeo(state.pendingGeo), label: t("traverse.pinPending") });
  }
  if (validGeo(state.currentGeo)) {
    targets.push({ id: "current", geo: normalizeGeo(state.currentGeo), label: t("traverse.pinCurrent") });
  }
  return targets;
}

function renderBarrierPinDialog() {
  const targets = barrierPinTargets();
  const hasMultipleTargets = targets.length > 1;
  const selectedTarget = targets.find((target) => target.id === state.barrierPinTarget) || targets[0] || null;
  state.barrierPinTarget = selectedTarget?.id || null;

  if (elements.barrierPinTargetFieldset) {
    elements.barrierPinTargetFieldset.hidden = !hasMultipleTargets;
  }
  if (elements.barrierPinTargetPending) {
    elements.barrierPinTargetPending.checked = selectedTarget?.id === "pending";
    elements.barrierPinTargetPending.disabled = !targets.some((target) => target.id === "pending");
  }
  if (elements.barrierPinTargetCurrent) {
    elements.barrierPinTargetCurrent.checked = selectedTarget?.id === "current";
    elements.barrierPinTargetCurrent.disabled = !targets.some((target) => target.id === "current");
  }
  if (elements.barrierPinTargetStatus) {
    elements.barrierPinTargetStatus.textContent = selectedTarget?.label || t("traverse.pinNoTarget");
    elements.barrierPinTargetStatus.hidden = hasMultipleTargets;
  }
  if (elements.barrierPinConfirmButton) {
    elements.barrierPinConfirmButton.disabled = !selectedTarget;
  }
}

function closeBarrierPinDialog() {
  const dialog = elements.barrierPinDialog;
  const wasOpen = Boolean(dialog?.open);
  state.barrierPinMode = false;
  state.barrierPinTarget = null;
  dialog?.classList.remove("is-placement-overlay");
  dialog?.style.removeProperty("--traverse-quantity-bottom");
  if (wasOpen) dialog.close("cancel");
}

function openBarrierPinDialog() {
  if (!state.traverseMode || state.traverseBusy || !elements.barrierPinDialog) return false;
  if (state.barrierPinMode) {
    closeBarrierPinDialog();
    render();
    return true;
  }
  const targets = barrierPinTargets();
  if (targets.length === 0) {
    showAppToast(t("traverse.pinNoTarget"), { error: true });
    return false;
  }

  resetBarrierLinkState();
  resetDragonEyeState();
  state.barrierPlacementView = false;
  state.barrierDissolveMode = false;
  state.barrierPinMode = true;
  state.barrierPinTarget = targets.some((target) => target.id === "pending") ? "pending" : "current";
  elements.barrierPinTitle.value = "結界ピン";
  elements.barrierPinDialog.classList.add("is-placement-overlay");
  renderBarrierPinDialog();
  if (!elements.barrierPinDialog.open) elements.barrierPinDialog.show();
  render();
  window.requestAnimationFrame(() => syncTraverseQuantityDialogPositionFor(elements.barrierPinDialog));
  window.setTimeout(() => elements.barrierPinTitle?.focus(), 0);
  return true;
}

function submitBarrierPin() {
  const target = barrierPinTargets().find((item) => item.id === state.barrierPinTarget) || barrierPinTargets()[0];
  if (!target) {
    showAppToast(t("traverse.pinNoTarget"), { error: true });
    return;
  }

  const title = elements.barrierPinTitle?.value.trim() || "結界ピン";
  closeBarrierPinDialog();
  state.mode = "add";
  state.pendingGeo = target.geo;
  state.editingPointId = null;
  state.pointDestinationListId = pointListStorageKey(kekkaiPointList());
  state.pendingLinkPointId = null;
  elements.pointTitle.value = title;
  elements.pointNote.value = "";
  elements.pointPhoto.value = "";
  fillFormFromGeo(target.geo);
  setSelection([], { clearPending: false, render: false });
  render();
  if (typeof elements.pointForm.requestSubmit === "function") {
    elements.pointForm.requestSubmit();
  } else {
    elements.pointForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }
  showAppToast(t("traverse.pinRegistered"));
}

function handleBarrierQuickAction(action) {
  if (!state.traverseMode) return false;
  if (action === "pin") return openBarrierPinDialog();
  if (action === "place") {
    if (kekkaiTesterModeActive() && testerPlacementHasMultipleSelection()) return false;
    const testerTarget = testerPlacementTarget();
    if (testerTarget) {
      return openTraverseQuantityDialog("place", {
        targetTileId: testerTarget.tileId,
        temporaryGeo: testerTarget.geo
      });
    }
    return openTraverseQuantityDialog("place");
  }
  if (action === "connect") {
    if (!state.barrierLinkPreview) beginBarrierSelectionPreview();
    return true;
  }
  if (action === "dragon-eye") {
    if (state.dragonEye.active) openDragonEyeControlPanel();
    else openDragonEyeDialog();
    return true;
  }
  if (action === "invert") {
    const visibleIds = Object.values(state.traverseLog?.stones || {})
      .filter((stone) => stoneDisplayCount(stone) > 0)
      .map((stone) => stoneIdFromTile(stone.tile))
      .filter(Boolean);
    const selected = new Set(state.barrierSelection);
    state.barrierSelection = visibleIds.filter((id) => !selected.has(id));
    render();
    return true;
  }
  if (action === "analyze") {
    if (state.selectedBarrierId) {
      renderBarrierDetails();
      return true;
    }
    showAppToast(t("barrier.selection").replace("{count}", String(state.barrierSelection.length)));
    return true;
  }
  if (action === "share") {
    const shareableSelectedObjectCount = selectedShareableObjectCount();
    if (shareableSelectedObjectCount > 0) void shareSelectedPointsFile();
    else if (state.selectedBarrierId) void shareSelectedBarrierFigure();
    else showAppToast(t("barrier.selectToDissolve"), { error: true });
    return true;
  }
  if (action === "pick") {
    const tile = selectedBarrierStoneTile();
    return openTraverseQuantityDialog("pick", tile ? { targetTileId: tile } : {});
  }
  if (action === "discard") {
    if (selectionCanBeDeleted()) void deleteSelectedPoint();
    return true;
  }
  if (action === "dissolve") {
    enterBarrierDissolveMode();
    return true;
  }
  if (action === "placement") {
    enterBarrierPlacementView();
    return true;
  }
  if (action === "map") {
    openSelectedPointInPreferredMap();
    return true;
  }
  if (action === "clear") {
    state.barrierPinMode = false;
    clearSelection();
    return true;
  }
  return false;
}

function setActionButtonIcon(button, iconId) {
  const icon = button?.querySelector("use");
  if (icon && iconId) icon.setAttribute("href", `#${iconId}`);
}

function setBarrierPlaceholder(button, placeholder) {
  if (!button) return;
  button.classList.toggle("is-barrier-placeholder", placeholder);
  if (placeholder) {
    setActionButtonLabel(button, "");
    button.title = "";
    button.setAttribute("aria-label", "空き枠");
    button.disabled = true;
  } else {
    button.removeAttribute("aria-label");
  }
}

function selectionCanBeDeleted() {
  const pointIds = selectedPointIds();
  const deletablePointCount = pointIds.filter((id) => (
    id !== CURRENT_LOCATION_ID
    && (pointEditable(id) || (state.cloud.connected && cloudPointListForPoint(id)?.editable))
  )).length;
  return deletablePointCount + selectedLinkIds().length + selectedFigureIds().length > 0
    || isLoadedObservationSelected();
}

function selectedShareableObjectCount() {
  return selectedPointIds()
    .map(findPoint)
    .filter((point) => point && point.id !== CURRENT_LOCATION_ID)
    .length + selectedLinkIds().length + selectedFigureIds().length;
}

function renderActionButtons() {
  const hasPendingPoint = validGeo(state.pendingGeo);
  const pointIds = selectedPointIds();
  const visiblePointCount = new Set(visibleSelectablePoints().map((point) => point.id)).size;
  const displayableListEntries = storageListEntries().filter((entry) => entry.local || entry.preview || entry.cloud);
  const visibleListCount = displayableListEntries.filter((entry) => storageListIsVisible(entry)).length;
  const clearableVisibleListCount = displayableListEntries.filter((entry) => (
    storageListIsVisible(entry) && !storageListIsPointRegistrationDestination(entry)
  )).length;
  const hiddenListCount = displayableListEntries.length - visibleListCount;
  const canInvertSelection = !state.editingPointId
    && !hasPendingPoint
    && visiblePointCount > 0;
  const linkIds = selectedLinkIds();
  const figureIds = selectedFigureIds();
  const barrierSelectionCount = state.barrierSelection.length;
  const routePlan = routePlanFromCurrentSelection();
  const routeActive = Boolean(state.routeResult);
  const centerCandidateCount = pointIds.length;
  const mapPoints = externalMapPointsForSelection();
  const mapCandidate = mapPoints.at(-1) ?? null;
  const mapRouteActive = mapPoints.length > 1;
  const canDelete = selectionCanBeDeleted();
  const transferablePointCount = transferableSelectedPoints().length;
  const analysisTarget = selectionAnalysisTarget();

  const canOpenRegistration = !hasPendingPoint && state.selection.length === 0;
  elements.actionRegisterButton.disabled = !hasPendingPoint && !canOpenRegistration;
  elements.actionLinkButton.disabled = pointIds.length < 2;
  elements.actionAnalyzeButton.disabled = !analysisTarget;
  elements.actionRouteButton.disabled = !routeActive && !routePlan;
  elements.deletePointButton.disabled = !canDelete;
  const canClearSelection = state.selection.length > 0 || hasPendingPoint || barrierSelectionCount > 0;
  elements.clearSelectionButton.disabled = !canClearSelection;
  elements.actionCenterButton.disabled = centerCandidateCount < 2;
  const shareableSelectedPointCount = selectedPointIds()
    .map(findPoint)
    .filter((point) => point && point.id !== CURRENT_LOCATION_ID)
    .length;
  const shareableSelectedLineCount = selectedLinkIds().length;
  const shareableSelectedFigureCount = selectedFigureIds().length;
  const shareableSelectedObjectCount = selectedShareableObjectCount();
  elements.actionCopyToListButton.disabled = transferablePointCount === 0;
  elements.actionMoveToListButton.disabled = transferablePointCount === 0;
  elements.actionShareSelectedButton.disabled = shareableSelectedObjectCount === 0;
  elements.actionMapButton.disabled = !mapCandidate;
  elements.actionInvertButton.disabled = !canInvertSelection;
  for (const button of elements.selectAllListButtons) {
    button.disabled = hiddenListCount === 0;
  }
  for (const button of elements.clearAllListButtons) {
    button.disabled = clearableVisibleListCount === 0;
  }
  elements.actionMapButton.title = mapRouteActive
    ? `選択順で${mapPoints.length}地点のルートを地図で開く`
    : mapCandidate?.isPending
    ? "仮ポイントを地図で開く"
    : mapCandidate?.isCenter
      ? "選択対象の中心を地図で開く"
      : mapCandidate
        ? "選択地点を地図で開く"
        : "地点・図形・頂点セルを選択または仮ポイントを作成すると地図で開けます";

  elements.actionRegisterButton.classList.remove("is-active");
  elements.actionRegisterButton.title = hasPendingPoint ? "仮ポイントを登録" : canOpenRegistration ? "地点登録画面を開く" : "仮ポイントを作成すると登録できます";
  elements.actionLinkButton.classList.toggle("is-active", false);
  if (elements.actionLinkLabel) elements.actionLinkLabel.textContent = t("action.connect");
  elements.actionLinkButton.title = pointIds.length >= 3
    ? `選択順に${pointIds.length}地点を接続（最後と最初も接続）`
    : pointIds.length >= 2
      ? `選択順に${pointIds.length}地点を接続`
      : "2地点以上を選択すると接続できます";
  elements.actionAnalyzeButton.title = analysisTarget ? t("action.analyzeTitle") : t("analysis.noSelection");
  elements.clearSelectionButton.title = hasPendingPoint && state.selection.length === 0 && barrierSelectionCount === 0
    ? "仮ポイントを解除"
    : t("action.clear");
  elements.actionRouteButton.classList.toggle("is-active", routeActive);
  elements.actionRouteButton.setAttribute("aria-pressed", String(routeActive));
  elements.actionRouteButton.title = routeActive ? "巡回表示を解除" : routePlan ? "選択点を起点から巡回計算" : "起点を指定するか3地点以上を選択";
  elements.deletePointButton.classList.toggle("is-active", false);
  elements.clearSelectionButton.classList.toggle("is-active", false);
  elements.actionCenterButton.classList.toggle("is-active", false);
  elements.actionCopyToListButton.classList.toggle("is-active", false);
  elements.actionMoveToListButton.classList.toggle("is-active", false);
  elements.actionCopyToListButton.title = transferablePointCount > 0
    ? cloudText("コピー先を選択", "Choose a copy destination")
    : t("list.transferNoSelection");
  elements.actionMoveToListButton.title = transferablePointCount > 0
    ? cloudText("移動先を選択", "Choose a move destination")
    : t("list.transferNoSelection");
  elements.actionShareSelectedButton.title = shareableSelectedObjectCount > 0
    ? cloudText(
      `選択した地点${shareableSelectedPointCount}・線${shareableSelectedLineCount}・図形${shareableSelectedFigureCount}を共有`,
      `Share ${shareableSelectedPointCount} point(s), ${shareableSelectedLineCount} line(s), and ${shareableSelectedFigureCount} figure(s)`
    )
    : t("list.shareSelectedUnavailable");
  elements.actionMapButton.classList.toggle("is-active", false);
  elements.actionInvertButton.classList.toggle("is-active", false);
  elements.actionInvertButton.title = visiblePointCount > 0
    ? t("action.invertTitle")
    : t("state.noPoints");
  elements.pointSubmitButton.textContent = state.editingPointId ? t("button.update") : t("button.submitRegister");
  for (const [button, iconId] of [
    [elements.actionRegisterButton, "icon-plus-circle"],
    [elements.actionLinkButton, "icon-connect"],
    [elements.actionCenterButton, "icon-center"],
    [elements.clearSelectionButton, "icon-clear"],
    [elements.actionInvertButton, "icon-invert"],
    [elements.actionRouteButton, "icon-route"],
    [elements.actionAnalyzeButton, "icon-analysis"],
    [elements.actionShareSelectedButton, "icon-share"],
    [elements.deletePointButton, "icon-trash"],
    [elements.actionCopyToListButton, "icon-copy"],
    [elements.actionMoveToListButton, "icon-move"],
    [elements.actionMapButton, "icon-map"]
  ]) {
    setBarrierPlaceholder(button, false);
    setActionButtonIcon(button, iconId);
  }
  setActionButtonLabel(elements.actionRegisterButton, t("action.register"));
  setActionButtonLabel(elements.actionLinkButton, t("action.connect"));
  setActionButtonLabel(elements.actionCenterButton, t("action.center"));
  setActionButtonLabel(elements.clearSelectionButton, t("action.clear"));
  setActionButtonLabel(elements.actionInvertButton, t("action.invert"));
  setActionButtonLabel(elements.actionRouteButton, t("action.route"));
  setActionButtonLabel(elements.actionAnalyzeButton, t("action.analyze"));
  setActionButtonLabel(elements.actionShareSelectedButton, t("action.shareSelected"));
  setActionButtonLabel(elements.deletePointButton, t("action.delete"));
  setActionButtonLabel(elements.actionCopyToListButton, t("action.copyToList"));
  setActionButtonLabel(elements.actionMoveToListButton, t("action.moveToList"));
  setActionButtonLabel(elements.actionMapButton, t("action.map"));
  renderLocationFollowButton();
  if (state.traverseMode) renderTraverseQuickActions();
}

function setActionButtonLabel(button, label) {
  const node = button?.querySelector("span");
  if (node) node.textContent = label;
}

function renderTraverseQuickActions() {
  const selectedCount = state.barrierSelection.length;
  const hasPendingPoint = validGeo(state.pendingGeo);
  const shareableSelectedObjectCount = selectedShareableObjectCount();
  const mapPoints = externalMapPointsForSelection();
  const mapCandidate = mapPoints.at(-1) ?? null;
  const mapRouteActive = mapPoints.length > 1;
  const hasSelection = selectedCount > 0
    || state.selection.length > 0
    || Boolean(state.selectedBarrierId)
    || state.barrierPinMode
    || hasPendingPoint;
  const preview = state.barrierLinkPreview;
  const testerPlacement = kekkaiTesterModeActive();
  const testerMultipleSelection = testerPlacement && testerPlacementHasMultipleSelection();
  const testerTarget = testerPlacementTarget();
  const canPlace = !state.traverseBusy
    && !testerMultipleSelection
    && traverseQuantityLimit("place", testerTarget?.tileId || null);
  const blankButtons = [elements.actionCopyToListButton, elements.actionMoveToListButton];
  const activeButtons = [
    elements.actionRegisterButton,
    elements.actionCenterButton,
    elements.actionLinkButton,
    elements.clearSelectionButton,
    elements.actionInvertButton,
    elements.actionShareSelectedButton,
    elements.actionMapButton,
    elements.actionAnalyzeButton,
    elements.deletePointButton,
    elements.actionRouteButton
  ];
  for (const button of [...activeButtons, ...blankButtons]) setBarrierPlaceholder(button, false);
  setActionButtonIcon(elements.actionRegisterButton, "icon-plus-circle");
  setActionButtonIcon(elements.actionCenterButton, "icon-center");
  setActionButtonIcon(elements.actionLinkButton, "icon-plus-circle");
  setActionButtonIcon(elements.clearSelectionButton, "icon-connect");
  setActionButtonIcon(elements.actionInvertButton, "icon-clear");
  setActionButtonIcon(elements.actionRouteButton, "icon-analysis");
  setActionButtonLabel(elements.actionRegisterButton, "打つ");
  setActionButtonLabel(elements.actionCenterButton, "測る");
  setActionButtonLabel(elements.actionLinkButton, "置く");
  setActionButtonLabel(elements.clearSelectionButton, "結ぶ");
  setActionButtonLabel(elements.actionInvertButton, "解除");
  setActionButtonLabel(elements.actionRouteButton, "評価");
  setActionButtonIcon(elements.deletePointButton, "icon-trash");
  setActionButtonLabel(elements.deletePointButton, "破棄");
  setActionButtonLabel(elements.actionShareSelectedButton, t("action.shareSelected"));
  setActionButtonLabel(elements.actionMapButton, t("action.map"));
  setActionButtonLabel(elements.actionAnalyzeButton, t("action.analyze"));
  for (const button of blankButtons) setBarrierPlaceholder(button, true);

  elements.actionRegisterButton.disabled = state.traverseBusy;
  elements.actionCenterButton.disabled = state.traverseBusy;
  elements.actionLinkButton.disabled = state.traverseBusy || !canPlace;
  elements.clearSelectionButton.disabled = state.traverseBusy || (!preview && selectedCount < 2);
  elements.actionInvertButton.disabled = state.traverseBusy || !hasSelection;
  elements.deletePointButton.disabled = state.traverseBusy || !selectionCanBeDeleted();
  elements.actionShareSelectedButton.disabled = state.traverseBusy || (
    shareableSelectedObjectCount === 0 && !state.selectedBarrierId
  );
  elements.actionMapButton.disabled = !mapCandidate;
  elements.actionAnalyzeButton.disabled = state.traverseBusy || (selectedCount === 0 && !state.selectedBarrierId);
  elements.actionRouteButton.disabled = false;
  elements.actionRegisterButton.title = state.barrierPinMode ? "ピンを打つ場所をタップ" : "ピンを打つ";
  elements.actionCenterButton.title = "龍脈眼で測る";
  elements.actionLinkButton.title = testerMultipleSelection
    ? "配置先は1つだけ選択してください"
    : testerTarget
    ? `${testerTarget.label}に結界石を置く`
    : "結界石を置く";
  elements.clearSelectionButton.title = preview ? t("traverse.connect") : "2つ以上の石を選択すると結べます";
  elements.actionInvertButton.title = hasPendingPoint ? "仮ポイントを解除" : "選択を解除";
  elements.deletePointButton.title = "本体アトラスの選択対象を破棄";
  elements.actionShareSelectedButton.title = shareableSelectedObjectCount > 0
    ? cloudText(
      `選択した結界図形を共有`,
      "Share the selected barrier figure"
    )
    : t("barrier.share");
  elements.actionMapButton.title = mapRouteActive
    ? `選択順で${mapPoints.length}地点のルートを地図で開く`
    : mapCandidate?.isCenter
    ? "選択対象の中心を地図で開く"
    : mapCandidate
      ? "選択地点を地図で開く"
      : "地点・図形・頂点セルを選択すると地図で開けます";
  elements.actionAnalyzeButton.title = t("action.analyze");
  elements.actionRouteButton.title = "結界師の評価を見る";
  elements.actionRegisterButton.classList.toggle("is-active", state.barrierPinMode);
  elements.actionCenterButton.classList.toggle("is-active", state.dragonEye.active);
  elements.clearSelectionButton.classList.toggle("is-active", preview);
  elements.actionShareSelectedButton.classList.toggle("is-active", false);
  elements.actionMapButton.classList.toggle("is-active", false);
  elements.actionAnalyzeButton.classList.toggle("is-active", false);
  elements.actionRouteButton.classList.toggle("is-active", false);
}

function renderPointInfoDialog() {
  if (!elements.pointInfoDialog?.open) {
    return;
  }

  const point = state.pointInfoTargetId
    ? findPoint(state.pointInfoTargetId)
    : singleSelectedPoint();
  if (!point) {
    elements.pointInfoDialog.close("selection-changed");
    return;
  }

  elements.pointInfoDialog.dataset.pointId = point.id
  const geo = pointGeo(point);
  const accuracy = Number.isFinite(geo.accuracy) ? ` / +/-${formatDistance(geo.accuracy)}` : "";
  const current = currentLocationPoint();
  const distance = current && point.id !== CURRENT_LOCATION_ID
    ? formatDistance(distanceBetween(current, point))
    : t("label.none");

  if (elements.pointInfoSummaryTitle) {
    const isSelected = state.selection.some((entry) => entry.type === "point" && entry.id === point.id);
    elements.pointInfoSummaryTitle.textContent = isSelected ? t("info.summary") : t("info.displayTarget");
  }
  elements.pointInfoName.textContent = point.title;
  elements.pointInfoComment.textContent = point.note || t("info.noComment");
  elements.pointInfoComment.classList.toggle("is-muted", !point.note);
  elements.pointInfoCoords.textContent = `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}${accuracy}`;
  elements.pointInfoList.textContent = pointListNameForPoint(point) || t("label.none");
  elements.pointInfoCreated.textContent = point.isVirtual ? currentLocationLabel() : formatOptionalDate(point.createdAt);
  elements.pointInfoUpdated.textContent = formatOptionalDate(point.updatedAt);
  elements.pointInfoDistance.textContent = distance;
  elements.pointInfoEditButton.disabled = state.cloud.busy || !pointEditable(point.id);
  setPointInfoActionLabel(elements.pointInfoEditButton, t("action.edit"));
  setPointInfoActionLabel(elements.pointInfoMapButton, t("action.map"));

  if (point.photoAssetId && (!point.photo || point.photo.startsWith("blob:"))) {
    void hydratePointPhotoForDisplay(point).then((changed) => {
      if (changed && elements.pointInfoDialog.open && state.pointInfoTargetId === point.id) {
        renderPointInfoDialog();
      }
    }).catch(() => {});
  }
  if (point.photo) {
    elements.pointInfoPhoto.hidden = false;
    elements.pointInfoPhoto.src = point.photo;
    elements.pointInfoPhoto.alt = point.photoName || point.title;
  } else {
    elements.pointInfoPhoto.hidden = true;
    elements.pointInfoPhoto.removeAttribute("src");
    elements.pointInfoPhoto.alt = t("info.noPhoto");
  }
}

function formatOptionalDate(value) {
  if (!value) {
    return t("label.none");
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t("label.none") : formatDate(value);
}

function pointListNameForPoint(point) {
  if (!point || point.id === CURRENT_LOCATION_ID) {
    return "";
  }

  const localList = state.pointLists.find((list) => findPointIn(point.id, list.points));
  if (localList) {
    return localList.name;
  }

  const cloudList = state.cloud.pointLists.find((list) => findPointIn(point.id, list.points));
  return cloudList?.name || "";
}

function closePointListPreviewDialog(reason = "cancel") {
  if (elements.pointListPreviewDialog?.open) {
    elements.pointListPreviewDialog.close(reason);
  }
}

function currentPointInfoOrigin() {
  if (elements.pointListPreviewDialog?.open && state.mobilePointPreviewStorageId) {
    return {
      kind: "preview",
      storageId: state.mobilePointPreviewStorageId
    };
  }
  return {
    kind: state.mobileGridPage === "points" ? "points" : "grid"
  };
}

function pointInfoSelectionSnapshot(context) {
  if (Array.isArray(context?.selection)) {
    return context.selection
      .filter((entry) => entry && typeof entry.type === "string" && typeof entry.id === "string")
      .map((entry) => ({ type: entry.type, id: entry.id }));
  }
  return context?.pointId ? [{ type: "point", id: context.pointId }] : [];
}

function restorePointInfoSelection(context) {
  state.selection = pointInfoSelectionSnapshot(context);
  normalizeSelection();
}

function clearPointInfoReturnContext() {
  state.pointInfoReturnContext = null;
  state.pointInfoTargetId = null;
  state.pointInfoReturnPhase = null;
  try {
    sessionStorage.removeItem(POINT_INFO_MAP_RETURN_KEY);
  } catch {}
}

function capturePointInfoReturnContext(point = singleSelectedPoint()) {
  if (!point) return false;
  state.pointInfoReturnContext = {
    pointId: point.id,
    origin: currentPointInfoOrigin(),
    selection: state.selection.map((entry) => ({ type: entry.type, id: entry.id }))
  };
  return true;
}

function ensurePointInfoReturnContext() {
  return Boolean(state.pointInfoReturnContext) || capturePointInfoReturnContext();
}

function beginPointInfoEditingReturn() {
  if (!ensurePointInfoReturnContext()) return;
  state.pointInfoReturnPhase = "editing";
}

function beginPointInfoMapReturn() {
  if (!ensurePointInfoReturnContext()) return;
  state.pointInfoReturnPhase = "info";
  try {
    sessionStorage.setItem(POINT_INFO_MAP_RETURN_KEY, JSON.stringify(state.pointInfoReturnContext));
  } catch {}
}

function restorePointInfoAfterEditing() {
  const context = state.pointInfoReturnContext;
  if (!context) return false;
  state.pointInfoReturnPhase = "info";
  if (mobilePageUiActive()) {
    setMobilePage("map");
    if (context.origin?.kind !== "preview") {
      setMobileGridPage(context.origin?.kind === "points" ? "points" : "grid");
    }
  }
  restorePointInfoSelection(context);
  state.pointInfoTargetId = context.pointId;
  render();
  showSelectedPointInfoDialog(context.pointId);
  return true;
}

function restorePointInfoOrigin() {
  const context = state.pointInfoReturnContext;
  if (!context) {
    clearPointInfoReturnContext();
    return;
  }

  restorePointInfoSelection(context);
  if (context.origin?.kind === "preview") {
    showPointListPreview(context.origin.storageId);
    clearPointInfoReturnContext();
    return;
  }
  setMobilePage("map");
  setMobileGridPage(context.origin?.kind === "points" ? "points" : "grid");
  clearPointInfoReturnContext();
}

function restorePointInfoMapReturn() {
  if (elements.pointInfoDialog?.open) {
    try {
      sessionStorage.removeItem(POINT_INFO_MAP_RETURN_KEY);
    } catch {}
    return;
  }

  let raw = "";
  try {
    raw = sessionStorage.getItem(POINT_INFO_MAP_RETURN_KEY) || "";
    sessionStorage.removeItem(POINT_INFO_MAP_RETURN_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let context;
  try {
    context = JSON.parse(raw);
  } catch {
    return;
  }
  if (!context?.pointId || !context.origin) return;
  state.pointInfoReturnContext = context;
  state.pointInfoReturnPhase = "info";
  restorePointInfoSelection(context);
  state.pointInfoTargetId = context.pointId;
  render();
  showSelectedPointInfoDialog(context.pointId);
}

function markPointInfoOpenedFromPointLongPress() {
  state.pointInfoBackdropClickPending = true;
}

function handlePointInfoRelease() {
  if (!state.pointInfoBackdropClickPending) return;
  state.pointInfoBackdropClickPending = false;
  state.pointInfoBackdropClickSuppressed = true;
  window.setTimeout(() => {
    state.pointInfoBackdropClickSuppressed = false;
  }, 250);
}

function openPointInfoForPoint(point, { fromLongPress = false } = {}) {
  const resolved = typeof point === "string" ? findPointAny(point) : point;
  if (!resolved) {
    showAppToast(t("info.unavailable"), { error: true });
    return;
  }
  capturePointInfoReturnContext(resolved);
  state.pointInfoTargetId = resolved.id;
  if (fromLongPress) markPointInfoOpenedFromPointLongPress();
  showSelectedPointInfoDialog(resolved.id);
}

function renderGridPointQuickDialog() {
  if (!elements.gridPointQuickDialog?.open) return;
  if (state.gridPointQuickStoneId) {
    renderGridBarrierStoneQuickDialog();
    return;
  }
  const point = state.gridPointQuickPointId ? findPoint(state.gridPointQuickPointId) : null;
  if (!point) {
    elements.gridPointQuickDialog.close("selection-changed");
    return;
  }

  const canSetObservationRole = !point.isVirtual;
  const isCurrentLocation = point.id === CURRENT_LOCATION_ID;
  const canEdit = !isCurrentLocation && pointEditable(point.id);
  const canTrack = isCurrentLocation && state.gpsEnabled && "geolocation" in navigator;
  const isStart = canSetObservationRole && point.id === state.routeStartPointId;
  const isTarget = canSetObservationRole && point.id === state.targetPointId;
  elements.gridPointQuickName.textContent = point.title;
  elements.gridPointQuickList.textContent = pointListNameForPoint(point) || t("label.none");
  elements.gridPointQuickStartLabel.textContent = t("action.start");
  elements.gridPointQuickTargetLabel.textContent = t("action.target");
  elements.gridPointQuickEditLabel.textContent = t("action.edit");
  elements.gridPointQuickTrackLabel.textContent = t("action.track");
  elements.gridPointQuickInfoLabel.textContent = t("action.info");
  elements.gridPointQuickStartButton.disabled = !canSetObservationRole;
  elements.gridPointQuickStartButton.classList.toggle("is-active", isStart);
  elements.gridPointQuickStartButton.setAttribute("aria-pressed", String(isStart));
  elements.gridPointQuickStartButton.setAttribute("aria-label", isStart ? t("button.clearStart") : t("button.setStart"));
  elements.gridPointQuickStartButton.title = isStart ? t("button.clearStart") : t("button.setStart");
  elements.gridPointQuickTargetButton.disabled = !canSetObservationRole;
  elements.gridPointQuickTargetButton.classList.toggle("is-active", isTarget);
  elements.gridPointQuickTargetButton.setAttribute("aria-pressed", String(isTarget));
  elements.gridPointQuickTargetButton.setAttribute("aria-label", isTarget ? t("button.clearTarget") : t("button.setTarget"));
  elements.gridPointQuickTargetButton.title = isTarget ? t("button.clearTarget") : t("button.setTarget");
  elements.gridPointQuickEditButton.hidden = isCurrentLocation;
  elements.gridPointQuickEditButton.disabled = state.cloud.busy || !canEdit;
  elements.gridPointQuickEditButton.setAttribute("aria-label", t("action.edit"));
  elements.gridPointQuickEditButton.title = t("action.edit");
  elements.gridPointQuickTrackButton.hidden = !isCurrentLocation;
  elements.gridPointQuickTrackButton.disabled = !canTrack;
  elements.gridPointQuickTrackButton.classList.toggle("is-active", state.followCurrentLocation);
  elements.gridPointQuickTrackButton.setAttribute("aria-pressed", String(state.followCurrentLocation));
  elements.gridPointQuickTrackButton.setAttribute("aria-label", state.followCurrentLocation ? t("button.stopTracking") : t("action.track"));
  elements.gridPointQuickTrackButton.title = state.followCurrentLocation ? t("button.stopTracking") : t("action.track");
  for (const button of barrierStoneQuickButtons()) button.hidden = true;
  for (const button of pointQuickButtons()) button.hidden = false;
}

function pointQuickButtons() {
  return [
    elements.gridPointQuickStartButton,
    elements.gridPointQuickTargetButton,
    elements.gridPointQuickEditButton,
    elements.gridPointQuickTrackButton,
    elements.gridPointQuickInfoButton
  ].filter(Boolean);
}

function barrierStoneQuickButtons() {
  return [
    elements.gridBarrierStoneQuickPlaceButton,
    elements.gridBarrierStoneQuickPickButton,
    elements.gridBarrierStoneQuickEditButton,
    elements.gridBarrierStoneQuickMemoButton,
    elements.gridBarrierStoneQuickMapButton
  ].filter(Boolean);
}

function findPointOnBarrierStone(stone) {
  const tileId = typeof stone?.tile === "string" ? stone.tile : null;
  if (!tileId) return null;
  const candidates = [
    ...allPointListPoints(),
    ...state.cloud.pointLists.flatMap((list) => Array.isArray(list?.points) ? list.points : [])
  ].filter((point) => {
    try {
      return tileIdFromGeo(pointGeo(point)) === tileId;
    } catch {
      return false;
    }
  });
  return candidates.find((point) => pointEditable(point.id)) || candidates[0] || null;
}

function renderGridBarrierStoneQuickDialog() {
  if (!elements.gridBarrierStoneQuickDialog?.open) return;
  if (!state.traverseMode || state.barrierLinkingMode || state.barrierDissolveMode) {
    elements.gridBarrierStoneQuickDialog.close("mode-changed");
    return;
  }
  const stoneId = state.gridBarrierStoneQuickStoneId;
  const stone = stoneId ? state.traverseLog?.stones?.[stoneId] : null;
  if (!stone || stoneDisplayCount(stone) <= 0) {
    elements.gridBarrierStoneQuickDialog.close("selection-changed");
    return;
  }

  const barrierId = barrierIdForStone(state.traverseLog, stoneId);
  const barrier = barrierId ? state.traverseLog?.barriers?.[barrierId] : null;
  const count = stoneDisplayCount(stone);
  const barrierLabel = barrier
    ? ` · ${t("traverse.vertex")}${barrier.name ? `「${barrier.name}」` : ""}`
    : "";
  const stoneCap = stoneCapFor(state.traverseLog, stoneId, currentKekkaishiRankInfo().rank.index);
  const stockAmount = Math.max(0, Math.floor(Number(state.traverseLog?.stock?.amount) || 0));
  elements.gridBarrierStoneQuickName.textContent = stone.name || t("traverse.stoneTile");
  const memo = stone.note ? ` · ${t("action.memo")}` : "";
  elements.gridBarrierStoneQuickInfo.textContent = `${t("traverse.stoneCount").replace("{count}", String(count))} · ${stone.tile}${barrierLabel}${memo}`;
  elements.gridBarrierStoneQuickPlaceLabel.textContent = t("traverse.place");
  elements.gridBarrierStoneQuickPickLabel.textContent = t("traverse.pick");
  elements.gridBarrierStoneQuickEditLabel.textContent = t("action.rename");
  elements.gridBarrierStoneQuickMemoLabel.textContent = t("action.memo");
  elements.gridBarrierStoneQuickMapLabel.textContent = t("action.map");

  const unlimitedStock = kekkaiTesterModeActive();
  const testerMultipleSelection = unlimitedStock && testerPlacementHasMultipleSelection();
  elements.gridBarrierStoneQuickPlaceButton.disabled = testerMultipleSelection
    || (!unlimitedStock && stockAmount < 1)
    || count >= stoneCap;
  elements.gridBarrierStoneQuickPlaceButton.setAttribute("aria-label", t("traverse.place"));
  elements.gridBarrierStoneQuickPlaceButton.title = testerMultipleSelection
    ? "配置先は1つだけ選択してください"
    : t("traverse.place");
  elements.gridBarrierStoneQuickPickButton.disabled = count < 1 || (!unlimitedStock && stockAmount >= stockCapForRank(currentKekkaishiRankInfo().rank.index));
  elements.gridBarrierStoneQuickPickButton.setAttribute("aria-label", t("traverse.pick"));
  elements.gridBarrierStoneQuickPickButton.title = t("traverse.pick");
  elements.gridBarrierStoneQuickEditButton.disabled = false;
  elements.gridBarrierStoneQuickEditButton.setAttribute("aria-label", t("action.rename"));
  elements.gridBarrierStoneQuickEditButton.title = t("action.rename");
  elements.gridBarrierStoneQuickMemoButton.disabled = false;
  elements.gridBarrierStoneQuickMemoButton.setAttribute("aria-label", t("action.memo"));
  elements.gridBarrierStoneQuickMemoButton.title = t("action.memo");
  elements.gridBarrierStoneQuickMapButton.setAttribute("aria-label", t("action.map"));
  elements.gridBarrierStoneQuickMapButton.title = t("action.map");
  for (const button of pointQuickButtons()) button.hidden = true;
  for (const button of barrierStoneQuickButtons()) button.hidden = false;
}

function renderGridLinkQuickDialog() {
  if (!elements.gridLinkQuickDialog?.open) return;
  const link = state.gridLinkQuickLinkId ? findLink(state.gridLinkQuickLinkId) : null;
  const endpoints = link ? linkEndpoints(link) : null;
  if (!link || !endpoints) {
    elements.gridLinkQuickDialog.close("selection-changed");
    return;
  }

  elements.gridLinkQuickName.textContent = linkTitle(link);
  elements.gridLinkQuickDistance.textContent = `${t("field.distance")}: ${formatDistance(distanceBetween(endpoints.a, endpoints.b))}`;
  elements.gridLinkQuickEndpoints.textContent = `${endpoints.a.title} / ${endpoints.b.title}`;
  const color = normalizeGridAtlasLineColor(link.color) || canvasPalette().link;
  elements.gridLinkQuickColorLabel.textContent = t("line.color");
  elements.gridLinkQuickColorButton.setAttribute("aria-label", t("line.color"));
  elements.gridLinkQuickColorButton.title = t("line.color");
  elements.gridLinkQuickColorMark.style.backgroundColor = color;
  elements.gridLinkQuickDeleteLabel.textContent = t("action.delete");
  elements.gridLinkQuickDeleteButton.setAttribute("aria-label", t("action.delete"));
  elements.gridLinkQuickDeleteButton.title = t("action.delete");
}

function renderGridFigureQuickDialog() {
  if (!elements.gridFigureQuickDialog?.open) return;
  const figure = state.gridFigureQuickFigureId ? findFigure(state.gridFigureQuickFigureId) : null;
  const barrier = state.gridFigureQuickBarrierId
    ? state.traverseLog?.barriers?.[state.gridFigureQuickBarrierId]
    : null;
  if (!figure && !barrier) {
    elements.gridFigureQuickDialog.close("selection-changed");
    return;
  }

  if (barrier) {
    const score = scoreBarrier(state.traverseLog, state.gridFigureQuickBarrierId);
    const title = barrier.name || t("barrier.defaultName");
    const power = score ? ` · ${t("barrier.rankPower")} ${formatScoreValue(score.power)}` : "";
    elements.gridFigureQuickName.textContent = title;
    const memo = barrier.note ? ` · ${t("action.memo")}` : "";
    elements.gridFigureQuickInfo.textContent = `${t("figure.vertexCount").replace("{count}", String(barrierFigureVertices(barrier).length))}${power}${memo}`;
    elements.gridFigureQuickMemoLabel.textContent = t("action.memo");
    elements.gridFigureQuickMemoButton.setAttribute("aria-label", t("action.memo"));
    elements.gridFigureQuickMemoButton.title = t("action.memo");
    elements.gridFigureQuickDeleteVertexButton.hidden = true;
    elements.gridFigureQuickDeleteVertexButton.disabled = true;
    elements.gridFigureQuickDeleteLabel.textContent = t("barrier.dissolve");
    elements.gridFigureQuickDeleteButton.setAttribute("aria-label", t("barrier.dissolve"));
    elements.gridFigureQuickDeleteButton.title = t("barrier.dissolve");
    elements.gridFigureQuickDeleteIcon?.setAttribute("href", "#icon-clear");
    return;
  }

  const vertexIndex = state.gridFigureQuickVertexIndex;
  const hasDeletableVertex = Number.isInteger(vertexIndex)
    && vertexIndex >= 0
    && vertexIndex < figure.vertices.length
    && figure.vertices.length > 2;
  const title = figure.name || `${t("analysis.figure")} ${figure.vertices.length}`;
  elements.gridFigureQuickName.textContent = title;
  const memoTarget = Number.isInteger(vertexIndex) ? figure.vertices[vertexIndex] : figure;
  const memo = memoTarget?.note ? ` · ${t("action.memo")}` : "";
  elements.gridFigureQuickInfo.textContent = `${t("figure.vertexCount").replace("{count}", String(figure.vertices.length))}${memo}`;
  elements.gridFigureQuickMemoLabel.textContent = t("action.memo");
  elements.gridFigureQuickMemoButton.setAttribute("aria-label", t("action.memo"));
  elements.gridFigureQuickMemoButton.title = t("action.memo");
  elements.gridFigureQuickDeleteVertexButton.hidden = !hasDeletableVertex;
  elements.gridFigureQuickDeleteVertexButton.disabled = !hasDeletableVertex;
  elements.gridFigureQuickDeleteVertexLabel.textContent = t("figure.deleteVertex");
  elements.gridFigureQuickDeleteVertexButton.setAttribute("aria-label", t("figure.deleteVertex"));
  elements.gridFigureQuickDeleteVertexButton.title = t("figure.deleteVertex");
  elements.gridFigureQuickDeleteLabel.textContent = t("figure.delete");
  elements.gridFigureQuickDeleteButton.setAttribute("aria-label", t("figure.delete"));
  elements.gridFigureQuickDeleteButton.title = t("figure.delete");
  elements.gridFigureQuickDeleteIcon?.setAttribute("href", "#icon-trash");
}

function renderGridLinkColorDialog() {
  if (!elements.gridLinkColorDialog?.open) return;
  const link = state.gridLinkColorLinkId ? findLink(state.gridLinkColorLinkId) : null;
  if (!link) {
    elements.gridLinkColorDialog.close("selection-changed");
    return;
  }

  const group = linksInStroke(link);
  const hasShape = group.length > 1 && Boolean(linkStrokeId(link));
  const color = normalizeGridAtlasLineColor(link.color) || canvasPalette().link;
  const shapeInput = elements.gridLinkColorShapeOption.querySelector("input");
  const selectedColor = LINE_COLOR_OPTIONS.some((option) => option.value === color)
    ? color
    : LINE_COLOR_OPTIONS[4].value;

  elements.gridLinkColorDialogTitle.textContent = t("line.colorTitle");
  elements.gridLinkColorDialogMessage.textContent = t("line.colorMessage");
  elements.gridLinkColorPalette.setAttribute("aria-label", t("line.color"));
  elements.gridLinkColorPalette.querySelectorAll("input").forEach((input, index) => {
    const option = LINE_COLOR_OPTIONS[index];
    const label = activeLanguage() === EN_LANGUAGE ? option.en : option.ja;
    input.checked = input.value === selectedColor;
    input.setAttribute("aria-label", label);
    input.closest(".grid-link-color-option")?.setAttribute("title", label);
  });
  elements.gridLinkColorSegmentLabel.textContent = t("line.colorSegment");
  elements.gridLinkColorShapeOption.hidden = !hasShape;
  shapeInput.disabled = !hasShape;
  elements.gridLinkColorShapeLabel.textContent = hasShape
    ? t("line.colorShape").replace("{count}", String(group.length))
    : t("line.colorNoShape");
  if (!hasShape) elements.gridLinkColorSegmentOption.checked = true;
  elements.gridLinkColorCancelButton.textContent = t("action.cancel");
  elements.gridLinkColorApplyButton.textContent = t("action.apply");
}

function selectionAnalysisTarget() {
  const figures = selectedFigureIds().map(findFigure).filter(Boolean);
  const links = selectedLinkIds().map(findLink).filter(Boolean);

  if (figures.length === 1 && links.length === 0 && selectedPointIds().length === 0 && selectedObservationIds().length === 0) {
    const figure = figures[0];
    const segments = figureSegments(figure);
    if (segments.length >= 3) {
      return { type: "polygon", figure, links: segments, segments };
    }
    return null;
  }
  if (figures.length > 0) return null;

  if (links.length === 1) {
    const segments = links.map((link) => linkEndpoints(link)).filter(Boolean);
    return segments.length === 1 ? { type: "single", links, segments } : null;
  }
  if (links.length < 2) return null;
  const segments = links.map((link) => linkEndpoints(link)).filter(Boolean);
  if (segments.length !== links.length) return null;
  const path = analyzeOpenPath(segments);
  if (path.valid) return { type: "path", links, segments };
  if (links.length === 2) return { type: "line", links, segments };
  if (links.length >= 3) return { type: "polygon", links, segments };

  return null;
}

function openSelectionAnalysis() {
  const target = selectionAnalysisTarget();
  if (!target || !elements.analysisDialog?.showModal) return;
  if (!elements.analysisDialog.open) elements.analysisDialog.showModal();
  renderSelectionAnalysisDialog(target);
  window.setTimeout(() => elements.analysisDialogTitle?.focus(), 0);
}

function renderSelectionAnalysisDialog(target = selectionAnalysisTarget()) {
  if (!elements.analysisDialog?.open) return;
  if (!target) {
    elements.analysisDialog.close("selection-changed");
    return;
  }

  elements.analysisDialogTitle.textContent = t("analysis.dialogTitle");
  elements.analysisDialogContent.replaceChildren();
  if (target.type === "single") {
    renderSingleSegmentAnalysisDialog(target);
  } else if (target.type === "line") {
    renderLineAnalysisDialog(target);
  } else if (target.type === "path") {
    renderPathAnalysisDialog(target);
  } else {
    renderPolygonAnalysisDialog(target);
  }
  elements.analysisDialogCopyButton.disabled = !target;
  elements.analysisDialogCopyButton.textContent = t("analysis.copy");
  setAnalysisCopyStatus("");
}

function renderSingleSegmentAnalysisDialog(target) {
  appendAnalysisText(elements.analysisDialogContent, "p", "analysis-dialog-hint", t("analysis.twoPointStraight"));
  renderAnalysisSegmentList(target.links);
}

function renderLineAnalysisDialog(target) {
  const result = analyzeLineIntersection(target.segments[0], target.segments[1]);
  appendAnalysisText(elements.analysisDialogContent, "p", "analysis-dialog-hint", t("analysis.lineHint"));

  if (!result.intersects) {
    const status = document.createElement("div");
    status.className = "analysis-empty-result";
    status.textContent = result.reason === "parallel"
      ? t("analysis.parallel")
      : result.reason === "collinear"
        ? t("analysis.collinear")
        : t("analysis.extension");
    elements.analysisDialogContent.append(status);
    if (Number.isFinite(result.angle) && result.reason === "extension") {
      appendAnalysisMetric(elements.analysisDialogContent, t("analysis.angle"), formatAngle(result.angle));
    }
    renderAnalysisSegmentList(target.links);
    return;
  }

  const hero = document.createElement("div");
  hero.className = "analysis-hero";
  appendAnalysisText(hero, "strong", "analysis-hero-value", formatAngle(result.angle));
  appendAnalysisText(hero, "span", "analysis-hero-label", t("analysis.angle"));
  elements.analysisDialogContent.append(hero);

  const geo = result.point ? unprojectWorld(result.point.x, result.point.y) : null;
  if (geo) appendAnalysisMetric(elements.analysisDialogContent, t("analysis.intersection"), `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}`);
  renderAnalysisSegmentList(target.links);
}

function renderPathAnalysisDialog(target) {
  const result = analyzeOpenPath(target.segments);
  appendAnalysisText(elements.analysisDialogContent, "p", "analysis-dialog-hint", t("analysis.pathHint"));
  if (!result.valid) {
    appendAnalysisText(elements.analysisDialogContent, "div", "analysis-empty-result", t("analysis.pathUnavailable"));
    renderAnalysisSegmentList(target.links);
    return;
  }

  appendAnalysisText(
    elements.analysisDialogContent,
    "div",
    "analysis-measurement-basis",
    t("analysis.pathDeclaration")
      .replace("{vertices}", String(result.vertexCount))
      .replace("{edges}", String(result.edgeCount))
  );
  appendAnalysisText(
    elements.analysisDialogContent,
    "div",
    "analysis-measurement-basis",
    t("analysis.pathBasis").replace("{vertices}", String(result.vertexCount))
  );
  appendAnalysisText(elements.analysisDialogContent, "div", "analysis-measurement-basis", t("analysis.pathNotScreen"));

  if (result.edgeCount === 2) {
    const intersection = analyzeLineIntersection(target.segments[0], target.segments[1]);
    if (Number.isFinite(intersection.angle)) {
      const angle = document.createElement("div");
      angle.className = "analysis-hero";
      appendAnalysisText(angle, "strong", "analysis-hero-value", formatAngle(intersection.angle));
      appendAnalysisText(angle, "span", "analysis-hero-label", t("analysis.angle"));
      elements.analysisDialogContent.append(angle);
    }
  }

  appendAnalysisText(elements.analysisDialogContent, "h3", "analysis-section-title", t("analysis.shapeFeaturesTitle"));
  const metrics = document.createElement("div");
  metrics.className = "analysis-metric-grid";
  appendAnalysisMetric(metrics, t("analysis.pathDeviation"), `${formatPercent(result.perpendicularPercent)} · ${t("analysis.averageDeviation")} ${formatDistance(result.perpendicularRmsMeters)} / ${t("analysis.maximumDeviation")} ${formatDistance(result.perpendicularMaxMeters)}`);
  appendAnalysisMetric(metrics, t("analysis.spacingVariation"), `${formatPercent(result.spacingPercent)} · ${t("analysis.averageDeviation")} ${formatDistance(result.spacingRmsMeters)}`);
  elements.analysisDialogContent.append(metrics);

  const reference = document.createElement("div");
  reference.className = "analysis-reference-note";
  appendAnalysisText(reference, "span", "", t("analysis.referenceScore"));
  appendAnalysisText(reference, "strong", "", `${result.referenceScore.toFixed(1)} / 100`);
  elements.analysisDialogContent.append(reference);

  appendAnalysisText(elements.analysisDialogContent, "h4", "analysis-subsection-title", t("analysis.generalTitle"));
  const general = document.createElement("div");
  general.className = "analysis-metric-grid analysis-general-metrics";
  appendAnalysisMetric(general, t("analysis.endpointDistance"), formatDistance(result.endpointDistanceMeters));
  appendAnalysisMetric(general, t("analysis.pathLengthRatio"), formatPercent(result.pathLengthRatioPercent));
  appendAnalysisMetric(general, t("analysis.bearing"), formatAngle(result.bearingDegrees));
  appendAnalysisMetric(general, t("analysis.farthestPoint"), `${result.farthestPoint.title} · ${formatDistance(result.perpendicularMaxMeters)}`);
  elements.analysisDialogContent.append(general);
  if (result.folded) appendAnalysisText(elements.analysisDialogContent, "p", "analysis-dialog-hint", t("analysis.foldedPath"));

  appendAnalysisText(elements.analysisDialogContent, "div", "analysis-measurement-basis", `${t("analysis.screenLineBasis")} ${formatPercent(result.mercator.deviationPercent)}`);
  renderAnalysisSegmentList(target.links);
}

function renderAnalysisSegmentList(links) {
  const list = document.createElement("div");
  list.className = "analysis-segment-list";
  for (const [index, link] of links.entries()) {
    const endpoints = linkEndpoints(link);
    const label = endpoints ? `${endpoints.a.title} / ${endpoints.b.title}` : linkTitle(link);
    appendAnalysisText(list, "span", "analysis-segment-label", `${t("analysis.segment")} ${index + 1}`);
    appendAnalysisText(list, "strong", "analysis-segment-name", label);
  }
  elements.analysisDialogContent.append(list);
}

async function copySelectionAnalysis() {
  const target = selectionAnalysisTarget();
  if (!target) return;
  const text = selectionAnalysisText(target);
  const copied = await writeClipboardText(text);
  if (copied) {
    setAnalysisCopyStatus(t("analysis.copied"));
    return;
  }
  setAnalysisCopyStatus(t("analysis.copyFailed"), { error: true });
}

function setAnalysisCopyStatus(message, { error = false } = {}) {
  const status = elements.analysisDialogCopyStatus;
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle("is-error", error && Boolean(message));
}

function selectionAnalysisText(target) {
  if (target.type === "single") {
    return [
      `GRID ATLAS — ${t("analysis.dialogTitle")}`,
      t("analysis.twoPointStraight"),
      `${t("analysis.segment")}: ${linkTitle(target.links[0])}`
    ].join("\n");
  }
  if (target.type === "line") {
    const result = analyzeLineIntersection(target.segments[0], target.segments[1]);
    const names = target.links.map((link) => linkTitle(link));
    return [
      `GRID ATLAS — ${t("analysis.lineTitle")}`,
      `${t("analysis.segment")} 1: ${names[0]}`,
      `${t("analysis.segment")} 2: ${names[1]}`,
      result.intersects ? `${t("analysis.angle")}: ${formatAngle(result.angle)}` : t("analysis.notCrossing")
    ].join("\n");
  }

  if (target.type === "path") {
    const result = analyzeOpenPath(target.segments);
    if (!result.valid) return [t("analysis.pathTitle"), t("analysis.pathUnavailable")].join("\n");
    const intersection = result.edgeCount === 2 ? analyzeLineIntersection(target.segments[0], target.segments[1]) : null;
    return [
      `GRID ATLAS — ${t("analysis.pathTitle")}`,
      t("analysis.pathDeclaration").replace("{vertices}", String(result.vertexCount)).replace("{edges}", String(result.edgeCount)),
      t("analysis.pathBasis").replace("{vertices}", String(result.vertexCount)),
      t("analysis.pathNotScreen"),
      Number.isFinite(intersection?.angle) ? `${t("analysis.angle")}: ${formatAngle(intersection.angle)}` : "",
      `${t("analysis.pathDeviation")}: ${formatPercent(result.perpendicularPercent)} / ${t("analysis.averageDeviation")} ${formatDistance(result.perpendicularRmsMeters)} / ${t("analysis.maximumDeviation")} ${formatDistance(result.perpendicularMaxMeters)}`,
      `${t("analysis.spacingVariation")}: ${formatPercent(result.spacingPercent)} / ${t("analysis.averageDeviation")} ${formatDistance(result.spacingRmsMeters)}`,
      `${t("analysis.referenceScore")}: ${result.referenceScore.toFixed(1)} / 100`,
      `${t("analysis.endpointDistance")}: ${formatDistance(result.endpointDistanceMeters)}`,
      `${t("analysis.pathLengthRatio")}: ${formatPercent(result.pathLengthRatioPercent)}`,
      `${t("analysis.bearing")}: ${formatAngle(result.bearingDegrees)}`,
      `${t("analysis.farthestPoint")}: ${result.farthestPoint.title} / ${formatDistance(result.perpendicularMaxMeters)}`,
      result.folded ? t("analysis.foldedPath") : "",
      `${t("analysis.screenLineBasis")}: ${formatPercent(result.mercator.deviationPercent)}`
    ].filter(Boolean).join("\n");
  }

  const result = analyzeSegmentShape(target.segments);
  if (!result.valid) {
    return [t("analysis.polygonTitle"), t("analysis.shapeOpen"), t("analysis.shapeOpenHint")].join("\n");
  }

  const shape = polygonName(result.n, result.k, result.selfIntersections);
  const referenceShape = idealPolygonName(result.n, result.k);
  const selfIntersection = result.selfIntersections > 0 ? t("analysis.selfIntersectionYes") : t("analysis.selfIntersectionNo");
  return [
    `GRID ATLAS — ${t("analysis.polygonTitle")}`,
    t("analysis.measurementDeclaration").replace("{shape}", shape),
    `${t("analysis.generalTitle")}`,
    `${t("analysis.figure")}: ${shape}`,
    `${t("analysis.selfIntersectionLabel")}: ${selfIntersection}`,
    `${t("analysis.perimeter")}: ${formatDistance(result.perimeter)}`,
    `${t("analysis.area")}: ${formatArea(result.area)}`,
    `${t("analysis.vertexCount")}: ${result.vertexCount}`,
    `${t("analysis.edgeCount")}: ${result.edgeCount}`,
    `${t("analysis.meanSide")}: ${formatDistance(result.meanSide)}`,
    `${t("analysis.longestSide")}: ${formatDistance(result.longestSide)}`,
    `${t("analysis.shortestSide")}: ${formatDistance(result.shortestSide)}`,
    `${t("analysis.shapeFeaturesTitle")} · ${t("analysis.resultTitle")}`,
    `${t("analysis.sideVariation")}: ${formatPercent(result.sideRangePercent)}`,
    `${t("analysis.maxAngleDeviation")}: ${formatAngle(result.maxAngleDeviation)} (${formatPercent(result.maxAngleDeviationPercent)})`,
    `${t("analysis.angleDeviationRate")}: ${formatPercent(result.maxAngleDeviationPercent)}`,
    `${t("analysis.referenceScore")}: ${Math.round(result.referenceScore)} / 100`,
    `${t("analysis.comparisonTitle")}`,
    t("analysis.measurementBasis")
      .replace("{shape}", referenceShape)
      .replace("{angle}", formatAngle(result.idealAngle))
      .replace("{ratio}", result.idealDiagonalToSide.toFixed(4)),
    "",
    ...result.points.map((point, index) => `${point.title || `${t("analysis.vertex")} ${index + 1}`}: ${formatAngle(result.angles[index])} / ${formatDistance(result.sideLengths[index])}`)
  ].join("\n");
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function renderPolygonAnalysisDialog(target) {
  const result = analyzeSegmentShape(target.segments);
  appendAnalysisText(elements.analysisDialogContent, "p", "analysis-dialog-hint", t("analysis.polygonHint"));
  if (!result.valid) {
    appendAnalysisText(elements.analysisDialogContent, "div", "analysis-empty-result", t("analysis.shapeOpen"));
    appendAnalysisText(elements.analysisDialogContent, "p", "analysis-dialog-hint", t("analysis.shapeOpenHint"));
    renderAnalysisSegmentList(target.links);
    return;
  }

  const shape = polygonName(result.n, result.k, result.selfIntersections);
  const referenceShape = idealPolygonName(result.n, result.k);
  const selfIntersection = result.selfIntersections > 0 ? t("analysis.selfIntersectionYes") : t("analysis.selfIntersectionNo");
  appendAnalysisText(elements.analysisDialogContent, "h3", "analysis-section-title", t("analysis.generalTitle"));
  const generalMetrics = document.createElement("div");
  generalMetrics.className = "analysis-metric-grid analysis-general-metrics";
  appendAnalysisMetric(generalMetrics, t("analysis.figure"), shape);
  appendAnalysisMetric(generalMetrics, t("analysis.selfIntersectionLabel"), selfIntersection);
  appendAnalysisMetric(generalMetrics, t("analysis.perimeter"), formatDistance(result.perimeter));
  appendAnalysisMetric(generalMetrics, t("analysis.area"), formatArea(result.area));
  appendAnalysisMetric(generalMetrics, t("analysis.vertexCount"), String(result.vertexCount));
  appendAnalysisMetric(generalMetrics, t("analysis.edgeCount"), String(result.edgeCount));
  appendAnalysisMetric(generalMetrics, t("analysis.meanSide"), formatDistance(result.meanSide));
  appendAnalysisMetric(generalMetrics, t("analysis.longestSide"), formatDistance(result.longestSide));
  appendAnalysisMetric(generalMetrics, t("analysis.shortestSide"), formatDistance(result.shortestSide));
  elements.analysisDialogContent.append(generalMetrics);
  if (!Number.isFinite(result.area)) {
    appendAnalysisText(elements.analysisDialogContent, "p", "analysis-dialog-hint", t("analysis.areaUnavailable"));
  }

  appendAnalysisText(elements.analysisDialogContent, "h3", "analysis-section-title", t("analysis.shapeFeaturesTitle"));
  appendAnalysisText(elements.analysisDialogContent, "h4", "analysis-subsection-title", t("analysis.resultTitle"));

  const metrics = document.createElement("div");
  metrics.className = "analysis-metric-grid";
  appendAnalysisMetric(metrics, t("analysis.sideVariation"), formatPercent(result.sideRangePercent));
  appendAnalysisMetric(metrics, t("analysis.maxAngleDeviation"), formatAngle(result.maxAngleDeviation));
  appendAnalysisMetric(metrics, t("analysis.angleDeviationRate"), formatPercent(result.maxAngleDeviationPercent));
  elements.analysisDialogContent.append(metrics);

  const reference = document.createElement("div");
  reference.className = "analysis-reference-note";
  appendAnalysisText(reference, "span", "", t("analysis.referenceScore"));
  appendAnalysisText(reference, "strong", "", `${Math.round(result.referenceScore)} / 100`);
  elements.analysisDialogContent.append(reference);

  appendAnalysisText(elements.analysisDialogContent, "h4", "analysis-subsection-title", t("analysis.comparisonTitle"));
  appendAnalysisText(
    elements.analysisDialogContent,
    "div",
    "analysis-measurement-basis",
    t("analysis.measurementBasis")
      .replace("{shape}", referenceShape)
      .replace("{angle}", formatAngle(result.idealAngle))
      .replace("{ratio}", result.idealDiagonalToSide.toFixed(4))
  );

  const table = document.createElement("div");
  table.className = "analysis-vertex-table";
  const header = document.createElement("div");
  header.className = "analysis-vertex-row analysis-vertex-header";
  appendAnalysisText(header, "span", "", t("analysis.vertex"));
  appendAnalysisText(header, "span", "", t("analysis.angle"));
  appendAnalysisText(header, "span", "", t("analysis.sides"));
  table.append(header);
  result.points.forEach((point, index) => {
    const row = document.createElement("div");
    row.className = "analysis-vertex-row";
    appendAnalysisText(row, "span", "analysis-vertex-name", point.title || `${t("analysis.vertex")} ${index + 1}`);
    appendAnalysisText(row, "span", "", formatAngle(result.angles[index]));
    appendAnalysisText(row, "span", "", formatDistance(result.sideLengths[index]));
    table.append(row);
  });
  elements.analysisDialogContent.append(table);
}

function appendAnalysisMetric(container, label, value) {
  const metric = document.createElement("div");
  metric.className = "analysis-metric";
  appendAnalysisText(metric, "span", "", label);
  appendAnalysisText(metric, "strong", "", value);
  container.append(metric);
}

function appendAnalysisText(container, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  container.append(element);
  return element;
}

function formatAngle(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}°` : "-";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : "-";
}

function barrierStoneFromQuickDialog() {
  const stoneId = state.gridBarrierStoneQuickStoneId;
  return stoneId && state.traverseLog?.stones?.[stoneId]
    ? { stoneId, stone: state.traverseLog.stones[stoneId] }
    : null;
}

function startBarrierStoneQuickAction(action) {
  const target = barrierStoneFromQuickDialog();
  const targetTileId = target?.stone?.tile;
  if (!targetTileId) return;
  if (action === "place" && kekkaiTesterModeActive() && testerPlacementHasMultipleSelection()) return;
  if (elements.gridBarrierStoneQuickDialog?.open) elements.gridBarrierStoneQuickDialog.close(action);
  const temporaryGeo = action === "place" && kekkaiTesterModeActive()
    ? tileCenterGeo(targetTileId)
    : null;
  openTraverseQuantityDialog(action, { targetTileId, temporaryGeo });
}

async function renameBarrierStoneFromQuickDialog() {
  const target = barrierStoneFromQuickDialog();
  if (!target) return;
  const input = await requestTextInput({
    title: t("action.rename"),
    message: target.stone.tile,
    label: t("action.rename"),
    defaultValue: target.stone.name || "",
    maxLength: 80,
    submitLabel: t("action.apply")
  });
  if (input === null) return;
  const name = input.trim().slice(0, 80);
  target.stone.name = name;
  appendBarrierEvent(state.traverseLog, {
    type: "stone-renamed",
    at: new Date().toISOString(),
    tile: target.stone.tile,
    stoneId: target.stoneId,
    name
  });
  persistTraverseLog();
  if (elements.gridBarrierStoneQuickDialog?.open) elements.gridBarrierStoneQuickDialog.close("rename");
  render();
}

async function editBarrierStoneMemoFromQuickDialog() {
  const target = barrierStoneFromQuickDialog();
  if (!target) return;
  const input = await requestTextInput({
    title: t("action.memo"),
    message: target.stone.tile,
    label: t("action.memo"),
    defaultValue: target.stone.note || "",
    maxLength: 500,
    multiline: true,
    submitLabel: t("action.apply")
  });
  if (input === null) return;
  const note = input.trim().slice(0, 500);
  target.stone.note = note;
  appendBarrierEvent(state.traverseLog, {
    type: "stone-memo-updated",
    at: new Date().toISOString(),
    tile: target.stone.tile,
    stoneId: target.stoneId,
    note
  });
  syncBarrierFiguresFromLog();
  persistTraverseLog();
  if (elements.gridBarrierStoneQuickDialog?.open) elements.gridBarrierStoneQuickDialog.close("memo");
  render();
}

async function editFigureMemoFromQuickDialog() {
  const figure = state.gridFigureQuickFigureId ? findFigure(state.gridFigureQuickFigureId) : null;
  const barrierId = state.gridFigureQuickBarrierId || figure?.barrierId || null;
  const barrier = barrierId ? state.traverseLog?.barriers?.[barrierId] : null;
  const vertexIndex = state.gridFigureQuickVertexIndex;
  const vertex = figure && Number.isInteger(vertexIndex) ? figure.vertices[vertexIndex] : null;
  const currentNote = barrier && !vertex
    ? barrier.note || ""
    : vertex?.note || figure?.note || "";
  if (!figure && !barrier) return;

  const input = await requestTextInput({
    title: t("action.memo"),
    message: Number.isInteger(vertexIndex) ? "頂点" : "結界図形",
    label: t("action.memo"),
    defaultValue: currentNote,
    maxLength: 500,
    multiline: true,
    submitLabel: t("action.apply")
  });
  if (input === null) return;
  const note = input.trim().slice(0, 500);

  if (barrierId && barrier) {
    if (Number.isInteger(vertexIndex)) {
      const stoneId = barrierStoneIds(barrier)[vertexIndex];
      const stone = stoneId ? state.traverseLog?.stones?.[stoneId] : null;
      if (stone) {
        stone.note = note;
        appendBarrierEvent(state.traverseLog, {
          type: "stone-memo-updated",
          at: new Date().toISOString(),
          tile: stone.tile,
          stoneId,
          note
        });
      }
    } else {
      barrier.note = note;
      appendBarrierEvent(state.traverseLog, {
        type: "barrier-memo-updated",
        at: new Date().toISOString(),
        barrierId,
        note
      });
    }
    syncBarrierFiguresFromLog();
    persistTraverseLog();
  } else if (figure) {
    const nextFigure = normalizeAnalysisFigure({
      ...figure,
      ...(Number.isInteger(vertexIndex)
        ? { vertices: figure.vertices.map((candidate, index) => index === vertexIndex ? { ...candidate, note } : candidate) }
        : { note })
    });
    state.figures = state.figures.map((candidate) => candidate.id === figure.id ? nextFigure : candidate);
    persistWorkspace();
  }

  if (elements.gridFigureQuickDialog?.open) elements.gridFigureQuickDialog.close("memo");
  render();
}

function openBarrierStoneInPreferredMapFromQuickDialog() {
  const target = barrierStoneFromQuickDialog();
  const geo = target ? tileCenterGeo(target.stone.tile) : null;
  if (!geo) return;
  if (elements.gridBarrierStoneQuickDialog?.open) elements.gridBarrierStoneQuickDialog.close("map");
  openPointInExternalMap({
    title: t("traverse.stoneTile"),
    geo
  }, preferredMapProvider());
}

function formatArea(area) {
  if (!Number.isFinite(area) || area < 0) return "-";
  if (state.distanceUnit === IMPERIAL_UNIT) {
    const squareMiles = area / 2589988.110336;
    return squareMiles < 0.01
      ? `${Math.round(area * 10.7639104167).toLocaleString(localeName())} sq ft`
      : `${squareMiles.toFixed(2)} sq mi`;
  }
  if (area < 1000000) return `${Math.round(area).toLocaleString(localeName())} m²`;
  return `${(area / 1000000).toFixed(2)} km²`;
}

function polygonName(count, turn = 1, selfIntersections = 0) {
  const countLabel = activeLanguage() === EN_LANGUAGE ? String(count) : japanesePolygonCount(count);
  if (selfIntersections > 0 && turn === 1) {
    return activeLanguage() === EN_LANGUAGE ? t("analysis.selfCrossingPolygon").replace("{n}", countLabel) : `自己交差する${countLabel}角形`;
  }
  if (turn === 1) {
    return activeLanguage() === EN_LANGUAGE ? `${countLabel}-gon` : `${countLabel}角形`;
  }
  return activeLanguage() === EN_LANGUAGE ? `${countLabel}-point star` : `${countLabel}芒星`;
}

function idealPolygonName(count, turn = 1) {
  if (turn === 1) {
    if (count === 3) return t("analysis.regularTriangle");
    if (count === 4) return t("analysis.square");
    if (count === 5) return t("analysis.regularPentagon");
    return t("analysis.regularPolygon").replace("{n}", String(count));
  }
  return t("analysis.starPolygon").replace("{n}", String(count));
}

function japanesePolygonCount(count) {
  return {
    3: "三",
    4: "四",
    5: "五",
    6: "六",
    7: "七",
    8: "八",
    9: "九",
    10: "十"
  }[count] || String(count);
}

function applyGridLinkColorFromDialog() {
  const link = state.gridLinkColorLinkId ? findLink(state.gridLinkColorLinkId) : null;
  const color = normalizeGridAtlasLineColor(
    elements.gridLinkColorPalette.querySelector("input:checked")?.value
  );
  if (!link || !color) return;

  const shapeInput = elements.gridLinkColorShapeOption.querySelector("input");
  const targetIds = new Set(
    shapeInput?.checked ? linksInStroke(link).map((candidate) => candidate.id) : [link.id]
  );
  const updatedAt = new Date().toISOString();
  state.links = state.links.map((candidate) => targetIds.has(candidate.id)
    ? normalizeStoredLink({ ...candidate, color, updatedAt })
    : candidate
  );
  persistWorkspace();
  render();
  showAppToast(t("line.colorApplied"));
}

async function deleteGridLinkFromQuickDialog() {
  const linkId = state.gridLinkQuickLinkId;
  const link = linkId ? findLink(linkId) : null;
  if (!link) {
    if (elements.gridLinkQuickDialog?.open) elements.gridLinkQuickDialog.close("selection-changed");
    return;
  }

  const confirmed = await requestConfirm({
    title: t("action.delete"),
    message: t("line.deleteConfirm"),
    confirmLabel: t("action.delete"),
    danger: true
  });
  if (!confirmed || !findLink(linkId)) return;

  state.links = state.links.filter((candidate) => candidate.id !== linkId);
  splitDisconnectedStrokeGroups();
  removeSelectionEntry("link", linkId);
  if (state.selectedLinkId === linkId) state.selectedLinkId = null;
  persistWorkspace();
  if (elements.gridLinkQuickDialog?.open) elements.gridLinkQuickDialog.close("deleted");
  render();
  showAppToast(t("line.deleted"));
}

async function deleteFigureVertexFromQuickDialog() {
  const figureId = state.gridFigureQuickFigureId;
  const vertexIndex = state.gridFigureQuickVertexIndex;
  const figure = figureId ? findFigure(figureId) : null;
  if (!figure || !Number.isInteger(vertexIndex) || figure.vertices.length <= 2) return;

  const confirmed = await requestConfirm({
    title: t("figure.deleteVertex"),
    message: t("figure.deleteVertexConfirm"),
    confirmLabel: t("action.delete"),
    danger: true
  });
  if (!confirmed || !findFigure(figureId)) return;

  const result = removeAnalysisFigureVertex(figure, vertexIndex);
  if (!result.figure && !result.line) {
    state.figures = state.figures.filter((candidate) => candidate.id !== figureId);
    removeSelectionEntry("figure", figureId);
  } else {
    state.figures = state.figures.map((candidate) => candidate.id === figureId ? result.figure : candidate);
    setSelection([{ type: "figure", id: figureId }], { render: false });
  }
  persistWorkspace();
  if (elements.gridFigureQuickDialog?.open) elements.gridFigureQuickDialog.close("vertex-deleted");
  render();
  showAppToast(t("figure.vertexDeleted"));
}

async function deleteFigureFromQuickDialog() {
  const barrierId = state.gridFigureQuickBarrierId;
  if (barrierId) {
    const barrier = state.traverseLog?.barriers?.[barrierId];
    if (!barrier) return;

    const confirmed = await requestConfirm({
      title: t("barrier.dissolve"),
      message: t("barrier.dissolveConfirm"),
      confirmLabel: t("barrier.dissolve"),
      danger: true
    });
    if (!confirmed || !state.traverseLog?.barriers?.[barrierId]) return;

    const dissolveAt = Date.now();
    const evaluation = evaluateBarrierLog(state.traverseLog, dissolveAt);
    const settled = settleBarrierSpirit(state.traverseLog, barrierId, dissolveAt);
    const result = dissolveBarrier(state.traverseLog, barrierId, dissolveAt);
    if (!result.ok) return;
    syncBarrierFiguresFromLog();
    persistWorkspace();
    if (evaluation.changed || settled.changed || result.ok) persistTraverseLog();
    if (state.selectedBarrierId === barrierId) state.selectedBarrierId = null;
    state.barrierSelection = [];
    if (elements.gridFigureQuickDialog?.open) elements.gridFigureQuickDialog.close("dissolved");
    render();
    showAppToast(t("barrier.dissolved"));
    return;
  }

  const figureId = state.gridFigureQuickFigureId;
  const figure = figureId ? findFigure(figureId) : null;
  if (!figure) return;

  const confirmed = await requestConfirm({
    title: t("figure.delete"),
    message: t("figure.deleteConfirm"),
    confirmLabel: t("action.delete"),
    danger: true
  });
  if (!confirmed || !findFigure(figureId)) return;

  state.figures = state.figures.filter((candidate) => candidate.id !== figureId);
  removeSelectionEntry("figure", figureId);
  if (state.selectedFigureId === figureId) state.selectedFigureId = null;
  persistWorkspace();
  if (elements.gridFigureQuickDialog?.open) elements.gridFigureQuickDialog.close("deleted");
  render();
  showAppToast(t("figure.delete"));
}

function setPointInfoActionLabel(button, label) {
  const labelNode = button.querySelector("[data-i18n]");
  if (labelNode) {
    labelNode.textContent = label;
    return;
  }
  button.textContent = label;
}

function bindPointerActionButton(button, action) {
  let lastPointerActivationAt = 0;

  button.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    lastPointerActivationAt = performance.now();
    action();
  });

  button.addEventListener("click", (event) => {
    if (event.detail > 0 && performance.now() - lastPointerActivationAt < 500) return;
    action();
  });
}

function positionGridPointQuickDialog(screenPoint) {
  if (!screenPoint || !elements.gridPointQuickDialog?.open) return;
  const canvasRect = canvas.getBoundingClientRect();
  const dialogRect = elements.gridPointQuickDialog.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const pointX = canvasRect.left + screenPoint.x;
  const pointY = canvasRect.top + screenPoint.y;
  const margin = 8;
  const gap = 10;
  const maxLeft = Math.max(margin, viewportWidth - dialogRect.width - margin);
  const left = Math.min(Math.max(margin, pointX - dialogRect.width / 2), maxLeft);
  const aboveTop = pointY - dialogRect.height - gap;
  const belowTop = pointY + gap;
  const top = aboveTop >= margin
    ? aboveTop
    : Math.min(Math.max(margin, belowTop), Math.max(margin, viewportHeight - dialogRect.height - margin));
  elements.gridPointQuickDialog.style.left = left + "px";
  elements.gridPointQuickDialog.style.top = top + "px";
}

function openGridPointQuickDialog(point, screenPoint = null) {
  if (!point || !elements.gridPointQuickDialog?.show) return;
  hideGridPointHover();
  state.gridPointQuickPointId = point.id;
  state.gridPointQuickStoneId = null;
  if (!elements.gridPointQuickDialog.open) elements.gridPointQuickDialog.show();
  renderGridPointQuickDialog();
  positionGridPointQuickDialog(screenPoint);
}

function positionGridBarrierStoneQuickDialog(screenPoint) {
  if (!screenPoint || !elements.gridBarrierStoneQuickDialog?.open) return;
  const canvasRect = canvas.getBoundingClientRect();
  const dialogRect = elements.gridBarrierStoneQuickDialog.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const pointX = canvasRect.left + screenPoint.x;
  const pointY = canvasRect.top + screenPoint.y;
  const margin = 8;
  const gap = 10;
  const maxLeft = Math.max(margin, viewportWidth - dialogRect.width - margin);
  const left = Math.min(Math.max(margin, pointX - dialogRect.width / 2), maxLeft);
  const aboveTop = pointY - dialogRect.height - gap;
  const belowTop = pointY + gap;
  const top = aboveTop >= margin
    ? aboveTop
    : Math.min(Math.max(margin, belowTop), Math.max(margin, viewportHeight - dialogRect.height - margin));
  elements.gridPointQuickDialog.style.left = `${left}px`;
  elements.gridPointQuickDialog.style.top = `${top}px`;
}

function openGridBarrierStoneQuickDialog(stoneId, screenPoint = null) {
  const stone = stoneId ? state.traverseLog?.stones?.[stoneId] : null;
  if (!stone || !elements.gridPointQuickDialog?.show) return;
  hideGridPointHover();
  if (elements.gridLinkQuickDialog?.open) elements.gridLinkQuickDialog.close("barrier-stone");
  if (elements.gridFigureQuickDialog?.open) elements.gridFigureQuickDialog.close("barrier-stone");
  state.gridPointQuickPointId = null;
  state.gridPointQuickStoneId = stoneId;
  state.gridBarrierStoneQuickStoneId = stoneId;
  if (!elements.gridPointQuickDialog.open) elements.gridPointQuickDialog.show();
  renderGridBarrierStoneQuickDialog();
  positionGridBarrierStoneQuickDialog(screenPoint);
}

function positionGridLinkQuickDialog(screenPoint) {
  if (!screenPoint || !elements.gridLinkQuickDialog?.open) return;
  const canvasRect = canvas.getBoundingClientRect();
  const dialogRect = elements.gridLinkQuickDialog.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const pointX = canvasRect.left + screenPoint.x;
  const pointY = canvasRect.top + screenPoint.y;
  const margin = 8;
  const gap = 10;
  const maxLeft = Math.max(margin, viewportWidth - dialogRect.width - margin);
  const left = Math.min(Math.max(margin, pointX - dialogRect.width / 2), maxLeft);
  const aboveTop = pointY - dialogRect.height - gap;
  const belowTop = pointY + gap;
  const top = aboveTop >= margin
    ? aboveTop
    : Math.min(Math.max(margin, belowTop), Math.max(margin, viewportHeight - dialogRect.height - margin));
  elements.gridLinkQuickDialog.style.left = `${left}px`;
  elements.gridLinkQuickDialog.style.top = `${top}px`;
}

function positionGridFigureQuickDialog(screenPoint) {
  if (!screenPoint || !elements.gridFigureQuickDialog?.open) return;
  const canvasRect = canvas.getBoundingClientRect();
  const dialogRect = elements.gridFigureQuickDialog.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const pointX = canvasRect.left + screenPoint.x;
  const pointY = canvasRect.top + screenPoint.y;
  const margin = 8;
  const gap = 10;
  const maxLeft = Math.max(margin, viewportWidth - dialogRect.width - margin);
  const left = Math.min(Math.max(margin, pointX - dialogRect.width / 2), maxLeft);
  const aboveTop = pointY - dialogRect.height - gap;
  const belowTop = pointY + gap;
  const top = aboveTop >= margin
    ? aboveTop
    : Math.min(Math.max(margin, belowTop), Math.max(margin, viewportHeight - dialogRect.height - margin));
  elements.gridFigureQuickDialog.style.left = `${left}px`;
  elements.gridFigureQuickDialog.style.top = `${top}px`;
}

function openGridLinkQuickDialog(link, screenPoint = null) {
  if (!link || !elements.gridLinkQuickDialog?.show) return;
  hideGridPointHover();
  state.gridLinkQuickLinkId = link.id;
  if (!elements.gridLinkQuickDialog.open) elements.gridLinkQuickDialog.show();
  renderGridLinkQuickDialog();
  positionGridLinkQuickDialog(screenPoint);
}

function openGridFigureQuickDialog(figure, options = {}) {
  const barrierId = typeof options.barrierId === "string" ? options.barrierId : null;
  const barrier = barrierId ? state.traverseLog?.barriers?.[barrierId] : null;
  if ((!figure && !barrier) || !elements.gridFigureQuickDialog?.show) return;
  hideGridPointHover();
  if (elements.gridPointQuickDialog?.open) elements.gridPointQuickDialog.close("figure");
  if (elements.gridLinkQuickDialog?.open) elements.gridLinkQuickDialog.close("figure");
  state.gridFigureQuickFigureId = figure?.id || null;
  state.gridFigureQuickVertexIndex = Number.isInteger(options.vertexIndex) ? options.vertexIndex : null;
  state.gridFigureQuickBarrierId = barrierId;
  if (!elements.gridFigureQuickDialog.open) elements.gridFigureQuickDialog.show();
  renderGridFigureQuickDialog();
  positionGridFigureQuickDialog(options.screenPoint || null);
}

function openGridLinkColorDialog(link) {
  if (!link || !elements.gridLinkColorDialog?.showModal) return;
  state.gridLinkColorLinkId = link.id;
  elements.gridLinkColorSegmentOption.checked = true;
  const shapeInput = elements.gridLinkColorShapeOption.querySelector("input");
  if (shapeInput) shapeInput.checked = false;
  if (!elements.gridLinkColorDialog.open) elements.gridLinkColorDialog.showModal();
  renderGridLinkColorDialog();
  elements.gridLinkColorPalette.querySelector("input:checked")?.focus();
}

function showSelectedPointInfoDialog(pointOrId = null) {
  const point = typeof pointOrId === "string"
    ? findPoint(pointOrId)
    : pointOrId || (state.pointInfoTargetId ? findPoint(state.pointInfoTargetId) : null) || singleSelectedPoint();
  if (!point) {
    showAppToast(t("info.unavailable"), { error: true });
    return;
  }
  state.pointInfoTargetId = point.id;

  if (!elements.pointInfoDialog?.showModal) {
    const geo = pointGeo(point);
    showAppToast([
      point.title,
      point.note || t("info.noComment"),
      `${t("field.coords")}: ${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}`,
      `${t("info.list")}: ${pointListNameForPoint(point) || t("label.none")}`
    ].join(" | "), { duration: 7000 });
    return;
  }

  if (elements.pointInfoDialog.open) {
    elements.pointInfoDialog.close("refresh");
  }
  elements.pointInfoDialog.showModal();
  renderPointInfoDialog();
  renderActionButtons();
}

function renderBarrierDetails() {
  const panel = elements.barrierDetails;
  if (!panel) return false;
  const score = state.traverseMode && state.selectedBarrierId
    ? scoreBarrier(state.traverseLog, state.selectedBarrierId)
    : null;
  panel.hidden = !score;
  if (elements.barrierShareButton) elements.barrierShareButton.disabled = !score;
  if (!score) return false;
  elements.barrierDetailTitle.textContent = score.name || t("barrier.defaultName");
  const rank = rankForBarrier(state.traverseLog, score.barrierId);
  elements.barrierDetailRank.textContent = `${rank.name}（${rank.reading}）`;
  elements.barrierDetailPower.textContent = `${formatScoreValue(score.power)} 力`;
  elements.barrierDetailDensity.textContent = `${formatScoreValue(score.density)} / km²`;
  elements.barrierDetailArea.textContent = `${formatAreaValue(score.areaKm2)} km²`;
  elements.barrierDetailStones.textContent = `${Math.floor(score.effectiveStoneCount)} / ${score.stoneCount}`;
  elements.barrierDetailShape.textContent = formatFactor(score.shapeCoefficient);
  elements.barrierDetailBeauty.textContent = formatFactor(score.beautyCoefficient);
  elements.barrierDetailScale.textContent = formatFactor(score.scaleCoefficient);
  if (elements.barrierRankProgress) {
    const nextIndex = Math.min(rank.index + 1, BARRIER_EVALUATION_CONFIG.daysRequired.length - 1);
    if (rank.index >= BARRIER_EVALUATION_CONFIG.daysRequired.length - 1) {
      elements.barrierRankProgress.textContent = t("barrier.rankMax");
    } else {
      const nextName = BARRIER_EVALUATION_CONFIG.rankNames[nextIndex];
      const nextPower = BARRIER_EVALUATION_CONFIG.powerThresholds[nextIndex];
      const progress = state.traverseLog.barriers[score.barrierId]?.rankProgress;
      const activeDays = Number(progress?.activeDays?.[nextIndex]) || 0;
      const stoneProgress = barrierRankStoneProgress(score, state.traverseLog.barriers[score.barrierId], BARRIER_EVALUATION_CONFIG, currentKekkaishiRankInfo().rank.index);
      const stoneLine = stoneProgress.reachable
        ? t("barrier.rankStones")
          .replace("{count}", String(stoneProgress.missingStoneCount))
          .replace("{days}", String(Math.ceil(stoneProgress.missingStoneCount / Math.max(1, BARRIER_CONFIG.dailyGrant))))
        : t("barrier.rankUnreachable").replace("{power}", formatScoreValue(stoneProgress.maxPower));
      const daysLine = score.power >= nextPower
        ? `${t("barrier.rankDays")} ${activeDays} / ${BARRIER_EVALUATION_CONFIG.daysRequired[nextIndex]} ${t("barrier.daysUnit")}`
        : `${t("barrier.rankDays")} ${activeDays} / ${BARRIER_EVALUATION_CONFIG.daysRequired[nextIndex]} ${t("barrier.daysUnit")}\n${t("barrier.rankPowerWait")}`;
      elements.barrierRankProgress.textContent = `${t("barrier.rankNext").replace("{rank}", `${nextName}（${BARRIER_EVALUATION_CONFIG.rankReadings[nextIndex]}）`)}\n${t("barrier.rankPower")} ${formatScoreValue(score.power)} / ${formatScoreValue(nextPower)}\n${stoneLine}\n${daysLine}`;
    }
  }
  return true;
}

function kekkaishiUnlockSummary(rankIndex, key = "kekkaishi.unlocks") {
  const index = Math.max(0, Math.min(BARRIER_CONFIG.perimeterLimitKm.length - 1, Number(rankIndex) || 0));
  const perimeter = perimeterLimitKmForRank(index);
  const maxVertices = maxVerticesForRank(index);
  const stockCap = stockCapForRank(index);
  const vertexCap = BARRIER_CONFIG.stoneCapVertexByRank[index] || BARRIER_CONFIG.stoneCapVertex;
  const shapes = barrierShapeSummary(index);
  const edges = Array.from({ length: Math.max(1, maxVertices - 2) }, (_, offset) => {
    const sides = offset + 3;
    return `${sides}角${(perimeter / sides).toFixed(1)}km`;
  }).join("・");
  return t(key)
    .replace("{perimeter}", formatBarrierDistance(perimeter))
    .replace("{shapes}", shapes)
    .replace("{edges}", edges)
    .replace("{vertices}", String(maxVertices))
    .replace("{stock}", String(stockCap))
    .replace("{vertex}", String(vertexCap))
    .replace("{scatter}", String(Math.round(ryumyakuScatterForRank(index) * 100)));
}

function barrierShapeSummary(rankIndex) {
  const maxVertices = maxVerticesForRank(rankIndex);
  const glyphs = ["△"];
  if (maxVertices >= 4) glyphs.push("□");
  if (maxVertices >= 5) glyphs.push("⬠");
  if (maxVertices >= 6) glyphs.push("⬡");
  if (maxVertices >= 7) glyphs.push("7角");
  if (maxVertices >= 8) glyphs.push("8角");
  if (rankIndex >= BARRIER_CONFIG.crossLinkFromRank && maxVertices >= 5) glyphs.push("✦");
  if (rankIndex >= 13 && maxVertices >= 8) glyphs.push("✳");
  return glyphs.join(" ");
}

function renderKekkaishiUnlockDetails(container, rankIndex) {
  if (!container) return;
  const index = Math.max(0, Math.min(BARRIER_CONFIG.perimeterLimitKm.length - 1, Number(rankIndex) || 0));
  const perimeter = perimeterLimitKmForRank(index);
  const maxVertices = maxVerticesForRank(index);
  const edges = Array.from({ length: Math.max(1, maxVertices - 2) }, (_, offset) => {
    const sides = offset + 3;
    return `${sides}角${(perimeter / sides).toFixed(1)}km`;
  }).join("・");
  const details = [
    [t("kekkaishi.perimeterLimit"), formatBarrierDistance(perimeter)],
    [t("kekkaishi.maxVertices"), `${maxVertices}`],
    {
      label: t("kekkaishi.stones"),
      values: [
        [t("kekkaishi.stockCap"), `${stockCapForRank(index)}`],
        [t("kekkaishi.vertexCap"), `${BARRIER_CONFIG.stoneCapVertexByRank[index] || BARRIER_CONFIG.stoneCapVertex}`]
      ]
    },
    [t("kekkaishi.scatter"), t("kekkaishi.scatterValue").replace("{scatter}", String(Math.round(ryumyakuScatterForRank(index) * 100)))],
    [t("kekkaishi.edgeGuide"), edges]
  ];
  container.replaceChildren();
  for (const detail of details) {
    const item = document.createElement("div");
    if (Array.isArray(detail)) {
      const [label, value] = detail;
      const labelNode = document.createElement("span");
      const valueNode = document.createElement("strong");
      labelNode.textContent = label;
      valueNode.textContent = value;
      item.append(labelNode, valueNode);
      container.append(item);
      continue;
    }

    item.classList.add("kekkaishi-status-stones-detail");
    const labelNode = document.createElement("span");
    const valueList = document.createElement("dl");
    labelNode.textContent = detail.label;
    for (const [label, value] of detail.values) {
      const valueItem = document.createElement("div");
      const valueLabel = document.createElement("dt");
      const valueNode = document.createElement("dd");
      valueLabel.textContent = label;
      valueNode.textContent = value;
      valueItem.append(valueLabel, valueNode);
      valueList.append(valueItem);
    }
    item.append(labelNode, valueList);
    container.append(item);
  }
}

function renderKekkaishiShapeCards(container, shapes, locked = false) {
  if (!container) return;
  container.replaceChildren();
  for (const shape of shapes) {
    const card = document.createElement("div");
    card.className = `kekkaishi-status-shape-card${locked ? " is-locked" : ""}`;
    card.setAttribute("role", "img");
    card.setAttribute("aria-label", t(`dragonEye.${shape}`));

    const preview = document.createElement("span");
    preview.className = "kekkaishi-status-shape-preview";
    preview.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", DRAGON_EYE_SHAPE_PREVIEW_POINTS[shape] || "");
    svg.append(polygon);
    preview.append(svg);

    card.append(preview);
    container.append(card);
  }
}

function formatLiveSpiritValue(value, digits = 4) {
  return Math.max(0, Number(value) || 0).toLocaleString(localeName(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function renderKekkaishiLiveLifetime(value, rank, atMaxRank, options = {}) {
  const normalized = Math.max(0, Number(value) || 0);
  const text = `${formatLiveSpiritValue(normalized)} Pt`;
  const lifetime = elements.kekkaishiStatusLifetime;
  if (lifetime && lifetime.textContent !== text) {
    lifetime.textContent = text;
    if (options.animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      lifetime.classList.remove("is-ticking");
      void lifetime.offsetWidth;
      lifetime.classList.add("is-ticking");
    }
  }
  if (elements.kekkaishiStatusProgressValue) {
    elements.kekkaishiStatusProgressValue.textContent = atMaxRank
      ? `${formatLiveSpiritValue(normalized)} Pt`
      : `${formatLiveSpiritValue(normalized)} / ${formatScoreValue(rank.nextLifetime)} Pt`;
  }
  if (elements.kekkaishiStatusProgressBar) {
    const progress = atMaxRank ? 1 : Math.min(1, Math.max(0, normalized / Math.max(1, rank.nextLifetime)));
    elements.kekkaishiStatusProgressBar.style.width = `${Math.round(progress * 100)}%`;
  }
}

function stopKekkaishiStatusAnimation() {
  const animation = state.kekkaishiStatusAnimation;
  if (animation.frameId !== null) window.cancelAnimationFrame(animation.frameId);
  animation.frameId = null;
  animation.current = null;
  animation.target = null;
  animation.startedAt = null;
  animation.lastPainted = "";
}

function startKekkaishiStatusAnimation() {
  if (!state.traverseMode || !state.traverseLog || !elements.kekkaishiStatusDialog?.open) return;
  stopKekkaishiStatusAnimation();

  const animation = state.kekkaishiStatusAnimation;
  const status = state.traverseLog.kekkaishi || createKekkaishiStatus();
  const baseline = Math.max(0, Number(status.lifetimeOutput) || 0);
  animation.current = baseline;
  animation.target = Math.max(baseline, liveCumulativeBarrierSpirit(state.traverseLog));
  animation.startedAt = performance.now();

  const tick = (frameTime) => {
    if (!elements.kekkaishiStatusDialog?.open || !state.traverseMode || !state.traverseLog) {
      stopKekkaishiStatusAnimation();
      return;
    }
    const calculated = liveCumulativeBarrierSpirit(state.traverseLog, Date.now());
    animation.target = Math.max(animation.target ?? baseline, calculated, baseline);
    const elapsed = Math.max(0, frameTime - animation.startedAt);
    const progress = Math.min(1, elapsed / 900);
    const eased = 1 - ((1 - progress) ** 3);
    animation.current = elapsed < 900
      ? baseline + (animation.target - baseline) * eased
      : animation.target;
    const rank = rankForKekkaishi(status);
    renderKekkaishiLiveLifetime(animation.current, rank, rank.index >= BARRIER_EVALUATION_CONFIG.kekkaishiRankNames.length - 1, { animate: elapsed >= 900 });
    animation.frameId = window.requestAnimationFrame(tick);
  };

  animation.frameId = window.requestAnimationFrame(tick);
}

function renderKekkaishiStatusDialog() {
  if (!state.traverseLog || !elements.kekkaishiStatusDialog) return;
  const status = state.traverseLog.kekkaishi || createKekkaishiStatus(Date.now(), Object.keys(state.traverseLog.barriers || {}).length);
  const rank = rankForKekkaishi(status);
  const currentPower = currentBarrierPower(state.traverseLog);
  const dailyUnit = t("kekkaishi.dailyUnit");
  const activeBarrierCount = Object.keys(state.traverseLog.barriers || {}).length;
  const liveLifetime = liveCumulativeBarrierSpirit(state.traverseLog);
  const animation = state.kekkaishiStatusAnimation;
  if (animation.frameId !== null) animation.target = Math.max(animation.target ?? liveLifetime, liveLifetime);
  const displayedLifetime = animation.frameId !== null && Number.isFinite(animation.current)
    ? animation.current
    : liveLifetime;
  const achievedDays = rank.index > 0 ? rankAchievementDays(status, rank.index) : null;
  const maxRankIndex = BARRIER_EVALUATION_CONFIG.kekkaishiRankNames.length - 1;
  const atMaxRank = rank.index >= maxRankIndex;
  const currentShapes = dragonEyeShapesForRank(rank.index);
  const nextIndex = Math.min(rank.index + 1, maxRankIndex);
  const nextShapes = atMaxRank
    ? []
    : dragonEyeShapesForRank(nextIndex).filter((shape) => !currentShapes.includes(shape));
  if (elements.kekkaishiStatusRank) {
    elements.kekkaishiStatusRank.textContent = `${rank.name}${achievedDays === null ? "" : ` ${t("kekkaishi.achievedDays").replace("{days}", String(achievedDays))}`}`;
  }
  elements.kekkaishiStatusLifetime?.parentElement?.classList.toggle("is-producing", activeBarrierCount > 0);
  renderKekkaishiLiveLifetime(displayedLifetime, rank, atMaxRank);
  if (elements.kekkaishiStatusCurrentPower) elements.kekkaishiStatusCurrentPower.textContent = `${formatScoreValue(currentPower)} ${dailyUnit}`;
  if (elements.kekkaishiStatusCount) elements.kekkaishiStatusCount.textContent = String(activeBarrierCount);
  if (elements.kekkaishiStatusDailyPower) elements.kekkaishiStatusDailyPower.textContent = `${formatScoreValue(status.lastDailyPower)} ${dailyUnit}`;
  if (elements.kekkaishiStatusCurrentRank) elements.kekkaishiStatusCurrentRank.textContent = rank.name;
  renderKekkaishiUnlockDetails(elements.kekkaishiStatusCurrentDetails, rank.index);
  renderKekkaishiShapeCards(elements.kekkaishiStatusCurrentShapes, currentShapes);
  if (elements.kekkaishiStatusNextShapesPanel) elements.kekkaishiStatusNextShapesPanel.hidden = nextShapes.length === 0;
  if (nextShapes.length > 0) {
    if (elements.kekkaishiStatusNextRank) elements.kekkaishiStatusNextRank.textContent = BARRIER_EVALUATION_CONFIG.kekkaishiRankNames[nextIndex];
    renderKekkaishiUnlockDetails(elements.kekkaishiStatusNextDetails, nextIndex);
    renderKekkaishiShapeCards(elements.kekkaishiStatusNextShapes, nextShapes, true);
  } else {
    elements.kekkaishiStatusNextDetails?.replaceChildren();
    elements.kekkaishiStatusNextShapes?.replaceChildren();
  }
  if (elements.kekkaishiStatusProgressNextRank) {
    elements.kekkaishiStatusProgressNextRank.textContent = atMaxRank
      ? t("kekkaishi.rankMax")
      : BARRIER_EVALUATION_CONFIG.kekkaishiRankNames[nextIndex];
  }
  if (elements.kekkaishiStatusProgress) {
    if (atMaxRank) {
      elements.kekkaishiStatusProgress.textContent = t("kekkaishi.rankMax");
    } else {
      const remaining = Math.max(0, rank.nextLifetime - rank.lifetime);
      const days = Number(status.lastDailyPower) > 0
        ? t("kekkaishi.progressDays").replace("{days}", String(Math.ceil(remaining / status.lastDailyPower)))
        : t("kekkaishi.noDailyPower");
      elements.kekkaishiStatusProgress.textContent = days;
    }
  }
}

function openKekkaishiStatusDialog() {
  if (!state.traverseMode || !elements.kekkaishiStatusDialog) return;
  const evaluation = evaluateBarrierLog(state.traverseLog);
  if (evaluation.changed) persistTraverseLog();
  if (!elements.kekkaishiStatusDialog.open) elements.kekkaishiStatusDialog.showModal();
  startKekkaishiStatusAnimation();
  renderKekkaishiStatusDialog();
}

async function renderKekkaishiStatusShareImage() {
  const status = state.traverseLog?.kekkaishi || createKekkaishiStatus();
  const rank = rankForKekkaishi(status);
  const liveLifetime = liveCumulativeBarrierSpirit(state.traverseLog);
  const currentPower = currentBarrierPower(state.traverseLog);
  const dailyUnit = t("kekkaishi.dailyUnit");
  const activeBarrierCount = Object.keys(state.traverseLog?.barriers || {}).length;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 820;
  const context = canvas.getContext("2d");
  const colors = barrierShareColors();
  context.fillStyle = colors.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colors.surface;
  context.fillRect(72, 72, 1056, 676);
  context.strokeStyle = colors.line;
  context.lineWidth = 2;
  context.strokeRect(72, 72, 1056, 676);
  context.fillStyle = colors.muted;
  context.font = "700 24px system-ui, sans-serif";
  context.fillText("GRID ATLAS / KEKKAISHI", 120, 132);
  context.fillStyle = colors.text;
  context.font = "800 54px system-ui, sans-serif";
  context.fillText(t("kekkaishi.title"), 120, 214);
  context.fillStyle = colors.muted;
  context.font = "600 18px system-ui, sans-serif";
  context.fillText(t("kekkaishi.rank"), 120, 282);
  context.fillStyle = colors.accent;
  context.font = "900 128px system-ui, sans-serif";
  context.fillText(rank.name, 120, 410);
  context.fillStyle = colors.muted;
  context.font = "600 18px system-ui, sans-serif";
  context.fillText(t("kekkaishi.lifetime"), 320, 282);
  context.fillStyle = colors.text;
  context.font = "800 38px system-ui, sans-serif";
  context.fillText(`${formatLiveSpiritValue(liveLifetime, 2)} Pt`, 320, 410);
  const stats = [
    [t("kekkaishi.currentDailyPower"), `${formatScoreValue(currentPower)} ${dailyUnit}`],
    [t("kekkaishi.dailyPower"), `${formatScoreValue(status.lastDailyPower)} ${dailyUnit}`],
    [t("kekkaishi.activeCount"), String(activeBarrierCount)]
  ];
  stats.forEach(([label, value], index) => {
    const x = 620 + (index % 2) * 250;
    const y = 360 + Math.floor(index / 2) * 106;
    context.fillStyle = colors.muted;
    context.font = "600 18px system-ui, sans-serif";
    context.fillText(label, x, y);
    context.fillStyle = colors.text;
    context.font = "800 30px system-ui, sans-serif";
    context.fillText(value, x, y + 38);
  });
  context.fillStyle = colors.muted;
  context.font = "600 18px system-ui, sans-serif";
  context.fillText("gridatlas.github.io/GRID_ATLAS/", 120, 780);
  context.textAlign = "right";
  context.fillText("#GRIDATLAS  #結界", 1080, 780);
  return canvasToPngBlob(canvas);
}

async function shareKekkaishiStatus() {
  if (!state.traverseMode) return;
  try {
    const blob = await renderKekkaishiStatusShareImage();
    const status = state.traverseLog?.kekkaishi || createKekkaishiStatus();
    const rank = rankForKekkaishi(status);
    const file = new File([blob], `grid-atlas-kekkaishi-${rank.name}.png`, { type: "image/png" });
    const canShareFile = typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }));
    if (canShareFile) {
      try {
        await navigator.share({ files: [file], title: t("kekkaishi.title"), text: t("kekkaishi.shareText").replace("{rank}", rank.name).replace("{power}", `${formatLiveSpiritValue(liveCumulativeBarrierSpirit(state.traverseLog), 2)} Pt`) });
        setShareFeedback(t("kekkaishi.shared"));
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    downloadGridAtlasFile(file);
    setShareFeedback(t("kekkaishi.downloaded"));
  } catch (error) {
    console.warn("GRID ATLAS kekkaishi status image export failed", error);
    setShareFeedback(t("kekkaishi.shareFailed"), { error: true });
  }
}

function beginGuardianPlacement() {
  if (!BARRIER_CONFIG.guardianEnabled || !state.traverseMode || !state.selectedBarrierId) return;
  state.guardianPlacementMode = true;
  render();
}

async function placeGuardianAtScreen(screenPoint) {
  const barrierId = state.selectedBarrierId;
  const barrier = barrierId ? state.traverseLog?.barriers?.[barrierId] : null;
  if (!barrier || barrier.guardian) return;
  const geo = unprojectWorld(screenToWorld(screenPoint));
  if (!Number.isFinite(Number(geo?.lat)) || !Number.isFinite(Number(geo?.lng))) return;
  state.guardianPlacementMode = false;
  render();
  const input = await requestTextInput({
    title: t("barrier.guardianTitle"),
    message: t("barrier.guardianPlacementHint"),
    label: t("barrier.guardianLabel"),
    defaultValue: t("barrier.guardianDefaultLabel"),
    submitLabel: t("action.done"),
    maxLength: 120
  });
  if (input === null) {
    render();
    return;
  }
  const now = new Date().toISOString();
  const guardian = normalizeGuardian({ lat: geo.lat, lng: geo.lng, label: input.value.trim(), placedAt: now }, now);
  if (!guardian) return;
  barrier.guardian = guardian;
  appendBarrierEvent(state.traverseLog, { type: "guardian-placed", at: now, barrierId, guardian });
  persistTraverseLog();
  showAppToast(t("barrier.guardianPlaced"));
  render();
}

async function changeSelectedGuardianLabel() {
  const barrierId = state.selectedBarrierId;
  const barrier = barrierId ? state.traverseLog?.barriers?.[barrierId] : null;
  if (!barrier?.guardian) return;
  const input = await requestTextInput({
    title: t("barrier.guardianChangeLabel"),
    label: t("barrier.guardianLabel"),
    defaultValue: barrier.guardian.label,
    submitLabel: t("action.done"),
    maxLength: 120
  });
  if (input === null) return;
  const now = new Date().toISOString();
  barrier.guardian.label = input.value.trim().slice(0, 120);
  appendBarrierEvent(state.traverseLog, { type: "guardian-label-updated", at: now, barrierId, label: barrier.guardian.label });
  persistTraverseLog();
  showAppToast(t("barrier.guardianUpdated"));
  render();
}

async function removeSelectedGuardian() {
  const barrierId = state.selectedBarrierId;
  const barrier = barrierId ? state.traverseLog?.barriers?.[barrierId] : null;
  if (!barrier?.guardian) return;
  const confirmed = await requestConfirm({
    title: t("barrier.guardianRemove"),
    message: t("barrier.guardianRemoveConfirm"),
    confirmLabel: t("barrier.guardianRemove"),
    danger: true
  });
  if (!confirmed) return;
  barrier.guardian = null;
  appendBarrierEvent(state.traverseLog, { type: "guardian-removed", at: new Date().toISOString(), barrierId });
  persistTraverseLog();
  showAppToast(t("barrier.guardianRemoved"));
  render();
}

function formatScoreValue(value) {
  return Number(value).toLocaleString(localeName(), { maximumFractionDigits: 1 });
}

function formatAreaValue(value) {
  return Number(value).toLocaleString(localeName(), { maximumFractionDigits: 3 });
}

function formatFactor(value) {
  return Number(value).toFixed(2);
}

function renderDetails() {
  const showingBarrier = renderBarrierDetails();
  if (showingBarrier) return;
  const entries = state.selection;
  const point = selectedPoint();
  const link = selectedLink();
  const observation = selectedObservation();
  const hasSelection = entries.length > 0;

  elements.emptyDetails.hidden = hasSelection;
  elements.pointDetails.hidden = !hasSelection;

  if (!hasSelection) {
    elements.selectionHeading.textContent = "選択地点";
    return;
  }

  elements.detailPhoto.hidden = true;
  elements.detailPhoto.removeAttribute("src");
  elements.detailPhoto.alt = "";

  if (entries.length > 1) {
    const counts = selectedCounts();
    const parts = [];
    if (counts.point > 0) {
      parts.push(`${counts.point}${t("label.points")}`);
    }
    if (counts.link > 0) {
      parts.push(`${counts.link}${t("label.links")}`);
    }
    if (counts.observation > 0) {
      parts.push(`${counts.observation}${t("label.observations")}`);
    }

    elements.selectionHeading.textContent = t("panel.multiSelect");
    elements.detailTitleLabel.textContent = t("label.selected");
    elements.detailCoordsLabel.textContent = t("field.count");
    elements.detailCreatedLabel.textContent = t("field.order");
    elements.detailNoteLabel.textContent = t("field.operation");
    elements.detailTitle.textContent = state.selection.map(selectionTitle).join(", ");
    elements.detailCoords.textContent = parts.join(" / ");
    elements.detailCreated.textContent = state.selection.map((entry, index) => `${index + 1}. ${selectionTitle(entry)}`).join(" / ");
    const mapPoints = externalMapPointsForSelection();
    const routeSearch = mapPoints.length > 1;
    elements.detailNote.textContent = routeSearch
      ? t("message.mapRouteHint")
      : t("message.quickHint");
    elements.mapOpenActions.hidden = !routeSearch;
    elements.targetActions.hidden = true;
    return;
  }

  elements.selectionHeading.textContent = observation ? t("panel.observationResult") : link ? t("panel.selectedLine") : t("panel.details");

  if (observation) {
    elements.detailTitleLabel.textContent = t("field.name");
    elements.detailCoordsLabel.textContent = t("field.actualDistance");
    elements.detailCreatedLabel.textContent = t("field.record");
    elements.detailNoteLabel.textContent = t("field.result");
    elements.detailTitle.textContent = loadedObservationTitle(observation);
    elements.detailCoords.textContent = formatDistance(observation.metrics.traveled);
    elements.detailCreated.textContent = `${formatDate(observation.startedAt)} - ${formatDate(observation.endedAt)}`;
    elements.detailNote.textContent = loadedObservationInfoText(observation) || t("message.loadedObservation");
    elements.mapOpenActions.hidden = true;
    elements.targetActions.hidden = true;
    return;
  }

  if (link) {
    const endpoints = linkEndpoints(link);
    if (!endpoints) {
      return;
    }

    elements.detailTitleLabel.textContent = t("field.line");
    elements.detailCoordsLabel.textContent = t("field.distance");
    elements.detailCreatedLabel.textContent = t("field.created");
    elements.detailNoteLabel.textContent = t("field.endpoints");
    elements.detailTitle.textContent = linkTitle(link);
    elements.detailCoords.textContent = formatDistance(distanceBetween(endpoints.a, endpoints.b));
    elements.detailCreated.textContent = formatDate(link.createdAt);
    elements.detailNote.textContent = `${endpoints.a.title} / ${endpoints.b.title}`;
    elements.mapOpenActions.hidden = true;
    elements.targetActions.hidden = true;
    return;
  }

  if (!point) {
    return;
  }

  const geo = pointGeo(point);
  const accuracy = Number.isFinite(geo.accuracy) ? ` / ±${formatDistance(geo.accuracy)}` : "";
  elements.detailTitleLabel.textContent = t("field.title");
  elements.detailCoordsLabel.textContent = t("field.coords");
  elements.detailCreatedLabel.textContent = t("field.created");
  elements.detailNoteLabel.textContent = t("field.note");
  elements.detailTitle.textContent = point.title;
  elements.detailCoords.textContent = `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}${accuracy}`;
  elements.detailCreated.textContent = point.isVirtual ? currentLocationLabel() : formatDate(point.createdAt);
  elements.detailNote.textContent = point.note || t("label.none");
  elements.mapOpenActions.hidden = false;
  renderTargetActions(point);

  if (point.photo) {
    elements.detailPhoto.hidden = false;
    elements.detailPhoto.src = point.photo;
    elements.detailPhoto.alt = point.photoName || point.title;
  }
}
function renderTargetActions(point) {
  const canTarget = point && !point.isVirtual;
  elements.targetActions.hidden = !canTarget;
  if (!canTarget) {
    return;
  }

  const start = routeStartPoint();
  const target = targetPoint();
  const isStart = point.id === state.routeStartPointId;
  const isTarget = point.id === state.targetPointId;
  const switchesFromRouteStart = !isTarget && start && !observationEndpointsDistinct(start, point);
  const switchesFromTarget = !isStart && target && !observationEndpointsDistinct(point, target);
  elements.routeStartPointButton.disabled = false;
  elements.routeStartPointButton.textContent = isStart ? t("button.clearStart") : t("button.setStart");
  elements.routeStartPointButton.title = switchesFromTarget ? "対象から起点に切り替え" : "起点にする";
  elements.routeStartPointButton.classList.toggle("is-active", isStart);
  elements.routeStartPointButton.setAttribute("aria-pressed", String(isStart));
  elements.targetPointButton.disabled = false;
  elements.targetPointButton.textContent = isTarget ? t("button.clearTarget") : t("button.setTarget");
  elements.targetPointButton.title = switchesFromRouteStart ? "起点からターゲットに切り替え" : "ターゲットにする";
  elements.targetPointButton.classList.toggle("is-active", isTarget);
  elements.targetPointButton.setAttribute("aria-pressed", String(isTarget));
}

function targetPoint() {
  return findPoint(state.targetPointId);
}

function targetDistanceMeters() {
  const current = currentLocationPoint();
  const target = targetPoint();
  return current && target ? distanceBetween(current, target) : NaN;
}

function targetArrived() {
  const distance = targetDistanceMeters();
  if (!Number.isFinite(distance)) {
    return false;
  }

  const accuracy = Number.isFinite(state.currentGeo?.accuracy) ? state.currentGeo.accuracy : 0;
  return distance <= Math.max(TARGET_ARRIVAL_METERS, accuracy);
}

function resetObservationTrail() {
  state.observationStartId = null;
  state.observationTargetId = null;
  state.observationStart = null;
  state.observationTrail = [];
}

function observationModeActive() {
  const start = observationStartPoint();
  const target = targetPoint();
  return state.followCurrentLocation && observationScopeValid(start, target);
}

function observationResetNeedsConfirmation() {
  return observationModeActive() || state.observationTrail.length > 0;
}

async function confirmObservationReset(actionLabel) {
  if (!observationResetNeedsConfirmation()) {
    return true;
  }

  return requestConfirm({
    title: cloudText("観察記録の確認", "Confirm observation record"),
    message: cloudText(
      `${actionLabel}しますか。\n記録中の実軌道はリセットされます。`,
      `${actionLabel}?\nThe recorded track will be reset.`
    ),
    confirmLabel: cloudText("実行", "Continue"),
    danger: true
  });
}

function cloneObservationPoint(point) {
  const geo = pointGeo(point);
  return {
    id: point.id,
    x: point.x,
    y: point.y,
    title: point.title,
    geo,
    recordedAt: new Date().toISOString()
  };
}

function routeStartPoint() {
  if (state.routeStartPointId === CURRENT_LOCATION_ID) {
    return currentRouteStartSnapshot() ?? currentLocationPoint();
  }

  return findPoint(state.routeStartPointId);
}

function currentRouteStartSnapshot() {
  if (state.routeStartPointId !== CURRENT_LOCATION_ID) {
    return null;
  }

  return state.routeStartSnapshot ?? state.observationStart ?? null;
}

function ensureCurrentRouteStartSnapshot() {
  if (state.routeStartPointId !== CURRENT_LOCATION_ID || state.routeStartSnapshot) {
    return;
  }

  const current = currentLocationPoint();
  if (current) {
    state.routeStartSnapshot = cloneObservationPoint(current);
  }
}

function updateRouteStartSnapshot(point) {
  state.routeStartSnapshot = point?.id === CURRENT_LOCATION_ID ? cloneObservationPoint(point) : null;
}

function ensureTrackingObservationStart(current = currentLocationPoint()) {
  if (routeStartPoint()) {
    ensureCurrentRouteStartSnapshot();
    return true;
  }

  state.routeStartPointId = CURRENT_LOCATION_ID;
  if (!current) {
    return false;
  }

  state.routeStartSnapshot = cloneObservationPoint(current);
  return true;
}

function observationEndpointsDistinct(start, target) {
  if (!start || !target) {
    return false;
  }

  if (start.id && target.id && start.id === target.id) {
    return false;
  }

  return distanceBetween(start, target) > 1;
}

function observationScopeValid(start, target) {
  return Boolean(start) && (!target || observationEndpointsDistinct(start, target));
}

function clearRouteStartState() {
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  resetObservationTrail();
}

function observationStartPoint() {
  return state.observationStart ?? routeStartPoint();
}

function observationAccuracy(point) {
  const accuracy = Number(point?.geo?.accuracy);
  return Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0;
}

function hasUsableObservationAccuracy(point) {
  const accuracy = observationAccuracy(point);
  return accuracy === 0 || accuracy <= OBSERVATION_MAX_ACCURACY_METERS;
}

function observationStepThreshold(previous, point) {
  const accuracyThreshold = Math.max(observationAccuracy(previous), observationAccuracy(point)) * OBSERVATION_ACCURACY_FACTOR;
  return Math.max(OBSERVATION_MIN_STEP_METERS, accuracyThreshold);
}

function recordObservationPoint(current) {
  if (!state.followCurrentLocation || !current) {
    return;
  }

  ensureTrackingObservationStart(current);
  const target = targetPoint();
  const start = observationStartPoint();
  if (!observationScopeValid(start, target)) {
    return;
  }

  const targetId = target?.id ?? null;
  if (state.observationStartId !== start.id || state.observationTargetId !== targetId || !state.observationStart) {
    state.observationStartId = start.id;
    state.observationTargetId = targetId;
    state.observationStart = cloneObservationPoint(start);
    state.observationTrail = [];
  }

  const point = cloneObservationPoint(current);
  if (!hasUsableObservationAccuracy(point)) {
    return;
  }

  const previous = state.observationTrail.at(-1) ?? state.observationStart;
  if (previous && distanceBetween(previous, point) < observationStepThreshold(previous, point)) {
    return;
  }

  state.observationTrail.push(point);
  if (state.observationTrail.length > OBSERVATION_MAX_POINTS) {
    state.observationTrail.splice(0, state.observationTrail.length - OBSERVATION_MAX_POINTS);
  }
}

function observationPathPoints() {
  const start = observationStartPoint();
  if (!start || state.observationTrail.length === 0) {
    return [];
  }

  return [start, ...state.observationTrail];
}

function observationDisplayPathPoints(current) {
  const start = observationStartPoint();
  if (!start) {
    return [];
  }

  const points = [start, ...state.observationTrail];
  if (current) {
    const last = points.at(-1);
    if (!last || distanceBetween(last, current) > 1) {
      points.push(current);
    }
  }

  return points;
}

function observationPathDistance(points = observationPathPoints()) {
  if (points.length < 2) {
    return 0;
  }

  return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0);
}

function observationMetrics() {
  const start = observationStartPoint();
  const target = targetPoint();
  const observing = observationModeActive();
  const current = observing ? currentLocationPoint() ?? state.observationTrail.at(-1) : state.observationTrail.at(-1);
  if (!observationScopeValid(start, target) || !current || (!observing && state.observationTrail.length === 0)) {
    return null;
  }

  const directToCurrent = distanceBetween(start, current);
  const displayPath = observationDisplayPathPoints(observing ? current : null);
  const traveled = Math.max(observationPathDistance(displayPath), directToCurrent);
  return {
    start,
    target,
    current,
    traveled,
    remaining: target ? distanceBetween(current, target) : NaN,
    ratio: directToCurrent > 1 ? traveled / directToCurrent : NaN
  };
}

function observationInfoText() {
  const metrics = observationMetrics();
  if (!metrics) {
    return "";
  }

  const parts = [
    metrics.target ? `観察 ${metrics.start.title} → ${metrics.target.title}` : `観察 ${metrics.start.title}から`,
    `実 ${formatDistance(metrics.traveled)}`
  ];

  if (Number.isFinite(metrics.remaining)) {
    parts.splice(1, 0, `残 ${formatDistance(metrics.remaining)}`);
  }

  if (Number.isFinite(metrics.ratio)) {
    parts.push(`道直比 ${metrics.ratio.toFixed(2)}`);
  }

  return parts.join(" | ");
}

function observationDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(localeName(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function observationRecordName(start, target, endedAt) {
  const label = observationDateLabel(endedAt);
  const title = target ? `${start.title} → ${target.title}` : `${start.title}から`;
  return `${title}${label ? ` ${label}` : ""}`;
}

function loadedObservationTitle(observation = selectedObservation()) {
  if (!observation) {
    return "読み込み観察";
  }

  return typeof observation.title === "string" && observation.title.trim()
    ? observation.title.trim()
    : observationRecordName(observation.start, observation.target, observation.endedAt);
}

function loadedObservationInfoText(observation = selectedObservation()) {
  const loaded = observation;
  if (!loaded) {
    return "";
  }

  const parts = [
    `観察結果 ${loadedObservationTitle(loaded)}`,
    `実 ${formatDistance(loaded.metrics.traveled)}`
  ];

  if (Number.isFinite(loaded.metrics.ratio)) {
    parts.push(`道直比 ${loaded.metrics.ratio.toFixed(2)}`);
  }

  return parts.join(" | ");
}

async function toggleTargetForPoint(point, options = {}) {
  if (!point) {
    return;
  }
  const preserveSelection = options.preserveSelection === true;

  if (state.targetPointId === point.id) {
    if (!await confirmObservationReset("対象を解除")) {
      return;
    }
    clearTarget({ render: false });
    if (!preserveSelection) setSelection([], { render: false });
    render();
    return;
  }

  const start = routeStartPoint();
  const switchesFromRouteStart = Boolean(start && !observationEndpointsDistinct(start, point));
  const changesTarget = Boolean(state.targetPointId && state.targetPointId !== point.id);
  if ((switchesFromRouteStart || changesTarget) && !await confirmObservationReset(switchesFromRouteStart ? "起点から対象へ切り替え" : "対象を変更")) {
    return;
  }

  if (switchesFromRouteStart) {
    clearRouteStartState();
  }

  ensureCurrentRouteStartSnapshot();
  state.targetPointId = point.id;
  resetObservationTrail();
  if (!state.followCurrentLocation) {
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
    if (!preserveSelection) setSelection([], { render: false });
    render();
    return;
  }

  state.locationFollowScaleMode = FOLLOW_SCALE_TARGET;
  const current = currentLocationPoint();
  if (current) {
    recordObservationPoint(current);
    if (!preserveSelection) setSelection([], { render: false });
    fitTargetFromCurrent(current, point);
    return;
  }

  if (!preserveSelection) setSelection([], { render: false });
  render();
}

function toggleTargetForSelection() {
  return toggleTargetForPoint(singleTargetableSelectedPoint());
}

function clearTarget(options = {}) {
  resetObservationTrail();
  state.targetPointId = null;
  if (state.locationFollowScaleMode === FOLLOW_SCALE_TARGET) {
    state.locationFollowScaleMode = state.followCurrentLocation ? FOLLOW_SCALE_CENTER : FOLLOW_SCALE_MANUAL;
  }

  if (options.render !== false) {
    render();
  }
}
function openSelectedPointInExternalMap(provider) {
  openPointsInExternalMap(externalMapPointsForSelection(), provider);
}

function openSelectedPointInPreferredMap() {
  openPointsInExternalMap(externalMapPointsForSelection(), preferredMapProvider());
}

function openPointInfoTargetInPreferredMap() {
  const point = state.pointInfoTargetId ? findPoint(state.pointInfoTargetId) : null;
  if (!point) {
    return;
  }

  openPointInExternalMap(point, preferredMapProvider());
}

function openPointInExternalMap(point, provider) {
  openPointsInExternalMap([point], provider);
}

function openPointsInExternalMap(points, provider) {
  const stops = points.map((point) => ({ ...point, geo: pointGeo(point) }));
  const url = externalMapUrl(provider, stops);
  if (!url) return;
  window.location.href = url;
}
function renderAnalysis() {
  elements.pointCount.textContent = String(visibleSelectablePoints().length);

  const linkDistances = state.links
    .map((link) => {
      const endpoints = linkEndpoints(link);
      return endpoints ? { link, ...endpoints, distance: distanceBetween(endpoints.a, endpoints.b) } : null;
    })
    .filter(Boolean);

  elements.linkCount.textContent = String(linkDistances.length);
  const total = linkDistances.reduce((sum, item) => sum + item.distance, 0);
  const longest = linkDistances.reduce((max, item) => Math.max(max, item.distance), 0);

  elements.totalDistance.textContent = linkDistances.length ? formatDistance(total) : "-";
  elements.longestDistance.textContent = linkDistances.length ? formatDistance(longest) : "-";

  elements.linkList.replaceChildren();

  if (linkDistances.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "線なし";
    elements.linkList.append(empty);
    return;
  }

  for (const item of linkDistances) {
    const row = document.createElement("div");
    row.className = "link-row";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const distance = document.createElement("span");
    title.textContent = `${item.a.title} - ${item.b.title}`;
    distance.textContent = formatDistance(item.distance);
    text.append(title, distance);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-button";
    remove.title = "削除";
    remove.append(createIcon("trash"));
    remove.addEventListener("click", () => {
      state.links = state.links.filter((link) => link.id !== item.link.id);
      splitDisconnectedStrokeGroups();
      removeSelectionEntry("link", item.link.id);
      persistWorkspace();
      render();
    });

    row.append(text, remove);
    elements.linkList.append(row);
  }
}

function pointRoleIcons(point) {
  const icons = [];
  if (point.id === CURRENT_LOCATION_ID) {
    icons.push("current");
  }
  if (point.id === state.routeStartPointId) {
    icons.push("start");
  }
  if (point.id === state.targetPointId) {
    icons.push("target");
  }
  return icons;
}
function pointRouteOrder(pointId) {
  const index = state.routeResult?.pointIds?.indexOf(pointId) ?? -1;
  return index >= 0 ? index : null;
}

function pointListStorageIdForIndex(list) {
  return list?.cloudId || list?.id || "";
}

function pointListForPreviewStorageId(storageId) {
  const entry = storageId ? findStorageListEntry(storageId) : null;
  if (!entry) return null;
  if (entry.local?.storagePlaceholder && entry.preview) return entry.preview;
  return entry.local ?? entry.preview ?? null;
}

function showPointListPreview(storageId) {
  const list = pointListForPreviewStorageId(storageId);
  if (!list || !elements.pointListPreviewDialog?.showModal) return;
  state.mobilePointPreviewStorageId = storageId;
  renderPointListPreview();
  if (!elements.pointListPreviewDialog.open) {
    elements.pointListPreviewDialog.showModal();
  }
}

function renderPointListPreview() {
  const list = pointListForPreviewStorageId(state.mobilePointPreviewStorageId);
  if (!list || !elements.pointListPreviewDialog) {
    if (elements.pointListPreviewDialog?.open) {
      elements.pointListPreviewDialog.close("list-missing");
    }
    return;
  }

  const rows = list.points.map((point) => ({ point, list, isCloud: list.source === "cloud" }));
  elements.pointListPreviewDialogTitle.textContent = list.name;
  elements.pointListPreviewCount.textContent = `${rows.length}${t("label.points")}`;
  renderPointIndexRows(elements.pointListPreviewItems, rows, null, { allowSelection: false });
}

function pointHasPhoto(point) {
  return Boolean(point?.photo || point?.photoAssetId || point?.cloudPhoto);
}

function renderPointIndexRows(container, rows, current = null, options = {}) {
  if (!container) return;
  container.replaceChildren();
  const allowSelection = options.allowSelection !== false;

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("state.noPoints");
    container.append(empty);
    return;
  }

  for (const { point, list, isCloud = false } of rows) {
    const row = document.createElement("div");
    if (allowSelection) {
      row.classList.toggle("is-active", isPointSelected(point.id));
      row.setAttribute("aria-pressed", String(isPointSelected(point.id)));
      row.setAttribute("role", "button");
      row.tabIndex = 0;
    }
    row.classList.add("point-index-row");
    row.dataset.pointIndexId = point.id;
    row.dataset.pointIndexListId = pointListStorageIdForIndex(list);

    const routeOrder = pointRouteOrder(point.id);
    if (routeOrder !== null) {
      const order = document.createElement("span");
      order.className = "point-index-route-order";
      order.textContent = String(routeOrder);
      order.setAttribute("aria-label", `${t("panel.route")} ${routeOrder}`);
      row.classList.add("has-route-order");
      row.append(order);
    }

    const name = document.createElement("span");
    name.className = "point-index-name";
    const title = document.createElement("strong");
    for (const iconName of pointRoleIcons(point)) {
      title.append(createIcon(iconName));
    }
    title.append(document.createTextNode(point.title || "Point"));
    const meta = document.createElement("span");
    meta.append(document.createTextNode(list?.name || (isCloud ? "地点リスト" : t("label.gps"))));
    if (pointHasPhoto(point)) {
      meta.append(createIcon("camera"));
    }
    name.append(title, meta);

    const distanceText = point.id === CURRENT_LOCATION_ID
      ? currentLocationLabel()
      : current
        ? formatDistance(distanceBetween(current, point))
        : "";
    if (distanceText) {
      const distance = document.createElement("span");
      distance.className = "point-index-distance";
      distance.textContent = distanceText;
      row.append(name, distance);
    } else {
      row.append(name);
    }

    if (allowSelection) {
      row.addEventListener("click", () => {
        if (row.dataset.pointIndexSuppressClick === "true") {
          delete row.dataset.pointIndexSuppressClick;
          return;
        }
        toggleSelection("point", point.id);
      });
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleSelection("point", point.id);
      });
    }
    setupPointIndexGesture(row, { point, list, isCloud });
    container.append(row);
  }
}

function renderPointIndex() {
  if (!elements.mobilePointItems || !elements.mobilePointCount) {
    return;
  }

  ensurePointLists();
  const current = state.gpsEnabled ? currentLocationPoint() : null;
  const rows = visiblePointLists().flatMap((list) => (
    list.points.map((point) => ({ point, list, isCloud: false }))
  ));
  if (state.cloud.connected) {
    rows.push(...visibleCloudPointRows());
  }
  if (current) {
    rows.unshift({ point: current, list: null, isCloud: false });
  }
  elements.mobilePointCount.textContent = `${rows.length}${t("label.points")}`;
  renderPointIndexRows(elements.mobilePointItems, rows, current);
}
function applyCloudListOrder() {
  const metadata = Array.isArray(state.cloud.lists) ? state.cloud.lists : [];
  const available = new Set(metadata.map((list) => list.id).filter(Boolean));
  const orderedIds = [];
  for (const id of state.cloud.listOrder) {
    if (available.has(id) && !orderedIds.includes(id)) orderedIds.push(id);
  }
  for (const list of metadata) {
    if (!orderedIds.includes(list.id)) orderedIds.push(list.id);
  }
  state.cloud.listOrder = orderedIds;
  const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));
  const byOrder = (a, b) => (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER)
    - (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  state.cloud.lists.sort(byOrder);
  state.cloud.pointLists.sort((a, b) => byOrder(
    { id: a.cloudId || a.id },
    { id: b.cloudId || b.id }
  ));
}

function storageListEntries() {
  ensurePointLists();
  const cloudMetaById = new Map(state.cloud.lists.map((list) => [list.id, list]));
  const cloudPreviewById = new Map(state.cloud.pointLists.map((list) => [list.cloudId || list.id, list]));
  const entries = [];

  for (const local of state.pointLists) {
    if (local.storagePlaceholder && local.points.length === 0) continue;
    const storageId = local.cloudId || local.id;
    entries.push({
      storageId,
      local,
      cloud: cloudMetaById.get(storageId) ?? null,
      preview: cloudPreviewById.get(storageId) ?? null
    });
    cloudMetaById.delete(storageId);
  }

  for (const cloud of cloudMetaById.values()) {
    entries.push({
      storageId: cloud.id,
      local: null,
      cloud,
      preview: cloudPreviewById.get(cloud.id) ?? null
    });
  }
  return entries;
}

function findStorageListEntry(storageId) {
  return storageListEntries().find((entry) => entry.storageId === storageId) ?? null;
}

function storageListIsVisible(entry) {
  return entry?.local
    ? entry.local.visible !== false
    : cloudListVisible(entry?.cloud?.id);
}

function storageListIsPointRegistrationDestination(entry) {
  const destinationList = entry?.local ?? entry?.preview;
  return Boolean(destinationList && pointListStorageKey(destinationList) === state.activePointListId);
}

function storageListIsFavorite(storageId) {
  return typeof storageId === "string" && state.favoriteListIds.has(storageId);
}

function toggleStorageListFavorite(storageId) {
  if (storageListIsFavorite(storageId)) {
    state.favoriteListIds.delete(storageId);
    setCloudStatus(t("list.removeFavorite"), { menu: false });
  } else {
    state.favoriteListIds.add(storageId);
    setCloudStatus(t("list.addFavorite"), { menu: false });
  }
  persistWorkspace();
  renderStorageLists();
}
function setupStorageListVisibility(row, entry) {
  const isRowControl = (target) => target instanceof Element
    && target !== row
    && Boolean(target.closest("button, summary, input, select, textarea, a"));

  const toggleVisibility = () => {
    const currentEntry = findStorageListEntry(entry.storageId) ?? entry;
    if (storageListIsPointRegistrationDestination(currentEntry)) {
      setCloudStatus(t("list.destinationLocked"), { error: true });
      return;
    }
    const nextVisible = !storageListIsVisible(currentEntry);
    setStorageListVisible(entry.storageId, nextVisible);
  };

  row.addEventListener("click", (event) => {
    if (row.dataset.storageDragSuppressClick === "true") {
      delete row.dataset.storageDragSuppressClick;
      return;
    }
    if (isRowControl(event.target)) return;
    toggleVisibility();
  });
  row.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isRowControl(event.target)) return;
    event.preventDefault();
    toggleVisibility();
  });
}

function selectStorageListOnGrid(storageId) {
  const entry = findStorageListEntry(storageId);
  const list = entry?.local ?? entry?.preview ?? null;
  if (!entry || !list) return;

  const points = (Array.isArray(list.points) ? list.points : [])
    .map(syncProjectedPoint)
    .filter(Boolean);
  if (!storageListIsVisible(entry)) {
    setStorageListVisible(storageId, true, { render: false });
  }

  state.mode = "inspect";
  setMobilePage("map");
  setMobileGridPage("grid");
  setSelection(
    points.map((point) => ({ type: "point", id: point.id })),
    { render: false }
  );

  if (points.length > 0) {
    fitToPoints(points);
  } else {
    render();
  }
}
function reorderLocalPointLists(sourceId, targetId, before) {
  const sourceIndex = state.pointLists.findIndex((list) => list.id === sourceId);
  const targetIndex = state.pointLists.findIndex((list) => list.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;

  const [source] = state.pointLists.splice(sourceIndex, 1);
  let insertIndex = state.pointLists.findIndex((list) => list.id === targetId);
  if (!before) insertIndex += 1;
  state.pointLists.splice(insertIndex, 0, source);
  persistWorkspace();
  setCloudStatus(t("storage.dragReordered"), { menu: false });
  render();
  return true;
}

function storageListSectionEntryList(sectionKey) {
  if (sectionKey === "mineDevice" || sectionKey === "imported") {
    return state.pointLists.filter((list) => storageListSectionKey({ local: list }) === sectionKey);
  }
  if (sectionKey === "mineCloud" || sectionKey === "testerShared") {
    return state.cloud.pointLists.filter((list) => (
      sectionKey === "testerShared"
        ? list.cloudScope === "testerShared"
        : list.cloudScope !== "testerShared"
    ));
  }
  return [];
}

async function reorderStorageLists(sourceEntry, targetEntry, before) {
  const sectionKey = storageListSectionKey(sourceEntry);
  if (sectionKey !== storageListSectionKey(targetEntry)) return false;
  const lists = storageListSectionEntryList(sectionKey);
  const listKey = (list) => list.cloudId || list.id;
  const sourceKey = sourceEntry.cloud?.id || sourceEntry.local?.id;
  const targetKey = targetEntry.cloud?.id || targetEntry.local?.id;
  const sourceIndex = lists.findIndex((list) => listKey(list) === sourceKey);
  const targetIndex = lists.findIndex((list) => listKey(list) === targetKey);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;

  const isCloudSection = sectionKey === "mineCloud" || sectionKey === "testerShared";
  const previousCloudLists = isCloudSection ? lists.slice() : null;
  const previousCloudOrder = isCloudSection ? state.cloud.listOrder.slice() : null;
  const [source] = lists.splice(sourceIndex, 1);
  let insertIndex = lists.findIndex((list) => listKey(list) === targetKey);
  if (!before) insertIndex += 1;
  lists.splice(insertIndex, 0, source);
  if (sectionKey === "mineDevice" || sectionKey === "imported") {
    const other = state.pointLists.filter((list) => storageListSectionKey({ local: list }) !== sectionKey);
    state.pointLists = [...other, ...lists];
  } else if (isCloudSection) {
    const sectionIds = new Set(lists.map((list) => list.cloudId || list.id).filter(Boolean));
    const reorderedAll = [];
    let inserted = false;
    for (const list of state.cloud.pointLists) {
      const id = list.cloudId || list.id;
      if (sectionIds.has(id)) {
        if (!inserted) {
          reorderedAll.push(...lists);
          inserted = true;
        }
      } else {
        reorderedAll.push(list);
      }
    }
    if (!inserted) reorderedAll.push(...lists);
    state.cloud.pointLists = reorderedAll;
    state.cloud.listOrder = reorderedAll.map((list) => list.cloudId || list.id).filter(Boolean);
    applyCloudListOrder();
  }
  persistWorkspace();
  setCloudStatus(isCloudSection ? t("storage.dragReordering") : t("storage.dragReordered"), { menu: false });
  render();

  if (!isCloudSection) return true;

  setCloudBusy(true);
  setCloudProgress(0, 1, "operation");
  try {
    await cloudClientFromInputs().updateListOrder(state.cloud.listOrder);
    setCloudProgress(1, 1, "operation");
    setCloudBusy(false);
    setCloudStatus(t("storage.dragReordered"), { menu: false });
    render();
    return true;
  } catch (error) {
    state.cloud.pointLists = previousCloudLists;
    state.cloud.listOrder = previousCloudOrder;
    applyCloudListOrder();
    persistWorkspace();
    setCloudBusy(false);
    setCloudStatus(cloudErrorMessage(error), { error: true });
    render();
    return false;
  }
}

function storageListTransferReason(sourceEntry, targetSection) {
  const sourceSection = storageListSectionKey(sourceEntry);
  if (sourceSection === targetSection) return "";
  if (targetSection === "imported") return t("storage.dragImportedDestination");
  if (targetSection === "testerShared" && !state.cloud.testerActive) {
    return cloudText("テスター権限が必要です。", "Tester permission is required.");
  }
  if (targetSection === "mineCloud" && !state.cloud.canUseMine) {
    return cloudText("個別ログインが必要です。", "Individual sign-in is required.");
  }
  if (targetSection !== "mineDevice" && targetSection !== "mineCloud" && targetSection !== "testerShared") {
    return cloudText("移動先を確認できません。", "The transfer destination is unavailable.");
  }
  return "";
}

const STORAGE_TRANSFER_TARGETS = Object.freeze([
  { key: "mineDevice", label: "storage.targetMineDevice" },
  { key: "mineCloud", label: "storage.targetMineCloud" },
  { key: "testerShared", label: "storage.targetTesterShared" }
]);

function storageTransferTargetSections(sourceEntry) {
  if (!sourceEntry) return [];
  const sourceSection = storageListSectionKey(sourceEntry);
  return STORAGE_TRANSFER_TARGETS.filter((target) => (
    target.key !== sourceSection && !storageListTransferReason(sourceEntry, target.key)
  ));
}

function storageTransferTargetListCount(targetSection) {
  return storageListEntries().filter((entry) => storageListSectionKey(entry) === targetSection).length;
}

function renderStorageTransferDialog() {
  const pending = state.pendingStorageTransfer;
  const entry = pending ? findStorageListEntry(pending.storageId) : null;
  const name = entry?.local?.name || entry?.cloud?.name || "地点リスト";
  const target = STORAGE_TRANSFER_TARGETS.find((item) => item.key === pending?.targetSection) || null;
  const targets = storageTransferTargetSections(entry);
  const selectedTarget = target && targets.some((item) => item.key === target.key) ? target : null;

  if (pending && pending.targetSection && !selectedTarget) {
    pending.targetSection = "";
  }

  elements.storageTransferDialogTitle.textContent = t("storage.transferTitle");
  elements.storageTransferDestinationList.setAttribute("aria-label", t("storage.transferDestinationLabel"));
  elements.storageTransferDialogHint.textContent = !entry
    ? ""
    : selectedTarget
      ? t("storage.transferTargetSelected").replace("{target}", t(selectedTarget.label))
      : t("storage.transferSelectTarget").replace("{name}", name);
  elements.storageTransferDestinationList.replaceChildren();

  if (entry && targets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "point-transfer-dialog-empty";
    empty.textContent = t("storage.transferNoTarget");
    elements.storageTransferDestinationList.append(empty);
  }

  for (const item of targets) {
    const button = document.createElement("button");
    const itemLabel = t(item.label);
    const count = storageTransferTargetListCount(item.key);
    const isSelected = selectedTarget?.key === item.key;
    button.type = "button";
    button.className = "point-transfer-destination-button storage-transfer-destination-button";
    button.classList.toggle("is-selected", isSelected);
    button.dataset.storageTransferTarget = item.key;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(isSelected));
    button.setAttribute("aria-label", `${itemLabel} ${t("storage.transferFrameCount").replace("{count}", String(count))}`);
    button.disabled = state.cloud.busy;

    const label = document.createElement("span");
    label.className = "point-transfer-destination-name";
    label.textContent = itemLabel;
    const countLabel = document.createElement("span");
    countLabel.className = "point-transfer-destination-count";
    countLabel.textContent = t("storage.transferFrameCount").replace("{count}", String(count));
    button.append(label, countLabel);
    button.addEventListener("click", () => {
      if (!state.pendingStorageTransfer) return;
      state.pendingStorageTransfer.targetSection = item.key;
      renderStorageTransferDialog();
      elements.storageTransferDestinationList.querySelector(`[data-storage-transfer-target="${item.key}"]`)?.focus();
    });
    elements.storageTransferDestinationList.append(button);
  }

  elements.storageTransferMoveButton.textContent = t("storage.transferMove");
  elements.storageTransferCopyButton.textContent = t("storage.transferCopy");
  elements.storageTransferCancelButton.textContent = t("action.cancel");
  const canExecute = Boolean(pending && entry && selectedTarget && !state.cloud.busy);
  elements.storageTransferMoveButton.disabled = !canExecute;
  elements.storageTransferCopyButton.disabled = !canExecute;
}

function openStorageTransferDialog(storageId, targetSection = "") {
  const entry = findStorageListEntry(storageId);
  if (!entry) {
    showAppToast(cloudText("移動元のリストを確認できません。", "The source list is unavailable."), { error: true });
    return;
  }
  if (targetSection && !STORAGE_TRANSFER_TARGETS.some((target) => target.key === targetSection)) {
    showAppToast(cloudText("移動先を確認できません。", "The transfer destination is unavailable."), { error: true });
    return;
  }
  state.pendingStorageTransfer = { storageId, targetSection };
  renderStorageTransferDialog();
  if (!elements.storageTransferDialog.open) elements.storageTransferDialog.showModal();
  requestAnimationFrame(() => {
    const selected = elements.storageTransferDestinationList.querySelector(".is-selected");
    const first = elements.storageTransferDestinationList.querySelector("button:not(:disabled)");
    (selected || first || elements.storageTransferCancelButton)?.focus();
  });
}

function closeStorageTransferDialog() {
  state.pendingStorageTransfer = null;
  if (elements.storageTransferDialog.open) elements.storageTransferDialog.close("cancel");
}

async function executeStorageListTransfer(mode) {
  const pending = state.pendingStorageTransfer;
  if (!pending?.targetSection) {
    renderStorageTransferDialog();
    return;
  }
  closeStorageTransferDialog();
  if (!pending) return;
  const entry = findStorageListEntry(pending.storageId);
  if (!entry) return;
  const sourceSection = storageListSectionKey(entry);
  const targetSection = pending.targetSection;

  if (targetSection === "mineCloud" || targetSection === "testerShared") {
    const targetScope = targetSection === "testerShared" ? "testerShared" : "mine";
    if ((sourceSection !== "mineDevice" && sourceSection !== "imported") || !entry.local) {
      if (entry.cloud && (sourceSection === "mineCloud" || sourceSection === "testerShared")) {
        await moveCloudListToCloud(pending.storageId, targetScope, { copy: mode === "copy" });
        return;
      }
      showAppToast(cloudText("このリストはクラウドへ移動またはコピーできません。", "This list cannot be moved or copied to cloud storage."), { error: true });
      return;
    }
    await moveListToCloud(pending.storageId, { copy: mode === "copy", targetScope });
    return;
  }

  if (targetSection === "mineDevice") {
    if ((sourceSection === "mineCloud" || sourceSection === "testerShared") && entry.cloud) {
      await moveListToDevice(pending.storageId, { copy: mode === "copy" });
      return;
    }
    if (sourceSection === "imported" && entry.local) {
      if (mode === "copy") {
        copyStorageList(pending.storageId);
      } else {
        entry.local.source = "local";
        entry.local.editable = true;
        entry.local.importedAt = "";
        entry.local.updatedAt = new Date().toISOString();
        persistWorkspace();
        render();
      }
      return;
    }
  }

  showAppToast(cloudText("この移動またはコピーは実行できません。", "This transfer is not available."), { error: true });
}
function clearStorageListDragHover() {
  for (const element of document.querySelectorAll(".storage-list-row.is-drop-before, .storage-list-row.is-drop-after, .storage-list-section.is-drop-target")) {
    element.classList.remove("is-drop-before", "is-drop-after", "is-drop-target");
  }
}

function updateStorageListDragHover(dragState, clientX, clientY) {
  clearStorageListDragHover();
  dragState.drop = null;
  if (!dragState.dragging) return;
  const element = document.elementFromPoint(clientX, clientY);
  const targetRow = element instanceof Element ? element.closest("[data-storage-list-row]") : null;
  const targetSection = element instanceof Element ? element.closest("[data-storage-list-section]") : null;
  const sourceEntry = findStorageListEntry(dragState.storageId);
  if (!sourceEntry) return;
  if (targetRow && targetRow !== dragState.row) {
    const targetEntry = findStorageListEntry(targetRow.dataset.storageListRow);
    if (targetEntry && storageListSectionKey(sourceEntry) === storageListSectionKey(targetEntry)) {
      const rect = targetRow.getBoundingClientRect();
      const before = clientY < rect.top + rect.height / 2;
      dragState.drop = { type: "reorder", targetEntry, before };
      targetRow.classList.add(before ? "is-drop-before" : "is-drop-after");
      return;
    }
  }
  if (!targetSection) return;
  const sectionKey = targetSection.dataset.storageListSection;
  if (storageListSectionKey(sourceEntry) === sectionKey) return;
  const reason = storageListTransferReason(sourceEntry, sectionKey);
  if (reason) {
    dragState.drop = { type: "invalid", reason };
    targetSection.classList.add("is-drop-target");
    return;
  }
  dragState.drop = { type: "transfer", targetSection: sectionKey };
  targetSection.classList.add("is-drop-target");
}
function updateStorageListDragGhost(dragState, clientX, clientY) {
  if (!dragState.ghost) return;
  dragState.ghost.style.transform = "translate3d(" + (clientX + 14) + "px, " + (clientY + 14) + "px, 0)";
}

function findVerticalScrollContainer(element) {
  for (let candidate = element?.parentElement; candidate; candidate = candidate.parentElement) {
    const overflowY = window.getComputedStyle(candidate).overflowY;
    const canScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (canScroll && candidate.scrollHeight > candidate.clientHeight) return candidate;
  }
  return null;
}

function beginStorageListDrag(dragState) {
  if (activeStorageListDrag !== dragState || dragState.dragging) return;
  window.clearTimeout(dragState.timerId);
  window.clearTimeout(dragState.autoTimerId);
  dragState.dragging = true;
  dragState.row.classList.add("is-dragging");
  dragState.row.setAttribute("aria-grabbed", "true");
  document.body.classList.add("is-storage-list-dragging");

  const ghost = document.createElement("div");
  ghost.className = "storage-list-drag-ghost";
  ghost.textContent = dragState.row.querySelector(".point-list-name strong")?.textContent || t("panel.lists");
  document.body.append(ghost);
  dragState.ghost = ghost;
  try {
    dragState.row.setPointerCapture(dragState.pointerId);
  } catch {}
  updateStorageListDragGhost(dragState, dragState.lastX, dragState.lastY);
}

function finishStorageListDrag(dragState) {
  window.clearTimeout(dragState.timerId);
  window.clearTimeout(dragState.autoTimerId);
  clearStorageListDragHover();
  dragState.row.classList.remove("is-dragging");
  dragState.row.classList.remove("is-long-pressed");
  dragState.row.removeAttribute("aria-grabbed");
  if (dragState.ghost) dragState.ghost.remove();
  document.body.classList.remove("is-storage-list-dragging");
  if (activeStorageListDrag === dragState) activeStorageListDrag = null;
}

async function applyStorageListDrop(dragState) {
  const drop = dragState.drop;
  const entry = findStorageListEntry(dragState.storageId);
  if (!drop || !entry) return;
  if (drop.type === "reorder") {
    await reorderStorageLists(entry, drop.targetEntry, drop.before);
  } else if (drop.type === "transfer") {
    openStorageTransferDialog(entry.storageId, drop.targetSection);
  } else if (drop.type === "invalid") {
    showAppToast(drop.reason, { error: true });
  }
}
function setupStorageListDrag(row, entry) {
  const isRowControl = (target) => target instanceof Element
    && target !== row
    && Boolean(target.closest("button, summary, input, select, textarea, a"));

  row.addEventListener("pointerdown", (event) => {
    if ((event.pointerType === "mouse" && event.button !== 0) || state.cloud.busy || isRowControl(event.target)) return;
    if (activeStorageListDrag) finishStorageListDrag(activeStorageListDrag);

    const dragState = {
      row,
      storageId: entry.storageId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      longPressed: false,
      cancelled: false,
      dragging: false,
      drop: null,
      ghost: null,
      timerId: 0,
      autoTimerId: 0,
      actionTriggered: false,
      scrolling: false,
      scrollContainer: findVerticalScrollContainer(row)
    };
    activeStorageListDrag = dragState;

    const cleanup = () => {
      window.clearTimeout(dragState.timerId);
      window.clearTimeout(dragState.autoTimerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (activeStorageListDrag === dragState && !dragState.dragging) activeStorageListDrag = null;
    };
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== dragState.pointerId || activeStorageListDrag !== dragState) return;
      const deltaY = moveEvent.clientY - dragState.lastY;
      dragState.lastX = moveEvent.clientX;
      dragState.lastY = moveEvent.clientY;
      const distance = Math.hypot(moveEvent.clientX - dragState.startX, moveEvent.clientY - dragState.startY);
      if (dragState.scrolling) {
        moveEvent.preventDefault();
        if (dragState.scrollContainer) dragState.scrollContainer.scrollTop -= deltaY;
        return;
      }
      if (!dragState.longPressed) {
        if (distance <= 10) return;
        if (moveEvent.pointerType !== "mouse") {
          dragState.scrolling = true;
          window.clearTimeout(dragState.timerId);
          window.clearTimeout(dragState.autoTimerId);
          moveEvent.preventDefault();
          if (dragState.scrollContainer) dragState.scrollContainer.scrollTop -= deltaY;
          return;
        }
        dragState.cancelled = true;
        cleanup();
        return;
      }
      if (!dragState.dragging) {
        if (distance <= 10) return;
        beginStorageListDrag(dragState);
      }
      moveEvent.preventDefault();
      updateStorageListDragGhost(dragState, moveEvent.clientX, moveEvent.clientY);
      updateStorageListDragHover(dragState, moveEvent.clientX, moveEvent.clientY);
    };
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== dragState.pointerId || activeStorageListDrag !== dragState) return;
      if (!dragState.dragging) {
        if (dragState.scrolling) row.dataset.storageDragSuppressClick = "true";
        cleanup();
        return;
      }
      upEvent.preventDefault();
      updateStorageListDragHover(dragState, upEvent.clientX, upEvent.clientY);
      cleanup();
      row.dataset.storageDragSuppressClick = "true";
      void applyStorageListDrop(dragState);
      finishStorageListDrag(dragState);
    };
    const onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== dragState.pointerId || activeStorageListDrag !== dragState) return;
      cleanup();
      finishStorageListDrag(dragState);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    dragState.autoTimerId = window.setTimeout(() => {
      if (
        activeStorageListDrag !== dragState
        || !dragState.longPressed
        || dragState.dragging
        || dragState.cancelled
      ) return;
      dragState.actionTriggered = true;
      row.dataset.storageDragSuppressClick = "true";
      cleanup();
      finishStorageListDrag(dragState);
      showPointListPreview(entry.storageId);
    }, 1000);
    dragState.timerId = window.setTimeout(() => {
      if (activeStorageListDrag !== dragState || dragState.cancelled) return;
      dragState.longPressed = true;
      row.classList.add("is-long-pressed");
    }, 360);

  });
}

function clearPointIndexDragHover() {
  for (const element of document.querySelectorAll(".point-index-row.is-drop-before, .point-index-row.is-drop-after")) {
    element.classList.remove("is-drop-before", "is-drop-after");
  }
}

function updatePointIndexDragHover(dragState, clientX, clientY) {
  clearPointIndexDragHover();
  dragState.drop = null;
  if (!dragState.dragging) return;
  const element = document.elementFromPoint(clientX, clientY);
  const targetRow = element instanceof Element ? element.closest("[data-point-index-id]") : null;
  if (!targetRow || targetRow === dragState.row || targetRow.dataset.pointIndexListId !== dragState.listStorageId) return;
  const rect = targetRow.getBoundingClientRect();
  const before = clientY < rect.top + rect.height / 2;
  dragState.drop = { targetPointId: targetRow.dataset.pointIndexId, before };
  targetRow.classList.add(before ? "is-drop-before" : "is-drop-after");
}

function updatePointIndexDragGhost(dragState, clientX, clientY) {
  if (!dragState.ghost) return;
  dragState.ghost.style.transform = `translate3d(${clientX + 14}px, ${clientY + 14}px, 0)`;
}

function beginPointIndexDrag(dragState) {
  if (activePointIndexDrag !== dragState || dragState.dragging || !dragState.canReorder) return;
  window.clearTimeout(dragState.timerId);
  window.clearTimeout(dragState.autoTimerId);
  dragState.dragging = true;
  dragState.row.classList.add("is-dragging");
  dragState.row.setAttribute("aria-grabbed", "true");
  document.body.classList.add("is-point-index-dragging");
  const ghost = document.createElement("div");
  ghost.className = "point-index-drag-ghost";
  ghost.textContent = dragState.point.title || "Point";
  document.body.append(ghost);
  dragState.ghost = ghost;
  try {
    dragState.row.setPointerCapture(dragState.pointerId);
  } catch {}
  updatePointIndexDragGhost(dragState, dragState.lastX, dragState.lastY);
}

function finishPointIndexDrag(dragState) {
  window.clearTimeout(dragState.timerId);
  window.clearTimeout(dragState.autoTimerId);
  clearPointIndexDragHover();
  dragState.row.classList.remove("is-dragging", "is-long-pressed");
  dragState.row.removeAttribute("aria-grabbed");
  if (dragState.ghost) dragState.ghost.remove();
  document.body.classList.remove("is-point-index-dragging");
  if (activePointIndexDrag === dragState) activePointIndexDrag = null;
}

async function reorderPointIndexPoints(list, sourcePointId, targetPointId, before) {
  if (!list?.editable || sourcePointId === targetPointId) return false;
  const sourceIndex = list.points.findIndex((point) => point.id === sourcePointId);
  const targetIndex = list.points.findIndex((point) => point.id === targetPointId);
  if (sourceIndex < 0 || targetIndex < 0) return false;
  const points = list.points.slice();
  const [source] = points.splice(sourceIndex, 1);
  let insertIndex = points.findIndex((point) => point.id === targetPointId);
  if (!before) insertIndex += 1;
  points.splice(insertIndex, 0, source);
  const nextList = { ...list, points, updatedAt: new Date().toISOString() };
  if (list.source === "cloud") {
    return updateCloudPointList(list, nextList, {
      message: cloudText("地点の順番を変更しました", "Point order updated")
    });
  }
  list.points = points;
  list.updatedAt = nextList.updatedAt;
  refreshVisiblePoints();
  persistWorkspace();
  setCloudStatus(cloudText("地点の順番を変更しました", "Point order updated"), { menu: false });
  render();
  return true;
}

async function applyPointIndexDrop(dragState) {
  const drop = dragState.drop;
  if (!drop) return;
  const list = dragState.list;
  if (await reorderPointIndexPoints(list, dragState.point.id, drop.targetPointId, drop.before)) {
    showAppToast(cloudText("地点の順番を変更しました", "Point order updated"));
  }
}

function setupPointIndexGesture(row, { point, list }) {
  row.addEventListener("pointerdown", (event) => {
    if ((event.pointerType === "mouse" && event.button !== 0) || state.cloud.busy) return;
    if (activePointIndexDrag) finishPointIndexDrag(activePointIndexDrag);
    const listStorageId = pointListStorageIdForIndex(list);
    const dragState = {
      row,
      point,
      list,
      listStorageId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      longPressed: false,
      cancelled: false,
      canReorder: Boolean(list?.editable),
      dragging: false,
      drop: null,
      ghost: null,
      timerId: 0,
      autoTimerId: 0,
      actionTriggered: false,
      scrolling: false,
      scrollContainer: row.closest(".point-list-preview-items, .mobile-content-panel, [data-mobile-panel], .sidebar")
    };
    activePointIndexDrag = dragState;
    const cleanup = () => {
      window.clearTimeout(dragState.timerId);
      window.clearTimeout(dragState.autoTimerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (activePointIndexDrag === dragState && !dragState.dragging) activePointIndexDrag = null;
    };
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== dragState.pointerId || activePointIndexDrag !== dragState) return;
      const deltaY = moveEvent.clientY - dragState.lastY;
      dragState.lastX = moveEvent.clientX;
      dragState.lastY = moveEvent.clientY;
      const distance = Math.hypot(moveEvent.clientX - dragState.startX, moveEvent.clientY - dragState.startY);
      if (dragState.scrolling) {
        moveEvent.preventDefault();
        if (dragState.scrollContainer) dragState.scrollContainer.scrollTop -= deltaY;
        return;
      }
      if (!dragState.longPressed) {
        if (distance <= 10) return;
        if (moveEvent.pointerType !== "mouse") {
          dragState.scrolling = true;
          window.clearTimeout(dragState.timerId);
          window.clearTimeout(dragState.autoTimerId);
          moveEvent.preventDefault();
          if (dragState.scrollContainer) dragState.scrollContainer.scrollTop -= deltaY;
          return;
        }
        dragState.cancelled = true;
        cleanup();
        return;
      }
      if (!dragState.dragging) {
        if (distance <= 10) return;
        if (!dragState.canReorder) {
          dragState.cancelled = true;
          cleanup();
          return;
        }
        beginPointIndexDrag(dragState);
      }
      moveEvent.preventDefault();
      updatePointIndexDragGhost(dragState, moveEvent.clientX, moveEvent.clientY);
      updatePointIndexDragHover(dragState, moveEvent.clientX, moveEvent.clientY);
    };
    const onUp = async (upEvent) => {
      if (upEvent.pointerId !== dragState.pointerId || activePointIndexDrag !== dragState) return;
      if (!dragState.dragging) {
        if (dragState.scrolling) row.dataset.pointIndexSuppressClick = "true";
        cleanup();
        return;
      }
      upEvent.preventDefault();
      updatePointIndexDragHover(dragState, upEvent.clientX, upEvent.clientY);
      cleanup();
      row.dataset.pointIndexSuppressClick = "true";
      await applyPointIndexDrop(dragState);
      finishPointIndexDrag(dragState);
    };
    const onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== dragState.pointerId || activePointIndexDrag !== dragState) return;
      cleanup();
      finishPointIndexDrag(dragState);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    dragState.timerId = window.setTimeout(() => {
      if (activePointIndexDrag !== dragState || dragState.cancelled) return;
      dragState.longPressed = true;
      row.classList.add("is-long-pressed");
    }, 360);
    dragState.autoTimerId = window.setTimeout(() => {
      if (
        activePointIndexDrag !== dragState
        || !dragState.longPressed
        || dragState.dragging
        || dragState.cancelled
      ) return;
      dragState.actionTriggered = true;
      row.dataset.pointIndexSuppressClick = "true";
      cleanup();
      finishPointIndexDrag(dragState);
      openPointInfoForPoint(point, { fromLongPress: true });
    }, 1000);
  });
}

function closeStorageListEditMenus(except = null) {
  for (const menu of document.querySelectorAll(".storage-list-edit-menu[open]")) {
    if (menu !== except) menu.open = false;
  }
}

function updateStorageListEditMenuPlacement(menu) {
  if (!menu?.open) {
    menu?.classList.remove("is-open-upward");
    return;
  }

  const panel = menu.querySelector(".storage-list-edit-panel");
  if (!panel) return;
  menu.classList.remove("is-open-upward");
  const menuRect = menu.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const viewportBottom = window.visualViewport?.height ?? window.innerHeight;
  const gap = 8;
  const spaceBelow = viewportBottom - menuRect.bottom;
  const spaceAbove = menuRect.top;
  menu.classList.toggle(
    "is-open-upward",
    spaceBelow < panelRect.height + gap && spaceAbove >= panelRect.height + gap
  );
}

function updateOpenStorageListEditMenuPlacements() {
  for (const menu of document.querySelectorAll(".storage-list-edit-menu[open]")) {
    updateStorageListEditMenuPlacement(menu);
  }
}

function createStorageListRow(entry) {
  const row = document.createElement("div");
  row.className = "storage-list-row";
  const visible = storageListIsVisible(entry);
  row.classList.toggle("is-visible", visible);
  row.dataset.storageListRow = entry.storageId;
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-pressed", String(visible));
  const listName = entry.local?.name || entry.cloud?.name || "地点リスト";
  const favorite = storageListIsFavorite(entry.storageId);

  const name = document.createElement("div");
  name.className = "point-list-name point-list-select";
  name.title = listName;
  const title = document.createElement("strong");
  title.append(document.createTextNode(listName));
  const meta = document.createElement("span");
  const pointCount = entry.local?.points.length ?? entry.preview?.points.length ?? 0;
  const metaParts = [String(pointCount) + t("label.points")];
  if (favorite) metaParts.push(t("list.favoriteStatus"));
  if (visible) metaParts.push(t("list.visible"));
  meta.textContent = metaParts.join(" · ");
  name.append(title, meta);

  const rowActions = document.createElement("div");
  rowActions.className = "storage-list-row-actions";

  const share = document.createElement("button");
  const grid = document.createElement("button");
  grid.type = "button";
  grid.className = "storage-grid-button";
  const listPoints = entry.local?.points ?? entry.preview?.points ?? [];
  const selected = listPoints.length > 0
    && selectedPointIds().length === listPoints.length
    && listPoints.every((point) => isPointSelected(point.id));
  grid.classList.toggle("is-active", selected);
  grid.append(createIcon(selected ? "grid-filled" : "grid"));
  grid.title = t("list.selectOnGrid");
  grid.setAttribute("aria-label", cloudText(
    `「${listName}」の地点を選択してグリッドに表示`,
    `Select the points in “${listName}” on the grid`
  ));
  grid.setAttribute("aria-pressed", String(selected));
  grid.disabled = state.cloud.busy || (!entry.local && !entry.preview);
  grid.addEventListener("click", () => selectStorageListOnGrid(entry.storageId));

  share.type = "button";
  share.className = "storage-share-button";
  share.append(createIcon("share"));
  share.title = t("list.export");
  share.setAttribute("aria-label", cloudText("「" + listName + "」を共有", "Share “" + listName + "”"));
  share.disabled = state.cloud.busy || (!entry.local && !entry.preview);
  share.addEventListener("click", () => void shareStorageListFile(entry.storageId));

  const editMenu = document.createElement("details");
  editMenu.className = "storage-list-edit-menu";
  const editSummary = document.createElement("summary");
  editSummary.className = "storage-list-edit-button";
  editSummary.append(createIcon("edit"));
  editSummary.title = t("list.edit");
  editSummary.setAttribute("aria-label", cloudText("「" + listName + "」を編集", "Edit “" + listName + "”"));
  editMenu.append(editSummary);

  const editPanel = document.createElement("div");
  editPanel.className = "storage-list-edit-panel";
  editMenu.append(editPanel);
  editMenu.addEventListener("toggle", () => {
    if (!editMenu.open) {
      editMenu.classList.remove("is-open-upward");
      return;
    }
    closeStorageListEditMenus(editMenu);
    window.requestAnimationFrame(() => updateStorageListEditMenuPlacement(editMenu));
  });
  editMenu.addEventListener("pointerdown", (event) => event.stopPropagation());
  editMenu.addEventListener("click", (event) => event.stopPropagation());

  const addEditAction = (iconName, label, options = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "storage-list-edit-action";
    if (options.className) button.classList.add(options.className);
    button.append(createIcon(iconName), document.createTextNode(label));
    button.disabled = Boolean(options.disabled);
    if (options.pressed !== undefined) button.setAttribute("aria-pressed", String(options.pressed));
    if (options.title) button.title = options.title;
    button.addEventListener("click", () => {
      editMenu.open = false;
      options.onClick?.();
    });
    editPanel.append(button);
    return button;
  };

addEditAction("edit", t("list.rename"), {
    disabled: state.cloud.busy || !(entry.local?.editable || entry.preview?.editable),
    onClick: () => void renameStorageList(entry.storageId)
  });

  addEditAction("copy", t("list.transfer"), {
    disabled: state.cloud.busy,
    title: t("list.transfer"),
    onClick: () => openStorageTransferDialog(entry.storageId)
  });

  const destinationList = entry.local ?? (isMyCloudStorageEntry(entry) ? entry.preview : null);
  const isDestination = destinationList && pointListStorageKey(destinationList) === state.activePointListId;
  if (isDestination) metaParts.push(t("list.active"));
  meta.textContent = metaParts.join(" · ");
  addEditAction(isDestination ? "home-filled" : "home", isDestination ? t("list.unsetHome") : t("list.setHome"), {
    className: isDestination ? "is-active" : "",
    disabled: !destinationList?.editable || state.cloud.busy,
    pressed: isDestination,
    title: isDestination ? t("list.unsetHome") : t("list.setHome"),
    onClick: () => toggleActivePointList(pointListStorageKey(destinationList))
  });

  addEditAction(favorite ? "star-filled" : "star", favorite ? t("list.removeFavorite") : t("list.addFavorite"), {
    className: favorite ? "is-active" : "",
    disabled: state.cloud.busy,
    pressed: favorite,
    title: favorite ? t("list.removeFavorite") : t("list.addFavorite"),
    onClick: () => toggleStorageListFavorite(entry.storageId)
  });

  addEditAction("trash", t("list.delete"), {
    className: "danger-button",
    disabled: state.cloud.busy || Boolean(entry.cloud && !state.cloud.connected),
    title: t("list.delete"),
    onClick: () => void deleteStoredList(entry.storageId)
  });

  rowActions.append(grid, share, editMenu);
  row.append(name, rowActions);
  setupStorageListVisibility(row, entry);
  setupStorageListDrag(row, entry);
  return row;
}
function isMyCloudStorageEntry(entry) {
  return Boolean(entry?.cloud);
}

function isTesterSharedCloudEntry(entry) {
  const cloudId = entry?.cloud?.id || entry?.preview?.cloudId || entry?.preview?.id;
  return Boolean(
    entry?.cloud?.scope === "testerShared"
      || entry?.preview?.cloudScope === "testerShared"
      || (state.cloud.testerActive && cloudId && state.cloud.testerSharedListIds.has(cloudId))
  );
}

function storageListSectionKey(entry) {
  if (entry?.local?.importedAt) return "imported";
  if (entry?.local) return "mineDevice";
  if (isMyCloudStorageEntry(entry) && isTesterSharedCloudEntry(entry)) return "testerShared";
  if (isMyCloudStorageEntry(entry)) return "mineCloud";
  return "";
}

function createStorageListSection(section, entries) {
  const wrapper = document.createElement("details");
  wrapper.className = "storage-list-section";
  wrapper.dataset.storageListSection = section.key;
  wrapper.setAttribute("aria-label", t(section.label));
  wrapper.open = !Boolean(state.storageListSectionCollapsed[section.key]);

  const summary = document.createElement("summary");
  summary.className = "storage-list-section-summary";
  const heading = document.createElement("h3");
  heading.className = "storage-list-section-title";
  heading.textContent = t(section.label);
  summary.append(heading);

  const items = document.createElement("div");
  items.className = "storage-list-section-items";
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "storage-list-empty";
    empty.textContent = t("list.none");
    items.append(empty);
  } else {
    for (const entry of entries) {
      items.append(createStorageListRow(entry));
    }
  }

  wrapper.append(summary, items);
  wrapper.addEventListener("toggle", () => {
    if (wrapper.open) {
      delete state.storageListSectionCollapsed[section.key];
    } else {
      state.storageListSectionCollapsed[section.key] = true;
    }
    persistWorkspace();
  });
  return wrapper;
}

function renderPointDestinationSelect() {
  const select = elements.pointDestinationListSelect;
  if (!select) return;
  const lists = registrationDestinationPointLists();
  const editingList = state.editingPointId ? pointListForPoint(state.editingPointId) : null;
  const fixedKekkaiDestination = state.traverseMode && !editingList ? kekkaiPointList() : null;
  let selectedKey = fixedKekkaiDestination
    ? pointListStorageKey(fixedKekkaiDestination)
    : state.pointDestinationListId
    || (editingList ? pointListStorageKey(editingList) : defaultPointDestinationListId());
  if (selectedKey !== NEW_POINT_LIST_ID && !lists.some((list) => pointListStorageKey(list) === selectedKey)) {
    selectedKey = defaultPointDestinationListId();
  }
  state.pointDestinationListId = selectedKey;

  select.replaceChildren();
  if (!fixedKekkaiDestination) {
    const newListOption = document.createElement("option");
    newListOption.value = NEW_POINT_LIST_ID;
    newListOption.textContent = t("list.newOption");
    select.append(newListOption);
  }
  for (const list of fixedKekkaiDestination ? [fixedKekkaiDestination] : lists) {
    const option = document.createElement("option");
    option.value = pointListStorageKey(list);
    option.textContent = list.name || "地点リスト";
    select.append(option);
  }
  select.value = selectedKey;
  select.disabled = state.cloud.busy || Boolean(fixedKekkaiDestination);
}
function renderStorageLists() {
  const entries = storageListEntries();
  const sections = [{ key: "mineDevice", label: "list.section.mineDevice" }];
  const hasMineCloud = state.cloud.canUseMine || state.cloud.lists.some((list) => list.scope !== "testerShared");
  const hasTesterShared = state.cloud.testerActive
    || state.cloud.lists.some((list) => list.scope === "testerShared")
    || entries.some((entry) => isTesterSharedCloudEntry(entry));
  if (hasMineCloud) {
    sections.push({ key: "mineCloud", label: "list.section.mineCloud" });
  }
  if (hasTesterShared) {
    sections.push({ key: "testerShared", label: "list.section.testerShared" });
  }
  sections.push({ key: "imported", label: "list.section.imported" });
  for (const container of elements.storageListContainers) {
    container.replaceChildren();
    for (const section of sections) {
      const sectionEntries = entries.filter((entry) => storageListSectionKey(entry) === section.key);
      container.append(createStorageListSection(section, sectionEntries));
    }
  }

  renderStorageTransferDialog();
  renderPointTransferDialog();
  renderGeometryDestinationDialog();

  renderCloudLastFetched();
  syncCloudControls();
}
function defaultCloudApiUrl() {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
    ? "http://127.0.0.1:8787"
    : CLOUD_PRODUCTION_API_URL;
}

function loadCloudSettings() {
  state.cloud.apiUrl = defaultCloudApiUrl();
  let token = "";
  try {
    token = localStorage.getItem(CLOUD_ACCESS_TOKEN_KEY) || "";
  } catch {}

  try {
    const sessionToken = sessionStorage.getItem(CLOUD_ACCESS_TOKEN_KEY) || "";
    if (!token && sessionToken) token = sessionToken;
    if (token) localStorage.setItem(CLOUD_ACCESS_TOKEN_KEY, token);
    sessionStorage.removeItem(CLOUD_ACCESS_TOKEN_KEY);
  } catch {}

  elements.cloudAccessToken.value = token;
  state.cloud.testerCode = token;
  state.cloud.connected = Boolean(state.cloud.apiUrl && token);
}

function cloudPasswordSetupKey(userId) {
  return userId ? `${CLOUD_PASSWORD_SETUP_KEY_PREFIX}${userId}` : "";
}

function hasCloudPasswordSetup(userId) {
  const key = cloudPasswordSetupKey(userId);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function markCloudPasswordSetup(userId) {
  const key = cloudPasswordSetupKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, "true");
  } catch {}
}

function hasPendingCloudSignup() {
  try {
    return localStorage.getItem(CLOUD_SIGNUP_PENDING_KEY) === "true";
  } catch {
    return false;
  }
}

function markPendingCloudSignup(pending) {
  try {
    if (pending) localStorage.setItem(CLOUD_SIGNUP_PENDING_KEY, "true");
    else localStorage.removeItem(CLOUD_SIGNUP_PENDING_KEY);
  } catch {}
}

function cloudText(ja, en) {
  return activeLanguage() === EN_LANGUAGE ? en : ja;
}

function isTesterSignupUser(user) {
  return user?.user_metadata?.tester_signup === true
    || user?.user_metadata?.signup_source === "tester";
}

function setCloudAuthStatus(message, options = {}) {
  if (!elements.cloudAuthStatus) return;
  elements.cloudAuthStatus.textContent = message || "";
  elements.cloudAuthStatus.classList.toggle("is-error", options.error === true);
}

function renderCloudAuthControls() {
  if (!elements.cloudAuthPanel) return;
  elements.cloudAuthPanel.hidden = !state.cloud.authConfigured;
  const signedIn = Boolean(state.cloud.authSession?.access_token);
  const passwordSetupComplete = hasCloudPasswordSetup(state.cloud.authUser?.id);
  const passwordRecoveryActive = signedIn && state.cloud.passwordRecoveryActive;
  const signupPasswordSetupActive = signedIn && state.cloud.signupPasswordSetupActive;
  const busy = state.cloud.busy || state.cloud.authBusy;
  elements.cloudAuthPanel.classList.toggle("is-signed-in", signedIn);
  if (elements.cloudSessionBadge) elements.cloudSessionBadge.hidden = !signedIn;
  if (elements.cloudSessionCard) elements.cloudSessionCard.hidden = !signedIn;
  if (elements.cloudSessionEmail) elements.cloudSessionEmail.textContent = state.cloud.authUser?.email || "";
  if (elements.cloudEmailField) elements.cloudEmailField.hidden = signedIn;
  if (elements.cloudPasswordField) elements.cloudPasswordField.hidden = signedIn;
  if (elements.cloudSignUpButton) elements.cloudSignUpButton.disabled = busy || signedIn;
  if (elements.cloudSignInButton) elements.cloudSignInButton.disabled = busy || signedIn;
  if (elements.cloudSignOutButton) elements.cloudSignOutButton.disabled = busy || !signedIn;
  if (elements.cloudSignInButton) elements.cloudSignInButton.hidden = signedIn;
  if (elements.cloudSignOutButton) elements.cloudSignOutButton.hidden = !signedIn;
  if (elements.cloudAuthActions) elements.cloudAuthActions.hidden = signedIn;
  if (elements.cloudPasswordPanel) {
    elements.cloudPasswordPanel.hidden = !signedIn
      || state.cloud.testerSignupComplete
      || (!passwordRecoveryActive && !signupPasswordSetupActive && passwordSetupComplete);
  }
  if (elements.cloudPasswordPanelTitle) {
    elements.cloudPasswordPanelTitle.textContent = passwordRecoveryActive
      ? cloudText("パスワードの再設定", "Reset your password")
      : signupPasswordSetupActive
        ? cloudText("表示名を保存しました。パスワードを設定してください", "Display name saved. Set your password")
      : cloudText("招待ユーザーのパスワード設定（初回のみ）", "Set your password (first time only)");
  }
  if (elements.cloudSetPasswordButton) elements.cloudSetPasswordButton.disabled = busy || !signedIn;
  if (elements.cloudAuthStatus) elements.cloudAuthStatus.hidden = signedIn;
  if (signedIn && state.cloud.authUser?.email && elements.cloudAuthStatus && !elements.cloudAuthStatus.classList.contains("is-error")) {
    elements.cloudAuthStatus.textContent = cloudText(
      `${state.cloud.authUser.email} でログイン中`,
      `Signed in as ${state.cloud.authUser.email}`
    );
  }
  renderCloudTesterSignupDialog();
  renderCloudShares();
}

function renderCloudShares() {
  const section = elements.cloudSharesSection;
  const container = elements.cloudSharesList;
  if (!section || !container) return;
  const signedIn = Boolean(state.cloud.authSession?.access_token) || Boolean(state.cloud.testerCode);
  section.hidden = !signedIn;
  container.replaceChildren();
  if (!signedIn) return;
  if (!state.cloud.shares.length) {
    const empty = document.createElement("p");
    empty.className = "cloud-empty-state";
    empty.textContent = cloudText("発行済みリンクはありません", "No issued links");
    container.append(empty);
    return;
  }
  for (const share of state.cloud.shares) {
    const shareId = share.share_id || share.id;
    const row = document.createElement("div");
    row.className = "cloud-share-row";
    const info = document.createElement("div");
    info.className = "cloud-share-row-info";
    const title = document.createElement("strong");
    title.textContent = share.name || shareId || cloudText("共有", "Share");
    const dates = document.createElement("span");
    dates.textContent = `${share.created_at || share.createdAt || ""} / ${share.expires_at || share.expiresAt || ""}`;
    info.append(title, dates);
    const actions = document.createElement("div");
    actions.className = "button-row";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "compact-button";
    copy.textContent = cloudText("リンクをコピー", "Copy link");
    copy.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set(CLOUD_SHARE_URL_PARAMETER, shareId);
      if (await writeClipboardText(url)) setCloudStatus(cloudText("リンクをコピーしました", "Link copied"));
    });
    const revoke = document.createElement("button");
    revoke.type = "button";
    revoke.className = "danger-button";
    revoke.textContent = cloudText("失効", "Revoke");
    revoke.disabled = Boolean(share.revoked_at || share.revokedAt);
    revoke.addEventListener("click", async () => {
      if (!window.confirm(cloudText("この共有リンクを失効させますか？", "Revoke this share link?"))) return;
      try {
        await cloudClientFromInputs().revokeShare(shareId);
        await refreshCloudShares();
      } catch (error) {
        setCloudStatus(error?.message || cloudText("失効に失敗しました", "Revoke failed"), { error: true });
      }
    });
    actions.append(copy, revoke);
    row.append(info, actions);
    container.append(row);
  }
}

async function refreshCloudShares() {
  if (!state.cloud.connected && !state.cloud.authSession?.access_token) return;
  try {
    const response = await cloudClientFromInputs().listShares();
    state.cloud.shares = Array.isArray(response?.shares) ? response.shares : [];
  } catch (error) {
    state.cloud.shares = [];
    console.warn("GRID ATLAS share list failed", error);
  }
  renderCloudShares();
}

function renderCloudTesterStatus() {
  if (!elements.cloudTesterStatus) return;
  if (state.cloud.testerError) {
    elements.cloudTesterStatus.textContent = state.cloud.testerError;
    elements.cloudTesterStatus.classList.add("is-error");
  } else if (state.cloud.testerActive) {
    elements.cloudTesterStatus.textContent = cloudText("テスター権限あり", "Tester permission active");
    elements.cloudTesterStatus.classList.remove("is-error");
  } else if (state.cloud.testerCode) {
    elements.cloudTesterStatus.textContent = cloudText(
      "テスター権限を確認しています…",
      "Checking tester permission…"
    );
    elements.cloudTesterStatus.classList.remove("is-error");
  } else {
    elements.cloudTesterStatus.textContent = cloudText(
      "テスターコードはこのブラウザに保存されます。",
      "The tester code is saved in this browser."
    );
    elements.cloudTesterStatus.classList.remove("is-error");
  }
  if (elements.cloudTesterSignupButton) {
    elements.cloudTesterSignupButton.hidden = !state.cloud.testerActive;
    elements.cloudTesterSignupButton.disabled = !state.cloud.testerActive || state.cloud.busy || state.cloud.authBusy;
    elements.cloudTesterSignupButton.textContent = cloudText(
      "個別IDを設定",
      "Set up individual ID"
    );
  }
}

function setCloudTesterSignupStatus(message, options = {}) {
  if (!elements.cloudTesterSignupStatus) return;
  elements.cloudTesterSignupStatus.textContent = message || "";
  elements.cloudTesterSignupStatus.classList.toggle("is-error", options.error === true);
}

function renderCloudTesterSignupDialog() {
  const complete = state.cloud.testerSignupComplete === true;
  const settingPassword = state.cloud.signupPasswordSetupActive === true;
  if (elements.cloudTesterSignupPanel) {
    elements.cloudTesterSignupPanel.hidden = complete || settingPassword;
  }
  if (elements.cloudTesterSignupCompletePanel) {
    elements.cloudTesterSignupCompletePanel.hidden = !complete;
  }
  if (elements.cloudTesterSignupCompleteTitle) {
    elements.cloudTesterSignupCompleteTitle.textContent = cloudText("設定が完了しました", "Setup complete");
  }
  if (elements.cloudTesterSignupCompleteMessage) {
    elements.cloudTesterSignupCompleteMessage.textContent = cloudText(
      "表示名とパスワードを設定しました。次回から通常のログイン設定でログインできます。",
      "Your display name and password are ready. You can sign in normally next time."
    );
  }
  if (elements.cloudTesterSignupCompleteCloseButton) {
    elements.cloudTesterSignupCompleteCloseButton.textContent = cloudText("閉じる", "Close");
  }
}

function setCloudTesterSignupPanelOpen(open) {
  if (!elements.cloudTesterSignupDialog) return;
  if (open) {
    moveCloudPasswordPanelToTesterDialog();
    renderCloudTesterSignupDialog();
    setSettingsMenuOpen(false);
    if (!elements.cloudTesterSignupDialog.open) elements.cloudTesterSignupDialog.showModal();
    if (state.cloud.signupPasswordSetupActive) {
      elements.cloudNewPassword?.focus();
    } else if (state.cloud.testerSignupComplete) {
      elements.cloudTesterSignupCompleteCloseButton?.focus();
    } else {
      elements.cloudTesterSignupGridName?.focus();
    }
    return;
  }
  state.cloud.testerSignupComplete = false;
  renderCloudTesterSignupDialog();
  if (elements.cloudTesterSignupDialog.open) elements.cloudTesterSignupDialog.close();
}

function applyCloudAuthSession(session, options = {}) {
  const hadSession = Boolean(state.cloud.authSession?.access_token);
  state.cloud.authSession = session || null;
  state.cloud.authUser = session?.user || null;
  if (session?.access_token) {
    state.cloud.connected = true;
    if (options.refresh !== false && (!hadSession || options.forceRefresh === true)) {
      void refreshCloudLists({ quiet: true });
    }
    if (elements.cloudDialog?.open) void refreshCloudShares();
  } else if (!state.cloud.testerCode && !elements.cloudAccessToken?.value.trim()) {
    state.cloud.connected = false;
    state.cloud.canUseMine = false;
    state.cloud.testerActive = false;
    state.cloud.testerError = "";
    state.cloud.lists = [];
    state.cloud.pointLists = [];
    state.cloud.pointRows = [];
  }
  renderCloudAuthControls();
  renderCloudTesterStatus();
  renderStorageLists();
  syncCloudControls();
}

function setCloudPasswordStatus(message, options = {}) {
  if (!elements.cloudPasswordStatus) return;
  elements.cloudPasswordStatus.textContent = message || "";
  elements.cloudPasswordStatus.classList.toggle("is-error", options.error === true);
}

async function setCloudPassword() {
  if (!state.cloud.authClient || state.cloud.authBusy) return;
  const password = elements.cloudNewPassword?.value || "";
  const confirmation = elements.cloudNewPasswordConfirm?.value || "";
  if (password.length < 6) {
    setCloudPasswordStatus("パスワードは6文字以上にしてください", { error: true });
    return;
  }
  if (password !== confirmation) {
    setCloudPasswordStatus("パスワードが一致しません", { error: true });
    return;
  }

  const isTesterSignupPasswordSetup = state.cloud.signupPasswordSetupActive === true;
  state.cloud.authBusy = true;
  renderCloudAuthControls();
  setCloudPasswordStatus("パスワードを設定しています…");
  setCloudProgress(0, 1, "operation");
  try {
    const { error } = await state.cloud.authClient.auth.updateUser({ password });
    if (error) throw error;
    markCloudPasswordSetup(state.cloud.authUser?.id);
    markPendingCloudSignup(false);
    state.cloud.passwordRecoveryActive = false;
    state.cloud.signupPasswordSetupActive = false;
    state.cloud.testerSignupComplete = isTesterSignupPasswordSetup;
    elements.cloudNewPassword.value = "";
    elements.cloudNewPasswordConfirm.value = "";
    setCloudPasswordStatus("パスワードを設定しました。次回から通常ログインできます");
    setCloudProgress(1, 1, "operation");
  } catch (error) {
    setCloudPasswordStatus(error?.message || "パスワードの設定に失敗しました", { error: true });
  } finally {
    state.cloud.authBusy = false;
    clearCloudProgress();
    renderCloudAuthControls();
  }
}

async function initializeCloudAuth() {
  const config = cloudAuthConfig();
  state.cloud.authConfigured = Boolean(config.url && config.publishableKey);
  state.cloud.authPending = state.cloud.authConfigured;
  if (state.cloud.authPending) {
    setCloudProgress(0, 1, "read");
    renderStorageLists();
    renderActionButtons();
  }
  try {
    state.cloud.authClient = await createCloudAuthClient();
  } catch (error) {
    state.cloud.authPending = false;
    clearCloudProgress();
    setCloudAuthStatus(error?.message || cloudText("クラウド接続を確認できません", "Could not check the cloud connection"), { error: true });
    renderStorageLists();
    renderActionButtons();
    return;
  }
  renderCloudAuthControls();
  if (!state.cloud.authClient) {
    state.cloud.authPending = false;
    clearCloudProgress();
    renderStorageLists();
    renderActionButtons();
    return;
  }

  const authUrlState = cloudAuthUrlState();
  state.cloud.passwordRecoveryActive = authUrlState.type === "recovery";
  state.cloud.signupPasswordSetupActive = authUrlState.type === "signup";

  state.cloud.authClient.auth.onAuthStateChange((_event, session) => {
    // Supabase warns against calling other async auth methods directly from
    // this callback. Defer session state updates until the auth lock is free.
    // List loading is handled by explicit sign-in/startup/list-page actions;
    // token refresh and app resume must not load lists.
    queueMicrotask(() => applyCloudAuthSession(session, { refresh: false }));
  });
  try {
    if (authUrlState.code) {
      const { error } = await state.cloud.authClient.auth.exchangeCodeForSession(authUrlState.code);
      if (error) throw error;
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    const { data, error } = await state.cloud.authClient.auth.getSession();
    if (error) throw error;
    const testerSignupUser = isTesterSignupUser(data.session?.user);
    const passwordSetupComplete = hasCloudPasswordSetup(data.session?.user?.id);
    const signupLink = authUrlState.type === "signup";
    if (data.session && signupLink && !passwordSetupComplete) {
      // Keep the setup flow available if the user reloads before setting a password.
      markPendingCloudSignup(true);
    }
    if (passwordSetupComplete) {
      // A stale Supabase signup URL or old pending flag must not reopen setup.
      markPendingCloudSignup(false);
    }
    state.cloud.signupPasswordSetupActive = !passwordSetupComplete
      && (signupLink || (testerSignupUser && hasPendingCloudSignup()));
    applyCloudAuthSession(data.session, { refresh: Boolean(data.session), forceRefresh: true });
    if (testerSignupUser && state.cloud.signupPasswordSetupActive) {
      setCloudTesterSignupPanelOpen(true);
    } else if (signupLink && !passwordSetupComplete) {
      setCloudTesterSignupPanelOpen(true);
    } else if (["invite", "recovery", "magiclink"].includes(authUrlState.type)) {
      setCloudDialogOpen(true);
    }
    if (data.session && authUrlState.type === "recovery") {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    }
    if (data.session && (authUrlState.code || authUrlState.error || signupLink)) {
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (!data.session && authUrlState.error) {
      const detail = authUrlState.errorCode === "otp_expired"
        ? "招待リンクの期限が切れているか、すでに使用済みです。Supabaseから新しいメールを送ってください"
        : authUrlState.errorDescription || "認証リンクを確認できませんでした";
      setCloudAuthStatus(detail, { error: true });
    }
    if (!data.session && state.cloud.connected) void refreshCloudLists({ quiet: true });
  } catch (error) {
    setCloudAuthStatus(error?.message || cloudText("認証状態を確認できません", "Could not check authentication"), { error: true });
  } finally {
    state.cloud.authPending = false;
    if (!state.cloud.busy) clearCloudProgress();
    renderStorageLists();
    renderActionButtons();
  }
}

async function signUpCloud() {
  if (!state.cloud.authClient) return;
  const email = elements.cloudAuthEmail.value.trim();
  const password = elements.cloudAuthPassword.value;
  if (!email || !password) {
    setCloudAuthStatus(cloudText("メールアドレスとパスワードを入力してください", "Enter an email address and password"), { error: true });
    return;
  }
  state.cloud.authBusy = true;
  setCloudProgress(0, 1, "operation");
  renderCloudAuthControls();
  try {
    const { data, error } = await state.cloud.authClient.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href.split("#", 1)[0] }
    });
    if (error) throw error;
    if (data.session) {
      applyCloudAuthSession(data.session, { forceRefresh: true });
      setCloudAuthStatus(cloudText("登録してログインしました", "Signed up and signed in"));
    } else {
      setCloudAuthStatus(cloudText("確認メールを送信しました。メールのリンクを開いてください", "Confirmation email sent. Open the link to continue"));
    }
    setCloudProgress(1, 1, "operation");
  } catch (error) {
    setCloudAuthStatus(error?.message || cloudText("登録に失敗しました", "Sign-up failed"), { error: true });
  } finally {
    state.cloud.authBusy = false;
    clearCloudProgress();
    renderCloudAuthControls();
  }
}

async function submitTesterSignup() {
  if (!state.cloud.authClient || !state.cloud.testerActive) return;
  const gridName = elements.cloudTesterSignupGridName?.value.trim() || "";
  const email = elements.cloudTesterSignupEmail?.value.trim() || "";
  if (!gridName || !email) {
    setCloudTesterSignupStatus(cloudText("表示名とメールアドレスを入力してください", "Enter a display name and email address"), { error: true });
    return;
  }
  if (gridName.length > 32) {
    setCloudTesterSignupStatus(cloudText("GRID NAMEは32文字以内で入力してください", "GRID NAME must be 32 characters or fewer"), { error: true });
    return;
  }
  state.cloud.authBusy = true;
  setCloudProgress(0, 1, "operation");
  setCloudTesterSignupStatus(cloudText("アカウント設定メールを送信しています…", "Sending account setup email…"));
  renderCloudAuthControls();
  renderCloudTesterStatus();
  try {
    const result = await cloudClientFromInputs().testSignup({ email, gridName });
    markPendingCloudSignup(true);
    setCloudTesterSignupStatus(result?.status === "invited"
      ? cloudText("アカウント設定メールを送信しました。メールのリンクを開いてください", "Account setup email sent. Open the link to continue")
      : cloudText("送信しました", "Sent"));
    setCloudProgress(1, 1, "operation");
  } catch (error) {
    setCloudTesterSignupStatus(error?.message || cloudText("アカウント設定に失敗しました", "Account setup failed"), { error: true });
  } finally {
    state.cloud.authBusy = false;
    clearCloudProgress();
    renderCloudAuthControls();
    renderCloudTesterStatus();
  }
}

async function signInCloud() {
  if (!state.cloud.authClient) return;
  const email = elements.cloudAuthEmail.value.trim();
  const password = elements.cloudAuthPassword.value;
  if (!email || !password) {
    setCloudAuthStatus(cloudText("メールアドレスとパスワードを入力してください", "Enter an email address and password"), { error: true });
    return;
  }
  state.cloud.authBusy = true;
  setCloudProgress(0, 1, "operation");
  renderCloudAuthControls();
  try {
    const { data, error } = await state.cloud.authClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    state.cloud.passwordRecoveryActive = false;
    markCloudPasswordSetup(data.user?.id);
    applyCloudAuthSession(data.session, { forceRefresh: true });
    setCloudAuthStatus(cloudText("ログインしました", "Signed in"));
    setCloudProgress(1, 1, "operation");
  } catch (error) {
    setCloudAuthStatus(error?.message || cloudText("ログインに失敗しました", "Sign-in failed"), { error: true });
  } finally {
    state.cloud.authBusy = false;
    clearCloudProgress();
    renderCloudAuthControls();
  }
}

async function signOutCloud() {
  if (!state.cloud.authClient) return;
  state.cloud.authBusy = true;
  renderCloudAuthControls();
  try {
    const { error } = await state.cloud.authClient.auth.signOut({ scope: "local" });
    if (error) throw error;
    state.cloud.passwordRecoveryActive = false;
    applyCloudAuthSession(null, { refresh: false });
    state.cloud.connected = Boolean(state.cloud.testerCode);
    if (state.cloud.testerCode) {
      void refreshCloudLists({ quiet: true });
    } else {
      state.cloud.canUseMine = false;
      state.cloud.testerActive = false;
      state.cloud.testerError = "";
      state.cloud.lists = [];
      state.cloud.pointLists = [];
      state.cloud.pointRows = [];
      renderStorageLists();
    }
    setCloudAuthStatus("");
  } catch (error) {
    setCloudAuthStatus(error?.message || cloudText("ログアウトに失敗しました", "Sign-out failed"), { error: true });
  } finally {
    state.cloud.authBusy = false;
    renderCloudAuthControls();
  }
}

function cloudClientFromInputs() {
  return createCloudClient({
    baseUrl: state.cloud.apiUrl,
    getAccessToken: async () => {
      if (state.cloud.authClient) {
        const { data } = await state.cloud.authClient.auth.getSession();
        applyCloudAuthSession(data?.session, { refresh: false });
        if (data?.session?.access_token) return data.session.access_token;
      }
      return state.cloud.testerCode || elements.cloudAccessToken.value.trim();
    },
    getTesterCode: () => state.cloud.testerCode || elements.cloudAccessToken.value.trim()
  });
}
function setCloudStatus(message, options = {}) {
  for (const status of elements.cloudStatuses) {
    if (options.menu === false && status.id === "cloudMenuStatus") {
      continue;
    }
    status.value = message || "";
    status.classList.toggle("is-error", options.error === true);
  }
}
function cloudProgressText(kind = "processing") {
  const key = kind === "read"
    ? "storage.cloudReadProgress"
    : kind === "operation"
      ? "storage.cloudOperationProgress"
      : "storage.processingProgress";
  return t(key);
}

function setCloudProgress(completed, total, kind = "processing") {
  if (!elements.cloudProgress || !elements.cloudProgressPattern || !elements.cloudProgressTitle) return;
  if (cloudProgressClearTimer !== null) {
    window.clearTimeout(cloudProgressClearTimer);
    cloudProgressClearTimer = null;
  }
  if (!Number.isFinite(total) || total <= 0) {
    elements.cloudProgress.hidden = true;
    return;
  }
  const width = 7;
  const ratio = Math.max(0, Math.min(1, completed / total));
  const filled = completed >= total ? width : Math.floor(ratio * width);
  elements.cloudProgressTitle.textContent = cloudProgressText(kind);
  elements.cloudProgressPattern.textContent = "■".repeat(filled) + "□".repeat(width - filled);
  elements.cloudProgress.hidden = false;
}

function renderCloudLastFetched() {
  if (!elements.cloudLastFetched) return;
  if (!state.cloud.lastFetchedAt) {
    elements.cloudLastFetched.textContent = t("cloud.neverFetched");
    return;
  }
  const locale = activeLanguage() === EN_LANGUAGE ? "en-US" : "ja-JP";
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(state.cloud.lastFetchedAt));
  elements.cloudLastFetched.textContent = t("cloud.lastFetched").replace("{time}", time);
}

function clearCloudProgress() {
  if (cloudProgressClearTimer !== null) {
    window.clearTimeout(cloudProgressClearTimer);
    cloudProgressClearTimer = null;
  }
  if (!elements.cloudProgress) return;
  elements.cloudProgress.hidden = true;
  if (elements.cloudProgressTitle) elements.cloudProgressTitle.textContent = "";
  if (elements.cloudProgressPattern) elements.cloudProgressPattern.textContent = "";
}

function scheduleCloudProgressClear() {
  if (!elements.cloudProgress) return;
  if (cloudProgressClearTimer !== null) window.clearTimeout(cloudProgressClearTimer);
  cloudProgressClearTimer = window.setTimeout(() => {
    cloudProgressClearTimer = null;
    clearCloudProgress();
  }, 450);
}

function setCloudBusy(busy) {
  state.cloud.busy = Boolean(busy);
  if (!busy) scheduleCloudProgressClear();
  renderStorageLists();
  renderActionButtons();
}

function syncCloudControls() {
  renderCloudAuthControls();
  renderCloudTesterStatus();
  if (elements.cloudAccessToken) elements.cloudAccessToken.disabled = state.cloud.busy;
  if (elements.cloudConnectButton) elements.cloudConnectButton.disabled = state.cloud.busy;
  for (const button of document.querySelectorAll(".storage-rename-button")) {
    button.disabled = state.cloud.busy;
  }
}
async function connectCloud() {
  try {
    cloudClientFromInputs();
    const token = elements.cloudAccessToken.value.trim();
    if (!token) throw new CloudApiError(cloudText("テスター権限コードを入力してください", "Enter a tester permission code"), { status: 401 });
    localStorage.setItem(CLOUD_ACCESS_TOKEN_KEY, token);
    sessionStorage.removeItem(CLOUD_ACCESS_TOKEN_KEY);
    state.cloud.testerCode = token;
    state.cloud.testerError = "";
    state.cloud.connected = true;
    await refreshCloudLists();
  } catch (error) {
    state.cloud.connected = false;
    state.cloud.lists = [];
    state.cloud.pointLists = [];
    state.cloud.pointRows = [];
    setCloudStatus(cloudErrorMessage(error), { error: true });
    render();
  }
}
function disconnectCloud() {
  try {
    localStorage.removeItem(CLOUD_ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(CLOUD_ACCESS_TOKEN_KEY);
  } catch {}
  elements.cloudAccessToken.value = "";
  state.cloud.testerCode = "";
  state.cloud.testerActive = false;
  setKekkaiTesterEnabled(false, { persist: false, announce: false, render: false });
  state.cloud.testerError = "";
  state.cloud.canUseMine = Boolean(state.cloud.authSession?.access_token);
  state.cloud.connected = Boolean(state.cloud.authSession?.access_token);
  state.cloud.lists = [];
  state.cloud.pointLists = [];
  state.cloud.pointRows = [];
  state.cloud.lastFetchedAt = 0;
  state.cloud.lastAutoRefreshAt = 0;
  setCloudStatus(cloudText("切断しました", "Disconnected"));
  if (state.cloud.authSession?.access_token) void refreshCloudLists({ quiet: true });
  renderStorageLists();
  render();
}
async function refreshCloudLists(options = {}) {
  setCloudBusy(true);
  setCloudProgress(0, 3, "read");
  try {
    const client = cloudClientFromInputs();
    const response = await client.listLists();
    if (!Array.isArray(response?.lists)) throw new CloudApiError(cloudText("クラウドリスト一覧の形式が不正です", "Invalid cloud list response"));
    state.cloud.lists = response.lists.filter((list) => (
      list && typeof list.id === "string" && Number.isInteger(list.revision)
    ));
    state.cloud.canUseMine = response.permissions?.mine === true;
    state.cloud.testerActive = response.permissions?.tester === true
      || state.cloud.lists.some((list) => list.scope === "testerShared");
    if (!state.cloud.testerActive) setKekkaiTesterEnabled(false, { persist: false, announce: false, render: false });
    state.cloud.testerError = state.cloud.testerCode && !state.cloud.testerActive
      ? cloudText("テスター権限を確認できませんでした。コードを確認してください。", "Tester permission could not be confirmed. Check the code.")
      : "";
    state.cloud.listOrder = state.cloud.lists.map((list) => list.id);
    repairLocalCloudIdCollisions();

    setCloudProgress(1, 3, "read");
    const details = await Promise.all(state.cloud.lists.map((list) => client.getList(list.id)));
    state.cloud.pointLists = await Promise.all(details.map(async (result) => {
      const list = cloudPayloadToPointList(result.list, {
        localId: "cloud-preview:" + result.list.list.id,
        revision: result.revision,
        editable: true,
        scope: state.cloud.lists.find((meta) => meta.id === result.list.list.id)?.scope || "mine"
      });
      return hydrateCloudPointListAssets(list, client);
    }));
    setCloudProgress(2, 3, "read");
    applyCloudListOrder();
    repairLocalCloudPointIdCollisions();
    ensureActivePointListVisible();
    persistWorkspace();
    state.cloud.pointRows = state.cloud.pointLists.flatMap((list) => (
      list.points.map((point) => ({ point, list, isCloud: true }))
    ));
    syncProjectedCoordinates();
    state.cloud.connected = true;
    await refreshCloudShares();
    state.cloud.lastFetchedAt = Date.now();
    setCloudProgress(3, 3, "read");
    if (options.quiet !== true && state.cloud.canUseMine) {
      setCloudStatus(cloudText(
        `${state.cloud.lists.length}件のマイリスト（クラウド）を読み込みました`,
        `Loaded ${state.cloud.lists.length} My List(s) (Cloud)`
      ));
    }
  } catch (error) {
    state.cloud.connected = false;
    state.cloud.lists = [];
    state.cloud.pointLists = [];
    state.cloud.pointRows = [];
    state.cloud.canUseMine = false;
    state.cloud.testerActive = false;
    setKekkaiTesterEnabled(false, { persist: false, announce: false, render: false });
    state.cloud.testerError = state.cloud.testerCode ? cloudErrorMessage(error) : "";
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    if (options.keepBusy !== true) setCloudBusy(false);
    render();
  }
}

async function requestCloudRefresh() {
  if (!state.cloud.connected) {
    setCloudStatus(t("storage.connectFirst"), { error: true });
    return;
  }
  await refreshCloudLists();
}

function maybeRefreshCloudListsForListPage() {
  const listManagementVisible = state.mobilePage === "data"
    || (state.mobilePage === "map" && state.mobileGridPage === "lists");
  if (!listManagementVisible || document.visibilityState !== "visible" || !state.cloud.connected || state.cloud.busy) return;
  const now = Date.now();
  if (now - state.cloud.lastAutoRefreshAt < CLOUD_AUTO_REFRESH_INTERVAL_MS) return;
  if (state.cloud.lastFetchedAt && now - state.cloud.lastFetchedAt < CLOUD_AUTO_REFRESH_INTERVAL_MS) return;
  state.cloud.lastAutoRefreshAt = now;
  void refreshCloudLists({ quiet: true });
}

async function renameStorageList(storageId) {
  const entry = findStorageListEntry(storageId);
  if (!entry) return;
  const source = entry.local ?? entry.preview;
  if (!source?.editable) {
    setCloudStatus(cloudText("このリストは編集できません", "This list is read-only"), { error: true });
    return;
  }
  const currentName = source?.name || entry.cloud?.name || cloudText("地点リスト", "Point list");
  const input = await requestTextInput({
    title: t("list.renamePrompt"),
    label: t("field.name"),
    defaultValue: currentName,
    submitLabel: t("list.rename")
  });
  if (input === null) return;
  const nextName = input.trim();
  if (!nextName || nextName === currentName) return;

  if (!entry.cloud) {
    if (!entry.local) return;
    entry.local.name = nextName;
    entry.local.updatedAt = new Date().toISOString();
    persistWorkspace();
    setCloudStatus(cloudText(`「${nextName}」に変更しました`, `Renamed to “${nextName}”`));
    render();
    return;
  }
  if (!state.cloud.connected || !source) {
    setCloudStatus(t("storage.connectFirst"), { error: true });
    return;
  }

  setCloudBusy(true);
  let renamed = false;
  try {
    const payload = pointListToCloudPayload({
      ...source,
      cloudId: entry.cloud.id,
      name: nextName
    }, pointGeo);
    await cloudClientFromInputs().updateList(entry.cloud.id, entry.cloud.revision, payload);
    if (entry.local) {
      entry.local.name = nextName;
      entry.local.updatedAt = new Date().toISOString();
      persistWorkspace();
    }
    renamed = true;
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
  }

  if (renamed) {
    await refreshCloudLists({ quiet: true });
    setCloudStatus(cloudText(`「${nextName}」に変更しました`, `Renamed to “${nextName}”`));
  }
}

function removeLocalListForStorageChange(listId) {
  const list = state.pointLists.find((item) => item.id === listId);
  if (!list || list.reservedKind === "kekkai") return;
  const before = workspaceSnapshot();
  const pointIds = new Set(list.points.map((point) => point.id));
  const lineIds = new Set((list.lines || []).map((line) => line.id));
  const figureIds = new Set((list.figures || []).map((figure) => figure.id));

  if (list.id === DEFAULT_POINT_LIST_ID) {
    const index = state.pointLists.findIndex((item) => item.id === list.id);
    const replacement = createLocalPointList();
    replacement.name = "新しいマイ地点";
    replacement.storagePlaceholder = true;
    state.pointLists[index] = replacement;
  } else {
    state.pointLists = state.pointLists.filter((item) => item.id !== list.id);
    if (state.activePointListId === list.id) state.activePointListId = DEFAULT_POINT_LIST_ID;
  }
  ensurePointLists();
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  state.selection = state.selection.filter((entry) => (
    (entry.type !== "point" || !pointIds.has(entry.id))
    && (entry.type !== "link" || !lineIds.has(entry.id))
    && (entry.type !== "figure" || !figureIds.has(entry.id))
  ));
  normalizeSelection();

  try {
    persistWorkspace();
  } catch (error) {
    applyWorkspace(before);
    throw new CloudApiError(cloudText("端末の保存データを更新できません", "Could not update device storage"), { cause: error });
  }
  render();
}

async function moveListToCloud(storageId, options = {}) {
  const entry = findStorageListEntry(storageId);
  if (!entry?.local) return false;
  if (!state.cloud.connected) {
    setCloudStatus(t("storage.connectFirst"), { error: true });
    renderStorageLists();
    return false;
  }
  const source = entry.local;
  const targetCloudId = "cloud:" + createId();
  const targetScope = options.targetScope === "testerShared" ? "testerShared" : "mine";
  const cloudList = { ...source, id: targetCloudId, cloudId: targetCloudId, cloudScope: targetScope };
  const payload = pointListToCloudPayload(cloudList, pointGeo);
  setCloudBusy(true);
  setCloudProgress(0, 1, "operation");
  let completed = false;
  let cloudDeleteFailed = false;
  try {
    const client = cloudClientFromInputs();
    const created = await client.createList(payload, { scope: targetScope });
    if (cloudList.points.some((point) => point.photoAssetId || point.photo || point.cloudPhoto)) {
      const photoPayload = await cloudPayloadWithPhotos(cloudList, targetCloudId, client);
      await client.updateList(targetCloudId, created?.revision || 1, photoPayload);
    }
    if (options.copy !== true) removeLocalListForStorageChange(source.id);
    setCloudProgress(1, 1, "operation");
    completed = true;
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
  }
  if (completed) {
    await refreshCloudLists({ quiet: true });
    const targetLabel = targetScope === "testerShared" ? "共有リスト（テスター間実験）" : "マイリスト（クラウド）";
    const targetLabelEn = targetScope === "testerShared" ? "Shared Lists (Tester Experiment)" : "My Lists (Cloud)";
    setCloudStatus(options.copy === true
      ? cloudText(`${targetLabel}へコピーしました`, `Copied to ${targetLabelEn}`)
      : cloudText(`${targetLabel}へ移動しました`, `Moved to ${targetLabelEn}`));
  }
  return completed;
}

async function moveCloudListToCloud(storageId, targetScope, options = {}) {
  const entry = findStorageListEntry(storageId);
  if (!entry?.cloud || !state.cloud.connected) {
    setCloudStatus(t("storage.connectFirst"), { error: true });
    renderStorageLists();
    return false;
  }
  if (targetScope !== "mine" && targetScope !== "testerShared") return false;
  if (targetScope === "mine" && !state.cloud.canUseMine) {
    setCloudStatus(cloudText("個別ログインが必要です。", "Individual sign-in is required."), { error: true });
    return false;
  }
  if (targetScope === "testerShared" && !state.cloud.testerActive) {
    setCloudStatus(cloudText("テスター権限が必要です。", "Tester permission is required."), { error: true });
    return false;
  }

  setCloudBusy(true);
  setCloudProgress(0, 1, "operation");
  let completed = false;
  try {
    const client = cloudClientFromInputs();
    const sourceResult = await client.getList(entry.cloud.id);
    const sourceList = await hydrateCloudPointListAssets(
      cloudPayloadToPointList(sourceResult.list, {
        localId: "cloud-transfer:" + sourceResult.list.list.id,
        revision: sourceResult.revision,
        editable: true,
        scope: entry.cloud.scope || "mine"
      }),
      client,
      { required: true }
    );
    for (const point of sourceList.points) point.cloudPhoto = null;
    const targetCloudId = "cloud:" + createId();
    const payload = await cloudPayloadWithPhotos(
      { ...sourceList, id: targetCloudId, cloudId: targetCloudId, cloudScope: targetScope },
      targetCloudId,
      client
    );
    const created = await client.createList(payload, { scope: targetScope });
    if (options.copy !== true) {
      try {
        await client.deleteList(entry.cloud.id, sourceResult.revision);
      } catch {
        cloudDeleteFailed = true;
      }
    }
    setCloudProgress(1, 1, "operation");
    completed = true;
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
  }
  if (completed) {
    await refreshCloudLists({ quiet: true });
    setCloudStatus(cloudDeleteFailed
      ? cloudText("コピー先を作成しましたが、元の共有先を削除できませんでした。", "The destination was created, but the source could not be deleted.")
      : options.copy === true
      ? cloudText(`${targetScope === "testerShared" ? "共有リスト（テスター間実験）" : "マイリスト（クラウド）"}へコピーしました`, `Copied to ${targetScope === "testerShared" ? "Shared Lists (Tester Experiment)" : "My Lists (Cloud)"}`)
      : cloudText(`${targetScope === "testerShared" ? "共有リスト（テスター間実験）" : "マイリスト（クラウド）"}へ移動しました`, `Moved to ${targetScope === "testerShared" ? "Shared Lists (Tester Experiment)" : "My Lists (Cloud)"}`),
      { error: cloudDeleteFailed });
  }
  return completed;
}

function uniqueLocalListId(preferredId) {
  const existingIds = new Set(state.pointLists.map((list) => list.id));
  const cloudIds = new Set(state.cloud.lists.map((list) => list.id));
  const preferred = typeof preferredId === "string" ? preferredId.trim() : "";
  const isCloudId = preferred.startsWith("cloud:") || preferred.startsWith("cloud-preview:");
  if (preferred && preferred !== DEFAULT_POINT_LIST_ID && !isCloudId && !existingIds.has(preferred) && !cloudIds.has(preferred)) {
    return preferred;
  }
  let nextId = createId();
  while (existingIds.has(nextId) || cloudIds.has(nextId)) nextId = createId();
  return nextId;
}

function repairLocalCloudIdCollisions() {
  const cloudIds = new Set(state.cloud.lists.map((list) => list.id));
  if (cloudIds.size === 0) return false;
  let changed = false;
  for (const list of state.pointLists) {
    if (list.cloudId || !cloudIds.has(list.id)) continue;
    const previousId = list.id;
    list.id = uniqueLocalListId();
    if (state.activePointListId === previousId) state.activePointListId = list.id;
    if (state.pointDestinationListId === previousId) state.pointDestinationListId = list.id;
    changed = true;
  }
  return changed;
}

async function moveListToDevice(storageId, options = {}) {
  const entry = findStorageListEntry(storageId);
  if (!entry?.cloud || !state.cloud.connected) {
    setCloudStatus(t("storage.connectFirst"), { error: true });
    renderStorageLists();
    return false;
  }
  const name = entry.cloud.name || "地点リスト";
  setCloudBusy(true);
  setCloudProgress(0, 1, "operation");
  let installed = false;
  let cloudDeleteFailed = false;
  try {
    const client = cloudClientFromInputs();
    const result = await client.getList(entry.cloud.id);
    const imported = await hydrateCloudPointListAssets(cloudPayloadToPointList(result.list, { localId: uniqueLocalListId(result.list.list.id), revision: result.revision, editable: true }), client, {
      required: true,
      onProgress: (completed, total) => setCloudProgress(completed, Math.max(total, 1), "processing")
    });
    setCloudProgress(1, 1, "operation");
    const existingPointIds = new Set([
      ...allPointListPoints().map((point) => point.id),
      ...state.cloud.pointLists.flatMap((list) => list.points.map((point) => point.id))
    ]);
    const normalized = normalizePointList({
      ...imported,
      id: uniqueLocalListId(imported.id),
      cloudId: "",
      cloudScope: "",
      cloudRevision: null,
      cloudUpdatedAt: "",
      source: "local",
      importedAt: "",
      editable: true
    }, existingPointIds, imported.name);
    state.pointLists.push(normalized);
    state.activePointListId = normalized.id;
    refreshVisiblePoints();
    persistWorkspace();
    installed = true;
    if (options.copy !== true) {
      try { await client.deleteList(entry.cloud.id, result.revision); }
      catch { cloudDeleteFailed = true; }
    }
    setCloudProgress(1, 1, "operation");
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
  }
  if (installed) {
    await refreshCloudLists({ quiet: true });
    setCloudStatus(cloudDeleteFailed
      ? cloudText("端末へコピーしましたが、クラウド側を削除できませんでした。", "Copied to device, but the cloud list could not be deleted.")
      : options.copy === true
        ? cloudText("マイリスト（端末内）へコピーしました", "Copied to My Lists (Device)")
        : cloudText("マイリスト（端末内）へ移動しました", "Moved to My Lists (Device)"),
      { error: cloudDeleteFailed });
  }
  return installed;
}
async function deleteStoredList(storageId, options = {}) {
  const entry = findStorageListEntry(storageId);
  if (!entry) {
    renderStorageLists();
    return;
  }
  if (entry.local?.reservedKind === "kekkai") {
    setCloudStatus(cloudText("結界アトラスは削除できません", "Kekkai Atlas cannot be deleted"), { error: true });
    return;
  }
  const name = entry.local?.name || entry.cloud?.name || "地点リスト";
  const local = entry.local;
  const counts = {
    points: local?.points?.length || 0,
    lines: local?.lines?.length || 0,
    figures: local?.figures?.length || 0
  };
  if (options.confirm !== false && !await requestConfirm({
    title: cloudText("リスト削除の確認", "Confirm list deletion"),
    message: cloudText(
      `「${name}」を削除します。\n地点 ${counts.points}件・線分 ${counts.lines}件・図形 ${counts.figures}件が削除されます。`,
      `Delete “${name}”?\nThis removes ${counts.points} place(s), ${counts.lines} line(s), and ${counts.figures} figure(s).`
    ),
    confirmLabel: t("action.delete"),
    danger: true
  })) return;

  const usesCloudStorage = Boolean(entry.cloud);
  if (usesCloudStorage) setCloudBusy(true);
  let deleted = false;
  try {
    if (entry.cloud) {
      await cloudClientFromInputs().deleteList(entry.cloud.id, entry.cloud.revision);
      state.cloud.hiddenListIds.delete(entry.cloud.id);
      state.cloud.testerSharedListIds.delete(entry.cloud.id);
    }
    if (entry.local) removeLocalListForStorageChange(entry.local.id);
    else persistWorkspace();
    state.favoriteListIds.delete(entry.storageId);
    persistWorkspace();
    deleted = true;
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    if (usesCloudStorage) setCloudBusy(false);
  }

  if (deleted) {
    if (usesCloudStorage && state.cloud.connected) await refreshCloudLists({ quiet: true });
    setCloudStatus(cloudText("リストを削除しました", "List deleted"));
  }
}
function cloudErrorMessage(error) {
  if (error instanceof CloudApiError && error.message) return error.message;
  return cloudText("クラウド操作に失敗しました", "Cloud operation failed");
}
function setStorageListVisible(storageId, visible, options = {}) {
  const entry = findStorageListEntry(storageId);
  if (!entry) return;
  const nextVisible = Boolean(visible);
  if (entry.local) {
    entry.local.visible = nextVisible;
    entry.local.updatedAt = new Date().toISOString();
  }
  if (entry.cloud && state.cloud.testerActive) {
    if (nextVisible) state.cloud.hiddenListIds.delete(entry.cloud.id);
    else state.cloud.hiddenListIds.add(entry.cloud.id);
  }
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  if (options.persist !== false) persistWorkspace();
  if (options.render !== false) render();
}

async function deletePointList(listId) {
  const list = state.pointLists.find((item) => item.id === listId);
  if (!list || list.id === DEFAULT_POINT_LIST_ID || list.reservedKind === "kekkai") {
    return;
  }

  const confirmed = await requestConfirm({
    title: cloudText("リスト削除の確認", "Confirm list deletion"),
    message: cloudText(
      `「${list.name || "地点リスト"}」を削除します。\n地点 ${list.points.length}件・線分 ${(list.lines || []).length}件・図形 ${(list.figures || []).length}件が削除されます。`,
      `Delete “${list.name || "point list"}”?\nThis removes ${list.points.length} place(s), ${(list.lines || []).length} line(s), and ${(list.figures || []).length} figure(s).`
    ),
    confirmLabel: t("action.delete"),
    danger: true
  });
  if (!confirmed) {
    return;
  }

  const pointIds = new Set(list.points.map((point) => point.id));
  const lineIds = new Set((list.lines || []).map((line) => line.id));
  const figureIds = new Set((list.figures || []).map((figure) => figure.id));
  state.pointLists = state.pointLists.filter((item) => item.id !== listId);
  ensurePointLists();
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  state.selection = state.selection.filter((entry) => (
    (entry.type !== "point" || !pointIds.has(entry.id))
    && (entry.type !== "link" || !lineIds.has(entry.id))
    && (entry.type !== "figure" || !figureIds.has(entry.id))
  ));
  normalizeSelection();
  persistWorkspace();
  render();
}

function renderRoute() {
  normalizeRouteSelection();
  const selectedPoints = selectedPointIds().map(findPoint).filter(Boolean);
  const resultPoints = routeResultPoints();
  const routePlan = routePlanFromCurrentSelection();
  const start = routePlan?.start ?? routeStartPoint();
  elements.routeSelectedCount.textContent = selectedPoints.length > 0 ? `${selectedPoints.length}点` : `${resultPoints.length}点`;
  elements.routeStartSelect.replaceChildren();

  const option = document.createElement("option");
  option.value = start?.id ?? "";
  option.textContent = start?.title ?? "未指定";
  elements.routeStartSelect.append(option);
  elements.routeStartSelect.disabled = true;
  elements.routeReturnToStart.disabled = !routePlan;
  elements.routeReturnToStart.checked = state.routeReturnToStart;
  elements.computeRouteButton.disabled = !routePlan;
  elements.clearRouteSelectionButton.disabled = !state.routeResult;
  elements.routeList.replaceChildren();

  if (state.routeResult) {
    renderRouteResultDetails();
    return;
  }

  if (!start) {
    elements.routeSummary.textContent = t("route.needStart");
    return;
  }

  elements.routeSummary.textContent = selectedPoints.length < 2
    ? "2点以上を選択すると巡回を実行"
    : "巡回で最適順を計算";
}
function renderRouteResultDetails() {
  if (!state.routeResult) {
    return;
  }

  const method = state.routeResult.exact ? t("route.exact") : t("route.heuristic");
  const returnLabel = state.routeResult.returnToStart ? ` | ${t("route.return")}` : "";
  elements.routeSummary.textContent = `${method} | ${state.routeResult.pointIds.length}${t("label.points")}${returnLabel} | ${t("route.total")} ${formatDistance(state.routeResult.totalDistance)}`;

  const routePoints = routeResultPoints();
  routePoints.forEach((point, index) => {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "route-step-number";
    number.textContent = String(index);

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const segment = document.createElement("small");
    title.textContent = point.title;
    segment.textContent = index === 0 ? t("route.start") : `${t("route.fromPrevious")} ${formatDistance(state.routeResult.segmentDistances[index - 1])}`;
    text.append(title, segment);

    const cumulative = document.createElement("span");
    cumulative.textContent = index === 0 ? formatDistance(0) : formatDistance(sumDistances(state.routeResult.segmentDistances.slice(0, index)));

    item.append(number, text, cumulative);
    elements.routeList.append(item);
  });

  if (state.routeResult.returnToStart && routePoints.length > 1) {
    const returnDistance = state.routeResult.segmentDistances[routePoints.length - 1];
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "route-step-number route-step-return";
    number.textContent = "戻";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const segment = document.createElement("small");
    title.textContent = `${routePoints.at(-1).title} - ${routePoints[0].title}`;
    segment.textContent = `${t("route.toStart")} ${formatDistance(returnDistance)}`;
    text.append(title, segment);

    const cumulative = document.createElement("span");
    cumulative.textContent = formatDistance(state.routeResult.totalDistance);

    item.append(number, text, cumulative);
    elements.routeList.append(item);
  }
}

function findPoint(id) {
  if (id === CURRENT_LOCATION_ID) {
    return currentLocationPoint();
  }
  // The point index can intentionally show a hidden list. Selection and
  // information actions must still resolve those points even though they are
  // excluded from the map's visible point projection.
  return findPointIn(id, allPointListPoints()) ?? syncProjectedPoint(findCloudPointAny(id));
}

function findPointIn(id, points) {
  return points.find((point) => point.id === id) ?? null;
}

function findLink(id) {
  return state.links.find((link) => link.id === id) ?? null;
}

function findFigure(id) {
  return state.figures.find((figure) => figure.id === id) ?? null;
}

function linkEndpoints(link) {
  const a = linkEndpoint(link, "a");
  const b = linkEndpoint(link, "b");
  return a && b ? { a, b } : null;
}

function endpointPairKey(a, b) {
  const keys = [
    a?.key || a?.endpointKey || canonicalEndpointKey(a),
    b?.key || b?.endpointKey || canonicalEndpointKey(b)
  ];
  return keys.every(Boolean) ? keys.sort().join("\u0000") : "";
}

function figureIdsMatchingSelectedGeometry(linkIds, pointIds) {
  const selectedLinkKeys = new Set(
    linkIds.map(findLink).filter(Boolean).map((link) => {
      const endpoints = linkEndpoints(link);
      return endpoints ? endpointPairKey(endpoints.a, endpoints.b) : "";
    }).filter(Boolean)
  );
  if (selectedLinkKeys.size === 0) return [];

  const selectedPointKeys = new Set(
    pointIds.map(findPoint).filter((point) => point && validGeo(point.geo))
      .map((point) => canonicalEndpointKey(point.geo))
  );

  return state.figures
    .filter((figure) => {
      const edges = figureEdges(figure);
      const edgeKeys = edges.map((edge) => endpointPairKey(edge.a, edge.b)).filter(Boolean);
      if (edgeKeys.length < 3 || edgeKeys.length !== selectedLinkKeys.size) return false;
      if (!edgeKeys.every((key) => selectedLinkKeys.has(key))) return false;
      if (selectedPointKeys.size === 0) return true;
      return figure.vertices.every((vertex) => selectedPointKeys.has(vertex.key || canonicalEndpointKey(vertex)));
    })
    .map((figure) => figure.id);
}

function captureLineEndpoint(point) {
  if (!point || !validGeo(point.geo)) {
    return null;
  }

  const geo = normalizeGeo(point.geo);
  return normalizeAnalysisVertex({
    lat: geo.lat,
    lng: geo.lng,
    name: typeof point.title === "string" ? point.title : "Point",
    placeRef: typeof point.id === "string" ? point.id : null
  });
}

function canonicalEndpointKey(geo) {
  if (!validGeo(geo)) return "";
  return `geo:${geo.lat}:${geo.lng}`;
}

function remapPointIdInLinks(previousId, nextId) {
  if (!previousId || !nextId || previousId === nextId) return;
  for (const link of state.links) {
    for (const side of ["a", "b"]) {
      if (link[side]?.placeRef === previousId) link[side].placeRef = nextId;
    }
  }
  for (const figure of state.figures) {
    if (figure.layer === "barrier" || figure.barrierId) continue;
    for (const vertex of figure.vertices) {
      if (vertex.placeRef === previousId) vertex.placeRef = nextId;
    }
  }
}

function linkEndpoint(link, side) {
  return endpointSnapshotForLink(link, side);
}

function endpointSnapshotForLink(link, side) {
  const direct = link?.[side];
  const snapshot = normalizeAnalysisVertex(direct);
  if (!snapshot) return null;
  const geo = { lat: snapshot.lat, lng: snapshot.lng };
  return {
    ...snapshot,
    id: snapshot.placeRef || "",
    title: snapshot.name,
    geo,
    endpointKey: snapshot.key,
    ...projectLatLng(snapshot.lat, snapshot.lng)
  };
}

function normalizeStoredLink(link) {
  return normalizeAnalysisLine(link);
}

function lineEndpointPlaceRef(link, side) {
  return analysisVertexPlaceRef(link?.[side]);
}

function createStoredLink({ id = createId(), aPoint, bPoint, strokeId = "", color = "", createdAt = new Date().toISOString(), updatedAt = "" } = {}) {
  const a = captureLineEndpoint(aPoint);
  const b = captureLineEndpoint(bPoint);
  return createAnalysisLine({
    id,
    a,
    b,
    strokeId,
    color,
    createdAt,
    updatedAt
  });
}

function createStoredFigure({ id = createId(), points = [], name = "", color = "", createdAt = new Date().toISOString() } = {}) {
  const vertices = points.map(captureLineEndpoint).filter(Boolean);
  return createAnalysisFigure({ id, vertices, name, color, createdAt });
}

function linkTitle(link) {
  const endpoints = linkEndpoints(link);
  return endpoints ? `${endpoints.a.title} - ${endpoints.b.title}` : "線";
}

function linkStrokeId(link) {
  return typeof link?.strokeId === "string" && link.strokeId ? link.strokeId : null;
}

function linksInStroke(linkOrId) {
  const link = typeof linkOrId === "string" ? findLink(linkOrId) : linkOrId;
  if (!link) return [];
  const strokeId = linkStrokeId(link);
  return strokeId
    ? state.links.filter((candidate) => linkStrokeId(candidate) === strokeId)
    : [link];
}

function splitDisconnectedStrokeGroups() {
  const groupedLinks = new Map();
  for (const link of state.links) {
    const strokeId = linkStrokeId(link);
    if (!strokeId) continue;
    const group = groupedLinks.get(strokeId) || [];
    group.push(link);
    groupedLinks.set(strokeId, group);
  }

  let changed = false;
  for (const links of groupedLinks.values()) {
    if (links.length < 2) continue;

    const remaining = new Set(links);
    const components = [];
    while (remaining.size > 0) {
      const component = [];
      const queue = [remaining.values().next().value];
      remaining.delete(queue[0]);
      while (queue.length > 0) {
        const current = queue.shift();
        component.push(current);
        const currentEndpoints = new Set(["a", "b"]
          .map((side) => linkEndpointIdentityKey(current, side))
          .filter(Boolean));
        for (const candidate of [...remaining]) {
          const candidateEndpoints = ["a", "b"].map((side) => linkEndpointIdentityKey(candidate, side));
          if (!candidateEndpoints.some((endpoint) => currentEndpoints.has(endpoint))) continue;
          remaining.delete(candidate);
          queue.push(candidate);
        }
      }
      components.push(component);
    }

    if (components.length < 2) continue;
    for (const component of components.slice(1)) {
      const nextStrokeId = createId();
      for (const link of component) {
        link.strokeId = nextStrokeId;
      }
      changed = true;
    }
  }
  return changed;
}

function selectionKey(type, id) {
  return `${type}:${id}`;
}

function isValidSelectionEntry(entry) {
  if (!entry || typeof entry.id !== "string") {
    return false;
  }

  if (entry.type === "point") {
    return Boolean(findPoint(entry.id));
  }

  if (entry.type === "link") {
    const link = findLink(entry.id);
    return Boolean(link);
  }

  if (entry.type === "figure") {
    return Boolean(findFigure(entry.id));
  }

  if (entry.type === "observation") {
    return Boolean(findLoadedObservation(entry.id));
  }

  return false;
}

function normalizeSelection(options = {}) {
  const unique = [];
  const seen = new Set();

  for (const entry of state.selection) {
    if (!isValidSelectionEntry(entry)) {
      continue;
    }

    const key = selectionKey(entry.type, entry.id);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push({ type: entry.type, id: entry.id });
  }

  const expanded = [...unique];
  const expandedKeys = new Set(unique.map((entry) => selectionKey(entry.type, entry.id)));
  if (options.expandLinkGroups !== false) {
    for (const entry of unique) {
      if (entry.type !== "link") continue;
      for (const link of linksInStroke(entry.id)) {
        const key = selectionKey("link", link.id);
        if (expandedKeys.has(key)) continue;
        expandedKeys.add(key);
        expanded.push({ type: "link", id: link.id });
      }
    }
  }

  state.selection = expanded;
  const primary = primarySelection();
  state.selectedPointId = primary?.type === "point" ? primary.id : null;
  state.selectedLinkId = primary?.type === "link" ? primary.id : null;
  state.selectedFigureId = primary?.type === "figure" ? primary.id : null;
}

function primarySelection() {
  return state.selection.at(-1) ?? null;
}

function selectionTitle(entry) {
  if (entry.type === "point") {
    return findPoint(entry.id)?.title ?? "地点";
  }

  if (entry.type === "observation") {
    return loadedObservationTitle(findLoadedObservation(entry.id));
  }

  if (entry.type === "figure") {
    const figure = findFigure(entry.id);
    return figure?.name || `${t("analysis.figure")} ${figure?.vertices.length || ""}`.trim();
  }

  const link = findLink(entry.id);
  return link ? linkTitle(link) : "線";
}

function selectedPointIds() {
  return state.selection.filter((entry) => entry.type === "point" && findPoint(entry.id)).map((entry) => entry.id);
}

function selectedLinkIds() {
  return state.selection.filter((entry) => {
    if (entry.type !== "link") {
      return false;
    }
    const link = findLink(entry.id);
    return Boolean(link);
  }).map((entry) => entry.id);
}

function selectedFigureIds() {
  return state.selection.filter((entry) => entry.type === "figure" && findFigure(entry.id)).map((entry) => entry.id);
}

function selectedObservationIds() {
  return state.selection.filter((entry) => entry.type === "observation" && findLoadedObservation(entry.id)).map((entry) => entry.id);
}

function selectedLoadedObservations() {
  return selectedObservationIds().map(findLoadedObservation).filter(Boolean);
}

function selectedCounts() {
  const point = selectedPointIds().length;
  const link = selectedLinkIds().length;
  const figure = selectedFigureIds().length;
  const observation = selectedObservationIds().length;
  return { point, link, figure, observation, total: point + link + figure + observation };
}

function editableSelectedPoint() {
  const pointIds = selectedPointIds().filter((id) => id !== CURRENT_LOCATION_ID);
  if (pointIds.length !== 1 || selectedCounts().total !== 1) return null;
  const pointId = pointIds[0];
  return pointEditable(pointId) ? findPointAny(pointId) : null;
}

function mapPointForSelection() {
  const primary = primarySelection();
  const selectedPoint = mapPointForSelectionEntry(primary);
  if (selectedPoint) return selectedPoint;

  const barrier = mapPointForSelectedBarrier();
  if (barrier) return barrier;

  if (state.barrierSelection.length > 0) {
    const vertices = state.barrierSelection
      .map((stoneId) => tileCenterGeo(state.traverseLog?.stones?.[stoneId]?.tile))
      .filter(validGeo);
    const center = mapCenterPoint(t("barrier.selection").replace("{count}", String(vertices.length)), vertices, "barrier-cells");
    if (center) return center;
  }

  if (!validGeo(state.pendingGeo)) {
    return null;
  }

  return {
    id: "__pending_point__",
    title: elements.pointTitle.value.trim() || "仮ポイント",
    geo: normalizeGeo(state.pendingGeo),
    isPending: true,
    isVirtual: true
  };
}

function externalMapPointsForSelection() {
  const selectedPoints = state.selection.map(mapPointForSelectionEntry).filter(Boolean);
  if (selectedPoints.length > 0) return selectedPoints;

  const barrier = mapPointForSelectedBarrier();
  if (barrier) return [barrier];

  const stones = state.barrierSelection
    .map((stoneId, index) => {
      const geo = tileCenterGeo(state.traverseLog?.stones?.[stoneId]?.tile);
      return validGeo(geo)
        ? { id: `__barrier_stone_${stoneId}__`, title: `結界石 ${index + 1}`, geo, isVirtual: true }
        : null;
    })
    .filter(Boolean);
  if (stones.length > 0) return stones;

  const point = mapPointForSelection();
  return point ? [point] : [];
}

function mapPointForSelectionEntry(entry) {
  if (entry?.type === "point") return findPoint(entry.id);
  if (entry?.type !== "figure") return null;

  const figure = findFigure(entry.id);
  return mapCenterPoint(
    figure?.name || `${t("analysis.figure")} ${figure?.vertices.length || ""}`.trim(),
    figure?.vertices,
    `figure_${entry.id}`
  );
}

function mapPointForSelectedBarrier() {
  const barrier = state.selectedBarrierId
    ? state.traverseLog?.barriers?.[state.selectedBarrierId]
    : null;
  if (!barrier) return null;

  const figure = barrierFigureForId(state.selectedBarrierId);
  const vertices = figure?.vertices?.length
    ? figure.vertices
    : barrierStoneIds(barrier)
      .map((stoneId) => tileCenterGeo(state.traverseLog?.stones?.[stoneId]?.tile))
      .filter(validGeo);
  return mapCenterPoint(barrier.name || t("barrier.defaultName"), vertices, "barrier");
}

function mapCenterPoint(title, points, id) {
  const centerPoints = Array.isArray(points)
    ? points.map((point) => validGeo(point) ? { geo: point } : point)
    : [];
  const geo = geographicCenter(centerPoints);
  if (!geo) return null;
  return {
    id: `__map_center_${id}__`,
    title,
    geo,
    isCenter: true,
    isVirtual: true
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createObservationId() {
  return `${LOADED_OBSERVATION_PREFIX}-${createId()}`;
}

function withObservationId(observation, existingIds = new Set()) {
  const next = clonePlain(observation);
  let id = typeof next.id === "string" && next.id ? next.id : createObservationId();
  while (existingIds.has(id)) {
    id = createObservationId();
  }
  next.id = id;
  existingIds.add(id);
  return next;
}

function findLoadedObservation(id) {
  return state.loadedObservations.find((observation) => observation.id === id) ?? null;
}

function defaultMapProvider() {
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ? MAP_PROVIDER_APPLE : MAP_PROVIDER_GOOGLE;
}

function preferredMapProvider() {
  return state.mapProvider;
}

function isPointSelected(pointId) {
  return state.selection.some((entry) => entry.type === "point" && entry.id === pointId);
}

function isLinkSelected(linkId) {
  return state.selection.some((entry) => entry.type === "link" && entry.id === linkId);
}

function isFigureSelected(figureId) {
  return state.selection.some((entry) => entry.type === "figure" && entry.id === figureId);
}

function isLoadedObservationSelected(id) {
  if (id) {
    return state.selection.some((entry) => entry.type === "observation" && entry.id === id && findLoadedObservation(id));
  }

  return selectedObservationIds().length > 0;
}

function selectedObservation() {
  for (let index = state.selection.length - 1; index >= 0; index -= 1) {
    const entry = state.selection[index];
    if (entry.type === "observation") {
      const observation = findLoadedObservation(entry.id);
      if (observation) {
        return observation;
      }
    }
  }

  return null;
}

function selectedPoint() {
  const primary = primarySelection();
  return primary?.type === "point" ? findPoint(primary.id) : null;
}

function singleSelectedPoint() {
  const counts = selectedCounts();
  if (counts.total !== 1 || counts.point !== 1) {
    return null;
  }

  const entry = state.selection[0];
  return entry?.type === "point" ? findPoint(entry.id) : null;
}

function singleTargetableSelectedPoint() {
  const point = singleSelectedPoint();
  return point && !point.isVirtual ? point : null;
}

function lastSelectedPoint() {
  for (let index = state.selection.length - 1; index >= 0; index -= 1) {
    const entry = state.selection[index];
    if (entry.type === "point") {
      const point = findPoint(entry.id);
      if (point) {
        return point;
      }
    }
  }

  return null;
}

function lastTargetableSelectedPoint() {
  for (let index = state.selection.length - 1; index >= 0; index -= 1) {
    const entry = state.selection[index];
    if (entry.type !== "point") {
      continue;
    }

    const point = findPoint(entry.id);
    if (point && !point.isVirtual) {
      return point;
    }
  }

  return null;
}

function selectedLink() {
  const primary = primarySelection();
  return primary?.type === "link" ? findLink(primary.id) : null;
}

function setSelection(entries, options = {}) {
  state.selection = entries;
  normalizeSelection({ expandLinkGroups: options.expandLinkGroups });

  if (options.clearPending !== false) {
    state.pendingGeo = null;
  }

  state.pendingLinkPointId = null;
  state.editingPointId = null;

  if (options.render !== false) {
    render();
  }
}

function toggleSelection(type, id) {
  if (type === "link") {
    const groupIds = new Set(linksInStroke(id).map((link) => link.id));
    const groupIsSelected = state.selection.some((entry) => entry.type === "link" && groupIds.has(entry.id));
    const next = groupIsSelected
      ? state.selection.filter((entry) => entry.type !== "link" || !groupIds.has(entry.id))
      : [
        ...state.selection.filter((entry) => entry.type !== "link" || !groupIds.has(entry.id)),
        ...[...groupIds].map((linkId) => ({ type: "link", id: linkId }))
      ];
    state.mode = "inspect";
    setSelection(next);
    return;
  }

  const key = selectionKey(type, id);
  const exists = state.selection.some((entry) => selectionKey(entry.type, entry.id) === key);
  const next = exists
    ? state.selection.filter((entry) => selectionKey(entry.type, entry.id) !== key)
    : [...state.selection, { type, id }];

  state.mode = "inspect";
  setSelection(next);
}

function invertVisiblePointSelection() {
  const visiblePointIds = [...new Set(visibleSelectablePoints().map((point) => point.id))];
  if (visiblePointIds.length === 0) return;

  const selectedIds = new Set(selectedPointIds());
  const nextPointSelection = visiblePointIds
    .filter((id) => !selectedIds.has(id))
    .map((id) => ({ type: "point", id }));
  const nonPointSelection = state.selection.filter((entry) => entry.type !== "point");

  state.mode = "inspect";
  setSelection([...nonPointSelection, ...nextPointSelection]);
}

function clearSelection(options = {}) {
  state.mode = "inspect";
  if (state.barrierLinkPreview) resetBarrierLinkState();
  state.barrierLinkSourceSelection = [];
  state.selection = [];
  state.barrierSelection = [];
  state.selectedBarrierId = null;
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.editingPointId = null;
  state.routeSelectionIds = [];

  if (options.clearPending !== false) {
    state.pendingGeo = null;
  }

  if (options.render !== false) {
    render();
  }
}

function setAllStorageListsVisible(visible) {
  const entries = storageListEntries();
  let changed = false;

  for (const entry of entries) {
    if (!visible && storageListIsPointRegistrationDestination(entry)) continue;

    if (entry.local && entry.local.visible !== visible) {
      entry.local.visible = visible;
      entry.local.updatedAt = new Date().toISOString();
      changed = true;
    }

    if (entry.cloud && !entry.local) {
      const cloudId = entry.cloud.id || entry.preview?.cloudId || entry.preview?.id;
      if (cloudId) {
        if (visible) {
          changed = state.cloud.hiddenListIds.delete(cloudId) || changed;
        } else if (!state.cloud.hiddenListIds.has(cloudId)) {
          state.cloud.hiddenListIds.add(cloudId);
          changed = true;
        }
      }
    }
  }

  if (!changed) return;
  refreshVisiblePoints();
  if (!visible) pruneHiddenPointReferences();
  persistWorkspace();
  render();
}

function removeSelectionEntry(type, id) {
  state.selection = state.selection.filter((entry) => !(entry.type === type && entry.id === id));
  normalizeSelection();
}

function selectedPointPair() {
  const ids = selectedPointIds();
  return ids.length === 2 ? ids : null;
}

function selectedPointIdsMatchRoute(ids) {
  return ids.length > 0
    && ids.length === state.routeSelectionIds.length
    && ids.every((id, index) => state.routeSelectionIds[index] === id);
}

function routeStartInSelection() {
  return state.routeSelectionIds.includes(state.routeStartPointId) ? state.routeStartPointId : null;
}

function effectiveRouteStartPointId() {
  return routeStartInSelection() ?? state.routeSelectionIds[0] ?? null;
}

function routePlanFromCurrentSelection() {
  const selectedPoints = selectedPointIds().map(findPoint).filter(Boolean);
  const start = routeStartPoint() ?? (selectedPoints.length >= 3 ? selectedPoints[0] : null);
  if (!start || selectedPoints.length < 2) {
    return null;
  }

  const points = [];
  const seen = new Set();
  for (const point of [start, ...selectedPoints]) {
    if (!point || seen.has(point.id)) {
      continue;
    }
    seen.add(point.id);
    points.push(point);
  }

  return points.length >= 2 ? { start, points } : null;
}

function findLinkBetween(a, b, list = activeAnalysisPointList()) {
  const pair = [pointEndpointIdentityKey(a), pointEndpointIdentityKey(b)].sort().join("\u0000");
  return (Array.isArray(list?.lines) ? list.lines : [])
    .find((link) => linkEndpointPairKey(link) === pair) ?? null;
}

function pointEndpointIdentityKey(pointId) {
  const point = findPoint(pointId);
  return point && validGeo(point.geo) ? canonicalEndpointKey(point.geo) : `id:${pointId}`;
}

function linkEndpointIdentityKey(link, side) {
  return analysisLineEndpointIdentityKey(link, side);
}

function linkEndpointPairKey(link) {
  return [linkEndpointIdentityKey(link, "a"), linkEndpointIdentityKey(link, "b")].sort().join("\u0000");
}

function setRouteFromSelectedPoints() {
  if (state.routeResult) {
    state.routeResult = null;
    render();
    return;
  }

  const plan = routePlanFromCurrentSelection();
  if (!plan) {
    return;
  }

  state.mode = "inspect";
  state.pendingLinkPointId = null;
  state.routeSelectionIds = [];
  state.routeResult = optimizeVisitOrder(plan.points, plan.start.id, state.routeReturnToStart);
  setSelection([], { render: false });
  render();
}

async function setRouteStartForPoint(point, options = {}) {
  if (!point) {
    return;
  }
  const preserveSelection = options.preserveSelection === true;

  if (state.routeStartPointId === point.id) {
    if (!await confirmObservationReset("起点を解除")) {
      return;
    }
    clearRouteStartState();
    if (!preserveSelection) setSelection([], { render: false });
    render();
    return;
  }

  const target = targetPoint();
  const switchesFromTarget = Boolean(target && !observationEndpointsDistinct(point, target));
  const changesRouteStart = Boolean(state.routeStartPointId && state.routeStartPointId !== point.id);
  if ((switchesFromTarget || changesRouteStart) && !await confirmObservationReset(switchesFromTarget ? "対象から起点へ切り替え" : "起点を変更")) {
    return;
  }

  if (switchesFromTarget) {
    clearTarget({ render: false });
  }

  resetObservationTrail();
  state.routeStartPointId = point.id;
  updateRouteStartSnapshot(point);
  if (!preserveSelection) setSelection([], { render: false });
  render();
}
function hideGridPointHover() {
  state.gridPointHoverPointId = null;
  if (!elements.gridPointHoverLabel) return;
  elements.gridPointHoverLabel.hidden = true;
  elements.gridPointHoverLabel.textContent = "";
}

function updateGridPointHover(screenPoint, pointerType = "mouse") {
  if (
    pointerType !== "mouse"
    || state.pointer.active.size > 0
    || state.gridPointQuickPointId
    || !elements.gridPointHoverLabel
  ) {
    hideGridPointHover();
    return;
  }

  const point = findNearestPoint(screenPoint);
  if (!point) {
    hideGridPointHover();
    return;
  }

  const stage = canvas.parentElement;
  if (!stage) return;
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const screen = worldToScreen(point);
  const x = screen.x + canvasRect.left - stageRect.left;
  const y = screen.y + canvasRect.top - stageRect.top;

  state.gridPointHoverPointId = point.id;
  elements.gridPointHoverLabel.hidden = false;
  elements.gridPointHoverLabel.textContent = point.title;
  elements.gridPointHoverLabel.style.left = `${x}px`;
  elements.gridPointHoverLabel.style.top = `${Math.max(4, y - 8)}px`;
}

function findNearestPoint(screenPoint, options = {}) {
  let nearest = null;
  let nearestDistance = Infinity;
  const excludedIds = new Set(Array.isArray(options.excludeIds) ? options.excludeIds : []);
  const candidates = visibleSelectablePoints();
  const current = options.includeCurrent === false ? null : currentLocationPoint();

  if (current) {
    candidates.push(current);
  }

  for (const point of candidates) {
    if (excludedIds.has(point.id)) continue;
    const screen = worldToScreen(point);
    const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= POINT_RADIUS + 12 ? nearest : null;
}

function findNearestBarrierStone(screenPoint, options = {}) {
  if (!state.traverseMode || !state.traverseLog) return null;
  const availableOnly = options.availableOnly === true || state.barrierLinkingMode;
  const roomStoneIds = state.barrierLinkPreview
    ? new Set(state.barrierLinkSourceSelection.length > 0
      ? state.barrierLinkSourceSelection
      : state.barrierSelection)
    : null;
  const availableStoneIds = availableOnly
    ? (roomStoneIds || new Set(availableBarrierStoneIds()))
    : null;
  let nearestInside = null;
  let nearestInsideDistance = Infinity;
  let nearestCenter = null;
  let nearestCenterDistance = Infinity;
  for (const [stoneId, stone] of Object.entries(state.traverseLog?.stones || {})) {
    if (stoneDisplayCount(stone) <= 0) continue;
    if (availableStoneIds && !availableStoneIds.has(stoneId)) continue;
    const polygon = displayedTraverseTilePolygon(stone.tile);
    const center = barrierStoneScreenCenter(stoneId);
    if (!center) continue;
    const distance = Math.hypot(center.x - screenPoint.x, center.y - screenPoint.y);
    const diagonal = polygon && polygon.length > 2
      ? Math.hypot(polygon[2].x - polygon[0].x, polygon[2].y - polygon[0].y)
      : 0;
    const hitRadius = Math.max(POINT_RADIUS + 12, BARRIER_TILE_MIN_SCREEN_SIZE, diagonal * 0.42);
    if (polygon && pointInPolygon(screenPoint, polygon) && distance < nearestInsideDistance) {
      nearestInside = { stoneId, stone };
      nearestInsideDistance = distance;
    }
    if (distance <= hitRadius && distance < nearestCenterDistance) {
      nearestCenter = { stoneId, stone };
      nearestCenterDistance = distance;
    }
  }
  return nearestInside || nearestCenter;
}

function resolveDragEndpoint(screenPoint, kind, options = {}) {
  if (kind === "barrier") return findNearestBarrierStone(screenPoint, options);
  return findNearestPoint(screenPoint, options);
}

function barrierLinkPointWithinReleaseTolerance(stoneId, point) {
  const center = barrierStoneScreenCenter(stoneId);
  if (!center || !point) return false;
  const stone = state.traverseLog?.stones?.[stoneId];
  const polygon = stone ? displayedTraverseTilePolygon(stone.tile) : null;
  const diagonal = polygon && polygon.length > 2
    ? Math.hypot(polygon[2].x - polygon[0].x, polygon[2].y - polygon[0].y)
    : 0;
  const tolerance = Math.max(
    BARRIER_LINK_RELEASE_DRIFT_TOLERANCE,
    Math.min(52, diagonal * 0.5)
  );
  return Math.hypot(center.x - point.x, center.y - point.y) <= tolerance;
}

function clearBarrierLinkHoldVisual() {
  if (state.barrierLinkHoldFrameId !== null) {
    window.cancelAnimationFrame(state.barrierLinkHoldFrameId);
  }
  state.barrierLinkHoldFrameId = null;
  state.barrierLinkPendingStartedAt = null;
  state.barrierLinkPendingDurationMs = null;
  state.barrierLinkPendingStoneId = null;
}

function clearBarrierLinkCandidateTimer(drag) {
  if (drag?.barrierLinkCandidateTimerId) {
    window.clearTimeout(drag.barrierLinkCandidateTimerId);
  }
  if (drag) {
    drag.barrierLinkCandidateTimerId = null;
    drag.barrierLinkPendingStoneId = null;
  }
  clearBarrierLinkHoldVisual();
}

function rememberBarrierLinkDiamond(stoneId) {
  if (!stoneId || state.barrierLinkSettledDiamonds.some((entry) => entry.stoneId === stoneId)) return;
  state.barrierLinkSettledDiamonds.push({
    stoneId,
    rotation: 0
  });
}

function runBarrierLinkDiamondAnimations() {
  state.barrierLinkDiamondFrameId = null;
  const now = performance.now();
  const remaining = [];
  for (const entry of state.barrierLinkDiamondAnimations) {
    if (now - entry.startedAt >= BARRIER_LINK_DIAMOND_MS) {
      rememberBarrierLinkDiamond(entry.stoneId);
    } else {
      remaining.push(entry);
    }
  }
  state.barrierLinkDiamondAnimations = remaining;
  draw();
  if (remaining.length > 0) {
    state.barrierLinkDiamondFrameId = window.requestAnimationFrame(runBarrierLinkDiamondAnimations);
  }
}

function startBarrierLinkDiamond(stoneId) {
  if (!stoneId) return;
  if (state.barrierLinkSettledDiamonds.some((entry) => entry.stoneId === stoneId)) return;
  if (state.barrierLinkDiamondAnimations.some((entry) => entry.stoneId === stoneId)) return;
  state.barrierLinkDiamondAnimations.push({ stoneId, startedAt: performance.now() });
  if (state.barrierLinkDiamondFrameId === null) {
    state.barrierLinkDiamondFrameId = window.requestAnimationFrame(runBarrierLinkDiamondAnimations);
  }
  draw();
}

function settleBarrierLinkDiamondAnimations() {
  for (const entry of state.barrierLinkDiamondAnimations) {
    rememberBarrierLinkDiamond(entry.stoneId);
  }
  state.barrierLinkDiamondAnimations = [];
  if (state.barrierLinkDiamondFrameId !== null) {
    window.cancelAnimationFrame(state.barrierLinkDiamondFrameId);
  }
  state.barrierLinkDiamondFrameId = null;
}

function finishBarrierLinkCompletion() {
  const completion = state.barrierLinkCompletion;
  if (!completion) return;
  settleBarrierLinkDiamondAnimations();
  const vertices = [...completion.path];
  state.barrierLinkCompletion = null;
  state.barrierLinkPreview = true;
  state.barrierLinkingMode = false;
  state.barrierLinkPath = [];
  state.barrierSelection = vertices;
  canvas.classList.remove("is-barrier-linking");
  render();
  void createBarrierFromSelection();
}

function animateBarrierLinkCompletion(vertices) {
  clearBarrierLinkHoldVisual();
  state.barrierLinkCompletion = {
    path: [...vertices],
    startedAt: performance.now()
  };
  state.barrierLinkPreview = true;
  state.barrierLinkingMode = false;
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPendingStoneId = null;
  canvas.classList.remove("is-barrier-linking");
  render();

  const tick = () => {
    if (!state.barrierLinkCompletion) return;
    draw();
    if (performance.now() - state.barrierLinkCompletion.startedAt < BARRIER_LINK_COMPLETION_MS) {
      window.requestAnimationFrame(tick);
      return;
    }
    finishBarrierLinkCompletion();
  };
  window.requestAnimationFrame(tick);
}

function scheduleBarrierLinkCandidate(drag, stoneId) {
  if (!drag?.barrierLinkStarted || !stoneId) return;
  if (stoneId === drag.barrierLinkOriginStoneId && state.barrierLinkPath.length >= 3) {
    clearBarrierLinkCandidateTimer(drag);
    drag.barrierLinkClosing = true;
    state.barrierLinkCandidateStoneId = stoneId;
    state.barrierLinkPendingStoneId = null;
    draw();
    return;
  }
  if (state.barrierLinkPath.includes(stoneId)) {
    state.barrierLinkCandidateStoneId = stoneId;
    draw();
    return;
  }
  clearBarrierLinkCandidateTimer(drag);
  drag.barrierLinkCandidateStoneId = stoneId;
  drag.barrierLinkClosing = false;
  state.barrierLinkPath.push(stoneId);
  state.barrierSelection = [...state.barrierLinkPath];
  startBarrierLinkDiamond(stoneId);
  state.barrierLinkCandidateStoneId = stoneId;
  draw();
}

function updateBarrierLinkGesture(drag, point) {
  drag.last = point;
  const nearest = resolveDragEndpoint(point, "barrier");
  const stoneId = nearest?.stoneId || null;
  if (!stoneId) {
    clearBarrierLinkCandidateTimer(drag);
    drag.barrierLinkPendingStoneId = null;
    drag.barrierLinkClosing = false;
    state.barrierLinkCandidateStoneId = null;
    state.barrierLinkPendingStoneId = null;
    draw();
    return;
  }
  scheduleBarrierLinkCandidate(drag, stoneId);
}

function resumeBarrierLinkRoom() {
  const sourceSelection = [...state.barrierLinkSourceSelection];
  if (!state.traverseMode || sourceSelection.length < 2) return false;
  if (state.barrierLinkErrorTimerId !== null) {
    window.clearTimeout(state.barrierLinkErrorTimerId);
  }
  state.barrierLinkErrorTimerId = null;
  state.barrierLinkError = null;
  clearBarrierLinkHoldVisual();
  state.barrierLinkPreview = true;
  state.barrierLinkingMode = true;
  state.barrierLinkPath = [];
  state.barrierSelection = sourceSelection;
  state.barrierLinkSettledDiamonds = [];
  state.barrierLinkDiamondAnimations = [];
  if (state.barrierLinkDiamondFrameId !== null) {
    window.cancelAnimationFrame(state.barrierLinkDiamondFrameId);
  }
  state.barrierLinkDiamondFrameId = null;
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPendingStoneId = null;
  state.barrierLinkCompletion = null;
  canvas.classList.add("is-barrier-linking");
  fitBarrierPlacementView({ linkOnly: true, selectedOnly: true, room: true });
  render();
  return true;
}

function finishBarrierLinkGesture(drag, point, allowTap) {
  clearBarrierLinkCandidateTimer(drag);
  const path = [...state.barrierLinkPath];
  const origin = drag?.barrierLinkOriginStoneId;
  const nearest = resolveDragEndpoint(point, "barrier")?.stoneId;
  const releasePoints = [point, drag?.last].filter(Boolean);
  const releasedNearOrigin = origin
    && path.length >= 3
    && (nearest === origin || releasePoints.some((releasePoint) => (
      barrierLinkPointWithinReleaseTolerance(origin, releasePoint)
    )));
  state.barrierLinkPendingStoneId = null;
  if (!drag?.barrierLinkStarted) {
    state.barrierLinkingMode = false;
    state.barrierLinkCandidateStoneId = null;
    canvas.classList.remove("is-barrier-linking");
    render();
    return;
  }
  if (allowTap && releasedNearOrigin) {
    const completion = validateBarrierCompletion(path);
    if (!completion.ok) {
      rejectBarrierLinkCompletion(completion.message);
      return;
    }
    animateBarrierLinkCompletion(path);
    return;
  }
  if (state.barrierLinkPreview) {
    state.barrierLinkingMode = true;
    state.barrierLinkCandidateStoneId = null;
    state.barrierLinkPath = path;
    state.barrierSelection = path.length > 0 ? path : [...state.barrierLinkSourceSelection];
    canvas.classList.add("is-barrier-linking");
    if (allowTap) showAppToast(t("traverse.linkReturnRequired"), { error: true });
    render();
    return;
  }
  state.barrierLinkingMode = false;
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPath = [];
  state.barrierSelection = [];
  canvas.classList.remove("is-barrier-linking");
  if (allowTap) showAppToast(t("traverse.linkReturnRequired"), { error: true });
  render();
}

function barrierScreenVertices(barrier) {
  return barrierFigureVertices(barrier)
    .map((vertex) => projectLatLng(vertex.lat, vertex.lng))
    .map(worldToScreen);
}

function findNearestBarrier(screenPoint) {
  if (!state.traverseMode || !state.traverseLog) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const [barrierId, barrier] of Object.entries(state.traverseLog.barriers || {})) {
    const vertices = barrierScreenVertices(barrier);
    if (vertices.length < 3) continue;
    const inside = pointInPolygon(screenPoint, vertices);
    let edgeDistance = Infinity;
    for (let index = 0; index < vertices.length; index += 1) {
      edgeDistance = Math.min(edgeDistance, distanceToSegment(
        screenPoint,
        vertices[index],
        vertices[(index + 1) % vertices.length]
      ));
    }
    if (inside || edgeDistance <= 14) {
      const distance = inside ? 0 : edgeDistance;
      if (distance < nearestDistance) {
        nearest = { barrierId, barrier };
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

function pointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;

  // Match CanvasRenderingContext2D.fill(), whose default rule is nonzero.
  // An even-odd ray cast treats the center of self-intersecting figures such
  // as pentagrams as empty even though that region is visibly filled.
  let windingNumber = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const currentPoint = polygon[index];
    const nextPoint = polygon[(index + 1) % polygon.length];
    const cross = (nextPoint.x - currentPoint.x) * (point.y - currentPoint.y)
      - (point.x - currentPoint.x) * (nextPoint.y - currentPoint.y);

    if (currentPoint.y <= point.y) {
      if (nextPoint.y > point.y && cross > 0) windingNumber += 1;
    } else if (nextPoint.y <= point.y && cross < 0) {
      windingNumber -= 1;
    }
  }

  return windingNumber !== 0;
}

function toggleBarrierStoneSelection(stoneId) {
  if (!state.traverseLog?.stones?.[stoneId]) return;
  if (!state.barrierSelection.includes(stoneId) && state.barrierSelection.length >= currentKekkaishiRankInfo().maxVertices) {
    showAppToast(t("barrier.rankVertexLimit"), { duration: 1600 });
    return;
  }
  state.barrierSelection = state.barrierSelection.includes(stoneId)
    ? state.barrierSelection.filter((id) => id !== stoneId)
    : [...state.barrierSelection, stoneId];
  render();
}

function findNearestLink(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const link of state.links.filter(isVisibleAnalysisItem)) {
    const endpoints = linkEndpoints(link);
    if (!endpoints) {
      continue;
    }

    const start = worldToScreen(endpoints.a);
    const end = worldToScreen(endpoints.b);
    const distance = distanceToSegment(screenPoint, start, end);
    if (distance < nearestDistance) {
      nearest = link;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= LINE_SELECTION_HIT_RADIUS ? nearest : null;
}

function findNearestLineEndpoint(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const link of state.links.filter(isVisibleAnalysisItem)) {
    for (const side of ["a", "b"]) {
      const endpoint = linkEndpoint(link, side);
      if (!endpoint) continue;
      const screen = worldToScreen(endpoint);
      const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
      if (distance < nearestDistance) {
        nearest = { link, side };
        nearestDistance = distance;
      }
    }
  }
  return nearestDistance <= POINT_SELECTION_RING_RADIUS + 6 ? nearest : null;
}

function findNearestFigure(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const figure of state.figures.filter(isVisibleAnalysisItem)) {
    if (figure.layer === "barrier" || figure.barrierId) continue;
    const points = figureRuntimeVertices(figure).map(worldToScreen);
    if (points.length < 2) continue;

    let distance = Infinity;
    for (let index = 1; index < points.length; index += 1) {
      distance = Math.min(distance, distanceToSegment(screenPoint, points[index - 1], points[index]));
    }
    if (points.length >= 3) {
      distance = Math.min(distance, distanceToSegment(screenPoint, points.at(-1), points[0]));
      if (pointInPolygon(screenPoint, points)) distance = 0;
    }
    if (distance < nearestDistance) {
      nearest = figure;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= LINE_SELECTION_HIT_RADIUS ? nearest : null;
}

function findNearestFigureEdge(screenPoint, options = {}) {
  const figures = options.selectedOnly === false
    ? state.figures.filter(isVisibleAnalysisItem)
    : state.figures.filter((figure) => isVisibleAnalysisItem(figure) && isFigureSelected(figure.id));
  let nearest = null;
  let nearestDistance = Infinity;

  for (const figure of figures) {
    if (figure.layer === "barrier" || figure.barrierId) continue;
    for (const [edgeIndex, segment] of figureSegments(figure).entries()) {
      const start = worldToScreen(segment.a);
      const end = worldToScreen(segment.b);
      const distance = distanceToSegment(screenPoint, start, end);
      if (distance < nearestDistance) {
        nearest = { figureId: figure.id, edgeIndex };
        nearestDistance = distance;
      }
    }
  }

  return nearestDistance <= LINE_SELECTION_HIT_RADIUS ? nearest : null;
}

function findNearestFigureVertex(screenPoint, options = {}) {
  const figures = options.selectedOnly === false
    ? state.figures.filter(isVisibleAnalysisItem)
    : state.figures.filter((figure) => isVisibleAnalysisItem(figure) && isFigureSelected(figure.id));
  let nearest = null;
  let nearestDistance = Infinity;

  for (const figure of figures) {
    if (figure.layer === "barrier" || figure.barrierId) continue;
    for (const [index, vertex] of figure.vertices.entries()) {
      const runtime = runtimeAnalysisVertex(vertex);
      if (!runtime) continue;
      const point = worldToScreen(runtime);
      const distance = Math.hypot(point.x - screenPoint.x, point.y - screenPoint.y);
      if (distance < nearestDistance) {
        nearest = { figureId: figure.id, vertexIndex: index };
        nearestDistance = distance;
      }
    }
  }

  return nearestDistance <= POINT_SELECTION_RING_RADIUS + 6 ? nearest : null;
}

function lineDragSideAtPoint(link, screenPoint) {
  const endpoints = linkEndpoints(link);
  if (!endpoints) return null;
  const a = worldToScreen(endpoints.a);
  const b = worldToScreen(endpoints.b);
  return Math.hypot(a.x - screenPoint.x, a.y - screenPoint.y)
    <= Math.hypot(b.x - screenPoint.x, b.y - screenPoint.y)
    ? "a"
    : "b";
}

function updateLineDragTarget(drag, screenPoint) {
  if (!drag?.lineDrag) return;
  const lineDrag = drag.lineDrag;
  lineDrag.current = { ...screenPoint };
  const link = findLink(lineDrag.linkId);
  const fixedId = lineEndpointPlaceRef(link, lineDrag.fixedSide);
  const replaceSide = lineDrag.fixedSide === "a" ? "b" : "a";
  const replaceId = lineEndpointPlaceRef(link, replaceSide);
  const candidate = resolveDragEndpoint(screenPoint, "point", {
    excludeIds: [fixedId, replaceId],
    includeCurrent: false
  });
  lineDrag.targetPointId = candidate?.id || null;
}

function beginLineDrag(drag, screenPoint) {
  const candidate = drag?.lineDragCandidate || drag?.longPressLink;
  if (!candidate || drag.lineDrag) return;
  const link = findLink(candidate.id);
  const touchedSide = link ? lineDragSideAtPoint(link, drag.start) : null;
  const fixedSide = touchedSide === "a" ? "b" : touchedSide === "b" ? "a" : null;
  if (!link || !fixedSide) return;

  drag.lineDrag = {
    linkId: link.id,
    fixedSide,
    current: { ...screenPoint },
    targetPointId: null
  };
  canvas.classList.add("is-line-dragging");
  if (elements.gridLinkQuickDialog?.open) elements.gridLinkQuickDialog.close("drag");
  updateLineDragTarget(drag, screenPoint);
  draw();
  renderStatus();
}

function finishLineDrag(lineDrag, screenPoint) {
  canvas.classList.remove("is-line-dragging");
  const link = findLink(lineDrag?.linkId);
  const fixedId = lineEndpointPlaceRef(link, lineDrag?.fixedSide);
  const replaceSide = lineDrag?.fixedSide === "a" ? "b" : "a";
  const replaceId = lineEndpointPlaceRef(link, replaceSide);
  const target = resolveDragEndpoint(screenPoint, "point", {
    excludeIds: [fixedId, replaceId],
    includeCurrent: false
  });
  if (!link || !target) {
    render();
    return;
  }

  if ((fixedId && target.id === fixedId) || (replaceId && target.id === replaceId)) {
    showAppToast(t("line.invalidTarget"), { error: true });
    render();
    return;
  }

  const targetPair = [linkEndpointIdentityKey(link, lineDrag.fixedSide), pointEndpointIdentityKey(target.id)]
    .sort()
    .join("\u0000");
  const duplicate = state.links.find((candidate) => (
    candidate.id !== link.id && linkEndpointPairKey(candidate) === targetPair
  ));
  if (duplicate) {
    showAppToast(t("line.duplicateTarget"), { error: true });
    render();
    return;
  }

  const previous = linkEndpoint(link, replaceSide);
  const targetVertex = captureLineEndpoint(target);
  if (!targetVertex) {
    showAppToast(t("line.invalidTarget"), { error: true });
    render();
    return;
  }
  const next = {
    ...link,
    [replaceSide]: targetVertex,
    updatedAt: new Date().toISOString()
  };
  state.links = state.links.map((candidate) => candidate.id === link.id ? normalizeStoredLink(next) : candidate);
  splitDisconnectedStrokeGroups();
  persistWorkspace();
  selectLink(link.id, { expandLinkGroups: false });
  showAppToast(t("line.reconnected")
    .replace("{old}", previous?.title || "線")
    .replace("{new}", target.title));
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}
function distanceBetween(a, b) {
  return vincentyDistanceMeters(pointGeo(a), pointGeo(b));
}

function formatDistance(distance) {
  if (!Number.isFinite(distance) || distance < 0) {
    return "-";
  }

  if (state.distanceUnit === IMPERIAL_UNIT) {
    const feet = distance * 3.280839895;
    if (distance < 1609.344) {
      return `${Math.round(feet).toLocaleString(localeName())} ft`;
    }

    const miles = distance / 1609.344;
    if (distance < 1609344) {
      return `${miles.toFixed(2)} mi`;
    }

    return `${Math.round(miles).toLocaleString(localeName())} mi`;
  }

  if (distance < 1000) {
    return `${distance.toFixed(1)} m`;
  }

  if (distance < 1000000) {
    return `${(distance / 1000).toFixed(2)} km`;
  }

  return `${Math.round(distance / 1000).toLocaleString(localeName())} km`;
}

function formatBarrierDistance(distanceKm) {
  const value = Math.max(0, Number(distanceKm) || 0);
  return `${value.toFixed(1)} km`;
}

function localeName() {
  return activeLanguage() === EN_LANGUAGE ? "en-US" : "ja-JP";
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("label.none");
  return new Intl.DateTimeFormat(localeName(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatMonth(value) {
  return new Intl.DateTimeFormat(localeName(), { year: "numeric", month: "long" }).format(new Date(value));
}

function pulseBarrierError() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([80, 45, 140]);
    }
  } catch {
    // Vibration is optional and can be blocked by the browser or platform.
  }
}

function validateBarrierCompletion(vertices) {
  const rankInfo = currentKekkaishiRankInfo();
  const validation = validateBarrierVertices(state.traverseLog, vertices, { maxVertices: rankInfo.maxVertices });
  if (!validation.ok) {
    const message = validation.reason === "too-many"
      ? t("barrier.tooMany").replace("{max}", String(validation.maxVertices || rankInfo.maxVertices))
      : validation.reason === "used"
      ? t("barrier.stoneUsed")
      : validation.reason === "missing"
        ? t("barrier.missingStone")
        : t("barrier.tooFew");
    return { ok: false, message };
  }

  const geos = vertices.map((stoneId) => tileCenterGeo(state.traverseLog.stones[stoneId]?.tile)).filter(Boolean);
  const perimeter = barrierFitsPerimeter(geos, rankInfo.rank.index);
  if (!perimeter.ok) {
    return {
      ok: false,
      message: t("barrier.perimeterExceeded")
        .replace("{limit}", formatBarrierDistance(perimeter.limitKm))
        .replace("{perimeter}", formatBarrierDistance(perimeter.perimeterKm))
    };
  }

  const selfIntersecting = polygonSelfIntersects(geos);
  const linkPattern = selfIntersecting && vertices.length === 5
    ? "pentagram"
    : selfIntersecting && vertices.length === 8
      ? "octagram"
      : "adjacent";
  if (linkPattern === "pentagram" && rankInfo.rank.index < BARRIER_CONFIG.crossLinkFromRank) {
    return { ok: false, message: t("barrier.crossLinkLocked").replace("{rank}", "S") };
  }
  if (linkPattern === "octagram" && rankInfo.rank.index < 8) {
    return { ok: false, message: t("barrier.crossLinkLocked").replace("{rank}", "SSS") };
  }

  return { ok: true, rankInfo, geos, linkPattern };
}

function rejectBarrierLinkCompletion(message) {
  const completionPath = state.barrierLinkCompletion?.path;
  const path = [
    ...(Array.isArray(completionPath) && completionPath.length > 0
      ? completionPath
      : state.barrierLinkPath.length > 0
        ? state.barrierLinkPath
        : state.barrierSelection)
  ];
  clearBarrierLinkHoldVisual();
  state.barrierLinkCompletion = null;
  state.barrierLinkDiamondAnimations = [];
  if (state.barrierLinkDiamondFrameId !== null) {
    window.cancelAnimationFrame(state.barrierLinkDiamondFrameId);
  }
  state.barrierLinkDiamondFrameId = null;
  state.barrierLinkingMode = false;
  state.barrierLinkPath = [];
  state.barrierSelection = path;
  state.barrierLinkCandidateStoneId = null;
  state.barrierLinkPendingStoneId = null;
  state.barrierLinkError = { path };
  state.barrierLinkPreview = true;
  canvas.classList.add("is-barrier-linking");
  pulseBarrierError();
  showAppToast(message, { error: true, duration: BARRIER_LINK_ERROR_MESSAGE_MS });
  if (state.barrierLinkErrorTimerId !== null) {
    window.clearTimeout(state.barrierLinkErrorTimerId);
  }
  const error = state.barrierLinkError;
  state.barrierLinkErrorTimerId = window.setTimeout(() => {
    if (state.barrierLinkError !== error) return;
    state.barrierLinkErrorTimerId = null;
    resumeBarrierLinkRoom();
  }, BARRIER_LINK_ERROR_MESSAGE_MS);
  render();
}

async function createBarrierFromSelection() {
  const vertices = [...state.barrierSelection];
  const completion = validateBarrierCompletion(vertices);
  if (!completion.ok) {
    rejectBarrierLinkCompletion(completion.message);
    return;
  }
  const { rankInfo, geos, linkPattern } = completion;

  const defaultName = t("barrier.defaultName");
  const input = await requestTextInput({
    title: t("barrier.createTitle"),
    message: t("barrier.createMessage"),
    label: t("barrier.nameLabel"),
    defaultValue: defaultName,
    submitLabel: t("action.apply")
  });
  if (input === null) {
    resumeBarrierLinkRoom();
    return;
  }
  const name = input.trim() || defaultName;
  const barrierId = createId();
  const evaluation = evaluateBarrierLog(state.traverseLog);
  if (evaluation.changed) persistTraverseLog();
  const result = registerBarrier(state.traverseLog, {
    id: barrierId,
    name,
    vertices,
    maxVertices: rankInfo.maxVertices,
    linkPattern,
    createdAt: new Date().toISOString()
  });
  if (!result.ok) {
    const message = result.reason === "too-many"
      ? t("barrier.tooMany").replace("{max}", String(rankInfo.maxVertices))
      : result.reason === "used" ? t("barrier.stoneUsed") : t("barrier.missingStone");
    rejectBarrierLinkCompletion(message);
    return;
  }
  resetBarrierLinkState();
  state.barrierLinkSourceSelection = [];
  state.barrierSelection = [];
  state.selectedBarrierId = barrierId;
  syncBarrierFiguresFromLog();
  persistWorkspace();
  persistTraverseLog();
  showAppToast(t("barrier.created"));
  returnToTraverseActionMenu();
}

function handleLinkAction() {
  void connectSelectedPoints();
}

async function connectSelectedPoints() {
  const pointIds = selectedPointIds();
  if (pointIds.length < 2) {
    return;
  }

  let closeShape = false;
  if (pointIds.length >= 3) {
    closeShape = await requestConfirm({
      title: t("line.closeShapeTitle"),
      message: t("line.closeShapeMessage"),
      cancelLabel: cloudText("いいえ", "No"),
      confirmLabel: cloudText("はい", "Yes"),
      danger: false
    });
  }

  const destination = geometryDestinationForPoints(pointIds);
  if (!destination) {
    beginGeometryDestinationSelection(pointIds, closeShape);
    return;
  }

  finishConnectingSelectedPoints(pointIds, closeShape, destination);
}

function finishConnectingSelectedPoints(pointIds, closeShape, destination) {
  if (!destination) return;

  const strokeId = createId();
  const createdAt = new Date().toISOString();
  let created = false;
  let createdCount = 0;
  for (let index = 1; index < pointIds.length; index += 1) {
    const a = pointIds[index - 1];
    const b = pointIds[index];
    if (findLinkBetween(a, b, destination)) {
      continue;
    }

    const link = createStoredLink({
      id: createId(),
      aPoint: findPoint(a),
      bPoint: findPoint(b),
      strokeId,
      createdAt
    });
    if (link) {
      appendListedAnalysisItem("lines", link, destination);
      created = true;
      createdCount += 1;
    }
  }

  if (closeShape) {
    const a = pointIds.at(-1);
    const b = pointIds[0];
    if (!findLinkBetween(a, b, destination)) {
      const link = createStoredLink({
        id: createId(),
        aPoint: findPoint(a),
        bPoint: findPoint(b),
        strokeId,
        createdAt
      });
      if (link) {
        appendListedAnalysisItem("lines", link, destination);
        created = true;
        createdCount += 1;
      }
    }
  }

  let createdFigure = null;
  if (closeShape) {
    createdFigure = createStoredFigure({
      points: pointIds.map(findPoint).filter(Boolean),
      createdAt
    });
    if (createdFigure) {
      appendListedAnalysisItem("figures", createdFigure, destination);
      created = true;
    }
  }

  if (created) {
    persistWorkspace();
    if (createdCount > 0) showAppToast(t("line.connected").replace("{count}", String(createdCount)));
  } else {
    showAppToast(t("line.alreadyConnected"));
  }

  state.mode = "inspect";
  state.pendingLinkPointId = null;
  setSelection(createdFigure ? [{ type: "figure", id: createdFigure.id }] : [], { render: false });
  render();
}

function openPointRegistrationDialog() {
  const dialog = elements.pointRegistrationDialog;
  if (!dialog?.showModal || dialog.open) return;
  dialog.showModal();
  window.setTimeout(() => elements.pointTitle?.focus(), 0);
}

function submitPendingPoint() {
  if (!validGeo(state.pendingGeo)) {
    if (state.selection.length === 0) {
      state.mode = "add";
      state.editingPointId = null;
      state.pointDestinationListId = null;
      state.pendingLinkPointId = null;
      elements.shareImportStatus.value = "地点情報を入力できます";
      openPointRegistrationDialog();
      render();
    }
    return;
  }

  if (state.selection.length === 0) {
    state.mode = "add";
    state.editingPointId = null;
    state.pointDestinationListId = null;
    state.pendingLinkPointId = null;
    elements.pointTitle.value = "グリッド上の仮選択地点";
    elements.shareImportStatus.value = "地点情報を入力できます";
    openPointRegistrationDialog();
    render();
    return;
  }

  state.editingPointId = null;
  state.pointDestinationListId = null;
  if (typeof elements.pointForm.requestSubmit === "function") {
    elements.pointForm.requestSubmit();
    return;
  }

  elements.pointForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

function createCenterPendingPoint() {
  const points = selectedPointIds().map(findPoint).filter(Boolean);
  if (points.length < 2) {
    return;
  }

  const geo = geographicCenter(points);
  if (!geo) {
    return;
  }
  state.mode = "add";
  state.pendingGeo = geo;
  state.editingPointId = null;
  state.pointDestinationListId = null;
  state.pendingLinkPointId = null;
  elements.pointTitle.value = "中心";
  elements.pointNote.value = `${points.length}点の中心`;
  elements.pointPhoto.value = "";
  fillFormFromGeo(geo);
  setSelection([], { clearPending: false, render: false });
  render();
}

function startEditingPoint(point) {
  if (!point || !pointEditable(point.id)) {
    return false;
  }

  const geo = pointGeo(point);
  state.editingPointId = point.id;
  state.pendingGeo = null;
  state.pendingLinkPointId = null;
  state.mode = "inspect";
  elements.pointTitle.value = point.title;
  elements.pointNote.value = point.note || "";
  elements.pointPhoto.value = "";
  fillFormFromGeo(geo);
  const editingList = pointListForPoint(point.id);
  state.pointDestinationListId = editingList ? pointListStorageKey(editingList) : NEW_POINT_LIST_ID;
  elements.shareImportStatus.value = editingList?.cloudId
    ? cloudText("クラウド保管中のマイリストを編集中。保存するとクラウドへ反映します", "Editing a cloud-stored my list. Saving will update cloud storage.")
    : "編集: 内容を更新できます";
  openPointRegistrationDialog();
  render();
  return true;
}

function startEditingPointInfoTarget() {
  const point = state.pointInfoTargetId ? findPoint(state.pointInfoTargetId) : null;
  return startEditingPoint(point);
}

function startEditingSelectedPoint() {
  return startEditingPoint(editableSelectedPoint());
}
function fillFormFromWorld(point) {
  state.mode = "add";
  state.pendingGeo = unprojectWorld(point.x, point.y);
  state.editingPointId = null;
  state.pointDestinationListId = null;
  state.pendingLinkPointId = null;
  fillFormFromGeo(state.pendingGeo);
}

function fillFormFromGeo(geo) {
  const normalized = normalizeGeo(geo);
  elements.pointLat.value = normalized.lat.toFixed(6);
  elements.pointLng.value = normalized.lng.toFixed(6);
}

function selectPoint(pointId) {
  setSelection([{ type: "point", id: pointId }]);
}

function selectLink(linkId, options = {}) {
  setSelection([{ type: "link", id: linkId }], options);
}

function selectBarrierForDissolve(screenPoint) {
  if (!state.barrierDissolveMode) return;
  const barrier = findNearestBarrier(screenPoint);
  state.barrierSelection = [];
  state.selectedBarrierId = barrier?.barrierId || null;
  render();
}

function findNearestLoadedObservation(screenPoint) {
  let nearestId = null;
  let nearestDistance = Infinity;

  const measurePath = (layer, points) => {
    for (let index = 1; index < points.length; index += 1) {
      const start = worldToScreen(points[index - 1]);
      const end = worldToScreen(points[index]);
      const distance = distanceToSegment(screenPoint, start, end);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = layer.id;
      }
    }
  };

  for (const layer of loadedObservationLayers()) {
    if (layer.target) {
      measurePath(layer, [layer.start, layer.target]);
    }
    measurePath(layer, layer.points);
  }

  return nearestDistance <= 14 ? nearestId : null;
}

function handleCanvasClick(screenPoint) {
  if (state.barrierDissolveMode) {
    selectBarrierForDissolve(screenPoint);
    return;
  }
  if (state.guardianPlacementMode) {
    void placeGuardianAtScreen(screenPoint);
    return;
  }
  if (state.barrierLinkingMode) return;

  const nearestBarrierStone = state.traverseMode ? findNearestBarrierStone(screenPoint) : null;
  const barrierStoneIsGlyph = Boolean(
    nearestBarrierStone
    && state.barrierStoneGlyphMode.has(nearestBarrierStone.stoneId)
  );
  // The compact diamond stays above pins/current location so its small target
  // remains practical. A filled cell, however, must not mask a pin or the
  // current location visible beneath it.
  const nearest = barrierStoneIsGlyph ? null : findNearestPoint(screenPoint);
  const nearestLink = nearest || nearestBarrierStone ? null : findNearestLink(screenPoint);
  const nearestFigure = nearest || nearestBarrierStone || nearestLink ? null : findNearestFigure(screenPoint);
  const nearestObservation = nearest || nearestBarrierStone || nearestLink || nearestFigure
    ? null
    : findNearestLoadedObservation(screenPoint);

  if (nearest) {
    if (kekkaiTesterModeActive()) state.barrierSelection = [];
    toggleSelection("point", nearest.id);
    return;
  }

  if (nearestLink) {
    state.barrierSelection = [];
    state.selectedBarrierId = null;
    toggleSelection("link", nearestLink.id);
    return;
  }

  if (nearestFigure) {
    state.barrierSelection = [];
    state.selectedBarrierId = null;
    toggleSelection("figure", nearestFigure.id);
    return;
  }

  if (nearestObservation) {
    state.barrierSelection = [];
    state.selectedBarrierId = null;
    toggleSelection("observation", nearestObservation);
    return;
  }

  if (state.traverseMode) {
    if (nearestBarrierStone) {
      state.selectedBarrierId = null;
      if (kekkaiTesterModeActive()) {
        state.selection = [];
        state.pendingGeo = null;
      }
      toggleBarrierStoneSelection(nearestBarrierStone.stoneId);
      return;
    }
    const barrier = findNearestBarrier(screenPoint);
    if (barrier) {
      state.barrierSelection = [];
      state.selectedBarrierId = state.selectedBarrierId === barrier.barrierId ? null : barrier.barrierId;
      render();
      return;
    }
    state.selectedBarrierId = null;
    state.barrierSelection = [];
  }

  pauseLocationFollowForManualView();
  if (kekkaiTesterModeActive()) state.selection = [];
  state.mode = "inspect";
  fillFormFromWorld(screenToWorld(screenPoint));
  render();
}
async function setRouteStart(pointId) {
  if (!state.routeSelectionIds.includes(pointId)) {
    return;
  }

  if (state.routeStartPointId !== pointId) {
    if (!await confirmObservationReset("起点を変更")) {
      render();
      return;
    }
    resetObservationTrail();
  }
  state.routeStartPointId = pointId;
  updateRouteStartSnapshot(findPoint(pointId));
  render();
}

function clearRouteSelection() {
  state.routeSelectionIds = [];
  state.routeResult = null;
  render();
}

function computeRouteFromSelection() {
  const plan = routePlanFromCurrentSelection();
  if (!plan) {
    state.routeResult = null;
    render();
    return;
  }

  state.routeSelectionIds = [];
  state.routeResult = optimizeVisitOrder(plan.points, plan.start.id, state.routeReturnToStart);
  setSelection([], { render: false });
  render();
}

function normalizeRouteSelection() {
  const validIds = visiblePointIdSet();
  if (currentLocationPoint()) {
    validIds.add(CURRENT_LOCATION_ID);
  }
  const uniqueIds = [];

  for (const id of state.routeSelectionIds) {
    if (validIds.has(id) && !uniqueIds.includes(id)) {
      uniqueIds.push(id);
    }
  }

  state.routeSelectionIds = uniqueIds;

  if (state.routeStartPointId && !validIds.has(state.routeStartPointId)) {
    clearRouteStartState();
  }

  if (state.routeResult && state.routeResult.pointIds.some((id) => !validIds.has(id))) {
    state.routeResult = null;
  }
}

function selectedRoutePoints() {
  return state.routeSelectionIds.map(findPoint).filter(Boolean);
}

function routeResultPoints() {
  return state.routeResult?.pointIds?.map(findPoint).filter(Boolean) ?? [];
}

function optimizeVisitOrder(points, startPointId, returnToStart) {
  const startIndex = Math.max(0, points.findIndex((point) => point.id === startPointId));
  const orderedPoints = [points[startIndex], ...points.filter((_, index) => index !== startIndex)];
  const distances = buildDistanceMatrix(orderedPoints);
  const result = orderedPoints.length <= 12
    ? optimizeExact(distances, returnToStart)
    : optimizeHeuristic(distances, returnToStart);
  const routePoints = result.path.map((index) => orderedPoints[index]);
  const segmentDistances = routePoints.slice(1).map((point, index) => distanceBetween(routePoints[index], point));
  if (returnToStart && routePoints.length > 1) {
    segmentDistances.push(distanceBetween(routePoints.at(-1), routePoints[0]));
  }

  return {
    pointIds: routePoints.map((point) => point.id),
    totalDistance: sumDistances(segmentDistances),
    segmentDistances,
    returnToStart: Boolean(returnToStart),
    exact: result.exact
  };
}

function buildDistanceMatrix(points) {
  return points.map((from) => points.map((to) => (from.id === to.id ? 0 : distanceBetween(from, to))));
}

function optimizeExact(distances, returnToStart) {
  const count = distances.length;
  const size = 1 << count;
  const dp = Array.from({ length: size }, () => Array(count).fill(Infinity));
  const parent = Array.from({ length: size }, () => Array(count).fill(-1));
  dp[1][0] = 0;

  for (let mask = 1; mask < size; mask += 1) {
    if ((mask & 1) === 0) {
      continue;
    }

    for (let last = 0; last < count; last += 1) {
      const current = dp[mask][last];
      if (!Number.isFinite(current)) {
        continue;
      }

      for (let next = 1; next < count; next += 1) {
        if ((mask & (1 << next)) !== 0) {
          continue;
        }

        const nextMask = mask | (1 << next);
        const candidate = current + distances[last][next];
        if (candidate < dp[nextMask][next]) {
          dp[nextMask][next] = candidate;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  const fullMask = size - 1;
  let bestLast = 0;
  let bestDistance = Infinity;
  for (let last = 0; last < count; last += 1) {
    const candidate = dp[fullMask][last] + (returnToStart && count > 1 ? distances[last][0] : 0);
    if (candidate < bestDistance) {
      bestDistance = candidate;
      bestLast = last;
    }
  }

  const path = [];
  let mask = fullMask;
  let current = bestLast;
  while (current !== -1) {
    path.push(current);
    const previous = parent[mask][current];
    mask ^= 1 << current;
    current = previous;
  }

  return {
    path: path.reverse(),
    exact: true
  };
}

function optimizeHeuristic(distances, returnToStart) {
  const count = distances.length;
  const unvisited = new Set(Array.from({ length: count - 1 }, (_, index) => index + 1));
  const path = [0];

  while (unvisited.size > 0) {
    const last = path[path.length - 1];
    let best = null;
    let bestDistance = Infinity;

    for (const candidate of unvisited) {
      if (distances[last][candidate] < bestDistance) {
        best = candidate;
        bestDistance = distances[last][candidate];
      }
    }

    path.push(best);
    unvisited.delete(best);
  }

  improveRouteWithTwoOpt(path, distances, returnToStart);

  return {
    path,
    exact: false
  };
}

function improveRouteWithTwoOpt(path, distances, returnToStart) {
  let improved = true;

  while (improved) {
    improved = false;

    for (let start = 1; start < path.length - 1; start += 1) {
      for (let end = start + 1; end < path.length; end += 1) {
        const before = routeEdgeCost(path, distances, start, end, returnToStart);
        const reversed = [...path.slice(0, start), ...path.slice(start, end + 1).reverse(), ...path.slice(end + 1)];
        const after = routeEdgeCost(reversed, distances, start, end, returnToStart);

        if (after + 0.000001 < before) {
          path.splice(0, path.length, ...reversed);
          improved = true;
        }
      }
    }
  }
}

function routeEdgeCost(path, distances, start, end, returnToStart) {
  const beforeStart = distances[path[start - 1]][path[start]];
  const afterEnd = end + 1 < path.length
    ? distances[path[end]][path[end + 1]]
    : returnToStart
      ? distances[path[end]][path[0]]
      : 0;
  return beforeStart + afterEnd;
}

function sumDistances(distances) {
  return distances.reduce((sum, distance) => sum + distance, 0);
}
function zoomAt(screenPoint, factor) {
  if (state.barrierLinkPreview) return;
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  const before = screenToWorld(screenPoint);
  state.viewport.scale = clampScale(state.viewport.scale * factor);
  const after = screenToWorld(screenPoint);
  state.viewport.x += before.x - after.x;
  state.viewport.y += before.y - after.y;
  render();
}

function barrierCellFitPoints(stoneIds = null) {
  if (!state.traverseMode || !state.traverseLog) return [];
  const allowedStoneIds = Array.isArray(stoneIds) ? new Set(stoneIds) : null;
  // A placed barrier stone is already a valid vertex-cell pan target, even
  // before it has been registered in a completed barrier.
  return Object.entries(state.traverseLog.stones || {})
    .filter(([stoneId]) => !allowedStoneIds || allowedStoneIds.has(stoneId))
    .filter(([, stone]) => stoneDisplayCount(stone) > 0)
    .flatMap(([, stone]) => {
      const boundaryGeos = tileBoundaryGeos(stone.tile);
      if (boundaryGeos.length > 0) return boundaryGeos;
      const centerGeo = tileCenterGeo(stone.tile);
      return centerGeo ? [centerGeo] : [];
    })
    .map((geo) => ({
      ...projectLatLng(geo.lat, geo.lng),
      geo
    }));
}

function reprojectFitPoints(points) {
  return points.map((point) => {
    const geo = pointGeo(point);
    return validGeo(geo)
      ? { ...point, ...projectLatLng(geo.lat, geo.lng), geo }
      : point;
  });
}

function fitToPoints(fitPointsOverride = null, options = {}) {
  syncCanvasSize();
  pauseLocationFollowForManualView();

  const overridePoints = Array.isArray(fitPointsOverride) ? fitPointsOverride.filter(Boolean) : null;
  const includeBarrierCells = options.includeBarrierCells === true;
  let fitPoints = [
    ...(overridePoints ?? fitTargetPoints()),
    ...(includeBarrierCells ? barrierCellFitPoints() : [])
  ];

  if (fitPoints.length === 0) {
    setProjectionCenterGeo(DEFAULT_GEO);
    state.viewport.x = DEFAULT_CENTER.x;
    state.viewport.y = DEFAULT_CENTER.y;
    state.viewport.scale = 0.7;
    render();
    return;
  }

  const centerGeo = geographicCenter(fitPoints);
  if (centerGeo) {
    setProjectionCenterGeo(centerGeo);
    fitPoints = reprojectFitPoints([
      ...(overridePoints ?? fitTargetPoints()),
      ...(includeBarrierCells ? barrierCellFitPoints() : [])
    ]);
  }

  const size = canvasSize();
  const xs = fitPoints.map((point) => point.x);
  const ys = fitPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, size.width - padding * 2);
  const availableHeight = Math.max(64, size.height - padding * 2);
  const spanX = Math.max(60, maxX - minX);
  const spanY = Math.max(60, maxY - minY);
  const scaleX = availableWidth / spanX;
  const scaleY = availableHeight / spanY;

  state.viewport.x = (minX + maxX) / 2;
  state.viewport.y = (minY + maxY) / 2;
  state.viewport.scale = clampScale(Math.min(scaleX, scaleY));
  render();
}

function fitTraverseView() {
  if (state.barrierLinkPreview) return;
  // Fitting changes only the viewport. Never turn the cells used as fit targets
  // into an implicit selection.
  const selectionSnapshot = state.selection.map((entry) => ({ ...entry }));
  const barrierSelectionSnapshot = [...state.barrierSelection];
  const selectedBarrierIdSnapshot = state.selectedBarrierId;
  const restoreSelectionAfterFit = () => {
    state.selection = selectionSnapshot;
    state.barrierSelection = barrierSelectionSnapshot;
    state.selectedBarrierId = selectedBarrierIdSnapshot;
    normalizeSelection();
    render();
  };
  const fitVertices = state.barrierFitStage === "vertices";
  if (fitVertices) {
    const vertexCellFitPoints = barrierCellFitPoints();
    if (vertexCellFitPoints.length === 0) {
      state.barrierFitStage = "all";
      fitToPoints(null, { includeBarrierCells: true });
      restoreSelectionAfterFit();
      return;
    }
    state.barrierFitStage = "all";
    fitToPoints(vertexCellFitPoints);
    restoreSelectionAfterFit();
    return;
  }

  if (barrierCellFitPoints().length === 0) {
    state.barrierFitStage = "all";
    fitToPoints(null, { includeBarrierCells: true });
    restoreSelectionAfterFit();
    return;
  }

  state.barrierFitStage = "vertices";
  fitToPoints(null, { includeBarrierCells: true });
  restoreSelectionAfterFit();
}

function renderFitButton() {
  const button = elements.fitButton;
  if (!button) return;
  const hasVertexCells = state.traverseMode && barrierCellFitPoints().length > 0;
  const nextTarget = hasVertexCells && state.barrierFitStage === "vertices"
    ? "頂点セル"
    : "全体";
  const title = state.traverseMode ? `次のパン対象：${nextTarget}` : "全体表示";
  button.title = title;
  button.setAttribute("aria-label", title);
}

function fitFollowViewport(current) {
  const size = canvasSize();
  const target = targetPoint();
  if (state.locationFollowScaleMode === FOLLOW_SCALE_TARGET && target) {
    fitTargetFromCurrent(current, target);
    return;
  }

  const targets = followFitTargetPoints(current);
  const remoteTargets = targets.filter((point) => Math.hypot(point.x - current.x, point.y - current.y) > 1);

  state.viewport.x = current.x;
  state.viewport.y = current.y;

  if (remoteTargets.length === 0) {
    render();
    return;
  }

  const padding = Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, size.width - padding * 2);
  const availableHeight = Math.max(64, size.height - padding * 2);
  const maxDx = Math.max(30, ...remoteTargets.map((point) => Math.abs(point.x - current.x)));
  const maxDy = Math.max(30, ...remoteTargets.map((point) => Math.abs(point.y - current.y)));
  const scaleX = availableWidth / (maxDx * 2);
  const scaleY = availableHeight / (maxDy * 2);

  state.viewport.scale = clampScale(Math.min(scaleX, scaleY));
  render();
}

function fitTargetFromCurrent(current, target) {
  const geo = pointGeo(current);
  const distance = distanceBetween(current, target);
  const accuracy = Number.isFinite(geo.accuracy) ? geo.accuracy : 0;
  const range = targetRangeForDistance(Math.max(distance, accuracy * 2));

  const size = canvasSize();
  const padding = Math.min(110, Math.max(34, Math.min(size.width, size.height) * 0.16));
  const availableWidth = Math.max(64, size.width - padding * 2);
  const availableHeight = Math.max(64, size.height - padding * 2);

  state.viewport.x = current.x;
  state.viewport.y = current.y;
  state.viewport.scale = clampScale(Math.min(availableWidth, availableHeight) / (range * 2));
  render();
}

function targetRangeForDistance(distance) {
  const desired = Math.max(TARGET_ARRIVAL_METERS, distance);
  return TARGET_DISTANCE_STEPS.find((step) => step >= desired) ?? desired;
}

function geographicCenter(points) {
  const geos = points.map(pointGeo).filter(validGeo);
  if (geos.length === 0) {
    return null;
  }

  let x = 0;
  let y = 0;
  let z = 0;
  for (const geo of geos) {
    const lat = toRadians(geo.lat);
    const lng = toRadians(geo.lng);
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }

  const length = Math.hypot(x, y, z);
  if (length < 1e-9) {
    const first = geos[0];
    const lat = geos.reduce((sum, geo) => sum + geo.lat, 0) / geos.length;
    const lng = first.lng + geos.reduce((sum, geo) => sum + shortestLongitudeDelta(first.lng, geo.lng), 0) / geos.length;
    return normalizeGeo({ lat, lng });
  }

  return normalizeGeo({
    lat: toDegrees(Math.atan2(z, Math.hypot(x, y))),
    lng: toDegrees(Math.atan2(y, x))
  });
}

function followFitTargetPoints(current) {
  const points = [...visibleSelectablePoints(), current];

  if (validGeo(state.pendingGeo)) {
    const pending = normalizeGeo(state.pendingGeo);
    points.push({ ...projectLatLng(pending.lat, pending.lng), geo: pending });
  }

  return points;
}

function loadedObservationFitPoints() {
  return state.loadedObservations.flatMap((observation) => [
    observation.start,
    ...(observation.target ? [observation.target] : []),
    ...observation.trail
  ]);
}

function fitTargetPoints() {
  const routeStartSnapshot = state.routeStartSnapshot ? [state.routeStartSnapshot] : [];
  const loadedPoints = loadedObservationFitPoints();
  const routePoints = routeResultPoints();
  if (routePoints.length > 0) {
    return [...routePoints, ...routeStartSnapshot, ...loadedPoints];
  }

  const routeSelection = selectedRoutePoints();
  if (routeSelection.length > 0) {
    return [...routeSelection, ...routeStartSnapshot, ...loadedPoints];
  }

  const cloudPoints = visibleCloudPointLists()
    .flatMap((list) => list.points)
    .map(syncProjectedPoint)
    .filter(Boolean);
  const figurePoints = state.figures.filter(isVisibleAnalysisItem).flatMap(figureRuntimeVertices);
  const points = [...state.points, ...cloudPoints, ...figurePoints, ...routeStartSnapshot, ...loadedPoints];
  if (state.followCurrentLocation || points.length === 0) {
    const current = currentLocationPoint();
    if (current) {
      points.push(current);
    }
  }

  return points;
}

function centerAndFollowCurrentLocation() {
  if (!state.gpsEnabled || !("geolocation" in navigator)) {
    elements.shareImportStatus.value = "現在地を取得できません";
    return;
  }

  startDeviceHeading();
  syncCanvasSize();
  const wasAlreadyFollowing = state.screenFollowCurrentLocation;
  const switchTo100mScale = wasAlreadyFollowing
    && !state.screenFollowCurrentLocationAt100m;
  state.screenFollowCurrentLocation = true;
  if (!wasAlreadyFollowing) {
    state.screenFollowCurrentLocationAt100m = false;
  } else if (switchTo100mScale) {
    state.screenFollowCurrentLocationAt100m = true;
  }
  state.locationFollowScaleMode = FOLLOW_SCALE_CENTER;
  if (switchTo100mScale) {
    state.viewport.scale = CURRENT_LOCATION_GRID_SCALE;
  }

  const current = currentLocationPoint();
  if (current) {
    setProjectionCenterGeo(pointGeo(current));
    const centeredCurrent = currentLocationPoint();
    state.viewport.x = centeredCurrent.x;
    state.viewport.y = centeredCurrent.y;
  }

  if (state.locationWatchId !== null) {
    render();
    return;
  }

  try {
    state.locationWatchId = navigator.geolocation.watchPosition(
      (position) => updateCurrentLocationFromPosition(position, {
        center: state.followCurrentLocation || state.screenFollowCurrentLocation,
        fillForm: state.locationFollowFillForm
      }),
      (error) => {
        state.lastLocationError = error;
        const message = locationErrorMessage(error, "現在地エラー");
        stopScreenFollow({ render: false });
        elements.shareImportStatus.value = message;
        render();
      },
      geolocationOptions()
    );
    render();
  } catch {
    state.screenFollowCurrentLocation = false;
    clearLocationWatchIfIdle();
    renderLocationFollowButton();
    elements.shareImportStatus.value = "現在地エラー";
  }
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function createPointerGestureState() {
  return {
    active: new Map(),
    drag: null,
    pinch: null,
    range: null
  };
}

function armDragReadyTimer(drag, property, onReady) {
  if (!drag || !property || typeof onReady !== "function") return;
  drag[property] = window.setTimeout(() => {
    if (
      state.pointer.drag !== drag
      || state.pointer.active.size !== 1
      || drag.moved
      || drag.cancelled
    ) return;
    drag[property] = null;
    onReady();
  }, LINE_DRAG_LONG_PRESS_MS);
}

function pointerEntries() {
  return [...state.pointer.active.entries()];
}

function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function pointerAngle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function startDragGesture(pointerId, point, options = {}) {
  if (state.barrierLinkPreview && !isInsideBarrierLinkRoom(point)) {
    state.pointer.drag = {
      id: pointerId,
      start: point,
      last: point,
      moved: true,
      barrierLinkRoomOutside: true,
      barrierLink: false,
      longPressTimerId: null,
      lineDragReadyTimerId: null,
      lineDrag: null
    };
    return;
  }
  if (state.barrierDissolveMode) {
    state.pointer.drag = {
      id: pointerId,
      start: point,
      last: point,
      viewportX: state.viewport.x,
      viewportY: state.viewport.y,
      moved: Boolean(options.moved),
      barrierPlacementView: Boolean(state.barrierPlacementView),
      barrierDissolveMode: Boolean(state.barrierDissolveMode),
      longPressed: false,
      longPressTimerId: null,
      lineDrag: null
    };
    return;
  }
  if (state.barrierPlacementView) {
    const longPressBarrierStone = options.moved ? null : findNearestBarrierStone(point);
    const drag = {
      id: pointerId,
      start: point,
      last: point,
      viewportX: state.viewport.x,
      viewportY: state.viewport.y,
      moved: Boolean(options.moved),
      barrierPlacementView: true,
      longPressed: false,
      longPressBarrierStone,
      cancelled: false,
      longPressTimerId: null,
      lineDrag: null
    };
    state.pointer.drag = drag;
    if (longPressBarrierStone && !options.moved) {
      drag.longPressTimerId = window.setTimeout(() => {
        if (
          state.pointer.drag !== drag
          || state.pointer.active.size !== 1
          || drag.moved
          || drag.cancelled
        ) return;
        drag.longPressed = true;
        openGridBarrierStoneQuickDialog(longPressBarrierStone.stoneId, drag.start);
      }, RANGE_SELECTION_LONG_PRESS_MS);
    }
    return;
  }
  const barrierLinkMode = state.traverseMode && state.barrierLinkingMode;
  if (state.dragonEye.active && isInsideDragonEye(point)) {
    state.pointer.drag = {
      id: pointerId,
      start: point,
      last: point,
      moved: Boolean(options.moved),
      dragonEye: true,
      dragonEyeCenter: state.dragonEye.center ? { ...state.dragonEye.center } : null,
      dragonEyeStartWorld: screenToWorld(point)
    };
    return;
  }
  const barrierOrigin = barrierLinkMode && !options.moved ? findNearestBarrierStone(point) : null;
  if (state.barrierLinkPreview && (!barrierLinkMode || !barrierOrigin)) {
    state.pointer.drag = {
      id: pointerId,
      start: point,
      last: point,
      moved: true,
      barrierLinkRoomLocked: true,
      barrierLink: false,
      longPressTimerId: null,
      lineDragReadyTimerId: null,
      lineDrag: null
    };
    return;
  }
  const barrierStoneCandidate = state.traverseMode && !barrierLinkMode && !options.moved
    ? findNearestBarrierStone(point)
    : null;
  const lineEndpoint = barrierStoneCandidate || options.moved ? null : findNearestLineEndpoint(point);
  const figureVertexCandidate = barrierStoneCandidate || options.moved ? null : findNearestFigureVertex(point);
  const prioritizedVertex = chooseAnalysisHit([
    { kind: "line-endpoint", value: lineEndpoint },
    { kind: "figure-vertex", value: figureVertexCandidate }
  ]);
  const figureVertex = prioritizedVertex?.kind === "figure-vertex" ? prioritizedVertex.value : null;
  const lineBodyCandidate = resolveLineBodyDragCandidate({
    point,
    lineEndpoint,
    barrierStone: barrierStoneCandidate,
    moved: options.moved,
    findNearestLink
  });
  // A line body is the only object that can arm reassignment. Figure, point,
  // and barrier-cell hits below remain available for long-press/tap handling,
  // but they must never suppress an independent line-body drag candidate.
  const lineDragCandidate = lineBodyCandidate;
  const figureEdge = lineEndpoint || figureVertex || lineBodyCandidate || options.moved
    ? null
    : findNearestFigureEdge(point);
  const figureSurface = lineEndpoint || figureVertex || figureEdge ? null : options.moved ? null : findNearestFigure(point);
  const longPressFigure = figureVertex || figureEdge || (figureSurface ? { figureId: figureSurface.id } : null);
  const barrierStoneIsGlyph = Boolean(
    barrierStoneCandidate
    && state.barrierStoneGlyphMode.has(barrierStoneCandidate.stoneId)
  );
  const pointCandidate = longPressFigure || lineEndpoint || barrierStoneIsGlyph
    ? null
    : options.moved ? null : findNearestPoint(point);
  const prioritizedPoint = chooseAnalysisHit([
    { kind: "line-endpoint", value: lineEndpoint },
    { kind: "figure-vertex", value: figureVertex },
    { kind: "point", value: pointCandidate }
  ]);
  const longPressPoint = prioritizedPoint?.kind === "point" ? prioritizedPoint.value : null;
  // A small ◇ cell owns its whole displayed hit area. Once the cell is shown
  // as a dotted/fill polygon, a nearby pin/current-location hit can win.
  const longPressBarrierStone = longPressPoint ? null : barrierStoneCandidate;
  const longPressLink = longPressBarrierStone || options.moved || longPressPoint || lineEndpoint
    ? null
    : lineBodyCandidate;
  const longPressBarrier = longPressFigure || longPressBarrierStone || longPressPoint || longPressLink || barrierLinkMode || options.moved
    ? null
    : findNearestBarrier(point);
  const drag = {
    id: pointerId,
    start: point,
    last: point,
    viewportX: state.viewport.x,
    viewportY: state.viewport.y,
    moved: Boolean(options.moved),
    longPressed: false,
    longPressFigure,
    longPressBarrierStone,
    longPressPoint,
    longPressLink,
    longPressBarrier,
    lineDragCandidate,
    lineDragReady: false,
    lineDrag: null,
    cancelled: false,
    longPressTimerId: null,
    lineDragReadyTimerId: null,
    barrierLink: barrierLinkMode,
    barrierLinkStarted: Boolean(barrierLinkMode && barrierOrigin?.stoneId),
    barrierLinkOriginStoneId: barrierOrigin?.stoneId || null,
    barrierLinkPendingStoneId: null,
    barrierLinkCandidateStoneId: null,
    barrierLinkCandidateTimerId: null,
    barrierLinkClosing: false,
    dragonEye: false
  };
  state.pointer.drag = drag;

  if (barrierLinkMode) {
    drag.barrierLinkStarted = true;
    state.barrierLinkPath = [drag.barrierLinkOriginStoneId];
    state.barrierSelection = [...state.barrierLinkPath];
    startBarrierLinkDiamond(drag.barrierLinkOriginStoneId);
    state.barrierLinkCandidateStoneId = drag.barrierLinkOriginStoneId;
    canvas.classList.add("is-barrier-linking");
    showAppToast(t("traverse.linkOriginSelected"));
    draw();
    renderStatus();
    return;
  }

  if (lineDragCandidate) {
    drag.lineDragReadyTimerId = window.setTimeout(() => {
      if (
        state.pointer.drag !== drag
        || state.pointer.active.size !== 1
        || drag.moved
        || drag.cancelled
        || drag.longPressed
      ) {
        return;
      }

      drag.lineDragReady = true;
    }, LINE_DRAG_LONG_PRESS_MS);
  }

  if (longPressFigure || longPressBarrier) {
    if (!options.moved) {
      drag.longPressTimerId = window.setTimeout(() => {
        if (
          state.pointer.drag !== drag
          || state.pointer.active.size !== 1
          || drag.moved
          || drag.cancelled
        ) return;
        drag.longPressed = true;
        if (longPressFigure) {
          openGridFigureQuickDialog(findFigure(longPressFigure.figureId), {
            vertexIndex: Number.isInteger(longPressFigure.vertexIndex) ? longPressFigure.vertexIndex : null,
            screenPoint: drag.start
          });
        } else if (longPressBarrier) {
          openGridFigureQuickDialog(null, {
            barrierId: longPressBarrier.barrierId,
            screenPoint: drag.start
          });
        }
      }, LINE_INFO_LONG_PRESS_MS);
    }
    return;
  }

  if (!options.moved) {
    const longPressDelay = longPressLink || longPressBarrier ? LINE_INFO_LONG_PRESS_MS : RANGE_SELECTION_LONG_PRESS_MS;
    drag.longPressTimerId = window.setTimeout(() => {
      if (
        state.pointer.drag !== drag
        || state.pointer.active.size !== 1
        || drag.moved
        || drag.cancelled
      ) {
        return;
      }

      drag.lineDragReady = false;
      drag.longPressed = true;
      if (drag.longPressPoint) {
        openGridPointQuickDialog(drag.longPressPoint, drag.start);
        return;
      }
      if (drag.longPressBarrierStone) {
        openGridBarrierStoneQuickDialog(drag.longPressBarrierStone.stoneId, drag.start);
        return;
      }
      if (drag.longPressLink) {
        openGridLinkQuickDialog(drag.longPressLink, drag.start);
        return;
      }
      state.pointer.range = {
        start: { ...drag.start },
        current: { ...drag.start }
      };
      canvas.classList.add("is-range-selecting");
      draw();
      renderStatus();
    }, longPressDelay);
  }
}

function clearDragLongPressTimer(drag) {
  if (!drag) {
    return;
  }

  if (drag.longPressTimerId) window.clearTimeout(drag.longPressTimerId);
  if (drag.lineDragReadyTimerId) window.clearTimeout(drag.lineDragReadyTimerId);
  clearBarrierLinkCandidateTimer(drag);
  drag.longPressTimerId = null;
  drag.lineDragReadyTimerId = null;
  drag.lineDragReady = false;
}

function clearRangeSelectionPreview() {
  state.pointer.range = null;
  canvas.classList.remove("is-range-selecting");
}

function segmentIntersectsRange(start, end, left, right, top, bottom) {
  let rangeStart = 0;
  let rangeEnd = 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const boundaries = [
    [-dx, start.x - left],
    [dx, right - start.x],
    [-dy, start.y - top],
    [dy, bottom - start.y]
  ];

  for (const [p, q] of boundaries) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }

    const ratio = q / p;
    if (p < 0) {
      if (ratio > rangeEnd) return false;
      if (ratio > rangeStart) rangeStart = ratio;
    } else {
      if (ratio < rangeStart) return false;
      if (ratio < rangeEnd) rangeEnd = ratio;
    }
  }

  return true;
}

function selectPointsInRange(range) {
  const left = Math.min(range.start.x, range.current.x);
  const right = Math.max(range.start.x, range.current.x);
  const top = Math.min(range.start.y, range.current.y);
  const bottom = Math.max(range.start.y, range.current.y);
  const worldA = screenToWorld({ x: left, y: top });
  const worldB = screenToWorld({ x: right, y: bottom });
  const minX = Math.min(worldA.x, worldB.x);
  const maxX = Math.max(worldA.x, worldB.x);
  const minY = Math.min(worldA.y, worldB.y);
  const maxY = Math.max(worldA.y, worldB.y);
  const selectedPoints = visibleSelectablePoints().filter((point) => (
    point.id !== CURRENT_LOCATION_ID
    && point.x >= minX
    && point.x <= maxX
    && point.y >= minY
    && point.y <= maxY
  ));
  const selectedLinks = state.links.filter(isVisibleAnalysisItem).filter((link) => {
    const endpoints = linkEndpoints(link);
    if (!endpoints) return false;
    const start = worldToScreen(endpoints.a);
    const end = worldToScreen(endpoints.b);
    return segmentIntersectsRange(start, end, left, right, top, bottom);
  });
  const selectedBarrierStoneIds = state.traverseMode
    ? Object.entries(state.traverseLog?.stones || {})
      .filter(([, stone]) => stoneDisplayCount(stone) > 0)
      .filter(([, stone]) => {
        const polygon = displayedTraverseTilePolygon(stone.tile);
        if (!polygon || polygon.length < 3) return false;
        if (polygon.some((point) => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom)) {
          return true;
        }
        if ([
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom }
        ].some((corner) => pointInPolygon(corner, polygon))) {
          return true;
        }
        return polygon.some((point, index) => segmentIntersectsRange(
          point,
          polygon[(index + 1) % polygon.length],
          left,
          right,
          top,
          bottom
        ));
      })
      .map(([stoneId]) => stoneId)
    : [];

  state.selection = [
    ...selectedPoints.map((point) => ({ type: "point", id: point.id })),
    ...selectedLinks.map((link) => ({ type: "link", id: link.id }))
  ];
  state.barrierSelection = selectedBarrierStoneIds;
  state.selectedBarrierId = null;
  state.selectedPointId = selectedPoints[0]?.id ?? null;
  state.selectedLinkId = selectedLinks[0]?.id ?? null;
  normalizeSelection();
  return {
    points: selectedPoints,
    barrierFitPoints: barrierCellFitPoints(selectedBarrierStoneIds)
  };
}

function finishRangeSelection() {
  const range = state.pointer.range;
  if (!range) {
    return;
  }

  const width = Math.abs(range.current.x - range.start.x);
  const height = Math.abs(range.current.y - range.start.y);
  clearRangeSelectionPreview();

  if (width < RANGE_SELECTION_MIN_SIZE && height < RANGE_SELECTION_MIN_SIZE) {
    renderStatus();
    return;
  }

  pauseLocationFollowForManualView();
  const selectedRange = selectPointsInRange(range);
  const panTargets = [...selectedRange.points, ...selectedRange.barrierFitPoints];
  if (panTargets.length > 0) {
    fitToPoints(panTargets);
  } else {
    render();
  }
}

function startPinchGesture() {
  const entries = pointerEntries();
  if (entries.length < 2) {
    state.pointer.pinch = null;
    return;
  }

  const [, first] = entries[0];
  const [, second] = entries[1];
  clearDragLongPressTimer(state.pointer.drag);
  clearRangeSelectionPreview();
  const midpoint = pointerMidpoint(first, second);
  state.pointer.drag = null;
  state.pointer.pinch = {
    barrierLinkRoomLocked: Boolean(state.barrierLinkPreview),
    startDistance: Math.max(1, pointerDistance(first, second)),
    startMidpoint: midpoint,
    startWorld: screenToWorld(midpoint),
    startScale: state.viewport.scale,
    startAngle: pointerAngle(first, second),
    moved: false,
    dragonEye: Boolean(
      state.dragonEye.active
      && isInsideDragonEye(first)
      && isInsideDragonEye(second)
    ),
    startDragonEyeRadius: Number(state.dragonEye.radius) || 0,
    startDragonEyeRotation: Number(state.dragonEye.rotation) || 0
  };
}

function updatePinchGesture() {
  const entries = pointerEntries();
  if (entries.length < 2) {
    return;
  }

  if (!state.pointer.pinch) {
    startPinchGesture();
  }

  const pinch = state.pointer.pinch;
  if (pinch?.barrierLinkRoomLocked) {
    return;
  }
  const [, first] = entries[0];
  const [, second] = entries[1];
  const distance = Math.max(1, pointerDistance(first, second));
  const movedDistance = Math.abs(distance - pinch.startDistance);

  if (movedDistance > POINTER_MOVE_THRESHOLD) {
    pinch.moved = true;
  }

  if (!pinch.moved) {
    return;
  }

  if (pinch.dragonEye && state.dragonEye.active) {
    const rawRadius = pinch.startDragonEyeRadius * (distance / pinch.startDistance);
    state.dragonEye.radius = dragonEyeRadiusForSizePercent(dragonEyeSizePercent(rawRadius));
    const rankInfo = dragonEyeRankInfo();
    if (rankInfo.rotationUnlocked) {
      const currentAngle = pointerAngle(first, second);
      let delta = currentAngle - pinch.startAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      state.dragonEye.rotation = pinch.startDragonEyeRotation - delta;
    }
    renderDragonEyeControlPanel();
    draw();
    return;
  }

  const size = canvasSize();
  const nextScale = clampScale(pinch.startScale * (distance / pinch.startDistance));
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  state.viewport.scale = nextScale;
  state.viewport.x = pinch.startWorld.x - (pinch.startMidpoint.x - size.width / 2) / nextScale;
  state.viewport.y = pinch.startWorld.y + (pinch.startMidpoint.y - size.height / 2) / nextScale;

  draw();
  renderStatus();
}

function removePointer(event, options = {}) {
  if (!state.pointer.active.has(event.pointerId)) {
    return;
  }

  const point = getCanvasPoint(event);
  const drag = state.pointer.drag;
  const allowTap = options.allowTap !== false;
  const wasTap = allowTap
    && state.pointer.active.size === 1
    && drag
    && drag.id === event.pointerId
    && !drag.moved
    && !drag.dragonEye
    && !state.pointer.pinch;

  state.pointer.active.delete(event.pointerId);

  clearDragLongPressTimer(drag);

  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture can already be released by the browser during cancellation.
  }

  if (state.pointer.pinch) {
    state.pointer.pinch = null;
    const remaining = pointerEntries()[0];
    if (remaining) {
      startDragGesture(remaining[0], remaining[1], { moved: true });
    } else {
      state.pointer.drag = null;
    }
    return;
  }

  if (drag?.barrierLink) {
    state.pointer.drag = null;
    finishBarrierLinkGesture(drag, point, allowTap);
    return;
  }

  if (drag?.barrierLinkRoomOutside) {
    state.pointer.drag = null;
    return;
  }

  if (drag?.barrierLinkRoomLocked) {
    state.pointer.drag = null;
    return;
  }

  if (drag?.barrierDissolveMode) {
    state.pointer.drag = null;
    if (wasTap) handleCanvasClick(point);
    return;
  }

  if (drag?.barrierPlacementView) {
    state.pointer.drag = null;
    return;
  }

  if (drag?.dragonEye) {
    state.pointer.drag = null;
    render();
    return;
  }

  const lineDrag = drag?.lineDrag;
  state.pointer.drag = null;

  if (lineDrag) {
    if (allowTap) {
      finishLineDrag(lineDrag, point);
    } else {
      canvas.classList.remove("is-line-dragging");
      render();
    }
    return;
  }

  if (drag?.longPressed) {
    if (drag.longPressFigure || drag.longPressBarrierStone || drag.longPressBarrier || drag.longPressPoint || drag.longPressLink) {
      return;
    }
    if (allowTap) {
      finishRangeSelection();
    } else {
      clearRangeSelectionPreview();
      render();
    }
    return;
  }

  if (wasTap) {
    handleCanvasClick(point);
  }
}

function resetPointFormAfterSubmit() {
  elements.pointForm.reset();
  elements.shareImportStatus.value = "";
  elements.shareImportStatus.textContent = "";
  state.pendingGeo = null;
  state.editingPointId = null;
  state.pointDestinationListId = null;
  state.pendingLinkPointId = null;
  state.mode = "inspect";
  if (elements.pointRegistrationDialog?.open) {
    elements.pointRegistrationDialog.close("reset");
  }
  if (!restorePointInfoAfterEditing() && mobilePageUiActive()) {
    setMobilePage("map");
  }
}

function closePointRegistration() {
  resetPointFormAfterSubmit();
  render();
}

function nextAutoPointTitle() {
  const existingTitles = new Set(
    [...allPointListPoints(), ...state.cloud.pointLists.flatMap((list) => list.points)]
      .map((point) => String(point.title || "").trim().toLocaleUpperCase())
      .filter(Boolean)
  );
  let index = 1;
  while (existingTitles.has(`POINT ${index}`)) index += 1;
  return `POINT ${index}`;
}

async function saveEditedPointToDestination(editingList, destinationList, updatedPoint, updatedAt) {
  if (editingList === destinationList) {
    const nextList = {
      ...editingList,
      points: editingList.points.map((point) => point.id === updatedPoint.id ? updatedPoint : point),
      updatedAt
    };
    if (editingList.source === "cloud") {
      return updateCloudPointList(editingList, nextList);
    }
    Object.assign(editingList, nextList);
    persistWorkspace();
    return true;
  }

  const sourceNext = {
    ...editingList,
    points: editingList.points.filter((point) => point.id !== updatedPoint.id),
    updatedAt
  };
  const destinationNext = {
    ...destinationList,
    points: [...destinationList.points, updatedPoint],
    updatedAt
  };

  if (destinationList.source === "cloud") {
    const currentDestination = state.cloud.pointLists.find((list) => pointListStorageKey(list) === pointListStorageKey(destinationList)) || destinationList;
    if (!(await updateCloudPointList(currentDestination, destinationNext))) return false;
  }
  if (editingList.source === "cloud") {
    const currentSource = state.cloud.pointLists.find((list) => pointListStorageKey(list) === pointListStorageKey(editingList)) || editingList;
    if (!(await updateCloudPointList(currentSource, sourceNext))) return false;
  }

  if (editingList.source !== "cloud") Object.assign(editingList, sourceNext);
  if (destinationList.source !== "cloud") Object.assign(destinationList, destinationNext);
  refreshVisiblePoints();
  persistWorkspace();
  return true;
}
async function submitPoint(event) {
  event.preventDefault();
  if (pointSubmitInFlight) return;

  elements.pointSubmitButton.disabled = true;
  const submission = submitPointInternal();
  pointSubmitInFlight = submission;
  try {
    await submission;
  } finally {
    if (pointSubmitInFlight === submission) pointSubmitInFlight = null;
    elements.pointSubmitButton.disabled = state.cloud.busy;
  }
}

async function submitPointInternal() {
  const lat = Number.parseFloat(elements.pointLat.value);
  const lng = Number.parseFloat(elements.pointLng.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    elements.shareImportStatus.value = "緯度経度を入力してください";
    return;
  }

  const geo = normalizeGeo({
    lat,
    lng,
    accuracy: isSameGeo(state.pendingGeo, { lat, lng }) ? state.pendingGeo.accuracy : undefined
  });
  const projected = projectLatLng(geo.lat, geo.lng);
  const editingList = state.editingPointId ? pointListForPoint(state.editingPointId) : null;
  const editingPoint = state.editingPointId ? findPointAny(state.editingPointId) : null;
  if (state.editingPointId && (!editingList || !editingPoint || !pointEditable(state.editingPointId))) {
    showAppToast(cloudText("このリストは編集できません", "This list is read-only"), { error: true });
    resetPointFormAfterSubmit();
    render();
    return;
  }

  const fixedKekkaiDestination = state.traverseMode && !editingPoint ? kekkaiPointList() : null;
  const destinationKey = fixedKekkaiDestination
    ? pointListStorageKey(fixedKekkaiDestination)
    : elements.pointDestinationListSelect.value || state.pointDestinationListId || NEW_POINT_LIST_ID;
  let destinationList = fixedKekkaiDestination || (destinationKey === NEW_POINT_LIST_ID ? null : pointListByStorageKey(destinationKey));
  if (destinationKey !== NEW_POINT_LIST_ID && !destinationList) {
    elements.shareImportStatus.value = t("list.nameRequired");
    return;
  }
  if (destinationKey === NEW_POINT_LIST_ID) {
    destinationList = await promptNewPointListForRegistration();
    if (!destinationList) return;
    state.pointDestinationListId = pointListStorageKey(destinationList);
  }
  const file = elements.pointPhoto.files[0] ?? null;
  const photo = file ? await readPhoto(file) : null;
  let storedPhoto = null;
  if (photo) {
    try { storedPhoto = await storeGridAtlasDataUrl(photo, { name: file?.name || "" }); }
    catch (error) { console.warn("GRID ATLAS photo storage failed; keeping local fallback", error); }
  }
  const photoDisplay = storedPhoto?.url || photo;

  if (editingPoint && editingList) {
    const updatedAt = new Date().toISOString();
    const updatedPoint = {
      ...editingPoint,
      x: projected.x,
      y: projected.y,
      title: elements.pointTitle.value.trim() || editingPoint.title || "Point",
      note: elements.pointNote.value.trim(),
      geo,
      updatedAt,
      ...(photoDisplay ? {
        photo: photoDisplay,
        photoName: file?.name ?? "",
        photoAssetId: storedPhoto?.id || "",
        cloudPhoto: null
      } : {})
    };
    const moved = editingList !== destinationList;
    const updated = await saveEditedPointToDestination(editingList, destinationList, updatedPoint, updatedAt);
    if (!updated) { render(); return; }
    if (moved) {
      showAppToast(t("list.movedPoint").replace("{name}", destinationList.name));
    }
    if (!state.pointInfoReturnContext) {
      state.selection = [{ type: "point", id: updatedPoint.id }];
      normalizeSelection();
    }
    resetPointFormAfterSubmit();
    syncCanvasSize();
    render();
    return;
  }
  const createdAt = new Date().toISOString();
  const list = destinationList;
  const point = {
    id: createId(),
    x: projected.x,
    y: projected.y,
    title: elements.pointTitle.value.trim() || nextAutoPointTitle(),
    note: elements.pointNote.value.trim(),
    photo: photoDisplay || "",
    photoName: file?.name ?? "",
    photoAssetId: storedPhoto?.id || "",
    geo,
    createdAt
  };
  list.visible = true;
  list.updatedAt = createdAt;
  list.points.push(point);
  if (list.source === "cloud") {
    const updated = await updateCloudPointList(list, list, {
      message: cloudText("地点をクラウドへ登録しました", "Point registered to cloud")
    });
    if (!updated) { list.points.pop(); render(); return; }
  } else {
    refreshVisiblePoints();
    persistWorkspace();
  }
  state.selection = [{ type: "point", id: point.id }];
  normalizeSelection();
  resetPointFormAfterSubmit();
  syncCanvasSize();
  render();
}
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resizeImage(reader.result).then(resolve, reject));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const longestSide = Math.max(image.width, image.height);
      const scale = Math.min(1, 1400 / longestSide);

      const photoCanvas = document.createElement("canvas");
      photoCanvas.width = Math.round(image.width * scale);
      photoCanvas.height = Math.round(image.height * scale);
      const photoContext = photoCanvas.getContext("2d");
      photoContext.drawImage(image, 0, 0, photoCanvas.width, photoCanvas.height);
      const outputType = dataUrl.startsWith("data:image/png")
        ? "image/png"
        : dataUrl.startsWith("data:image/webp")
          ? "image/webp"
          : "image/jpeg";
      resolve(photoCanvas.toDataURL(outputType, 0.82));
    });
    image.addEventListener("error", () => resolve(dataUrl));
    image.src = dataUrl;
  });
}

function useCurrentLocation() {
  startDeviceHeading();
  requestCurrentLocation({ fillForm: true, center: false, showButtonState: true });
}

function locateOnStartup() {
  if (!state.gpsEnabled) {
    return;
  }

  requestCurrentLocation({ fillForm: false, center: true, showButtonState: false, startup: true });
}

function geolocationOptions(options = {}) {
  return {
    enableHighAccuracy: true,
    timeout: options.startup ? 6500 : 10000,
    maximumAge: 5000
  };
}

function updateCurrentLocationFromPosition(position, options = {}) {
  if (!state.gpsEnabled) {
    return;
  }

  const geo = normalizeGeo({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy
  });

  state.movementHeading = normalizeHeading(position.coords.heading);

  state.currentGeo = geo;
  state.lastLocationUpdateAt = Date.now();
  state.lastLocationError = null;
  if (options.center && !state.followCurrentLocation && !state.screenFollowCurrentLocation) {
    setProjectionCenterGeo(geo);
  }

  const current = currentLocationPoint();
  if (state.followCurrentLocation) {
    ensureTrackingObservationStart(current);
  }
  recordObservationPoint(current);

  if (options.fillForm) {
    state.mode = "add";
    state.pendingGeo = geo;
    state.editingPointId = null;
    state.pointDestinationListId = null;
    state.pendingLinkPointId = null;
    fillFormFromGeo(geo);
    openPointRegistrationDialog();
  }

  if (options.center) {
    if (state.screenFollowCurrentLocation) {
      state.viewport.x = current.x;
      state.viewport.y = current.y;
    } else if (state.followCurrentLocation) {
      if (state.locationFollowScaleMode === FOLLOW_SCALE_CENTER) {
        state.viewport.x = current.x;
        state.viewport.y = current.y;
      } else if (state.locationFollowScaleMode !== FOLLOW_SCALE_MANUAL) {
        fitFollowViewport(current);
        return;
      }
    } else {
      state.viewport.x = current.x;
      state.viewport.y = current.y;
      state.viewport.scale = Math.max(state.viewport.scale, 0.7);
    }
  }

  render();
}
function locationErrorMessage(error, fallback) {
  if (error?.code === 1) {
    return "位置情報を許可してください";
  }

  return fallback;
}

function requestCurrentLocation(options = {}) {
  if (!state.gpsEnabled || !("geolocation" in navigator)) {
    if (!options.startup) {
      elements.shareImportStatus.value = "現在地を取得できません";
    }
    return;
  }

  if (options.showButtonState) {
    elements.useLocationButton.disabled = true;
    elements.useLocationButton.textContent = "取得中";
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const shouldCenter = options.center && (!options.startup || (state.mode === "inspect" && state.selection.length === 0));
      updateCurrentLocationFromPosition(position, {
        fillForm: options.fillForm,
        center: shouldCenter
      });

      if (options.showButtonState) {
        elements.useLocationButton.disabled = false;
        elements.useLocationButton.textContent = "現在地";
      }
    },
    (error) => {
      if (!options.startup) {
        elements.shareImportStatus.value = locationErrorMessage(error, "現在地エラー");
      }
      if (options.showButtonState) {
        elements.useLocationButton.disabled = false;
        elements.useLocationButton.textContent = "現在地";
      }
    },
    geolocationOptions({ startup: options.startup })
  );
}

async function toggleLocationFollow(options = {}) {
  if (state.followCurrentLocation) {
    if (observationModeActive()) {
      const action = await chooseObservationStopAction();
      if (action === "continue") {
        return;
      }

      clearSelection({ render: false });
      stopLocationFollow({ render: false });
      clearObservationAssignments();
      elements.shareImportStatus.value = action === "arrived" ? "到着として観察を終了しました" : action === "finish" ? "観察を終了しました" : "観察を中断終了しました";
      render();
      return;
    }

    stopLocationFollow();
    return;
  }

  startLocationFollow(options);
}

async function chooseObservationStopAction() {
  const shouldStop = await requestConfirm({
    title: cloudText("観察終了の確認", "Confirm observation end"),
    message: cloudText("観察を終了しますか？", "End the observation?"),
    confirmLabel: cloudText("終了", "End"),
    danger: false
  });
  if (!shouldStop) {
    return "continue";
  }

  if (!targetPoint()) {
    return "finish";
  }

  const arrived = await requestConfirm({
    title: cloudText("到着の確認", "Confirm arrival"),
    message: cloudText(
      "対象に到着しましたか？\nはい：対象へ接続\nいいえ：現在地まで",
      "Have you arrived at the target?\nYes: connect to target\nNo: finish at current location"
    ),
    cancelLabel: cloudText("いいえ", "No"),
    confirmLabel: cloudText("はい", "Yes"),
    danger: false
  });

  return arrived
    ? "arrived"
    : "abort";
}

function clearObservationAssignments() {
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  state.targetPointId = null;
  resetObservationTrail();
}

function startLocationFollow(options = {}) {
  if (!state.gpsEnabled || !("geolocation" in navigator)) {
    elements.shareImportStatus.value = "現在地を取得できません";
    return;
  }

  startDeviceHeading();
  const autoRouteStart = !state.routeStartPointId;
  state.followCurrentLocation = true;
  state.locationFollowFillForm = Boolean(options.fillForm);
  state.pendingGeo = null;
  state.editingPointId = null;
  state.pendingLinkPointId = null;
  ensureTrackingObservationStart();

  const start = observationStartPoint();
  const target = targetPoint();
  if (start && target && !observationEndpointsDistinct(start, target)) {
    state.followCurrentLocation = false;
    if (autoRouteStart) {
      clearRouteStartState();
    }
    elements.shareImportStatus.value = "起点と対象が同じです。別の地点を指定してください";
    render();
    return;
  }

  resetObservationTrail();
  if (state.locationFollowScaleMode === FOLLOW_SCALE_MANUAL) {
    state.locationFollowScaleMode = state.targetPointId ? FOLLOW_SCALE_TARGET : FOLLOW_SCALE_CENTER;
  }

  if (state.locationWatchId !== null) {
    render();
    return;
  }

  try {
    state.locationWatchId = navigator.geolocation.watchPosition(
      (position) => updateCurrentLocationFromPosition(position, {
        center: state.followCurrentLocation || state.screenFollowCurrentLocation,
        fillForm: state.locationFollowFillForm
      }),
      (error) => {
        state.lastLocationError = error;
        const message = locationErrorMessage(error, "追跡エラー");
        state.screenFollowCurrentLocation = false;
        state.screenFollowCurrentLocationAt100m = false;
        stopLocationFollow();
        if (autoRouteStart) {
          clearRouteStartState();
        }
        elements.shareImportStatus.value = message;
      },
      geolocationOptions()
    );
    render();
  } catch {
    state.followCurrentLocation = false;
    state.locationWatchId = null;
    state.locationFollowFillForm = false;
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
    if (autoRouteStart) {
      clearRouteStartState();
    }
    renderLocationFollowButton();
    elements.shareImportStatus.value = "追跡エラー";
  }
}

function clearLocationWatchIfIdle() {
  if (state.followCurrentLocation || state.screenFollowCurrentLocation || state.locationWatchId === null) {
    return;
  }

  if ("geolocation" in navigator) {
    navigator.geolocation.clearWatch(state.locationWatchId);
  }
  state.locationWatchId = null;
}

function stopScreenFollow(options = {}) {
  state.screenFollowCurrentLocation = false;
  state.screenFollowCurrentLocationAt100m = false;
  clearLocationWatchIfIdle();

  if (options.render !== false) {
    render();
    return;
  }

  renderLocationFollowButton();
}

function stopLocationFollow(options = {}) {
  state.followCurrentLocation = false;
  state.locationFollowFillForm = false;
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  clearLocationWatchIfIdle();

  if (options.render !== false) {
    render();
    return;
  }

  renderLocationFollowButton();
}

function pauseLocationFollowForManualView() {
  let changed = false;
  if (state.screenFollowCurrentLocation) {
    state.screenFollowCurrentLocation = false;
    state.screenFollowCurrentLocationAt100m = false;
    changed = true;
  }
  if (state.followCurrentLocation) {
    state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
    changed = true;
  }

  clearLocationWatchIfIdle();
  if (changed) {
    renderLocationFollowButton();
  }
}

function renderLocationFollowButton() {
  const isSupported = state.gpsEnabled && "geolocation" in navigator;
  elements.useLocationButton.disabled = !isSupported;
  elements.useLocationButton.classList.remove("is-active");
  elements.useLocationButton.setAttribute("aria-pressed", "false");
  elements.useLocationButton.textContent = "現在地";
  elements.useLocationButton.title = !state.gpsEnabled ? "設定でGPSを有効にしてください" : isSupported ? "現在地を登録フォームへ入力" : "現在地を取得できません";

  elements.originButton.disabled = !isSupported;
  elements.originButton.classList.toggle("is-active", state.screenFollowCurrentLocation);
  elements.originButton.setAttribute("aria-pressed", String(state.screenFollowCurrentLocation));
  elements.originButton.title = !state.gpsEnabled
    ? "設定でGPSを有効にしてください"
    : state.screenFollowCurrentLocationAt100m
      ? "現在地を100mスケールで追従中"
      : state.screenFollowCurrentLocation
        ? "現在地を中央に追従中（もう一度で100mスケール）"
        : "現在地を中央にして画面追従";
}

function currentLocationPoint() {
  if (!validGeo(state.currentGeo)) {
    return null;
  }

  const projected = projectLatLng(state.currentGeo.lat, state.currentGeo.lng);
  return {
    id: CURRENT_LOCATION_ID,
    x: projected.x,
    y: projected.y,
    title: currentLocationLabel(),
    note: currentLocationStatus() === "stale"
      ? "最後に位置情報を取得した地点です。現在の位置は確認できません。"
      : "端末の位置情報から取得した地点です。",
    photo: "",
    photoName: "",
    geo: state.currentGeo,
    createdAt: new Date().toISOString(),
    recordedAt: Number.isFinite(Number(state.lastLocationUpdateAt))
      ? new Date(Number(state.lastLocationUpdateAt)).toISOString()
      : new Date().toISOString(),
    isVirtual: true
  };
}
function projectLatLng(lat, lng) {
  return projectGeo({ lat, lng });
}

function projectGeo(geo, projection = state.projection) {
  const normalized = normalizeGeo(geo);
  if (projection?.mode === "local") {
    return projectLocalAeqd(normalized, projectionCenterGeo(projection));
  }

  return projectWorldMercator(normalized);
}

function unprojectWorld(x, y, projection = state.projection) {
  if (projection?.mode === "local") {
    return unprojectLocalAeqd({ x, y }, projectionCenterGeo(projection));
  }

  return unprojectMercator(x, y);
}

function projectionCenterGeo(projection = state.projection) {
  return validGeo(projection?.centerGeo) ? normalizeGeo(projection.centerGeo) : normalizeGeo(DEFAULT_GEO);
}

function setProjectionCenterGeo(geo, options = {}) {
  if (!validGeo(geo)) {
    return false;
  }

  const next = normalizeGeo(geo);
  const current = projectionCenterGeo();
  if (isSameGeo(current, next)) {
    return false;
  }

  state.projection.centerGeo = next;
  state.projection.version += 1;
  if (options.sync !== false) {
    syncProjectedCoordinates();
  }
  return true;
}

function projectLocalAeqd(geo, centerGeo) {
  const lat = toRadians(geo.lat);
  const lngDelta = toRadians(shortestLongitudeDelta(centerGeo.lng, geo.lng));
  const lat0 = toRadians(centerGeo.lat);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const cosC = Math.max(-1, Math.min(1, sinLat0 * sinLat + cosLat0 * cosLat * Math.cos(lngDelta)));
  const c = Math.acos(cosC);
  if (Math.PI - c < 1e-8) {
    return { x: 0, y: EARTH_RADIUS_METERS * Math.PI };
  }
  const k = Math.abs(c) < 1e-12 ? 1 : c / Math.sin(c);

  return {
    x: EARTH_RADIUS_METERS * k * cosLat * Math.sin(lngDelta),
    y: EARTH_RADIUS_METERS * k * (cosLat0 * sinLat - sinLat0 * cosLat * Math.cos(lngDelta))
  };
}

function unprojectLocalAeqd(point, centerGeo) {
  const rho = Math.hypot(point.x, point.y);
  const lat0 = toRadians(centerGeo.lat);
  const lng0 = toRadians(centerGeo.lng);
  if (rho < 1e-9) {
    return normalizeGeo(centerGeo);
  }

  const c = rho / EARTH_RADIUS_METERS;
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const lat = Math.asin(Math.max(-1, Math.min(1, cosC * sinLat0 + (point.y * sinC * cosLat0) / rho)));
  const lng = lng0 + Math.atan2(point.x * sinC, rho * cosLat0 * cosC - point.y * sinLat0 * sinC);

  return normalizeGeo({ lat: toDegrees(lat), lng: toDegrees(lng) });
}

function projectWorldMercator(geo) {
  const safeLat = clampMercatorLatitude(geo.lat);
  const normalizedLng = normalizeLongitude(geo.lng);
  const latRadians = toRadians(safeLat);
  return {
    x: MERCATOR_RADIUS * toRadians(normalizedLng),
    y: MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + latRadians / 2))
  };
}

function unprojectMercator(x, y) {
  const lng = toDegrees(x / MERCATOR_RADIUS);
  const lat = toDegrees(2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2);
  return normalizeGeo({ lat, lng });
}

function normalizeGeo(geo) {
  const normalized = {
    lat: clampLatitude(Number(geo.lat)),
    lng: normalizeLongitude(Number(geo.lng))
  };

  if (Number.isFinite(geo.accuracy)) {
    normalized.accuracy = Number(geo.accuracy);
  }

  return normalized;
}

function validGeo(geo) {
  return Boolean(geo) && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng));
}

function pointGeo(point) {
  return validGeo(point.geo) ? normalizeGeo(point.geo) : unprojectMercator(point.x, point.y);
}

function clampLatitude(lat) {
  return Math.min(90, Math.max(-90, lat));
}

function clampMercatorLatitude(lat) {
  return Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
}

function normalizeLongitude(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function shortestLongitudeDelta(fromLng, toLng) {
  return ((((toLng - fromLng) + 540) % 360) + 360) % 360 - 180;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function isSameGeo(a, b) {
  return validGeo(a) && validGeo(b) && Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

async function readClipboardShare() {
  if (!navigator.clipboard?.readText) {
    elements.shareImportStatus.value = "このブラウザではクリップボードを読めません";
    return;
  }

  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    elements.shareImportStatus.value = "クリップボードの読み取りが許可されませんでした";
    return;
  }

  if (!text.trim()) {
    elements.shareImportStatus.value = "クリップボードが空です";
    return;
  }

  applySharedTextToForm(text, "クリップボードから読み取りました", "クリップボードから座標を読み取れません");
}

function applySharedTextToForm(text, successMessage, failureMessage) {
  const titleWasEmpty = !elements.pointTitle.value.trim();
  const result = parseSharedLocationPayload({
    text,
    title: elements.pointTitle.value
  });

  if (!result) {
    elements.shareImportStatus.value = shortMapUrlLikely(text) ? "短縮URLは展開できません" : failureMessage;
    return false;
  }

  applySharedLocationToForm(result, successMessage, { includeNote: false });
  if (titleWasEmpty) {
    elements.pointTitle.value = "クリップボード取得";
  }
  return true;
}

function handleIncomingShare() {
  const params = new URLSearchParams(window.location.search);
  const payload = {
    title: params.get("share_title") || params.get("title") || "",
    text: params.get("share_text") || params.get("text") || "",
    url: params.get("share_url") || params.get("url") || "",
    lat: params.get("lat") || params.get("latitude") || "",
    lng: params.get("lng") || params.get("lon") || params.get("longitude") || ""
  };
  const hasPayload = Object.values(payload).some((value) => typeof value === "string" && value.trim());

  if (!hasPayload) {
    return;
  }

  const result = parseSharedLocationPayload(payload);
  const sharedText = [payload.title, payload.text, payload.url].filter(Boolean).join("\n");

  if (!result) {
    elements.shareImportStatus.value = shortMapUrlLikely(sharedText)
      ? "短縮URLは展開できません"
      : "共有内容から座標を読み取れません";
    return;
  }

  applySharedLocationToForm(result, "共有地点を読み取りました");
}

function applySharedLocationToForm(result, message, options = {}) {
  pauseLocationFollowForManualView();
  const geo = normalizeGeo({ lat: result.lat, lng: result.lng });
  const projected = projectLatLng(geo.lat, geo.lng);

  state.mode = "add";
  state.pendingGeo = geo;
  state.editingPointId = null;
  state.pointDestinationListId = null;
  state.pendingLinkPointId = null;
  state.viewport.x = projected.x;
  state.viewport.y = projected.y;
  state.viewport.scale = Math.max(state.viewport.scale, 0.7);
  fillFormFromGeo(geo);

  if (result.title && !elements.pointTitle.value.trim()) {
    elements.pointTitle.value = result.title.slice(0, 80);
  }

  if (options.includeNote !== false && result.note && !elements.pointNote.value.trim()) {
    elements.pointNote.value = result.note;
  }

  elements.shareImportStatus.value = `${message}: ${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}`;
  openPointRegistrationDialog();
}

function parseSharedLocationPayload(payload) {
  const direct = coordinatesFromPair(payload.lat, payload.lng);
  if (direct) {
    return withShareMetadata(direct, payload);
  }

  const candidates = [payload.url, payload.text, payload.title]
    .filter((value) => typeof value === "string" && value.trim())
    .flatMap((value) => expandTextCandidates(value));

  for (const candidate of candidates) {
    const parsed = coordinatesFromText(candidate);
    if (parsed) {
      return withShareMetadata(parsed, payload);
    }
  }

  return null;
}

function expandTextCandidates(value) {
  const decoded = safelyDecode(value);
  const candidates = [value, decoded];
  const urls = decoded.match(/https?:\/\/\S+/g) ?? [];

  for (const url of urls) {
    candidates.push(url, safelyDecode(url));
  }

  return [...new Set(candidates)];
}

function coordinatesFromText(value) {
  const cardinal = coordinatesFromCardinalText(value);
  if (cardinal) {
    return cardinal;
  }

  const fromUrl = coordinatesFromUrl(value);
  if (fromUrl) {
    return fromUrl;
  }

  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:[,/?]|$)/i,
    /(?:^|[^\d.-])loc:(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /(?:^|[^\d.-])(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})(?:[^\d.]|$)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    const coordinates = match ? coordinatesFromPair(match[1], match[2]) : null;
    if (coordinates) {
      return coordinates;
    }
  }

  return null;
}

function coordinatesFromCardinalText(value) {
  const latFirst = value.match(/([北南NS])\s*(\d+(?:\.\d+)?)\s*[°º]?\s*[,、，]\s*([東西EW])\s*(\d+(?:\.\d+)?)\s*[°º]?/i);
  if (latFirst) {
    return coordinatesFromPair(
      signedCoordinate(latFirst[2], latFirst[1]),
      signedCoordinate(latFirst[4], latFirst[3])
    );
  }

  const lngFirst = value.match(/([東西EW])\s*(\d+(?:\.\d+)?)\s*[°º]?\s*[,、，]\s*([北南NS])\s*(\d+(?:\.\d+)?)\s*[°º]?/i);
  if (lngFirst) {
    return coordinatesFromPair(
      signedCoordinate(lngFirst[4], lngFirst[3]),
      signedCoordinate(lngFirst[2], lngFirst[1])
    );
  }

  return null;
}

function signedCoordinate(value, direction) {
  const sign = /[南西SW]/i.test(direction) ? -1 : 1;
  return sign * Number.parseFloat(value);
}
function coordinatesFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const params = url.searchParams;
  const pairKeys = ["q", "query", "ll", "center", "destination", "origin"];
  const direct = coordinatesFromPair(
    params.get("lat") || params.get("latitude"),
    params.get("lng") || params.get("lon") || params.get("longitude")
  );

  if (direct) {
    return direct;
  }

  for (const key of pairKeys) {
    const valueForKey = params.get(key);
    if (!valueForKey) {
      continue;
    }

    const coordinates = coordinatesFromText(valueForKey);
    if (coordinates) {
      return coordinates;
    }
  }

  return coordinatesFromText(url.pathname + url.hash);
}

function coordinatesFromPair(latValue, lngValue) {
  const lat = Number.parseFloat(String(latValue ?? "").trim());
  const lng = Number.parseFloat(String(lngValue ?? "").trim());

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

function withShareMetadata(coordinates, payload) {
  const title = guessSharedTitle(payload);
  const note = [payload.url, payload.text]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n")
    .slice(0, 1200);

  return {
    ...coordinates,
    title,
    note
  };
}

function guessSharedTitle(payload) {
  const values = [payload.title, payload.text]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());

  for (const value of values) {
    const firstLine = value.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (firstLine && !/^https?:\/\//i.test(firstLine) && !/^Google Maps$/i.test(firstLine)) {
      return firstLine;
    }
  }

  return "";
}

function safelyDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function shortMapUrlLikely(value) {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(value);
}

function activateWaitingServiceWorker(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

function renderWebVersion() {
  if (elements.systemUpdateVersion) {
    elements.systemUpdateVersion.textContent = t("systemUpdate.version") + " " + WEB_VERSION;
  }
  if (elements.webVersionBadge) {
    elements.webVersionBadge.textContent = "v" + WEB_VERSION;
  }
}
function setSystemUpdateStatus(key) {
  if (elements.systemUpdateStatus) {
    elements.systemUpdateStatus.textContent = t(key);
  }
}

function reloadGridAtlasPage() {
  if (window.__gridAtlasReloadStarted) return;
  window.__gridAtlasReloadStarted = true;
  const url = new URL(window.location.href);
  url.searchParams.set("gridatlas_update", String(Date.now()));
  window.location.replace(url.toString());
}

function reloadAfterSystemUpdateCheck() {
  setSystemUpdateStatus("systemUpdate.reloading");
  reloadGridAtlasPage();
}

function waitForPromiseWithTimeout(promise, timeoutMs, message) {
  let timeoutId = null;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

function waitForServiceWorkerActivation(worker) {
  return new Promise((resolve, reject) => {
    if (!worker || worker.state === "activated") {
      resolve();
      return;
    }

    let timeoutId = window.setTimeout(() => {
      finish(new Error("Service Worker update timed out"));
    }, 12000);

    function finish(error) {
      worker.removeEventListener("statechange", handleStateChange);
      window.clearTimeout(timeoutId);
      timeoutId = null;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }

    function handleStateChange() {
      if (worker.state === "installed") {
        worker.postMessage({ type: "SKIP_WAITING" });
      }
      if (worker.state === "activated") {
        finish();
      } else if (worker.state === "redundant") {
        finish(new Error("Service Worker update became redundant"));
      }
    }

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });
}

async function requestSystemUpdate() {
  if (!elements.systemUpdateButton || elements.systemUpdateButton.disabled) {
    return;
  }
  if (!("serviceWorker" in navigator)) {
    setSystemUpdateStatus("systemUpdate.unsupported");
    return;
  }

  elements.systemUpdateButton.disabled = true;
  setSystemUpdateStatus("systemUpdate.checking");
  let reloadStarted = false;

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js", {
      updateViaCache: "none"
    });
    let updateWorker = registration.waiting ?? registration.installing;
    const handleUpdateFound = () => {
      updateWorker = registration.installing ?? updateWorker;
    };

    registration.addEventListener("updatefound", handleUpdateFound);
    try {
      await waitForPromiseWithTimeout(
        registration.update(),
        12000,
        "Service Worker update check timed out"
      );
    } finally {
      registration.removeEventListener("updatefound", handleUpdateFound);
    }

    updateWorker = registration.waiting ?? registration.installing ?? updateWorker;
    if (updateWorker) {
      setSystemUpdateStatus("systemUpdate.applying");
      await waitForServiceWorkerActivation(updateWorker);
    } else {
      setSystemUpdateStatus("systemUpdate.latest");
      return;
    }

    reloadStarted = true;
    reloadAfterSystemUpdateCheck();
  } catch {
    setSystemUpdateStatus("systemUpdate.failed");
  } finally {
    if (!reloadStarted) {
      elements.systemUpdateButton.disabled = false;
    }
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const reloadOnControllerChange = Boolean(navigator.serviceWorker.controller);
  let reloadingForServiceWorker = false;
  const reloadForServiceWorker = () => {
    if (reloadingForServiceWorker) {
      return;
    }
    reloadingForServiceWorker = true;
    reloadGridAtlasPage();
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadOnControllerChange) {
      reloadForServiceWorker();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).then((registration) => {
      activateWaitingServiceWorker(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") {
            activateWaitingServiceWorker(registration);
          }
        });
      });
    }).catch(() => {});
  });
}
function selectedFiles(fileList) {
  return Array.from(fileList ?? []).filter(Boolean);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        resolve(JSON.parse(String(reader.result ?? "")));
      } catch (error) {
        reject(error);
      }
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Read failed")));
    reader.readAsText(file);
  });
}

function pointListGridAtlasDocument(list, options = {}) {
  list.gridAtlas = list.gridAtlas && typeof list.gridAtlas === "object" ? list.gridAtlas : {};
  list.gridAtlas.documentId = list.gridAtlas.documentId || list.cloudId || list.id || createId();

  const places = list.points.map((point) => {
    const geo = pointGeo(point);
    const place = {
      id: point.gridAtlas?.placeId || point.id,
      name: point.title || "Point",
      position: { latitude: geo.lat, longitude: geo.lng }
    };
    if (point.note) place.note = point.note;
    if (point.createdAt) place.createdAt = point.createdAt;
    if (point.updatedAt) place.updatedAt = point.updatedAt;
    if (point.gridAtlas?.extensions && Object.keys(point.gridAtlas.extensions).length > 0) {
      place.extensions = clonePlain(point.gridAtlas.extensions);
    }
    return place;
  });

  const document = {
    type: "place-list",
    schemaVersion: 1,
    id: list.gridAtlas.documentId,
    name: list.name || "地点リスト",
    places
  };
  if (list.description) document.description = list.description;
  if (list.author) document.attribution = { name: list.author };
  if (list.createdAt) document.createdAt = list.createdAt;
  if (list.updatedAt) document.updatedAt = list.updatedAt;
  const documentExtensions = withoutGridAtlasAnalysisLayer(list.gridAtlas.documentExtensions);
  if (Object.keys(documentExtensions).length > 0) {
    document.extensions = documentExtensions;
  }

  const analysisLayer = buildGridAtlasAnalysisLayer(list.lines, list.figures);
  if (analysisLayer) {
    document.extensions = {
      ...(document.extensions || {}),
      [GRIDATLAS_ANALYSIS_EXTENSION]: analysisLayer
    };
  }
  return document;
}

async function buildPointListGridAtlasPackage(list, options = {}) {
  const document = pointListGridAtlasDocument(list, options);
  const resources = [];
  const supportedMediaTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  for (const [index, point] of list.points.entries()) {
    let asset = point.photoAssetId ? await getGridAtlasAsset(point.photoAssetId) : null;
    let blob = asset?.blob instanceof Blob ? asset.blob : null;
    if (!blob && typeof point.photo === "string" && point.photo.startsWith("data:")) {
      blob = await dataUrlToBlob(point.photo);
    }
    if (!blob) continue;

    const mediaType = asset?.mediaType || blob.type;
    if (!supportedMediaTypes.has(mediaType)) continue;
    const resourceId = `photo-${index}-${safeFilenamePart(point.gridAtlas?.placeId || point.id)}`;
    const extension = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
    document.places[index].media = [{ resourceId, role: "photo" }];
    resources.push({
      id: resourceId,
      path: `assets/${resourceId}.${extension}`,
      mediaType,
      bytes: new Uint8Array(await blob.arrayBuffer())
    });
  }

  return buildGridAtlasArchive(document, resources);
}

function downloadGridAtlasFile(file) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function requestConfirm(options = {}) {
  const dialog = elements.confirmDialog;
  if (!dialog?.showModal) {
    return Promise.resolve(false);
  }

  if (pendingConfirmResolve) {
    const resolve = pendingConfirmResolve;
    pendingConfirmResolve = null;
    resolve(false);
  }
  if (dialog.open) {
    dialog.close("cancel");
  }

  elements.confirmDialogTitle.textContent = options.title || cloudText("確認", "Confirm");
  elements.confirmDialogMessage.textContent = options.message || "";
  elements.confirmDialogCancelButton.textContent = options.cancelLabel || t("action.cancel");
  const choiceButtons = [
    elements.confirmDialogDeleteLinksButton,
    elements.confirmDialogDeletePointsButton,
    elements.confirmDialogDeleteFiguresButton,
    elements.confirmDialogDeleteAllButton
  ];
  const choices = Array.isArray(options.choices) ? options.choices : null;
  const choiceMode = choices !== null;
  for (const [index, button] of choiceButtons.entries()) {
    button.hidden = !choiceMode || index >= (choices?.length ?? 0);
  }
  elements.confirmDialogConfirmButton.hidden = choiceMode;
  elements.confirmDialogConfirmButton.textContent = options.confirmLabel || t("action.delete");
  elements.confirmDialogConfirmButton.classList.toggle("danger-button", options.danger !== false);
  if (choiceMode) {
    for (const [index, choice] of choices.entries()) {
      const button = choiceButtons[index];
      if (!button) continue;
      button.value = choice.value;
      button.textContent = choice.label;
      button.classList.toggle("danger-button", options.danger !== false);
    }
  }

  const result = new Promise((resolve) => {
    pendingConfirmResolve = resolve;
  });
  dialog.showModal();
  (choiceMode ? choiceButtons.find((button) => !button.hidden) : elements.confirmDialogConfirmButton)?.focus();
  return result.then((value) => choiceMode ? value : value === "confirm");
}

function requestTextInput(options = {}) {
  const dialog = elements.textInputDialog;
  if (!dialog?.showModal) {
    return Promise.resolve(null);
  }

  if (pendingTextInputResolve) {
    const resolve = pendingTextInputResolve;
    pendingTextInputResolve = null;
    pendingTextInputOptions = null;
    resolve(null);
  }
  if (dialog.open) {
    dialog.close("cancel");
  }

  elements.textInputDialogTitle.textContent = options.title || cloudText("入力", "Input");
  elements.textInputDialogMessage.textContent = options.message || "";
  elements.textInputDialogMessage.hidden = !options.message;
  elements.textInputDialogLabel.textContent = options.label || cloudText("名前", "Name");
  const multiline = options.multiline === true && elements.textInputDialogText;
  elements.textInputDialogValue.hidden = Boolean(multiline);
  elements.textInputDialogText.hidden = !multiline;
  if (multiline) {
    elements.textInputDialogText.value = options.defaultValue ?? "";
    elements.textInputDialogText.maxLength = options.maxLength ?? 500;
  } else {
    elements.textInputDialogValue.value = options.defaultValue ?? "";
    elements.textInputDialogValue.maxLength = options.maxLength ?? 80;
  }
  elements.textInputDialogSubmitButton.textContent = options.submitLabel || cloudText("決定", "Done");
  elements.textInputDialogDefaultActions.hidden = options.shareMode === true;
  elements.textInputDialogShareActions.hidden = options.shareMode !== true;
  if (elements.textInputShareCloudButton) {
    elements.textInputShareCloudButton.hidden = options.shareMode !== true || !state.cloud.connected;
  }

  const result = new Promise((resolve) => {
    pendingTextInputResolve = resolve;
    pendingTextInputOptions = options;
  });
  dialog.showModal();
  const inputElement = multiline ? elements.textInputDialogText : elements.textInputDialogValue;
  inputElement.focus();
  inputElement.select();
  return result;
}

function textInputDialogValue(options = {}) {
  return options.multiline && elements.textInputDialogText
    ? elements.textInputDialogText.value
    : elements.textInputDialogValue.value;
}

function showAppToast(message, options = {}) {
  if (!elements.appToast || !message) return;
  window.clearTimeout(appToastTimerId);
  elements.appToast.textContent = message;
  elements.appToast.classList.toggle("is-error", options.error === true);
  if (!elements.appToast.open) elements.appToast.show();
  appToastTimerId = window.setTimeout(() => {
    if (elements.appToast.open) elements.appToast.close();
    elements.appToast.textContent = "";
  }, options.duration ?? 4200);
}

function setShareFeedback(message, options = {}) {
  setCloudStatus(message, { menu: false, error: options.error === true });
  showAppToast(message, options);
}

async function sharePointListFile(list, options = {}) {
  if (!list) {
    setShareFeedback(t("list.shareUnavailable"), { error: true });
    return;
  }

  const title = list.name || "地点リスト";
  const summary = t("list.exportSummary")
    .replace("{name}", title)
    .replace("{count}", String(list.points.length));
  if (options.confirm !== false) {
    const confirmed = await requestConfirm({
      title: t("list.exportDialogTitle"),
      message: `${summary}\n${t("list.exportPrivacy")}\n\n${t("list.exportConfirm")}`,
      confirmLabel: t("list.export"),
      danger: false
    });
    if (!confirmed) return;
  }

  try {
    const archive = await buildPointListGridAtlasPackage(list, options);
    persistWorkspace();
    const file = new File([archive.bytes], `${safeFilenamePart(title)}.gridatlas`, { type: GRIDATLAS_MIME_TYPE });
    const canShareFile = typeof navigator.share === "function"
      && (!navigator.canShare || navigator.canShare({ files: [file] }));
    if (canShareFile) {
      try {
        await navigator.share({
          files: [file],
          title: `GRID ATLAS — ${title}`,
          text: cloudText(`GRID ATLAS「${title}」`, `GRID ATLAS “${title}”`)
        });
        setShareFeedback(t("list.exportCompleted"));
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.warn("GRID ATLAS file share failed; falling back to download", error);
      }
    }
    downloadGridAtlasFile(file);
    setShareFeedback(t("list.exported"));
  } catch (error) {
    console.warn("GRID ATLAS file export failed", error);
    setShareFeedback(t("list.exportFailed"), { error: true });
  }
}

async function shareStorageListFile(storageId) {
  const entry = findStorageListEntry(storageId);
  const list = entry?.local || entry?.preview;
  if (!list) return;
  const input = await requestTextInput({
    title: t("list.shareSelectedNamePrompt"),
    message: t("list.exportPrivacy"),
    label: t("field.name"),
    defaultValue: list.name || t("list.shareSelectedDefaultName"),
    submitLabel: t("action.shareSelected"),
    shareMode: true
  });
  if (!input) return;
  const name = input.value.trim() || list.name || t("list.shareSelectedDefaultName");
  const shareList = { ...clonePlain(list), name };
  if (input.action === "file") await sharePointListFile(shareList, { confirm: false });
  if (input.action === "image") await shareSelectedSnapshot(shareList.points || [], [], [], name, shareList.points || []);
  if (input.action === "cloud") await shareSelectedCloud(shareList);
}

function shareSnapshotTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#18322b";
}

function shareSnapshotSurfaceColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#fffdf7";
}

const SHARE_SNAPSHOT_WIDTH = 1200;
const SHARE_SNAPSHOT_HEIGHT = 1200;
const SHARE_SNAPSHOT_HEADER_HEIGHT = 122;
const SHARE_SNAPSHOT_FRAME = Object.freeze({ left: 50, top: 154, right: 1150, bottom: 1158 });
const SHARE_SNAPSHOT_MIN_SPAN_METERS = 2500;

function shareSnapshotAppUrl() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  if (canonical) return canonical;
  try {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "https://gridatlas.github.io/GRID_ATLAS/";
  }
}

function drawShareSnapshotGrid(target, palette) {
  target.fillStyle = shareSnapshotSurfaceColor();
  target.fillRect(0, 0, SHARE_SNAPSHOT_WIDTH, SHARE_SNAPSHOT_HEIGHT);
  target.strokeStyle = palette.gridMinor || "#d7e4df";
  target.lineWidth = 1;
  for (let x = 0; x <= SHARE_SNAPSHOT_WIDTH; x += 30) {
    target.beginPath(); target.moveTo(x, 0); target.lineTo(x, SHARE_SNAPSHOT_HEIGHT); target.stroke();
  }
  for (let y = 0; y <= SHARE_SNAPSHOT_HEIGHT; y += 30) {
    target.beginPath(); target.moveTo(0, y); target.lineTo(SHARE_SNAPSHOT_WIDTH, y); target.stroke();
  }
  target.save();
  const darkTheme = currentTheme() === RETRO_THEME || currentTheme() === KEKKAI_THEME;
  target.fillStyle = darkTheme ? "rgb(0 0 0 / 42%)" : "rgb(255 255 255 / 64%)";
  target.fillRect(0, 0, SHARE_SNAPSHOT_WIDTH, SHARE_SNAPSHOT_HEADER_HEIGHT);
  target.globalAlpha = 0.78;
  target.strokeStyle = palette.gridMajor || palette.link;
  target.lineWidth = 2;
  target.beginPath();
  target.moveTo(0, SHARE_SNAPSHOT_HEADER_HEIGHT);
  target.lineTo(SHARE_SNAPSHOT_WIDTH, SHARE_SNAPSHOT_HEADER_HEIGHT);
  target.stroke();
  target.restore();
}

function drawShareSnapshotRoundedRect(target, x, y, width, height, radius) {
  target.beginPath();
  if (typeof target.roundRect === "function") {
    target.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  target.moveTo(x + r, y);
  target.arcTo(x + width, y, x + width, y + height, r);
  target.arcTo(x + width, y + height, x, y + height, r);
  target.arcTo(x, y + height, x, y, r);
  target.arcTo(x, y, x + width, y, r);
  target.closePath();
}

function drawShareSnapshotLabel(target, label, screen, textColor, surfaceColor, palette, options = {}) {
  const text = String(label || "").trim();
  if (!text) return;

  const maxChars = options.maxChars || 28;
  const clipped = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  target.save();
  target.font = options.font || "700 11px system-ui, sans-serif";
  target.textBaseline = "middle";
  const maxWidth = options.maxWidth || 220;
  const boxWidth = Math.min(maxWidth, target.measureText(clipped).width + 12);
  const boxHeight = options.height || 20;
  const isTopCentered = options.anchor === "top-center";
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? (isTopCentered ? -10 : -8);
  const x = isTopCentered
    ? Math.min(Math.max(screen.x - boxWidth / 2 + offsetX, 12), SHARE_SNAPSHOT_WIDTH - boxWidth - 12)
    : Math.min(Math.max(screen.x + offsetX, 12), SHARE_SNAPSHOT_WIDTH - boxWidth - 12);
  const y = isTopCentered
    ? Math.min(Math.max(screen.y - boxHeight + offsetY, 12), SHARE_SNAPSHOT_FRAME.bottom - boxHeight - 8)
    : Math.min(Math.max(screen.y + offsetY, 12), SHARE_SNAPSHOT_FRAME.bottom - boxHeight - 8);

  target.globalAlpha = 0.92;
  target.fillStyle = surfaceColor;
  target.shadowColor = "rgb(0 0 0 / 16%)";
  target.shadowBlur = 4;
  target.shadowOffsetY = 2;
  drawShareSnapshotRoundedRect(target, x, y, boxWidth, boxHeight, 6);
  target.fill();
  target.shadowColor = "transparent";
  target.shadowBlur = 0;
  target.shadowOffsetY = 0;
  target.globalAlpha = 0.82;
  target.strokeStyle = palette.gridMajor || palette.link || textColor;
  target.lineWidth = 1;
  target.stroke();
  target.globalAlpha = 1;
  target.fillStyle = textColor;
  target.textAlign = isTopCentered ? "center" : "left";
  target.fillText(clipped, isTopCentered ? x + boxWidth / 2 : x + 9, y + boxHeight / 2);
  target.restore();
}

function drawShareSnapshotBrand(target, palette, textColor) {
  const kekkai = currentTheme() === KEKKAI_THEME;
  target.save();
  target.fillStyle = palette.pointFill || palette.link || "#23ff5e";
  target.beginPath();
  if (kekkai) {
    target.save();
    target.translate(86, 70);
    target.rotate(Math.PI / 4);
    target.fillRect(-10, -10, 20, 20);
    target.restore();
  } else {
    target.arc(86, 70, 14, 0, Math.PI * 2);
    target.fill();
  }
  target.fillStyle = textColor;
  target.textAlign = "left";
  target.textBaseline = "alphabetic";
  target.font = kekkai ? "800 29px system-ui, sans-serif" : "800 32px system-ui, sans-serif";
  target.fillText(kekkai ? "結界アトラス" : "GRID ATLAS", 114, 82);
  target.textAlign = "right";
  target.font = "600 13px system-ui, sans-serif";
  target.fillText(shareSnapshotAppUrl().replace(/^https?:\/\//, ""), 1120, 48);
  target.font = "800 14px system-ui, sans-serif";
  target.fillText("#GRIDATLAS", 1120, 80);
  target.restore();
}

function formatShareSnapshotArea(area) {
  return Number.isFinite(area) && area >= 0 ? formatArea(area) : t("analysis.areaUnavailableShort");
}

function formatShareSnapshotPerimeter(distance) {
  if (!Number.isFinite(distance) || distance < 0) return "-";
  if (state.distanceUnit === IMPERIAL_UNIT) {
    const miles = Math.round(distance / 1609.344).toLocaleString(localeName());
    return activeLanguage() === EN_LANGUAGE ? `~${miles} mi` : `約${miles}mi`;
  }
  const kilometers = Math.round(distance / 1000).toLocaleString(localeName());
  return activeLanguage() === EN_LANGUAGE ? `~${kilometers} km` : `約${kilometers}km`;
}

function shareSnapshotGeo(value) {
  if (validGeo(value?.geo)) return normalizeGeo(value.geo);
  if (validGeo(value)) return normalizeGeo(value);
  if (Number.isFinite(Number(value?.x)) && Number.isFinite(Number(value?.y))) return pointGeo(value);
  return null;
}

function shareSnapshotPointAtGeo(geo, visiblePoints) {
  if (!validGeo(geo)) return null;
  return visiblePoints.find((point) => {
    const pointGeoValue = shareSnapshotGeo(point);
    return pointGeoValue && isSameGeo(geo, pointGeoValue);
  }) || null;
}

function shareSnapshotVertexLabel(vertex, visiblePoints) {
  if (vertex.markerKind === "point") return String(vertex.title || "").trim();
  return String(shareSnapshotPointAtGeo(vertex.geo, visiblePoints)?.title || "").trim();
}

async function renderSelectedShareImage(points, lines, figures, visiblePoints = []) {
  const pointVertices = points.map((point) => ({
    ...point,
    geo: shareSnapshotGeo(point),
    title: point.title,
    markerKind: "point"
  }));
  const lineVertices = lines.flatMap((line) => {
    const endpoints = linkEndpoints(line);
    return endpoints ? [endpoints.a, endpoints.b].map((vertex) => ({ ...vertex, markerKind: "line-vertex" })) : [];
  });
  const figureVertices = figures.flatMap((figure) => figureRuntimeVertices(figure)
    .map((vertex, index) => ({ ...vertex, markerKind: "figure-vertex", figureId: figure.id, vertexIndex: index })));
  const snapshotVertices = [...pointVertices, ...lineVertices, ...figureVertices]
    .map((vertex) => {
      const geo = shareSnapshotGeo(vertex);
      return geo ? { ...vertex, geo } : null;
    })
    .filter(Boolean);
  if (snapshotVertices.length === 0) throw new Error("Snapshot geometry unavailable");

  const projectedWorldVertices = snapshotVertices.map((vertex) => ({
    ...vertex,
    world: projectLatLng(vertex.geo.lat, vertex.geo.lng)
  }));
  const minX = Math.min(...projectedWorldVertices.map((vertex) => vertex.world.x));
  const maxX = Math.max(...projectedWorldVertices.map((vertex) => vertex.world.x));
  const minY = Math.min(...projectedWorldVertices.map((vertex) => vertex.world.y));
  const maxY = Math.max(...projectedWorldVertices.map((vertex) => vertex.world.y));
  const spanX = Math.max(maxX - minX, SHARE_SNAPSHOT_MIN_SPAN_METERS);
  const spanY = Math.max(maxY - minY, SHARE_SNAPSHOT_MIN_SPAN_METERS);
  const pad = Math.max(spanX, spanY) * 0.07;
  const frameWidth = SHARE_SNAPSHOT_FRAME.right - SHARE_SNAPSHOT_FRAME.left;
  const frameHeight = SHARE_SNAPSHOT_FRAME.bottom - SHARE_SNAPSHOT_FRAME.top;
  const scale = Math.min(frameWidth / (spanX + pad * 2), frameHeight / (spanY + pad * 2));
  const centerWorld = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const centerScreen = {
    x: (SHARE_SNAPSHOT_FRAME.left + SHARE_SNAPSHOT_FRAME.right) / 2,
    y: (SHARE_SNAPSHOT_FRAME.top + SHARE_SNAPSHOT_FRAME.bottom) / 2
  };
  const project = (geo) => {
    const world = projectLatLng(geo.lat, geo.lng);
    return {
      x: centerScreen.x + (world.x - centerWorld.x) * scale,
      y: centerScreen.y - (world.y - centerWorld.y) * scale
    };
  };
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_SNAPSHOT_WIDTH;
  canvas.height = SHARE_SNAPSHOT_HEIGHT;
  const target = canvas.getContext("2d");
  const palette = canvasPalette();
  const textColor = shareSnapshotTextColor();
  const surfaceColor = shareSnapshotSurfaceColor();
  const labelPoints = points.length > 0 ? points : visiblePoints;
  drawShareSnapshotGrid(target, palette);

  for (const figure of figures) {
    const projected = figureRuntimeVertices(figure).map((vertex) => project(vertex.geo));
    if (projected.length < 3) continue;
    target.save();
    target.beginPath();
    target.moveTo(projected[0].x, projected[0].y);
    for (const point of projected.slice(1)) target.lineTo(point.x, point.y);
    target.closePath();
    target.globalAlpha = 0.2;
    target.fillStyle = normalizeGridAtlasLineColor(figure.color) || palette.link;
    target.fill();
    target.restore();
    if (figure.name) {
      const center = projected.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
      drawShareSnapshotLabel(
        target,
        figure.name,
        { x: center.x / projected.length, y: center.y / projected.length },
        textColor,
        surfaceColor,
        palette,
        { offsetX: 8, offsetY: -8 }
      );
    }
  }

  target.lineWidth = 4;
  for (const line of lines) {
    const endpoints = linkEndpoints(line);
    if (!endpoints) continue;
    const a = project(endpoints.a.geo);
    const b = project(endpoints.b.geo);
    target.strokeStyle = normalizeGridAtlasLineColor(line.color) || palette.link;
    target.beginPath(); target.moveTo(a.x, a.y); target.lineTo(b.x, b.y); target.stroke();
  }

  const markers = new Map();
  for (const vertex of snapshotVertices) {
    const matchingPoint = shareSnapshotPointAtGeo(vertex.geo, labelPoints);
    const isSelectedPoint = vertex.markerKind === "point";
    const hasDisplayedPoint = Boolean(matchingPoint);
    const keyGeo = matchingPoint ? shareSnapshotGeo(matchingPoint) : vertex.geo;
    const key = `geo:${keyGeo.lat.toFixed(6)}:${keyGeo.lng.toFixed(6)}`;
    const label = shareSnapshotVertexLabel(vertex, labelPoints);
    const markerKind = isSelectedPoint || hasDisplayedPoint ? "point" : vertex.markerKind;
    const existing = markers.get(key);
    if (!existing || isSelectedPoint || (hasDisplayedPoint && existing.markerKind !== "point")) {
      markers.set(key, { ...vertex, label, markerKind });
    } else if (!existing.label && label) {
      existing.label = label;
    }
  }
  for (const marker of markers.values()) {
    const screen = project(marker.geo);
    const isPoint = marker.markerKind === "point";
    target.save();
    target.beginPath();
    if (isPoint) {
      target.arc(screen.x, screen.y, 10, 0, Math.PI * 2);
    } else {
      target.moveTo(screen.x, screen.y - 8);
      target.lineTo(screen.x + 8, screen.y);
      target.lineTo(screen.x, screen.y + 8);
      target.lineTo(screen.x - 8, screen.y);
      target.closePath();
    }
    target.fillStyle = isPoint ? palette.pointFill : surfaceColor;
    target.fill();
    target.strokeStyle = isPoint ? palette.pointBaseStroke : palette.link;
    target.lineWidth = isPoint ? 3 : 2;
    target.stroke();
    target.restore();
    drawShareSnapshotLabel(
      target,
      marker.label,
      screen,
      textColor,
      surfaceColor,
      palette,
      isPoint
        ? { anchor: "top-center", font: "700 18px system-ui, sans-serif", maxWidth: 280, height: 30, offsetY: -10 }
        : { font: "600 12px system-ui, sans-serif", maxWidth: 240, height: 22 }
    );
  }

  const analyses = [];
  for (const figure of figures) {
    const result = analyzeSegmentShape(figureSegments(figure));
    if (result?.valid) {
      analyses.push({ figure, result });
    }
  }
  if (analyses.length > 0) {
    const { result } = analyses[0];
    target.save();
    const analysisRight = 1130;
    const scoreCenter = 1040;
    const scoreY = 1088;
    const scoreLabelY = 1014;
    const displayFont = "'Avenir Next', 'Helvetica Neue', 'Trebuchet MS', 'Segoe UI', sans-serif";
    const textFont = "'Yu Gothic', 'Hiragino Sans', 'Segoe UI', sans-serif";
    target.textBaseline = "alphabetic";
    target.shadowColor = "rgb(0 0 0 / 52%)";
    target.shadowBlur = 4;
    target.shadowOffsetY = 2;
    target.fillStyle = textColor;
    target.globalAlpha = 0.88;
    target.font = `500 13px ${textFont}`;
    target.textAlign = "right";
    target.fillText(`${t("analysis.area")} ${formatShareSnapshotArea(result.area)}   ${t("analysis.perimeterDisplay")} ${formatShareSnapshotPerimeter(result.perimeter)}`, analysisRight, 1122);

    const scoreText = String(Math.round(result.referenceScore));
    const scoreSuffix = "/100";
    const scoreGap = 14;
    const scoreFont = `600 78px ${displayFont}`;
    const scoreSuffixFont = `500 22px ${displayFont}`;
    target.font = scoreFont;
    const scoreWidth = target.measureText(scoreText).width;
    target.font = scoreSuffixFont;
    const suffixWidth = target.measureText(scoreSuffix).width;
    const scoreLeft = scoreCenter - (scoreWidth + scoreGap + suffixWidth) / 2;
    const scoreNumberCenter = scoreLeft + scoreWidth / 2;

    target.globalAlpha = 0.9;
    target.font = `500 18px ${textFont}`;
    target.textAlign = "center";
    target.fillText(t("analysis.regularityScore"), scoreNumberCenter, scoreLabelY);
    target.fillStyle = palette.pointFill || palette.link || textColor;
    target.globalAlpha = 1;
    target.fillStyle = textColor;
    target.globalAlpha = 0.82;
    target.textAlign = "left";
    target.fillStyle = palette.pointFill || palette.link || textColor;
    target.globalAlpha = 1;
    target.font = scoreFont;
    target.fillText(scoreText, scoreLeft, scoreY);
    target.fillStyle = textColor;
    target.globalAlpha = 0.82;
    target.font = scoreSuffixFont;
    target.fillText(scoreSuffix, scoreLeft + scoreWidth + scoreGap, scoreY - 4);
    target.globalAlpha = 0.9;
    target.fillStyle = textColor;
    target.font = `500 14px ${textFont}`;
    target.textAlign = "right";
    target.fillText(`${t("analysis.angleVariation")} ${formatAngle(result.maxAngleDeviation)} (${formatPercent(result.maxAngleDeviationPercent)})   ${t("analysis.sideVariation")} ${formatPercent(result.sideRangePercent)}`, analysisRight, 1150);
    target.globalAlpha = 0.72;
    target.font = `400 12px ${textFont}`;
    target.fillText(t("analysis.referenceScoreDefinition"), analysisRight, 1180);
    target.restore();
  }
  drawShareSnapshotBrand(target, palette, textColor);
  return canvasToPngBlob(canvas);
}

async function shareSelectedSnapshot(points, lines, figures, name, visiblePoints = []) {
  const blob = await renderSelectedShareImage(points, lines, figures, visiblePoints);
  const file = new File([blob], `grid-atlas-${safeFilenamePart(name || "snapshot")}.png`, { type: "image/png" });
  const preview = await requestShareImagePreview(blob);
  if (!preview) return;
  const canShareFile = typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }));
  if (canShareFile) {
    try {
      await navigator.share({ files: [file], title: `GRID ATLAS — ${name}`, text: `GRID ATLAS「${name}」 #GRIDATLAS` });
      setShareFeedback(t("list.exportImageShared"));
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("GRID ATLAS snapshot share failed; falling back to download", error);
    }
  }
  downloadGridAtlasFile(file);
  setShareFeedback(t("list.exportImageDownloaded"));
}

function requestShareImagePreview(blob) {
  const dialog = elements.shareImagePreviewDialog;
  const image = elements.shareImagePreviewImage;
  if (!dialog || !image) return Promise.resolve(true);
  const url = URL.createObjectURL(blob);
  image.src = url;
  dialog.showModal();
  return new Promise((resolve) => {
    const finish = () => {
      dialog.removeEventListener("close", finish);
      URL.revokeObjectURL(url);
      image.removeAttribute("src");
      resolve(dialog.returnValue === "confirm");
    };
    dialog.addEventListener("close", finish, { once: true });
  });
}

async function shareSelectedCloud(list) {
  try {
    const client = cloudClientFromInputs();
    const response = await client.createShare(
      list?.type === "place-list" ? list : pointListGridAtlasDocument(list),
      list.name,
      90
    );
    const shareId = response?.share?.id;
    if (!shareId) throw new Error("共有IDがありません");
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set(CLOUD_SHARE_URL_PARAMETER, shareId);
    if (!(await writeClipboardText(url))) throw new Error("クリップボードへコピーできませんでした");
    await refreshCloudShares();
    setShareFeedback(t("list.exportCloudCreated"));
  } catch (error) {
    console.warn("GRID ATLAS cloud share failed", error);
    setShareFeedback(error?.message || t("list.shareUnavailable"), { error: true });
  }
}

async function shareSelectedPointsFile(options = {}) {
  normalizeSelection();
  const visiblePointsAtShare = visibleSelectablePoints()
    .filter((point) => point.id !== CURRENT_LOCATION_ID)
    .map((point) => ({ ...point, geo: shareSnapshotGeo(point) }))
    .filter((point) => validGeo(point.geo));
  const points = Array.isArray(options.points) ? options.points : selectedPointIds()
    .filter((pointId) => pointId !== CURRENT_LOCATION_ID)
    .map(findPoint)
    .filter(Boolean);
  const lines = Array.isArray(options.lines) ? options.lines : selectedLinkIds().map(findLink).filter(Boolean);
  const figures = Array.isArray(options.figures) ? options.figures : selectedFigureIds().map(findFigure).filter(Boolean);
  if (points.length === 0 && lines.length === 0 && figures.length === 0) {
    setShareFeedback(t("list.shareSelectedUnavailable"), { error: true });
    return;
  }

  const defaultName = options.defaultName || t("list.shareSelectedDefaultName");
  const input = await requestTextInput({
    title: t("list.shareSelectedNamePrompt"),
    message: t("list.exportPrivacy"),
    label: t("field.name"),
    defaultValue: defaultName,
    submitLabel: t("action.shareSelected"),
    shareMode: true
  });
  if (input === null) return;
  const name = input.value.trim() || defaultName;
  const now = new Date().toISOString();
  const list = {
    id: createId(),
    name,
    description: "",
    author: "",
    createdAt: now,
    updatedAt: now,
    gridAtlas: { documentId: createId() },
    points: points.map(clonePlain),
    lines: lines.map(clonePlain),
    figures: figures.map(clonePlain)
  };
  const shareOptions = { confirm: false };
  if (input.action === "file") await sharePointListFile(list, shareOptions);
  if (input.action === "image") await shareSelectedSnapshot(points, lines, figures, name, visiblePointsAtShare);
  if (input.action === "cloud") await shareSelectedCloud(list);
}

async function shareSelectedBarrierFigure() {
  const barrier = state.selectedBarrierId ? state.traverseLog?.barriers?.[state.selectedBarrierId] : null;
  const figure = barrier ? barrierFigureForId(state.selectedBarrierId) : null;
  if (!figure) {
    setShareFeedback(t("list.shareSelectedUnavailable"), { error: true });
    return;
  }
  await shareSelectedPointsFile({
    figures: [figure],
    defaultName: barrier.name || t("barrier.defaultName")
  });
}

function gridAtlasFileLikely(file) {
  return Boolean(file) && (
    String(file.name || "").toLowerCase().endsWith(".gridatlas")
    || file.type === "application/vnd.gridatlas+zip"
    || file.type === "application/zip"
    || file.type === "application/x-zip-compressed"
    || file.type === "application/octet-stream"
  );
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image read failed")));
    reader.readAsDataURL(blob);
  });
}

function analysisLayerFromGridAtlasDocument(document, pointList) {
  const localPointIdBySharedId = new Map(pointList.points.map((point) => [
    point.gridAtlas?.placeId || point.id,
    point.id
  ]));
  const importedLayer = readGridAtlasAnalysisLayer(document);
  const remapVertex = (vertex) => {
    const normalized = normalizeAnalysisVertex(vertex);
    if (!normalized) return null;
    const localPlaceRef = normalized.placeRef
      ? (localPointIdBySharedId.get(normalized.placeRef) || normalized.placeRef)
      : null;
    return normalizeAnalysisVertex({ ...normalized, placeRef: localPlaceRef });
  };
  return {
    lines: importedLayer.lines
      .map((line) => normalizeAnalysisLine({
        ...line,
        a: remapVertex(line.a),
        b: remapVertex(line.b)
      }))
      .filter(Boolean),
    figures: importedLayer.figures
      .map((figure) => normalizeAnalysisFigure({
        ...figure,
        vertices: figure.vertices.map(remapVertex).filter(Boolean)
      }))
      .filter(Boolean)
  };
}

async function gridAtlasPackageToPointList(gridAtlasPackage, existingPointIds, existingListIds, options = {}) {
  const { document, manifest, resources } = gridAtlasPackage;
  const documentDigest = gridAtlasPackage.documentDigest || await gridAtlasDocumentDigest(document);
  const resourceData = new Map();
  for (const [resourceId, resource] of resources) {
    const sourceBlob = new Blob([resource.bytes], { type: resource.metadata.mediaType });
    const sourceDataUrl = await readBlobAsDataUrl(sourceBlob);
    const sanitizedDataUrl = await resizeImage(sourceDataUrl);
    const blob = await dataUrlToBlob(sanitizedDataUrl);
    let storedAsset = null;
    let displayUrl = "";
    try {
      storedAsset = await putGridAtlasAsset(blob, {
        mediaType: blob.type || resource.metadata.mediaType,
        name: resource.metadata.path?.split("/").pop() || ""
      });
      displayUrl = await gridAtlasAssetUrl(storedAsset.id);
    } catch (error) {
      console.warn("GRID ATLAS imported asset storage failed; keeping local fallback", error);
      displayUrl = sanitizedDataUrl;
    }
    resourceData.set(resourceId, {
      metadata: clonePlain(resource.metadata),
      assetId: storedAsset?.id || "",
      dataUrl: storedAsset ? "" : displayUrl,
      displayUrl
    });
  }

  let listId = document.id;
  while (!listId || listId === DEFAULT_POINT_LIST_ID || existingListIds.has(listId)) {
    listId = createId();
  }
  existingListIds.add(listId);

  const points = document.places.map((place) => {
    const media = Array.isArray(place.media) ? place.media : [];
    const primaryMedia = media.find((item) => item.role === "photo") ?? media[0] ?? null;
    const primaryResource = primaryMedia ? resourceData.get(primaryMedia.resourceId) : null;
    const createdAt = place.createdAt || place.updatedAt || new Date().toISOString();
    return {
      id: place.id,
      title: place.name,
      note: typeof place.note === "string" ? place.note : "",
      photo: primaryResource?.displayUrl || "",
      photoName: primaryResource?.metadata?.path?.split("/").pop() || "",
      photoAssetId: primaryResource?.assetId || "",
      geo: {
        lat: place.position.latitude,
        lng: place.position.longitude
      },
      createdAt,
      updatedAt: place.createdAt && place.updatedAt ? place.updatedAt : "",
      gridAtlas: {
        placeId: place.id,
        media: clonePlain(media),
        extensions: clonePlain(place.extensions ?? {})
      }
    };
  });

  const displayName = options.conflict && !options.preserveName
    ? `${document.name}${cloudText("（更新版）", " (updated)")}`
    : document.name;
  const createdAt = document.createdAt || new Date().toISOString();
  const pointList = normalizePointList({
    id: listId,
    name: displayName,
    description: document.description || "",
    author: document.attribution?.name || "",
    visible: true,
    editable: false,
    source: "import",
    importedAt: new Date().toISOString(),
    createdAt,
    updatedAt: document.updatedAt || createdAt,
    points,
    gridAtlas: {
      documentId: document.id,
      documentDigest,
      documentMedia: clonePlain(document.media ?? []),
      documentExtensions: clonePlain(document.extensions ?? {}),
      requiredExtensions: clonePlain(manifest?.requiredExtensions ?? []),
      resources: Array.from(resourceData.values(), (resource) => ({
        metadata: clonePlain(resource.metadata),
        assetId: resource.assetId,
        dataUrl: resource.dataUrl
      }))
    }
  }, existingPointIds, displayName);

  const analysis = analysisLayerFromGridAtlasDocument(document, pointList);
  pointList.lines = analysis.lines;
  pointList.figures = analysis.figures;
  return { list: pointList };
}

function analysisLinkPairKey(link) {
  return linkEndpointPairKey(link);
}

function mergeAnalysisIntoList(list, analysis) {
  if (!list) return;
  const nextLines = Array.isArray(list.lines) ? list.lines.slice() : [];
  const seenPairs = new Set(nextLines.map(analysisLinkPairKey));
  const seenIds = new Set(nextLines.map((link) => link.id));
  for (const rawLink of Array.isArray(analysis?.lines) ? analysis.lines : []) {
    const link = normalizeStoredLink(rawLink);
    if (!link || seenIds.has(link.id) || seenPairs.has(analysisLinkPairKey(link))) continue;
    nextLines.push(link);
    seenIds.add(link.id);
    seenPairs.add(analysisLinkPairKey(link));
  }
  const nextFigures = Array.isArray(list.figures) ? list.figures.slice() : [];
  const seenFigureIds = new Set(nextFigures.map((figure) => figure.id));
  for (const rawFigure of Array.isArray(analysis?.figures) ? analysis.figures : []) {
    const figure = normalizeAnalysisFigure(rawFigure);
    if (!figure || seenFigureIds.has(figure.id)) continue;
    nextFigures.push(figure);
    seenFigureIds.add(figure.id);
  }
  list.lines = nextLines;
  list.figures = nextFigures;
}

function focusPresetVisibility(targetLists) {
  const targetStorageIds = new Set(
    (Array.isArray(targetLists) ? targetLists : [])
      .map((list) => pointListStorageKey(list))
      .filter(Boolean)
  );
  if (typeof state.activePointListId === "string" && state.activePointListId) {
    targetStorageIds.add(state.activePointListId);
  }

  const targetLocalIds = new Set(
    Array.from(targetStorageIds).filter((storageId) => !storageId.startsWith("cloud:"))
  );
  const targetCloudIds = new Set(
    Array.from(targetStorageIds)
      .filter((storageId) => storageId.startsWith("cloud:"))
      .map((storageId) => storageId.slice("cloud:".length))
  );

  for (const list of state.pointLists) {
    list.visible = targetLocalIds.has(list.id);
  }
  for (const list of state.cloud.pointLists) {
    const cloudId = list.cloudId || list.id;
    if (targetCloudIds.has(cloudId)) state.cloud.hiddenListIds.delete(cloudId);
    else state.cloud.hiddenListIds.add(cloudId);
  }
  for (const list of state.cloud.lists) {
    if (targetCloudIds.has(list.id)) state.cloud.hiddenListIds.delete(list.id);
    else state.cloud.hiddenListIds.add(list.id);
  }
}

function applyImportedPointLists(importedLists, importedAnalysisLayers, successMessage, options = {}) {
  const previousLists = state.pointLists;
  const previousLinks = state.links;
  const previousFigures = state.figures;
  const previousSelection = state.selection;
  const previousTransientAnalysisIds = new Set(state.transientAnalysisIds);
  try {
    const existingLineIds = new Set(state.links.map((line) => line.id));
    const existingFigureIds = new Set(state.figures.map((figure) => figure.id));
    const importedTransientAnalysisIds = new Set();
    state.pointLists = [...state.pointLists, ...importedLists];
    for (const { list, analysis } of importedAnalysisLayers) mergeAnalysisIntoList(list, analysis);
    if (options.persist === false) {
      for (const line of state.links) {
        if (!existingLineIds.has(line.id)) {
          state.transientAnalysisIds.add(line.id);
          importedTransientAnalysisIds.add(line.id);
        }
      }
      for (const figure of state.figures) {
        if (!existingFigureIds.has(figure.id)) {
          state.transientAnalysisIds.add(figure.id);
          importedTransientAnalysisIds.add(figure.id);
        }
      }
      for (const list of importedLists) {
        list.transientAnalysisIds = [...importedTransientAnalysisIds];
      }
    }
    if (options.source === "preset") {
      focusPresetVisibility(options.focusLists || importedLists);
    }
    refreshVisiblePoints();
    if (options.source !== "preset") {
      state.selection = importedLists.flatMap((list) => list.points.map((point) => ({ type: "point", id: point.id })));
      normalizeSelection();
    }
    if (options.persist !== false) persistWorkspace();
  } catch (error) {
    state.pointLists = previousLists;
    state.links = previousLinks;
    state.figures = previousFigures;
    state.selection = previousSelection;
    state.transientAnalysisIds = previousTransientAnalysisIds;
    refreshVisiblePoints();
    throw error;
  }

  elements.shareImportStatus.value = successMessage;
  if (mobilePageUiActive()) setMobilePage("map");
  const presetPoints = options.source === "preset"
    ? importedLists.flatMap((list) => list.points)
    : null;
  fitToPoints(presetPoints);
}

async function importGridAtlasPackages(packages, options = {}) {
  if (!Array.isArray(packages) || packages.length === 0) return false;
  try {
    const existingPointIds = new Set(allPointListPoints().map((point) => point.id));
    const existingListIds = new Set(state.pointLists.map((list) => list.id));
    const importedLists = [];
    const importedAnalysisLayers = [];
    const duplicates = [];
    for (const gridAtlasPackage of packages) {
      const documentDigest = gridAtlasPackage.documentDigest
        || await gridAtlasDocumentDigest(gridAtlasPackage.document);
      gridAtlasPackage.documentDigest = documentDigest;
      const knownLists = [...state.pointLists, ...importedLists];
      const duplicate = knownLists.find((list) => (
        list.gridAtlas?.documentId === gridAtlasPackage.document.id
        && list.gridAtlas?.documentDigest === documentDigest
      ));
      if (duplicate) {
        importedAnalysisLayers.push({ list: duplicate, analysis: analysisLayerFromGridAtlasDocument(gridAtlasPackage.document, duplicate) });
        if (options.source === "preset" && duplicate.name !== gridAtlasPackage.document.name) {
          duplicate.name = gridAtlasPackage.document.name;
        }
        duplicates.push(duplicate);
        continue;
      }
      const conflict = knownLists.some((list) => list.gridAtlas?.documentId === gridAtlasPackage.document.id);
      const imported = await gridAtlasPackageToPointList(
        gridAtlasPackage,
        existingPointIds,
        existingListIds,
        { conflict, preserveName: options.source === "preset" }
      );
      importedLists.push(imported.list);
      importedAnalysisLayers.push({ list: imported.list, analysis: { lines: imported.list.lines, figures: imported.list.figures } });
    }

    if (options.persist === false) {
      for (const list of importedLists) list.transient = true;
    }

    if (importedLists.length === 0 && duplicates.length > 0) {
      const duplicate = duplicates[0];
      if (options.persist === false) {
        elements.shareImportStatus.value = cloudText("このリストは読み込み済みです", "This list is already imported");
        render();
        fitToPoints();
        return true;
      }
      mergeAnalysisLayers(importedAnalysisLayers);
      if (options.source === "preset") {
        focusPresetVisibility(duplicates);
      }
      if (options.source !== "preset") {
        state.selection = duplicate.points.map((point) => ({ type: "point", id: point.id }));
        normalizeSelection();
      }
      persistWorkspace();
      elements.shareImportStatus.value = cloudText("このリストは読み込み済みです", "This list is already imported");
      render();
      fitToPoints(options.source === "preset" ? duplicate.points : null);
      return true;
    }

    const successMessage = options.source === "url" && importedLists.length === 1
      ? t("import.gridatlas.urlSuccess")
      : options.successMessage
        || t("import.gridatlas.success").replace("{count}", String(importedLists.length));
    applyImportedPointLists(importedLists, importedAnalysisLayers, successMessage, {
      ...options,
      focusLists: [...importedLists, ...duplicates]
    });
    return true;
  } catch (error) {
    console.warn("GRID ATLAS import failed", error);
    elements.shareImportStatus.value = error instanceof GridAtlasImportError
      ? `${t("import.gridatlas.error")}: ${error.message}`
      : t("import.gridatlas.error");
    return false;
  }
}

async function importGridAtlasFiles(files, options = {}) {
  const fileItems = selectedFiles(files).filter(gridAtlasFileLikely);
  if (fileItems.length === 0) {
    elements.shareImportStatus.value = t("import.gridatlas.error");
    return false;
  }
  try {
    const packages = [];
    for (const file of fileItems) packages.push(await readGridAtlasFile(file));
    return importGridAtlasPackages(packages, options);
  } catch (error) {
    console.warn("GRID ATLAS file read failed", error);
    elements.shareImportStatus.value = error instanceof GridAtlasImportError
      ? `${t("import.gridatlas.error")}: ${error.message}`
      : t("import.gridatlas.error");
    return false;
  }
}

function setGridAtlasDropVisible(visible) {
  if (!elements.gridAtlasDropOverlay) return;
  elements.gridAtlasDropOverlay.classList.toggle("is-active", visible);
  elements.gridAtlasDropOverlay.setAttribute("aria-hidden", String(!visible));
}

function fileDragLikely(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function bindGridAtlasDropImport() {
  let dragDepth = 0;
  window.addEventListener("dragenter", (event) => {
    if (!fileDragLikely(event)) return;
    event.preventDefault();
    dragDepth += 1;
    setGridAtlasDropVisible(true);
  });
  window.addEventListener("dragover", (event) => {
    if (!fileDragLikely(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });
  window.addEventListener("dragleave", (event) => {
    if (!fileDragLikely(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setGridAtlasDropVisible(false);
  });
  window.addEventListener("drop", (event) => {
    if (!fileDragLikely(event)) return;
    event.preventDefault();
    dragDepth = 0;
    setGridAtlasDropVisible(false);
    void importGridAtlasFiles(event.dataTransfer?.files, { source: "drop" });
  });
}

function incomingGridAtlasUrlValue() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const hashValue = hashParams.get(GRIDATLAS_URL_PARAMETER);
  if (hashValue) return hashValue;
  return new URLSearchParams(window.location.search).get(GRIDATLAS_URL_PARAMETER) || "";
}

function incomingGridAtlasPresetName() {
  return new URLSearchParams(window.location.search).get(GRIDATLAS_PRESET_PARAMETER) || "";
}

function publicGridAtlasPresetUrl(name) {
  if (!PUBLIC_PRESET_NAME_PATTERN.test(name)) {
    throw new GridAtlasImportError("紹介用プリセット名が不正です");
  }
  return new URL(
    `${PUBLIC_PRESET_DIRECTORY}/${encodeURIComponent(name)}.gridatlas`,
    document.baseURI
  );
}

async function readPublicGridAtlasPreset(name) {
  const url = publicGridAtlasPresetUrl(name);
  let response;
  try {
    response = await fetch(url, { cache: "no-cache", credentials: "same-origin" });
  } catch (error) {
    throw new GridAtlasImportError("紹介用プリセットに接続できません", { cause: error });
  }
  if (!response.ok) {
    throw new GridAtlasImportError("紹介用プリセットが見つかりません");
  }

  const blob = await response.blob();
  const file = new File([blob], `${name}.gridatlas`, { type: GRIDATLAS_MIME_TYPE });
  return readGridAtlasFile(file);
}

function clearIncomingGridAtlasUrlValue() {
  const url = new URL(window.location.href);
  url.searchParams.delete(GRIDATLAS_URL_PARAMETER);
  url.searchParams.delete(GRIDATLAS_PRESET_PARAMETER);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  hashParams.delete(GRIDATLAS_URL_PARAMETER);
  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function incomingCloudShareId() {
  return new URLSearchParams(window.location.search).get(CLOUD_SHARE_URL_PARAMETER)?.trim() || "";
}

function clearIncomingCloudShareId() {
  const url = new URL(window.location.href);
  url.searchParams.delete(CLOUD_SHARE_URL_PARAMETER);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

async function openCloudShareInGridAtlas(payload) {
  const coreDocument = payload?.type === "place-list"
    ? payload
    : pointListGridAtlasDocument(payload, { includeAnalysisLayer: true });
  const imported = await importGridAtlasPackages([{ manifest: null, document: coreDocument, resources: new Map() }], { source: "cloud-share", persist: false });
  if (!imported) return;
  clearIncomingCloudShareId();
  const list = state.pointLists.find((item) => item.transient === true && item.gridAtlas?.documentId === coreDocument.id);
  const notice = documentFromIncomingShareNotice(list);
  if (notice) document.body.append(notice);
}

function documentFromIncomingShareNotice(list) {
  if (!list) return null;
  const notice = document.createElement("section");
  notice.className = "cloud-share-import-notice";
  notice.innerHTML = `<strong>${cloudText("共有を表示中", "Shared data is being viewed")}</strong><span>${cloudText("保存するには「取り込む」を押してください。", "Press Import to save it.")}</span><div class="button-row"><button type="button" class="primary-button">${cloudText("取り込む", "Import")}</button><button type="button" class="compact-button">${cloudText("閉じる", "Close")}</button></div>`;
  const [importButton, closeButton] = notice.querySelectorAll("button");
  importButton.addEventListener("click", () => {
    list.transient = false;
    const transientAnalysisIds = new Set(list.transientAnalysisIds || []);
    for (const id of transientAnalysisIds) state.transientAnalysisIds.delete(id);
    delete list.transientAnalysisIds;
    persistWorkspace();
    notice.remove();
    setShareFeedback(cloudText("共有を取り込みました", "Shared data imported"));
  });
  closeButton.addEventListener("click", () => {
    const transientAnalysisIds = new Set(list.transientAnalysisIds || []);
    state.pointLists = state.pointLists.filter((item) => item !== list);
    state.links = state.links.filter((line) => !transientAnalysisIds.has(line.id));
    state.figures = state.figures.filter((figure) => !transientAnalysisIds.has(figure.id));
    for (const id of transientAnalysisIds) state.transientAnalysisIds.delete(id);
    refreshVisiblePoints();
    persistWorkspace();
    render();
    notice.remove();
  });
  return notice;
}

async function handleIncomingCloudShare() {
  const shareId = incomingCloudShareId();
  if (!shareId) return false;
  try {
    const response = await fetch(new URL("v1/shares/" + encodeURIComponent(shareId), CLOUD_PRODUCTION_API_URL), { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result?.share?.payload) throw new Error(result?.error || "共有を読み込めませんでした");
    await openCloudShareInGridAtlas(result.share.payload);
  } catch (error) {
    clearIncomingCloudShareId();
    setShareFeedback(error?.message || "共有が見つからないか、有効期限切れです。", { error: true });
  }
  return true;
}

async function handleIncomingGridAtlasUrl() {
  const value = incomingGridAtlasUrlValue();
  if (!value) return false;
  try {
    const document = decodeGridAtlasUrlPayload(value);
    return await importGridAtlasPackages([{
      manifest: null,
      document,
      resources: new Map()
    }], { source: "url" });
  } catch (error) {
    console.warn("GRID ATLAS URL import failed", error);
    elements.shareImportStatus.value = error instanceof GridAtlasImportError
      ? `${t("import.gridatlas.error")}: ${error.message}`
      : t("import.gridatlas.error");
    return false;
  } finally {
    clearIncomingGridAtlasUrlValue();
  }
}

async function handleIncomingGridAtlasPreset() {
  const name = incomingGridAtlasPresetName();
  if (!name) return false;
  try {
    const gridAtlasPackage = await readPublicGridAtlasPreset(name);
    const displayName = gridAtlasPackage.document.name || name;
    return await importGridAtlasPackages([gridAtlasPackage], {
      source: "preset",
      successMessage: t("import.gridatlas.presetSuccess").replace("{name}", displayName)
    });
  } catch (error) {
    console.warn("GRID ATLAS public preset import failed", error);
    elements.shareImportStatus.value = error instanceof GridAtlasImportError
      ? `${t("import.gridatlas.error")}: ${error.message}`
      : t("import.gridatlas.error");
    return false;
  } finally {
    clearIncomingGridAtlasUrlValue();
  }
}

async function handleIncomingGridAtlasLink() {
  if (incomingGridAtlasUrlValue()) return handleIncomingGridAtlasUrl();
  return handleIncomingGridAtlasPreset();
}

function registerGridAtlasFileLaunchHandler() {
  if (!window.launchQueue?.setConsumer) return;
  window.launchQueue.setConsumer(async (launchParams) => {
    const handles = Array.from(launchParams.files ?? []);
    const files = [];
    for (const handle of handles) files.push(await handle.getFile());
    await importGridAtlasFiles(files, { source: "file-handler" });
  });
}

function imageExtension(mediaType) {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  return "jpg";
}

async function ensureStoredPointPhoto(point) {
  if (point.photoAssetId) {
    const existing = await getGridAtlasAsset(point.photoAssetId);
    if (existing) return existing;
  }
  if (!point.photo) return null;
  const blob = point.photo.startsWith("data:")
    ? await dataUrlToBlob(point.photo)
    : await fetch(point.photo).then((response) => response.blob());
  const stored = await putGridAtlasAsset(blob, { name: point.photoName, mediaType: blob.type });
  point.photoAssetId = stored.id;
  point.photo = await gridAtlasAssetUrl(stored.id);
  return getGridAtlasAsset(stored.id);
}

function pointListFromPayload(parsed, fileName, existingIds) {
  if (parsed?.type !== "grid-atlas-point-list" || parsed.version !== 2 || !Array.isArray(parsed.points)) {
    throw new Error("Invalid point list");
  }

  const listMeta = parsed.list && typeof parsed.list === "object" ? parsed.list : {};
  const fallbackName = safeFilenamePart(String(fileName || "").replace(/\.json$/i, "")).replace(/-/g, " ") || "読み込みリスト";
  return normalizePointList({
    name: typeof listMeta.name === "string" && listMeta.name.trim() ? listMeta.name.trim() : fallbackName,
    description: typeof listMeta.description === "string" ? listMeta.description : "",
    author: typeof listMeta.author === "string" ? listMeta.author : "",
    visible: true,
    editable: false,
    source: "import",
    importedAt: new Date().toISOString(),
    points: parsed.points
  }, existingIds, fallbackName);
}

async function importPointListFiles(files) {
  const fileItems = selectedFiles(files);
  if (fileItems.length === 0) {
    return;
  }

  try {
    const existingIds = new Set(allPointListPoints().map((point) => point.id));
    const importedLists = [];
    for (const file of fileItems) {
      const parsed = await readJsonFile(file);
      importedLists.push(pointListFromPayload(parsed, file.name, existingIds));
    }

    state.pointLists.push(...importedLists);
    refreshVisiblePoints();
    state.selection = importedLists.flatMap((list) => list.points.map((point) => ({ type: "point", id: point.id })));
    normalizeSelection();
    persistWorkspace();
    elements.shareImportStatus.value = `${importedLists.length}リストを読み込みました`;
    fitToPoints();
  } catch {
    elements.shareImportStatus.value = "地点リスト読み込みエラー";
  }
}
async function deleteSelectedPoint() {
  normalizeSelection();
  const selectedIds = selectedPointIds().filter((id) => id !== CURRENT_LOCATION_ID);
  const candidateCloudPointIds = selectedIds.filter((id) => (
    state.cloud.connected && cloudPointListForPoint(id)?.editable
  ));
  const candidateCloudPointIdSet = new Set(candidateCloudPointIds);
  const candidatePointIds = selectedIds.filter((id) => !candidateCloudPointIdSet.has(id) && pointEditable(id));
  const uneditablePointIds = selectedIds.filter((id) => (
    !candidateCloudPointIdSet.has(id) && !candidatePointIds.includes(id)
  ));
  const explicitLinkIds = selectedLinkIds();
  const explicitFigureIds = selectedFigureIds();
  const inferredFigureIds = figureIdsMatchingSelectedGeometry(explicitLinkIds, selectedIds);
  const selectedObservations = selectedLoadedObservations();
  const selectedObservationIdSet = new Set(selectedObservations.map((observation) => observation.id));
  const candidatePointIdSet = new Set(candidatePointIds);
  const candidateLinkIdSet = new Set(explicitLinkIds);
  const candidateFigureIdSet = new Set([...explicitFigureIds, ...inferredFigureIds]);

  if (candidatePointIdSet.size + candidateCloudPointIdSet.size + candidateLinkIdSet.size + candidateFigureIdSet.size + selectedObservationIdSet.size === 0) {
    return;
  }

  const parts = [];
  if (candidatePointIdSet.size > 0) {
    parts.push(String(candidatePointIdSet.size) + "点");
  }
  if (candidateCloudPointIdSet.size > 0) {
    parts.push(String(candidateCloudPointIdSet.size) + "クラウド地点");
  }
  if (candidateLinkIdSet.size > 0) {
    parts.push(String(candidateLinkIdSet.size) + "線");
  }
  if (candidateFigureIdSet.size > 0) {
    parts.push(String(candidateFigureIdSet.size) + t("analysis.figure"));
  }
  if (selectedObservationIdSet.size > 0) {
    parts.push(String(selectedObservationIdSet.size) + "観察（保存ファイルには影響しません）");
  }

  const selectedPointCount = selectedIds.length;
  const linksOnly = candidateLinkIdSet.size > 0
    && selectedPointCount === 0
    && candidateFigureIdSet.size === 0
    && selectedObservationIdSet.size === 0;
  const pointsOnly = selectedPointCount > 0
    && candidateLinkIdSet.size === 0
    && candidateFigureIdSet.size === 0
    && selectedObservationIdSet.size === 0;
  const figuresOnly = candidateFigureIdSet.size > 0
    && selectedPointCount === 0
    && candidateLinkIdSet.size === 0
    && selectedObservationIdSet.size === 0;
  let deletionMode;
  if (linksOnly || pointsOnly || figuresOnly) {
    const count = linksOnly ? candidateLinkIdSet.size : figuresOnly ? candidateFigureIdSet.size : selectedPointCount;
    const noun = linksOnly ? "本の線" : figuresOnly ? "図形" : "地点";
    const nounEn = linksOnly ? "line(s)" : figuresOnly ? "figure(s)" : "point(s)";
    const confirmed = await requestConfirm({
      title: cloudText("削除の確認", "Confirm deletion"),
      message: cloudText(
        `${count}${noun}を選択しています。削除しますか？`,
        `You have selected ${count} ${nounEn}. Delete them?`
      ),
      confirmLabel: t("action.delete"),
      danger: true
    });
    deletionMode = confirmed ? "all" : "cancel";
  } else {
    deletionMode = await requestConfirm({
      title: cloudText("削除の確認", "Confirm deletion"),
      message: cloudText(
        "選択中の" + parts.join(" / ") + "を削除しますか。",
        `Delete the selected ${parts.join(" / ")}?`
      ),
      choices: [
        ...(candidateLinkIdSet.size > 0 ? [{ value: "links", label: t("delete.linksOnly") }] : []),
        ...(candidatePointIds.length + candidateCloudPointIds.length > 0 ? [{ value: "points", label: t("delete.pointsOnly") }] : []),
        ...(candidateFigureIdSet.size > 0 ? [{ value: "figures", label: t("delete.figuresOnly") }] : []),
        { value: "all", label: t("delete.all") }
      ],
      danger: true
    });
  }
  if (deletionMode === "cancel") {
    return;
  }

  const pointDeletionSelected = deletionMode === "points" || deletionMode === "all";
  if (pointDeletionSelected && uneditablePointIds.length > 0) {
    const message = t("delete.uneditablePoints").replace("{count}", String(uneditablePointIds.length));
    showAppToast(message, { error: true });
    return;
  }
  const pointIdSet = pointDeletionSelected ? new Set(candidatePointIds) : new Set();
  const cloudPointIdSet = pointDeletionSelected ? new Set(candidateCloudPointIds) : new Set();
  const deletionPointIdSet = new Set([...pointIdSet, ...cloudPointIdSet]);
  const linkIdSet = deletionMode === "links" || deletionMode === "all" ? new Set(candidateLinkIdSet) : new Set();
  const figureIdSet = deletionMode === "figures" || deletionMode === "all" ? new Set(candidateFigureIdSet) : new Set();
  const observationIdSet = deletionMode === "all" ? selectedObservationIdSet : new Set();

  if (deletionPointIdSet.size + linkIdSet.size + figureIdSet.size + observationIdSet.size === 0) {
    return;
  }

  const linksAfterPointDeletion = state.links.slice();

  if (cloudPointIdSet.size > 0) {
    const cloudLists = state.cloud.pointLists.filter((list) => (
      list.points.some((point) => cloudPointIdSet.has(point.id))
    ));
    for (const list of cloudLists) {
      const nextList = {
        ...list,
        points: list.points.filter((point) => !cloudPointIdSet.has(point.id))
      };
      const updated = await updateCloudPointList(list, nextList, {
        message: cloudText("クラウド地点を削除しました", "Cloud point(s) deleted"),
        progressKind: "operation"
      });
      if (!updated) {
        render();
        return;
      }
    }
  }

  if (observationIdSet.size > 0) {
    state.loadedObservations = state.loadedObservations.filter((observation) => !observationIdSet.has(observation.id));
  }
  for (const list of state.pointLists) {
    if (list.editable) {
      list.points = list.points.filter((item) => !pointIdSet.has(item.id));
    }
  }
  refreshVisiblePoints();
  state.links = linksAfterPointDeletion.filter((item) => !linkIdSet.has(item.id));
  state.figures = state.figures.filter((item) => !figureIdSet.has(item.id));
  state.selection = state.selection.filter((entry) => (
    !(entry.type === "point" && deletionPointIdSet.has(entry.id))
    && !(entry.type === "link" && linkIdSet.has(entry.id))
    && !(entry.type === "figure" && figureIdSet.has(entry.id))
    && !(entry.type === "observation" && observationIdSet.has(entry.id))
  ));
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  normalizeSelection();
  if (deletionPointIdSet.has(state.editingPointId)) {
    state.editingPointId = null;
  }
  state.routeSelectionIds = state.routeSelectionIds.filter((id) => !deletionPointIdSet.has(id));
  if (deletionPointIdSet.has(state.routeStartPointId)) {
    clearRouteStartState();
  }
  if (state.routeResult?.pointIds?.some((id) => deletionPointIdSet.has(id))) {
    state.routeResult = null;
  }

  if (deletionPointIdSet.has(state.targetPointId)) {
    clearTarget({ render: false });
  }

  if (pointIdSet.size + linkIdSet.size + figureIdSet.size > 0) {
    persistWorkspace();
  }
  render();
}

function bindEvents() {
  window.addEventListener("pageshow", restorePointInfoMapReturn);
  window.addEventListener("resize", scheduleCanvasResize);
  window.visualViewport?.addEventListener("resize", scheduleCanvasResize);
  window.visualViewport?.addEventListener("scroll", scheduleCanvasResize);
  bindGridAtlasDropImport();

  if ("ResizeObserver" in window) {
    canvasResizeObserver = new ResizeObserver(scheduleCanvasResize);
    canvasResizeObserver.observe(canvas);

    if (canvas.parentElement) {
      canvasResizeObserver.observe(canvas.parentElement);
    }
  }

  elements.settingsMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsMenu();
  });
  elements.openGridAtlasButton.addEventListener("click", () => {
    setSettingsMenuOpen(false);
    elements.pointImportFile.click();
  });
  elements.openCloudButton?.addEventListener("click", () => setCloudDialogOpen(true));
  elements.closeCloudButton?.addEventListener("click", () => setCloudDialogOpen(false));
  elements.cloudDialog?.addEventListener("click", (event) => {
    if (event.target === elements.cloudDialog) setCloudDialogOpen(false);
  });
  elements.settingsMenu.addEventListener("click", (event) => event.stopPropagation());
  elements.settingsThemeSelect.addEventListener("change", () => {
    setTheme(elements.settingsThemeSelect.value);
    render();
  });
  elements.settingsLanguageSelect.addEventListener("change", () => {
    setLanguage(elements.settingsLanguageSelect.value);
    render();
  });
  elements.settingsUnitSelect.addEventListener("change", () => {
    setDistanceUnit(elements.settingsUnitSelect.value);
    render();
  });
  elements.settingsMapProviderSelect.addEventListener("change", () => {
    setMapProvider(elements.settingsMapProviderSelect.value);
    render();
  });
  elements.createPointTransferListButton.addEventListener("click", () => void createPointTransferDestinationList());
  elements.cancelPointTransferButton.addEventListener("click", cancelPointTransfer);
  elements.pointTransferDialog.addEventListener("close", () => {
    if (!state.pendingPointTransferMode) return;
    state.pendingPointTransferMode = null;
    state.pointTransferDestinationListId = "";
    render();
  });
  elements.pointTransferDialog.addEventListener("click", (event) => {
    if (event.target === elements.pointTransferDialog) cancelPointTransfer();
  });
  elements.cancelGeometryDestinationButton.addEventListener("click", cancelGeometryDestinationSelection);
  elements.geometryDestinationDialog.addEventListener("close", () => {
    if (!state.pendingGeometryDestination) return;
    state.pendingGeometryDestination = null;
    render();
  });
  elements.geometryDestinationDialog.addEventListener("click", (event) => {
    if (event.target === elements.geometryDestinationDialog) cancelGeometryDestinationSelection();
  });
  elements.storageTransferMoveButton.addEventListener("click", () => void executeStorageListTransfer("move"));
  elements.storageTransferCopyButton.addEventListener("click", () => void executeStorageListTransfer("copy"));
  elements.storageTransferCancelButton.addEventListener("click", closeStorageTransferDialog);
  elements.storageTransferDialog.addEventListener("click", (event) => {
    if (event.target === elements.storageTransferDialog) closeStorageTransferDialog();
  });
  elements.storageTransferDialog.addEventListener("close", () => {
    state.pendingStorageTransfer = null;
  });
  elements.settingsGpsEnabled.addEventListener("change", () => {
    void setGpsEnabled(elements.settingsGpsEnabled.checked);
  });
  elements.kekkaiTesterEnabled?.addEventListener("change", () => {
    setKekkaiTesterEnabled(elements.kekkaiTesterEnabled.checked);
  });
  elements.shareKekkaishiStatusButton?.addEventListener("click", () => void shareKekkaishiStatus());
  elements.kekkaishiStatusDialog?.addEventListener("click", (event) => {
    if (event.target === elements.kekkaishiStatusDialog) elements.kekkaishiStatusDialog.close("cancel");
  });
  elements.kekkaishiStatusDialog?.addEventListener("close", () => {
    stopKekkaishiStatusAnimation();
  });
  elements.systemUpdateButton.addEventListener("click", () => void requestSystemUpdate());
  elements.cloudSignUpButton?.addEventListener("click", () => void signUpCloud());
  elements.cloudSignInButton?.addEventListener("click", () => void signInCloud());
  elements.cloudSignOutButton?.addEventListener("click", () => void signOutCloud());
  elements.cloudAuthPanel?.addEventListener("submit", (event) => event.preventDefault());
  elements.cloudSetPasswordButton?.addEventListener("click", () => void setCloudPassword());
  elements.cloudConnectButton?.addEventListener("click", () => void connectCloud());
  elements.cloudTesterSignupButton?.addEventListener("click", () => {
    if (!state.cloud.testerActive) return;
    setCloudTesterSignupPanelOpen(true);
    setCloudTesterSignupStatus("");
  });
  elements.cloudTesterSignupCancelButton?.addEventListener("click", () => {
    setCloudTesterSignupPanelOpen(false);
    setCloudTesterSignupStatus("");
  });
  elements.cloudTesterSignupSubmitButton?.addEventListener("click", () => void submitTesterSignup());
  elements.cloudTesterSignupCompleteCloseButton?.addEventListener("click", () => setCloudTesterSignupPanelOpen(false));
  elements.closeCloudTesterSignupButton?.addEventListener("click", () => setCloudTesterSignupPanelOpen(false));
  elements.cloudTesterSignupDialog?.addEventListener("click", (event) => {
    if (event.target === elements.cloudTesterSignupDialog) setCloudTesterSignupPanelOpen(false);
  });
  elements.cloudAccessToken?.addEventListener("input", () => {
    const wasTraverseMode = state.traverseMode;
    state.cloud.testerCode = elements.cloudAccessToken.value.trim();
    state.cloud.testerActive = false;
    setKekkaiTesterEnabled(false, { persist: false, announce: false, render: false });
    state.cloud.testerError = "";
    state.cloud.connected = Boolean(state.cloud.authSession?.access_token);
    renderStorageLists();
    syncCloudControls();
    if (wasTraverseMode) render();
    else syncSettingsControls();
  });
  document.addEventListener("click", () => setSettingsMenuOpen(false));
  const closeEditMenusOutside = (event) => {
    const menu = event.target instanceof Element
      ? event.target.closest(".storage-list-edit-menu")
      : null;
    if (!menu) closeStorageListEditMenus();
  };
  document.addEventListener("pointerdown", closeEditMenusOutside, true);
  document.addEventListener("click", closeEditMenusOutside, true);
  window.addEventListener("resize", updateOpenStorageListEditMenuPlacements);
  document.addEventListener("scroll", updateOpenStorageListEditMenuPlacements, true);
  document.addEventListener("dblclick", (event) => {
    if (event.target instanceof Element && event.target.closest("input, textarea, [contenteditable=\"true\"]")) {
      return;
    }
    event.preventDefault();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSettingsMenuOpen(false);
    }
  });
  elements.actionLinkButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("place");
      return;
    }
    handleLinkAction();
  });
  elements.kekkaiReturnTitleButton?.addEventListener("click", returnToKekkaiTitle);
  elements.barrierShareButton?.addEventListener("click", () => {
    void shareSelectedBarrierImage();
  });
  elements.actionAnalyzeButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("analyze");
      return;
    }
    openSelectionAnalysis();
  });
  elements.actionRegisterButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("pin");
      return;
    }
    submitPendingPoint();
  });
  elements.closePointRegistrationButton.addEventListener("click", closePointRegistration);
  elements.actionRouteButton.addEventListener("click", () => {
    if (state.traverseMode) {
      openKekkaishiStatusDialog();
      return;
    }
    setRouteFromSelectedPoints();
  });
  elements.clearSelectionButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("connect");
      return;
    }
    clearSelection();
  });
  elements.actionCenterButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("dragon-eye");
      return;
    }
    createCenterPendingPoint();
  });
  elements.actionCopyToListButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("dissolve");
      return;
    }
    beginPointTransfer("copy");
  });
  elements.actionMoveToListButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("placement");
      return;
    }
    beginPointTransfer("move");
  });
  elements.actionShareSelectedButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("share");
      return;
    }
    void shareSelectedPointsFile();
  });
  elements.actionInvertButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("clear");
      return;
    }
    invertVisiblePointSelection();
  });
  elements.actionMapButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("map");
      return;
    }
    openSelectedPointInPreferredMap();
  });
  elements.pointInfoEditButton.addEventListener("click", () => {
    if (elements.pointInfoEditButton.disabled) return;
    const point = findPointAny(elements.pointInfoDialog.dataset.pointId || state.pointInfoTargetId || state.pointInfoReturnContext?.pointId) || singleSelectedPoint();
    if (!point) return;
    beginPointInfoEditingReturn();
    elements.pointInfoDialog.close("edit");
    closePointListPreviewDialog("edit");
    startEditingPoint(point);
  });

  bindPointerActionButton(elements.gridPointQuickStartButton, () => {
    const point = state.gridPointQuickPointId ? findPoint(state.gridPointQuickPointId) : null;
    if (elements.gridPointQuickDialog.open) elements.gridPointQuickDialog.close("role-selected");
    void setRouteStartForPoint(point, { preserveSelection: true });
  });
  bindPointerActionButton(elements.gridPointQuickTargetButton, () => {
    const point = state.gridPointQuickPointId ? findPoint(state.gridPointQuickPointId) : null;
    if (elements.gridPointQuickDialog.open) elements.gridPointQuickDialog.close("role-selected");
    void toggleTargetForPoint(point, { preserveSelection: true });
  });
  bindPointerActionButton(elements.gridPointQuickEditButton, () => {
    const point = state.gridPointQuickPointId ? findPoint(state.gridPointQuickPointId) : null;
    if (!point || point.id === CURRENT_LOCATION_ID || state.cloud.busy || !pointEditable(point.id)) return;
    if (elements.gridPointQuickDialog.open) elements.gridPointQuickDialog.close("edit");
    startEditingPoint(point);
  });
  bindPointerActionButton(elements.gridPointQuickTrackButton, () => {
    const point = state.gridPointQuickPointId ? findPoint(state.gridPointQuickPointId) : null;
    if (!point || point.id !== CURRENT_LOCATION_ID) return;
    if (elements.gridPointQuickDialog.open) elements.gridPointQuickDialog.close("track");
    void toggleLocationFollow({ fillForm: false });
  });
  bindPointerActionButton(elements.gridPointQuickInfoButton, () => {
    const point = state.gridPointQuickPointId ? findPoint(state.gridPointQuickPointId) : null;
    if (elements.gridPointQuickDialog.open) elements.gridPointQuickDialog.close("info");
    showSelectedPointInfoDialog(point);
  });
  elements.gridPointQuickDialog.addEventListener("close", () => {
    state.gridPointQuickPointId = null;
    state.gridPointQuickStoneId = null;
  });
  elements.gridPointQuickDialog.addEventListener("click", (event) => {
    if (event.target === elements.gridPointQuickDialog) elements.gridPointQuickDialog.close("cancel");
  });
  elements.gridBarrierStoneQuickDialog.addEventListener("close", () => {
    state.gridBarrierStoneQuickStoneId = null;
  });
  bindPointerActionButton(elements.gridBarrierStoneQuickPlaceButton, () => {
    startBarrierStoneQuickAction("place");
  });
  bindPointerActionButton(elements.gridBarrierStoneQuickPickButton, () => {
    startBarrierStoneQuickAction("pick");
  });
  bindPointerActionButton(elements.gridBarrierStoneQuickEditButton, () => {
    void renameBarrierStoneFromQuickDialog();
  });
  bindPointerActionButton(elements.gridBarrierStoneQuickMemoButton, () => {
    void editBarrierStoneMemoFromQuickDialog();
  });
  bindPointerActionButton(elements.gridBarrierStoneQuickMapButton, () => {
    openBarrierStoneInPreferredMapFromQuickDialog();
  });
  elements.gridBarrierStoneQuickDialog.addEventListener("click", (event) => {
    if (event.target === elements.gridBarrierStoneQuickDialog) elements.gridBarrierStoneQuickDialog.close("cancel");
  });
  elements.gridLinkQuickDialog.addEventListener("close", () => {
    state.gridLinkQuickLinkId = null;
  });
  bindPointerActionButton(elements.gridLinkQuickColorButton, () => {
    const link = state.gridLinkQuickLinkId ? findLink(state.gridLinkQuickLinkId) : null;
    if (!link) return;
    if (elements.gridLinkQuickDialog.open) elements.gridLinkQuickDialog.close("color");
    openGridLinkColorDialog(link);
  });
  bindPointerActionButton(elements.gridLinkQuickDeleteButton, () => {
    void deleteGridLinkFromQuickDialog();
  });
  elements.gridLinkQuickDialog.addEventListener("click", (event) => {
    if (event.target === elements.gridLinkQuickDialog) elements.gridLinkQuickDialog.close("cancel");
  });
  elements.gridFigureQuickDialog.addEventListener("close", () => {
    state.gridFigureQuickFigureId = null;
    state.gridFigureQuickVertexIndex = null;
    state.gridFigureQuickBarrierId = null;
  });
  bindPointerActionButton(elements.gridFigureQuickDeleteVertexButton, () => {
    void deleteFigureVertexFromQuickDialog();
  });
  bindPointerActionButton(elements.gridFigureQuickMemoButton, () => {
    void editFigureMemoFromQuickDialog();
  });
  bindPointerActionButton(elements.gridFigureQuickDeleteButton, () => {
    void deleteFigureFromQuickDialog();
  });
  elements.gridFigureQuickDialog.addEventListener("click", (event) => {
    if (event.target === elements.gridFigureQuickDialog) elements.gridFigureQuickDialog.close("cancel");
  });
  elements.gridLinkColorDialog.addEventListener("close", () => {
    if (elements.gridLinkColorDialog.returnValue === "apply") {
      applyGridLinkColorFromDialog();
    }
    state.gridLinkColorLinkId = null;
  });
  elements.gridLinkColorDialog.addEventListener("click", (event) => {
    if (event.target === elements.gridLinkColorDialog) elements.gridLinkColorDialog.close("cancel");
  });
  elements.analysisDialog.addEventListener("click", (event) => {
    if (event.target === elements.analysisDialog) elements.analysisDialog.close("cancel");
  });
  elements.analysisDialogCopyButton.addEventListener("click", () => void copySelectionAnalysis());
  document.addEventListener("pointerdown", (event) => {
    if (!elements.gridPointQuickDialog.open) return;
    if (event.target instanceof Node && elements.gridPointQuickDialog.contains(event.target)) return;
    elements.gridPointQuickDialog.close("outside");
  }, true);
  document.addEventListener("pointerdown", (event) => {
    if (!elements.gridBarrierStoneQuickDialog.open) return;
    if (event.target instanceof Node && elements.gridBarrierStoneQuickDialog.contains(event.target)) return;
    elements.gridBarrierStoneQuickDialog.close("outside");
  }, true);
  document.addEventListener("pointerdown", (event) => {
    if (!elements.gridLinkQuickDialog.open) return;
    if (event.target instanceof Node && elements.gridLinkQuickDialog.contains(event.target)) return;
    elements.gridLinkQuickDialog.close("outside");
  }, true);
  document.addEventListener("pointerdown", (event) => {
    if (!elements.gridFigureQuickDialog.open) return;
    if (event.target instanceof Node && elements.gridFigureQuickDialog.contains(event.target)) return;
    elements.gridFigureQuickDialog.close("outside");
  }, true);
  document.addEventListener("click", (event) => {
    if (!elements.gridPointQuickDialog.open) return;
    if (event.target instanceof Node && elements.gridPointQuickDialog.contains(event.target)) return;
    const target = event.target instanceof Element
      ? event.target.closest("button, a, input, select, textarea, summary")
      : null;
    if (target) elements.gridPointQuickDialog.close("outside-control");
  }, true);
  document.addEventListener("click", (event) => {
    if (!elements.gridBarrierStoneQuickDialog.open) return;
    if (event.target instanceof Node && elements.gridBarrierStoneQuickDialog.contains(event.target)) return;
    const target = event.target instanceof Element
      ? event.target.closest("button, a, input, select, textarea, summary")
      : null;
    if (target) elements.gridBarrierStoneQuickDialog.close("outside-control");
  }, true);
  document.addEventListener("click", (event) => {
    if (!elements.gridFigureQuickDialog.open) return;
    if (event.target instanceof Node && elements.gridFigureQuickDialog.contains(event.target)) return;
    const target = event.target instanceof Element
      ? event.target.closest("button, a, input, select, textarea, summary")
      : null;
    if (target) elements.gridFigureQuickDialog.close("outside-control");
  }, true);
  elements.pointInfoMapButton.addEventListener("click", () => {
    const point = findPointAny(elements.pointInfoDialog.dataset.pointId || state.pointInfoTargetId || state.pointInfoReturnContext?.pointId) || singleSelectedPoint();
    if (!point) return;
    beginPointInfoMapReturn();
    openPointInExternalMap(point, preferredMapProvider());
  });

  elements.pointForm.addEventListener("submit", submitPoint);
  elements.confirmDialog.addEventListener("close", () => {
    const resolve = pendingConfirmResolve;
    pendingConfirmResolve = null;
    resolve?.(elements.confirmDialog.returnValue || "cancel");
  });
  // iOS Safari can close a method="dialog" form without preserving the
  // submit button's returnValue. Close explicitly so mode confirmation is
  // not interpreted as cancellation on Safari.
  const finishConfirmDialog = (value) => {
    const resolve = pendingConfirmResolve;
    pendingConfirmResolve = null;
    const nextTraverseMode = pendingTraverseModeToggle;
    pendingTraverseModeToggle = null;
    if (elements.confirmDialog.open) elements.confirmDialog.close(value);
    if (value === "confirm" && nextTraverseMode !== null) {
      applyTraverseModeToggle(nextTraverseMode);
    }
    resolve?.(value);
  };
  elements.confirmDialogConfirmButton.addEventListener("click", (event) => {
    event.preventDefault();
    finishConfirmDialog("confirm");
  });
  elements.confirmDialogCancelButton.addEventListener("click", (event) => {
    event.preventDefault();
    finishConfirmDialog("cancel");
  });
  elements.confirmDialog.addEventListener("click", (event) => {
    if (event.target === elements.confirmDialog) elements.confirmDialog.close("cancel");
  });
  elements.textInputDialog.addEventListener("close", () => {
    const resolve = pendingTextInputResolve;
    const options = pendingTextInputOptions || {};
    const returnValue = elements.textInputDialog.returnValue || "cancel";
    pendingTextInputResolve = null;
    pendingTextInputOptions = null;
    if (!resolve) return;
    if (returnValue === "submit") {
      resolve(options.shareMode === true
        ? { value: textInputDialogValue(options), action: "submit" }
        : textInputDialogValue(options));
      return;
    }
    if (options.shareMode === true && ["share-file", "share-image", "share-cloud"].includes(returnValue)) {
      resolve({ value: textInputDialogValue(options), action: returnValue.slice("share-".length) });
      return;
    }
    resolve(null);
  });
  elements.textInputDialog.addEventListener("click", (event) => {
    if (event.target === elements.textInputDialog) elements.textInputDialog.close("cancel");
  });
  elements.pointRegistrationDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePointRegistration();
  });
  let pointRegistrationBackdropPointerDown = false;
  elements.pointRegistrationDialog.addEventListener("pointerdown", (event) => {
    pointRegistrationBackdropPointerDown = event.target === elements.pointRegistrationDialog;
  });
  elements.pointRegistrationDialog.addEventListener("pointerup", (event) => {
    if (event.target !== elements.pointRegistrationDialog) {
      pointRegistrationBackdropPointerDown = false;
    }
  });
  elements.pointRegistrationDialog.addEventListener("pointercancel", () => {
    pointRegistrationBackdropPointerDown = false;
  });
  elements.pointRegistrationDialog.addEventListener("click", (event) => {
    const closeFromBackdrop = event.target === elements.pointRegistrationDialog && pointRegistrationBackdropPointerDown;
    pointRegistrationBackdropPointerDown = false;
    if (closeFromBackdrop) closePointRegistration();
  });
  elements.pointDestinationListSelect.addEventListener("change", () => {
    state.pointDestinationListId = elements.pointDestinationListSelect.value || NEW_POINT_LIST_ID;
  });
  elements.readClipboardButton.addEventListener("click", readClipboardShare);
  elements.textInputShareFileButton.addEventListener("click", () => elements.textInputDialog.close("share-file"));
  elements.textInputShareImageButton.addEventListener("click", () => elements.textInputDialog.close("share-image"));
  elements.textInputShareCloudButton.addEventListener("click", () => elements.textInputDialog.close("share-cloud"));
  document.querySelector("[data-share-action-cancel]")?.addEventListener("click", () => elements.textInputDialog.close("cancel"));
  window.addEventListener("pointerup", handlePointInfoRelease, true);
  window.addEventListener("pointercancel", () => {
    state.pointInfoBackdropClickPending = false;
    state.pointInfoBackdropClickSuppressed = false;
  }, true);
  elements.pointInfoDialog.addEventListener("close", () => {
    renderActionButtons();
    if (state.pointInfoReturnPhase === "info") {
      restorePointInfoOrigin();
    } else if (state.pointInfoReturnPhase !== "editing") {
      clearPointInfoReturnContext();
    }
  });
  elements.pointInfoDialog.addEventListener("click", (event) => {
    if (event.target !== elements.pointInfoDialog) return;
    if (state.pointInfoBackdropClickSuppressed) {
      state.pointInfoBackdropClickSuppressed = false;
      event.preventDefault();
      return;
    }
    elements.pointInfoDialog.close("cancel");
  });
  elements.pointListPreviewDialog.addEventListener("close", () => {
    state.mobilePointPreviewStorageId = null;
  });
  elements.pointListPreviewDialog.addEventListener("click", (event) => {
    if (event.target === elements.pointListPreviewDialog) elements.pointListPreviewDialog.close("cancel");
  });
  elements.useLocationButton.addEventListener("click", useCurrentLocation);
  elements.traverseBottomCancelButton?.addEventListener("contextmenu", (event) => event.preventDefault());
  elements.traverseBottomCancelButton?.addEventListener("click", handleTraverseBottomCancel);
  elements.traverseBottomConfirmButton?.addEventListener("contextmenu", (event) => event.preventDefault());
  elements.traverseBottomConfirmButton?.addEventListener("click", handleTraverseBottomConfirm);
  elements.dragonEyeShapeOptions?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-dragon-eye-shape]");
    if (!option) return;
    beginDragonEye(option.dataset.dragonEyeShape);
  });
  elements.dragonEyeControlCloseButton?.addEventListener("click", closeDragonEyeControlPanel);
  elements.dragonEyeShrinkButton?.addEventListener("click", () => adjustDragonEyeRadius(-1));
  elements.dragonEyeExpandButton?.addEventListener("click", () => adjustDragonEyeRadius(1));
  elements.dragonEyeRotateCounterclockwiseButton?.addEventListener("click", () => rotateDragonEye(-1));
  elements.dragonEyeRotateClockwiseButton?.addEventListener("click", () => rotateDragonEye(1));
  elements.dragonEyeControlDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDragonEyeControlPanel();
  });
  elements.traverseQuantityDecreaseButton?.addEventListener("click", () => adjustTraverseQuantity(-1));
  elements.traverseQuantityIncreaseButton?.addEventListener("click", () => adjustTraverseQuantity(1));
  elements.traverseQuantityCancelButton?.addEventListener("click", () => {
    closeTraverseQuantityDialog({ restorePlaceView: true });
    returnToTraverseActionMenu();
  });
  elements.traverseQuantityConfirmButton?.addEventListener("click", confirmTraverseQuantity);
  elements.dragonEyeDialog?.addEventListener("click", (event) => {
    if (event.target === elements.dragonEyeDialog) elements.dragonEyeDialog.close("cancel");
  });
  elements.dragonEyeDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    elements.dragonEyeDialog.close("cancel");
  });
  elements.dragonEyeDialog?.addEventListener("close", clearDragonEyeDialogOverlay);
  elements.traverseQuantityDialog?.addEventListener("click", (event) => {
    if (event.target === elements.traverseQuantityDialog) {
      closeTraverseQuantityDialog({ restorePlaceView: true });
      returnToTraverseActionMenu();
    }
  });
  elements.traverseQuantityDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeTraverseQuantityDialog({ restorePlaceView: true });
    returnToTraverseActionMenu();
  });
  elements.traverseQuantityDialog?.addEventListener("close", () => {
    if (!state.traverseQuantityAction) return;
    closeTraverseQuantityDialog({ restorePlaceView: true });
    returnToTraverseActionMenu();
  });
  elements.barrierPinCancelButton?.addEventListener("click", () => {
    closeBarrierPinDialog();
    render();
  });
  elements.barrierPinCancelButtonBottom?.addEventListener("click", () => {
    closeBarrierPinDialog();
    render();
  });
  elements.barrierPinConfirmButton?.addEventListener("click", submitBarrierPin);
  elements.barrierPinDialog?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitBarrierPin();
  });
  elements.barrierPinDialog?.addEventListener("change", (event) => {
    if (event.target?.name !== "barrierPinTarget") return;
    state.barrierPinTarget = event.target.value;
    renderBarrierPinDialog();
  });
  elements.barrierPinDialog?.addEventListener("click", (event) => {
    if (event.target === elements.barrierPinDialog) {
      closeBarrierPinDialog();
      render();
    }
  });
  elements.barrierPinDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeBarrierPinDialog();
    render();
  });
  elements.barrierPinDialog?.addEventListener("close", () => {
    if (!state.barrierPinMode) return;
    closeBarrierPinDialog();
    render();
  });
  elements.zoomInButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 1.25));
  elements.zoomOutButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 0.8));
  elements.fitButton.addEventListener("click", () => {
    if (state.barrierDissolveMode) {
      fitBarrierPlacementView({ dissolveOnly: true });
      return;
    }
    if (state.traverseMode) {
      fitTraverseView();
      return;
    }
    if (state.barrierPlacementView) {
      fitBarrierPlacementView();
      return;
    }
    fitToPoints();
  });
  elements.originButton.addEventListener("click", centerAndFollowCurrentLocation);
  elements.routeStartSelect.addEventListener("change", () => void setRouteStart(elements.routeStartSelect.value));
  elements.routeReturnToStart.addEventListener("change", () => {
    setRouteReturnToStart(elements.routeReturnToStart.checked);
    render();
  });
  elements.computeRouteButton.addEventListener("click", computeRouteFromSelection);
  elements.clearRouteSelectionButton.addEventListener("click", clearRouteSelection);
  elements.openAppleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("apple"));
  elements.openGoogleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("google"));
  elements.routeStartPointButton.addEventListener("click", () => void setRouteStartForPoint(singleSelectedPoint()));
  elements.targetPointButton.addEventListener("click", () => void toggleTargetForSelection());
  elements.deletePointButton.addEventListener("click", () => {
    if (state.traverseMode) {
      handleBarrierQuickAction("discard");
      return;
    }
    deleteSelectedPoint();
  });
  for (const button of elements.newPointListButtons) {
    button.addEventListener("click", () => void createNewPointList());
  }
  for (const button of elements.selectAllListButtons) {
    button.addEventListener("click", () => setAllStorageListsVisible(true));
  }
  for (const button of elements.clearAllListButtons) {
    button.addEventListener("click", () => setAllStorageListsVisible(false));
  }
  for (const container of elements.storageListContainers) {
    container.addEventListener("contextmenu", (event) => {
      if (mobilePageUiActive()) return;
      event.preventDefault();
      setAllStorageListsVisible(false);
    });
  }

  elements.pointImportFile.addEventListener("change", async () => {
    const files = selectedFiles(elements.pointImportFile.files);
    const gridAtlasFiles = files.filter(gridAtlasFileLikely);
    const jsonFiles = files.filter((file) => !gridAtlasFileLikely(file));
    if (gridAtlasFiles.length > 0) await importGridAtlasFiles(gridAtlasFiles, { source: "picker" });
    if (jsonFiles.length > 0) await importPointListFiles(jsonFiles);
    elements.pointImportFile.value = "";
  });
  for (const tab of elements.mobilePageTabs) {
    tab.addEventListener("click", () => {
      setMobilePage(tab.dataset.mobilePage);
      setSettingsMenuOpen(false);
      if (tab.dataset.mobilePage === "data") {
        maybeRefreshCloudListsForListPage();
      }
    });
  }
  for (const tab of elements.mobileGridTabs) {
    tab.addEventListener("click", (event) => handleMobileGridTabClick(tab, event));
  }
  elements.brandTitle?.addEventListener("pointerdown", startAtlasModeLongPress);
  elements.brandTitle?.addEventListener("pointerup", finishAtlasModeLongPress);
  elements.brandTitle?.addEventListener("pointercancel", finishAtlasModeLongPress);
  elements.brandTitle?.addEventListener("pointerleave", finishAtlasModeLongPress);

  canvas.addEventListener("pointerdown", (event) => {
    if (state.barrierPlacementView || state.barrierDissolveMode || state.barrierLinkPreview) {
      event.preventDefault();
    }
    if (event.button === 2 && !mobilePageUiActive()) {
      event.preventDefault();
      clearSelection();
      return;
    }

    const point = getCanvasPoint(event);
    state.pointer.active.set(event.pointerId, point);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers skip pointer capture for canceled touch gestures.
    }

    if (state.pointer.active.size === 1) {
      startDragGesture(event.pointerId, point);
      return;
    }

    if (state.pointer.active.size === 2) {
      startPinchGesture();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.pointer.active.has(event.pointerId)) {
      updateGridPointHover(getCanvasPoint(event), event.pointerType);
      return;
    }
    hideGridPointHover();

    const point = getCanvasPoint(event);
    state.pointer.active.set(event.pointerId, point);

    if (state.pointer.active.size >= 2) {
      updatePinchGesture();
      return;
    }

    const drag = state.pointer.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }

    if (drag.barrierLinkRoomOutside) {
      drag.last = point;
      return;
    }

    if (drag.barrierLinkRoomLocked) {
      event.preventDefault();
      drag.last = point;
      return;
    }

    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;

    if (drag.dragonEye) {
      event.preventDefault();
      if (Math.hypot(dx, dy) > POINTER_MOVE_THRESHOLD) drag.moved = true;
      if (drag.moved && drag.dragonEyeCenter && drag.dragonEyeStartWorld) {
        const currentWorld = screenToWorld(point);
        state.dragonEye.center = {
          x: drag.dragonEyeCenter.x + currentWorld.x - drag.dragonEyeStartWorld.x,
          y: drag.dragonEyeCenter.y + currentWorld.y - drag.dragonEyeStartWorld.y
        };
        draw();
      }
      drag.last = point;
      return;
    }

    if (drag.barrierLink) {
      event.preventDefault();
      updateBarrierLinkGesture(drag, point);
      drag.last = point;
      return;
    }

    if (Math.hypot(dx, dy) > POINTER_MOVE_THRESHOLD) {
      if (drag.lineDragCandidate && !drag.longPressed) {
        if (drag.lineDragReady) {
          clearDragLongPressTimer(drag);
          beginLineDrag(drag, point);
          updateLineDragTarget(drag, point);
          draw();
          renderStatus();
          drag.last = point;
          return;
        }
        clearDragLongPressTimer(drag);
        drag.cancelled = true;
        drag.lineDragCandidate = null;
      }
      if (drag.longPressFigure) {
        if (drag.longPressed) {
          drag.last = point;
          return;
        }
        if (drag.longPressLink) {
          if (drag.longPressTimerId) window.clearTimeout(drag.longPressTimerId);
          drag.longPressTimerId = null;
        } else {
          clearDragLongPressTimer(drag);
        }
        drag.cancelled = true;
        drag.longPressFigure = null;
      }
      if (drag.longPressBarrier) {
        if (drag.longPressed) {
          drag.last = point;
          return;
        }
        clearDragLongPressTimer(drag);
        drag.cancelled = true;
        drag.longPressBarrier = null;
      }
      if (drag.longPressBarrierStone) {
        if (drag.longPressed) {
          drag.last = point;
          return;
        }
        clearDragLongPressTimer(drag);
        drag.cancelled = true;
        drag.longPressBarrierStone = null;
      }
      if (drag.lineDrag) {
        updateLineDragTarget(drag, point);
        draw();
        renderStatus();
        drag.last = point;
        return;
      }
      if (drag.longPressLink) {
        if (drag.longPressed) {
          drag.last = point;
          return;
        }
        if (drag.lineDragReady) {
          clearDragLongPressTimer(drag);
          beginLineDrag(drag, point);
          updateLineDragTarget(drag, point);
          draw();
          renderStatus();
          drag.last = point;
          return;
        }

        clearDragLongPressTimer(drag);
        drag.cancelled = true;
        drag.longPressLink = null;
      } else {
        clearDragLongPressTimer(drag);
      }
      if (drag.longPressed) {
        if (drag.longPressPoint || drag.longPressBarrierStone) {
          drag.last = point;
          return;
        }
        state.pointer.range.current = point;
        draw();
        renderStatus();
        drag.last = point;
        return;
      }
      if (!drag.moved) {
        pauseLocationFollowForManualView();
      }
      drag.moved = true;
    }

    if (drag.moved) {
      state.viewport.x = drag.viewportX - dx / state.viewport.scale;
      state.viewport.y = drag.viewportY + dy / state.viewport.scale;
      draw();
      renderStatus();
    }

    drag.last = point;
  });

  canvas.addEventListener("pointerup", removePointer);
  canvas.addEventListener("pointercancel", (event) => removePointer(event, { allowTap: false }));
  canvas.addEventListener("pointerleave", hideGridPointHover);
  canvas.addEventListener("contextmenu", (event) => {
    if (mobilePageUiActive()) return;
    event.preventDefault();
    clearSelection();
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const point = getCanvasPoint(event);
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      zoomAt(point, factor);
    },
    { passive: false }
  );
}

loadTheme();
loadWorkspace();
loadTraverseLog();
loadPreferences();
loadCloudSettings();
moveCloudAuthPanelToDialog();
moveCloudPasswordPanelToAuth();
registerGridAtlasFileLaunchHandler();
bindEvents();
void initializeCloudAuth();
initMobilePages();
resizeCanvas();
const kekkaishiLaunch = applyKekkaishiLaunchMode();
void hydrateWorkspaceAssetPhotos()
  .catch((error) => console.warn("GRID ATLAS asset hydration failed", error))
  .finally(() => {
    void handleIncomingGridAtlasLink();
    void handleIncomingCloudShare();
  });
handleIncomingShare();
locateOnStartup();
registerServiceWorker();
render();
if (kekkaishiLaunch) {
  requestAnimationFrame(() => render());
}
restorePointInfoMapReturn();
if (state.cloud.connected && !state.cloud.authConfigured) void refreshCloudLists();
