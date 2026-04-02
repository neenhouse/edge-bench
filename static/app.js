// EdgeBench — app.js

const WORKLOADS = [
  { id: 'noop', label: 'No-op' },
  { id: 'kv-read', label: 'KV Read' },
  { id: 'kv-write', label: 'KV Write' },
  { id: 'compute', label: 'Compute' },
  { id: 'json', label: 'JSON Parse' },
];

const RUN_COUNT = 20;
const MAX_STORED_RUNS = 3;
const STORAGE_KEY = 'edgebench_runs';

let selectedWorkload = 'noop';
let isRunning = false;
let currentResults = [];
let detectedRegion = 'detecting…';

// ── DOM refs ──

const regionNameEl = document.getElementById('region-name');
const coldStartBadge = document.getElementById('cold-start-badge');
const runBtn = document.getElementById('run-btn');
const barsContainer = document.getElementById('bars-container');
const emptyState = document.getElementById('empty-state');
const prevRunsToggle = document.getElementById('prev-runs-toggle');
const prevRunsSection = document.getElementById('prev-runs-section');
const prevRunsList = document.getElementById('prev-runs-list');

// Stat cells
const statCells = {
  p50: document.getElementById('stat-p50'),
  p95: document.getElementById('stat-p95'),
  p99: document.getElementById('stat-p99'),
  min: document.getElementById('stat-min'),
  max: document.getElementById('stat-max'),
  mean: document.getElementById('stat-mean'),
};

// ── Workload buttons ──

const workloadBtns = document.getElementById('workload-btns');
WORKLOADS.forEach(({ id, label }) => {
  const btn = document.createElement('button');
  btn.className = 'workload-btn' + (id === selectedWorkload ? ' selected' : '');
  btn.textContent = label;
  btn.dataset.workload = id;
  btn.addEventListener('click', () => {
    if (isRunning) return;
    selectedWorkload = id;
    workloadBtns.querySelectorAll('.workload-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
  workloadBtns.appendChild(btn);
});

// ── Stats ──

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
  };
}

function fmt(ms) {
  if (ms === undefined || ms === null || isNaN(ms)) return '—';
  return ms.toFixed(1) + 'ms';
}

function updateStats(values) {
  if (values.length === 0) {
    Object.values(statCells).forEach(el => {
      el.textContent = '—';
      el.classList.add('empty');
    });
    return;
  }
  const stats = computeStats(values);
  Object.entries(statCells).forEach(([key, el]) => {
    el.textContent = fmt(stats[key]);
    el.classList.remove('empty');
  });
}

// ── Bar chart ──

function buildBars() {
  barsContainer.innerHTML = '';
  emptyState.style.display = 'none';

  for (let i = 0; i < RUN_COUNT; i++) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.id = `bar-${i}`;

    const idx = document.createElement('span');
    idx.className = 'bar-index';
    idx.textContent = i + 1;

    const track = document.createElement('div');
    track.className = 'bar-track';

    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.id = `bar-fill-${i}`;
    track.appendChild(fill);

    const ms = document.createElement('span');
    ms.className = 'bar-ms';
    ms.id = `bar-ms-${i}`;
    ms.textContent = '…';

    row.appendChild(idx);
    row.appendChild(track);
    row.appendChild(ms);
    barsContainer.appendChild(row);
  }
}

function updateBar(index, elapsed, maxElapsed) {
  const row = document.getElementById(`bar-${index}`);
  const fill = document.getElementById(`bar-fill-${index}`);
  const msEl = document.getElementById(`bar-ms-${index}`);

  if (!row || !fill || !msEl) return;

  const pct = maxElapsed > 0 ? Math.max(1, (elapsed / maxElapsed) * 100) : 1;
  const isSlowBar = elapsed > maxElapsed * 0.6;

  fill.style.width = pct + '%';
  fill.className = 'bar-fill ' + (isSlowBar ? 'slow' : 'fast');
  msEl.textContent = fmt(elapsed);

  // Animate in
  requestAnimationFrame(() => {
    row.classList.add('visible');
  });
}

function refreshBars(results) {
  const max = Math.max(...results, 1);
  results.forEach((v, i) => updateBar(i, v, max));
}

// ── Detect region ──

async function detectRegion() {
  try {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetch('/api/ping');
      if (res.ok) {
        const data = await res.json();
        if (data.region) results.push(data.region);
      }
    }
    if (results.length > 0) {
      detectedRegion = results[0];
      regionNameEl.textContent = detectedRegion;
      highlightActiveRegion(detectedRegion);
    }
  } catch {
    regionNameEl.textContent = 'unknown';
  }
}

