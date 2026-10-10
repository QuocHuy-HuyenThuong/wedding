const SHEET_ID_PROPERTY = "WEDDING_RESPONSES_SPREADSHEET_ID";
const WISHES_TAB = "LoiChuc";
const RSVPS_TAB = "XacNhanThamDu";

function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Open the imported response template and run setup() from its bound Apps Script project.");
  PropertiesService.getScriptProperties().setProperty(SHEET_ID_PROPERTY, spreadsheet.getId());
  ensureSheet_(spreadsheet, WISHES_TAB, ["Thời gian", "Mã thiệp", "Tên khách", "Lời chúc", "Mã khách mời"]);
  ensureSheet_(spreadsheet, RSVPS_TAB, ["Thời gian", "Mã thiệp", "Tên khách", "Tham dự", "Số khách", "Câu trả lời bổ sung", "Lời nhắn", "Mã khách mời"]);
  Logger.log("Spreadsheet created: " + spreadsheet.getUrl());
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === "verify") {
    const requestId = clean_(params.requestId, 120);
    const stored = requestId && CacheService.getScriptCache().get("wedding-write:" + requestId) === "ok";
    return jsonpOrJson_(params.callback, { ok: Boolean(stored) });
  }
  if (params.action !== "comments") return json_({ ok: true, service: "wedding-responses" });

  const comments = readComments_(clean_(params.slug, 100));
  return jsonpOrJson_(params.callback, { comments: comments });
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const action = clean_(params.action, 20);
  const slug = clean_(params.slug, 100);
  if (!slug) return json_({ ok: false, error: "Missing invitation slug" });

  const spreadsheet = getSpreadsheet_();
  if (action === "wish") {
    const name = clean_(params.name, 120);
    const message = clean_(params.message, 2000);
    if (!name || !message) return json_({ ok: false, error: "Name and message are required" });
    ensureSheet_(spreadsheet, WISHES_TAB, ["Thời gian", "Mã thiệp", "Tên khách", "Lời chúc", "Mã khách mời"])
      .appendRow([new Date(), safeCell_(slug), safeCell_(name), safeCell_(message), safeCell_(params.guestCode, 120)]);
    markRequestStored_(params.requestId);
    return json_({ ok: true });
  }

  if (action === "rsvp") {
    const guestCode = clean_(params.guestCode, 120);
    const name = clean_(params.name, 120) || (guestCode ? "Khách theo mã " + guestCode : "");
    const attending = params.attending === "yes" ? "Có" : params.attending === "no" ? "Không" : "";
    if (!name || !attending) return json_({ ok: false, error: "Name and attendance are required" });
    const answers = clean_(params.rsvpAnswers, 4000);
    ensureSheet_(spreadsheet, RSVPS_TAB, ["Thời gian", "Mã thiệp", "Tên khách", "Tham dự", "Số khách", "Câu trả lời bổ sung", "Lời nhắn", "Mã khách mời"])
      .appendRow([
        new Date(),
        safeCell_(slug),
        safeCell_(name),
        attending,
        params.attending === "yes" ? Math.max(1, Math.min(20, Number(params.guestCount) || 1)) : 0,
        safeCell_(answers),
        safeCell_(params.message, 2000),
        safeCell_(guestCode, 120)
      ]);
    markRequestStored_(params.requestId);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "Unknown action" });
}

function markRequestStored_(requestId) {
  const id = clean_(requestId, 120);
  if (id) CacheService.getScriptCache().put("wedding-write:" + id, "ok", 600);
}

function jsonpOrJson_(callback, value) {
  const name = String(callback || "");
  if (name && /^[A-Za-z_$][\w$]{0,80}$/.test(name)) {
    return ContentService.createTextOutput(name + "(" + JSON.stringify(value) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(value);
}

function readComments_(slug) {
  const sheet = getSpreadsheet_().getSheetByName(WISHES_TAB);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1)
    .filter(row => String(row[1]) === slug)
    .reverse()
    .slice(0, 100)
    .map((row, index) => ({
      id: "sheet-" + (row[0] instanceof Date ? row[0].getTime() : index),
      name: String(row[2] || ""),
      message: String(row[3] || ""),
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || "")
    }));
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(SHEET_ID_PROPERTY);
  if (!id) throw new Error("Run setup() once from the bound spreadsheet before deploying the web app.");
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clean_(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLength || 2000);
}

function safeCell_(value, maxLength) {
  const text = clean_(value, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
