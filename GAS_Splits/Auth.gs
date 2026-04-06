/**
 * Auth.gs - User Authentication & Profiles
 */

/**
 * 1. USER SIGNUP
 */
function handleSignup(p, cb) {
  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw "No active spreadsheet";
  } catch (e) {
    const files = DriveApp.getFilesByName("Eventora_Master_Data");
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create("Eventora_Master_Data");
    }
  }

  let sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MASTER_SHEET_NAME);
    sheet.appendRow(["User_ID", "Name", "Password", "Folder_ID", "Created_At"]);
  }

  const data = sheet.getDataRange().getValues();
  const exists = data.some(row => row[0] == p.identifier);
  if (exists) return response({ success: false, message: "User already exists" }, cb);

  const rootFolder = DriveApp.getRootFolder();
  let eventoraRoot;
  const folders = rootFolder.getFoldersByName("Eventora_SaaS");
  if (folders.hasNext()) {
    eventoraRoot = folders.next();
  } else {
    eventoraRoot = rootFolder.createFolder("Eventora_SaaS");
  }

  const userFolder = eventoraRoot.createFolder(p.name + "_" + p.identifier);
  sheet.appendRow([p.identifier, p.name, p.password, userFolder.getId(), new Date()]);

  return response({ 
    success: true, 
    user: { name: p.name, identifier: p.identifier, folderId: userFolder.getId() } 
  }, cb);
}

function handleLogin(p, cb) {
  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw "No active spreadsheet";
  } catch (e) {
    const files = DriveApp.getFilesByName("Eventora_Master_Data");
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      return response({ success: false, message: "Master data not found. Please signup first." }, cb);
    }
  }
  
  const sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) return response({ success: false, message: "No users found" }, cb);

  const data = sheet.getDataRange().getValues();
  const userRow = data.find(row => row[0] == p.identifier && row[2] == p.password);

  if (userRow) {
    return response({ 
      success: true, 
      user: { name: userRow[1], identifier: userRow[0], folderId: userRow[3] } 
    }, cb);
  } else {
    return response({ success: false, message: "Invalid credentials" }, cb);
  }
}

function handleGetProfile(p, cb) {
  const identifier = p.identifier;
  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw "err";
  } catch (e) {
    const files = DriveApp.getFilesByName("Eventora_Master_Data");
    if (files.hasNext()) ss = SpreadsheetApp.open(files.next());
  }
  
  if (ss) {
    const sheet = ss.getSheetByName(MASTER_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === identifier) {
        return response({ 
          success: true, 
          user: { name: data[i][1], identifier: data[i][0], folderId: data[i][3] } 
        }, cb);
      }
    }
  }
  return response({ success: false, message: "Profile not found" }, cb);
}
