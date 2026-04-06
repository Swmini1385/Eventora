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
      "Confirmed",
      p.address || "",
      p.photoId || "",
      p.fee || ""
    ]);
    
    // SYNC TO MASTER (for global login without Event ID)
    try {
      const ssMaster = getMasterSS();
      if (ssMaster) {
        let sheetMaster = ssMaster.getSheetByName(MASTER_STUDENTS_SHEET);
        if (!sheetMaster) {
          sheetMaster = ssMaster.insertSheet(MASTER_STUDENTS_SHEET);
          sheetMaster.appendRow(["StudentID", "Password", "EventID", "Name", "Address"]);
        }
        sheetMaster.appendRow([studentId, password, eventId, p.name, p.address || ""]);
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
    
    // Remove metadata and header
    data.shift();
    data.shift(); 
    
    const res = {
        success: true,
        attendees: data.map(row => ({
            id: row[0],
            name: row[2],
            phone: row[3],
            email: row[4],
            paymentMode: row[6],
            status: row[7],
            address: row[8] || "",
            photoId: row[9] || "",
            amount: row[10] || "",
            utr: row[11] || "",
            markedToday: false
        }))
    };

    // Check Attendance Sheet for today
    const sheetAtt = ss.getSheetByName("Attendance");
    if (sheetAtt) {
        const attData = sheetAtt.getDataRange().getValues();
        const todayStr = Utilities.formatDate(new Date(), "GMT+5:30", "yyyy-MM-dd");
        const markedIds = new Set(
            attData.filter(r => {
                const rowDate = r[1] instanceof Date ? Utilities.formatDate(r[1], "GMT+5:30", "yyyy-MM-dd") : String(r[1]);
                return rowDate === todayStr;
            }).map(r => r[0])
        );
        res.attendees.forEach(a => {
            if (markedIds.has(a.id)) a.markedToday = true;
        });
    }

    return response(res, cb);
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
                    address: row[8] || "",
                    photoId: row[9] || "",
                    amount: row[10] || "",
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
                    address: data[i][8] || "",
                    photoId: data[i][9] || "",
                    amount: data[i][10] || "",
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

/**
 * 5. MARK ATTENDANCE (Admin)
 */
function handleMarkAttendance(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    
    // Normalize today's date to a string: "yyyy-MM-dd"
    const now = new Date();
    const dateStr = p.date || Utilities.formatDate(now, "GMT+5:30", "yyyy-MM-dd");
    
    const ss = SpreadsheetApp.openById(eventId);
    let sheetAtt = ss.getSheetByName("Attendance");
    if (!sheetAtt) {
      sheetAtt = ss.insertSheet("Attendance");
      sheetAtt.appendRow(["StudentID", "Date", "Status"]);
    }
    
    // Check if record exists for this student AND this date
    const data = sheetAtt.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        // Handle both Date objects and strings
        const rowDate = data[i][1] instanceof Date ? Utilities.formatDate(data[i][1], "GMT+5:30", "yyyy-MM-dd") : String(data[i][1]);
        if (data[i][0] === studentId && rowDate === dateStr) {
            sheetAtt.deleteRow(i + 1);
            return response({ success: true, message: "Unmarked", result: "unmarked" }, cb);
        }
    }
    
    sheetAtt.appendRow([studentId, dateStr, "Present"]);
    return response({ success: true, message: "Marked", result: "marked" }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * NEW: UPDATE PAYMENT INFO (Admin)
 */
function handleUpdatePaymentInfo(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    const amount = p.amount || "";
    const mode = p.paymentMode || "Cash";
    const utr = p.utr || "";
    const status = (parseInt(amount) > 0) ? "Confirmed" : "Pending";
    
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    for (let i = 2; i < data.length; i++) {
        if (data[i][0] === studentId) {
            // Update columns: 
            // 7 (Mode), 8 (Status), 11 (Amount), 12 (UTR)
            sheet.getRange(i + 1, 7).setValue(mode);
            sheet.getRange(i + 1, 8).setValue(status);
            sheet.getRange(i + 1, 11).setValue(amount);
            sheet.getRange(i + 1, 12).setValue(utr);
            
            return response({ success: true, status: status }, cb);
        }
    }
    return response({ success: false, message: "Student not found" }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * 6. GET STUDENT ATTENDANCE (Student/Admin)
 */
function handleGetStudentAttendance(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    
    const ss = SpreadsheetApp.openById(eventId);
    const sheetAtt = ss.getSheetByName("Attendance");
    if (!sheetAtt) return response({ success: true, attendance: [] }, cb);
    
    const data = sheetAtt.getDataRange().getValues();
    const attendance = data.filter(row => row[0] === studentId).map(row => row[1]);
    
    return response({ success: true, attendance: attendance }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * 7. UPDATE STUDENT PROFILE
 */
function handleUpdateStudentProfile(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    for (let i = 2; i < data.length; i++) {
        if (data[i][0] === studentId) {
            const rowIdx = i + 1;
            if (p.name) sheet.getRange(rowIdx, 3).setValue(p.name);
            if (p.phone) sheet.getRange(rowIdx, 4).setValue(p.phone);
            if (p.email) sheet.getRange(rowIdx, 5).setValue(p.email);
            if (p.address) sheet.getRange(rowIdx, 9).setValue(p.address);
            if (p.photoId) sheet.getRange(rowIdx, 10).setValue(p.photoId);
            
            return response({ success: true, message: "Profile updated" }, cb);
        }
    }
    throw "Student not found";
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * 8. UPLOAD PHOTO
 */
function handleUploadStudentPhoto(p, cb) {
  try {
    const fileName = p.fileName || "photo.jpg";
    const base64Data = p.fileData; // Expecting data:image/jpeg;base64,...
    
    const folderName = "Eventora_Profile_Photos";
    let folderIterator = DriveApp.getFoldersByName(folderName);
    let folder;
    if (!folderIterator.hasNext()) {
      folder = DriveApp.createFolder(folderName);
    } else {
      folder = folderIterator.next();
    }
    
    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return response({ success: true, fileId: file.getId() }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}
