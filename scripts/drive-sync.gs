/**
 * Google Apps Script — daily Drive push into QA Control Center.
 *
 * Does not need a Google Cloud OAuth client. Runs as the Sumimedical user
 * who installs the script and can read the QA Drive folder.
 *
 * Setup:
 * 1. https://script.google.com → New project
 * 2. Paste this file into Code.gs
 * 3. Project Settings → Script properties:
 *      API_URL     = https://api-production-f1d3.up.railway.app
 *      CRON_SECRET = (same value as Railway CRON_SECRET)
 *      FOLDER_ID   = 1hCe3QBPraJEvt6H60KcCOiNIFzG6zdL-
 * 4. Run syncDriveOnce once and accept Drive + external URL permissions
 * 5. Triggers → Add trigger → syncDriveOnce → Time driven → Day timer → 6:00–7:00
 *    (Apps Script uses the script timezone; set it to America/Bogota in Project Settings)
 */

var MAX_FILES_PER_RUN = 8;
var MAX_BYTES = 20 * 1024 * 1024;
var PARSEABLE = /\.(xlsx|xls|csv|pdf|docx|json)$/i;
var JUNK_DIR = /(^|\/)(node_modules|\.git|\.svn|\.venv|dist|build|coverage|\.next|__pycache__|\.turbo)(\/|$)/i;
var JUNK_NAME = /^(\.ds_store|thumbs\.db|desktop\.ini|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;

var SHEET_MIME = "application/vnd.google-apps.spreadsheet";
var DOC_MIME = "application/vnd.google-apps.document";
var XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
var DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function syncDriveOnce() {
  var props = PropertiesService.getScriptProperties();
  var apiUrl = String(props.getProperty("API_URL") || "").replace(/\/$/, "");
  var secret = props.getProperty("CRON_SECRET");
  var folderId = props.getProperty("FOLDER_ID") || "1hCe3QBPraJEvt6H60KcCOiNIFzG6zdL-";
  if (!apiUrl || !secret) {
    throw new Error("Set API_URL and CRON_SECRET in Script properties");
  }

  var lastMs = Number(props.getProperty("LAST_SYNC_MS") || "0");
  var files = [];
  collectFiles_(DriveApp.getFolderById(folderId), "", files);
  files.sort(function (a, b) {
    return a.modified.getTime() - b.modified.getTime();
  });

  var headers = { Authorization: "Bearer " + secret };
  var begin = UrlFetchApp.fetch(apiUrl + "/api/v1/integrations/google/ingest/begin", {
    method: "post",
    headers: headers,
    muteHttpExceptions: true,
  });
  if (begin.getResponseCode() >= 300) {
    throw new Error("begin failed: " + begin.getResponseCode() + " " + begin.getContentText());
  }
  var runId = JSON.parse(begin.getContentText()).id;
  var sent = 0;
  var advancedTo = lastMs;

  for (var i = 0; i < files.length && sent < MAX_FILES_PER_RUN; i++) {
    var item = files[i];
    var modifiedMs = item.modified.getTime();
    if (lastMs && modifiedMs <= lastMs) continue;
    if (item.file.getSize() > MAX_BYTES) continue;

    var blob = toBlob_(item.file);
    if (!blob) continue;

    var res = UrlFetchApp.fetch(apiUrl + "/api/v1/integrations/google/ingest", {
      method: "post",
      headers: headers,
      payload: {
        file: blob,
        runId: runId,
        fileName: blob.getName(),
        sourceFileId: item.file.getId(),
        sourceUrl: item.file.getUrl(),
        sourceModifiedAt: item.modified.toISOString(),
        path: item.path,
      },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) {
      throw new Error("ingest failed for " + item.path + ": " + res.getResponseCode() + " " + res.getContentText());
    }
    sent += 1;
    if (modifiedMs > advancedTo) advancedTo = modifiedMs;
  }

  UrlFetchApp.fetch(apiUrl + "/api/v1/integrations/google/ingest/finish", {
    method: "post",
    contentType: "application/json",
    headers: headers,
    payload: JSON.stringify({ runId: runId }),
    muteHttpExceptions: true,
  });

  if (advancedTo > lastMs) props.setProperty("LAST_SYNC_MS", String(advancedTo));
}

function collectFiles_(folder, prefix, out) {
  var folders = folder.getFolders();
  while (folders.hasNext()) {
    var child = folders.next();
    var childPath = prefix ? prefix + "/" + child.getName() : child.getName();
    if (JUNK_DIR.test(childPath)) continue;
    collectFiles_(child, childPath, out);
  }
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var file = iter.next();
    var path = prefix ? prefix + "/" + file.getName() : file.getName();
    if (JUNK_DIR.test(path) || JUNK_NAME.test(file.getName())) continue;
    var mime = file.getMimeType();
    if (mime !== SHEET_MIME && mime !== DOC_MIME && !PARSEABLE.test(file.getName())) continue;
    out.push({ file: file, path: path, modified: file.getLastUpdated() });
  }
}

function toBlob_(file) {
  var mime = file.getMimeType();
  if (mime === SHEET_MIME) {
    return file.getAs(XLSX).setName(file.getName().replace(/\.xlsx$/i, "") + ".xlsx");
  }
  if (mime === DOC_MIME) {
    return file.getAs(DOCX).setName(file.getName().replace(/\.docx$/i, "") + ".docx");
  }
  return file.getBlob();
}
