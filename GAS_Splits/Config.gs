/**
 * Config.gs - Persistent Cloud Configuration Storage
 */

const CONFIG_SHEET_NAME = "App_Configs";

/**
 * Saves or updates a configuration key-value pair.
 */
function handleSaveAppConfig(p, cb) {
  const ss = getMasterSS();
  if (!ss) return response({ success: false, message: "Master Spreadsheet not found" }, cb);

  let sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET_NAME);
    sheet.appendRow(["Key", "Value", "Last Updated"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f1f5f9");
    sheet.setFrozenRows(1);
  }

  const key = p.key;
  const value = p.value; // Expecting stringified JSON or simple string
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIdx = i + 1;
      break;
    }
  }

  const timestamp = new Date();
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(value);
    sheet.getRange(rowIdx, 3).setValue(timestamp);
  } else {
    sheet.appendRow([key, value, timestamp]);
  }

  return response({ success: true, message: `Config '${key}' saved successfully` }, cb);
}

/**
 * Retrieves a configuration value by key.
 */
function handleGetAppConfig(p, cb) {
  const ss = getMasterSS();
  if (!ss) return response({ success: false, message: "Master Spreadsheet not found" }, cb);

  const sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) return response({ success: false, value: null, message: "Config sheet doesn't exist yet" }, cb);

  const key = p.key;
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return response({ success: true, value: data[i][1] }, cb);
    }
  }

  return response({ success: false, value: null, message: "Key not found" }, cb);
}
