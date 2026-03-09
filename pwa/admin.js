/**
 * SSSK Admin Panel JavaScript
 * Reads parser state via GitHub Raw API and triggers workflows via GitHub Actions API.
 * Token is stored in localStorage — never committed to the repo.
 *
 * Config:
 *   REPO_OWNER / REPO_NAME — set to the actual GitHub repo.
 */

const REPO_OWNER = 'realtomchuk-source';
const REPO_NAME  = 'svitlo-starkon';
const WORKFLOW_ID = 'monitor.yml';
const BRANCH = 'main';

const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const ACTIONS_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}`;

// ─── State ────────────────────────────────────────────────────────────────────

let parserState   = null;
let scheduleData  = [];
let githubToken   = localStorage.getItem('sssk_admin_token') || '';
let currentSection = 'dashboard';

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Token UI
    const tokenInput = document.getElementById('token-input');
    if (tokenInput) {
        tokenInput.value = githubToken ? '••••••••••••••••' : '';
        tokenInput.placeholder = 'ghp_...';
    }

    // Navigation
    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
        link.addEventListener('click', () => switchSection(link.dataset.section));
    });

    // Interval slider
    const slider = document.getElementById('interval-slider');
    const sliderVal = document.getElementById('interval-value');
    if (slider && sliderVal) {
        slider.addEventListener('input', () => {
            sliderVal.textContent = slider.value + ' хв';
        });
    }

    refreshAll();
    setInterval(refreshAll, 60000); // auto-refresh every 60s
});

function switchSection(name) {
    currentSection = name;
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${name}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
        link.classList.toggle('active', link.dataset.section === name);
    });
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

async function fetchRaw(path) {
    const url = `${RAW_BASE}/${path}?t=${Date.now()}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${path}`);
    return resp.json();
}

async function refreshAll() {
    try {
        parserState  = await fetchRaw('parser/data/state.json');
        scheduleData = await fetchRaw('parser/data/unified_schedules.json');
        renderDashboard();
        renderHistory();
        updateHeaderStatus('ok');
    } catch (e) {
        console.error('Refresh failed:', e);
        updateHeaderStatus('err');
        showDashboardError(e.message);
    }
}

// ─── Render: Header Status ─────────────────────────────────────────────────────

function updateHeaderStatus(status) {
    const pill = document.getElementById('header-status');
    if (!pill) return;
    pill.className = 'status-pill ' + status;
    const labels = { ok: '● Система онлайн', warn: '● Увага', err: '● Помилка читання' };
    pill.textContent = labels[status] || '●';
}

// ─── Render: Dashboard ────────────────────────────────────────────────────────

function renderDashboard() {
    if (!parserState) return;

    // Last run
    setText('stat-last-run', formatRelative(parserState.last_run));
    setText('stat-last-run-sub', formatFull(parserState.last_run));

    // Source mode
    const src = parserState.current_source || 'site';
    setText('stat-source', { both: '🔀 both', site: '🌐 site', telegram: '✈️ telegram' }[src] || src);

    // Schedule count
    setText('stat-schedules', scheduleData.length);
    const latest = scheduleData[scheduleData.length - 1];
    setText('stat-schedules-sub', latest ? `Останній: ${latest.target_date || '—'}` : 'Немає даних');

    // Override
    const overrideActive = parserState.override_until &&
        new Date(parserState.override_until) > new Date();
    setText('stat-override', overrideActive ? '⚡ Активний' : '— Вимкнено');

    // State details
    setKv('kv-last-site',     parserState.last_success_site, 'muted');
    setKv('kv-last-telegram', parserState.last_success_telegram || 'Не налаштовано', 'muted');
    setKv('kv-hash-site',     (parserState.last_site_hash || '—').substring(0, 12) + '…', 'muted');
    setKv('kv-source-mode',   src, src === 'both' ? 'green' : 'amber');
    setKv('kv-override-until', parserState.override_until || 'Вимкнено', 'muted');

    // Actions link
    const actionsLink = document.getElementById('actions-link');
    if (actionsLink) actionsLink.href = ACTIONS_URL;
}

function showDashboardError(msg) {
    setText('stat-last-run', 'Помилка');
    setText('stat-last-run-sub', msg);
}

// ─── Render: History ──────────────────────────────────────────────────────────

function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rows = [...scheduleData].reverse();
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px">
            Немає даних</td></tr>`;
        return;
    }

    rows.forEach(entry => {
        const tr = document.createElement('tr');
        const srcBadge = `<span class="badge badge-${entry.source}">${entry.source}</span>`;
        const typeBadge = entry.is_update
            ? `<span class="badge badge-update">🚨 Оновлення</span>`
            : `<span class="badge badge-new">✅ Новий</span>`;
        const preview = (entry.raw_text_summary || entry.parsed_text || '').substring(0, 60);

        tr.innerHTML = `
            <td>${formatFull(entry.timestamp)}</td>
            <td>${entry.target_date || '—'}</td>
            <td>${srcBadge}</td>
            <td>${typeBadge}</td>
            <td style="color:var(--text-muted);font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                title="${escHtml(preview)}">${escHtml(preview) || '—'}</td>
        `;
        tbody.appendChild(tr);
    });

    renderTimeline();
}

