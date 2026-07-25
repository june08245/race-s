const { useState, useRef, useEffect, useCallback } = React;

// ------------------------------------------------------------------
// 関屋記念 想定隊列データ（新潟芝1600m外・左回り）
// ------------------------------------------------------------------
// 総合評価は「関屋記念(G3) 追い切り」実データ（S>A>B>C>D）
const HORSES = [
  { no: 14, name: "メタルスピード",   waku: 8, style: "逃げ", color: "#e8558d", text: "#fff", grade: "A", memo: "反応良く終いも楽に伸びる" },
  { no: 3,  name: "アンパドゥ",       waku: 3, style: "先行", color: "#d9432b", text: "#fff", grade: "A", memo: "軽快なフットワークで反応も良く" },
  { no: 4,  name: "マテンロウスカイ", waku: 3, style: "先行", color: "#2f7a3c", text: "#fff", grade: "A", memo: "やや動きにバラつきあるが最後まで力あり" },
  { no: 9,  name: "サンダーストラック", waku: 6, style: "先行", color: "#2f7a3c", text: "#fff", grade: "S", memo: "しっかり折り合い反応良く終い伸びる" },
  { no: 1,  name: "ファーヴェント",   waku: 1, style: "好位", color: "#f4f4f2", text: "#222", grade: "A", memo: "前走より安定感増し軽快" },
  { no: 6,  name: "シリウスコルト",   waku: 4, style: "好位", color: "#1c3f8f", text: "#fff", grade: "S", memo: "前走より落ち着きあり力強い脚捌きで終いの伸び抜群" },
  { no: 7,  name: "エルトンバローズ", waku: 5, style: "好位", color: "#e8b800", text: "#222", grade: "A", memo: "回転量あり余裕のある走り" },
  { no: 10, name: "クランフォード",   waku: 6, style: "好位", color: "#2f7a3c", text: "#fff", grade: "B", memo: "やや頭高いが終いの伸びあり" },
  { no: 12, name: "ランスオブカオス", waku: 7, style: "好位", color: "#e8830f", text: "#fff", grade: "A", memo: "折り合いスムーズになり終いも楽に伸びる" },
  { no: 2,  name: "ジュタ",           waku: 2, style: "中団", color: "#161616", text: "#fff", grade: "C", memo: "追った割に伸びず" },
  { no: 5,  name: "レディマリオン",   waku: 4, style: "中団", color: "#1c3f8f", text: "#fff", grade: "-", memo: "調教映像なし、坂路終い1F 11.9秒と好調" },
  { no: 8,  name: "ダノンセンチュリー", waku: 5, style: "中団", color: "#e8b800", text: "#222", grade: "A", memo: "前走より落ち着き出てスピード感のある走り" },
  { no: 11, name: "ドロップオブライト", waku: 7, style: "後方", color: "#f4f4f2", text: "#222", grade: "A", memo: "前走より回転力増した走り" },
  { no: 13, name: "ブエナオンダ",     waku: 8, style: "後方", color: "#e8558d", text: "#fff", grade: "A", memo: "回転量やや余裕のある走り" },
];

// 総合評価 → 地力補正（S>A>B>C>D）。"-"は評価データなしとして平均扱い。
const GRADE_BONUS = { S: 0.16, A: 0.06, B: -0.02, C: -0.10, D: -0.18, "-": 0.0 };
const GRADE_COLOR = { S: "#e0463d", A: "#3a7dd9", B: "#3a9d5f", C: "#8a8a8a", D: "#8a8a8a", "-": "#8a8a8a" };

// 雨天時の道悪評価材料（実データ整理・断定なし。着順シミュレーションの数値には反映せず、参考カードとしてのみ表示）
const RAIN_NOTES = {
  10: { title: "クランフォード", points: ["父系のパワー・持続力", "前走55.0kg→今回54.0kg"], caution: "本人の道悪実績は不足。1600mへの延長も確認点" },
  7:  { title: "エルトンバローズ", points: ["しらさぎS稍重1着", "58.0kg・1分33秒2", "母父デインヒルズタイムのパワー"], caution: "今回59.0kgで外を回す形にならないか" },
  8:  { title: "ダノンセンチュリー", points: ["父系の持続力", "母父Lope de Vegaの欧州型パワー"], caution: "本人の道悪実績は不足。高速上がりが削がれないか" },
  13: { title: "ブエナオンダ", points: ["稍重重賞2戦と勝ち馬から0秒3差", "父リオンディーズのパワー"], caution: "後方からでは前残りが課題。重馬場以上の資料は不足" },
  1:  { title: "ファーヴェント", points: ["ダービー卿CT稍重3着", "勝ち馬と同時計", "ながヤークライの持続力"], caution: "実績はあるが評価は慎重に" },
  3:  { title: "アンパドゥ", points: ["Iffraaj×Dubawiの欧州型持続力", "近走58.0kg→今回56.0kg"], caution: "本人の道悪実績は不足。血統・斤量から対応余地" },
};

// 脚質ごとの基礎ポジション（0=先頭 1=最後方）とスパート挙動
const STYLE_BASE = { "逃げ": 0.02, "先行": 0.18, "好位": 0.40, "中団": 0.62, "後方": 0.85 };
const STYLE_KICK = { "逃げ": 0.10, "先行": 0.28, "好位": 0.55, "中団": 0.80, "後方": 1.05 }; // 終盤の伸び幅係数
const STYLE_FADE = { "逃げ": 0.35, "先行": 0.18, "好位": 0.08, "中団": 0.02, "後方": 0.0 }; // 終盤の失速リスク

