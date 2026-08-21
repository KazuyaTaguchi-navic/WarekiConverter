import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToWareki, convertToSeireki, convertEra, generateEraTable } from '../convert.js';

test('全角年月表記を単一の和暦に変換する', () => {
  assert.equal(convertToWareki('２０２４年６月'), 'R6/6');
});

test('スラッシュ区切りの範囲表記を変換する', () => {
  assert.equal(convertToWareki('2026/11～2027/1'), 'R8/11～R9/1');
});

test('年月漢字表記の範囲を変換する（ユーザー提示の例）', () => {
  assert.equal(convertToWareki('2007年3月～2024年10月'), 'H19/3～R6/10');
});

test('年のみの表記も変換できる', () => {
  assert.equal(convertToWareki('2024年'), 'R6');
  assert.equal(convertToWareki('2024'), 'R6');
});

test('平成→令和境界（2019年）は月で判定する', () => {
  assert.equal(convertToWareki('2019年4月'), 'H31/4');
  assert.equal(convertToWareki('2019年5月'), 'R1/5');
});

test('昭和→平成境界（1989年）は月のみでは平成元年扱い', () => {
  assert.equal(convertToWareki('1989年1月'), 'H1/1');
  assert.equal(convertToWareki('1989年2月'), 'H1/2');
});

test('日付が無い文字列はnullを返す', () => {
  assert.equal(convertToWareki('適合車種一覧'), null);
});

test('前後に余分な文字列があっても抽出できる', () => {
  assert.equal(convertToWareki('年式：2007年3月～2024年10月 現在'), 'H19/3～R6/10');
});

test('2桁年/2桁月の範囲表記を変換する（自動車カタログの例: DIXCEL）', () => {
  assert.equal(convertToWareki('12/04～21/10'), 'H24/4～R3/10');
  assert.equal(convertToWareki('17/09～21/10'), 'H29/9～R3/10');
});

test('2桁年は00-49を2000年代、50-99を1900年代として展開する', () => {
  assert.equal(convertToWareki('07/01'), 'H19/1');
  assert.equal(convertToWareki('95/06'), 'H7/6');
});

test('和暦(略号)から西暦への逆変換ができる（ユーザー報告の例）', () => {
  assert.equal(convertToSeireki('R6/6'), '2024/6');
});

test('和暦の範囲表記から西暦の範囲へ逆変換できる', () => {
  assert.equal(convertToSeireki('H19/3～R6/10'), '2007/3～2024/10');
});

test('境界の和暦(S64・H31)も西暦へ逆変換できる', () => {
  assert.equal(convertToSeireki('S64/1'), '1989/1');
  assert.equal(convertToSeireki('H31/4'), '2019/4');
  assert.equal(convertToSeireki('R元'), '2019');
});

test('convertEraは西暦入力なら和暦へ、和暦入力なら西暦へ変換する', () => {
  assert.deepEqual(convertEra('2024年6月'), { direction: 'toWareki', result: 'R6/6' });
  assert.deepEqual(convertEra('R6/6'), { direction: 'toSeireki', result: '2024/6' });
  assert.equal(convertEra('適合車種一覧'), null);
});

test('早見表: 境界年は和暦(漢字)・略号ともに2区間を／で結合する', () => {
  const rows = generateEraTable(2024);
  const byYear = Object.fromEntries(rows.map((r) => [r.year, r]));

  assert.equal(byYear[1926].kanji, '昭和元年（12月〜）');
  assert.equal(byYear[1926].alphabet, 'S1（12月〜）');

  assert.equal(byYear[1989].kanji, '昭和64年（〜1/7）／平成元年（1/8〜）');
  assert.equal(byYear[1989].alphabet, 'S64（〜1/7）／H1（1/8〜）');

  assert.equal(byYear[2019].kanji, '平成31年（〜4月）／令和元年（5月〜）');
  assert.equal(byYear[2019].alphabet, 'H31（〜4月）／R1（5月〜）');

  assert.equal(byYear[2024].kanji, '令和6年');
  assert.equal(byYear[2024].alphabet, 'R6');
});
