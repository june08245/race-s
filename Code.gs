/**
 * Race Share - Google Apps Script Backend (Ver.3)
 * ------------------------------------------------
 * Ver.2からの追加点:
 * - サイト全体パスワード保護（全アクションでsitePasswordを検証）
 * - AI予想ページ（管理者のみ投稿、全員閲覧）
 *
 * セットアップ:
 * 1. 拡張機能 > Apps Script にこのコードを貼り付け
 * 2. ADMIN_CODE と SITE_PASSWORD を変更
 * 3. デプロイ（ウェブアプリ / 全員アクセス可）
 * 4. 発行URLを config.js の API_URL に設定
 *
 * ⚠️ entriesシートの列構成はVer.2から変更なし。
 * 新たに prediction シートが自動生成されます。
 */

// ==== 設定 ====
const ADMIN_CODE = 'yourSecretCode123';   // 管理画面用の合言葉
const SITE_PASSWORD = 'umaumauma2026';    // サイト全体の合言葉（これを知らないと閲覧不可）

const SHEET_NAMES = {
  RACE: 'race',
  ENTRIES: 'entries',
  RESULT: 'result',
  RANKING: 'ranking',
  PREDICTION: 'prediction',
  HORSES: 'horses',
  COMMENTS: 'comments'
};

const BET_TYPES = ['単勝', '複勝', '馬連', '馬単', '三連複F', '三連複BOX'];

// ==== エントリーポイント ====

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  let action = '';
  let params = {};

  try {
    if (e.postData && e.postData.contents) {
      const body = JSON.parse(e.postData.contents);
      action = body.action;
      params = body.params || {};
    } else {
      action = e.parameter.action;
      params = e.parameter;
    }

    // サイトパスワードチェック（checkSitePassword自体を除く全アクションに適用）
    if (action !== 'checkSitePassword') {
      checkSite(params.sitePassword);
    }

    let result;
    switch (action) {
      case 'checkSitePassword':
        checkSite(params.sitePassword);
        result = { ok: true };
        break;
      case 'getHome':
        result = getHome();
        break;
      case 'getActiveRaces':
        result = getActiveRaces();
        break;
      case 'getRace':
        result = getCurrentRace();
        break;
      case 'submitEntry':
        result = submitEntry(params);
        break;
      case 'getEntries':
        result = getEntries(params.raceId);
        break;
      case 'getMyEntry':
        result = getMyEntry(params.raceId, params.name);
        break;
      case 'getRanking':
        result = getRanking();
        break;
      case 'getPastRaces':
        result = getPastRaces();
        break;
      case 'getPastRaceDetail':
        result = getPastRaceDetail(params.raceId);
        break;
      case 'getPrediction':
        result = getPrediction(params.raceId);
        break;
      case 'getHorses':
        result = getHorses(params.raceId);
        break;
      case 'getComments':
        result = getComments(params.raceId);
        break;
      case 'submitComment':
        result = submitComment(params);
        break;
      case 'likeComment':
        result = likeComment(params);
        break;
      // ---- 管理者用 ----
      case 'adminCreateRace':
        checkAdmin(params.adminCode);
        result = adminCreateRace(params);
        break;
      case 'adminUpdateRaceStatus':
        checkAdmin(params.adminCode);
        result = adminUpdateRaceStatus(params);
        break;
      case 'adminUpdateDeadline':
        checkAdmin(params.adminCode);
        result = adminUpdateDeadline(params);
        break;
      case 'adminSubmitResult':
        checkAdmin(params.adminCode);
        result = adminSubmitResult(params);
        break;
      case 'adminGetRaces':
        checkAdmin(params.adminCode);
        result = adminGetRaces();
        break;
      case 'adminSubmitPrediction':
        checkAdmin(params.adminCode);
        result = adminSubmitPrediction(params);
        break;
      case 'adminSubmitHorses':
        checkAdmin(params.adminCode);
        result = adminSubmitHorses(params);
        break;
      default:
        throw new Error('不明なアクションです: ' + action);
    }

    return jsonOutput({ ok: true, data: result });
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkAdmin(code) {
  if (code !== ADMIN_CODE) {
    throw new Error('管理者コードが正しくありません');
  }
}

function checkSite(pw) {
  if (pw !== SITE_PASSWORD) {
    throw new Error('サイトパスワードが正しくありません');
  }
}

// ==== シート取得ヘルパー ====

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  const headers = {
    race: ['RaceID', 'レース名', '開催日', '競馬場', '発送時刻', '締切時刻', '状態'],
    entries: [
      'EntryID', 'RaceID', '投稿日時', '名前',
      '単勝', '複勝', '馬連', '馬単',
      '三連複F_1着', '三連複F_2着', '三連複F_3着',
      '三連複BOX', 'コメント'
    ],
    result: ['RaceID', '1着', '2着', '3着'],
    ranking: ['名前', '購入点数', '的中点数', '的中率', 'ポイント'],
    prediction: ['RaceID', '本文', '更新日時'],
    horses: ['RaceID', '枠番', '馬番', '馬名', '騎手'],
    comments: ['CommentID', 'RaceID', 'ParentCommentID', '投稿日時', '名前', '本文', 'いいね数']
  };
  if (headers[name]) {
    sheet.getRange(1, 1, 1, headers[name].length).setValues([headers[name]]);
    sheet.setFrozenRows(1);
  }
}

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = values.slice(1);
  return rows
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