// 実データ：関屋記念 過去10回(2016-2025)の脚質別3着内率（複勝率）
// 「好位」は逃げ・先行と差しの中間として先行寄りに、「中団」は差し、「後方」は追込に対応させる
const STYLE_FUKUSHO = { "逃げ": 0.500, "先行": 0.237, "好位": 0.20, "中団": 0.135, "後方": 0.130 };
// 複勝率を基準（先行=1.0）にした隊列バイアス倍率。逃げ・先行が濃く優遇される。
const AVG_FUKUSHO = STYLE_FUKUSHO["先行"];
const STYLE_BIAS = Object.fromEntries(
  Object.entries(STYLE_FUKUSHO).map(([k, v]) => [k, v / AVG_FUKUSHO])
);

// 実データ：2016年以降の連対馬21頭中15頭(71%)が6〜8枠。1〜5枠は残り29%。
// 8枠中3枠(6,7,8)に71%が偏る一方、8頭立て換算の均等配分なら各枠は12.5%が目安。
// 71%/3枠=23.7%(枠あたり) と 29%/5枠=5.8%(枠あたり) の比から、控えめな倍率として反映。
const WAKU_BIAS = { 1: 0.72, 2: 0.78, 3: 0.85, 4: 0.92, 5: 1.00, 6: 1.22, 7: 1.30, 8: 1.22 };

// JRA標準の枠番カラー
const WAKU_COLOR = {
  1: { bg: "#f4f4f2", fg: "#222" }, 2: { bg: "#161616", fg: "#fff" },
  3: { bg: "#d9432b", fg: "#fff" }, 4: { bg: "#1c3f8f", fg: "#fff" },
  5: { bg: "#e8b800", fg: "#222" }, 6: { bg: "#2f7a3c", fg: "#fff" },
  7: { bg: "#e8830f", fg: "#fff" }, 8: { bg: "#e8558d", fg: "#fff" },
};

// シード付き擬似乱数（再現性ある「くじ」）
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------
// 新潟芝1600m外・左回りの走路パス（トラック形状の簡易楕円＋長い直線）
// SVG座標系: viewBox 0 0 1000 460
// ------------------------------------------------------------------
const TRACK_PATH_OUTER = "M 1080,120 L 420,120 A 290,260 0 0 0 420,640 L 840,640 A 270,240 0 0 0 1080,390";
// 発走地点はパス上で「M開始点(ゴール側直線)→バックストレッチ→3角カーブ→発走直線の終点(840,640)」に相当する位置。
// 実測（getTotalLength/getPointAtLength）に基づき、発走地点はパス全長の約0.83の位置。
const START_T = 0.83;

// カメラワーク：直線区間(0.70〜0.96)にズームイン。前後でイーズイン・イーズアウトして滑らかに。
const FULL_VB = { x: 0, y: 0, w: 1400, h: 700 };
const ZOOM_VB = { x: 780, y: 40, w: 560, h: 340 }; // 直線（x:420-1080, y:70-170付近）を含む拡大範囲
function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
function computeViewBox(t) {
  const zoomStart = 0.70, zoomFull = 0.76, zoomOutStart = 0.92, zoomOutEnd = 0.98;
  let f = 0; // 0=フル画面, 1=ズーム
  if (t < zoomStart) f = 0;
  else if (t < zoomFull) f = easeInOut((t - zoomStart) / (zoomFull - zoomStart));
  else if (t < zoomOutStart) f = 1;
  else if (t < zoomOutEnd) f = 1 - easeInOut((t - zoomOutStart) / (zoomOutEnd - zoomOutStart));
  else f = 0;
  const x = FULL_VB.x + (ZOOM_VB.x - FULL_VB.x) * f;
  const y = FULL_VB.y + (ZOOM_VB.y - FULL_VB.y) * f;
  const w = FULL_VB.w + (ZOOM_VB.w - FULL_VB.w) * f;
  const h = FULL_VB.h + (ZOOM_VB.h - FULL_VB.h) * f;
  return `${x} ${y} ${w} ${h}`;
}
// スタート地点は3コーナー奥（バックストレッチ側）、ゴールは手前直線
// パスに沿った点を得るため、path要素をDOM経由でサンプリングする

function useTrackGeometry() {
  const pathRef = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const getPoint = useCallback((t) => {
    const el = pathRef.current;
    if (!el) return { x: 0, y: 0, angle: 0 };
    const len = el.getTotalLength();
    const p1 = el.getPointAtLength(((t % 1 + 1) % 1) * len);
    const p2 = el.getPointAtLength((((t + 0.001) % 1 + 1) % 1) * len);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    return { x: p1.x, y: p1.y, angle };
  }, []);
  return { pathRef, ready, getPoint };
}

const PHASES = [
  { key: "start", label: "スタート", from: 0.0, to: 0.12 },
  { key: "back", label: "3角まで（長い直線）", from: 0.12, to: 0.55 },
  { key: "corner", label: "コーナー", from: 0.55, to: 0.72 },
  { key: "straight", label: "直線（658.7m）", from: 0.72, to: 0.94 },
  { key: "goal", label: "ゴール", from: 0.94, to: 1.0 },
];

function buildRace(seed) {
  const rng = mulberry32(seed);
  // 各馬の「地力」係数と展開適性ロールをランダムに割り振る
  const runners = HORSES.map((h) => {
    const gradeBonus = GRADE_BONUS[h.grade] ?? 0;
    const styleBias = STYLE_BIAS[h.style] ?? 1;
    const wakuBias = WAKU_BIAS[h.waku] ?? 1;
    const talent = 0.85 + rng() * 0.3 + gradeBonus; // 追い切り総合評価を地力に反映
    const luck = (rng() - 0.5) * 0.12;
    // 過去10年データ：前（逃げ・先行）が3着内率で大きく優勢、差し・追込は届きにくい
    // ＋枠順データ：6〜8枠が連対馬の71%を占める傾向を軽く反映
    const combinedBias = styleBias * (0.5 + wakuBias * 0.5); // 枠バイアスは半分の重みで併用
    const kickRoll = Math.min(1, Math.max(0, (rng() * 0.7 + gradeBonus * 1.5 + 0.15) * combinedBias));
    return { ...h, talent, luck, kickRoll, bias: combinedBias, base: STYLE_BASE[h.style], kick: STYLE_KICK[h.style], fade: STYLE_FADE[h.style] };
  });
  return runners;
}

