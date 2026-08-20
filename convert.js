// 西暦の年式表記（全角/半角・年月表記・スラッシュ表記・範囲表記）を
// 和暦(S/H/R)表記へ変換するための純粋関数群。

// 全角数字・全角スラッシュ・空白類を除去/半角化する
export function normalizeText(input) {
  let s = String(input);
  s = s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/／/g, '/');
  s = s.replace(/[\s　]/g, '');
  return s;
}

// 文字列内から日付らしき断片をすべて抽出する（長い表記を優先して判定）
const DATE_PATTERN =
  /\d{4}年\d{1,2}月\d{1,2}日|\d{4}年\d{1,2}月|\d{4}\/\d{1,2}\/\d{1,2}|\d{4}\/\d{1,2}|\d{4}年|\d{4}(?!\d)/g;

export function extractDateStrings(normalizedText) {
  return normalizedText.match(DATE_PATTERN) || [];
}

export function parseDateString(s) {
  let m;
  if ((m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/))) {
    return { year: +m[1], month: +m[2], day: +m[3] };
  }
  if ((m = s.match(/^(\d{4})年(\d{1,2})月$/))) {
    return { year: +m[1], month: +m[2] };
  }
  if ((m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/))) {
    return { year: +m[1], month: +m[2], day: +m[3] };
  }
  if ((m = s.match(/^(\d{4})\/(\d{1,2})$/))) {
    return { year: +m[1], month: +m[2] };
  }
  if ((m = s.match(/^(\d{4})年$/))) {
    return { year: +m[1] };
  }
  if ((m = s.match(/^(\d{4})$/))) {
    return { year: +m[1] };
  }
  return null;
}

const ERA_LETTER = { 昭和: 'S', 平成: 'H', 令和: 'R' };

// 元号境界（明治・大正は対象外。S/H/Rのみ対応）
// 昭和: 1926/12/25〜, 平成: 1989/1/8〜, 令和: 2019/5/1〜
// 日付が不明な場合、1989年1月と年のみ指定の境界年は下記の仮定で決定する:
//   ・1989年（月不明 or 1月かつ日不明）は平成元年(H1)とみなす
//   ・2019年（月不明）は令和元年(R1)とみなす
//   ・1926年（月不明）は昭和元年(S1)とみなす
export function toEra({ year, month, day }) {
  if (year < 1926) return null;

  if (year === 1926) {
    if (month != null && month < 12) return null;
    return format('昭和', 1, month);
  }
  if (year <= 1988) {
    return format('昭和', year - 1925, month);
  }
  if (year === 1989) {
    if (month === 1 && day != null) {
      return day <= 7 ? format('昭和', 64, month) : format('平成', 1, month);
    }
    return format('平成', 1, month);
  }
  if (year <= 2018) {
    return format('平成', year - 1988, month);
  }
  if (year === 2019) {
    if (month != null && month <= 4) return format('平成', 31, month);
    return format('令和', 1, month);
  }
  return format('令和', year - 2018, month);
}

function format(era, eraYear, month) {
  const letter = ERA_LETTER[era];
  return month != null ? `${letter}${eraYear}/${month}` : `${letter}${eraYear}`;
}

// テキスト全体を受け取り、和暦表記（単一 or 範囲）を返す。変換できる日付が
// 見つからない場合は null を返す。
export function convertToWareki(rawText) {
  const normalized = normalizeText(rawText);
  const dateStrings = extractDateStrings(normalized);
  const converted = dateStrings
    .map(parseDateString)
    .filter(Boolean)
    .map(toEra)
    .filter(Boolean);

  if (converted.length === 0) return null;
  if (converted.length === 1) return converted[0];
  return `${converted[0]}～${converted[converted.length - 1]}`;
}

// 和暦(S/H/R)表記を検出するためのパターン（例: "R6", "H19/3", "S64", "R元"）。
// 数字・数字列の前後がアルファベット/数字と連続している場合は誤検出を避ける。
const WAREKI_PATTERN = /(?<![A-Za-z0-9])[SHR](?:\d{1,2}(?!\d)|元)(?:\/\d{1,2}(?!\d))?/gi;

