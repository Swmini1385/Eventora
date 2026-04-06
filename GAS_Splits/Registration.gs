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
    
    // SYNC TO MASTER (for global login without Event ID)
    try {
      const ssMaster = getMasterSS();
      if (ssMaster) {
        let sheetMaster = ssMaster.getSheetByName(MASTER_STUDENTS_SHEET);
        if (!sheetMaster) {
          sheetMaster = ssMaster.insertSheet(MASTER_STUDENTS_SHEET);
          sheetMaster.appendRow(["StudentID", "Password", "EventID", "Name"]);
        }
        sheetMaster.appendRow([studentId, password, eventId, p.name]);
      }
    } catch (err) {
      console.error("Master Sync Failed:", err);
    }
    
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

/**
 * 3. STUDENT / PARENT LOGIN
 */
function handleStudentLogin(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    const password = p.password;
    
    let finalEventId = eventId;
    
    // GLOBAL SEARCH: If no Event ID provided, look it up in Master
    if (!finalEventId) {
      const ssMaster = getMasterSS();
      const sheetMaster = ssMaster.getSheetByName(MASTER_STUDENTS_SHEET);
      if (sheetMaster) {
        const masterData = sheetMaster.getDataRange().getValues();
        for (let j = 1; j < masterData.length; j++) {
          if (masterData[j][0] === studentId && String(masterData[j][1]) === String(password)) {
            finalEventId = masterData[j][2];
            break;
          }
        }
      }
    }

    if (!finalEventId) throw "Invalid Student ID or Password (or Event not found)";
    
    const ss = SpreadsheetApp.openById(finalEventId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    // Search from row 3 onwards (row indices 2+)
    for (let i = 2; i < data.length; i++) {
        const row = data[i];
        if (row[0] === studentId && String(row[5]) === String(password)) {
            return response({
                success: true,
                student: {
                    id: row[0],
                    name: row[2],
                    phone: row[3],
                    email: row[4],
                    paymentMode: row[6],
                    status: row[7],
                    eventId: finalEventId
                }
            }, cb);
        }
    }
    
    return response({ success: false, message: "Invalid Student ID or Password" }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * 4. GET SINGLE STUDENT PROFILE
 */
function handleGetStudentProfile(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    for (let i = 2; i < data.length; i++) {
        if (data[i][0] === studentId) {
            return response({
                success: true,
                student: {
                    id: data[i][0],
                    name: data[i][2],
                    phone: data[i][3],
                    email: data[i][4],
                    paymentMode: data[i][6],
                    status: data[i][7],
                    eventId: eventId
                }
            }, cb);
        }
    }
    return response({ success: false, message: "Student not found" }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}