// 進行度 t(0-1 のレース経過) における各馬の「トラック上の並び位置」(0=先頭)を計算
function computeOrderPosition(runner, t) {
  const { base, kick, fade, talent, luck, kickRoll, bias } = runner;
  // 前有利バイアス：後方脚質(bias<1)は終盤に詰め切れず終わるリスクを上乗せ
  const biasedFade = fade + Math.max(0, (1 - (bias ?? 1)) * 0.25);
  let pos = base;
  if (t < 0.55) {
    // 序盤〜3角: ほぼ脚質どおりの隊列、わずかな揺らぎ
    pos = base + Math.sin(t * 12 + luck * 10) * 0.02;
  } else if (t < 0.94) {
    // コーナー〜直線: 追い込み・失速が発生
    const progress = (t - 0.55) / (0.94 - 0.55); // 0-1
    const kickPower = (kickRoll * 0.6 + talent * 0.4) * kick;
    const gain = kickPower * progress * 1.4;
    const fadeLoss = biasedFade * progress * 0.9 * (1 - kickRoll * 0.5);
    pos = base - gain + fadeLoss;
  } else {
    const progress = (t - 0.94) / 0.06;
    const kickPower = (kickRoll * 0.6 + talent * 0.4) * kick;
    const fadeLoss = biasedFade * 0.9 * (1 - kickRoll * 0.5);
    const finalPos = base - kickPower * 1.4 + fadeLoss;
    pos = finalPos + (rng_stub());
  }
  return pos;
}
function rng_stub() { return 0; }

