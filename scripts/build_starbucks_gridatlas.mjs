import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildGridAtlasArchive } from "../src/gridatlas-import.js";

const apiBase = "https://hn8madehag.execute-api.ap-northeast-1.amazonaws.com/prd-2019-08-21/storesearch";
const storeLocatorUrl = "https://store.starbucks.co.jp/";
const defaultOutputPath = "docs/data/starbucks-japan-2026/starbucks-japan-stores-2026.gridatlas";
const capturedAt = process.argv[2] || new Date().toISOString();
const outputPath = resolve(process.argv[3] || defaultOutputPath);

const prefectures = [
  ["1", "北海道"], ["2", "青森県"], ["3", "岩手県"], ["4", "宮城県"], ["5", "秋田県"],
  ["6", "山形県"], ["7", "福島県"], ["8", "茨城県"], ["9", "栃木県"], ["10", "群馬県"],
  ["11", "埼玉県"], ["12", "千葉県"], ["13", "東京都"], ["14", "神奈川県"], ["15", "新潟県"],
  ["16", "富山県"], ["17", "石川県"], ["18", "福井県"], ["19", "山梨県"], ["20", "長野県"],
  ["21", "岐阜県"], ["22", "静岡県"], ["23", "愛知県"], ["24", "三重県"], ["25", "滋賀県"],
  ["26", "京都府"], ["27", "大阪府"], ["28", "兵庫県"], ["29", "奈良県"], ["30", "和歌山県"],
  ["31", "鳥取県"], ["32", "島根県"], ["33", "岡山県"], ["34", "広島県"], ["35", "山口県"],
  ["36", "徳島県"], ["37", "香川県"], ["38", "愛媛県"], ["39", "高知県"], ["40", "福岡県"],
  ["41", "佐賀県"], ["42", "長崎県"], ["43", "熊本県"], ["44", "大分県"], ["45", "宮崎県"],
  ["46", "鹿児島県"], ["47", "沖縄県"]
];

function buildSearchUrl(prefCode, start) {
  const params = new URLSearchParams({
    size: "100",
    "q.parser": "structured",
    q: `(and ver:10000 record_type:1 pref_code:${prefCode})`,
    fq: "(and data_type:'prd')",
    sort: "zip_code asc,store_id asc",
    start: String(start)
  });
  return `${apiBase}?${params}`;
}

async function fetchPrefecture(prefCode, prefectureName) {
  const stores = [];
  let start = 0;
  let found = null;

  while (found === null || start < found) {
    const response = await fetch(buildSearchUrl(prefCode, start), {
      headers: {
        accept: "application/json",
        origin: storeLocatorUrl.slice(0, -1),
        referer: storeLocatorUrl,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`店舗検索APIが失敗しました: ${prefectureName} ${response.status}`);
    }
    const data = await response.json();
    found = Number(data?.hits?.found ?? 0);
    const hits = Array.isArray(data?.hits?.hit) ? data.hits.hit : [];
    stores.push(...hits);
    if (hits.length === 0) break;
    start += hits.length;
  }

  return { prefCode, prefectureName, stores };
}

function toPlace(record, prefectureName) {
  const fields = record?.fields || {};
  const storeId = String(fields.store_id || "");
  const location = String(fields.location || "").split(",").map(Number);
  if (!storeId || location.length !== 2 || location.some((value) => !Number.isFinite(value))) {
    throw new Error(`店舗データの必須値がありません: ${JSON.stringify(fields)}`);
  }

  const [latitude, longitude] = location;
  const officialUrl = `${storeLocatorUrl}detail-${storeId}/`;
  const services = [];
  if (fields.mobile_order_and_pay === "1") services.push("Mobile Order & Pay");
  if (fields.public_wireless_service_flg === "1") services.push("無線LANサービス");
  if (fields.store_type === "3") services.push("ドライブスルー");
  if (fields.service_area === "1") services.push("サービスエリア");
  if (fields.station === "1") services.push("新幹線駅構内");
  if (fields.airport === "1") services.push("空港");
  if (fields.reserve_flg === "1") services.push("リザーブ販売店舗");
  if (fields.tea_cafe === "1") services.push("STARBUCKS Tea & Cafe");
  if (fields.book_cafe === "1") services.push("Book & Cafe");
  if (fields.regional_landmark_flg === "1") services.push("リージョナル ランドマーク ストア");
  if (fields.family_friendly_flg === "1") services.push("Family Friendly");

  const address = fields.address_5 || [fields.address_1, fields.address_2].filter(Boolean).join(" ");
  return {
    id: `starbucks-jp-${storeId}`,
    name: String(fields.name || `スターバックス ${storeId}`),
    position: {
      latitude,
      longitude
    },
    note: [
      address,
      `店舗ID: ${storeId}`,
      `公式店舗ページ: ${officialUrl}`
    ].filter(Boolean).join(" / "),
    extensions: {
      "io.gridatlas.starbucks": {
        storeId,
        prefecture: prefectureName,
        city: fields.address_2 || "",
        address,
        officialUrl,
        services
      }
    }
  };
}

const results = [];
for (const [prefCode, prefectureName] of prefectures) {
  const result = await fetchPrefecture(prefCode, prefectureName);
  results.push(result);
  console.log(`${prefectureName}: ${result.stores.length}店舗`);
}

const records = results.flatMap((result) => result.stores.map((store) => ({
  store,
  prefectureName: result.prefectureName
})));
const places = records.map(({ store, prefectureName }) => toPlace(store, prefectureName));
const uniquePlaces = [...new Map(places.map((place) => [place.id, place])).values()];
if (uniquePlaces.length !== places.length) {
  throw new Error(`店舗IDが重複しています: ${places.length - uniquePlaces.length}件`);
}

const document = {
  type: "place-list",
  schemaVersion: 1,
  id: "starbucks-japan-stores-2026",
  name: "スターバックス 日本店舗一覧（2026-08-13取得）",
  description: `スターバックス コーヒー ジャパン公式店舗検索から${capturedAt.slice(0, 10)}に取得した、日本全国47都道府県の店舗一覧。店舗名、店舗検索画面の地図用座標、住所、公式店舗ページ、主なサービスを収録しています。営業時間は変動するため、この地点リストには固定保存していません。`,
  attribution: {
    name: "スターバックス コーヒー ジャパン 公式店舗検索",
    url: storeLocatorUrl,
    license: "公式サイトの利用条件に従って利用"
  },
  createdAt: capturedAt,
  updatedAt: capturedAt,
  places: uniquePlaces
};

const archive = await buildGridAtlasArchive(document, [], { exportedAt: capturedAt });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, archive.bytes);
console.log(`出力: ${outputPath}`);
console.log(`地点数: ${uniquePlaces.length}`);
console.log(`ファイルサイズ: ${archive.bytes.byteLength} bytes`);
