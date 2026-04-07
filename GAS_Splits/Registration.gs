/**
 * Registrations.gs - Attendee Management
 */

/**
 * 1. ATTENDEE REGISTRATION
 */
function handleAttendeeRegistration(p, cb) {
  console.log("Starting Registration for: " + (p.name || "Unknown"));
  try {
    const eventId = p.eventId;
    if (!eventId) throw new Error("Event ID is missing");
    
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    
    const lastRow = sheet.getLastRow();
    const studentCount = (lastRow < 3) ? 0 : (lastRow - 2); // Metadata (1) + Header (2)
    
    // Quick Metadata Fetch for ID Prefix
    let idPrefix = "A";
    try {
      const meta = sheet.getRange(1, 1, 1, 8).getValues()[0];
      if (meta[0] === "METADATA") idPrefix = (meta[7] || "A");
    } catch (e) { console.warn("Meta read failed, using A"); }
    
    const studentId = idPrefix + ("0000" + (studentCount + 1)).slice(-4);
    const password = p.password || Math.floor(100000 + Math.random() * 900000).toString();
    const paymentMode = p.paymentMode || "Cash"; 
    
    console.log("Generated ID: " + studentId);

    let photoId = p.photoId || "";
    // Photo linking moved to student-profile.html (after login)

    // APPEND DATA (MAIN ACTION)
    sheet.appendRow([
      studentId, // 1
      new Date(), // 2: Timestamp
      p.name || "Unnamed", // 3
      p.phone || "", // 4
      p.email || "", // 5
      password, // 6
      paymentMode, // 7
      "Confirmed", // 8
      p.address || "", // 9
      photoId, // 10
      0, // 11: Amount
      p.utr || "", // 12: UTR
      String(p.dob || ""), // 13: DOB
      p.age || "", // 14: Age
      p.gender || "" // 15: Gender
    ]);
    
    // ASYNC-LIKE SYNC TO MASTER (If it fails, don't stop registration)
    try {
      const ssMaster = getMasterSS();
      if (ssMaster) {
        let sheetMaster = ssMaster.getSheetByName(MASTER_STUDENTS_SHEET);
        if (!sheetMaster) {
          sheetMaster = ssMaster.insertSheet(MASTER_STUDENTS_SHEET);
          sheetMaster.appendRow(["StudentID", "Password", "EventID", "Name", "Address"]);
        }
        sheetMaster.appendRow([studentId, password, eventId, p.name || "", p.address || ""]);
      }
    } catch (err) {
      console.warn("Master Sync Failed (Non-critical):", err);
    }
    
    console.log("Registration Complete: " + studentId);
    return response({ 
      success: true, 
      studentId: studentId,
      password: password,
      paymentMode: paymentMode,
      message: "Registration successful!" 
    }, cb);

  } catch (e) {
    console.error("Critical Registration Error:", e);
    return response({ success: false, message: "Server Error: " + e.toString() }, cb);
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
            dob: row[12] || "",
            age: row[13] || "",
            gender: row[14] || "",
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
                    utr: row[11] || "", // Added UTR
                    dob: row[12] || "",
                    age: row[13] || "",
                    gender: row[14] || "",
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
    
    // FAST SEARCH using TextFinder
    const range = sheet.getRange("A2:A" + sheet.getLastRow()); // Search in ID column
    const finder = range.createTextFinder(studentId).matchCase(true).matchEntireCell(true).findNext();
    
    if (finder) {
        const row = finder.getRow();
        const data = sheet.getRange(row, 1, 1, 15).getValues()[0];
        
        return response({
            success: true,
            student: {
                id: data[0],
                name: data[2],
                phone: data[3],
                email: data[4] || "",
                paymentMode: data[6],
                status: data[7],
                address: data[8] || "",
                photoId: data[9] || "",
                amount: data[10] || "",
                utr: data[11] || "",
                dob: data[12] || "",
                age: data[13] || "",
                gender: data[14] || "",
                eventId: eventId,
                eventName: ss.getName()
            }
        }, cb);
    }
    return response({ success: false, message: "Student record not found." }, cb);
  } catch (e) {
    return response({ success: false, message: "Server busy or error: " + e.toString() }, cb);
  }
}

