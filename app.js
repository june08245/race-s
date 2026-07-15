// ==========================================================
// Race Share - App Logic (Ver.3 AI予想＋サイトパスワード対応版)
// ==========================================================

const state = {
  currentPage: 'home',
  race: null,
  userName: localStorage_safe('rs_name') || '',
  countdownTimer: null
};

function localStorage_safe(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function localStorage_set(key, val) {
  try { localStorage.setItem(key, val); } catch (e) {}
}
function sessionStorage_safe(key) {
  try { return sessionStorage.getItem(key); } catch (e) { return null; }
}
function sessionStorage_set(key, val) {
  try { sessionStorage.setItem(key, val); } catch (e) {}
}

const main = document.getElementById('main-content');
const toastEl = document.getElementById('toast');

// ---------------- Site Login Gate ----------------
async function initLoginGate() {
  const loginScreen = document.getElementById('login-screen');
  const appRoot = document.getElementById('app-root');
  const savedPw = sessionStorage_safe('rs_site_pw');

  if (savedPw) {
    try {
      await API.checkSitePassword(savedPw);
      loginScreen.style.display = 'none';
      appRoot.style.display = '';
      bootApp();
      return;
    } catch (e) {
      sessionStorage.removeItem('rs_site_pw');
    }
  }

  loginScreen.style.display = 'flex';
  appRoot.style.display = 'none';

  const input = document.getElementById('login-password');
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');

  async function tryLogin() {
    const pw = input.value.trim();
    if (!pw) return;
    btn.disabled = true;
    errEl.textContent = '';
    try {
      await API.checkSitePassword(pw);
      sessionStorage_set('rs_site_pw', pw);
      loginScreen.style.display = 'none';
      appRoot.style.display = '';
      bootApp();
    } catch (e) {
      errEl.textContent = '合言葉が正しくありません';
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', tryLogin);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
}

// ---------------- Toast ----------------
function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2800);
}

// ---------------- Navigation ----------------
function bootApp() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });
  render();
}

function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  render();
}

