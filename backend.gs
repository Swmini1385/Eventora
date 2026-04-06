/**
 * Eventora Backend - Multi-Tenant Event Management
 * Google Apps Script (GAS) Engine
 */

const MASTER_SHEET_NAME = "Master_Users";

/**
 * Handle POST requests (Auth, Event Creation, Registration)
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * Handle GET requests (Needed for JSONP / Data Loading)
 */
function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const p = e.parameter;
  const action = p.action;

  try {
    if (action === "signup") return handleSignup(p);
    if (action === "login") return handleLogin(p);
    if (action === "create_event") return handleCreateEvent(p);
    if (action === "get_attendees") return handleGetAttendees(p);
    if (action === "get_event_info") return handleGetEventInfo(p);
    if (action === "get_profile") return handleGetProfile(p);
    if (action === "list_events") return handleListEvents(p);
    
    return response({ success: false, message: "Invalid action" }, p.callback);
  } catch (err) {
    return response({ success: false, message: err.toString() }, p.callback);
  }
}

/**
 * response helper
 */
function response(obj, callback) {
  const jsonStr = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + jsonStr + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 1. USER SIGNUP
 */
function handleSignup(p) {
  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw "No active spreadsheet";
  } catch (e) {
    // If standalone, search for an existing master sheet first
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

  // Check if user exists
  const data = sheet.getDataRange().getValues();
  const exists = data.some(row => row[0] == p.identifier);
  if (exists) return response({ success: false, message: "User already exists" });

  // Create User Folder in Drive
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
  });
}

/**
 * 2. USER LOGIN
 */
function handleLogin(p) {
  let ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw "No active spreadsheet";
  } catch (e) {
    const files = DriveApp.getFilesByName("Eventora_Master_Data");
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      return response({ success: false, message: "Master data not found. Please signup first." });
    }
  }
  
  const sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) return response({ success: false, message: "No users found" });

  const data = sheet.getDataRange().getValues();
  const userRow = data.find(row => row[0] == p.identifier && row[2] == p.password);

  if (userRow) {
    return response({ 
      success: true, 
      user: { name: userRow[1], identifier: userRow[0], folderId: userRow[3] } 
    });
  } else {
    return response({ success: false, message: "Invalid credentials" });
  }
}

/**
 * NEW: GET PROFILE (For Session Resume)
 */
function handleGetProfile(p) {
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
        }, p.callback);
      }
    }
  }
  return response({ success: false, message: "Profile not found" }, p.callback);
}

/**
 * 3. CREATE EVENT (Isolated)
 */
function handleCreateEvent(p) {
  let userFolderId = p.folderId;
  const identifier = p.identifier;
  const eventName = p.name;
  
  // Fallback: If folderId is missing, lookup via identifier in Master Sheet
  if (!userFolderId && identifier) {
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
          userFolderId = data[i][3];
          break;
        }
      }
    }
  }

  if (!userFolderId) return response({ success: false, message: "User folder not found. Please relogin." });

  const userFolder = DriveApp.getFolderById(userFolderId);
  const newSS = SpreadsheetApp.create("EV_" + eventName);
  const file = DriveApp.getFileById(newSS.getId());
  
  file.moveTo(userFolder);
  
  const sheet = newSS.getSheets()[0];
  sheet.setName("Attendees");
  sheet.appendRow(["Timestamp", "Name", "Phone", "Email", "Address", "Status"]);
  
  return response({ 
    success: true, 
    eventId: newSS.getId(),
    message: "Event created and isolated in your folder!" 
  });
}

/**
 * 4. ATTENDEE REGISTRATION
 */
function handleAttendeeRegistration(p) {
  const eventId = p.eventId; // The Spreadsheet ID
  const ss = SpreadsheetApp.openById(eventId);
  const sheet = ss.getSheets()[0];
  
  sheet.appendRow([
    new Date(),
    p.name,
    p.phone,
    p.email,
    p.address,
    "Confirmed"
  ]);
  
  return response({ success: true, message: "Registration successful!" });
}

/**
 * 5. GET ATTENDEES FOR AN EVENT
 */
function handleGetAttendees(p) {
  const eventId = p.eventId;
  const ss = SpreadsheetApp.openById(eventId);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  
  // Remove header row
  const headers = data.shift();
  const attendees = data.map(row => {
    return {
      timestamp: row[0],
      name: row[1],
      phone: row[2],
      email: row[3],
      address: row[4],
      status: row[5]
    };
  });
  
  return response({ 
    success: true, 
    attendees: attendees 
  });
}

/**
 * 6. GET EVENT INFO FOR REGISTRATION FORM
 */
function handleGetEventInfo(p) {
  try {
    const eventId = p.eventId;
    if (!eventId || eventId.startsWith("ev_")) throw "Invalid Cloud ID. Please use a newly created event link.";
    
    const ss = SpreadsheetApp.openById(eventId);
    const name = ss.getName().replace("EV_", "");
    
    return response({ 
      success: true, 
      name: name,
      fee: "100", 
      description: "Fill the form to register."
    }, p.callback);
  } catch (err) {
    return response({ success: false, message: err.toString() }, p.callback);
  }
}

/**
 * 7. LIST ALL EVENTS IN USER FOLDER
 */
function handleListEvents(p) {
  const folderId = p.folderId;
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  
  const events = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().startsWith("EV_")) {
      events.push({
        id: file.getId(),
        name: file.getName().replace("EV_", ""),
        date: "See Details", 
        fee: "100"
      });
    }
  }
  
  return response({ 
    success: true, 
    events: events 
  });
}
