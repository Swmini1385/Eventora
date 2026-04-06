/**
 * Main.gs - Eventora Backend Router
 * This handles all incoming GET/POST requests and JSONP logic.
 */

const MASTER_SHEET_NAME = "Master_Users";

/**
 * REUSABLE RESPONSE HELPER (Supports JSONP)
 */
function response(obj, callback) {
  const jsonStr = JSON.stringify(obj);
  if (callback) {
    // If callback is provided, return as JAVASCRIPT (JSONP)
    return ContentService.createTextOutput(callback + "(" + jsonStr + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  // Otherwise return as pure JSON
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
  const p = e.parameter || {};
  const action = p.action;
  const cb = p.callback || p.callbackName || p.jsonp; // More robust callback detection

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
    
    return response({ success: false, message: "Invalid action: " + action }, cb);
  } catch (err) {
    return response({ success: false, message: "System Error: " + err.toString() }, cb);
  }
}