// ---------------- Render Router ----------------
async function render() {
  clearInterval(state.countdownTimer);
  main.innerHTML = '<div class="loading">読み込み中…</div>';

  try {
    switch (state.currentPage) {
      case 'home': await renderHome(); break;
      case 'prediction': await renderPrediction(); break;
      case 'entry': await renderEntry(); break;
      case 'entries': await renderEntries(); break;
      case 'board': await renderBoard(); break;
      case 'ranking': await renderRanking(); break;
      case 'past': await renderPast(); break;
      case 'pastDetail': await renderPastDetail(state.selectedPastRaceId); break;
      case 'admin': await renderAdmin(); break;
      default: await renderHome();
    }
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><div class="es-icon">⚠</div><p>読み込みに失敗しました。<br>${escapeHtml(err.message)}</p></div>`;
  }
}

// ---------------- Helpers ----------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateTime(d) {
  const date = new Date(d);
  if (isNaN(date)) return '';
  return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date)) return d;
  return `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
}

function renderHorseTable(horses) {
  if (!horses || horses.length === 0) return '';
  return `
    <div class="horse-table-wrap">
      <table class="horse-table">
        <thead>
          <tr><th>枠</th><th>馬番</th><th>馬名</th><th>騎手</th></tr>
        </thead>
        <tbody>
          ${horses.map(h => `
            <tr>
              <td><span class="waku-badge waku-${escapeHtml(h['枠番'])}">${escapeHtml(h['枠番'])}</span></td>
              <td class="umaban-cell">${escapeHtml(h['馬番'])}</td>
              <td class="horsename-cell">${escapeHtml(h['馬名'])}</td>
              <td class="jockey-cell">${escapeHtml(h['騎手'])}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---------------- Home ----------------
async function renderHome() {
  const { race } = await API.getHome();
  state.race = race;

  if (!race) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🏇</div>
        <p>現在受付中のレースはありません。<br>管理者がレースを登録するまでお待ちください。</p>
      </div>`;
    return;
  }

  const isOpen = race['状態'] === '受付中';
  const deadline = new Date(race['締切時刻']);
  const horses = await API.getHorses(race['RaceID']);

  main.innerHTML = `
    <div class="race-hero">
      <div class="race-hero-eyebrow">今週のメインレース</div>
      <div class="race-hero-name">${escapeHtml(race['レース名'])}</div>
      <div class="race-hero-meta">
        <span>📅 <b>${formatDate(race['開催日'])}</b></span>
        <span>📍 <b>${escapeHtml(race['競馬場'])}</b></span>
        <span>🚩 発走 <b>${formatDateTime(race['発送時刻']).split(' ')[1] || ''}</b></span>
      </div>
      <span class="race-status ${isOpen ? 'open' : 'closed'}">
        ${isOpen ? '● 受付中' : '● 締切／結果待ち'}
      </span>
      <div id="countdown-area"></div>
    </div>

    ${horses.length > 0 ? `
      <h2 class="section-title">出走馬・枠順</h2>
      ${renderHorseTable(horses)}
    ` : ''}

    <div class="quick-actions quick-actions-4">
      <button class="quick-action" data-nav="prediction"><span class="qi">🧠</span>AI予想</button>
      <button class="quick-action" data-nav="entry"><span class="qi">✎</span>予想する</button>
      <button class="quick-action" data-nav="entries"><span class="qi">☰</span>みんなの予想</button>
      <button class="quick-action" data-nav="board"><span class="qi">💬</span>掲示板</button>
    </div>
  `;

  main.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  startCountdown(deadline, isOpen);
}

function startCountdown(deadline, isOpen) {
  const area = document.getElementById('countdown-area');
  if (!area) return;

  function tick() {
    const now = new Date();
    const diff = deadline - now;

    if (!isOpen || diff <= 0) {
      area.innerHTML = `<div class="countdown-label">締切</div><div class="countdown">受付終了</div>`;
      clearInterval(state.countdownTimer);
      return;
    }

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    area.innerHTML = `<div class="countdown-label">締切まで</div><div class="countdown">${h}時間 ${m}分 ${s}秒</div>`;
  }

  tick();
  state.countdownTimer = setInterval(tick, 1000);
}

// ---------------- AI予想 ----------------
async function renderPrediction() {
  const { race } = await API.getHome();
  state.race = race;

  if (!race) {
    main.innerHTML = `<div class="empty-state"><div class="es-icon">🧠</div><p>現在のレースはありません。</p></div>`;
    return;
  }

  const prediction = await API.getPrediction(race['RaceID']);
  const horses = await API.getHorses(race['RaceID']);

  main.innerHTML = `
    ${horses.length > 0 ? `
      <h2 class="section-title">出走馬・枠順</h2>
      ${renderHorseTable(horses)}
    ` : ''}
    <h2 class="section-title">今週のAI予想</h2>
    ${prediction && prediction['本文'] ? `
      <div class="card prediction-card">
        <div class="prediction-meta">更新: ${formatDateTime(prediction['更新日時'])}</div>
        <div class="prediction-body">${escapeHtml(prediction['本文'])}</div>
      </div>
    ` : `
      <div class="empty-state">
        <div class="es-icon">🧠</div>
        <p>今週のAI予想はまだ投稿されていません。</p>
      </div>
    `}
  `;
}

// ---------------- Entry Form (券種方式) ----------------
async function renderEntry() {
  const { race } = await API.getHome();
  state.race = race;

  if (!race) {
    main.innerHTML = `<div class="empty-state"><div class="es-icon">🏇</div><p>現在受付中のレースはありません。</p></div>`;
    return;
  }

  if (race['状態'] !== '受付中') {
    main.innerHTML = `
      <div class="locked-banner">🔒 このレースは締切済みです。<br>「みんなの予想」から結果をご確認ください。</div>
    `;
    return;
  }

  let myEntry = null;
  if (state.userName) {
    myEntry = await API.getMyEntry(race['RaceID'], state.userName);
  }
  const horses = await API.getHorses(race['RaceID']);

  const v = (key) => myEntry ? escapeHtml(myEntry[key] || '') : '';

  main.innerHTML = `
    ${horses.length > 0 ? `
      <h2 class="section-title">出走馬・枠順</h2>
      ${renderHorseTable(horses)}
    ` : ''}
    <h2 class="section-title">買い目を投稿</h2>
    <div class="card">
      <div class="form-group">
        <label class="form-label">お名前</label>
        <input type="text" id="input-name" class="form-input" placeholder="例：山田太郎" value="${escapeHtml(state.userName)}">
      </div>

      <div class="bet-block">
        <div class="bet-title">単勝</div>
        <input type="text" id="bet-tansho" class="form-input" placeholder="例：5 または 5,8" value="${v('単勝')}">
        <p class="form-hint">複数点はカンマ区切り</p>
      </div>

      <div class="bet-block">
        <div class="bet-title">複勝</div>
        <input type="text" id="bet-fukusho" class="form-input" placeholder="例：5 または 5,8" value="${v('複勝')}">
      </div>

      <div class="bet-block">
        <div class="bet-title">馬連</div>
        <input type="text" id="bet-umaren" class="form-input" placeholder="例：3-5 または 3-5,3-8" value="${v('馬連')}">
        <p class="form-hint">「馬番-馬番」の形式（順不同）</p>
      </div>

      <div class="bet-block">
        <div class="bet-title">馬単</div>
        <input type="text" id="bet-umatan" class="form-input" placeholder="例：3&gt;5 または 3&gt;5,3&gt;8" value="${v('馬単')}">
        <p class="form-hint">「1着&gt;2着」の形式（着順あり）</p>
      </div>

      <div class="bet-block">
        <div class="bet-title">三連複フォーメーション</div>
        <div class="formation-grid">
          <div>
            <label class="form-label small">1着候補</label>
            <input type="text" id="bet-f1" class="form-input" placeholder="例：3,5" value="${v('三連複F_1着')}">
          </div>
          <div>
            <label class="form-label small">2着候補</label>
            <input type="text" id="bet-f2" class="form-input" placeholder="例：3,5,8" value="${v('三連複F_2着')}">
          </div>
          <div>
            <label class="form-label small">3着候補</label>
            <input type="text" id="bet-f3" class="form-input" placeholder="例：3,5,8,10" value="${v('三連複F_3着')}">
          </div>
        </div>
      </div>

      <div class="bet-block">
        <div class="bet-title">三連複ボックス</div>
        <input type="text" id="bet-box" class="form-input" placeholder="例：3,5,8,10（3頭以上）" value="${v('三連複BOX')}">
        <p class="form-hint">入力した馬番から3頭を選ぶ組み合わせを全て購入</p>
      </div>

      <div class="form-group">
        <label class="form-label">コメント（任意）</label>
        <textarea id="input-comment" class="form-input" placeholder="展開予想やひとことなど">${v('コメント')}</textarea>
      </div>

      <button class="submit-btn" id="submit-entry-btn">${myEntry ? '買い目を更新する' : '投稿する'}</button>
      <p class="form-hint" style="text-align:center; margin-top:10px;">締切前なら何度でも上書きできます。使わない券種は空欄でOK</p>
    </div>
  `;

  document.getElementById('submit-entry-btn').addEventListener('click', handleSubmitEntry);
}

async function handleSubmitEntry() {
  const btn = document.getElementById('submit-entry-btn');
  const name = document.getElementById('input-name').value.trim();

  if (!name) {
    showToast('お名前を入力してください', true);
    return;
  }

  const params = {
    raceId: state.race['RaceID'],
    name,
    '単勝': document.getElementById('bet-tansho').value.trim(),
    '複勝': document.getElementById('bet-fukusho').value.trim(),
    '馬連': document.getElementById('bet-umaren').value.trim(),
    '馬単': document.getElementById('bet-umatan').value.trim(),
    '三連複F_1着': document.getElementById('bet-f1').value.trim(),
    '三連複F_2着': document.getElementById('bet-f2').value.trim(),
    '三連複F_3着': document.getElementById('bet-f3').value.trim(),
    '三連複BOX': document.getElementById('bet-box').value.trim(),
    comment: document.getElementById('input-comment').value.trim()
  };

  btn.disabled = true;
  btn.textContent = '送信中…';

  try {
    await API.submitEntry(params);
    localStorage_set('rs_name', name);
    state.userName = name;
    showToast('投稿完了');
    btn.textContent = '買い目を更新する';
  } catch (err) {
    showToast(err.message, true);
    btn.textContent = '投稿する';
  } finally {
    btn.disabled = false;
  }
}

// ---------------- Entries List ----------------
function renderBetChips(entry) {
  const rows = [
    { label: '単勝', key: '単勝' },
    { label: '複勝', key: '複勝' },
    { label: '馬連', key: '馬連' },
    { label: '馬単', key: '馬単' }
  ];

  let html = '';

  rows.forEach(r => {
    if (entry[r.key]) {
      const judged = entry.judgement ? entry.judgement.detail[r.key] : null;
      html += renderBetRow(r.label, entry[r.key], judged);
    }
  });

  const hasFormation = entry['三連複F_1着'] || entry['三連複F_2着'] || entry['三連複F_3着'];
  if (hasFormation) {
    const summary = `1着[${entry['三連複F_1着']||'-'}] 2着[${entry['三連複F_2着']||'-'}] 3着[${entry['三連複F_3着']||'-'}]`;
    const judged = entry.judgement ? entry.judgement.detail['三連複F'] : null;
    html += renderBetRow('三連複F', summary, judged);
  }

  if (entry['三連複BOX']) {
    const judged = entry.judgement ? entry.judgement.detail['三連複BOX'] : null;
    html += renderBetRow('三連複BOX', entry['三連複BOX'], judged);
  }

  return html || '<p class="form-hint">買い目未登録</p>';
}

function renderBetRow(label, rawText, judged) {
  const isHit = judged && judged.hit && judged.hit.length > 0;
  const countLabel = judged ? `（${judged.hit.length}/${judged.buy.length}点的中）` : '';
  return `
    <div class="bet-row ${isHit ? 'hit' : ''}">
      <span class="bet-row-label">${escapeHtml(label)}</span>
      <span class="bet-row-value">${escapeHtml(rawText)}</span>
      ${judged ? `<span class="bet-row-judge">${isHit ? '的中 ' : ''}${countLabel}</span>` : ''}
    </div>
  `;
}

function renderHitBadge(entry) {
  if (entry.judgement && entry.judgement.totalHit > 0) {
    return `<span class="hit-badge">🎯 的中！</span>`;
  }
  return '';
}

async function renderEntries() {
  const { race } = await API.getHome();
  state.race = race;

  if (!race) {
    main.innerHTML = `<div class="empty-state"><div class="es-icon">🏇</div><p>現在のレースはありません。</p></div>`;
    return;
  }

  const { visible, entries } = await API.getEntries(race['RaceID']);

  main.innerHTML = `<h2 class="section-title">みんなの買い目</h2><div id="entries-list"></div>`;
  const list = document.getElementById('entries-list');

  if (!visible) {
    list.innerHTML = `<div class="locked-banner">🔒 締切後に公開されます。<br>もうしばらくお待ちください。</div>`;
    return;
  }

  if (entries.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="es-icon">📝</div><p>まだ投稿がありません。</p></div>`;
    return;
  }

  list.innerHTML = entries.map(en => `
    <div class="entry-card">
      <div class="entry-head">
        <span class="entry-name">${escapeHtml(en['名前'])}${renderHitBadge(en)}</span>
        <span class="entry-time">${formatDateTime(en['投稿日時'])}</span>
      </div>
      <div class="bet-list">
        ${renderBetChips(en)}
      </div>
      ${en['コメント'] ? `<div class="entry-comment">${escapeHtml(en['コメント'])}</div>` : ''}
    </div>
  `).join('');
}

// ---------------- 掲示板 ----------------
function likedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('rs_liked') || '[]'));
  } catch (e) {
    return new Set();
  }
}
function addLiked(commentId) {
  const s = likedSet();
  s.add(commentId);
  try { localStorage.setItem('rs_liked', JSON.stringify([...s])); } catch (e) {}
}

