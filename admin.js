const API_BASE = "https://staff-portal-proxy.mdrobiulislam.workers.dev";

const apiStatus = document.getElementById("apiStatus");
const uploadBtn = document.getElementById("uploadBtn");
const resultBox = document.getElementById("resultBox");
const csvFileInput = document.getElementById("csvFile");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const uploadMonthInput = document.getElementById("uploadMonth");
const uploadedByInput = document.getElementById("uploadedBy");

let adminSession = null;
let dashboardMonth = "";
let dashboardData = [];

function requireAdminSession() {
  const raw = localStorage.getItem("staffPortalAdmin");
  if (!raw) {
    window.location.href = "index.html";
    return false;
  }

  try {
    adminSession = JSON.parse(raw);
  } catch (err) {
    localStorage.removeItem("staffPortalAdmin");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

async function checkApi() {
  try {
    const res = await fetch(`${API_BASE}?action=health`);
    const data = await res.json();
    if (data.ok) {
      apiStatus.textContent = `API: Online (${data.version})`;
    } else {
      apiStatus.textContent = "API: Error";
    }
  } catch (err) {
    apiStatus.textContent = "API: Offline";
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = err => reject(err);
    reader.readAsText(file);
  });
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

async function postJson(payload) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

function getAdminLoginId() {
  return (
    adminSession?.login_id ||
    adminSession?.admin?.login_id ||
    adminSession?.staff?.login_id ||
    uploadedByInput?.value?.trim() ||
    "ADMIN"
  );
}

function isRealCsvFile(file) {
  if (!file) return false;
  const name = String(file.name || "").toLowerCase().trim();
  return name.endsWith(".csv") && !name.endsWith(".csv.xlsx") && !name.endsWith(".csv.xls");
}

async function uploadCsv() {
  const uploadMonth = uploadMonthInput?.value?.trim() || "";
  const uploadedBy = uploadedByInput?.value?.trim() || "ADMIN";
  const file = csvFileInput?.files?.[0];

  if (!uploadMonth) {
    alert("Please select upload month");
    return;
  }

  if (!file) {
    alert("Please choose a CSV file first");
    return;
  }

  if (!isRealCsvFile(file)) {
    resultBox.textContent = "❌ Upload failed\n\nPlease upload a real .csv file only.";
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";
  resultBox.textContent = "Sending to backend... please wait.";

  try {
    const csvText = await readFileAsText(file);

    let uploadData = null;
    let uploadErr = null;

    try {
      uploadData = await postJson({
        action: "importScheduleCsv",
        upload_month: uploadMonth,
        uploaded_by: uploadedBy,
        file_name: file.name,
        csv_text: csvText
      });
    } catch (err) {
      uploadErr = err;
    }

    if (uploadData?.ok) {
      resultBox.textContent = "✅ Upload successful\n\n" + JSON.stringify(uploadData, null, 2);
      await refreshPerformanceArea();
      return;
    }

    const uploadErrMsg = String(uploadErr?.message || "");
    const uploadDataErrMsg =
      String(uploadData?.error || "") + " " +
      String(uploadData?.message || "") + " " +
      String(uploadData?.status || "") + " " +
      String(uploadData?.http_code || "");

    const combinedErrMsg = (uploadErrMsg + " " + uploadDataErrMsg).toLowerCase();

    const shouldVerify =
      !uploadData ||
      combinedErrMsg.includes("524") ||
      combinedErrMsg.includes("timeout") ||
      combinedErrMsg.includes("timed out") ||
      combinedErrMsg.includes("the operation was canceled") ||
      combinedErrMsg.includes("failed to fetch");

    if (shouldVerify) {
      resultBox.textContent = "Upload timed out or returned no final response.\nChecking whether rows were still saved...";

      try {
        const verifyData = await postJson({
          action: "verifyLastScheduleUpload",
          upload_month: uploadMonth,
          file_name: file.name
        });

        if (verifyData?.ok && Number(verifyData?.saved_rows || 0) > 0) {
          resultBox.textContent =
            "✅ Upload completed successfully\n\n" +
            JSON.stringify({
              ok: true,
              message: "Upload completed successfully after timeout check.",
              upload_month: verifyData.upload_month || uploadMonth,
              file_name: verifyData.file_name || file.name,
              batch_id: verifyData.batch_id || "",
              saved_rows: verifyData.saved_rows || 0
            }, null, 2);

          await refreshPerformanceArea();
          return;
        }
      } catch (verifyErr) {
        // continue
      }
    }

    if (uploadData) {
      resultBox.textContent =
        "❌ Upload failed\n\n" +
        JSON.stringify(uploadData, null, 2) +
        "\n\nIf this shows error code 524, the request timed out before the final response came back.";
    } else {
      resultBox.textContent = "❌ Upload failed\n\n" + (uploadErr?.message || "Upload failed");
    }
  } catch (err) {
    resultBox.textContent = "❌ Upload failed\n\n" + (err?.message || err);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Schedule CSV";
  }
}

function logoutAdmin() {
  localStorage.removeItem("staffPortalAdmin");
  window.location.href = "index.html";
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtScore(value) {
  return toNum(value, 0).toFixed(2);
}

function getRatingClass(label) {
  const x = String(label || "").toLowerCase();
  if (x.includes("crucial")) return "rating-highest";
  if (x.includes("independent")) return "rating-high";
  if (x.includes("extra effort")) return "rating-mid";
  if (x.includes("meet")) return "rating-ok";
  return "rating-low";
}

function ensurePerformanceUi() {
  if (document.getElementById("performanceWrap")) return;

  const page = document.querySelector(".card");
  if (!page) return;

  const wrap = document.createElement("div");
  wrap.id = "performanceWrap";
  wrap.innerHTML = `
    <style>
      #performanceWrap .admin-section{margin-top:18px}
      #performanceWrap .grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      #performanceWrap .grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      #performanceWrap .two-col{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,0.95fr);gap:18px}
      #performanceWrap .toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:end}
      #performanceWrap .toolbar .field{flex:0 0 auto}
      #performanceWrap .toolbar .field.wide{min-width:260px;flex:1 1 260px}
      #performanceWrap .score-card{
        border:1px solid #dbe4f0;
        border-radius:16px;
        padding:16px;
        background:#ffffff;
        box-shadow:0 2px 10px rgba(15,23,42,.04)
      }
      #performanceWrap .score-card .label{
        display:block;
        font-size:13px;
        color:#6b7280;
        margin-bottom:8px;
        font-weight:600
      }
      #performanceWrap .score-card strong{
        font-size:18px;
        line-height:1.15;
        color:#0f172a
      }
      #performanceWrap .mini-note{
        font-size:12px;
        color:#475569;
        margin-top:8px;
        line-height:1.45
      }
      #performanceWrap .table-wrap{
        overflow:auto;
        border:1px solid #dbe4f0;
        border-radius:16px;
        background:#fff
      }
      #performanceWrap table{
        width:100%;
        border-collapse:collapse;
        min-width:760px
      }
      #performanceWrap th,
      #performanceWrap td{
        padding:12px 14px;
        border-bottom:1px solid #eef2f7;
        text-align:left;
        font-size:14px;
        vertical-align:top;
        color:#1f2937
      }
      #performanceWrap th{
        position:sticky;
        top:0;
        background:#f8fbff;
        z-index:1;
        font-weight:800;
        color:#0f172a
      }
      #performanceWrap .row-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap
      }
      #performanceWrap .small-btn{
        padding:9px 13px;
        border:0;
        border-radius:12px;
        cursor:pointer;
        font-weight:700
      }
      #performanceWrap .ghost-btn{
        background:#e9efff;
        color:#3346b4
      }
      #performanceWrap .save-btn{
        background:#0f1838;
        color:#fff
      }
      #performanceWrap .secondary-btn{
        background:#eef2f7;
        color:#0f172a
      }
      #performanceWrap .field label{
        display:block;
        font-size:13px;
        font-weight:800;
        color:#0f172a;
        margin-bottom:8px;
        line-height:1.35;
        white-space:normal;
        word-break:break-word
      }
      #performanceWrap input[type="text"],
      #performanceWrap input[type="number"],
      #performanceWrap input[type="month"],
      #performanceWrap select{
        width:100%;
        padding:11px 12px;
        border:1px solid #cfd8e3;
        border-radius:12px;
        background:#fff;
        color:#111827;
        font-size:14px
      }
      #performanceWrap .kpi-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
        margin-top:4px
      }
      #performanceWrap .kpi-grid .field{
        min-width:0
      }
      #performanceWrap .kpi-grid .field label{
        min-height:38px
      }
      #performanceWrap .rating-chip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:6px 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:800;
        line-height:1.2;
        color:#0f172a
      }
      #performanceWrap .rating-highest{background:#dcfce7;color:#166534}
      #performanceWrap .rating-high{background:#dbeafe;color:#1d4ed8}
      #performanceWrap .rating-mid{background:#fef3c7;color:#92400e}
      #performanceWrap .rating-ok{background:#ede9fe;color:#5b21b6}
      #performanceWrap .rating-low{background:#fee2e2;color:#b91c1c}
      #performanceWrap .leader-name{
        font-weight:800;
        color:#0f172a
      }
      #performanceWrap .leader-sub{
        font-size:12px;
        color:#64748b;
        margin-top:2px
      }
      #performanceWrap pre{
        white-space:pre-wrap;
        word-break:break-word;
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:14px;
        padding:12px;
        color:#0f172a
      }
      @media (max-width: 1100px){
        #performanceWrap .two-col{grid-template-columns:1fr}
      }
      @media (max-width: 920px){
        #performanceWrap .grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}
        #performanceWrap .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
      @media (max-width: 640px){
        #performanceWrap .grid-3,
        #performanceWrap .grid-4,
        #performanceWrap .kpi-grid{
          grid-template-columns:1fr
        }
      }
    </style>

    <div class="panel admin-section">
      <div class="panel-title-row">
        <h3>Performance Dashboard</h3>
      </div>

      <div class="toolbar">
        <div class="field">
          <label for="dashboardMonth">Score Month</label>
          <input type="month" id="dashboardMonth" />
        </div>
        <div class="field">
          <button type="button" class="small-btn secondary-btn" id="refreshDashboardBtn">Refresh Dashboard</button>
        </div>
        <div class="field wide">
          <label for="staffSearchInput">Quick Search</label>
          <input type="text" id="staffSearchInput" placeholder="Search by name / login id / team" />
        </div>
      </div>

      <div class="grid-4 admin-section" id="topSummaryCards">
        <div class="score-card"><span class="label">Staff Count</span><strong id="sumStaffCount">0</strong></div>
        <div class="score-card"><span class="label">Average Attendance</span><strong id="sumAttendanceAvg">0.00</strong></div>
        <div class="score-card"><span class="label">Average KPI</span><strong id="sumKpiAvg">0.00</strong></div>
        <div class="score-card"><span class="label">Average Final Score</span><strong id="sumFinalAvg">0.00</strong></div>
      </div>

      <div class="two-col admin-section">
        <div class="panel" style="margin:0">
          <div class="panel-title-row">
            <h3>Monthly Leaderboard</h3>
            <span class="mini-pill" id="leaderboardMonthTag">-</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Staff</th>
                  <th>Team</th>
                  <th>Attendance</th>
                  <th>KPI</th>
                  <th>Final</th>
                  <th>Rating</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="leaderboardBody">
                <tr><td colspan="8">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel" style="margin:0">
          <div class="panel-title-row">
            <h3>Admin KPI Input</h3>
          </div>

          <div class="field">
            <label for="kpiStaffSelect">Select Staff</label>
            <select id="kpiStaffSelect"></select>
          </div>

          <div class="kpi-grid">
            <div class="field">
              <label for="kpiLeadership">L_Leadership</label>
              <input type="number" id="kpiLeadership" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiEffectiveness">E_Effectiveness</label>
              <input type="number" id="kpiEffectiveness" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiProblemSolving">P_ProblemSolving</label>
              <input type="number" id="kpiProblemSolving" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiCommunication">C_Communication</label>
              <input type="number" id="kpiCommunication" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiProductivity">PR_Productivity</label>
              <input type="number" id="kpiProductivity" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiInitiative">I_Initiative</label>
              <input type="number" id="kpiInitiative" min="0" max="5" step="0.1" value="0" />
            </div>
            <div class="field">
              <label for="kpiPenalty">Penalty</label>
              <input type="number" id="kpiPenalty" min="0" max="5" step="0.1" value="0" />
            </div>
          </div>

          <div class="actions" style="margin-top:16px">
            <button type="button" id="saveKpiBtn">Save KPI</button>
          </div>

          <pre id="kpiResultBox">Waiting for KPI action...</pre>
        </div>
      </div>
    </div>
  `;

  page.appendChild(wrap);
}

function getCurrentMonthValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function refreshPerformanceArea() {
  if (!document.getElementById("performanceWrap")) return;
  await loadDashboardData();
}

async function loadDashboardData() {
  const monthInput = document.getElementById("dashboardMonth");
  const leaderboardMonthTag = document.getElementById("leaderboardMonthTag");
  const leaderboardBody = document.getElementById("leaderboardBody");
  const kpiStaffSelect = document.getElementById("kpiStaffSelect");

  dashboardMonth = monthInput?.value?.trim() || getCurrentMonthValue();
  if (monthInput) monthInput.value = dashboardMonth;
  if (leaderboardMonthTag) leaderboardMonthTag.textContent = dashboardMonth;

  if (leaderboardBody) {
    leaderboardBody.innerHTML = `<tr><td colspan="8">Loading...</td></tr>`;
  }

  try {
    const data = await getJson(`${API_BASE}?action=adminPerformanceDashboard&month=${encodeURIComponent(dashboardMonth)}`);
    dashboardData = Array.isArray(data?.rows) ? data.rows : [];

    renderTopSummary(dashboardData);
    renderLeaderboard(dashboardData);
    renderKpiStaffOptions(dashboardData);

  } catch (err) {
    if (leaderboardBody) {
      leaderboardBody.innerHTML = `<tr><td colspan="8">Failed to load dashboard</td></tr>`;
    }
  }
}

function renderTopSummary(rows) {
  const staffCount = rows.length;
  const attAvg = staffCount ? rows.reduce((s, r) => s + toNum(r.attendance_score), 0) / staffCount : 0;
  const kpiAvg = staffCount ? rows.reduce((s, r) => s + toNum(r.kpi_score), 0) / staffCount : 0;
  const finalAvg = staffCount ? rows.reduce((s, r) => s + toNum(r.final_score), 0) / staffCount : 0;

  const el1 = document.getElementById("sumStaffCount");
  const el2 = document.getElementById("sumAttendanceAvg");
  const el3 = document.getElementById("sumKpiAvg");
  const el4 = document.getElementById("sumFinalAvg");

  if (el1) el1.textContent = String(staffCount);
  if (el2) el2.textContent = fmtScore(attAvg);
  if (el3) el3.textContent = fmtScore(kpiAvg);
  if (el4) el4.textContent = fmtScore(finalAvg);
}

function renderLeaderboard(rows) {
  const tbody = document.getElementById("leaderboardBody");
  const searchValue = String(document.getElementById("staffSearchInput")?.value || "").toLowerCase().trim();

  if (!tbody) return;

  let filtered = [...rows];

  if (searchValue) {
    filtered = filtered.filter(r => {
      return (
        String(r.full_name || "").toLowerCase().includes(searchValue) ||
        String(r.staff_id || "").toLowerCase().includes(searchValue) ||
        String(r.login_id || "").toLowerCase().includes(searchValue) ||
        String(r.team || "").toLowerCase().includes(searchValue)
      );
    });
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8">No data found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <div class="leader-name">${escapeHtml(r.full_name || "-")}</div>
        <div class="leader-sub">${escapeHtml(r.login_id || r.staff_id || "-")}</div>
      </td>
      <td>${escapeHtml(r.team || "-")}</td>
      <td>${fmtScore(r.attendance_score)}</td>
      <td>${fmtScore(r.kpi_score)}</td>
      <td><strong>${fmtScore(r.final_score)}</strong></td>
      <td><span class="rating-chip ${getRatingClass(r.rating_label)}">${escapeHtml(r.rating_label || "-")}</span></td>
      <td>
        <div class="row-actions">
          <button class="small-btn ghost-btn" type="button" onclick="fillKpiForm('${escapeHtml(r.staff_id || "")}')">KPI</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderKpiStaffOptions(rows) {
  const select = document.getElementById("kpiStaffSelect");
  if (!select) return;

  select.innerHTML = rows.map(r => `
    <option value="${escapeHtml(r.staff_id || "")}">
      ${escapeHtml(r.full_name || "-")} (${escapeHtml(r.login_id || r.staff_id || "-")})
    </option>
  `).join("");

  if (rows.length) {
    fillKpiForm(rows[0].staff_id);
  }
}

function fillKpiForm(staffId) {
  const row = dashboardData.find(r => String(r.staff_id || "") === String(staffId || ""));
  if (!row) return;

  const select = document.getElementById("kpiStaffSelect");
  if (select) select.value = row.staff_id || "";

  document.getElementById("kpiLeadership").value = toNum(row.L_Leadership || row.leadership || 0);
  document.getElementById("kpiEffectiveness").value = toNum(row.E_Effectiveness || row.effectiveness || 0);
  document.getElementById("kpiProblemSolving").value = toNum(row.P_ProblemSolving || row.problem_solving || 0);
  document.getElementById("kpiCommunication").value = toNum(row.C_Communication || row.communication || 0);
  document.getElementById("kpiProductivity").value = toNum(row.PR_Productivity || row.productivity || 0);
  document.getElementById("kpiInitiative").value = toNum(row.I_Initiative || row.initiative || 0);
  document.getElementById("kpiPenalty").value = toNum(row.Penalty || row.penalty || 0);
}

async function saveKpiData() {
  const kpiResultBox = document.getElementById("kpiResultBox");
  const staffId = document.getElementById("kpiStaffSelect")?.value?.trim() || "";

  if (!staffId) {
    if (kpiResultBox) kpiResultBox.textContent = "Please select a staff first.";
    return;
  }

  const payload = {
    action: "saveKpiEvaluation",
    month: dashboardMonth || getCurrentMonthValue(),
    staff_id: staffId,
    L_Leadership: toNum(document.getElementById("kpiLeadership")?.value),
    E_Effectiveness: toNum(document.getElementById("kpiEffectiveness")?.value),
    P_ProblemSolving: toNum(document.getElementById("kpiProblemSolving")?.value),
    C_Communication: toNum(document.getElementById("kpiCommunication")?.value),
    PR_Productivity: toNum(document.getElementById("kpiProductivity")?.value),
    I_Initiative: toNum(document.getElementById("kpiInitiative")?.value),
    Penalty: toNum(document.getElementById("kpiPenalty")?.value),
    updated_by: getAdminLoginId()
  };

  if (kpiResultBox) {
    kpiResultBox.textContent = "Saving KPI...";
  }

  try {
    const data = await postJson(payload);
    if (kpiResultBox) {
      kpiResultBox.textContent = JSON.stringify(data, null, 2);
    }
    await loadDashboardData();
  } catch (err) {
    if (kpiResultBox) {
      kpiResultBox.textContent = "KPI save failed\n\n" + (err?.message || err);
    }
  }
}

function bindPerformanceEvents() {
  const refreshBtn = document.getElementById("refreshDashboardBtn");
  const searchInput = document.getElementById("staffSearchInput");
  const kpiStaffSelect = document.getElementById("kpiStaffSelect");
  const saveKpiBtn = document.getElementById("saveKpiBtn");
  const dashboardMonthInput = document.getElementById("dashboardMonth");

  if (refreshBtn) {
    refreshBtn.onclick = () => loadDashboardData();
  }

  if (searchInput) {
    searchInput.oninput = () => renderLeaderboard(dashboardData);
  }

  if (kpiStaffSelect) {
    kpiStaffSelect.onchange = () => fillKpiForm(kpiStaffSelect.value);
  }

  if (saveKpiBtn) {
    saveKpiBtn.onclick = () => saveKpiData();
  }

  if (dashboardMonthInput) {
    dashboardMonthInput.onchange = () => loadDashboardData();
  }
}

function initAdminPage() {
  if (!requireAdminSession()) return;

  if (uploadedByInput) {
    uploadedByInput.value = getAdminLoginId();
  }

  if (uploadMonthInput && !uploadMonthInput.value) {
    uploadMonthInput.value = getCurrentMonthValue();
  }

  checkApi();

  if (uploadBtn) {
    uploadBtn.onclick = uploadCsv;
  }

  if (adminLogoutBtn) {
    adminLogoutBtn.onclick = logoutAdmin;
  }

  ensurePerformanceUi();
  bindPerformanceEvents();
  loadDashboardData();
}

window.fillKpiForm = fillKpiForm;

document.addEventListener("DOMContentLoaded", initAdminPage);
