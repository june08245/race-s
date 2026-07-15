// ==========================================================
// Race Share 設定ファイル
// ==========================================================
// GASを「ウェブアプリとしてデプロイ」した後に発行されるURLを
// 下記の API_URL に貼り付けてください。
//
// 例: https://script.google.com/macros/s/AKfycb.../exec
// ==========================================================

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycby17Ti_EVv9pJtPhgzeWfphcqbIvxlsz66UG5NEhgpatKB5qX0FrW5kJPIqz7fNW0Ns-Q/exec',
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