async function renderBoard() {
  const { race } = await API.getHome();
  state.race = race;

  if (!race) {
    main.innerHTML = `<div class="empty-state"><div class="es-icon">💬</div><p>現在のレースはありません。</p></div>`;
    return;
  }

  const comments = await API.getComments(race['RaceID']);
  const liked = likedSet();

  const parents = comments.filter(c => !c['ParentCommentID']);
  const repliesOf = (id) => comments.filter(c => c['ParentCommentID'] === id);

  main.innerHTML = `
    <h2 class="section-title">掲示板</h2>

    <div class="card">
      <div class="form-group">
        <label class="form-label">お名前</label>
        <input type="text" id="board-name" class="form-input" placeholder="例：山田太郎" value="${escapeHtml(state.userName)}">
      </div>
      <div class="form-group">
        <label class="form-label">コメント</label>
        <textarea id="board-content" class="form-input" placeholder="ひとこと、実況、雑談など"></textarea>
      </div>
      <button class="submit-btn" id="board-submit-btn">投稿する</button>
    </div>

    <div id="board-list">
      ${parents.length === 0 ? `<div class="empty-state"><div class="es-icon">💬</div><p>まだコメントがありません。<br>最初の一言をどうぞ。</p></div>` : ''}
      ${parents.map(c => renderCommentCard(c, repliesOf(c['CommentID']), liked)).join('')}
    </div>
  `;

  document.getElementById('board-submit-btn').addEventListener('click', () => handleBoardSubmit(race['RaceID']));

  wireCommentEvents(race['RaceID']);
}

