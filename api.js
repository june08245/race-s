// ==========================================================
// Race Share API通信レイヤー (Ver.3 サイトパスワード対応)
// ==========================================================

const API = {
  async call(action, params = {}) {
    try {
      const sitePassword = sessionStorage.getItem('rs_site_pw') || '';
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, params: { ...params, sitePassword } })
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || '不明なエラーが発生しました');
      }
      return json.data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  checkSitePassword(pw) {
    // このメソッドだけは sessionStorage を経由せず直接パスワードを渡す
    return (async () => {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'checkSitePassword', params: { sitePassword: pw } })
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'パスワードが正しくありません');
      }
      return true;
    })();
  },

  getHome() {
    return this.call('getHome');
  },
  getActiveRaces() {
    return this.call('getActiveRaces');
  },
  getRace() {
    return this.call('getRace');
  },
  submitEntry(params) {
    return this.call('submitEntry', params);
  },
  getEntries(raceId) {
    return this.call('getEntries', { raceId });
  },
  getMyEntry(raceId, name) {
    return this.call('getMyEntry', { raceId, name });
  },
  getRanking() {
    return this.call('getRanking');
  },
  getPastRaces() {
    return this.call('getPastRaces');
  },
  getPastRaceDetail(raceId) {
    return this.call('getPastRaceDetail', { raceId });
  },
  getPrediction(raceId) {
    return this.call('getPrediction', { raceId });
  },
  getReview(raceId) {
    return this.call('getReview', { raceId });
  },
  getHorses(raceId) {
    return this.call('getHorses', { raceId });
  },
  getComments(raceId) {
    return this.call('getComments', { raceId });
  },
  submitComment(params) {
    return this.call('submitComment', params);
  },
  likeComment(commentId) {
    return this.call('likeComment', { commentId });
  },

  // ---- 管理者 ----
  adminCreateRace(params) {
    return this.call('adminCreateRace', params);
  },
  adminUpdateRaceStatus(params) {
    return this.call('adminUpdateRaceStatus', params);
  },
  adminUpdateDeadline(params) {
    return this.call('adminUpdateDeadline', params);
  },
  getLiveStreamUrl() {
    return this.call('getLiveStreamUrl');
  },
  adminSetLiveStreamUrl(params) {
    return this.call('adminSetLiveStreamUrl', params);
  },
  adminSubmitResult(params) {
    return this.call('adminSubmitResult', params);
  },
  adminGetRaces(adminCode) {
    return this.call('adminGetRaces', { adminCode });
  },
  adminSubmitPrediction(params) {
    return this.call('adminSubmitPrediction', params);
  },
  adminSubmitReview(params) {
    return this.call('adminSubmitReview', params);
  },
  adminSubmitHorses(params) {
    return this.call('adminSubmitHorses', params);
  }
};