/**
 * 4b. GET STUDENT DASHBOARD BUNDLE (Combined Profile + Event + Attendance)
 * This reduces 3 network calls to 1, solving timeout issues.
 */
function handleGetStudentDashboardBundle(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheets()[0];
    
    // 1. Get Student Profile
    const range = sheet.getRange("A2:A" + sheet.getLastRow());
    const finder = range.createTextFinder(studentId).matchEntireCell(true).findNext();
    
    if (!finder) return response({ success: false, message: "Student not found" }, cb);
    
    const row = finder.getRow();
    const studentData = sheet.getRange(row, 1, 1, 15).getValues()[0];
    
    // 2. Get Event Meta (Fast lookup using the same SS)
    const eventData = {
      name: ss.getName(),
      startDate: "", startTime: "", endDate: "", endTime: "", venue: "TBA", fee: 0
    };
    try {
      const meta = sheet.getRange(1, 1, 1, 8).getValues()[0];
      if (meta[0] === "METADATA") {
        eventData.startDate = meta[1];
        eventData.startTime = meta[2];
        eventData.endDate = meta[3];
        eventData.endTime = meta[4];
        eventData.venue = meta[5];
        eventData.fee = meta[6];
      }
    } catch(e) {}

    // 3. Get Attendance
    let attendance = [];
    const sheetAtt = ss.getSheetByName("Attendance");
    if (sheetAtt) {
      const attRaw = sheetAtt.getDataRange().getValues();
      attendance = attRaw.filter(r => r[0] === studentId).map(r => r[1]);
    }
    
    // 4. Get Activity Photos
    let photos = [];
    const sheetPhotos = ss.getSheetByName("ActivityPhotos");
    if (sheetPhotos) {
      const photoRaw = sheetPhotos.getDataRange().getValues();
      photos = photoRaw.filter(r => String(r[2] || "").split(',').includes(studentId))
                       .map(r => ({ id: r[0], timestamp: r[1], desc: r[3] }));
    }
    
    return response({
      success: true,
      studentData: {
        id: studentData[0],
        name: studentData[2],
        phone: studentData[3],
        email: studentData[4],
        paymentMode: studentData[6],
        status: studentData[7],
        address: studentData[8],
        photoId: studentData[9],
        amount: studentData[10],
        utr: studentData[12] ? data[11] : studentData[11], // Resilience for UTR
        dob: studentData[12],
        age: studentData[13],
        gender: studentData[14],
        eventId: eventId
      },
      eventData: eventData,
      attendance: attendance,
      photos: photos
    }, cb);
    
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}
function handleMarkAttendance(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    const now = new Date();
    const dateStr = p.date || Utilities.formatDate(now, "GMT+5:30", "yyyy-MM-dd");
    
    const ss = SpreadsheetApp.openById(eventId);
    let sheetAtt = ss.getSheetByName("Attendance");
    if (!sheetAtt) {
      sheetAtt = ss.insertSheet("Attendance");
      sheetAtt.appendRow(["StudentID", "Date", "Status"]);
    }
    
    // FAST SEARCH using TextFinder in StudentID column (A)
    const finder = sheetAtt.getRange("A2:A" + Math.max(2, sheetAtt.getLastRow()))
                           .createTextFinder(studentId).matchEntireCell(true).findAll();
    
    for (let f of finder) {
        const row = f.getRow();
        const rowDateVal = sheetAtt.getRange(row, 2).getValue();
        const rowDate = rowDateVal instanceof Date ? Utilities.formatDate(rowDateVal, "GMT+5:30", "yyyy-MM-dd") : String(rowDateVal);
        
        if (rowDate === dateStr) {
            sheetAtt.deleteRow(row);
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
    
    // FAST SEARCH
    const finder = sheet.getRange("A2:A" + sheet.getLastRow()).createTextFinder(studentId).matchEntireCell(true).findNext();
    
    if (finder) {
        const r = finder.getRow();
        // Update columns 7, 8, 11, 12 (Base-1 mapping: G, H, K, L approx)
        // Adjust these indexes based on your column mapping (0-base: [6], [7], [10], [11])
        sheet.getRange(r, 7).setValue(mode);   // PaymentMode (Col 7)
        sheet.getRange(r, 8).setValue(status); // Status (Col 8)
        sheet.getRange(r, 11).setValue(amount); // Amount (Col 11)
        sheet.getRange(r, 12).setValue(utr);    // UTR (Col 12)
        
        return response({ success: true, message: "Payment updated for " + studentId }, cb);
    }
    return response({ success: false, message: "Student not found in this event." }, cb);
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
            if (p.address) sheet.getRange(rowIdx, 9).setValue(p.address); // Col 9
            if (p.photoId) sheet.getRange(rowIdx, 10).setValue(p.photoId); // Col 10
            if (p.dob) sheet.getRange(rowIdx, 13).setValue(String(p.dob)); // Col 13
            if (p.age) sheet.getRange(rowIdx, 14).setValue(p.age); // Col 14
            if (p.gender) sheet.getRange(rowIdx, 15).setValue(p.gender); // Col 15
            
            return response({ success: true, message: "Profile updated" }, cb);
        }
    }
    throw "Student not found";
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * 8. UPLOAD PHOTO (Profile)
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

/**
 * 9. UPLOAD ACTIVITY PHOTOS & TAGGING
 */
function handleUploadActivityPhotos(p, cb) {
  try {
    const eventId = p.eventId;
    const studentIds = p.studentIds; // Comma-separated
    const desc = p.desc || "";
    const fileName = p.fileName || "activity.jpg";
    const base64Data = p.fileData;

    const ss = SpreadsheetApp.openById(eventId);
    let sheetPhotos = ss.getSheetByName("ActivityPhotos");
    if (!sheetPhotos) {
      sheetPhotos = ss.insertSheet("ActivityPhotos");
      sheetPhotos.appendRow(["PhotoID", "Timestamp", "TaggedStudents", "Description"]);
    }

    const folderName = "Eventora_Activity_Photos";
    let folderIterator = DriveApp.getFoldersByName(folderName);
    let folder = folderIterator.hasNext() ? folderIterator.next() : DriveApp.createFolder(folderName);

    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    const blob = Utilities.newBlob(bytes, contentType, fileName);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    sheetPhotos.appendRow([file.getId(), new Date(), studentIds, desc]);

    return response({ success: true, photoId: file.getId() }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * 10. GET ACTIVITY PHOTOS FOR STUDENT
 */
function handleGetActivityPhotos(p, cb) {
  try {
    const eventId = p.eventId;
    const studentId = p.studentId;
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheetByName("ActivityPhotos");
    if (!sheet) return response({ success: true, photos: [] }, cb);

    const data = sheet.getDataRange().getValues();
    const photos = data.filter(row => {
      const tagged = String(row[2] || "").split(',');
      return tagged.includes(studentId);
    }).map(row => ({
      id: row[0],
      timestamp: row[1],
      desc: row[3]
    }));

    return response({ success: true, photos: photos }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}

/**
 * 11. DELETE ACTIVITY PHOTO
 */
function handleDeleteActivityPhoto(p, cb) {
  try {
    const eventId = p.eventId;
    const photoId = p.photoId; 
    const ss = SpreadsheetApp.openById(eventId);
    const sheet = ss.getSheetByName("ActivityPhotos");
    if (!sheet) return response({ success: false, message: "Sheet not found" }, cb);

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == photoId) {
        sheet.deleteRow(i + 1);
        try {
          DriveApp.getFileById(photoId).setTrashed(true);
        } catch (e) { }
        return response({ success: true }, cb);
      }
    }
    return response({ success: false, message: "Photo not found" }, cb);
  } catch (e) {
    return response({ success: false, message: e.toString() }, cb);
  }
}