function renderCommentCard(comment, replies, liked) {
  const isLiked = liked.has(comment['CommentID']);
  return `
    <div class="comment-card">
      <div class="comment-head">
        <span class="comment-name">${escapeHtml(comment['名前'])}</span>
        <span class="comment-time">${formatDateTime(comment['投稿日時'])}</span>
      </div>
      <div class="comment-body">${escapeHtml(comment['本文'])}</div>
      <div class="comment-actions">
        <button class="like-btn ${isLiked ? 'liked' : ''}" data-comment-id="${comment['CommentID']}" ${isLiked ? 'disabled' : ''}>
          👍 <span class="like-count">${comment['いいね数'] || 0}</span>
        </button>
        <button class="reply-btn" data-comment-id="${comment['CommentID']}" data-name="${escapeHtml(comment['名前'])}">返信</button>
      </div>
      <div class="reply-form-slot" data-slot-for="${comment['CommentID']}"></div>
      ${replies.length > 0 ? `
        <div class="reply-list">
          ${replies.map(r => `
            <div class="reply-card">
              <div class="comment-head">
                <span class="comment-name">${escapeHtml(r['名前'])}</span>
                <span class="comment-time">${formatDateTime(r['投稿日時'])}</span>
              </div>
              <div class="comment-body">${escapeHtml(r['本文'])}</div>
              <div class="comment-actions">
                <button class="like-btn ${liked.has(r['CommentID']) ? 'liked' : ''}" data-comment-id="${r['CommentID']}" ${liked.has(r['CommentID']) ? 'disabled' : ''}>
                  👍 <span class="like-count">${r['いいね数'] || 0}</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function wireCommentEvents(raceId) {
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const commentId = btn.dataset.commentId;
      btn.disabled = true;
      try {
        const res = await API.likeComment(commentId);
        addLiked(commentId);
        btn.classList.add('liked');
        btn.querySelector('.like-count').textContent = res.likes;
      } catch (err) {
        showToast(err.message, true);
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const commentId = btn.dataset.commentId;
      const toName = btn.dataset.name;
      const slot = document.querySelector(`.reply-form-slot[data-slot-for="${commentId}"]`);

      if (slot.innerHTML) {
        slot.innerHTML = '';
        return;
      }

      document.querySelectorAll('.reply-form-slot').forEach(s => s.innerHTML = '');

      slot.innerHTML = `
        <div class="reply-form">
          <input type="text" class="form-input reply-name" placeholder="お名前" value="${escapeHtml(state.userName)}">
          <textarea class="form-input reply-content" placeholder="${escapeHtml(toName)}さんへ返信"></textarea>
          <button class="submit-btn reply-submit-btn" data-comment-id="${commentId}">返信を送る</button>
        </div>
      `;

      slot.querySelector('.reply-submit-btn').addEventListener('click', async (e) => {
        const parentId = e.target.dataset.commentId;
        const name = slot.querySelector('.reply-name').value.trim();
        const content = slot.querySelector('.reply-content').value.trim();
        if (!name) { showToast('お名前を入力してください', true); return; }
        if (!content) { showToast('返信内容を入力してください', true); return; }

        e.target.disabled = true;
        try {
          await API.submitComment({ raceId, parentCommentId: parentId, name, content });
          localStorage_set('rs_name', name);
          state.userName = name;
          showToast('返信しました');
          render();
        } catch (err) {
          showToast(err.message, true);
          e.target.disabled = false;
        }
      });
    });
  });
}

async function handleBoardSubmit(raceId) {
  const btn = document.getElementById('board-submit-btn');
  const name = document.getElementById('board-name').value.trim();
  const content = document.getElementById('board-content').value.trim();

  if (!name) { showToast('お名前を入力してください', true); return; }
  if (!content) { showToast('コメントを入力してください', true); return; }

  btn.disabled = true;
  try {
    await API.submitComment({ raceId, name, content });
    localStorage_set('rs_name', name);
    state.userName = name;
    showToast('投稿完了');
    render();
  } catch (err) {
    showToast(err.message, true);
    btn.disabled = false;
  }
}

// ---------------- Ranking ----------------
async function renderRanking() {
  const ranking = await API.getRanking();

  main.innerHTML = `<h2 class="section-title">年間ランキング</h2><div id="ranking-list"></div>`;
  const list = document.getElementById('ranking-list');

  if (!ranking || ranking.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="es-icon">★</div><p>まだランキングデータがありません。<br>レース結果が確定すると集計されます。</p></div>`;
    return;
  }

  const sorted = [...ranking].sort((a, b) => (b['ポイント'] || 0) - (a['ポイント'] || 0));

  list.innerHTML = sorted.map((r, i) => `
    <div class="rank-row">
      <div class="rank-number">${i + 1}</div>
      <div class="rank-info">
        <div class="rank-name">${escapeHtml(r['名前'])}</div>
        <div class="rank-stats">
          <span>購入 ${r['購入点数']}点</span>
          <span>的中 ${r['的中点数']}点</span>
          <span>的中率 ${r['的中率']}</span>
        </div>
      </div>
      <div class="rank-points">${r['ポイント']}pt</div>
    </div>
  `).join('');
}

// ---------------- Past Races ----------------
async function renderPast() {
  const races = await API.getPastRaces();

  main.innerHTML = `<h2 class="section-title">過去レース</h2><div id="past-list"></div>`;
  const list = document.getElementById('past-list');

  if (!races || races.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="es-icon">🕰</div><p>まだ結果確定したレースがありません。</p></div>`;
    return;
  }

  list.innerHTML = races.map(r => `
    <div class="past-race-card" data-race-id="${r['RaceID']}">
      <div class="past-race-head">
        <span class="past-race-name">${escapeHtml(r['レース名'])}</span>
        <span class="past-race-date">${formatDate(r['開催日'])}</span>
      </div>
      ${r.result ? `
        <div class="past-result-row">
          <span class="result-chip">1着 ${escapeHtml(r.result['1着'])}</span>
          <span class="result-chip">2着 ${escapeHtml(r.result['2着'])}</span>
          <span class="result-chip">3着 ${escapeHtml(r.result['3着'])}</span>
        </div>
      ` : ''}
    </div>
  `).join('');

  list.querySelectorAll('.past-race-card').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedPastRaceId = el.dataset.raceId;
      state.currentPage = 'pastDetail';
      render();
    });
  });
}

async function renderPastDetail(raceId) {
  const { race, entries, result } = await API.getPastRaceDetail(raceId);

  main.innerHTML = `
    <button class="quick-action" id="back-btn" style="width:auto; padding:8px 14px; margin-bottom:16px; display:inline-flex; flex-direction:row; gap:6px;">← 過去レース一覧へ</button>
    <div class="race-hero">
      <div class="race-hero-eyebrow">${formatDate(race['開催日'])}</div>
      <div class="race-hero-name">${escapeHtml(race['レース名'])}</div>
      ${result ? `
        <div class="past-result-row">
          <span class="result-chip">1着 ${escapeHtml(result['1着'])}</span>
          <span class="result-chip">2着 ${escapeHtml(result['2着'])}</span>
          <span class="result-chip">3着 ${escapeHtml(result['3着'])}</span>
        </div>
      ` : ''}
    </div>
    <h2 class="section-title">みんなの買い目</h2>
    ${entries.map(en => `
      <div class="entry-card">
        <div class="entry-head">
          <span class="entry-name">${escapeHtml(en['名前'])}${renderHitBadge(en)}</span>
          <span class="entry-time">${formatDateTime(en['投稿日時'])}</span>
        </div>
        <div class="bet-list">
          ${renderBetChips(en)}
        </div>
        ${en['コメント'] ? `<div class="entry-comment">${escapeHtml(en['コメント'])}</div>` : ''}
      </div>
    `).join('')}
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    state.currentPage = 'past';
    render();
  });
}