// ==== レース関連 ====

function getCurrentRace() {
  const sheet = getSheet(SHEET_NAMES.RACE);
  const races = sheetToObjects(sheet);
  const active = races.filter(r => r['状態'] === '受付中' || r['状態'] === '締切');
  if (active.length === 0) return null;
  return active[active.length - 1];
}

function getHome() {
  const race = getCurrentRace();
  return { race };
}

function getActiveRaces() {
  const sheet = getSheet(SHEET_NAMES.RACE);
  const races = sheetToObjects(sheet);
  return races.filter(r => r['状態'] === '受付中' || r['状態'] === '締切');
}

// ==== 買い目パース・バリデーション ====

function parseNumberList(str) {
  if (!str) return [];
  return String(str).split(',').map(s => s.trim()).filter(s => s !== '');
}

function validateEntry(params) {
  ['単勝', '複勝'].forEach(bt => {
    const list = parseNumberList(params[bt]);
    list.forEach(n => {
      if (!/^\d+$/.test(n)) throw new Error(`${bt}の入力形式が正しくありません（例: 5 または 5,8）`);
    });
  });

  const umaren = parseNumberList(params['馬連']);
  umaren.forEach(pair => {
    if (!/^\d+-\d+$/.test(pair)) throw new Error('馬連の入力形式が正しくありません（例: 3-5 または 3-5,3-8）');
  });

  const umatan = parseNumberList(params['馬単']);
  umatan.forEach(pair => {
    if (!/^\d+>\d+$/.test(pair)) throw new Error('馬単の入力形式が正しくありません（例: 3>5 または 3>5,3>8）');
  });

  ['三連複F_1着', '三連複F_2着', '三連複F_3着'].forEach(key => {
    const list = parseNumberList(params[key]);
    list.forEach(n => {
      if (!/^\d+$/.test(n)) throw new Error('三連複フォーメーションの入力形式が正しくありません（例: 3,5）');
    });
  });

  const box = parseNumberList(params['三連複BOX']);
  if (box.length > 0 && box.length < 3) {
    throw new Error('三連複ボックスは3頭以上入力してください（例: 3,5,8）');
  }
  box.forEach(n => {
    if (!/^\d+$/.test(n)) throw new Error('三連複ボックスの入力形式が正しくありません（例: 3,5,8）');
  });
}

// ==== 予想投稿 ====

function submitEntry(params) {
  const race = getRaceById(params.raceId);
  if (!race) throw new Error('レースが見つかりません');
  if (race['状態'] === '締切' || race['状態'] === '結果確定') {
    throw new Error('締切済みのため投稿できません');
  }
  if (!params.name) throw new Error('お名前を入力してください');

  validateEntry(params);

  const hasAnyBet = BET_TYPES.some(bt => {
    if (bt === '三連複F') {
      return params['三連複F_1着'] || params['三連複F_2着'] || params['三連複F_3着'];
    }
    return params[bt];
  });
  if (!hasAnyBet) throw new Error('少なくとも1つの券種を入力してください');

  const sheet = getSheet(SHEET_NAMES.ENTRIES);
  const entries = sheetToObjects(sheet);

  const existingIndex = entries.findIndex(en => en['RaceID'] === params.raceId && en['名前'] === params.name);
  const now = new Date();

  const rowData = [
    existingIndex >= 0 ? entries[existingIndex]['EntryID'] : Utilities.getUuid(),
    params.raceId,
    now,
    params.name,
    params['単勝'] || '',
    params['複勝'] || '',
    params['馬連'] || '',
    params['馬単'] || '',
    params['三連複F_1着'] || '',
    params['三連複F_2着'] || '',
    params['三連複F_3着'] || '',
    params['三連複BOX'] || '',
    params.comment || ''
  ];

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { success: true };
}

