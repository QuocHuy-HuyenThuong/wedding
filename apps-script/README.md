# Wedding response sheet

The workbook template has separate `LoiChuc` and `XacNhanThamDu` tabs. Apps Script writes into those tabs after the `.xlsx` is converted to Google Sheets.

1. Upload the `.xlsx` template to Google Drive and open/convert it as a Google spreadsheet.
2. In that spreadsheet, choose **Extensions > Apps Script** and replace the project code with the current `Code.gs` from this folder.
3. Select and run `setup()` once. Approve spreadsheet access; this stores the spreadsheet ID and creates the two tabs if needed.
4. Open **Deploy > Manage deployments**, edit the Web app deployment, choose **New version**, set **Execute as** to your account and access to **Anyone**, then deploy. Keep the resulting `/exec` URL in sync with `window.WEDDING_APPS_SCRIPT_URL` in `js/local-runtime-fixes.js`.
5. Reload the invitation. Wishes are sent with `POST action=wish`, and `GET action=comments` reads them for the guestbook. RSVP uses `POST action=rsvp`. Writes include a short-lived request ID so the page can verify that Apps Script appended the row before showing success.

Apps Script is designed to write to Google Sheets. If the final deliverable must remain an `.xlsx` file, export the created Google spreadsheet from Sheets after collecting responses.
