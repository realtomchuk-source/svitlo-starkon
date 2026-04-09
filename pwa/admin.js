/**
 * SSSK Admin Panel JavaScript
 * Reads parser state via GitHub Raw API and triggers workflows via GitHub Actions API.
 * Token is stored in localStorage — never committed to the repo.
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
let healthData    = null;
let todayData     = null;
let githubToken   = localStorage.getItem('sssk_admin_token') || '';
let currentSection = 'dashboard';
let dataSource    = localStorage.getItem('sssk_data_source') || 'remote';

const ALL_GROUPS = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"];

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Local Data Toggle
    const localToggle = document.getElementById('local-data-toggle');
    if (localToggle) {
        localToggle.checked = (dataSource === 'local');
        localToggle.addEventListener('change', (e) => {
            dataSource = e.target.checked ? 'local' : 'remote';
            localStorage.setItem('sssk_data_source', dataSource);
            appendLog(`🔄 Джерело змінено на: ${dataSource.toUpperCase()}`, 'info');
            refreshAll();
        });
    }

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

async function fetchFile(path) {
    // If remote, use GitHub Raw with cache busting
    if (dataSource === 'remote') {
        return await fetch(`${RAW_BASE}/${path}?t=${Date.now()}`).then(r => r.json());
    }
    
    // In local mode, we need to handle cases where the server is started from the project root 
    // or one level above (e.g. from the Antigravity folder).
    // We'll use relative paths to be safer, or detect the prefix.
    
    // Determine the base path prefix (e.g. '/SSSK/' or empty)
    const currentPath = window.location.pathname; // e.g. '/SSSK/pwa/admin.html'
    const pwaIndex = currentPath.indexOf('/pwa/');
    const projectPrefix = pwaIndex !== -1 ? currentPath.substring(0, pwaIndex) : '';
    
    // Construct the local URL: Prefix + Path (e.g. '/SSSK/' + 'pwa/data/today.json')
    const localUrl = `${projectPrefix}/${path}?t=${Date.now()}`;
    
    try {
        console.log(`[Local Fetch] Requesting: ${localUrl}`);
        const resp = await fetch(localUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${localUrl}`);
        return await resp.json();
    } catch (e) {
        console.warn(`Failed to fetch ${path} locally from ${localUrl}:`, e);
        throw e;
    }
}

async function refreshAll() {
    try {
        updateHeaderStatus('loading');
        
        // Fetch core data (Respects Local/Remote toggle)
        const results = await Promise.allSettled([
            fetchFile('parser/data/state.json'),
            fetchFile('pwa/data/history_api.json'),
            fetchFile('pwa/data/today.json'),
            fetchFile('pwa/data/health.json')
        ]);

        parserState = results[0].status === 'fulfilled' ? results[0].value : parserState;
        scheduleData = results[1].status === 'fulfilled' ? results[1].value : scheduleData;
        todayData = results[2].status === 'fulfilled' ? results[2].value : null;
        healthData = results[3].status === 'fulfilled' ? results[3].value : null;

        const todayDateStr = getFormattedDate(0);
        const tomorrowDateStr = getFormattedDate(1);

        // Auto-fallback for Today: if todayData is missing/stale, use scheduleData
        if ((!todayData || todayData.date !== todayDateStr) && scheduleData.length > 0) {
            const matchToday = [...scheduleData].reverse().find(e => e.processed && (e.target_date === todayDateStr || e.date === todayDateStr));
            if (matchToday) {
                console.log('Today match found in history:', matchToday.target_date);
                todayData = {
                    date: matchToday.target_date,
                    mode: matchToday.mode || 'schedule',
                    queues: matchToday.queues,
                    message: matchToday.message || `Графік на ${matchToday.target_date}`
                };
            }
        }

        // 2. Identify Tomorrow's Data
        let tomorrowData = null;
        const matchTomorrow = [...scheduleData].reverse().find(e => e.processed && (e.target_date === tomorrowDateStr || e.date === tomorrowDateStr));
        if (matchTomorrow) {
            console.log('Tomorrow match found in history:', matchTomorrow.target_date);
            tomorrowData = {
                date: matchTomorrow.target_date,
                mode: matchTomorrow.mode || 'schedule',
                queues: matchTomorrow.queues,
                message: matchTomorrow.message || `Графік на ${matchTomorrow.target_date}`
            };
        }

        renderDashboard(tomorrowData);
        renderScheduleGrid(todayData, 'schedule-grid');
        if (tomorrowData) {
            renderScheduleGrid(tomorrowData, 'tomorrow-grid');
        }
        renderHistory();
        
        if (healthData) {
            updateHeaderStatus(healthData.status, healthData.message);
        } else {
            updateHeaderStatus('ok');
        }

        // 4. Update UI labels
        const todayTitle = document.getElementById('schedule-card-title');
        const todayBadge = document.getElementById('schedule-date-badge');
        if (todayData) {
            if (todayTitle) todayTitle.textContent = todayData.message || `АКТУАЛЬНИЙ ГРАФІК НА ${todayData.date}`;
            if (todayBadge) todayBadge.textContent = todayData.date || '—';
        }

        // Update Tomorrow Card UI
        const tomorrowTitle = document.getElementById('tomorrow-card-title');
        const tomorrowBadge = document.getElementById('tomorrow-date-badge');
        if (tomorrowData) {
            if (tomorrowTitle) tomorrowTitle.textContent = tomorrowData.message || `ГРАФІК НА ЗАВТРА (${tomorrowData.date})`;
            if (tomorrowBadge) tomorrowBadge.textContent = tomorrowData.date || '—';
        }

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
    const labels = { 
        ok: '● Система онлайн', 
        loading: '○ Оновлення...', 
        warn: '● Увага', 
        err: '● Помилка даних' 
    };
    pill.textContent = labels[status] || '●';
}

// ─── Render: Dashboard ────────────────────────────────────────────────────────

function renderDashboard(tomorrowData = null) {
    if (!parserState) return;

    // Last run
    setText('stat-last-run', formatRelative(parserState.last_run));
    setText('stat-last-run-sub', formatFull(parserState.last_run));

    // Source mode (Unified site-centric)
    const src = parserState.current_source || 'site';
    setText('stat-source', src === 'site' ? '🌐 Сайт' : src);

    // Schedule count & Latest processing status
    setText('stat-schedules', scheduleData.length);
    
    // Find the actual latest processed for the main display, even if a newer unprocessed exists
    const latestProcessed = [...scheduleData].reverse().find(e => e.processed);
    const latestAny = scheduleData[scheduleData.length - 1];
    
    let subText = latestAny ? `Останній: ${latestAny.target_date || '—'}` : 'Немає даних';
    if (latestAny && !latestAny.processed) {
        subText += ' ⚠️ OCR Помилка';
    }
    setText('stat-schedules-sub', subText);

    // Override
    const overrideActive = parserState.override_until &&
        new Date(parserState.override_until) > new Date();
    setText('stat-override', overrideActive ? '⚡ Активний' : '— Вимкнено');

    // State details
    setKv('kv-last-site',     parserState.last_success_site, 'muted');
    setKv('kv-hash-site',     (parserState.last_site_hash || '—').substring(0, 12) + '…', 'muted');
    setKv('kv-source-mode',   src, 'amber');
    setKv('kv-override-until', parserState.override_until || 'Вимкнено', 'muted');

    // Handle tomorrow card visibility
    const tomorrowCard = document.getElementById('tomorrow-card');
    if (tomorrowCard) {
        tomorrowCard.style.display = tomorrowData ? 'block' : 'none';
    }

    // Handle reference grid (27.03)
    const designRef = scheduleData.find(e => e.target_date === '27.03' || e.date === '27.03');
    if (designRef) {
        renderScheduleGrid(designRef, 'reference-grid', true);
    }

    // Actions link
    const actionsLink = document.getElementById('actions-link');
    if (actionsLink) actionsLink.href = ACTIONS_URL;
    
    // Show OCR debug for the LATEST entry if it failed, but don't show it for older ones
    if (latestAny && !latestAny.processed) {
        showOcrDebug(latestAny);
    } else {
        hideOcrDebug();
    }
}

function showOcrDebug(entry) {
    let debugBox = document.getElementById('ocr-debug-box');
    if (!debugBox) {
        const parent = document.querySelector('.stats-grid');
        if (!parent) return; // safety check
        debugBox = document.createElement('div');
        debugBox.id = 'ocr-debug-box';
        debugBox.className = 'stat-card debug-card';
        debugBox.style.gridColumn = '1 / -1';
        debugBox.style.border = '1px dashed var(--warning)';
        parent.appendChild(debugBox);
    }
    
    debugBox.innerHTML = `
        <h3>⚠️ Помилка обробки останнього графіка</h3>
        <p style="font-size:12px; margin-bottom:10px">Текст був отриманий, але не зміг бути перетворений на таблицю. Перевірте OCR нижче:</p>
        <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; font-family:monospace; font-size:11px; white-space:pre-wrap; max-height:150px; overflow-y:auto">
            ${escHtml(entry.raw_text_summary || 'Порожній текст')}
        </div>
    `;
    debugBox.style.display = 'block';
}

function hideOcrDebug() {
    const debugBox = document.getElementById('ocr-debug-box');
    if (debugBox) debugBox.style.display = 'none';
}

function showDashboardError(msg) {
    setText('stat-last-run', 'Помилка');
    setText('stat-last-run-sub', msg);
}

// ─── Render: Schedule Grid ─────────────────────────────────────────────────────

function renderScheduleGrid(data = todayData, containerId = 'schedule-grid') {
    const grid = document.getElementById(containerId);
    if (!grid) return;

    if (!data || !data.queues) {
        grid.innerHTML = '<div class="schedule-loading">Отримання даних...</div>';
        return;
    }

    grid.innerHTML = '';

    // 1. Add Hour Header Row (00 - 23)
    const headerRow = document.createElement('div');
    headerRow.className = 'queue-row header-row';
    
    const cornerLabel = document.createElement('span');
    cornerLabel.className = 'queue-label header';
    cornerLabel.textContent = 'Год:';
    headerRow.appendChild(cornerLabel);

    for (let i = 0; i < 24; i++) {
        const hCell = document.createElement('div');
        hCell.className = 'hour-header';
        const startStr = String(i).padStart(2, '0') + ':00';
        const endStr = String(i + 1).padStart(2, '0') + ':00';
        hCell.innerHTML = `${startStr}<br>—<br>${endStr}`;
        headerRow.appendChild(hCell);
    }
    grid.appendChild(headerRow);

    // 2. Add Queue Rows
    ALL_GROUPS.forEach(group => {
        const row = document.createElement('div');
        row.className = 'queue-row';

        const label = document.createElement('span');
        label.className = 'queue-label';
        label.textContent = group;
        row.appendChild(label);

        const bits = data.queues[group] || '1'.repeat(24);
        for (let i = 0; i < 24; i++) {
            const cell = document.createElement('div');
            const isOn = bits[i] === '1';
            cell.className = 'hour-cell ' + (isOn ? 'on' : 'off');
            cell.title = `${String(i).padStart(2, '0')}:00 — ${isOn ? 'Світло є' : 'Світла немає'}`;
            row.appendChild(cell);
        }

        grid.appendChild(row);
    });
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
        
        const description = entry.change_desc || (entry.processed ? 'Змін не виявлено' : 'Помилка OCR');

        tr.innerHTML = `
            <td>${formatFull(entry.timestamp)}</td>
            <td>${entry.target_date || '—'} </td>
            <td>${srcBadge}</td>
            <td>${typeBadge}</td>
            <td style="color:var(--text-muted);font-size:11px;max-width:350px;line-height:1.2"
                title="${escHtml(entry.change_desc)}">
                <span style="color:${entry.processed ? 'var(--text-primary)' : 'var(--warning)'};font-weight:500">
                    ${entry.processed ? '✓' : '⚠'} ${escHtml(description)}
                </span>
            </td>
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
        dot.className = 'timeline-dot' + (entry.is_update ? ' update' : '') + (entry.processed ? '' : ' error');
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
                'X-GitHub-Api-Version': '2022-11-28',
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
            appendLog(`✅ Workflow успішно ініційовано! Очікуйте оновлення (1-3 хв).`, 'ok');
            updateHeaderStatus('loading', 'Парсер запускається...');
        } else {
            const data = await resp.json().catch(() => ({}));
            let errorMsg = data.message || 'unknown error';
            if (resp.status === 422) {
                errorMsg = "Workflow не знайдено або відсутній trigger 'workflow_dispatch'. Перевірте назву файлу та гілку.";
            }
            appendLog(`❌ Помилка ${resp.status}: ${errorMsg}`, 'err');
        }
    } catch (e) {
        appendLog(`❌ Мережева помилка: ${e.message}`, 'err');
    }
}

async function refreshNow() {
    appendLog('🔄 Форсоване оновлення даних…', 'info');
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

function getFormattedDate(offsetDays = 0) {
    const d = new Date();
    if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
}