function getEntries(raceId) {
  const race = getRaceById(raceId);
  if (!race) throw new Error('レースが見つかりません');
  if (race['状態'] === '受付中') {
    return { visible: false, entries: [] };
  }
  const sheet = getSheet(SHEET_NAMES.ENTRIES);
  const entries = sheetToObjects(sheet).filter(en => en['RaceID'] === raceId);
  entries.sort((a, b) => new Date(a['投稿日時']) - new Date(b['投稿日時']));

  const resultSheet = getSheet(SHEET_NAMES.RESULT);
  const result = sheetToObjects(resultSheet).find(r => r['RaceID'] === raceId);
  const enriched = entries.map(en => ({
    ...en,
    judgement: result ? judgeEntry(en, result) : null
  }));

  return { visible: true, entries: enriched };
}

function getMyEntry(raceId, name) {
  const sheet = getSheet(SHEET_NAMES.ENTRIES);
  const entries = sheetToObjects(sheet);
  const mine = entries.find(en => en['RaceID'] === raceId && en['名前'] === name);
  return mine || null;
}

function getRaceById(raceId) {
  const sheet = getSheet(SHEET_NAMES.RACE);
  const races = sheetToObjects(sheet);
  return races.find(r => r['RaceID'] === raceId) || null;
}

// ==== 的中判定ロジック ====