// ---------------- Admin ----------------
function renderAdmin() {
  main.innerHTML = `
    <div class="admin-lock">
      <h2 class="section-title" style="justify-content:center;">管理画面</h2>
      <div class="form-group">
        <input type="password" id="admin-code-input" class="form-input" placeholder="管理者コード">
      </div>
      <button class="submit-btn" id="admin-login-btn">入る</button>
    </div>
  `;
  document.getElementById('admin-login-btn').addEventListener('click', async () => {
    const code = document.getElementById('admin-code-input').value.trim();
    if (!code) return;
    try {
      const races = await API.adminGetRaces(code);
      state.adminCode = code;
      renderAdminPanel(races);
    } catch (err) {
      showToast('管理者コードが正しくありません', true);
    }
  });
}

function renderAdminPanel(races) {
  const activeRaces = (races || []).filter(r => r['状態'] === '受付中' || r['状態'] === '締切');

  main.innerHTML = `
    <div class="admin-section">
      <h2 class="section-title">新しいレースを登録</h2>
      <div class="card">
        <div class="form-group">
          <label class="form-label">レース名</label>
          <input type="text" id="a-race-name" class="form-input" placeholder="例：第◯回 宝塚記念(GI)">
        </div>
        <div class="form-group">
          <label class="form-label">開催日</label>
          <input type="date" id="a-race-date" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">競馬場</label>
          <input type="text" id="a-track" class="form-input" placeholder="例：阪神">
        </div>
        <div class="form-group">
          <label class="form-label">発走時刻</label>
          <input type="datetime-local" id="a-post-time" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">締切時刻</label>
          <input type="datetime-local" id="a-deadline" class="form-input">
        </div>
        <button class="submit-btn" id="a-create-btn">レースを登録</button>
      </div>
    </div>

    <div class="admin-section">
      <h2 class="section-title">レース管理</h2>
      ${activeRaces.length === 0 ? `
        <div class="empty-state"><p>受付中・締切中のレースがありません。<br>上のフォームからレースを登録してください。</p></div>
      ` : `
        <div class="card">
          <div class="form-group">
            <label class="form-label">対象レース</label>
            <select id="a-race-select" class="form-input">
              ${activeRaces.map(r => `<option value="${r['RaceID']}">${escapeHtml(r['レース名'])}（${escapeHtml(r['状態'])}）</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="a-race-detail"></div>
      `}
    </div>
  `;

  document.getElementById('a-create-btn').addEventListener('click', async () => {
    const btn = document.getElementById('a-create-btn');
    const params = {
      adminCode: state.adminCode,
      raceName: document.getElementById('a-race-name').value.trim(),
      raceDate: document.getElementById('a-race-date').value,
      track: document.getElementById('a-track').value.trim(),
      postTime: document.getElementById('a-post-time').value,
      deadline: document.getElementById('a-deadline').value
    };
    if (!params.raceName || !params.raceDate || !params.deadline) {
      showToast('レース名・開催日・締切時刻は必須です', true);
      return;
    }
    btn.disabled = true;
    try {
      await API.adminCreateRace(params);
      showToast('レースを登録しました');
      const races = await API.adminGetRaces(state.adminCode);
      renderAdminPanel(races);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  if (activeRaces.length > 0) {
    const select = document.getElementById('a-race-select');
    const loadDetail = () => renderAdminRaceDetail(activeRaces.find(r => r['RaceID'] === select.value));
    select.addEventListener('change', loadDetail);
    loadDetail();
  }
}

async function renderAdminRaceDetail(race) {
  const detailEl = document.getElementById('a-race-detail');
  if (!race) return;
  detailEl.innerHTML = `<div class="loading">読み込み中…</div>`;

  const [prediction, horses] = await Promise.all([
    API.getPrediction(race['RaceID']),
    API.getHorses(race['RaceID'])
  ]);

  const predictionText = prediction && prediction['本文'] ? prediction['本文'] : '';
  const horsesText = horses && horses.length > 0
    ? horses.map(h => `${h['枠番']},${h['馬番']},${h['馬名']},${h['騎手']}`).join('\n')
    : '';
  const raceId = race['RaceID'];

  detailEl.innerHTML = `
    <div class="card">
      <div class="past-race-head">
        <span class="past-race-name">${escapeHtml(race['レース名'])}</span>
        <span class="race-status ${race['状態'] === '受付中' ? 'open' : 'closed'}">${escapeHtml(race['状態'])}</span>
      </div>
      <p class="form-hint">${formatDate(race['開催日'])} ／ ${escapeHtml(race['競馬場'] || '')}</p>

      <div class="form-group mt-8">
        <label class="form-label">状態を変更</label>
        <div style="display:flex; gap:8px;">
          <button class="quick-action a-status-btn" data-status="受付中" style="flex:1;">受付中にする</button>
          <button class="quick-action a-status-btn" data-status="締切" style="flex:1;">締切にする</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="divider-label" style="margin-top:0;">出走馬・枠順</div>
      <p class="form-hint">1行に1頭ずつ「枠番,馬番,馬名,騎手」の形式で入力</p>
      <div class="form-group mt-8">
        <textarea id="a-horses-content" class="form-input" placeholder="1,1,馬名,騎手名&#10;2,2,馬名,騎手名" style="min-height:160px; font-family:monospace; font-size:13px;">${escapeHtml(horsesText)}</textarea>
      </div>
      <button class="submit-btn" id="a-horses-btn">出走馬を保存</button>
      <p id="a-horses-status" class="save-status"></p>
    </div>

    <div class="card">
      <div class="divider-label" style="margin-top:0;">AI予想</div>
      <div class="form-group mt-8">
        <textarea id="a-prediction-content" class="form-input" placeholder="ここにAI予想の全文を貼り付け" style="min-height:180px;">${escapeHtml(predictionText)}</textarea>
      </div>
      <button class="submit-btn" id="a-prediction-btn">AI予想を保存</button>
      <p id="a-prediction-status" class="save-status"></p>
    </div>

    <div class="card">
      <div class="divider-label" style="margin-top:0;">結果入力</div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <input type="number" class="form-input" id="a-first" placeholder="1着">
        <input type="number" class="form-input" id="a-second" placeholder="2着">
        <input type="number" class="form-input" id="a-third" placeholder="3着">
      </div>
      <button class="submit-btn" id="a-result-btn">結果を確定してランキング更新</button>
    </div>
  `;

  document.querySelectorAll('.a-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await API.adminUpdateRaceStatus({ adminCode: state.adminCode, raceId, status: btn.dataset.status });
        showToast('状態を更新しました');
        const races = await API.adminGetRaces(state.adminCode);
        renderAdminPanel(races);
      } catch (err) {
        showToast(err.message, true);
        btn.disabled = false;
      }
    });
  });

  document.getElementById('a-prediction-btn').addEventListener('click', async () => {
    const btn = document.getElementById('a-prediction-btn');
    const statusEl = document.getElementById('a-prediction-status');
    const content = document.getElementById('a-prediction-content').value.trim();
    if (!content) {
      showToast('AI予想の本文を入力してください', true);
      return;
    }
    btn.disabled = true;
    statusEl.textContent = '';
    try {
      await API.adminSubmitPrediction({ adminCode: state.adminCode, raceId, content });
      // 保存後、実際にサーバーから読み直して確実に反映されたか確認する
      const saved = await API.getPrediction(raceId);
      if (saved && saved['本文'] === content) {
        showToast('AI予想を保存しました');
        statusEl.textContent = `✓ 保存済み（${formatDateTime(saved['更新日時'])}）`;
      } else {
        showToast('保存の確認に失敗しました。もう一度お試しください', true);
      }
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('a-horses-btn').addEventListener('click', async () => {
    const btn = document.getElementById('a-horses-btn');
    const statusEl = document.getElementById('a-horses-status');
    const raw = document.getElementById('a-horses-content').value.trim();
    if (!raw) {
      showToast('出走馬データを入力してください', true);
      return;
    }
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
    const horseData = [];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 4) {
        showToast(`形式が正しくない行があります: ${line}`, true);
        return;
      }
      horseData.push({ waku: parts[0], umaban: parts[1], name: parts[2], jockey: parts[3] });
    }
    btn.disabled = true;
    statusEl.textContent = '';
    try {
      await API.adminSubmitHorses({ adminCode: state.adminCode, raceId, horses: JSON.stringify(horseData) });
      const saved = await API.getHorses(raceId);
      if (saved && saved.length === horseData.length) {
        showToast('出走馬を保存しました');
        statusEl.textContent = `✓ ${saved.length}頭 保存済み`;
      } else {
        showToast('保存の確認に失敗しました。もう一度お試しください', true);
      }
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('a-result-btn').addEventListener('click', async () => {
    const btn = document.getElementById('a-result-btn');
    const first = document.getElementById('a-first').value.trim();
    const second = document.getElementById('a-second').value.trim();
    const third = document.getElementById('a-third').value.trim();
    if (!first || !second || !third) {
      showToast('1〜3着すべて入力してください', true);
      return;
    }
    btn.disabled = true;
    try {
      await API.adminSubmitResult({ adminCode: state.adminCode, raceId, first, second, third });
      showToast('結果を確定しました');
      const races = await API.adminGetRaces(state.adminCode);
      renderAdminPanel(races);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------------- Init ----------------
if (new URLSearchParams(location.search).get('admin') === '1') {
  state.currentPage = 'admin';
}
initLoginGate();
