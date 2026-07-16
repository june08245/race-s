// ==========================================================
// Race Share 設定ファイル
// ==========================================================
// GASを「ウェブアプリとしてデプロイ」した後に発行されるURLを
// 下記の API_URL に貼り付けてください。
//
// 例: https://script.google.com/macros/s/AKfycb.../exec
// ==========================================================

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwBLZMWYFcPXDXiCdNAXbjzk3ByYfhgSa3o4CPjUeRzmD-OJov-XaN6DRWRJ8S112XMbw/exec',
  MARKS: ['◎', '○', '▲', '☆', '△', '×'],
  MARK_LABELS: {
    '◎': '本命',
    '○': '対抗',
    '▲': '単穴',
    '☆': '穴',
    '△': '連下',
    '×': '押さえ'
  }
};
