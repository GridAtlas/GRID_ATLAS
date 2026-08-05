import {
  CloudApiError,
  cloudPayloadToPointList,
  createCloudClient,
  pointListToCloudPayload
} from "./cloud-client.js?v=3";
import {
  GRIDATLAS_MIME_TYPE,
  GRIDATLAS_URL_PARAMETER,
  GridAtlasImportError,
  buildGridAtlasArchive,
  decodeGridAtlasUrlPayload,
  encodeGridAtlasUrlPayload,
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

const STORAGE_KEY = "grid-atlas-workspace-v2";
const THEME_KEY = "grid-atlas-theme";
const LANGUAGE_KEY = "grid-atlas-language";
const DISTANCE_UNIT_KEY = "grid-atlas-distance-unit";
const ROUTE_RETURN_KEY = "grid-atlas-route-return";
const MAP_PROVIDER_KEY = "grid-atlas-map-provider";
const MAP_PROVIDER_GOOGLE = "google";
const MAP_PROVIDER_APPLE = "apple";
const GRIDATLAS_RECOMMENDED_SHARE_URL_BYTES = 8192;
const GPS_ENABLED_KEY = "grid-atlas-gps-enabled";


const CLOUD_ACCESS_TOKEN_KEY = "grid-atlas-cloud-access-token";
const CLOUD_PRODUCTION_API_URL = "https://grid-atlas-cloud-staging.kazki1981.workers.dev";
const PASTEL_THEME = "pastel";
const RETRO_THEME = "retro";
const BASIC_THEME = "basic";
const JA_LANGUAGE = "ja";
const EN_LANGUAGE = "en";
const WEB_VERSION = "0.623";
const METRIC_UNIT = "metric";
const IMPERIAL_UNIT = "imperial";
const POINT_RADIUS = 8;
const POINTER_MOVE_THRESHOLD = 3;
const CURRENT_LOCATION_ID = "__current_location__";
const LOADED_OBSERVATION_PREFIX = "__loaded_observation__";
const DEFAULT_POINT_LIST_ID = "local";
const FOLLOW_SCALE_MANUAL = "manual";
const FOLLOW_SCALE_CENTER = "center";
const FOLLOW_SCALE_TARGET = "target";
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
  actionLinkButton: document.querySelector("#actionLinkButton"),
  actionRegisterButton: document.querySelector("#actionRegisterButton"),
  actionRouteButton: document.querySelector("#actionRouteButton"),
  actionRouteLabel: document.querySelector("#actionRouteLabel"),
  pointTransferDialog: document.querySelector("#pointTransferDialog"),
  storageTransferDialog: document.querySelector("#storageTransferDialog"),
  storageTransferDialogTitle: document.querySelector("#storageTransferDialogTitle"),
  storageTransferDialogHint: document.querySelector("#storageTransferDialogHint"),
  storageTransferMoveButton: document.querySelector("#storageTransferMoveButton"),
  storageTransferCopyButton: document.querySelector("#storageTransferCopyButton"),
  storageTransferCancelButton: document.querySelector("#storageTransferCancelButton"),
  pointTransferDialogTitle: document.querySelector("#pointTransferDialogTitle"),
  pointTransferDialogHint: document.querySelector("#pointTransferDialogHint"),
  pointTransferDestinationList: document.querySelector("#pointTransferDestinationList"),
  createPointTransferListButton: document.querySelector("#createPointTransferListButton"),
  cancelPointTransferButton: document.querySelector("#cancelPointTransferButton"),
  actionCopyToListButton: document.querySelector("#actionCopyToListButton"),
  actionMoveToListButton: document.querySelector("#actionMoveToListButton"),
  actionShareSelectedButton: document.querySelector("#actionShareSelectedButton"),
  actionInfoButton: document.querySelector("#actionInfoButton"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  actionTargetButton: document.querySelector("#actionTargetButton"),
  actionRouteStartButton: document.querySelector("#actionRouteStartButton"),
  actionFollowButton: document.querySelector("#actionFollowButton"),
  actionCenterButton: document.querySelector("#actionCenterButton"),
  actionRestoreButton: document.querySelector("#actionRestoreButton"),
  actionEditButton: document.querySelector("#actionEditButton"),
  actionMapButton: document.querySelector("#actionMapButton"),
  editionBadge: document.querySelector("#editionBadge"),
  settingsMenu: document.querySelector("#settingsMenu"),
  settingsMenuButton: document.querySelector("#settingsMenuButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsThemeSelect: document.querySelector("#settingsThemeSelect"),
  settingsLanguageSelect: document.querySelector("#settingsLanguageSelect"),
  settingsUnitSelect: document.querySelector("#settingsUnitSelect"),
  settingsRouteReturnToStart: document.querySelector("#settingsRouteReturnToStart"),
  settingsGpsEnabled: document.querySelector("#settingsGpsEnabled"),
  settingsMapProviderSelect: document.querySelector("#settingsMapProviderSelect"),
  systemUpdateButton: document.querySelector("#systemUpdateButton"),
  systemUpdateStatus: document.querySelector("#systemUpdateStatus"),
  systemUpdateVersion: document.querySelector("#systemUpdateVersion"),
  statusLine: document.querySelector("#statusLine"),
  selectionInfoText: document.querySelector("#selectionInfoText"),
  mobileSelectedTitle: document.querySelector("#mobileSelectedTitle"),
  sidebarSelectedTitle: document.querySelector("#sidebarSelectedTitle"),
  mapColumn: document.querySelector(".map-column"),
  sidebar: document.querySelector(".sidebar"),
  mobilePageTabs: Array.from(document.querySelectorAll("[data-mobile-page]")),
  mobilePanels: Array.from(document.querySelectorAll("[data-mobile-panel]")),
  mobileGridTabs: Array.from(document.querySelectorAll("[data-mobile-grid-page]")),
  mobileGridPanels: Array.from(document.querySelectorAll("[data-mobile-grid-panel]")),
  mobilePointCount: document.querySelector("#mobilePointCount"),
  mobilePointItems: document.querySelector("#mobilePointItems"),
  pointForm: document.querySelector("#pointForm"),
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
  shareLinkDialog: document.querySelector("#shareLinkDialog"),
  shareLinkSummary: document.querySelector("#shareLinkSummary"),
  shareLinkValue: document.querySelector("#shareLinkValue"),
  shareLinkDialogStatus: document.querySelector("#shareLinkDialogStatus"),
  shareLinkCopyButton: document.querySelector("#shareLinkCopyButton"),
  shareLinkNativeButton: document.querySelector("#shareLinkNativeButton"),
  pointInfoDialog: document.querySelector("#pointInfoDialog"),
  pointInfoPhoto: document.querySelector("#pointInfoPhoto"),
  pointInfoName: document.querySelector("#pointInfoName"),
  pointInfoComment: document.querySelector("#pointInfoComment"),
  pointInfoCoords: document.querySelector("#pointInfoCoords"),
  pointInfoList: document.querySelector("#pointInfoList"),
  pointInfoCreated: document.querySelector("#pointInfoCreated"),
  pointInfoUpdated: document.querySelector("#pointInfoUpdated"),
  pointInfoDistance: document.querySelector("#pointInfoDistance"),
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

  backupListSelect: document.querySelector("#backupListSelect"),
  backupExportButton: document.querySelector("#backupExportButton"),
  replacePointsButton: document.querySelector("#replacePointsButton"),
  pointImportFile: document.querySelector("#pointImportFile"),
  storageListContainers: Array.from(document.querySelectorAll("[data-storage-list-items]")),
  exportObservationButton: document.querySelector("#exportObservationButton"),
  replaceObservationButton: document.querySelector("#replaceObservationButton"),
  appendObservationButton: document.querySelector("#appendObservationButton"),
  observationImportFile: document.querySelector("#observationImportFile"),

  cloudAccessToken: document.querySelector("#cloudAccessToken"),
  cloudConnectButton: document.querySelector("#cloudConnectButton"),
  cloudDisconnectButton: document.querySelector("#cloudDisconnectButton"),

  cloudStatuses: Array.from(document.querySelectorAll("[data-cloud-status]")),
  clearButton: document.querySelector("#clearButton")
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

  pointTransferDestinationListId: "",
  pendingPointTransferMode: null,
  pendingStorageTransfer: null,
  cloud: {
    connected: false,
    busy: false,
    apiUrl: "",
    lists: [],
    pointLists: [],
    pointRows: [],
    hiddenListIds: new Set(),
    listOrder: [],
  },
  links: [],
  mode: "inspect",
  mobilePage: "map",
  mobileGridPage: "grid",
  selection: [],
  selectedPointId: null,
  selectedLinkId: null,
  pendingLinkPointId: null,
  routeSelectionIds: [],
  routeStartPointId: null,
  routeStartSnapshot: null,
  routeReturnToStart: false,
  routeResult: null,
  targetPointId: null,
  observationStartId: null,
  observationTargetId: null,
  observationStart: null,
  observationTrail: [],
  loadedObservations: [],
  editingPointId: null,
  lastDeleted: null,
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

let pendingObservationImportMode = "replace";
let pendingShareLink = null;
let appToastTimerId = 0;
let activeStorageListDrag = null;

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
    selected: "#111827",
    badgeFill: "#fffaf0",
    badgeText: "#24313a",
    badgeStartFill: "#2563eb",
    badgeStartText: "#ffffff"
  }
};

const TRANSLATIONS = {
  ja: {
    "settings.title": "設定",
    "settings.menu": "メニュー",
    "settings.design": "デザイン",
    "settings.language": "言語",
    "settings.units": "距離単位",
    "settings.routeReturn": "巡回で起点に戻る",
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
    "systemUpdate.action": "システム更新",
    "systemUpdate.notice": "最新版を確認し、アプリを再読み込みします。",
    "systemUpdate.version": "WEB版",
    "systemUpdate.checking": "更新を確認しています…",
    "systemUpdate.applying": "更新を適用しています…",
    "systemUpdate.latest": "最新版です。",
    "systemUpdate.reloading": "確認しました。再読み込みします…",
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

    "action.cancel": "キャンセル",
    "action.copyToList": "コピー",
    "action.moveToList": "移動",
    "action.shareSelected": "共有",
    "action.info": "情報",
    "action.delete": "削除",
    "action.restore": "復旧",
    "action.edit": "編集",
    "action.map": "地図",
    "section.pointSource": "地点取得",
    "button.clipboard": "クリップボード",
    "button.currentLocation": "現在地",
    "import.drop.title": ".gridatlasを読み込み",
    "import.drop.description": "この画面にドロップしてください",
    "import.gridatlas.success": "{count}件のスポットリストを読み込みました",
    "import.gridatlas.urlSuccess": "リンクからスポットリストを読み込みました",
    "import.gridatlas.error": "スポットリストを読み込めませんでした",
    "button.submitRegister": "登録",
    "button.update": "更新",
    "button.appleMaps": "Appleマップ",
    "button.googleMaps": "Googleマップ",
    "button.setTarget": "ターゲットにする",
    "button.clearTarget": "ターゲット解除",
    "button.optimize": "最適順",
    "button.clear": "解除",
    "button.save": "保存",
    "button.load": "読込",
    "button.replaceLoad": "新規読込",
    "button.appendLoad": "追加読込",
    "button.clearGrid": "グリッド初期化",
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
    "info.other": "その他情報",
    "info.list": "リスト",
    "info.updated": "更新",
    "info.distanceFromCurrent": "現在地から",
    "info.noPhoto": "写真なし",
    "info.noComment": "コメントなし",
    "info.unavailable": "選択地点の情報を表示できません",
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
    "data.observations": "観察記録",
    "data.grid": "グリッド",
    "cloud.menuTitle": "クラウド機能",
    "cloud.dataNotice": "接続中のマイリスト（クラウド）です。",
    "cloud.pointSource": "マイリスト（クラウド）",
    "cloud.apiUrl": "Cloud API URL",
    "cloud.accessToken": "アクセスコード",
    "cloud.connect": "接続",
    "cloud.disconnect": "切断",
    "cloud.advanced": "接続設定",
    "cloud.localList": "クラウドへ移動する端末内リスト",
    "cloud.save": "マイリスト（クラウド）として保存",
    "cloud.delete": "マイリスト（クラウド）から削除",
    "cloud.empty": "マイリスト（クラウド）なし",
    "storage.notice": "各リストは端末内またはクラウドへ個別に移動できます。インポートリストはマイリストへ移動またはコピーできます。",
    "storage.location": "保存場所",
    "storage.device": "端末",
    "storage.cloud": "クラウド",
    "storage.both": "端末＋クラウド",
    "storage.moveCloud": "クラウド保管へ移動",
    "storage.move": "移動",
    "storage.moveDevice": "端末に移動",
    "storage.connectFirst": "先にクラウドへ接続してください",
    "storage.importMoveOnly": "インポートリストは、個別の転送操作でマイリストへ移動またはコピーできます。",
    "storage.dragHint": "リストを長押ししてドラッグすると、順番や保存場所を変更できます。",
    "storage.dragReordered": "リストの順番を変更しました",
    "storage.dragMoveCloud": "クラウド保管へ移動",
    "storage.dragMoveDevice": "端末へ移動",
    "storage.transferTitle": "リストの移動／コピー",
    "storage.transferHint": "「{name}」を{target}へ移動またはコピーします。",
    "storage.transferMove": "移動",
    "storage.transferCopy": "コピー",
    "storage.dragImportedDestination": "インポートリストはコピー先・移動先にできません。",
    "storage.targetMineDevice": "マイリスト（端末内）",
    "storage.targetMineCloud": "マイリスト（クラウド）",
    "list.new": "新規作成",
    "list.newPrompt": "新しいリストの名前",
    "list.created": "新しいリストを作成し、登録先にしました",
    "list.active": "地点登録先",
    "list.syncEnable": "クラウドへ移動",
    "list.syncDisable": "端末へ移動",
    "list.copy": "コピー",
    "list.share": "共有リンク",
    "list.shareDialogTitle": "共有リンク",
    "list.shareSummary": "「{name}」の{count}点",
    "list.shareSelectedNamePrompt": "共有するリスト名",
    "list.shareSelectedDefaultName": "選択地点",
    "list.shareSelectedUnavailable": "共有する地点を選択してください",
    "list.sharePrivacy": "地点名・緯度経度・コメントを含みます。画像は含みません。",
    "list.shareValue": "共有リンク",
    "list.shareCancel": "キャンセル",
    "list.shareCopy": "リンクをコピー",
    "list.shareNative": "共有する",
    "list.shareCopied": "共有リンクをコピーしました",
    "list.shareCompleted": "共有しました",
    "list.shareTooLong": "このリストはリンク共有の推奨サイズを超えています。.gridatlasで共有してください",
    "list.shareUnavailable": "共有できるリストデータがありません",
    "list.shareCopyFailed": "共有リンクをコピーできませんでした。表示されたリンクを長押ししてコピーできます",
    "list.shareGenerateFailed": "共有リンクを作れませんでした。リスト内容を確認してください",
    "list.shareNativeFailed": "共有画面を開けませんでした",
    "list.rename": "リスト名変更",
    "list.renamePrompt": "新しいリスト名",
    "list.showOnGrid": "グリッドに表示",

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
    "list.section.imported": "インポートリスト",

    "list.none": "リストなし",
    "maintenance.title": "バックアップ・初期化",
    "backup.title": "バックアップ",
    "backup.notice": "端末のリストを保存・復元できます。",
    "backup.list": "対象リスト",
    "backup.export": "バックアップ保存",
    "backup.restore": "バックアップから復元",
    "status.grid": "格子",
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
    "message.currentLocation": "現在地",
    "message.lastObservedLocation": "最終観測位置"
  },
  en: {
    "settings.title": "Settings",
    "settings.menu": "Menu",
    "settings.design": "Design",
    "settings.language": "Language",
    "settings.units": "Distance Unit",
    "settings.routeReturn": "Return to start in route",
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
    "systemUpdate.action": "System Update",
    "systemUpdate.notice": "Checks for the latest version and reloads the app.",
    "systemUpdate.version": "Web version",
    "systemUpdate.checking": "Checking for updates…",
    "systemUpdate.applying": "Applying the update…",
    "systemUpdate.latest": "You are up to date.",
    "systemUpdate.reloading": "Checked. Reloading…",
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

    "action.cancel": "Cancel",
    "action.copyToList": "Copy",
    "action.moveToList": "Move",
    "action.shareSelected": "Share",
    "action.info": "Info",
    "action.delete": "Delete",
    "action.restore": "Restore",
    "action.edit": "Edit",
    "action.map": "Map",
    "section.pointSource": "Get location",
    "button.clipboard": "Clipboard",
    "button.currentLocation": "Current",
    "import.drop.title": "Import .gridatlas",
    "import.drop.description": "Drop it anywhere on this screen",
    "import.gridatlas.success": "Imported {count} spot list(s)",
    "import.gridatlas.urlSuccess": "Imported a spot list from the link",
    "import.gridatlas.error": "Could not import the spot list",
    "button.submitRegister": "Add",
    "button.update": "Update",
    "button.appleMaps": "Apple Maps",
    "button.googleMaps": "Google Maps",
    "button.setTarget": "Set Target",
    "button.clearTarget": "Clear Target",
    "button.optimize": "Optimize",
    "button.clear": "Clear",
    "button.save": "Save",
    "button.load": "Load",
    "button.replaceLoad": "Replace Load",
    "button.appendLoad": "Add Load",
    "button.clearGrid": "Reset Grid",
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
    "info.other": "Other Info",
    "info.list": "List",
    "info.updated": "Updated",
    "info.distanceFromCurrent": "From current",
    "info.noPhoto": "No photo",
    "info.noComment": "No comment",
    "info.unavailable": "Selected point info is unavailable",
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
    "data.observations": "Observation Records",
    "data.grid": "Grid",
    "cloud.menuTitle": "Cloud features",
    "cloud.dataNotice": "My Lists stored in the connected cloud.",
    "cloud.pointSource": "My List (Cloud)",
    "cloud.apiUrl": "Cloud API URL",
    "cloud.accessToken": "Access code",
    "cloud.connect": "Connect",
    "cloud.disconnect": "Disconnect",
    "cloud.advanced": "Connection settings",
    "cloud.localList": "Device list to move to cloud",
    "cloud.save": "Save as My List (Cloud)",
    "cloud.delete": "Delete from My Lists (Cloud)",
    "cloud.empty": "No My Lists (Cloud)",
    "storage.notice": "Move each list independently between device and cloud storage. Imported lists can be moved or copied to My Lists.",
    "storage.location": "Storage",
    "storage.device": "Device",
    "storage.cloud": "Cloud",
    "storage.both": "Device + Cloud",
    "storage.moveCloud": "Move to cloud storage",
    "storage.move": "Move",
    "storage.moveDevice": "Move to device",
    "storage.connectFirst": "Connect to the cloud first",
    "storage.importMoveOnly": "Move or copy imported lists to My Lists from the individual transfer dialog.",
    "storage.dragHint": "Press and hold a list, then drag to reorder it or change its storage.",
    "storage.dragReordered": "List order updated",
    "storage.dragMoveCloud": "Move to cloud storage",
    "storage.dragMoveDevice": "Move to device",
    "storage.transferTitle": "List transfer",
    "storage.transferHint": "Move or copy “{name}” to {target}.",
    "storage.transferMove": "Move",
    "storage.transferCopy": "Copy",
    "storage.dragImportedDestination": "Imported Lists cannot be a copy or move destination.",
    "storage.targetMineDevice": "My Lists (Device)",
    "storage.targetMineCloud": "My Lists (Cloud)",
    "list.new": "New list",
    "list.newPrompt": "Name the new list",
    "list.created": "Created a new list and set it as the destination",
    "list.active": "Destination",
    "list.syncEnable": "Move to cloud",
    "list.syncDisable": "Move to device",
    "list.copy": "Copy",
    "list.share": "Share link",
    "list.shareDialogTitle": "Share link",
    "list.shareSummary": "{count} point(s) in “{name}”",
    "list.shareSelectedNamePrompt": "Name for the shared list",
    "list.shareSelectedDefaultName": "Selected points",
    "list.shareSelectedUnavailable": "Select points to share",
    "list.sharePrivacy": "Includes names, coordinates, and notes. Images are not included.",
    "list.shareValue": "Share link",
    "list.shareCancel": "Cancel",
    "list.shareCopy": "Copy link",
    "list.shareNative": "Share",
    "list.shareCopied": "Copied the share link",
    "list.shareCompleted": "Shared",
    "list.shareTooLong": "This list exceeds the recommended link size. Share it as a .gridatlas file instead",
    "list.shareUnavailable": "No list data is available to share",
    "list.shareCopyFailed": "Could not copy the link. You can press and hold the displayed link to copy it",
    "list.shareGenerateFailed": "Could not create the share link. Check the list contents",
    "list.shareNativeFailed": "Could not open the share sheet",
    "list.rename": "Rename list",
    "list.renamePrompt": "New list name",
    "list.showOnGrid": "Show on grid",

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
    "list.section.imported": "Imported Lists",

    "list.none": "No lists",
    "maintenance.title": "Backup & reset",
    "backup.title": "Backup",
    "backup.notice": "Save or restore lists stored on this device.",
    "backup.list": "List",
    "backup.export": "Save backup",
    "backup.restore": "Restore backup",
    "status.grid": "Grid",
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
    "message.currentLocation": "Current location",
    "message.lastObservedLocation": "Last observed position"
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
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
  elements.settingsMenuButton.title = t("settings.title");
  if (elements.editionBadge) {
    elements.editionBadge.textContent = t("edition.web");
  }
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

function setGpsEnabled(value, options = {}) {
  const enabled = Boolean(value);
  if (enabled === state.gpsEnabled && options.force !== true) {
    syncSettingsControls();
    return true;
  }

  if (!enabled) {
    if (state.followCurrentLocation) {
      toggleLocationFollow();
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
  elements.settingsThemeSelect.value = currentTheme();
  elements.settingsLanguageSelect.value = activeLanguage();
  elements.settingsUnitSelect.value = state.distanceUnit;
  elements.settingsRouteReturnToStart.checked = state.routeReturnToStart;
  elements.settingsGpsEnabled.checked = state.gpsEnabled;
  elements.settingsMapProviderSelect.value = state.mapProvider;
  elements.routeReturnToStart.checked = state.routeReturnToStart;
}

function loadPreferences() {
  let language = JA_LANGUAGE;
  let unit = METRIC_UNIT;
  let returnToStart = false;
  let gpsEnabled = false;
  let mapProvider = defaultMapProvider();
  try {
    language = localStorage.getItem(LANGUAGE_KEY) === EN_LANGUAGE ? EN_LANGUAGE : JA_LANGUAGE;
    unit = localStorage.getItem(DISTANCE_UNIT_KEY) === IMPERIAL_UNIT ? IMPERIAL_UNIT : METRIC_UNIT;
    returnToStart = localStorage.getItem(ROUTE_RETURN_KEY) === "true";
    gpsEnabled = localStorage.getItem(GPS_ENABLED_KEY) === "true";
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

function toggleSettingsMenu() {
  setSettingsMenuOpen(elements.settingsPanel.hidden);
}
function currentTheme() {
  const theme = document.documentElement.dataset.theme;
  return theme === RETRO_THEME || theme === BASIC_THEME ? theme : PASTEL_THEME;
}

function canvasPalette() {
  return CANVAS_PALETTES[currentTheme()];
}

function loadTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {}

  setTheme(saved === BASIC_THEME || saved === "atlas-paper" || saved === "paper" ? BASIC_THEME : saved === PASTEL_THEME || saved === "light" ? PASTEL_THEME : RETRO_THEME, { persist: false });
}

function setTheme(theme, options = {}) {
  const normalized = theme === BASIC_THEME || theme === "atlas-paper" || theme === "paper" ? BASIC_THEME : theme === RETRO_THEME ? RETRO_THEME : PASTEL_THEME;
  document.documentElement.dataset.theme = normalized;
  const themeColor = normalized === RETRO_THEME ? "#020806" : normalized === BASIC_THEME ? "#f5efe3" : "#d86f9b";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);

  if (options.persist !== false) {
    localStorage.setItem(THEME_KEY, normalized);
  }

  if (elements.editionBadge) {
    elements.editionBadge.textContent = t("edition.web");
  }
  if (elements.settingsThemeSelect) {
    elements.settingsThemeSelect.value = normalized;
  }
}

function toggleTheme() {
  setTheme(currentTheme() === RETRO_THEME ? PASTEL_THEME : RETRO_THEME);
  render();
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
  state.version = 3;
  state.cloud.hiddenListIds = new Set(
    Array.isArray(workspace.cloudHiddenListIds)
      ? workspace.cloudHiddenListIds.filter((id) => typeof id === "string" && id)
      : []
  );
  state.cloud.listOrder = Array.isArray(workspace.cloudListOrder)
    ? workspace.cloudListOrder.filter((id) => typeof id === "string" && id)
    : [];

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
      && state.pointLists.some((list) => list.id === workspace.activePointListId && list.editable)
      ? workspace.activePointListId
      : DEFAULT_POINT_LIST_ID;
  refreshVisiblePoints();
  state.links = Array.isArray(workspace.links)
    ? workspace.links.filter((link) => validStoredLinkEndpointId(link.a) && validStoredLinkEndpointId(link.b))
    : [];
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  state.routeReturnToStart = false;
  state.routeResult = null;
  state.targetPointId = null;
  resetObservationTrail();
  state.editingPointId = null;
  state.lastDeleted = null;
  state.pendingGeo = null;
}

function normalizePoint(point, origin) {
  const geo = pointGeoFromAny(point, origin);
  if (!geo) {
    return null;
  }

  const projected = projectLatLng(geo.lat, geo.lng);
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
    createdAt: point.createdAt || new Date().toISOString(),
    updatedAt: point.updatedAt || point.createdAt || new Date().toISOString()
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
    points: Array.isArray(options.points) ? options.points : []
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
  return state.cloud.connected
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
    onProgress: (completed, total) => setCloudProgress(
      completed,
      total,
      cloudText("画像をアップロード中", "Uploading images")
    )
  });
  return pointListToCloudPayload({ ...list, cloudId }, pointGeo, { photoAssets });
}

async function hydrateCloudPointListAssets(list, client, options = {}) {
  const photoPoints = (list?.points || []).filter((point) => point.photoAssetId);
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
    await client.updateList(cloudId, meta.revision, payload);
    updated = true;
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
  }

  if (updated) {
    await refreshCloudLists({ quiet: true });
    setCloudStatus(options.message || cloudText("マイリスト（クラウド）を更新しました", "My List (Cloud) updated"));
  }
  return updated;
}
function findCloudPointAny(pointId) {
  return findCloudPointInLists(pointId, state.cloud.pointLists);
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

function setActivePointList(listId) {
  const list = pointListByStorageKey(listId);
  if (!list || state.activePointListId === pointListStorageKey(list)) return;
  state.activePointListId = pointListStorageKey(list);
  if (list.source !== "cloud") persistWorkspace();
  render();
}

function toggleActivePointList(listId) {
  const list = pointListByStorageKey(listId);
  if (!list) return;
  const key = pointListStorageKey(list);
  state.activePointListId = state.activePointListId === key ? null : key;
  if (list.source !== "cloud") persistWorkspace();
  render();
}
function createNewPointList() {
  const suggestedName = cloudText("新しいリスト", "New list");
  const input = window.prompt(t("list.newPrompt"), suggestedName);
  if (input === null) return;
  const name = input.trim() || suggestedName;
  const list = createPointList({
    name,
    visible: true,
    editable: true,
    source: "local",
    importedAt: "",
    points: []
  });
  state.pointLists.push(list);
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

function createPointTransferDestinationList() {
  if (!state.pendingPointTransferMode) return;
  const suggestedName = cloudText("新しいリスト", "New list");
  const input = window.prompt(t("list.newPrompt"), suggestedName);
  if (input === null) return;
  const name = input.trim() || suggestedName;
  const list = createPointList({
    name,
    visible: true,
    editable: true,
    source: "local",
    importedAt: "",
    points: []
  });
  state.pointLists.push(list);
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
    points
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
  state.selection = state.selection.filter((entry) => entry.type !== "point" || visibleIds.has(entry.id));
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
  const pointLists = state.pointLists.map((list) => ({
    ...list,
    points: list.points.map((point) => ({
      ...point,
      photo: point.photoAssetId ? "" : point.photo
    }))
  }));
  return {
    version: 3,
    projection: { mode: "local", version: 1 },
    pointLists,
    activePointListId: state.activePointListId,
    links: state.links,
    cloudHiddenListIds: [...state.cloud.hiddenListIds],
    cloudListOrder: [...state.cloud.listOrder]
  };
}

function persistWorkspace() {
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
  drawGridLines(topLeft, bottomRight, minorStep, colors.gridMinor, 1);
  drawGridLines(topLeft, bottomRight, majorStep, colors.gridMajor, 1.25);
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

function drawLinks() {
  for (const link of state.links) {
    const a = findPoint(link.a);
    const b = findPoint(link.b);
    if (!a || !b) {
      continue;
    }

    const start = worldToScreen(a);
    const end = worldToScreen(b);
    const isSelected = isLinkSelected(link.id);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    const colors = canvasPalette();
    context.strokeStyle = isSelected ? colors.linkSelected : colors.link;
    context.lineWidth = isSelected ? 5 : 2.4;
    context.stroke();
  }
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

  context.beginPath();
  context.arc(end.x, end.y, POINT_RADIUS + 8, 0, Math.PI * 2);
  context.strokeStyle = colors.targetSoft;
  context.lineWidth = 6;
  context.stroke();
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
  const shouldAnimate = currentLocationGlowActive() && !reducedMotion;
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
    if (!currentLocationGlowActive()) {
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

  if (event.alpha === null || event.alpha === undefined) {
    return null;
  }

  if (event.absolute === false) {
    return null;
  }

  const alpha = Number(event.alpha);
  if (!Number.isFinite(alpha)) {
    return null;
  }

  const orientation = Number(window.screen?.orientation?.angle ?? window.orientation ?? 0);
  return normalizeHeading(360 - alpha + orientation);
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
    context.globalAlpha = 0.92;
    context.lineWidth = 2;
    context.strokeStyle = colors.currentStale;
    context.setLineDash([3, 3]);
    context.stroke();
    context.setLineDash([]);
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
    context.beginPath();
    context.arc(screen.x, screen.y, POINT_RADIUS + 2, 0, Math.PI * 2);
    context.lineWidth = 4;
    context.strokeStyle = colors.selected;
    context.stroke();
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
    context.lineWidth = 4;
    context.strokeStyle = colors.selected;
    context.stroke();
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
  drawGrid(size.width, size.height);
  drawLinks();
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
  drawRouteBadges();
}

function render() {
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  normalizeSelection();
  syncCanvasSize();
  draw();
  renderDetails();
  renderAnalysis();
  renderRoute();
  renderPointDestinationSelect();
  renderStorageLists();
  renderPointIndex();
  renderMobileGridTabs();
  renderSelectedSummary();
  renderSelectionInfo();
  renderStatus();
  renderWebVersion();
  renderActionButtons();
  renderPointInfoDialog();
  syncSettingsControls();
  syncLocationGlowAnimation();
}

function renderSelectedSummary() {
  const title = state.selection.length > 0
    ? state.selection.map(selectionTitle).join(", ")
    : t("state.unselected");
  elements.mobileSelectedTitle.textContent = title;
  elements.sidebarSelectedTitle.textContent = title;
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
    const active = mapActive && tab.dataset.mobileGridPage === state.mobileGridPage;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  }
}

function setMobileGridPage(name) {
  const pageName = validMobileGridPageName(name) ? name : "grid";
  state.mobileGridPage = pageName;
  syncMobileGridTabSelection();

  for (const panel of elements.mobileGridPanels) {
    panel.classList.toggle("is-mobile-grid-active", panel.dataset.mobileGridPanel === pageName);
  }

  if (pageName === "grid") {
    scheduleCanvasResize();
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
  elements.statusLine.value = `${t("status.grid")} ${formatDistance(chooseGridStep())}`;
}

function renderActionButtons() {
  const hasPendingPoint = validGeo(state.pendingGeo);
  const pointIds = selectedPointIds();
  const linkIds = selectedLinkIds();
  const pointPair = selectedPointPair();
  const singlePointCandidate = singleSelectedPoint();
  const targetCandidate = singleTargetableSelectedPoint();
  const routeStartCandidate = singlePointCandidate;
  const routePlan = routePlanFromCurrentSelection();
  const routeActive = Boolean(state.routeResult);
  const routeStart = routeStartPoint();
  const target = targetPoint();
  const targetSwitchesFromRouteStart = Boolean(
    targetCandidate && targetCandidate.id !== state.targetPointId && routeStart && !observationEndpointsDistinct(routeStart, targetCandidate)
  );
  const routeStartSwitchesFromTarget = Boolean(
    routeStartCandidate && routeStartCandidate.id !== state.routeStartPointId && target && !observationEndpointsDistinct(routeStartCandidate, target)
  );
  const centerCandidateCount = pointIds.length;
  const restoreCandidateCount = deletedSnapshotItemCount();
  const editCandidate = editableSelectedPoint();
  const mapCandidate = mapPointForSelection();
  const infoCandidate = singleSelectedPoint();
  const deletablePointCount = pointIds.filter((id) => id !== CURRENT_LOCATION_ID && pointEditable(id)).length;
  const observationSelected = isLoadedObservationSelected();
  const canDelete = deletablePointCount + linkIds.length > 0 || observationSelected;
  const transferablePointCount = transferableSelectedPoints().length;

  const canOpenRegisterPage = !hasPendingPoint && state.selection.length === 0 && mobilePageUiActive();
  elements.actionRegisterButton.disabled = !hasPendingPoint && !canOpenRegisterPage;
  elements.actionLinkButton.disabled = !pointPair;
  elements.actionRouteButton.disabled = !routeActive && !routePlan;
  elements.deletePointButton.disabled = !canDelete;
  elements.clearSelectionButton.disabled = state.selection.length === 0 && !hasPendingPoint;
  elements.actionTargetButton.disabled = !targetCandidate;
  elements.actionRouteStartButton.disabled = !routeStartCandidate;
  elements.actionCenterButton.disabled = centerCandidateCount < 2;
  const shareableSelectedPointCount = selectedPointIds()
    .map(findPoint)
    .filter((point) => point && point.id !== CURRENT_LOCATION_ID)
    .length;
  elements.actionCopyToListButton.disabled = transferablePointCount === 0;
  elements.actionMoveToListButton.disabled = transferablePointCount === 0;
  elements.actionShareSelectedButton.disabled = shareableSelectedPointCount === 0;
  elements.actionRestoreButton.disabled = restoreCandidateCount === 0;
  elements.actionEditButton.disabled = !editCandidate;
  elements.actionMapButton.disabled = !mapCandidate;
  elements.actionInfoButton.disabled = !infoCandidate;

  elements.actionRegisterButton.classList.remove("is-active");
  elements.actionRegisterButton.title = hasPendingPoint ? "仮ポイントを登録" : canOpenRegisterPage ? "地点登録画面を開く" : "仮ポイントを作成すると登録できます";
  elements.actionLinkButton.classList.toggle("is-active", false);
  elements.actionRouteButton.classList.toggle("is-active", routeActive);
  elements.actionRouteButton.setAttribute("aria-pressed", String(routeActive));
  elements.actionRouteButton.title = routeActive ? "巡回表示を解除" : routePlan ? "選択点を起点から巡回計算" : "複数選択と起点指定が必要";
  elements.actionTargetButton.title = targetSwitchesFromRouteStart ? "起点から対象に切り替え" : "選択地点を対象にする";
  elements.actionRouteStartButton.title = routeStartSwitchesFromTarget ? "対象から起点に切り替え" : "選択地点を起点にする";
  elements.deletePointButton.classList.toggle("is-active", false);
  elements.clearSelectionButton.classList.toggle("is-active", false);
  elements.actionTargetButton.classList.toggle("is-active", Boolean(targetCandidate && targetCandidate.id === state.targetPointId));
  elements.actionRouteStartButton.classList.toggle("is-active", Boolean(routeStartCandidate && routeStartCandidate.id === state.routeStartPointId));
  elements.actionCenterButton.classList.toggle("is-active", false);
  elements.actionCopyToListButton.classList.toggle("is-active", false);
  elements.actionMoveToListButton.classList.toggle("is-active", false);
  elements.actionCopyToListButton.title = transferablePointCount > 0
    ? cloudText("コピー先を選択", "Choose a copy destination")
    : t("list.transferNoSelection");
  elements.actionMoveToListButton.title = transferablePointCount > 0
    ? cloudText("移動先を選択", "Choose a move destination")
    : t("list.transferNoSelection");
  elements.actionShareSelectedButton.title = shareableSelectedPointCount > 0
    ? cloudText(`選択した${shareableSelectedPointCount}地点をURLで共有`, `Share ${shareableSelectedPointCount} selected point(s) by URL`)
    : t("list.shareSelectedUnavailable");
  elements.actionRestoreButton.classList.toggle("is-active", false);
  elements.actionEditButton.classList.toggle("is-active", Boolean(state.editingPointId));
  elements.actionMapButton.classList.toggle("is-active", false);
  elements.actionInfoButton.classList.toggle("is-active", Boolean(elements.pointInfoDialog?.open && infoCandidate));
  elements.actionInfoButton.title = infoCandidate ? "選択地点の情報を表示" : "1地点を選択すると情報を表示できます";
  elements.actionRestoreButton.title = restoreCandidateCount > 0 ? `直前の削除を復旧 (${restoreCandidateCount}件)` : "直前の削除を復旧";
  elements.pointSubmitButton.textContent = state.editingPointId ? t("button.update") : t("button.submitRegister");
  elements.actionRouteLabel.textContent = t("action.route");
  renderLocationFollowButton();
}

function renderPointInfoDialog() {
  if (!elements.pointInfoDialog?.open) {
    return;
  }

  const point = singleSelectedPoint();
  if (!point) {
    elements.pointInfoDialog.close("selection-changed");
    return;
  }

  const geo = pointGeo(point);
  const accuracy = Number.isFinite(geo.accuracy) ? ` / +/-${formatDistance(geo.accuracy)}` : "";
  const current = currentLocationPoint();
  const distance = current && point.id !== CURRENT_LOCATION_ID
    ? formatDistance(distanceBetween(current, point))
    : t("label.none");

  elements.pointInfoName.textContent = point.title;
  elements.pointInfoComment.textContent = point.note || t("info.noComment");
  elements.pointInfoComment.classList.toggle("is-muted", !point.note);
  elements.pointInfoCoords.textContent = `${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}${accuracy}`;
  elements.pointInfoList.textContent = pointListNameForPoint(point) || t("label.none");
  elements.pointInfoCreated.textContent = point.isVirtual ? currentLocationLabel() : formatOptionalDate(point.createdAt);
  elements.pointInfoUpdated.textContent = formatOptionalDate(point.updatedAt);
  elements.pointInfoDistance.textContent = distance;

  if (point.photoAssetId && (!point.photo || point.photo.startsWith("blob:"))) {
    void hydratePointPhotoForDisplay(point).then((changed) => {
      if (changed && elements.pointInfoDialog.open && singleSelectedPoint()?.id === point.id) {
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

function showSelectedPointInfoDialog() {
  const point = singleSelectedPoint();
  if (!point) {
    showAppToast(t("info.unavailable"), { error: true });
    return;
  }

  if (!elements.pointInfoDialog?.showModal) {
    const geo = pointGeo(point);
    window.alert([
      point.title,
      point.note || t("info.noComment"),
      `${t("field.coords")}: ${formatCoordinate(geo.lat)}, ${formatCoordinate(geo.lng)}`,
      `${t("info.list")}: ${pointListNameForPoint(point) || t("label.none")}`
    ].join("\n"));
    return;
  }

  if (elements.pointInfoDialog.open) {
    elements.pointInfoDialog.close("refresh");
  }
  elements.pointInfoDialog.showModal();
  renderPointInfoDialog();
  renderActionButtons();
}

function renderDetails() {
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
    elements.detailNote.textContent = t("message.quickHint");
    elements.mapOpenActions.hidden = true;
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

  const isTarget = point.id === state.targetPointId;
  const start = routeStartPoint();
  const switchesFromRouteStart = !isTarget && start && !observationEndpointsDistinct(start, point);
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

function confirmObservationReset(actionLabel) {
  if (!observationResetNeedsConfirmation()) {
    return true;
  }

  const confirmed = window.confirm(`${actionLabel}しますか。記録中の実軌道はリセットされます。`);
  if (confirmed) {
    maybeSaveObservationRecord();
  }

  return confirmed;
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

function observationSnapshot(options = {}) {
  const start = observationStartPoint();
  const target = targetPoint();
  if (!observationScopeValid(start, target)) {
    return null;
  }

  const trail = state.observationTrail.map(clonePlain);
  if (options.includeTarget && target) {
    const finalTarget = cloneObservationPoint(target);
    const last = trail.at(-1);
    if (!last || distanceBetween(last, finalTarget) > 1) {
      trail.push(finalTarget);
    }
  }

  if (trail.length === 0) {
    return null;
  }

  const path = [start, ...trail];
  const current = trail.at(-1);
  const traveled = path.slice(1).reduce((total, point, index) => total + distanceBetween(path[index], point), 0);
  const directToCurrent = distanceBetween(start, current);
  const endedAt = current.recordedAt ?? new Date().toISOString();

  return {
    type: "grid-atlas-observation",
    version: 1,
    title: observationRecordName(start, target, endedAt),
    exportedAt: new Date().toISOString(),
    startedAt: state.observationStart?.recordedAt ?? trail[0]?.recordedAt ?? new Date().toISOString(),
    endedAt,
    start: exportObservationPoint(start),
    target: target ? exportObservationPoint(target) : null,
    trail: trail.map(exportObservationPoint),
    metrics: {
      remaining: target ? distanceBetween(current, target) : NaN,
      traveled,
      ratio: directToCurrent > 1 ? traveled / directToCurrent : NaN
    }
  };
}

function exportObservationPoint(point) {
  const geo = pointGeo(point);
  return {
    id: point.id,
    title: point.title,
    geo,
    x: point.x,
    y: point.y,
    recordedAt: point.recordedAt
  };
}

function maybeSaveObservationRecord() {
  const snapshot = observationSnapshot();
  if (!snapshot) {
    return;
  }

  if (window.confirm("観察記録を保存しますか。")) {
    downloadJson(snapshot, `grid-atlas-observation-${dateTimeStamp()}.json`);
  }
}

function toggleTargetForSelection() {
  const point = singleTargetableSelectedPoint();
  if (!point) {
    return;
  }

  if (state.targetPointId === point.id) {
    if (!confirmObservationReset("対象を解除")) {
      return;
    }
    clearTarget({ render: false });
    setSelection([], { render: false });
    render();
    return;
  }

  const start = routeStartPoint();
  const switchesFromRouteStart = Boolean(start && !observationEndpointsDistinct(start, point));
  const changesTarget = Boolean(state.targetPointId && state.targetPointId !== point.id);
  if ((switchesFromRouteStart || changesTarget) && !confirmObservationReset(switchesFromRouteStart ? "起点から対象へ切り替え" : "対象を変更")) {
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
    setSelection([], { render: false });
    render();
    return;
  }

  state.locationFollowScaleMode = FOLLOW_SCALE_TARGET;
  const current = currentLocationPoint();
  if (current) {
    recordObservationPoint(current);
    setSelection([], { render: false });
    fitTargetFromCurrent(current, point);
    return;
  }

  setSelection([], { render: false });
  render();
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
  const point = selectedPoint();
  if (!point) {
    return;
  }

  openPointInExternalMap(point, provider);
}

function openSelectedPointInPreferredMap() {
  const point = mapPointForSelection();
  if (!point) {
    return;
  }

  openPointInExternalMap(point, preferredMapProvider());
}

function openPointInExternalMap(point, provider) {
  const geo = pointGeo(point);
  const url = externalMapUrl(provider, geo, point.title);
  window.location.href = url;
}

function externalMapUrl(provider, geo, title) {
  const lat = formatCoordinate(geo.lat);
  const lng = formatCoordinate(geo.lng);
  const label = encodeURIComponent(title || "GRID ATLAS Point");

  if (provider === "apple") {
    return `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
function renderAnalysis() {
  elements.pointCount.textContent = String(visibleSelectablePoints().length);

  const linkDistances = state.links
    .map((link) => {
      const a = findPoint(link.a);
      const b = findPoint(link.b);
      return a && b ? { link, a, b, distance: distanceBetween(a, b) } : null;
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
  elements.mobilePointItems.replaceChildren();

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("state.noPoints");
    elements.mobilePointItems.append(empty);
    return;
  }

  for (const { point, list, isCloud = false } of rows) {
    const row = document.createElement("button");
    row.type = "button";
    row.classList.toggle("is-active", isPointSelected(point.id));
    row.setAttribute("aria-pressed", String(isPointSelected(point.id)));
    row.classList.add("point-index-row");

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
    if (isCloud) {
      meta.textContent = list?.name || "地点リスト";
    } else {
      meta.textContent = list?.name || t("label.gps");
    }
    name.append(title, meta);

    const distance = document.createElement("span");
    distance.className = "point-index-distance";
    distance.textContent = point.id === CURRENT_LOCATION_ID
      ? currentLocationLabel()
      : current
        ? formatDistance(distanceBetween(current, point))
        : `${formatCoordinate(pointGeo(point).lat)}, ${formatCoordinate(pointGeo(point).lng)}`;

    row.append(name, distance);
    row.addEventListener("click", () => toggleSelection("point", point.id));
    elements.mobilePointItems.append(row);
  }
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

function setupStorageListVisibility(row, entry) {
  const isRowControl = (target) => target instanceof Element
    && Boolean(target.closest("button, input, select, textarea, a"));

  const toggleVisibility = () => {
    const currentEntry = findStorageListEntry(entry.storageId) ?? entry;
    const nextVisible = !storageListIsVisible(currentEntry);
    setStorageListVisible(entry.storageId, nextVisible);
    setCloudStatus(t(nextVisible ? "list.visible" : "list.hidden"), { menu: false });
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
    event.preventDefault();
    toggleVisibility();
  });
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
  if (sectionKey === "mineCloud") {
    return state.cloud.pointLists;
  }
  return [];
}

function reorderStorageLists(sourceEntry, targetEntry, before) {
  const sectionKey = storageListSectionKey(sourceEntry);
  if (sectionKey !== storageListSectionKey(targetEntry)) return false;
  const lists = storageListSectionEntryList(sectionKey);
  const listKey = (list) => list.cloudId || list.id;
  const sourceKey = sourceEntry.cloud?.id || sourceEntry.local?.id;
  const targetKey = targetEntry.cloud?.id || targetEntry.local?.id;
  const sourceIndex = lists.findIndex((list) => listKey(list) === sourceKey);
  const targetIndex = lists.findIndex((list) => listKey(list) === targetKey);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
  const [source] = lists.splice(sourceIndex, 1);
  let insertIndex = lists.findIndex((list) => listKey(list) === targetKey);
  if (!before) insertIndex += 1;
  lists.splice(insertIndex, 0, source);
  if (sectionKey === "mineDevice" || sectionKey === "imported") {
    const other = state.pointLists.filter((list) => storageListSectionKey({ local: list }) !== sectionKey);
    state.pointLists = [...other, ...lists];
  } else if (sectionKey === "mineCloud") {
    state.cloud.pointLists = lists;
    state.cloud.listOrder = lists.map((list) => list.cloudId || list.id).filter(Boolean);
    applyCloudListOrder();
  }
  persistWorkspace();
  setCloudStatus(t("storage.dragReordered"), { menu: false });
  render();
  return true;
}

function storageListTransferReason(sourceEntry, targetSection) {
  const sourceSection = storageListSectionKey(sourceEntry);
  if (sourceSection === targetSection) return "";
  if (targetSection === "imported") return t("storage.dragImportedDestination");
  if (targetSection !== "mineDevice" && targetSection !== "mineCloud") {
    return cloudText("移動先を確認できません。", "The transfer destination is unavailable.");
  }
  return "";
}

function openStorageTransferDialog(storageId, targetSection) {
  const targetKeys = {
    mineDevice: "storage.targetMineDevice",
    mineCloud: "storage.targetMineCloud"
  };
  if (!Object.hasOwn(targetKeys, targetSection)) {
    showAppToast(cloudText("移動先を確認できません。", "The transfer destination is unavailable."), { error: true });
    return;
  }
  const entry = findStorageListEntry(storageId);
  if (!entry) {
    showAppToast(cloudText("移動元のリストを確認できません。", "The source list is unavailable."), { error: true });
    return;
  }
  state.pendingStorageTransfer = { storageId, targetSection };
  const targetLabel = t(targetKeys[targetSection]);
  const name = entry.local?.name || entry.cloud?.name || "地点リスト";
  elements.storageTransferDialogTitle.textContent = t("storage.transferTitle");
  elements.storageTransferDialogHint.textContent = t("storage.transferHint")
    .replace("{name}", name)
    .replace("{target}", targetLabel);
  elements.storageTransferMoveButton.textContent = t("storage.transferMove");
  elements.storageTransferCopyButton.textContent = t("storage.transferCopy");
  elements.storageTransferCancelButton.textContent = t("action.cancel");
  if (!elements.storageTransferDialog.open) elements.storageTransferDialog.showModal();
}

function closeStorageTransferDialog() {
  state.pendingStorageTransfer = null;
  if (elements.storageTransferDialog.open) elements.storageTransferDialog.close("cancel");
}

async function executeStorageListTransfer(mode) {
  const pending = state.pendingStorageTransfer;
  closeStorageTransferDialog();
  if (!pending) return;
  const entry = findStorageListEntry(pending.storageId);
  if (!entry) return;
  const sourceSection = storageListSectionKey(entry);
  const targetSection = pending.targetSection;

  if (targetSection === "mineCloud") {
    if ((sourceSection !== "mineDevice" && sourceSection !== "imported") || !entry.local) {
      showAppToast(cloudText("このリストはクラウドへ移動またはコピーできません。", "This list cannot be moved or copied to cloud storage."), { error: true });
      return;
    }
    await moveListToCloud(pending.storageId, { copy: mode === "copy" });
    return;
  }

  if (targetSection === "mineDevice") {
    if (sourceSection === "mineCloud" && entry.cloud) {
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

function beginStorageListDrag(dragState) {
  if (activeStorageListDrag !== dragState || dragState.dragging) return;
  window.clearTimeout(dragState.timerId);
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
  clearStorageListDragHover();
  dragState.row.classList.remove("is-dragging");
  dragState.row.removeAttribute("aria-grabbed");
  if (dragState.ghost) dragState.ghost.remove();
  document.body.classList.remove("is-storage-list-dragging");
  if (activeStorageListDrag === dragState) activeStorageListDrag = null;
}

function applyStorageListDrop(dragState) {
  const drop = dragState.drop;
  const entry = findStorageListEntry(dragState.storageId);
  if (!drop || !entry) return;
  if (drop.type === "reorder") {
    reorderStorageLists(entry, drop.targetEntry, drop.before);
  } else if (drop.type === "transfer") {
    openStorageTransferDialog(entry.storageId, drop.targetSection);
  } else if (drop.type === "invalid") {
    showAppToast(drop.reason, { error: true });
  }
}
function setupStorageListDrag(row, entry) {
  const isRowControl = (target) => target instanceof Element
    && Boolean(target.closest("button, input, select, textarea, a"));

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
      dragging: false,
      drop: null,
      ghost: null,
      timerId: 0
    };
    activeStorageListDrag = dragState;

    const cleanup = () => {
      window.clearTimeout(dragState.timerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (activeStorageListDrag === dragState && !dragState.dragging) activeStorageListDrag = null;
    };
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== dragState.pointerId || activeStorageListDrag !== dragState) return;
      dragState.lastX = moveEvent.clientX;
      dragState.lastY = moveEvent.clientY;
      if (!dragState.dragging) {
        const distance = Math.hypot(moveEvent.clientX - dragState.startX, moveEvent.clientY - dragState.startY);
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
        cleanup();
        return;
      }
      upEvent.preventDefault();
      updateStorageListDragHover(dragState, upEvent.clientX, upEvent.clientY);
      cleanup();
      row.dataset.storageDragSuppressClick = "true";
      applyStorageListDrop(dragState);
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
    dragState.timerId = window.setTimeout(() => beginStorageListDrag(dragState), 360);
  });
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

  const name = document.createElement("div");
  name.className = "point-list-name point-list-select";
  name.title = listName;
  const title = document.createElement("strong");
  title.append(document.createTextNode(listName));
  const meta = document.createElement("span");
  const pointCount = entry.local?.points.length ?? entry.preview?.points.length ?? 0;
  const metaParts = [`${pointCount}${t("label.points")}`];
  if (visible) metaParts.push(t("list.visible"));
  meta.textContent = metaParts.join(" · ");
  name.append(title, meta);

  const rowActions = document.createElement("div");
  rowActions.className = "storage-list-row-actions";

  const share = document.createElement("button");
  share.type = "button";
  share.className = "storage-share-button";
  share.append(createIcon("share"));
  share.title = t("list.share");
  share.setAttribute("aria-label", cloudText(`「${listName}」の共有リンクを作成`, `Create a share link for “${listName}”`));
  share.disabled = state.cloud.busy || (!entry.local && !entry.preview);
  share.addEventListener("click", () => void shareStorageListLink(entry.storageId));

  const rename = document.createElement("button");
  rename.type = "button";
  rename.className = "storage-rename-button";
  rename.append(createIcon("edit"));
  rename.title = t("list.rename");
  rename.setAttribute("aria-label", cloudText(`「${listName}」の名前を変更`, `Rename “${listName}”`));
  rename.disabled = state.cloud.busy || !(entry.local?.editable || entry.preview?.editable);
  rename.addEventListener("click", () => void renameStorageList(entry.storageId));

  const destinationButton = document.createElement("button");
  destinationButton.type = "button";
  destinationButton.className = "storage-destination-button";
  const destinationList = entry.local ?? (isMyCloudStorageEntry(entry) ? entry.preview : null);
  const isDestination = destinationList && pointListStorageKey(destinationList) === state.activePointListId;
  if (isDestination) metaParts.push(t("list.active"));
  meta.textContent = metaParts.join(" · ");
  destinationButton.append(createIcon(isDestination ? "home-filled" : "home"));
  destinationButton.classList.toggle("is-active", isDestination);
  destinationButton.title = cloudText(
    isDestination ? "登録先を解除" : "登録先に指定",
    isDestination ? "Unset as destination" : "Set as destination"
  );
  destinationButton.setAttribute("aria-pressed", String(isDestination));
  destinationButton.setAttribute("aria-label", cloudText(
    isDestination
      ? "「" + listName + "」を登録先から解除"
      : "「" + listName + "」を登録先に指定",
    isDestination
      ? "Unset “" + listName + "” as the destination"
      : "Set “" + listName + "” as the destination"
  ));
  destinationButton.disabled = !destinationList?.editable || state.cloud.busy;
  destinationButton.addEventListener("click", () => toggleActivePointList(pointListStorageKey(destinationList)));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "storage-delete-button danger-button";
  remove.append(createIcon("trash"));
  remove.title = t("action.delete");
  remove.setAttribute("aria-label", cloudText("「" + listName + "」を削除", "Delete “" + listName + "”"));
  remove.disabled = state.cloud.busy || Boolean(entry.cloud && !state.cloud.connected);
  remove.addEventListener("click", () => void deleteStoredList(entry.storageId));

  rowActions.append(share, rename, destinationButton, remove);
  row.append(name, rowActions);
  setupStorageListVisibility(row, entry);
  setupStorageListDrag(row, entry);
  return row;
}

function isMyCloudStorageEntry(entry) {
  return Boolean(entry?.cloud);
}

function storageListSectionKey(entry) {
  if (entry?.local?.importedAt) return "imported";
  if (entry?.local) return "mineDevice";
  if (isMyCloudStorageEntry(entry)) return "mineCloud";
  return "";
}

function createStorageListSection(section, entries) {
  const wrapper = document.createElement("section");
  wrapper.className = "storage-list-section";
  wrapper.dataset.storageListSection = section.key;
  wrapper.setAttribute("aria-label", t(section.label));

  const heading = document.createElement("h3");
  heading.className = "storage-list-section-title";
  heading.textContent = t(section.label);

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

  wrapper.append(heading, items);
  return wrapper;
}

function renderPointDestinationSelect() {
  const select = elements.pointDestinationListSelect;
  if (!select) return;
  const lists = editablePointLists();
  const activeList = pointListByStorageKey(state.activePointListId) ?? lists[0] ?? null;
  if (activeList && state.activePointListId !== pointListStorageKey(activeList)) {
    state.activePointListId = pointListStorageKey(activeList);
  }
  select.replaceChildren();
  for (const list of lists) {
    const option = document.createElement("option");
    option.value = pointListStorageKey(list);
    option.textContent = list.name || "地点リスト";
    select.append(option);
  }
  select.value = activeList ? pointListStorageKey(activeList) : "";
  select.disabled = state.editingPointId !== null || lists.length === 0;
}
function renderStorageLists() {
  const entries = storageListEntries();
  const sections = [
    { key: "mineDevice", label: "list.section.mineDevice" },
    { key: "mineCloud", label: "list.section.mineCloud" },
    { key: "imported", label: "list.section.imported" }
  ];
  for (const container of elements.storageListContainers) {
    container.replaceChildren();
    for (const section of sections) {
      const sectionEntries = entries.filter((entry) => storageListSectionKey(entry) === section.key);
      container.append(createStorageListSection(section, sectionEntries));
    }
  }

  renderPointTransferDialog();

  const previousBackupListId = elements.backupListSelect.value;
  const localEntries = entries.filter((entry) => entry.local);
  elements.backupListSelect.replaceChildren();
  for (const entry of localEntries) {
    const option = document.createElement("option");
    option.value = entry.local.id;
    option.textContent = entry.local.name || "地点リスト";
    elements.backupListSelect.append(option);
  }
  if (localEntries.some((entry) => entry.local.id === previousBackupListId)) {
    elements.backupListSelect.value = previousBackupListId;
  } else if (localEntries.some((entry) => entry.local.id === state.activePointListId)) {
    elements.backupListSelect.value = state.activePointListId;
  }
  elements.backupListSelect.disabled = localEntries.length === 0 || state.cloud.busy;
  elements.backupExportButton.disabled = localEntries.length === 0 || state.cloud.busy;
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
  state.cloud.connected = Boolean(state.cloud.apiUrl && token);
}

function cloudText(ja, en) {
  return activeLanguage() === EN_LANGUAGE ? en : ja;
}

function cloudClientFromInputs() {
  return createCloudClient({
    baseUrl: state.cloud.apiUrl,
    getAccessToken: () => elements.cloudAccessToken.value
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
function setCloudProgress(completed, total, message) {
  if (!elements.cloudProgress || !elements.cloudProgressPattern || !elements.cloudProgressTitle) return;
  if (!Number.isFinite(total) || total <= 0) {
    elements.cloudProgress.hidden = true;
    return;
  }
  const width = 7;
  const ratio = Math.max(0, Math.min(1, completed / total));
  const filled = completed >= total ? width : Math.floor(ratio * width);
  elements.cloudProgressTitle.textContent = message || cloudText("処理中", "Working");
  elements.cloudProgressPattern.textContent = "■".repeat(filled) + "□".repeat(width - filled);
  elements.cloudProgress.hidden = false;
}

function clearCloudProgress() {
  if (!elements.cloudProgress) return;
  elements.cloudProgress.hidden = true;
  if (elements.cloudProgressTitle) elements.cloudProgressTitle.textContent = "";
  if (elements.cloudProgressPattern) elements.cloudProgressPattern.textContent = "";
}

function setCloudBusy(busy) {
  state.cloud.busy = Boolean(busy);
  if (!busy) clearCloudProgress();
  renderStorageLists();
}

function syncCloudControls() {
  elements.cloudAccessToken.disabled = state.cloud.busy;
  elements.cloudConnectButton.disabled = state.cloud.busy;
  elements.cloudDisconnectButton.disabled = state.cloud.busy || (!state.cloud.connected && !elements.cloudAccessToken.value);
  for (const button of document.querySelectorAll(".storage-rename-button")) {
    button.disabled = state.cloud.busy;
  }
}
async function connectCloud() {
  try {
    cloudClientFromInputs();
    const token = elements.cloudAccessToken.value.trim();
    if (!token) throw new CloudApiError(cloudText("アクセスコードを入力してください", "Enter an access code"), { status: 401 });
    localStorage.setItem(CLOUD_ACCESS_TOKEN_KEY, token);
    sessionStorage.removeItem(CLOUD_ACCESS_TOKEN_KEY);
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
  state.cloud.connected = false;
  state.cloud.lists = [];
  state.cloud.pointLists = [];
  state.cloud.pointRows = [];
  setCloudStatus(cloudText("切断しました", "Disconnected"));
  renderStorageLists();
  render();
}
async function refreshCloudLists(options = {}) {
  setCloudBusy(true);
  try {
    const client = cloudClientFromInputs();
    const response = await client.listLists();
    if (!Array.isArray(response?.lists)) throw new CloudApiError(cloudText("クラウドリスト一覧の形式が不正です", "Invalid cloud list response"));
    state.cloud.lists = response.lists.filter((list) => (
      list && typeof list.id === "string" && Number.isInteger(list.revision)
    ));

    const details = await Promise.all(state.cloud.lists.map((list) => client.getList(list.id)));
    state.cloud.pointLists = await Promise.all(details.map(async (result) => {
      const list = cloudPayloadToPointList(result.list, {
        localId: "cloud-preview:" + result.list.list.id,
        revision: result.revision,
        editable: true
      });
      return hydrateCloudPointListAssets(list, client);
    }));
    applyCloudListOrder();
    persistWorkspace();
    state.cloud.pointRows = state.cloud.pointLists.flatMap((list) => (
      list.points.map((point) => ({ point, list, isCloud: true }))
    ));
    syncProjectedCoordinates();
    state.cloud.connected = true;
    if (options.quiet !== true) {
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
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
    render();
  }
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
  const input = window.prompt(t("list.renamePrompt"), currentName);
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
  if (!list) return;
  const before = workspaceSnapshot();
  const pointIds = new Set(list.points.map((point) => point.id));

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
  state.links = state.links.filter((link) => !pointIds.has(link.a) && !pointIds.has(link.b));
  ensurePointLists();
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  state.selection = state.selection.filter((entry) => entry.type !== "point" || !pointIds.has(entry.id));
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
  const cloudList = { ...source, id: targetCloudId, cloudId: targetCloudId, cloudScope: "mine" };
  const payload = pointListToCloudPayload(cloudList, pointGeo);
  if (payload.list.scope !== "mine") {
    setCloudStatus(cloudText("マイリスト（クラウド）として保存できません。", "Could not create a private cloud list."), { error: true });
    return false;
  }
  setCloudBusy(true);
  let completed = false;
  try {
    const client = cloudClientFromInputs();
    const created = await client.createList(payload);
    if (cloudList.points.some((point) => point.photoAssetId || point.photo || point.cloudPhoto)) {
      const photoPayload = await cloudPayloadWithPhotos(cloudList, targetCloudId, client);
      await client.updateList(targetCloudId, created?.revision || 1, photoPayload);
    }
    if (options.copy !== true) removeLocalListForStorageChange(source.id);
    completed = true;
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
  }
  if (completed) {
    await refreshCloudLists({ quiet: true });
    setCloudStatus(options.copy === true
      ? cloudText("マイリスト（クラウド）へコピーしました", "Copied to My Lists (Cloud)")
      : cloudText("マイリスト（クラウド）へ移動しました", "Moved to My Lists (Cloud)"));
  }
  return completed;
}function uniqueLocalListId(preferredId) {
  const existingIds = new Set(state.pointLists.map((list) => list.id));
  if (preferredId !== DEFAULT_POINT_LIST_ID && !existingIds.has(preferredId)) return preferredId;
  let nextId = createId();
  while (existingIds.has(nextId)) nextId = createId();
  return nextId;
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
  let installed = false;
  let cloudDeleteFailed = false;
  try {
    const client = cloudClientFromInputs();
    const result = await client.getList(entry.cloud.id);
    const imported = await hydrateCloudPointListAssets(cloudPayloadToPointList(result.list, { localId: uniqueLocalListId(result.list.list.id), revision: result.revision, editable: true }), client, { required: true });
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
    }, new Set(allPointListPoints().map((point) => point.id)), imported.name);
    state.pointLists.push(normalized);
    state.activePointListId = normalized.id;
    refreshVisiblePoints();
    persistWorkspace();
    installed = true;
    if (options.copy !== true) {
      try { await client.deleteList(entry.cloud.id, result.revision); }
      catch { cloudDeleteFailed = true; }
    }
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
  const name = entry.local?.name || entry.cloud?.name || "地点リスト";
  if (options.confirm !== false && !window.confirm(cloudText(
    `${name}を削除しますか？\n保存されている場所すべてから削除します。`,
    `Delete ${name}?\nIt will be removed from every storage location.`
  ))) return;

  setCloudBusy(true);
  let deleted = false;
  try {
    if (entry.cloud) {
      await cloudClientFromInputs().deleteList(entry.cloud.id, entry.cloud.revision);
      state.cloud.hiddenListIds.delete(entry.cloud.id);
    }
    if (entry.local) removeLocalListForStorageChange(entry.local.id);
    else persistWorkspace();
    deleted = true;
  } catch (error) {
    setCloudStatus(cloudErrorMessage(error), { error: true });
  } finally {
    setCloudBusy(false);
  }

  if (deleted) {
    if (state.cloud.connected) await refreshCloudLists({ quiet: true });
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
  if (entry.cloud) {
    if (nextVisible) state.cloud.hiddenListIds.delete(entry.cloud.id);
    else state.cloud.hiddenListIds.add(entry.cloud.id);
  }
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  if (options.persist !== false) persistWorkspace();
  if (options.render !== false) render();
}

function deletePointList(listId) {
  const list = state.pointLists.find((item) => item.id === listId);
  if (!list || list.id === DEFAULT_POINT_LIST_ID) {
    return;
  }

  const confirmed = window.confirm(`${list.name || "地点リスト"}を削除しますか。`);
  if (!confirmed) {
    return;
  }

  const pointIds = new Set(list.points.map((point) => point.id));
  state.pointLists = state.pointLists.filter((item) => item.id !== listId);
  state.links = state.links.filter((link) => !pointIds.has(link.a) && !pointIds.has(link.b));
  ensurePointLists();
  refreshVisiblePoints();
  pruneHiddenPointReferences();
  state.selection = state.selection.filter((entry) => entry.type !== "point" || !pointIds.has(entry.id));
  normalizeSelection();
  persistWorkspace();
  render();
}

function renderRoute() {
  normalizeRouteSelection();
  const selectedPoints = selectedPointIds().map(findPoint).filter(Boolean);
  const resultPoints = routeResultPoints();
  const routePlan = routePlanFromCurrentSelection();
  const start = routeStartPoint();
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
  return findPointIn(id, state.points) ?? syncProjectedPoint(findVisibleCloudPoint(id));
}

function findPointIn(id, points) {
  return points.find((point) => point.id === id) ?? null;
}

function validLinkEndpointId(id) {
  return id === CURRENT_LOCATION_ID || Boolean(findPointAny(id)) || Boolean(findCloudPointAny(id));
}

function validStoredLinkEndpointId(id) {
  return typeof id === "string" && id.length > 0;
}

function findLink(id) {
  return state.links.find((link) => link.id === id) ?? null;
}

function linkEndpoints(link) {
  const a = findPoint(link?.a);
  const b = findPoint(link?.b);
  return a && b ? { a, b } : null;
}

function linkTitle(link) {
  const endpoints = linkEndpoints(link);
  return endpoints ? `${endpoints.a.title} - ${endpoints.b.title}` : "線";
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
    return Boolean(link && linkEndpoints(link));
  }

  if (entry.type === "observation") {
    return Boolean(findLoadedObservation(entry.id));
  }

  return false;
}

function normalizeSelection() {
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

  state.selection = unique;
  const primary = primarySelection();
  state.selectedPointId = primary?.type === "point" ? primary.id : null;
  state.selectedLinkId = primary?.type === "link" ? primary.id : null;
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
    return Boolean(link && linkEndpoints(link));
  }).map((entry) => entry.id);
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
  const observation = selectedObservationIds().length;
  return { point, link, observation, total: point + link + observation };
}

function editableSelectedPoint() {
  const pointIds = selectedPointIds().filter((id) => id !== CURRENT_LOCATION_ID);
  if (pointIds.length !== 1 || selectedCounts().total !== 1) return null;
  const pointId = pointIds[0];
  return pointEditable(pointId) ? findPointAny(pointId) : null;
}

function mapPointForSelection() {
  return singleSelectedPoint();
}

function deletedSnapshotItemCount() {
  if (!state.lastDeleted) {
    return 0;
  }

  const points = Array.isArray(state.lastDeleted.points) ? state.lastDeleted.points.length : 0;
  const links = Array.isArray(state.lastDeleted.links) ? state.lastDeleted.links.length : 0;
  const observations = Array.isArray(state.lastDeleted.observations) ? state.lastDeleted.observations.length : 0;
  return points + links + observations;
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
  normalizeSelection();

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
  const key = selectionKey(type, id);
  const exists = state.selection.some((entry) => selectionKey(entry.type, entry.id) === key);
  const next = exists
    ? state.selection.filter((entry) => selectionKey(entry.type, entry.id) !== key)
    : [...state.selection, { type, id }];

  state.mode = "inspect";
  setSelection(next);
}

function clearSelection(options = {}) {
  state.mode = "inspect";
  state.selection = [];
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
  const start = routeStartPoint();
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

function findLinkBetween(a, b) {
  return state.links.find((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a)) ?? null;
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

function setRouteStartFromSelection() {
  const point = singleSelectedPoint();
  if (!point) {
    return;
  }

  if (state.routeStartPointId === point.id) {
    if (!confirmObservationReset("起点を解除")) {
      return;
    }
    clearRouteStartState();
    setSelection([], { render: false });
    render();
    return;
  }

  const target = targetPoint();
  const switchesFromTarget = Boolean(target && !observationEndpointsDistinct(point, target));
  const changesRouteStart = Boolean(state.routeStartPointId && state.routeStartPointId !== point.id);
  if ((switchesFromTarget || changesRouteStart) && !confirmObservationReset(switchesFromTarget ? "対象から起点へ切り替え" : "起点を変更")) {
    return;
  }

  if (switchesFromTarget) {
    clearTarget({ render: false });
  }

  resetObservationTrail();
  state.routeStartPointId = point.id;
  updateRouteStartSnapshot(point);
  setSelection([], { render: false });
  render();
}
function findNearestPoint(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;
  const candidates = visibleSelectablePoints();
  const current = currentLocationPoint();

  if (current) {
    candidates.push(current);
  }

  for (const point of candidates) {
    const screen = worldToScreen(point);
    const distance = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= POINT_RADIUS + 12 ? nearest : null;
}

function findNearestLink(screenPoint) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const link of state.links) {
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

  return nearestDistance <= 12 ? nearest : null;
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
  const geoA = pointGeo(a);
  const geoB = pointGeo(b);
  const lat1 = toRadians(geoA.lat);
  const lat2 = toRadians(geoB.lat);
  const dLat = toRadians(geoB.lat - geoA.lat);
  const dLng = toRadians(shortestLongitudeDelta(geoA.lng, geoB.lng));
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
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

function localeName() {
  return activeLanguage() === EN_LANGUAGE ? "en-US" : "ja-JP";
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(localeName(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function connectSelectedPoints() {
  const pair = selectedPointPair();
  if (!pair) {
    return;
  }

  const [a, b] = pair;
  if (a === b) {
    return;
  }

  const existing = findLinkBetween(a, b);
  if (!existing) {
    state.links.push({
      id: createId(),
      a,
      b,
      createdAt: new Date().toISOString()
    });
    persistWorkspace();
  }

  state.mode = "inspect";
  state.pendingLinkPointId = null;
  setSelection([], { render: false });
  render();
}

function submitPendingPoint() {
  if (!validGeo(state.pendingGeo)) {
    if (state.selection.length === 0 && mobilePageUiActive()) {
      state.mode = "add";
      state.editingPointId = null;
      state.pendingLinkPointId = null;
      elements.shareImportStatus.value = "地点情報を入力できます";
      setMobilePage("register");
    }
    return;
  }

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
  state.pendingLinkPointId = null;
  elements.pointTitle.value = "中心";
  elements.pointNote.value = `${points.length}点の中心`;
  elements.pointPhoto.value = "";
  fillFormFromGeo(geo);
  setSelection([], { clearPending: false, render: false });
  render();
}

function startEditingSelectedPoint() {
  const point = editableSelectedPoint();
  if (!point) {
    return;
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
  elements.shareImportStatus.value = editingList?.cloudId
    ? cloudText("クラウド保管中のマイリストを編集中。保存するとクラウドへ反映します", "Editing a cloud-stored my list. Saving will update cloud storage.")
    : "編集: 内容を更新できます";
  if (mobilePageUiActive()) {
    setMobilePage("register");
  }
  render();
}

function restoreLastDeleted() {
  const snapshot = state.lastDeleted;
  if (!snapshot || deletedSnapshotItemCount() === 0) {
    return;
  }

  const snapshotPoints = Array.isArray(snapshot.points) ? snapshot.points : [];
  const snapshotLinks = Array.isArray(snapshot.links) ? snapshot.links : [];
  const snapshotObservations = Array.isArray(snapshot.observations) ? snapshot.observations : [];
  const parts = [];
  if (snapshotPoints.length > 0) {
    parts.push(`${snapshotPoints.length}点`);
  }
  if (snapshotLinks.length > 0) {
    parts.push(`${snapshotLinks.length}線`);
  }
  if (snapshotObservations.length > 0) {
    parts.push(`${snapshotObservations.length}観察`);
  }

  const confirmed = window.confirm(`直前に削除した${parts.join(" / ")}を復旧しますか。`);
  if (!confirmed) {
    return;
  }

  const restoredSelection = [];
  const localList = localPointList();
  if (snapshotPoints.length > 0) {
    localList.visible = true;
  }

  const existingPointIds = new Set(allPointListPoints().map((point) => point.id));
  for (const point of snapshotPoints) {
    if (existingPointIds.has(point.id)) {
      continue;
    }

    localList.points.push(clonePlain(point));
    existingPointIds.add(point.id);
    restoredSelection.push({ type: "point", id: point.id });
  }

  const existingLinkIds = new Set(state.links.map((link) => link.id));
  for (const link of snapshotLinks) {
    if (existingLinkIds.has(link.id) || !validLinkEndpointId(link.a) || !validLinkEndpointId(link.b)) {
      continue;
    }

    state.links.push(clonePlain(link));
    existingLinkIds.add(link.id);
    restoredSelection.push({ type: "link", id: link.id });
  }

  const existingObservationIds = new Set(state.loadedObservations.map((observation) => observation.id));
  for (const observation of snapshotObservations) {
    const restoredObservation = withObservationId(observation, existingObservationIds);
    state.loadedObservations.push(restoredObservation);
    restoredSelection.push({ type: "observation", id: restoredObservation.id });
  }

  state.lastDeleted = null;
  refreshVisiblePoints();
  state.selection = restoredSelection;
  normalizeSelection();
  state.routeResult = null;
  if (snapshotPoints.length + snapshotLinks.length > 0) {
    persistWorkspace();
  }
  render();
}

function fillFormFromWorld(point) {
  state.mode = "add";
  state.pendingGeo = unprojectWorld(point.x, point.y);
  state.editingPointId = null;
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

function selectLink(linkId) {
  setSelection([{ type: "link", id: linkId }]);
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
  const nearest = findNearestPoint(screenPoint);
  const nearestLink = nearest ? null : findNearestLink(screenPoint);
  const nearestObservation = nearest || nearestLink ? null : findNearestLoadedObservation(screenPoint);

  if (nearest) {
    toggleSelection("point", nearest.id);
    return;
  }

  if (nearestLink) {
    toggleSelection("link", nearestLink.id);
    return;
  }

  if (nearestObservation) {
    toggleSelection("observation", nearestObservation);
    return;
  }

  pauseLocationFollowForManualView();
  state.mode = "inspect";
  fillFormFromWorld(screenToWorld(screenPoint));
  render();
}
function setRouteStart(pointId) {
  if (!state.routeSelectionIds.includes(pointId)) {
    return;
  }

  if (state.routeStartPointId !== pointId) {
    if (!confirmObservationReset("起点を変更")) {
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
  state.locationFollowScaleMode = FOLLOW_SCALE_MANUAL;
  const before = screenToWorld(screenPoint);
  state.viewport.scale = clampScale(state.viewport.scale * factor);
  const after = screenToWorld(screenPoint);
  state.viewport.x += before.x - after.x;
  state.viewport.y += before.y - after.y;
  render();
}

function fitToPoints() {
  syncCanvasSize();
  pauseLocationFollowForManualView();

  let fitPoints = fitTargetPoints();

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
    fitPoints = fitTargetPoints();
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
  const points = [...state.points, ...cloudPoints, ...routeStartSnapshot, ...loadedPoints];
  if (state.followCurrentLocation || points.length === 0) {
    const current = currentLocationPoint();
    if (current) {
      points.push(current);
    }
  }

  if (validGeo(state.pendingGeo)) {
    const pending = normalizeGeo(state.pendingGeo);
    points.push({ ...projectLatLng(pending.lat, pending.lng), geo: pending });
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
  state.screenFollowCurrentLocation = true;
  state.locationFollowScaleMode = FOLLOW_SCALE_CENTER;

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
    pinch: null
  };
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

function startDragGesture(pointerId, point, options = {}) {
  state.pointer.drag = {
    id: pointerId,
    start: point,
    last: point,
    viewportX: state.viewport.x,
    viewportY: state.viewport.y,
    moved: Boolean(options.moved)
  };
}

function startPinchGesture() {
  const entries = pointerEntries();
  if (entries.length < 2) {
    state.pointer.pinch = null;
    return;
  }

  const [, first] = entries[0];
  const [, second] = entries[1];
  const midpoint = pointerMidpoint(first, second);
  state.pointer.drag = null;
  state.pointer.pinch = {
    startDistance: Math.max(1, pointerDistance(first, second)),
    startMidpoint: midpoint,
    startWorld: screenToWorld(midpoint),
    startScale: state.viewport.scale,
    moved: false
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
    && !state.pointer.pinch;

  state.pointer.active.delete(event.pointerId);

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

  state.pointer.drag = null;

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
  state.pendingLinkPointId = null;
  state.mode = "inspect";
  if (mobilePageUiActive()) {
    setMobilePage("map");
  }
}
async function submitPoint(event) {
  event.preventDefault();
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
    const nextList = {
      ...editingList,
      points: editingList.points.map((point) => point.id === editingPoint.id
        ? {
          ...point,
          x: projected.x,
          y: projected.y,
          title: elements.pointTitle.value.trim() || point.title || "Point",
          note: elements.pointNote.value.trim(),
          geo,
          updatedAt,
          ...(photoDisplay ? {
            photo: photoDisplay,
            photoName: file?.name ?? "",
            photoAssetId: storedPhoto?.id || ""
          } : {})
        }
        : point),
      updatedAt
    };
    if (editingList.source === "cloud") {
      const updated = await updateCloudPointList(editingList, nextList);
      if (!updated) { render(); return; }
    } else {
      Object.assign(editingList, nextList);
      persistWorkspace();
    }
    state.selection = [{ type: "point", id: editingPoint.id }];
    normalizeSelection();
    resetPointFormAfterSubmit();
    syncCanvasSize();
    render();
    return;
  }

  const createdAt = new Date().toISOString();
  const list = localPointList();
  const point = {
    id: createId(),
    x: projected.x,
    y: projected.y,
    title: elements.pointTitle.value.trim() || `Point ${list.points.length + 1}`,
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
    const updated = await updateCloudPointList(list, list);
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
    fillFormFromGeo(geo);
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

function toggleLocationFollow(options = {}) {
  if (state.followCurrentLocation) {
    if (observationModeActive()) {
      const action = chooseObservationStopAction();
      if (action === "continue") {
        return;
      }

      finishObservation({ includeTarget: action === "arrived" });
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

function chooseObservationStopAction() {
  const shouldStop = window.confirm("観察を終了しますか？");
  if (!shouldStop) {
    return "continue";
  }

  if (!targetPoint()) {
    return "finish";
  }

  return window.confirm("対象に到着しましたか？\nOK: はい（対象へ接続）\nキャンセル: いいえ（現在地まで）")
    ? "arrived"
    : "abort";
}

function finishObservation(options = {}) {
  const snapshot = observationSnapshot({ includeTarget: Boolean(options.includeTarget) });
  if (!snapshot) {
    clearSelection({ render: false });
    return;
  }

  const observation = withObservationId(snapshot, new Set(state.loadedObservations.map((item) => item.id)));
  state.loadedObservations.push(observation);
  setSelection([{ type: "observation", id: observation.id }], { render: false });
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

  elements.actionFollowButton.disabled = !isSupported;
  elements.actionFollowButton.classList.toggle("is-active", state.followCurrentLocation);
  elements.actionFollowButton.setAttribute("aria-pressed", String(state.followCurrentLocation));
  elements.actionFollowButton.title = !state.gpsEnabled ? "設定でGPSを有効にしてください" : state.followCurrentLocation ? "追跡を停止" : "追跡を開始";
  elements.originButton.disabled = !isSupported;
  elements.originButton.classList.toggle("is-active", state.screenFollowCurrentLocation);
  elements.originButton.setAttribute("aria-pressed", String(state.screenFollowCurrentLocation));
  elements.originButton.title = !state.gpsEnabled ? "設定でGPSを有効にしてください" : state.screenFollowCurrentLocation ? "画面追従中" : "現在地を中央にして画面追従";
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
  const result = parseSharedLocationPayload({
    text,
    title: elements.pointTitle.value
  });

  if (!result) {
    elements.shareImportStatus.value = shortMapUrlLikely(text) ? "短縮URLは展開できません" : failureMessage;
    return false;
  }

  applySharedLocationToForm(result, successMessage, { includeNote: false });
  elements.pointTitle.value = "クリップボード取得";
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
    elements.systemUpdateVersion.textContent = `${t("systemUpdate.version")} ${WEB_VERSION}`;
  }
}

function setSystemUpdateStatus(key) {
  if (elements.systemUpdateStatus) {
    elements.systemUpdateStatus.textContent = t(key);
  }
}

async function clearGridAtlasStaticCaches() {
  if (!("caches" in window)) {
    return;
  }

  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys
    .filter((key) => key.startsWith("grid-atlas-static-"))
    .map((key) => caches.delete(key)));
}

function reloadAfterSystemUpdateCheck() {
  setSystemUpdateStatus("systemUpdate.reloading");
  window.location.reload();
}

function waitForServiceWorkerActivation(worker) {
  return new Promise((resolve, reject) => {
    let timeoutId = window.setTimeout(() => {
      finish(new Error("Service Worker update timed out"));
    }, 20000);

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
      await registration.update();
    } finally {
      registration.removeEventListener("updatefound", handleUpdateFound);
    }

    updateWorker = registration.waiting ?? registration.installing ?? updateWorker;
    if (updateWorker) {
      setSystemUpdateStatus("systemUpdate.applying");
      await waitForServiceWorkerActivation(updateWorker);
    } else {
      await clearGridAtlasStaticCaches();
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
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadOnControllerChange) {
      reloadForServiceWorker();
    }
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "GRID_ATLAS_UPDATE_ACTIVATED") {
      reloadForServiceWorker();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" }).then((registration) => {
      activateWaitingServiceWorker(registration);
      registration.update().catch(() => {});
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
function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function dateTimeStamp() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadJson(payload, filename) {
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  }), filename);
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

function gridAtlasFileLikely(file) {
  return Boolean(file) && (
    String(file.name || "").toLowerCase().endsWith(".gridatlas")
    || file.type === "application/vnd.gridatlas+zip"
    || file.type === "application/zip"
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
    const createdAt = place.createdAt || new Date().toISOString();
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
      updatedAt: place.updatedAt || createdAt,
      gridAtlas: {
        placeId: place.id,
        media: clonePlain(media),
        extensions: clonePlain(place.extensions ?? {})
      }
    };
  });

  const displayName = options.conflict
    ? `${document.name}${cloudText("（更新版）", " (updated)")}`
    : document.name;
  const createdAt = document.createdAt || new Date().toISOString();
  return normalizePointList({
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
}

function applyImportedPointLists(importedLists, successMessage) {
  const previousLists = state.pointLists;
  const previousSelection = state.selection;
  try {
    state.pointLists = [...state.pointLists, ...importedLists];
    refreshVisiblePoints();
    state.selection = importedLists.flatMap((list) => list.points.map((point) => ({ type: "point", id: point.id })));
    normalizeSelection();
    persistWorkspace();
  } catch (error) {
    state.pointLists = previousLists;
    state.selection = previousSelection;
    refreshVisiblePoints();
    throw error;
  }

  elements.shareImportStatus.value = successMessage;
  if (mobilePageUiActive()) setMobilePage("map");
  fitToPoints();
}

async function importGridAtlasPackages(packages, options = {}) {
  if (!Array.isArray(packages) || packages.length === 0) return false;
  try {
    const existingPointIds = new Set(allPointListPoints().map((point) => point.id));
    const existingListIds = new Set(state.pointLists.map((list) => list.id));
    const importedLists = [];
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
        duplicates.push(duplicate);
        continue;
      }
      const conflict = knownLists.some((list) => list.gridAtlas?.documentId === gridAtlasPackage.document.id);
      importedLists.push(await gridAtlasPackageToPointList(
        gridAtlasPackage,
        existingPointIds,
        existingListIds,
        { conflict }
      ));
    }

    if (importedLists.length === 0 && duplicates.length > 0) {
      const duplicate = duplicates[0];
      state.selection = duplicate.points.map((point) => ({ type: "point", id: point.id }));
      normalizeSelection();
      elements.shareImportStatus.value = cloudText("このリストは読み込み済みです", "This list is already imported");
      render();
      fitToPoints();
      return true;
    }

    const successMessage = options.source === "url" && importedLists.length === 1
      ? t("import.gridatlas.urlSuccess")
      : t("import.gridatlas.success").replace("{count}", String(importedLists.length));
    applyImportedPointLists(importedLists, successMessage);
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

function clearIncomingGridAtlasUrlValue() {
  const url = new URL(window.location.href);
  url.searchParams.delete(GRIDATLAS_URL_PARAMETER);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  hashParams.delete(GRIDATLAS_URL_PARAMETER);
  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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

async function pointListGridAtlasPackage(list) {
  list.gridAtlas = list.gridAtlas && typeof list.gridAtlas === "object" ? list.gridAtlas : {};
  list.gridAtlas.documentId = list.gridAtlas.documentId || createId();

  const resourceRecords = new Map();
  for (const resource of Array.isArray(list.gridAtlas.resources) ? list.gridAtlas.resources : []) {
    const metadata = resource?.metadata;
    if (!metadata?.id) continue;
    let asset = resource.assetId ? await getGridAtlasAsset(resource.assetId) : null;
    if (!asset && resource.dataUrl) {
      const blob = await dataUrlToBlob(resource.dataUrl);
      const stored = await putGridAtlasAsset(blob, {
        name: metadata.path?.split("/").pop() || "",
        mediaType: metadata.mediaType || blob.type
      });
      asset = await getGridAtlasAsset(stored.id);
    }
    if (!asset?.blob) continue;
    resourceRecords.set(metadata.id, {
      assetId: asset.id,
      entry: {
        id: metadata.id,
        path: metadata.path || ("assets/" + asset.id + "." + imageExtension(asset.mediaType)),
        mediaType: metadata.mediaType || asset.mediaType,
        bytes: new Uint8Array(await asset.blob.arrayBuffer()),
        image: metadata.image
      }
    });
  }

  const pointPhotoResources = new Map();
  for (const point of list.points) {
    const asset = await ensureStoredPointPhoto(point);
    if (!asset?.blob) continue;
    const existingPhotoMedia = Array.isArray(point.gridAtlas?.media)
      ? point.gridAtlas.media.find((media) => media.role === "photo" && resourceRecords.has(media.resourceId))
      : null;
    const resourceId = existingPhotoMedia?.resourceId || asset.id;
    if (!resourceRecords.has(resourceId)) {
      resourceRecords.set(resourceId, {
        assetId: asset.id,
        entry: {
          id: resourceId,
          path: "assets/" + asset.id + "." + imageExtension(asset.mediaType),
          mediaType: asset.mediaType,
          bytes: new Uint8Array(await asset.blob.arrayBuffer())
        }
      });
    }
    pointPhotoResources.set(point.id, resourceId);
  }

  const places = list.points.map((point) => {
    const geo = pointGeo(point);
    const media = (Array.isArray(point.gridAtlas?.media) ? clonePlain(point.gridAtlas.media) : [])
      .filter((item) => resourceRecords.has(item.resourceId));
    const photoResourceId = pointPhotoResources.get(point.id);
    if (photoResourceId && !media.some((item) => item.role === "photo" && item.resourceId === photoResourceId)) {
      const withoutOldPhoto = media.filter((item) => item.role !== "photo");
      media.splice(0, media.length, { resourceId: photoResourceId, role: "photo" }, ...withoutOldPhoto);
    }
    const place = {
      id: point.gridAtlas?.placeId || point.id,
      name: point.title || "Point",
      position: { latitude: geo.lat, longitude: geo.lng }
    };
    if (point.note) place.note = point.note;
    if (point.createdAt) place.createdAt = point.createdAt;
    if (point.updatedAt) place.updatedAt = point.updatedAt;
    if (media.length > 0) place.media = media;
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
  const documentMedia = (Array.isArray(list.gridAtlas.documentMedia) ? clonePlain(list.gridAtlas.documentMedia) : [])
    .filter((item) => resourceRecords.has(item.resourceId));
  if (documentMedia.length > 0) document.media = documentMedia;
  if (list.gridAtlas.documentExtensions && Object.keys(list.gridAtlas.documentExtensions).length > 0) {
    document.extensions = clonePlain(list.gridAtlas.documentExtensions);
  }

  const result = await buildGridAtlasArchive(
    document,
    Array.from(resourceRecords.values(), (resource) => resource.entry),
    { requiredExtensions: list.gridAtlas.requiredExtensions || [] }
  );
  list.gridAtlas.documentDigest = result.documentDigest;
  list.gridAtlas.documentMedia = clonePlain(document.media || []);
  list.gridAtlas.resources = result.manifest.resources.map((metadata) => ({
    metadata: clonePlain(metadata),
    assetId: resourceRecords.get(metadata.id)?.assetId || "",
    dataUrl: ""
  }));
  persistWorkspace();
  return result;
}

function pointListGridAtlasUrlDocument(list) {
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
  if (list.gridAtlas.documentExtensions && Object.keys(list.gridAtlas.documentExtensions).length > 0) {
    document.extensions = clonePlain(list.gridAtlas.documentExtensions);
  }
  return document;
}

function gridAtlasShareUrl(document) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = new URLSearchParams({
    [GRIDATLAS_URL_PARAMETER]: encodeGridAtlasUrlPayload(document)
  }).toString();
  return url.href;
}

function showAppToast(message, options = {}) {
  if (!elements.appToast || !message) return;
  window.clearTimeout(appToastTimerId);
  elements.appToast.value = message;
  elements.appToast.hidden = false;
  elements.appToast.classList.toggle("is-error", options.error === true);
  appToastTimerId = window.setTimeout(() => {
    elements.appToast.hidden = true;
    elements.appToast.value = "";
  }, options.duration ?? 4200);
}

function setShareFeedback(message, options = {}) {
  setCloudStatus(message, { menu: false, error: options.error === true });
  if (elements.shareLinkDialog?.open) {
    elements.shareLinkDialogStatus.value = message;
    elements.shareLinkDialogStatus.classList.toggle("is-error", options.error === true);
  }
  showAppToast(message, options);
}

async function copyShareLink(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

async function copyPendingShareLink() {
  const share = pendingShareLink;
  if (!share) return;
  try {
    await copyShareLink(share.url);
    if (elements.shareLinkDialog?.open) elements.shareLinkDialog.close("copied");
    setShareFeedback(t("list.shareCopied"));
  } catch (error) {
    console.warn("GRID ATLAS share link copy failed", error);
    elements.shareLinkValue.focus();
    elements.shareLinkValue.select();
    setShareFeedback(t("list.shareCopyFailed"), { error: true });
  }
}

async function sharePendingLinkNatively() {
  const share = pendingShareLink;
  if (!share || typeof navigator.share !== "function") return;
  try {
    await navigator.share({
      title: `GRID ATLAS — ${share.title}`,
      text: cloudText(`GRID ATLAS「${share.title}」`, `GRID ATLAS “${share.title}”`),
      url: share.url
    });
    if (elements.shareLinkDialog?.open) elements.shareLinkDialog.close("shared");
    setShareFeedback(t("list.shareCompleted"));
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.warn("GRID ATLAS native share failed", error);
    setShareFeedback(t("list.shareNativeFailed"), { error: true });
  }
}

async function sharePointListLink(list, options = {}) {
  if (!list) {
    setShareFeedback(t("list.shareUnavailable"), { error: true });
    return;
  }

  try {
    const document = pointListGridAtlasUrlDocument(list);
    const url = gridAtlasShareUrl(document);
    if (new TextEncoder().encode(url).byteLength > GRIDATLAS_RECOMMENDED_SHARE_URL_BYTES) {
      setShareFeedback(t("list.shareTooLong"), { error: true, duration: 6500 });
      return;
    }

    const title = list.name || "地点リスト";
    const summary = t("list.shareSummary")
      .replace("{name}", title)
      .replace("{count}", String(list.points.length));
    pendingShareLink = { url, title };
    if (options.persist === true) persistWorkspace();

    if (!elements.shareLinkDialog?.showModal) {
      const confirmed = window.confirm(`${summary}\n${t("list.sharePrivacy")}\n\n${t("list.shareCopy")}?`);
      if (!confirmed) return;
      await copyPendingShareLink();
      return;
    }

    elements.shareLinkSummary.textContent = summary;
    elements.shareLinkValue.value = url;
    elements.shareLinkDialogStatus.value = "";
    elements.shareLinkDialogStatus.classList.remove("is-error");
    elements.shareLinkNativeButton.hidden = typeof navigator.share !== "function";
    if (elements.shareLinkDialog.open) elements.shareLinkDialog.close();
    elements.shareLinkDialog.showModal();
  } catch (error) {
    console.warn("GRID ATLAS share link generation failed", error);
    pendingShareLink = null;
    setShareFeedback(t("list.shareGenerateFailed"), { error: true });
  }
}

async function shareStorageListLink(storageId) {
  const entry = findStorageListEntry(storageId);
  await sharePointListLink(entry?.local || entry?.preview, { persist: true });
}

async function shareSelectedPointsLink() {
  normalizeSelection();
  const points = selectedPointIds()
    .filter((pointId) => pointId !== CURRENT_LOCATION_ID)
    .map(findPoint)
    .filter(Boolean);
  if (points.length === 0) {
    setShareFeedback(t("list.shareSelectedUnavailable"), { error: true });
    return;
  }

  const defaultName = t("list.shareSelectedDefaultName");
  const input = window.prompt(t("list.shareSelectedNamePrompt"), defaultName);
  if (input === null) return;
  const name = input.trim() || defaultName;
  const now = new Date().toISOString();
  const list = {
    id: createId(),
    name,
    description: "",
    author: "",
    createdAt: now,
    updatedAt: now,
    gridAtlas: { documentId: createId() },
    points: points.map(clonePlain)
  };
  await sharePointListLink(list);
}
async function exportPointList(listId = DEFAULT_POINT_LIST_ID) {
  const list = state.pointLists.find((item) => item.id === listId) ?? localPointList();
  try {
    const result = await pointListGridAtlasPackage(list);
    downloadBlob(
      new Blob([result.bytes], { type: GRIDATLAS_MIME_TYPE }),
      "grid-atlas-" + safeFilenamePart(list.name) + "-" + dateStamp() + ".gridatlas"
    );
    elements.shareImportStatus.value = cloudText(".gridatlasを保存しました", "Saved .gridatlas");
  } catch (error) {
    console.warn("GRID ATLAS export failed", error);
    elements.shareImportStatus.value = cloudText("バックアップを保存できませんでした", "Could not save backup");
  }
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
function observationExportRecords() {
  const records = state.loadedObservations.map((observation) => ({
    ...clonePlain(observation),
    exportedAt: new Date().toISOString()
  }));
  const snapshot = observationSnapshot();
  if (snapshot) {
    records.push(snapshot);
  }

  return records;
}

function observationExportPayload() {
  const records = observationExportRecords();
  if (records.length === 0) {
    return null;
  }

  if (records.length === 1) {
    return {
      ...clonePlain(records[0]),
      exportedAt: new Date().toISOString()
    };
  }

  return {
    type: "grid-atlas-observations",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: records.map((record) => ({
      ...clonePlain(record),
      exportedAt: record.exportedAt ?? new Date().toISOString()
    }))
  };
}

function exportObservationRecord() {
  const payload = observationExportPayload();
  if (!payload) {
    elements.shareImportStatus.value = "観察記録なし";
    return;
  }

  downloadJson(payload, `grid-atlas-observation-${dateTimeStamp()}.json`);
}

function normalizeObservationPoint(point, fallbackTitle) {
  if (!point || typeof point !== "object") {
    return null;
  }

  const geo = pointGeoFromAny(point, null);
  if (!geo) {
    return null;
  }

  const projected = projectLatLng(geo.lat, geo.lng);
  return {
    id: typeof point.id === "string" && point.id ? point.id : createId(),
    title: typeof point.title === "string" && point.title.trim() ? point.title.trim() : fallbackTitle,
    x: projected.x,
    y: projected.y,
    geo,
    recordedAt: typeof point.recordedAt === "string" ? point.recordedAt : new Date().toISOString()
  };
}

function normalizeObservationRecord(parsed) {
  if (parsed?.type !== "grid-atlas-observation" || !Array.isArray(parsed.trail)) {
    throw new Error("Invalid observation");
  }

  const start = normalizeObservationPoint(parsed.start, "起点");
  const target = parsed.target ? normalizeObservationPoint(parsed.target, "対象") : null;
  const trail = parsed.trail.map((point) => normalizeObservationPoint(point, "現在地")).filter(Boolean);
  if (!start || trail.length === 0 || (parsed.target && !target)) {
    throw new Error("Invalid observation points");
  }

  const path = [start, ...trail];
  const traveled = path.slice(1).reduce((total, point, index) => total + distanceBetween(path[index], point), 0);
  const current = trail.at(-1);
  const directToCurrent = distanceBetween(start, current);
  const endedAt = typeof parsed.endedAt === "string" ? parsed.endedAt : trail.at(-1).recordedAt;
  return {
    id: typeof parsed.id === "string" && parsed.id ? parsed.id : createObservationId(),
    type: "grid-atlas-observation",
    version: 1,
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : observationRecordName(start, target, endedAt),
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : trail[0].recordedAt,
    endedAt,
    start,
    target,
    trail,
    metrics: {
      remaining: target ? distanceBetween(current, target) : NaN,
      traveled,
      ratio: directToCurrent > 1 ? traveled / directToCurrent : NaN
    }
  };
}

function normalizeObservationRecordsPayload(parsed) {
  if (parsed?.type === "grid-atlas-observations") {
    const records = Array.isArray(parsed.records)
      ? parsed.records
      : Array.isArray(parsed.observations)
        ? parsed.observations
        : [];
    return records.map(normalizeObservationRecord);
  }

  return [normalizeObservationRecord(parsed)];
}

async function importObservationFiles(files, mode) {
  const fileItems = selectedFiles(files);
  if (fileItems.length === 0) {
    return;
  }

  try {
    const parsedFiles = await Promise.all(fileItems.map(readJsonFile));
    const observations = parsedFiles.flatMap(normalizeObservationRecordsPayload);
    if (observations.length === 0) {
      throw new Error("No observations");
    }

    const action = mode === "replace" ? "観察記録を新規読み込み" : "観察記録を追加読み込み";
    if (observationResetNeedsConfirmation() && !confirmObservationReset(action)) {
      return;
    }

    if (state.followCurrentLocation) {
      stopLocationFollow({ render: false });
    }
    resetObservationTrail();

    if (mode === "replace") {
      state.loadedObservations = [];
    }

    const existingIds = new Set(state.loadedObservations.map((observation) => observation.id));
    const importedObservations = observations.map((observation) => withObservationId(observation, existingIds));
    state.loadedObservations.push(...importedObservations);
    setSelection(importedObservations.map((observation) => ({ type: "observation", id: observation.id })), { render: false });
    elements.shareImportStatus.value = mode === "replace" ? "観察記録を新規読み込みしました" : "観察記録を追加しました";
    fitToPoints();
  } catch {
    elements.shareImportStatus.value = "読み込みエラー";
  }
}
function clearWorkspace() {
  const confirmed = window.confirm("グリッドを初期化しますか。登録地点、線、読み込み観察を消去します。\nバックアップには影響しません。");
  if (!confirmed) {
    return;
  }

  state.pointLists = [createLocalPointList()];
  state.activePointListId = DEFAULT_POINT_LIST_ID;
  refreshVisiblePoints();
  state.links = [];
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
  state.editingPointId = null;
  state.lastDeleted = null;
  state.routeSelectionIds = [];
  state.routeStartPointId = null;
  state.routeStartSnapshot = null;
  state.routeReturnToStart = false;
  state.routeResult = null;
  state.loadedObservations = [];
  clearTarget({ render: false });
  localStorage.removeItem(STORAGE_KEY);
  render();
}

async function deleteSelectedPoint() {
  normalizeSelection();
  const selectedIds = selectedPointIds().filter((id) => id !== CURRENT_LOCATION_ID);
  const pointIds = selectedIds.filter((id) => pointEditable(id));
  const cloudPointIds = selectedIds.filter((id) => (
    !pointIds.includes(id) && state.cloud.connected && cloudPointListForPoint(id)?.editable
  ));
  const explicitLinkIds = selectedLinkIds();
  const selectedObservations = selectedLoadedObservations();
  const selectedObservationIdSet = new Set(selectedObservations.map((observation) => observation.id));
  const pointIdSet = new Set(pointIds);
  const cloudPointIdSet = new Set(cloudPointIds);
  const deletionPointIdSet = new Set([...pointIdSet, ...cloudPointIdSet]);
  const linkIdSet = new Set(explicitLinkIds);

  for (const link of state.links) {
    if (deletionPointIdSet.has(link.a) || deletionPointIdSet.has(link.b)) {
      linkIdSet.add(link.id);
    }
  }

  if (deletionPointIdSet.size + linkIdSet.size + selectedObservationIdSet.size === 0) {
    return;
  }

  const parts = [];
  if (pointIdSet.size > 0) {
    parts.push(String(pointIdSet.size) + "点");
  }
if (cloudPointIdSet.size > 0) {
    parts.push(String(cloudPointIdSet.size) + "クラウド地点");
  }
  if (linkIdSet.size > 0) {
    parts.push(String(linkIdSet.size) + "線");
  }
  if (selectedObservationIdSet.size > 0) {
    parts.push(String(selectedObservationIdSet.size) + "観察（保存ファイルには影響しません）");
  }

  const confirmed = window.confirm("選択中の" + parts.join(" / ") + "を削除しますか。");
  if (!confirmed) {
    return;
  }

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
        message: cloudText("クラウド地点を削除しました", "Cloud point(s) deleted")
      });
      if (!updated) {
        render();
        return;
      }
    }
  }

  state.lastDeleted = {
    points: state.points.filter((item) => pointIdSet.has(item.id)).map(clonePlain),
    links: state.links.filter((item) => (
      linkIdSet.has(item.id)
      && !cloudPointIdSet.has(item.a)
      && !cloudPointIdSet.has(item.b)
    )).map(clonePlain),
    observations: selectedObservations.map(clonePlain)
  };
  if (selectedObservationIdSet.size > 0) {
    state.loadedObservations = state.loadedObservations.filter((observation) => !selectedObservationIdSet.has(observation.id));
  }
  for (const list of state.pointLists) {
    if (list.editable) {
      list.points = list.points.filter((item) => !pointIdSet.has(item.id));
    }
  }
  refreshVisiblePoints();
  state.links = state.links.filter((item) => !linkIdSet.has(item.id));
  state.selection = [];
  state.selectedPointId = null;
  state.selectedLinkId = null;
  state.pendingLinkPointId = null;
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

  if (pointIdSet.size + linkIdSet.size > 0) {
    persistWorkspace();
  }
  render();
}

function bindEvents() {
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
  elements.settingsRouteReturnToStart.addEventListener("change", () => {
    setRouteReturnToStart(elements.settingsRouteReturnToStart.checked);
    render();
  });
  elements.settingsMapProviderSelect.addEventListener("change", () => {
    setMapProvider(elements.settingsMapProviderSelect.value);
    render();
  });
  elements.createPointTransferListButton.addEventListener("click", createPointTransferDestinationList);
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
  elements.storageTransferMoveButton.addEventListener("click", () => void executeStorageListTransfer("move"));
  elements.storageTransferCopyButton.addEventListener("click", () => void executeStorageListTransfer("copy"));
  elements.storageTransferCancelButton.addEventListener("click", closeStorageTransferDialog);
  elements.storageTransferDialog.addEventListener("click", (event) => {
    if (event.target === elements.storageTransferDialog) closeStorageTransferDialog();
  });
  elements.storageTransferDialog.addEventListener("close", () => {
    state.pendingStorageTransfer = null;
  });  elements.settingsGpsEnabled.addEventListener("change", () => {
    setGpsEnabled(elements.settingsGpsEnabled.checked);
  });
  elements.systemUpdateButton.addEventListener("click", () => void requestSystemUpdate());
  elements.cloudConnectButton.addEventListener("click", () => void connectCloud());
  elements.cloudDisconnectButton.addEventListener("click", disconnectCloud);
  elements.cloudAccessToken.addEventListener("input", renderStorageLists);
  document.addEventListener("click", () => setSettingsMenuOpen(false));
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
  elements.actionLinkButton.addEventListener("click", connectSelectedPoints);
  elements.actionRegisterButton.addEventListener("click", submitPendingPoint);
  elements.actionRouteButton.addEventListener("click", setRouteFromSelectedPoints);
  elements.clearSelectionButton.addEventListener("click", () => clearSelection());
  elements.actionTargetButton.addEventListener("click", toggleTargetForSelection);
  elements.actionRouteStartButton.addEventListener("click", setRouteStartFromSelection);
  elements.actionFollowButton.addEventListener("click", () => toggleLocationFollow({ fillForm: false }));
  elements.actionCenterButton.addEventListener("click", createCenterPendingPoint);
  elements.actionCopyToListButton.addEventListener("click", () => beginPointTransfer("copy"));
  elements.actionMoveToListButton.addEventListener("click", () => beginPointTransfer("move"));
  elements.actionShareSelectedButton.addEventListener("click", () => void shareSelectedPointsLink());
  elements.actionInfoButton.addEventListener("click", showSelectedPointInfoDialog);
  elements.actionRestoreButton.addEventListener("click", restoreLastDeleted);
  elements.actionEditButton.addEventListener("click", startEditingSelectedPoint);
  elements.actionMapButton.addEventListener("click", openSelectedPointInPreferredMap);

  elements.pointForm.addEventListener("submit", submitPoint);
  elements.pointDestinationListSelect.addEventListener("change", () => {
    setActivePointList(elements.pointDestinationListSelect.value);
  });
  elements.readClipboardButton.addEventListener("click", readClipboardShare);
  elements.shareLinkCopyButton.addEventListener("click", () => void copyPendingShareLink());
  elements.shareLinkNativeButton.addEventListener("click", () => void sharePendingLinkNatively());
  elements.shareLinkDialog.addEventListener("close", () => {
    pendingShareLink = null;
    elements.shareLinkSummary.textContent = "";
    elements.shareLinkValue.value = "";
    elements.shareLinkDialogStatus.value = "";
    elements.shareLinkDialogStatus.classList.remove("is-error");
  });
  elements.shareLinkDialog.addEventListener("click", (event) => {
    if (event.target === elements.shareLinkDialog) elements.shareLinkDialog.close("cancel");
  });
  elements.pointInfoDialog.addEventListener("close", renderActionButtons);
  elements.pointInfoDialog.addEventListener("click", (event) => {
    if (event.target === elements.pointInfoDialog) elements.pointInfoDialog.close("cancel");
  });
  elements.useLocationButton.addEventListener("click", useCurrentLocation);
  elements.zoomInButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 1.25));
  elements.zoomOutButton.addEventListener("click", () => zoomAt({ x: canvasSize().width / 2, y: canvasSize().height / 2 }, 0.8));
  elements.fitButton.addEventListener("click", fitToPoints);
  elements.originButton.addEventListener("click", centerAndFollowCurrentLocation);
  elements.routeStartSelect.addEventListener("change", () => setRouteStart(elements.routeStartSelect.value));
  elements.routeReturnToStart.addEventListener("change", () => {
    setRouteReturnToStart(elements.routeReturnToStart.checked);
    render();
  });
  elements.computeRouteButton.addEventListener("click", computeRouteFromSelection);
  elements.clearRouteSelectionButton.addEventListener("click", clearRouteSelection);
  elements.openAppleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("apple"));
  elements.openGoogleMapsButton.addEventListener("click", () => openSelectedPointInExternalMap("google"));
  elements.targetPointButton.addEventListener("click", toggleTargetForSelection);
  elements.deletePointButton.addEventListener("click", deleteSelectedPoint);
  for (const button of elements.newPointListButtons) {
    button.addEventListener("click", createNewPointList);
  }

  elements.backupExportButton.addEventListener("click", () => {
    if (elements.backupListSelect.value) void exportPointList(elements.backupListSelect.value);
  });
  elements.replacePointsButton.addEventListener("click", () => {
    elements.pointImportFile.click();
  });
  elements.pointImportFile.addEventListener("change", async () => {
    const files = selectedFiles(elements.pointImportFile.files);
    const gridAtlasFiles = files.filter(gridAtlasFileLikely);
    const jsonFiles = files.filter((file) => !gridAtlasFileLikely(file));
    if (gridAtlasFiles.length > 0) await importGridAtlasFiles(gridAtlasFiles, { source: "picker" });
    if (jsonFiles.length > 0) await importPointListFiles(jsonFiles);
    elements.pointImportFile.value = "";
  });
  elements.exportObservationButton.addEventListener("click", exportObservationRecord);
  elements.replaceObservationButton.addEventListener("click", () => {
    pendingObservationImportMode = "replace";
    elements.observationImportFile.click();
  });
  elements.appendObservationButton.addEventListener("click", () => {
    pendingObservationImportMode = "append";
    elements.observationImportFile.click();
  });
  elements.observationImportFile.addEventListener("change", () => {
    const files = selectedFiles(elements.observationImportFile.files);
    if (files.length > 0) {
      void importObservationFiles(files, pendingObservationImportMode);
    }
    elements.observationImportFile.value = "";
  });
  elements.clearButton.addEventListener("click", clearWorkspace);
  for (const tab of elements.mobilePageTabs) {
    tab.addEventListener("click", () => {
      setMobilePage(tab.dataset.mobilePage);
      setSettingsMenuOpen(false);
    });
  }
  for (const tab of elements.mobileGridTabs) {
    tab.addEventListener("click", () => {
      setMobileGridPage(tab.dataset.mobileGridPage);
      if (tab.closest(".sidebar")) {
        setMobilePage("map");
      }
    });
  }

  canvas.addEventListener("pointerdown", (event) => {
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
      return;
    }

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

    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;

    if (Math.hypot(dx, dy) > POINTER_MOVE_THRESHOLD) {
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
loadPreferences();
loadCloudSettings();
registerGridAtlasFileLaunchHandler();
bindEvents();
initMobilePages();
resizeCanvas();
void hydrateWorkspaceAssetPhotos()
  .catch((error) => console.warn("GRID ATLAS asset hydration failed", error))
  .finally(() => void handleIncomingGridAtlasUrl());
handleIncomingShare();
locateOnStartup();
registerServiceWorker();
render();
if (state.cloud.connected) void refreshCloudLists();
