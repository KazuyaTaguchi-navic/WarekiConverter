import { convertToWareki, generateEraTable } from './convert.js';

const inputEl = document.getElementById('input-text');
const outputEl = document.getElementById('output-text');
const statusEl = document.getElementById('status');
const convertBtn = document.getElementById('convert-btn');
const copyBtn = document.getElementById('copy-btn');
const eraTableBody = document.getElementById('era-table-body');
const eraTableWrap = document.getElementById('era-table-wrap');

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_err) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_err2) {
      return false;
    }
  }
}

async function runConversion({ autoCopy }) {
  const source = inputEl.value;
  const result = convertToWareki(source);

  if (!result) {
    outputEl.value = '';
    setStatus(source.trim() ? '年式らしき文字列が見つかりませんでした' : '', source.trim() ? 'error' : '');
    return;
  }

  outputEl.value = result;

  if (autoCopy) {
    const copied = await copyToClipboard(result);
    setStatus(copied ? `コピーしました: ${result}` : `変換しました（コピーは失敗）: ${result}`, copied ? 'success' : 'error');
  } else {
    setStatus(`変換しました: ${result}`, 'success');
  }
}

async function getSelectedTextFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { text: '', error: 'アクティブなタブが見つかりません' };

  try {
    // allFrames: iframe内で選択されているケースも拾う
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.getSelection()?.toString() ?? '',
    });
    const text = results.map((r) => r.result || '').find((t) => t.trim()) || '';
    return { text, error: null };
  } catch (err) {
    return { text: '', error: err?.message || String(err) };
  }
}

function makeCopyableCell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  td.title = 'クリックでコピー';
  td.addEventListener('click', async () => {
    const copied = await copyToClipboard(text);
    setStatus(copied ? `コピーしました: ${text}` : 'コピーに失敗しました', copied ? 'success' : 'error');
  });
  return td;
}

function renderEraTable() {
  const currentYear = new Date().getFullYear();
  const rows = generateEraTable(currentYear + 2);

  eraTableBody.innerHTML = '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.year === currentYear) tr.classList.add('current-year');

    const age = row.year > currentYear ? '—' : `${currentYear - row.year}歳`;

    tr.append(
      makeCopyableCell(`${row.year}年`),
      makeCopyableCell(row.kanji),
      makeCopyableCell(row.alphabet),
      makeCopyableCell(age),
    );
    eraTableBody.appendChild(tr);
  }

  requestAnimationFrame(() => {
    eraTableWrap.scrollTop = eraTableWrap.scrollHeight;
  });
}

async function init() {
  renderEraTable();

  const { text: selectedText, error } = await getSelectedTextFromActiveTab();
  if (selectedText.trim()) {
    inputEl.value = selectedText;
    await runConversion({ autoCopy: true });
  } else if (error) {
    setStatus(`このページのテキストは取得できません（${error}）。下の欄に貼り付けてください`, 'error');
  } else {
    setStatus('選択中のテキストがありません。ページで年式を選択するか、下の欄に貼り付けてください');
  }

  convertBtn.addEventListener('click', () => runConversion({ autoCopy: true }));
  copyBtn.addEventListener('click', async () => {
    if (!outputEl.value) return;
    const copied = await copyToClipboard(outputEl.value);
    setStatus(copied ? `コピーしました: ${outputEl.value}` : 'コピーに失敗しました', copied ? 'success' : 'error');
  });
}

init();