function normalizePositions(list) {
  const sorted = [...list].sort((a, b) => a.pos - b.pos);
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ------------------------------------------------------------------
function RaceSim() {
  const [seed, setSeed] = useState(1);
  const [weather, setWeather] = useState("sunny"); // "sunny" | "rain"
  const [runners, setRunners] = useState(() => buildRace(1));
  const [t, setT] = useState(0); // 0..1 レース進行
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastTsRef = useRef(null);
  const raceTRef = useRef(0);
  const DURATION_MS = 16000;
  const { pathRef, ready, getPoint } = useTrackGeometry();
  const [order, setOrder] = useState([]);
  const [commentary, setCommentary] = useState("枠順確定。発走を待つ。");
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [isReplay, setIsReplay] = useState(false);
  const lastPhaseRef = useRef(-1);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceSupported(false);
    }
  }, []);

  const speak = useCallback((text) => {
    if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel(); // 前の発話が残っていたら止めて新しい実況を優先
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = "ja-JP";
      utter.rate = 1.15;
      utter.pitch = 1.05;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // 音声合成が使えない環境ではテキストのみで継続
    }
  }, [voiceOn]);

  const announce = useCallback((text) => {
    setCommentary(text);
    speak(text);
  }, [speak]);

  useEffect(() => {
    const positions = runners.map((r) => ({ ...r, pos: computeOrderPosition(r, 0) }));
    setOrder(normalizePositions(positions));
  }, [runners]);

  const step = useCallback((ts) => {
    if (startTimeRef.current === null) {
      // 最初のフレームはタイムスタンプの基準合わせのみ行い、位置計算は次フレームから始める
      // （初回フレームのタイミングのブレによる「途中位置から始まる」ジャンプを防ぐ）
      startTimeRef.current = ts;
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(step);
      return;
    }
    const dt = ts - lastTsRef.current;
    lastTsRef.current = ts;

    // 直線区間(0.72〜0.94)はスローモーションで進行速度を落とし、迫力を出す
    const curT = raceTRef.current;
    const inStraight = curT >= 0.72 && curT < 0.94;
    const speedFactor = inStraight ? 0.4 : 1;
    const nt = Math.min(1, curT + (dt / DURATION_MS) * speedFactor);
    raceTRef.current = nt;
    setT(nt);

    const positions = runners.map((r) => ({ ...r, pos: computeOrderPosition(r, nt) }));
    const ord = normalizePositions(positions);
    setOrder(ord);

    const phaseIdx = PHASES.findIndex((p) => nt >= p.from && nt < p.to);
    if (phaseIdx !== -1 && phaseIdx !== lastPhaseRef.current) {
      lastPhaseRef.current = phaseIdx;
      const leader = ord[0];
      const phase = PHASES[phaseIdx];
      if (phase.key === "start") announce(weather === "rain" ? `発走！雨の馬場、${leader.no}番先頭。` : `発走！${leader.no}番が先頭。`);
      if (phase.key === "back") announce(`${leader.no}番先頭、落ち着いた流れ。`);
      if (phase.key === "corner") announce(`コーナー、後方勢が仕掛ける！`);
      if (phase.key === "straight") announce(`直線！先頭${leader.no}番、猛追！`);
    }

    if (nt >= 1) {
      setRunning(false);
      setFinished(true);
      announce(`ゴール！1着${ord[0].no}番、2着${ord[1].no}番、3着${ord[2].no}番。`);
      return;
    }
    rafRef.current = requestAnimationFrame(step);
  }, [runners, weather, announce]);

  const start = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setFinished(false);
    setT(0);
    startTimeRef.current = null;
    lastTsRef.current = null;
    raceTRef.current = 0;
    lastPhaseRef.current = -1;
    setCommentary("");
    // スタート位置(t=0)での隊列に即座にリセットしてから発走する
    const positions = runners.map((r) => ({ ...r, pos: computeOrderPosition(r, 0) }));
    setOrder(normalizePositions(positions));
    setRunning(true);
    // ユーザー操作（クリック）の直後に音声合成を一度呼んでおくと、以後のブラウザ自動発話制限を回避しやすい
    if (voiceOn && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const warm = new window.SpeechSynthesisUtterance("発走！");
        warm.lang = "ja-JP";
        warm.rate = 1.15;
        window.speechSynthesis.speak(warm);
      } catch (e) {}
    }
    rafRef.current = requestAnimationFrame(step);
  };

  const playReplay = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    const REPLAY_START = 0.66;
    const REPLAY_MS = 7000; // リプレイ全体の実時間（スロー再生）
    setIsReplay(true);
    raceTRef.current = REPLAY_START;
    setT(REPLAY_START);
    const positions = runners.map((r) => ({ ...r, pos: computeOrderPosition(r, REPLAY_START) }));
    setOrder(normalizePositions(positions));
    let replayStartTs = null;
    const replayStep = (ts) => {
      if (replayStartTs === null) replayStartTs = ts;
      const elapsed = ts - replayStartTs;
      const progress = Math.min(1, elapsed / REPLAY_MS);
      const nt = REPLAY_START + (1 - REPLAY_START) * progress;
      raceTRef.current = nt;
      setT(nt);
      const positions2 = runners.map((r) => ({ ...r, pos: computeOrderPosition(r, nt) }));
      setOrder(normalizePositions(positions2));
      if (progress >= 1) {
        setIsReplay(false);
        setCommentary(`リプレイ終了。1着${order[0]?.no ?? ""}番。`);
        return;
      }
      rafRef.current = requestAnimationFrame(replayStep);
    };
    setCommentary("🔁 直線リプレイ");
    rafRef.current = requestAnimationFrame(replayStep);
  }, [runners, order]);

  const reset = (newSeed) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setRunning(false);
    setFinished(false);
    setT(0);
    startTimeRef.current = null;
    lastTsRef.current = null;
    raceTRef.current = 0;
    lastPhaseRef.current = -1;
    const s = newSeed ?? Math.floor(Math.random() * 100000);
    setSeed(s);
    setRunners(buildRace(s));
    setCommentary("枠順確定。発走を待つ。");
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  // トラック上のスロット幅（並走のレーンオフセット）
  const laneOffset = (rank) => (rank - 7.5) * 5.6;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% -10%, #163d2c 0%, #0b2419 55%, #071711 100%)",
      color: "#f4f1e8",
      fontFamily: "'Hiragino Sans', 'Noto Sans JP', system-ui, sans-serif",
      padding: "20px 12px 60px",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes gateFlash { 0%{ filter: brightness(1);} 50%{ filter: brightness(1.8);} 100%{filter:brightness(1);} }
        .horse-dot { transition: none; }
        .commentary-box { transition: opacity .25s ease; }
        ::-webkit-scrollbar { height: 8px; width:8px; }
        ::-webkit-scrollbar-thumb { background:#3a5a45; border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* ヘッダー */}
        <header style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#c9a34e", marginBottom: 6 }}>SEKIYA KINEN SIMULATION</div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 42px)", margin: 0, fontWeight: 900,
            letterSpacing: 1, color: "#f4f1e8", textShadow: "0 2px 12px rgba(0,0,0,.4)",
          }}>関屋記念 レースシミュレーション</h1>
          <div style={{ fontSize: 12.5, color: "#c9c2a4", marginTop: 8 }}>
            新潟7R｜芝1600m外回り｜3歳以上オープン・ハンデG3｜発走 15:45
          </div>
          <div style={{ fontSize: 13, color: "#a9c2ab", marginTop: 6 }}>
            直線658.7m／高低差2.2m／1周2,223m（Aコース外回り）
          </div>
          <div style={{ fontSize: 11, color: "#6f8a76", marginTop: 4 }}>
            展開バイアス：脚質別3着内率・枠順傾向(6〜8枠優勢)を反映｜地力補正：追い切り総合評価｜天候は演出・参考情報のみ（着順計算には影響しません）
          </div>
        </header>

        {/* コントロール */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <button onClick={start} disabled={running || isReplay} style={btnStyle(running || isReplay ? "#3a4a3f" : "#c9a34e", running || isReplay ? "#8aa090" : "#1a1206")}>
            {finished ? "もう一度走らせる" : running ? "レース中…" : "発走"}
          </button>
          <button onClick={() => reset()} disabled={isReplay} style={btnStyle("#2a4536", "#f4f1e8")}>枠順そのまま再抽選</button>
          {finished && !isReplay && (
            <button onClick={playReplay} style={btnStyle("#3a6ea8", "#fff")}>🔁 直線リプレイ</button>
          )}
        </div>
        {isReplay && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#7fb0e0", marginBottom: 10, fontWeight: 700 }}>
            🔁 スローリプレイ再生中…
          </div>
        )}

        {/* 天候トグル・音声実況トグル */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18, flexWrap: "wrap" }}>
          <button
            onClick={() => setWeather("sunny")}
            style={{
              ...weatherBtnStyle(weather === "sunny"),
            }}
          >☀️ 晴れ・良馬場</button>
          <button
            onClick={() => setWeather("rain")}
            style={{
              ...weatherBtnStyle(weather === "rain"),
            }}
          >🌧️ 雨・道悪</button>
          {voiceSupported && (
            <button
              onClick={() => {
                if (voiceOn && typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                setVoiceOn((v) => !v);
              }}
              style={{
                ...weatherBtnStyle(voiceOn),
              }}
            >{voiceOn ? "🔊 音声実況ON" : "🔇 音声実況OFF"}</button>
          )}
        </div>

        {/* トラック */}
        <div style={{
          background: weather === "rain"
            ? "linear-gradient(180deg, #12241c 0%, #0b1a13 100%)"
            : "linear-gradient(180deg, #1c4a34 0%, #163e2b 100%)",
          borderRadius: 20, padding: "18px 10px 10px", boxShadow: "0 20px 50px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.06)",
          position: "relative", overflow: "hidden",
        }}>
          <svg viewBox={computeViewBox(t)} style={{ width: "100%", height: "auto", display: "block", transition: "none" }}>
            <defs>
              <pattern id="turf" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
                <rect width="26" height="26" fill="#1f5237" />
                <rect width="13" height="26" fill="#235c3d" />
              </pattern>
              <radialGradient id="turfShade" cx="50%" cy="40%" r="75%">
                <stop offset="0%" stopColor="#2a6b46" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0d2317" stopOpacity="0.55" />
              </radialGradient>
              <linearGradient id="trackSurface" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={weather === "rain" ? "#8a7550" : "#d6c6a1"} />
                <stop offset="100%" stopColor={weather === "rain" ? "#6b5a3c" : "#bfa97e"} />
              </linearGradient>
              <pattern id="rainDrops" width="40" height="80" patternUnits="userSpaceOnUse">
                <line x1="5" y1="0" x2="0" y2="24" stroke="#cfe0e6" strokeWidth="1.4" opacity="0.35" />
                <line x1="25" y1="10" x2="20" y2="34" stroke="#cfe0e6" strokeWidth="1.2" opacity="0.28" />
                <line x1="15" y1="40" x2="10" y2="64" stroke="#cfe0e6" strokeWidth="1.3" opacity="0.3" />
                <line x1="35" y1="50" x2="30" y2="74" stroke="#cfe0e6" strokeWidth="1.1" opacity="0.25" />
              </pattern>
            </defs>

            {/* 背景の芝 */}
            <rect x="0" y="0" width="1400" height="700" fill="url(#turf)" opacity={weather === "rain" ? 0.55 : 1} />
            <rect x="0" y="0" width="1400" height="700" fill="url(#turfShade)" />
            {weather === "rain" && (
              <>
                <rect x="0" y="0" width="1400" height="700" fill="#0a1610" opacity="0.35" />
                <rect x="0" y="0" width="1400" height="700" fill="url(#rainDrops)" opacity="0.9" />
              </>
            )}

            {/* 観客席シルエット（上部） */}
            <rect x="0" y="0" width="1400" height="46" fill="#0a1c13" opacity="0.55" />
            {Array.from({ length: 28 }).map((_, i) => (
              <rect key={i} x={i * 50} y={4} width="34" height="30" rx="3" fill="#132a1d" opacity="0.5" />
            ))}

            {/* コース外周フェンス（芝の外側） */}
            <path d={TRACK_PATH_OUTER} fill="none" stroke="#0d2317" strokeWidth="118" strokeLinecap="round" opacity="0.4" />

            {/* 馬場（走路本体） */}
            <path
              ref={pathRef}
              d={TRACK_PATH_OUTER}
              fill="none"
              stroke="url(#trackSurface)"
              strokeWidth="100"
              strokeLinecap="round"
            />
            {/* 馬場の芝目テクスチャの陰影帯 */}
            <path d={TRACK_PATH_OUTER} fill="none" stroke="#8a7550" strokeWidth="100" strokeLinecap="round" opacity="0.08" />

            {/* 内ラチ（白柵）と外ラチ */}
            <path d={TRACK_PATH_OUTER} fill="none" stroke="#ffffff" strokeWidth="2.4" opacity="0.85"
              transform="translate(0,0)" strokeDasharray="none"
              pathLength="1" />
            <path d={TRACK_PATH_OUTER} fill="none" stroke="#f4f1e8" strokeWidth="1.2" strokeDasharray="1 14" opacity="0.6" />

            {/* インフィールド（芝生の内側） */}
            <path d="M 420,120 A 290,260 0 0 0 420,640 L 840,640 A 270,240 0 0 0 1080,390 L 1080,120 Z"
              fill="#173a27" opacity="0.55" />
            <text x="750" y="400" fill="#2f6a46" fontSize="20" fontWeight="700" opacity="0.5" textAnchor="middle">NIIGATA</text>

            {/* ハロン棒（残り距離目安） */}
            {[
              { x: 1130, y: 250, label: "3F" },
              { x: 1050, y: 145, label: "2F" },
              { x: 950, y: 128, label: "1F" },
            ].map((h) => (
              <g key={h.label}>
                <line x1={h.x} y1={h.y - 14} x2={h.x} y2={h.y + 14} stroke="#f4f1e8" strokeWidth="2" opacity="0.5" />
                <text x={h.x} y={h.y - 20} fill="#c9c2a4" fontSize="12" textAnchor="middle" opacity="0.7">{h.label}</text>
              </g>
            ))}

            {/* ゴール標識（直線側の終点付近） */}
            <line x1="1035" y1="90" x2="1035" y2="155" stroke="#e23b3b" strokeWidth="5" />
            <text x="1035" y="76" fill="#e23b3b" fontSize="22" fontWeight="900" textAnchor="middle">ゴール</text>
            <rect x="1005" y="86" width="60" height="8" fill="#111" opacity="0.3" />

            {/* スタート標識 */}
            <line x1="840" y1="618" x2="840" y2="668" stroke="#f4f1e8" strokeWidth="3.5" opacity="0.9" />
            <text x="840" y="606" fill="#f4f1e8" fontSize="17" fontWeight="700" textAnchor="middle" opacity="0.9">発走</text>

            {/* 直線の長さ表記 */}
            <text x="740" y="112" fill="#e8c766" fontSize="13" fontWeight="700" textAnchor="middle" opacity="0.85">
              直線 658.7m
            </text>

            {/* 馬 */}
            {ready && order.map((r, idx) => {
              // レース進行 t を走路上の位置(0..1)へ写像。スタート地点(START_T)からゴール方向(0)へ進む。
              // 隊列内の相対位置(pos)を沿線方向のズレとして反映。道中はコンパクトに、直線では差が大きく開くようにする。
              const spreadMultiplier = t < 0.55 ? 0.06 : t < 0.72 ? 0.11 : t < 0.94 ? 0.24 : 0.19;
              const rawSpread = (r.pos ?? 0) * spreadMultiplier;
              const baseT = START_T - t * START_T;
              // spreadが大きすぎるとtrackTが0を割り込んで1周し、コーナー付近に誤って戻ってしまうため
              // baseTの範囲内（0〜baseTの少し先まで）に収まるようクランプする
              const spreadMax = Math.max(0.02, baseT * 0.9);
              const spread = Math.max(-spreadMax, Math.min(0.12, rawSpread));
              const trackT = ((baseT + spread) % 1 + 1) % 1;
              const pt = getPoint(trackT);
              const off = laneOffset(r.rank);
              const rad = (pt.angle + 90) * (Math.PI / 180);
              // 道中は集団を少しコンパクトに寄せる（レーン幅を局面によって縮小）
              const laneShrink = t < 0.55 ? 0.75 : 1;
              const x2 = pt.x + Math.cos(rad) * off * laneShrink;
              const y2 = pt.y + Math.sin(rad) * off * laneShrink;
              const isLeader = idx === 0 && (running || isReplay);
              // ストライド（走行）アニメーション用の周期値。tと馬固有の位相でズレを出す
              const strideCycle = (t * 900 + (r.luck ?? 0) * 40) % 8;
              const strideBob = Math.sin(strideCycle) * 1.6; // 上下の弾み
              const legPhase = strideCycle % (Math.PI * 2);
              return (
                <g key={r.no} transform={`translate(${x2},${y2}) rotate(${pt.angle})`}>
                  {/* 先頭馬の光の輪 */}
                  {isLeader && (
                    <ellipse rx="22" ry="15" fill="none" stroke="#e8c766" strokeWidth="1.5" opacity="0.5">
                      <animate attributeName="opacity" values="0.6;0.15;0.6" dur="0.9s" repeatCount="indefinite" />
                    </ellipse>
                  )}
                  {/* 砂煙（走行中のみ、後方に） */}
                  {(running || isReplay) && (
                    <>
                      <ellipse cx="-16" cy="7" rx="4.5" ry="2.2" fill="#cbb98a" opacity="0.35" />
                      <ellipse cx="-21" cy="8" rx="3" ry="1.6" fill="#cbb98a" opacity="0.22" />
                    </>
                  )}
                  {/* 影 */}
                  <ellipse cx="0" cy="11" rx="10" ry="2.6" fill="#000" opacity="0.28" transform={`rotate(${-pt.angle})`} />
                  {/* 後脚（後方2本） */}
                  <g stroke="#2a1a10" strokeWidth="2" strokeLinecap="round" opacity="0.9">
                    <line x1="-9" y1="3" x2={-9 + Math.sin(legPhase) * 4.5} y2="12" />
                    <line x1="-6" y1="3" x2={-6 + Math.sin(legPhase + 0.6) * 4} y2="12" />
                  </g>
                  {/* 尻尾 */}
                  <path
                    d={`M -12,-1 Q ${-18 + Math.sin(legPhase * 0.6) * 2},2 -16,9`}
                    fill="none" stroke="#1a1008" strokeWidth="2.2" strokeLinecap="round" opacity="0.85"
                  />
                  {/* 胴体（細長く） */}
                  <ellipse cy={strideBob} rx="12" ry="6" fill={r.color} stroke="#111" strokeWidth="1.5" />
                  {/* 前脚（前方2本） */}
                  <g stroke="#2a1a10" strokeWidth="2" strokeLinecap="round" opacity="0.9">
                    <line x1="6" y1="4" x2={6 + Math.sin(legPhase + Math.PI) * 4.5} y2="13" />
                    <line x1="9" y1="4" x2={9 + Math.sin(legPhase + Math.PI + 0.6) * 4} y2="13" />
                  </g>
                  {/* 首（斜め上へ） */}
                  <path
                    d={`M 8,${strideBob - 2} Q 14,${strideBob - 9} 18,${strideBob - 11}`}
                    fill="none" stroke={r.color} strokeWidth="6.5" strokeLinecap="round"
                  />
                  {/* 頭（鼻先は暗色でメリハリ） */}
                  <ellipse cx="19.5" cy={strideBob - 12} rx="4.2" ry="3" fill={r.color} stroke="#111" strokeWidth="1.2" />
                  <ellipse cx="23" cy={strideBob - 11.5} rx="2.2" ry="1.7" fill="#2a1a10" opacity="0.75" />
                  {/* たてがみ */}
                  <path
                    d={`M 9,${strideBob - 3} Q 13,${strideBob - 10} 18,${strideBob - 13}`}
                    fill="none" stroke="#1a1008" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"
                  />
                  {/* 勝負服の帯（枠色・鞍） */}
                  <rect x="-5" y={strideBob - 4} width="9" height="7.5" rx="1.5" fill={WAKU_COLOR[r.waku]?.bg} opacity="0.9"
                    stroke="#111" strokeWidth="0.5" />
                  <text
                    transform={`rotate(${-pt.angle})`}
                    x="-0.5" y={strideBob + 3} textAnchor="middle" fontSize="9.5" fontWeight="800"
                    fill={r.text}
                  >{r.no}</text>
                </g>
              );
            })}
          </svg>

          {weather === "sunny" && (
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse at 70% 15%, rgba(255,238,180,0.10), transparent 55%)",
            }} />
          )}
          {isReplay && (
            <div style={{
              position: "absolute", top: 12, right: 16, background: "rgba(58,110,168,0.85)",
              color: "#fff", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999,
              letterSpacing: 1, boxShadow: "0 4px 10px rgba(0,0,0,.3)",
            }}>● REPLAY</div>
          )}
          {/* フェーズインジケーター */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px 14px", fontSize: 10, color: "#a9c2ab" }}>
            {PHASES.map((p) => (
              <span key={p.key} style={{
                opacity: t >= p.from && t < p.to ? 1 : 0.45,
                fontWeight: t >= p.from && t < p.to ? 800 : 400,
                color: t >= p.from && t < p.to ? "#e8c766" : "#a9c2ab",
              }}>{p.label}</span>
            ))}
          </div>
        </div>

        {/* 実況 */}
        <div className="commentary-box" style={{
          marginTop: 16, background: "#0e2419", border: "1px solid #2a4536", borderRadius: 12,
          padding: "12px 16px", fontSize: 14, minHeight: 20, color: "#f4e9c9",
        }}>
          {commentary || "…"}
        </div>

        {/* 着順表 */}
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 15, color: "#c9a34e", letterSpacing: 2, marginBottom: 10 }}>
            {finished ? "確定着順" : "現在の隊列"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            {order.map((r, i) => (
              <div key={r.no} style={{
                display: "grid", gridTemplateColumns: "26px 26px 30px 1fr 28px 44px", alignItems: "center",
                gap: 6, background: i === 0 && finished ? "rgba(201,163,78,.18)" : "#0e2419",
                border: i === 0 && finished ? "1px solid #c9a34e" : "1px solid #1e3a2a",
                borderRadius: 8, padding: "7px 10px",
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#a9c2ab" }}>{i + 1}</div>
                <div style={{
                  width: 20, height: 20, borderRadius: 5, background: WAKU_COLOR[r.waku]?.bg, color: WAKU_COLOR[r.waku]?.fg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800,
                  border: "1px solid rgba(0,0,0,.35)",
                }}>{r.waku}</div>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: r.color, color: r.text,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800,
                  border: "1px solid rgba(0,0,0,.3)",
                }}>{r.no}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: GRADE_COLOR[r.grade], textAlign: "center",
                  border: `1px solid ${GRADE_COLOR[r.grade]}`, borderRadius: 5, padding: "1px 0",
                }}>{r.grade}</div>
                <div style={{ fontSize: 10.5, color: "#8aa090", textAlign: "right" }}>{r.style}</div>
              </div>
            ))}
          </div>
        </div>

        {/* シミュレーション結果に基づく買い目（機械的に生成。断定的な予想ではありません） */}
        {finished && (
          <div style={{ marginTop: 16, background: "#1a1608", border: "1px solid #c9a34e", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 13, color: "#e8c766", fontWeight: 700, marginBottom: 8 }}>
              🎯 今回のシミュレーション結果ベースの買い目例（3連複フォーメーション）
            </div>
            <div style={{ fontSize: 12.5, color: "#f4f1e8", lineHeight: 1.9 }}>
              軸：<b style={{ color: "#e8c766" }}>{order[0]?.no}</b> {order[0]?.name}（今回1着）<br />
              相手：{order.slice(1, 5).map((r) => `${r.no} ${r.name}`).join("／")}
            </div>
            <div style={{ fontSize: 10, color: "#8a7f5c", marginTop: 8, lineHeight: 1.6 }}>
              ※この買い目は今回1回分のシミュレーション結果（乱数）をそのまま並べたものです。実際の的中を保証するものではなく、
              再抽選するたびに結果は変わります。参考程度に、あくまで馬券購入は自己責任でお願いします。
            </div>
          </div>
        )}

        {/* 雨天時：道悪評価カード（参考情報。着順シミュレーションの数値には反映していません） */}
        {weather === "rain" && (
          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, color: "#7fb0e0", letterSpacing: 2, marginBottom: 4 }}>
              🌧️ 道悪での評価材料（参考）
            </h2>
            <div style={{ fontSize: 10.5, color: "#6f8a76", marginBottom: 10, lineHeight: 1.6 }}>
              血統・斤量・過去の稍重実績などの整理です。着順シミュレーションの数値には反映していません。掲載順は評価順ではありません。
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {HORSES.filter((h) => RAIN_NOTES[h.no]).map((h) => {
                const note = RAIN_NOTES[h.no];
                return (
                  <div key={h.no} style={{
                    background: "#0e1e2a", border: "1px solid #234158", borderRadius: 10, padding: "10px 12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, background: h.color, color: h.text,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800,
                      }}>{h.no}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f4f1e8" }}>{note.title}</div>
                    </div>
                    <ul style={{ margin: "0 0 6px", paddingLeft: 18, fontSize: 12, color: "#a9c2ab", lineHeight: 1.6 }}>
                      {note.points.map((p, idx) => <li key={idx}>{p}</li>)}
                    </ul>
                    <div style={{ fontSize: 11.5, color: "#e8c766" }}>確認点：{note.caution}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: "#6f8a76", marginTop: 10, lineHeight: 1.6 }}>
              出典：関屋記念2026 道悪評価材料の事前整理。血統は対応材料の一つで、枠順・雨量・実際の馬場状態で評価は変わります。
            </div>
          </div>
        )}

        {/* 追い切り総合評価 一覧 */}
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#c9a34e", fontWeight: 700, letterSpacing: 1 }}>
            追い切り総合評価・短評を見る
          </summary>
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {HORSES.map((h) => (
              <div key={h.no} style={{
                display: "grid", gridTemplateColumns: "22px 26px 100px 28px 1fr", alignItems: "center",
                gap: 6, fontSize: 12, padding: "5px 8px", background: "#0e2419", borderRadius: 6,
                border: "1px solid #1e3a2a",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, background: WAKU_COLOR[h.waku]?.bg, color: WAKU_COLOR[h.waku]?.fg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800,
                  border: "1px solid rgba(0,0,0,.35)",
                }}>{h.waku}</div>
                <div style={{
                  width: 22, height: 22, borderRadius: 5, background: h.color, color: h.text,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800,
                }}>{h.no}</div>
                <div style={{ color: "#f4f1e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</div>
                <div style={{
                  fontWeight: 800, color: GRADE_COLOR[h.grade], textAlign: "center",
                  border: `1px solid ${GRADE_COLOR[h.grade]}`, borderRadius: 4,
                }}>{h.grade}</div>
                <div style={{ color: "#8aa090", fontSize: 11 }}>{h.memo}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6f8a76", marginTop: 8 }}>
            出典：関屋記念(G3) 追い切り 短評表（時計・過程・動き・総合評価の5段階、S＞A＞B＞C＞D）
          </div>
        </details>

        {/* 脚質別成績データ */}
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#c9a34e", fontWeight: 700, letterSpacing: 1 }}>
            過去10年 脚質別成績データを見る
          </summary>
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {[
              { style: "逃げ", rate: "50.0%" },
              { style: "先行", rate: "23.7%" },
              { style: "差し", rate: "13.5%" },
              { style: "追込", rate: "13.0%" },
            ].map((row) => (
              <div key={row.style} style={{
                display: "grid", gridTemplateColumns: "60px 1fr", alignItems: "center",
                gap: 8, fontSize: 12.5, padding: "6px 10px", background: "#0e2419", borderRadius: 6,
                border: "1px solid #1e3a2a",
              }}>
                <div style={{ color: "#f4f1e8", fontWeight: 700 }}>{row.style}</div>
                <div style={{ color: "#e8c766", fontWeight: 700 }}>3着内率 {row.rate}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6f8a76", marginTop: 8, lineHeight: 1.6 }}>
            出典：関屋記念 過去10回(2016-2025)の脚質別成績。逃げ・先行の合計3着内率は差し・追込合計の約2.2倍。
            ただし2025年は差し・追込が上位を独占した例外あり（ハンデ戦への変更が影響した可能性）。
            本シミュレーションの「好位」「中団」「後方」区分は、それぞれ先行寄り／差し／追込に近い係数として割り当てた近似です。
          </div>
        </details>

        {/* 枠順バイアスデータ */}
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#c9a34e", fontWeight: 700, letterSpacing: 1 }}>
            枠順バイアスデータを見る
          </summary>
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
              <div key={w} style={{
                display: "grid", gridTemplateColumns: "40px 1fr", alignItems: "center",
                gap: 8, fontSize: 12.5, padding: "6px 10px", background: "#0e2419", borderRadius: 6,
                border: [6, 7, 8].includes(w) ? "1px solid #c9a34e" : "1px solid #1e3a2a",
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, background: WAKU_COLOR[w]?.bg, color: WAKU_COLOR[w]?.fg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
                }}>{w}</div>
                <div style={{ color: [6, 7, 8].includes(w) ? "#e8c766" : "#8aa090" }}>
                  {[6, 7, 8].includes(w) ? "連対馬の71%が集中する外枠ゾーン" : "内〜中枠"}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6f8a76", marginTop: 8, lineHeight: 1.6 }}>
            出典：関屋記念 2016年以降の連対馬21頭中15頭(71%)が6〜8枠。過去20年、7〜8枠は毎年どちらかが馬券圏内、7枠は勝率・連対率・複勝率トップ。
            本シミュレーションではこの傾向を控えめな倍率として終盤の伸びに反映しており、断定的な予想ではありません。
          </div>
        </details>

        {/* コース特性（客観情報・展開バイアスには不使用） */}
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#c9a34e", fontWeight: 700, letterSpacing: 1 }}>
            コース特性を見る
          </summary>
          <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12.5, color: "#c9c2a4", lineHeight: 1.7 }}>
            <div style={{ background: "#0e2419", border: "1px solid #1e3a2a", borderRadius: 8, padding: "10px 12px" }}>
              新潟競馬場・芝1600m外回り（Aコース）。直線658.7m、高低差2.2m、1周2,223mで日本の競馬場でも最大級のスケール。
              3角から4角にかけて緩い下りがあり、その区間で上がりのラップが速くなりやすいという地形上の特徴がある。
              ハンデ戦のため、各馬の斤量・騎手・枠順後の進路取りも展開に影響し得る。
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#6f8a76", marginTop: 8, lineHeight: 1.6 }}>
            ※これはコース形状に関する客観情報で、本シミュレーションの展開バイアス（脚質・枠順傾向）には直接反映していません。
            過去10年の実績データでは前（逃げ・先行）優勢が明確に出ているため、シミュレーションはそちらを優先しています。
            コース形状から「差しが有利」と論じる見方もありますが、実績と食い違うため断定はしていません。
          </div>
        </details>

        <div style={{ marginTop: 20, fontSize: 11, color: "#6f8a76", textAlign: "center", lineHeight: 1.7 }}>
          ※本シミュレーションは想定隊列・脚質・追い切り評価・過去の脚質別成績・枠順傾向に基づく乱数演算による展開シミュレーションであり、実際のレース結果を予想・保証するものではありません。馬券購入は自己責任でお願いします。
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    background: bg, color, border: "none", borderRadius: 999, padding: "11px 26px",
    fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: 1,
    boxShadow: "0 6px 16px rgba(0,0,0,.3)",
  };
}

function weatherBtnStyle(active) {
  return {
    background: active ? "#3a6ea8" : "#16281f",
    color: active ? "#fff" : "#8aa090",
    border: active ? "1px solid #5a8fc9" : "1px solid #24402f",
    borderRadius: 999, padding: "7px 16px", fontSize: 12.5, fontWeight: 700,
    cursor: "pointer", letterSpacing: 0.5,
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(<RaceSim />);