// ── Region map highlight ──

function highlightActiveRegion(region) {
  // Map region string to approximate node id
  const nodes = document.querySelectorAll('.region-node');
  nodes.forEach(node => node.classList.remove('active'));

  const lower = region.toLowerCase();
  let matchId = null;

  if (lower.includes('us-east') || lower.includes('us_east') || lower === 'iad' || lower === 'ewr' || lower === 'atl' || lower === 'bos') {
    matchId = 'region-us-east';
  } else if (lower.includes('us-west') || lower.includes('us_west') || lower === 'sjc' || lower === 'sea' || lower === 'lax') {
    matchId = 'region-us-west';
  } else if (lower.includes('eu') || lower.includes('europe') || lower === 'fra' || lower === 'ams' || lower === 'cdg' || lower === 'lhr') {
    matchId = 'region-eu-west';
  } else if (lower.includes('ap') || lower.includes('asia') || lower === 'sin' || lower === 'nrt' || lower === 'syd' || lower === 'hkg') {
    matchId = 'region-ap';
  } else if (lower.includes('sa') || lower.includes('south-america') || lower === 'gru') {
    matchId = 'region-sa';
  } else if (lower === 'local') {
    matchId = 'region-us-east'; // default for local dev
  }

  if (matchId) {
    const node = document.getElementById(matchId);
    if (node) node.classList.add('active');
  }
}

// ── Benchmark run ──

async function runBenchmark() {
  if (isRunning) return;
  isRunning = true;
  runBtn.disabled = true;
  runBtn.classList.add('running');
  runBtn.textContent = 'Running…';
  coldStartBadge.classList.remove('visible');

  buildBars();
  const elapsed = [];

  for (let i = 0; i < RUN_COUNT; i++) {
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/bench/${selectedWorkload}`);
      await res.json();
    } catch {
      // still record timing
    }
    const t1 = performance.now();
    const ms = t1 - t0;
    elapsed.push(ms);
    currentResults = [...elapsed];

    // Update bar for this request
    const maxSoFar = Math.max(...elapsed, 1);
    elapsed.forEach((v, idx) => updateBar(idx, v, maxSoFar));

    // Update stats live
    updateStats(elapsed);
  }

  // Cold start detection: if first request is >2x the median
  const stats = computeStats(elapsed);
  if (elapsed[0] > stats.p50 * 2) {
    coldStartBadge.classList.add('visible');
  }

  // Store run
  storeRun(selectedWorkload, elapsed);
  renderPrevRuns();

  isRunning = false;
  runBtn.disabled = false;
  runBtn.classList.remove('running');
  runBtn.textContent = 'Run Benchmark';
}

runBtn.addEventListener('click', runBenchmark);

// ── Local storage ──

function loadRuns() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function storeRun(workload, elapsed) {
  const runs = loadRuns();
  const stats = computeStats(elapsed);
  runs.unshift({
    workload,
    region: detectedRegion,
    timestamp: Date.now(),
    elapsed,
    stats,
  });
  // Keep last 3
  const trimmed = runs.slice(0, MAX_STORED_RUNS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function renderPrevRuns() {
  const runs = loadRuns();

  if (runs.length === 0) {
    prevRunsList.innerHTML = '<div class="no-prev-runs">No previous runs yet.</div>';
    return;
  }

  prevRunsList.innerHTML = '';
  runs.forEach((run, i) => {
    if (i === 0) return; // skip current run
    const item = document.createElement('div');
    item.className = 'prev-run-item';

    const when = new Date(run.timestamp);
    const timeStr = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      <span class="prev-run-meta">${run.workload} · ${run.region} · ${timeStr}</span>
      <span class="prev-run-stats">p50: ${fmt(run.stats.p50)} · p95: ${fmt(run.stats.p95)} · mean: ${fmt(run.stats.mean)}</span>
    `;
    prevRunsList.appendChild(item);
  });

  if (runs.length <= 1) {
    prevRunsList.innerHTML = '<div class="no-prev-runs">No previous runs to compare.</div>';
  }
}

// ── Previous runs toggle ──

prevRunsToggle.addEventListener('click', () => {
  prevRunsToggle.classList.toggle('open');
  prevRunsSection.classList.toggle('open');
});

// ── Init ──

function init() {
  // Show empty state
  emptyState.style.display = 'block';
  barsContainer.innerHTML = '';

  // Reset stats
  updateStats([]);

  // Render previous runs
  renderPrevRuns();

  // Detect region
  detectRegion();
}

init();
