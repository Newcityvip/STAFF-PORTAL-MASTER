const API_BASE = "https://staff-portal-proxy.mdrobiulislam.workers.dev";

const apiStatus = document.getElementById("apiStatus");
const uploadBtn = document.getElementById("uploadBtn");
const resultBox = document.getElementById("resultBox");
const csvFileInput = document.getElementById("csvFile");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

function requireAdminSession() {
  const raw = localStorage.getItem("staffPortalAdmin");
  if (!raw) {
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

async function uploadCsv() {
  const uploadMonth = document.getElementById("uploadMonth").value.trim();
  const uploadedBy = document.getElementById("uploadedBy").value.trim() || "ADMIN";
  const file = csvFileInput.files[0];

  if (!uploadMonth) {
    alert("Please select upload month");
    return;
  }

  if (!file) {
    alert("Please choose a CSV file first");
    return;
  }

  const lowerName = String(file.name || "").toLowerCase().trim();
  if (!lowerName.endsWith(".csv") || lowerName.endsWith(".csv.xlsx") || lowerName.endsWith(".csv.xls")) {
    resultBox.textContent = "❌ Upload failed\n\nPlease upload a real .csv file only.";
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";
  resultBox.textContent = "Reading CSV file...";

  try {
    const csvText = await readFileAsText(file);
    resultBox.textContent = "Sending to backend... please wait.";

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
    const shouldVerify = !uploadData || uploadErrMsg.includes("524") || uploadErrMsg.includes("timeout") || uploadErrMsg.includes("timed out") || uploadErrMsg.includes("Failed to fetch");

    if (shouldVerify) {
      resultBox.textContent = "Upload timed out or returned no final response.\nChecking whether rows were still saved...";

      try {
        const verifyData = await postJson({
          action: "verifyLastScheduleUpload",
          upload_month: uploadMonth,
          file_name: file.name
        });

        if (verifyData?.ok && Number(verifyData?.saved_rows || 0) > 0) {
          resultBox.textContent = "✅ Upload completed successfully\n\n" + JSON.stringify({
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
      }
    }

    if (uploadData) {
      resultBox.textContent = "❌ Upload failed\n\n" + JSON.stringify(uploadData, null, 2);
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

if (requireAdminSession()) {
  uploadBtn.addEventListener("click", uploadCsv);
  adminLogoutBtn.addEventListener("click", logoutAdmin);
  checkApi();
}
