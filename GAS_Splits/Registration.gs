/**
 * Registrations.gs - Attendee Management
 */

/**
 * 1. ATTENDEE REGISTRATION
 */
function handleAttendeeRegistration(p, cb) {
  try {
    const eventId = p.eventId;
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    
    const lastRow = sheet.getLastRow();
    const studentCount = lastRow < 2 ? 0 : lastRow - 2;
    
    const metaRow = sheet.getRange(1, 1, 1, 8).getValues()[0];
    const idPrefix = metaRow[0] === "METADATA" ? (metaRow[7] || "A") : "A";
    
    const sequenceNum = studentCount + 1;
    const studentId = idPrefix + ("0000" + sequenceNum).slice(-4);
    
    const timestamp = new Date();
    const password = p.password || "123456"; 
    const paymentMode = p.paymentMode || "Cash"; 

    sheet.appendRow([
      studentId,
      timestamp,
      p.name,
      p.phone,
      p.email || "",
      password,
      paymentMode,
      "Confirmed"
    ]);
    
    return response({ 
      success: true, 
      studentId: studentId,
      password: password,
      paymentMode: paymentMode,
      message: "Registration successful!" 
    }, cb);
  } catch (e) {
    return response({ success: false, message: "Registration Error: " + e.toString() }, cb);
  }
}

function handleGetAttendees(p, cb) {
  try {
    const eventId = p.eventId;
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    data.shift();
    data.shift(); 
    
    const attendees = data.map(row => {
      return {
        id: row[0],
        timestamp: row[1],
        name: row[2],
        phone: row[3],
        email: row[4],
        password: row[5],
        paymentMode: row[6],
        status: row[7]
      };
    });
    
    return response({ 
      success: true, 
      attendees: attendees 
    }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}