export function extractWarekiStrings(normalizedText) {
  return normalizedText.match(WAREKI_PATTERN) || [];
}

export function parseWarekiString(s) {
  const m = s.match(/^([SHR])(\d{1,2}|元)(?:\/(\d{1,2}))?$/i);
  if (!m) return null;
  return {
    letter: m[1].toUpperCase(),
    eraYear: m[2] === '元' ? 1 : Number(m[2]),
    month: m[3] != null ? Number(m[3]) : undefined,
  };
}

// 元号の開始西暦年より1小さい値（西暦年 = offset + 和暦年）
const ERA_OFFSET = { S: 1925, H: 1988, R: 2018 };

export function eraToSeireki({ letter, eraYear, month }) {
  const offset = ERA_OFFSET[letter];
  if (offset == null) return null;
  const year = offset + eraYear;
  return month != null ? `${year}/${month}` : `${year}`;
}

// テキスト全体を受け取り、和暦(S/H/R)表記から西暦表記（単一 or 範囲）へ変換する。
// 変換できる和暦表記が見つからない場合は null を返す。
export function convertToSeireki(rawText) {
  const normalized = normalizeText(rawText);
  const warekiStrings = extractWarekiStrings(normalized);
  const converted = warekiStrings
    .map(parseWarekiString)
    .filter(Boolean)
    .map(eraToSeireki)
    .filter(Boolean);

  if (converted.length === 0) return null;
  if (converted.length === 1) return converted[0];
  return `${converted[0]}～${converted[converted.length - 1]}`;
}

// 西暦→和暦を優先して試し、見つからなければ和暦→西暦を試す。
// どちらの日付らしき表記も見つからない場合は null。
export function convertEra(rawText) {
  const toWareki = convertToWareki(rawText);
  if (toWareki) return { direction: 'toWareki', result: toWareki };

  const toSeireki = convertToSeireki(rawText);
  if (toSeireki) return { direction: 'toSeireki', result: toSeireki };

  return null;
}

// 1つの西暦年に対応する元号区間を返す（境界年は複数区間になる）。
// toEra() の境界判定（1926/1989/2019）と揃えている。
function buildEraSegmentsForYear(year) {
  if (year === 1926) return [{ era: '昭和', eraYear: 1, note: '12月〜' }];
  if (year <= 1988) return [{ era: '昭和', eraYear: year - 1925 }];
  if (year === 1989) {
    return [
      { era: '昭和', eraYear: 64, note: '〜1/7' },
      { era: '平成', eraYear: 1, note: '1/8〜' },
    ];
  }
  if (year <= 2018) return [{ era: '平成', eraYear: year - 1988 }];
  if (year === 2019) {
    return [
      { era: '平成', eraYear: 31, note: '〜4月' },
      { era: '令和', eraYear: 1, note: '5月〜' },
    ];
  }
  return [{ era: '令和', eraYear: year - 2018 }];
}

function formatKanjiSegment(seg) {
  const yearPart = seg.eraYear === 1 ? '元年' : `${seg.eraYear}年`;
  return seg.note ? `${seg.era}${yearPart}（${seg.note}）` : `${seg.era}${yearPart}`;
}

function formatAlphabetSegment(seg) {
  const base = `${ERA_LETTER[seg.era]}${seg.eraYear}`;
  return seg.note ? `${base}（${seg.note}）` : base;
}

// 早見表（西暦→和暦）を生成する。年齢は現在時刻に依存するためここでは含めない。
export function generateEraTable(uptoYear) {
  const rows = [];
  for (let y = 1926; y <= uptoYear; y++) {
    const segments = buildEraSegmentsForYear(y);
    rows.push({
      year: y,
      kanji: segments.map(formatKanjiSegment).join('／'),
      alphabet: segments.map(formatAlphabetSegment).join('／'),
    });
  }
  return rows;
}