function combinations(arr, k) {
  const result = [];
  function helper(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

function judgeEntry(entry, result) {
  const first = String(result['1着']);
  const second = String(result['2着']);
  const third = String(result['3着']);
  const top3Set = new Set([first, second, third]);

  const detail = {};
  let totalBuy = 0;
  let totalHit = 0;

  {
    const list = parseNumberList(entry['単勝']);
    const hits = list.filter(n => n === first);
    detail['単勝'] = { buy: list, hit: hits };
    totalBuy += list.length;
    totalHit += hits.length;
  }

  {
    const list = parseNumberList(entry['複勝']);
    const hits = list.filter(n => top3Set.has(n));
    detail['複勝'] = { buy: list, hit: hits };
    totalBuy += list.length;
    totalHit += hits.length;
  }

  {
    const list = parseNumberList(entry['馬連']);
    const target = new Set([first, second]);
    const hits = list.filter(pair => {
      const [a, b] = pair.split('-');
      return target.has(a) && target.has(b) && a !== b;
    });
    detail['馬連'] = { buy: list, hit: hits };
    totalBuy += list.length;
    totalHit += hits.length;
  }

  {
    const list = parseNumberList(entry['馬単']);
    const hits = list.filter(pair => {
      const [a, b] = pair.split('>');
      return a === first && b === second;
    });
    detail['馬単'] = { buy: list, hit: hits };
    totalBuy += list.length;
    totalHit += hits.length;
  }

  {
    const c1 = parseNumberList(entry['三連複F_1着']);
    const c2 = parseNumberList(entry['三連複F_2着']);
    const c3 = parseNumberList(entry['三連複F_3着']);
    const combos = new Set();
    c1.forEach(a => c2.forEach(b => c3.forEach(c => {
      if (a !== b && b !== c && a !== c) {
        combos.add([a, b, c].sort().join('-'));
      }
    })));
    const buyList = Array.from(combos);
    const targetKey = [first, second, third].sort().join('-');
    const hits = buyList.filter(key => key === targetKey);
    detail['三連複F'] = { buy: buyList, hit: hits };
    totalBuy += buyList.length;
    totalHit += hits.length;
  }

  {
    const nums = parseNumberList(entry['三連複BOX']);
    const combos = nums.length >= 3 ? combinations(nums, 3).map(c => c.slice().sort().join('-')) : [];
    const targetKey = [first, second, third].sort().join('-');
    const hits = combos.filter(key => key === targetKey);
    detail['三連複BOX'] = { buy: combos, hit: hits };
    totalBuy += combos.length;
    totalHit += hits.length;
  }

  return { detail, totalBuy, totalHit };
}

// ==== 結果・ランキング ====

function adminSubmitResult(params) {
  const resultSheet = getSheet(SHEET_NAMES.RESULT);
  const results = sheetToObjects(resultSheet);
  const existingIndex = results.findIndex(r => r['RaceID'] === params.raceId);
  const rowData = [params.raceId, params.first, params.second, params.third];

  if (existingIndex >= 0) {
    resultSheet.getRange(existingIndex + 2, 1, 1, rowData.length).setValues([rowData]);
  } else {
    resultSheet.appendRow(rowData);
  }

  updateRaceStatus(params.raceId, '結果確定');
  recalculateRanking();

  return { success: true };
}

function recalculateRanking() {
  const entriesSheet = getSheet(SHEET_NAMES.ENTRIES);
  const resultSheet = getSheet(SHEET_NAMES.RESULT);
  const allEntries = sheetToObjects(entriesSheet);
  const allResults = sheetToObjects(resultSheet);

  const resultMap = {};
  allResults.forEach(r => resultMap[r['RaceID']] = r);

  const statsByName = {};

  allEntries.forEach(entry => {
    const result = resultMap[entry['RaceID']];
    if (!result) return;

    const name = entry['名前'];
    if (!statsByName[name]) {
      statsByName[name] = { buy: 0, hit: 0 };
    }

    const judgement = judgeEntry(entry, result);
    statsByName[name].buy += judgement.totalBuy;
    statsByName[name].hit += judgement.totalHit;
  });

  const rankingSheet = getSheet(SHEET_NAMES.RANKING);
  rankingSheet.clear();
  initSheetHeaders(rankingSheet, 'ranking');

  const rows = Object.keys(statsByName).map(name => {
    const s = statsByName[name];
    const rate = s.buy ? (s.hit / s.buy * 100) : 0;
    const points = s.hit * 10;
    return [name, s.buy, s.hit, rate.toFixed(1) + '%', points];
  });

  rows.sort((a, b) => b[4] - a[4]);

  if (rows.length > 0) {
    rankingSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function getRanking() {
  const sheet = getSheet(SHEET_NAMES.RANKING);
  return sheetToObjects(sheet);
}

// ==== 過去レース ====

function getPastRaces() {
  const raceSheet = getSheet(SHEET_NAMES.RACE);
  const races = sheetToObjects(raceSheet).filter(r => r['状態'] === '結果確定');
  const resultSheet = getSheet(SHEET_NAMES.RESULT);
  const results = sheetToObjects(resultSheet);
  const resultMap = {};
  results.forEach(r => resultMap[r['RaceID']] = r);

  return races.map(r => ({ ...r, result: resultMap[r['RaceID']] || null }))
    .sort((a, b) => new Date(b['開催日']) - new Date(a['開催日']));
}

function getPastRaceDetail(raceId) {
  const race = getRaceById(raceId);
  const entriesData = getEntries(raceId);
  const resultSheet = getSheet(SHEET_NAMES.RESULT);
  const result = sheetToObjects(resultSheet).find(r => r['RaceID'] === raceId) || null;
  return { race, entries: entriesData.entries, result };
}

// ==== AI予想 ====

function getPrediction(raceId) {
  if (!raceId) return null;
  const sheet = getSheet(SHEET_NAMES.PREDICTION);
  const rows = sheetToObjects(sheet);
  return rows.find(r => r['RaceID'] === raceId) || null;
}

function adminSubmitPrediction(params) {
  if (!params.raceId) throw new Error('レースが指定されていません');
  const sheet = getSheet(SHEET_NAMES.PREDICTION);
  const rows = sheetToObjects(sheet);
  const existingIndex = rows.findIndex(r => r['RaceID'] === params.raceId);
  const rowData = [params.raceId, params.content || '', new Date()];

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { success: true };
}

// ==== 出走馬（枠順） ====

function getHorses(raceId) {
  if (!raceId) return [];
  const sheet = getSheet(SHEET_NAMES.HORSES);
  const rows = sheetToObjects(sheet).filter(r => r['RaceID'] === raceId);
  rows.sort((a, b) => Number(a['馬番']) - Number(b['馬番']));
  return rows;
}

/**
 * 出走馬一覧をまるごと置き換える。
 * params.horses は [{waku, umaban, name, jockey}, ...] のJSON文字列を想定
 */
function adminSubmitHorses(params) {
  if (!params.raceId) throw new Error('レースが指定されていません');
  let horseList;
  try {
    horseList = JSON.parse(params.horses);
  } catch (e) {
    throw new Error('出走馬データの形式が正しくありません');
  }

  const sheet = getSheet(SHEET_NAMES.HORSES);
  const allRows = sheetToObjects(sheet);
  const others = allRows.filter(r => r['RaceID'] !== params.raceId);

  sheet.clear();
  initSheetHeaders(sheet, 'horses');

  const newRows = horseList
    .filter(h => h.umaban)
    .map(h => [params.raceId, h.waku || '', h.umaban || '', h.name || '', h.jockey || '']);

  const otherRows = others.map(r => [r['RaceID'], r['枠番'], r['馬番'], r['馬名'], r['騎手']]);
  const allNewRows = [...otherRows, ...newRows];

  if (allNewRows.length > 0) {
    sheet.getRange(2, 1, allNewRows.length, 5).setValues(allNewRows);
  }

  return { success: true };
}

// ==== 掲示板（コメント・返信・いいね） ====

function getComments(raceId) {
  if (!raceId) return [];
  const sheet = getSheet(SHEET_NAMES.COMMENTS);
  const rows = sheetToObjects(sheet).filter(r => r['RaceID'] === raceId);
  rows.sort((a, b) => new Date(a['投稿日時']) - new Date(b['投稿日時']));
  return rows;
}

function submitComment(params) {
  if (!params.raceId) throw new Error('レースが指定されていません');
  if (!params.name) throw new Error('お名前を入力してください');
  if (!params.content || !params.content.trim()) throw new Error('コメントを入力してください');

  const sheet = getSheet(SHEET_NAMES.COMMENTS);
  const commentId = Utilities.getUuid();
  const now = new Date();

  sheet.appendRow([
    commentId,
    params.raceId,
    params.parentCommentId || '', // 空なら親コメント、値があれば返信
    now,
    params.name,
    params.content.trim(),
    0
  ]);

  return { commentId };
}

function likeComment(params) {
  if (!params.commentId) throw new Error('コメントが指定されていません');
  const sheet = getSheet(SHEET_NAMES.COMMENTS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === params.commentId) {
      const current = Number(values[i][6]) || 0;
      sheet.getRange(i + 1, 7).setValue(current + 1);
      return { likes: current + 1 };
    }
  }
  throw new Error('コメントが見つかりません');
}

// ==== 管理者機能 ====

function adminCreateRace(params) {
  const sheet = getSheet(SHEET_NAMES.RACE);
  const existing = sheetToObjects(sheet);
  const activeCount = existing.filter(r => r['状態'] === '受付中' || r['状態'] === '締切').length;
  if (activeCount >= 2) {
    throw new Error('同時に受付中／締切にできるレースは2つまでです。先に既存レースを「結果確定」にしてください。');
  }

  const raceId = Utilities.getUuid();
  sheet.appendRow([
    raceId,
    params.raceName,
    params.raceDate,
    params.track,
    params.postTime,
    params.deadline,
    '受付中'
  ]);
  return { raceId };
}

function adminUpdateRaceStatus(params) {
  updateRaceStatus(params.raceId, params.status);
  return { success: true };
}

function adminUpdateDeadline(params) {
  if (!params.raceId) throw new Error('レースが指定されていません');
  if (!params.deadline) throw new Error('締切時刻を入力してください');

  const sheet = getSheet(SHEET_NAMES.RACE);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === params.raceId) {
      sheet.getRange(i + 1, 6).setValue(params.deadline); // 締切時刻列 = 6列目
      return { success: true };
    }
  }
  throw new Error('レースが見つかりません');
}

function updateRaceStatus(raceId, status) {
  const sheet = getSheet(SHEET_NAMES.RACE);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === raceId) {
      sheet.getRange(i + 1, 7).setValue(status);
      break;
    }
  }
}

function adminGetRaces() {
  const sheet = getSheet(SHEET_NAMES.RACE);
  return sheetToObjects(sheet).sort((a, b) => new Date(b['開催日']) - new Date(a['開催日']));
}
