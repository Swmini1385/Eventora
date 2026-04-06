/**
 * Events.gs - Multi-Tenant Event Management
 */

/**
 * 1. CREATE OR UPDATE EVENT
 */
function handleCreateEvent(p, cb) {
  let userFolderId = p.folderId;
  const eventName = p.name;
  const eventId = p.eventId;
  
  if (!userFolderId && p.identifier) {
    const files = DriveApp.getFilesByName("Eventora_Master_Data");
    if (files.hasNext()) {
      const ssMaster = SpreadsheetApp.open(files.next());
      const sheetMaster = ssMaster.getSheetByName(MASTER_SHEET_NAME);
      const dataMaster = sheetMaster.getDataRange().getValues();
      for (let i = 1; i < dataMaster.length; i++) {
        if (dataMaster[i][0] === p.identifier) {
          userFolderId = dataMaster[i][3];
          break;
        }
      }
    }
  }

  if (!userFolderId) return response({ success: false, message: "User folder not found. Please relogin." }, cb);

  let ss;
  let file;
  
  if (eventId && eventId !== "undefined") {
    try {
      file = DriveApp.getFileById(eventId);
      file.setName("EV_" + eventName);
      ss = SpreadsheetApp.open(file);
    } catch (e) {
      ss = SpreadsheetApp.create("EV_" + eventName);
      file = DriveApp.getFileById(ss.getId());
      DriveApp.getFolderById(userFolderId).addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    }
  } else {
    ss = SpreadsheetApp.create("EV_" + eventName);
    const file = DriveApp.getFileById(ss.getId());
    file.moveTo(DriveApp.getFolderById(userFolderId));
  }

  const sheet = ss.getSheets()[0];
  if (sheet.getName() !== "Attendees") sheet.setName("Attendees");

  const meta = [
    "METADATA", 
    p.startDate || "", 
    p.endDate || "", 
    p.venue || "", 
    p.upi || "", 
    p.wa || "", 
    p.fee || "100",
    p.prefix || "A"
  ];
  
  sheet.getRange(1, 1, 1, 8).setValues([meta]);
  
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(["ID", "Timestamp", "Name", "Phone", "Email", "Password", "PaymentMode", "Status"]);
  }

  return response({ 
    success: true, 
    eventId: ss.getId(), 
    name: eventName,
    message: eventId && eventId !== "undefined" ? "Event Updated Successfully" : "Event Created Successfully"
  }, cb);
}

function handleDeleteEvent(p, cb) {
  const eventId = p.eventId;
  if (!eventId) return response({ success: false, message: "Missing Event ID" }, cb);
  try {
    const file = DriveApp.getFileById(eventId);
    file.setTrashed(true);
    return response({ success: true, message: "Event deleted successfully." }, cb);
  } catch (e) {
    return response({ success: false, message: "Error deleting file: " + e.toString() }, cb);
  }
}

function handleGetEventInfo(p, cb) {
  try {
    const eventId = p.eventId;
    if (!eventId || eventId.startsWith("ev_")) throw "Invalid Cloud ID. Please use a newly created event link.";
    
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    const name = ss.getName().replace("EV_", "");
    
    const metaRow = sheet.getRange(1, 1, 1, 8).getValues()[0];
    let meta = {};
    if (metaRow[0] === "METADATA") {
      meta = {
        startDate: metaRow[1],
        endDate: metaRow[2],
        venue: metaRow[3],
        upi: metaRow[4],
        wa: metaRow[5],
        fee: metaRow[6],
        prefix: metaRow[7]
      };
    }
    
    return response({ 
      success: true, 
      name: name,
      ...meta
    }, cb);
  } catch (err) {
    return response({ success: false, message: err.toString() }, cb);
  }
}

function handleListEvents(p, cb) {
  const folderId = p.folderId;
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  
  const events = [];
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    if (fileName.startsWith("EV_") || fileName.includes("Event")) {
      events.push({
        id: file.getId(),
        name: fileName.replace("EV_", ""),
        date: "Cloud Event", 
        fee: "100"
      });
    }
  }
  
  return response({ 
    success: true, 
    events: events 
  }, cb);
}
