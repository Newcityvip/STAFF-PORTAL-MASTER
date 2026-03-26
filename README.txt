STAFF PORTAL ADMIN UPLOAD BUNDLE

FILES INCLUDED
- Code.gs  -> paste into Google Apps Script
- admin.html
- admin.js
- style.css

HOW TO USE

1) APPS SCRIPT
- Open your Apps Script project linked to your Google Sheet
- Replace existing Code.gs with the included Code.gs
- Save
- Deploy > Manage deployments > Edit current web app > New version > Deploy

2) GITHUB PAGES
- Upload these frontend files to your GitHub Pages repo:
  - admin.html
  - admin.js
  - style.css

3) IMPORTANT
- In admin.js, API_BASE is already set to your current Apps Script URL:
  https://script.google.com/macros/s/AKfycbyOaO0Rnsl0QFEA5Q-YZCeABkVzoUk6ttqkDR5RLjqqdNoFqLKptnXZ2iLAIi5xujUp3w/exec

4) OPEN ADMIN PAGE
- After GitHub Pages deploy, open:
  yoursite/admin.html

5) CSV FLOW
- Export roster as CSV
- Upload CSV in admin page
- It writes to:
  - UPLOAD_RAW
  - SCHEDULE_UPLOAD
  - SCHEDULE_MASTER

NOTES
- Only staff already present in STAFF_MASTER will match
- Shift timing should remain managed in SHIFT_RULES
- Current valid shift codes:
  AM, AM1, PM1, PM, OFF, AL
