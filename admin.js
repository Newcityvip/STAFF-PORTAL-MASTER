const API_BASE = "https://script.google.com/macros/s/AKfycbyOaO0Rnsl0QFEA5Q-YZCeABkVzoUk6ttqkDR5RLjqqdNoFqLKptnXZ2iLAIi5xujUp3w/exec";

const apiStatus = document.getElementById("apiStatus");
const uploadBtn = document.getElementById("uploadBtn");
const resultBox = document.getElementById("resultBox");
const csvFileInput = document.getElementById("csvFile");

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

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";
  resultBox.textContent = "Reading CSV file...";

  try {
    const csvText = await readFileAsText(file);

    resultBox.textContent = "Sending to backend...";

    const res = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "importScheduleCsv",
        upload_month: uploadMonth,
        uploaded_by: uploadedBy,
        file_name: file.name,
        csv_text: csvText
      })
    });

    const data = await res.json();
    resultBox.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    resultBox.textContent = "ERROR:\n" + (err?.message || err);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Schedule CSV";
  }
}

uploadBtn.addEventListener("click", uploadCsv);
checkApi();