// ─── Timeline visual ──────────────────────────────────────────────────────────

function renderTimeline() {
    const bar = document.getElementById('timeline-bar');
    if (!bar || scheduleData.length === 0) return;
    bar.innerHTML = '';

    const timestamps = scheduleData.map(e => new Date(e.timestamp).getTime());
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    const range = max - min || 1;

    scheduleData.forEach(entry => {
        const t = new Date(entry.timestamp).getTime();
        const pct = ((t - min) / range * 90 + 5).toFixed(1);
        const dot = document.createElement('div');
        dot.className = 'timeline-dot' + (entry.is_update ? ' update' : '');
        dot.style.left = pct + '%';
        dot.title = `${entry.target_date || '?'} — ${formatFull(entry.timestamp)} (${entry.source})`;
        bar.appendChild(dot);
    });

    const labels = document.getElementById('timeline-labels');
    if (labels && scheduleData.length > 1) {
        const first = scheduleData[0];
        const last = scheduleData[scheduleData.length - 1];
        labels.innerHTML = `
            <span>${formatFull(first.timestamp)}</span>
            <span>${scheduleData.length} графіків</span>
            <span>${formatFull(last.timestamp)}</span>
        `;
    }
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function saveToken() {
    const input = document.getElementById('token-input');
    if (!input || !input.value || input.value.startsWith('•')) return;
    githubToken = input.value.trim();
    localStorage.setItem('sssk_admin_token', githubToken);
    input.value = '••••••••••••••••';
    appendLog('✅ Токен збережено.', 'ok');
}

function clearToken() {
    githubToken = '';
    localStorage.removeItem('sssk_admin_token');
    const input = document.getElementById('token-input');
    if (input) input.value = '';
    appendLog('ℹ️ Токен видалено.', 'info');
}

async function triggerWorkflow() {
    if (!githubToken) {
        appendLog('❌ Спочатку введіть GitHub Token.', 'err');
        return;
    }

    const source   = document.getElementById('source-select')?.value || 'both';
    const interval = document.getElementById('interval-slider')?.value || '0';
    const duration = document.getElementById('duration-input')?.value || '1';

    appendLog(`⚡ Запускаємо парсер (${source}, інтервал: ${interval}хв, тривалість: ${duration}год)…`, 'info');

    try {
        const resp = await fetch(`${API_BASE}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ref: BRANCH,
                inputs: {
                    source:            source,
                    override_interval: String(interval),
                    override_duration: String(duration),
                }
            })
        });

        if (resp.status === 204) {
            appendLog(`✅ Workflow запущено успішно! Перевірте: ${ACTIONS_URL}`, 'ok');
        } else {
            const data = await resp.json().catch(() => ({}));
            appendLog(`❌ Помилка ${resp.status}: ${data.message || 'unknown error'}`, 'err');
        }
    } catch (e) {
        appendLog(`❌ Мережева помилка: ${e.message}`, 'err');
    }
}

async function refreshNow() {
    appendLog('🔄 Перезавантажуємо дані…', 'info');
    await refreshAll();
    appendLog('✅ Дані оновлено.', 'ok');
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
}

function setKv(id, value, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value ?? '—';
    if (colorClass) el.className = `kv-val ${colorClass}`;
}

function appendLog(msg, type = 'info') {
    const log = document.getElementById('action-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString('uk-UA')}] ${msg}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

function formatRelative(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'щойно';
    if (m < 60) return `${m} хв тому`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} год тому`;
    return `${Math.floor(h / 24)} дн тому`;
}

function formatFull(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
