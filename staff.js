const API_BASE = "https://staff-portal-proxy.mdrobiulislam.workers.dev";

const apiStatus = document.getElementById("apiStatus");
const logoutBtn = document.getElementById("logoutBtn");
const checkInBtn = document.getElementById("checkInBtn");
const checkOutBtn = document.getElementById("checkOutBtn");
const resultBox = document.getElementById("resultBox");
const attendanceBox = document.getElementById("attendanceBox");
const attendanceState = document.getElementById("attendanceState");
const shiftStatusPill = document.getElementById("shiftStatusPill");

let currentStaff = null;
let currentShift = null;
let todayLogs = [];

function requireStaffSession() {
  const raw = localStorage.getItem("staffPortalStaff");
  if (!raw) {
    window.location.href = "index.html";
    return false;
  }

  try {
    currentStaff = JSON.parse(raw);
  } catch (err) {
    localStorage.removeItem("staffPortalStaff");
    window.location.href = "index.html";
    return false;
  }

  if (!currentStaff || !currentStaff.login_id) {
    localStorage.removeItem("staffPortalStaff");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

function fillStaffCard() {
  document.getElementById("staffName").textContent = currentStaff.full_name || "-";
  document.getElementById("staffLoginIdView").textContent = currentStaff.login_id || "-";
  document.getElementById("staffTeam").textContent = currentStaff.team || "-";
  document.getElementById("staffRole").textContent = currentStaff.role || "-";
}

async function checkApi() {
  try {
    const res = await fetch(`${API_BASE}?action=health`);
    const data = await res.json();
    apiStatus.textContent = data.ok ? `API: Online (${data.version})` : "API: Error";
  } catch (err) {
    apiStatus.textContent = "API: Offline";
  }
}

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function postJson(payload) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function loadTodayShift() {
  const data = await getJson(`${API_BASE}?action=todayShift&login_id=${encodeURIComponent(currentStaff.login_id)}`);
  if (!data.ok) {
    shiftStatusPill.textContent = "Shift Error";
    resultBox.textContent = JSON.stringify(data, null, 2);
    return;
  }

  currentShift = data.data || {};
  document.getElementById("shiftDate").textContent = currentShift.date || "-";
  document.getElementById("shiftCode").textContent = currentShift.shift_code || "-";
  document.getElementById("shiftStart").textContent = currentShift.scheduled_start || "-";
  document.getElementById("shiftEnd").textContent = currentShift.scheduled_end || "-";

  if (currentShift.is_off_day) {
    shiftStatusPill.textContent = "OFF DAY";
  } else if (currentShift.is_leave_day) {
    shiftStatusPill.textContent = "LEAVE";
  } else {
    shiftStatusPill.textContent = "WORKING DAY";
  }
}

function buildAttendanceSummary(logs) {
  if (!logs || !logs.length) {
    attendanceState.textContent = "No logs yet";
    return "No attendance action found for today.";
  }

  const checkIn = logs.find(x => String(x.action_type || "").toUpperCase() === "CHECK_IN");
  const checkOut = logs.find(x => String(x.action_type || "").toUpperCase() === "CHECK_OUT");

  if (checkIn && checkOut) {
    attendanceState.textContent = "Checked In + Out";
  } else if (checkIn) {
    attendanceState.textContent = "Checked In";
  } else {
    attendanceState.textContent = "No logs yet";
  }

  return JSON.stringify(logs, null, 2);
}

function refreshButtonState() {
  const checkIn = todayLogs.find(x => String(x.action_type || "").toUpperCase() === "CHECK_IN");
  const checkOut = todayLogs.find(x => String(x.action_type || "").toUpperCase() === "CHECK_OUT");

  if (currentShift?.is_off_day || currentShift?.is_leave_day) {
    checkInBtn.disabled = true;
    checkOutBtn.disabled = true;
    return;
  }

  checkInBtn.disabled = !!checkIn;
  checkOutBtn.disabled = !checkIn || !!checkOut;
}

async function loadAttendance() {
  const data = await getJson(`${API_BASE}?action=myAttendance&login_id=${encodeURIComponent(currentStaff.login_id)}`);
  if (!data.ok) {
    attendanceState.textContent = "Load Error";
    attendanceBox.textContent = JSON.stringify(data, null, 2);
    return;
  }

  todayLogs = data.logs || [];
  attendanceBox.textContent = buildAttendanceSummary(todayLogs);
  refreshButtonState();
}

function getDeviceInfo() {
  return navigator.userAgent || "Browser";
}

async function handleCheckIn() {
  checkInBtn.disabled = true;
  resultBox.textContent = "Sending check-in...";
  try {
    const data = await postJson({
      action: "checkIn",
      login_id: currentStaff.login_id,
      source: "STAFF_PORTAL_WEB",
      office_ip: "",
      device_info: getDeviceInfo(),
      remarks: ""
    });

    resultBox.textContent = JSON.stringify(data, null, 2);
    await loadAttendance();
  } catch (err) {
    resultBox.textContent = "ERROR:\n" + (err?.message || err);
  } finally {
    refreshButtonState();
  }
}

async function handleCheckOut() {
  checkOutBtn.disabled = true;
  resultBox.textContent = "Sending check-out...";
  try {
    const data = await postJson({
      action: "checkOut",
      login_id: currentStaff.login_id,
      source: "STAFF_PORTAL_WEB",
      office_ip: "",
      device_info: getDeviceInfo(),
      remarks: ""
    });

    resultBox.textContent = JSON.stringify(data, null, 2);
    await loadAttendance();
  } catch (err) {
    resultBox.textContent = "ERROR:\n" + (err?.message || err);
  } finally {
    refreshButtonState();
  }
}

function logout() {
  localStorage.removeItem("staffPortalStaff");
  window.location.href = "index.html";
}

async function init() {
  if (!requireStaffSession()) return;
  fillStaffCard();
  await checkApi();
  await loadTodayShift();
  await loadAttendance();
}

logoutBtn.addEventListener("click", logout);
checkInBtn.addEventListener("click", handleCheckIn);
checkOutBtn.addEventListener("click", handleCheckOut);

init();
