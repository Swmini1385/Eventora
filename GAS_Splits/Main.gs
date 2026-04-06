/**
 * Main.gs - Eventora Backend Router
 * This handles all incoming GET/POST requests and JSONP logic.
 */

const MASTER_SHEET_NAME = "Master_Users";
const MASTER_STUDENTS_SHEET = "Master_Attendees";

/**
 * HELPER: OPEN MASTER SPREADSHEET
 */
function getMasterSS() {
  const files = DriveApp.getFilesByName("Eventora_Master_Data");
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  return null;
}

/**
 * REUSABLE RESPONSE HELPER (Supports JSONP)
 */
function response(obj, callback) {
  const jsonStr = JSON.stringify(obj);
  if (callback) {
    // Force JavaScript MIME Type for JSONP
    return ContentService.createTextOutput(callback + "(" + jsonStr + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  // Fallback to pure JSON
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  let p = e.parameter || {};
  const cb = p.callback || p.callbackName || p.jsonp;

  // HANDLE POST DATA (JSON BODY)
  if (e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      p = { ...p, ...body };
    } catch (err) {
      // In case of non-JSON POST, just continue with parameters
    }
  }

  const action = p.action;

  try {
    if (action === "signup") return handleSignup(p, cb);
    if (action === "login") return handleLogin(p, cb);
    if (action === "create_event") return handleCreateEvent(p, cb);
    if (action === "delete_event") return handleDeleteEvent(p, cb);
    if (action === "register_attendee") return handleAttendeeRegistration(p, cb);
    if (action === "get_attendees") return handleGetAttendees(p, cb);
    if (action === "get_event_info") return handleGetEventInfo(p, cb);
    if (action === "get_profile") return handleGetProfile(p, cb);
    if (action === "list_events") return handleListEvents(p, cb);
    if (action === "student_login") return handleStudentLogin(p, cb);
    if (action === "get_student_profile") return handleGetStudentProfile(p, cb);
    if (action === "mark_attendance") return handleMarkAttendance(p, cb);
    if (action === "get_student_attendance") return handleGetStudentAttendance(p, cb);
    if (action === "update_student_profile") return handleUpdateStudentProfile(p, cb);
    if (action === "upload_activity_photos") return handleUploadActivityPhotos(p, cb);
    if (action === "get_activity_photos") return handleGetActivityPhotos(p, cb);
    if (action === "update_payment_info") return handleUpdatePaymentInfo(p, cb);
    
    return response({ success: false, message: "Invalid action: " + action }, cb);
  } catch (err) {
    return response({ success: false, message: "System Error: " + err.toString() }, cb);
  }
}
