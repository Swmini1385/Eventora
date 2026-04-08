/**
 * Expenses.gs - Financial Tracking
 * Stores expenses in a central Master_Expenses sheet.
 */

const MASTER_EXPENSES_SHEET = "Master_Expenses";

/**
 * Handle adding or updating an expense
 */
function handleSaveExpense(p, cb) {
  const ss = getMasterSS();
  if (!ss) return response({ success: false, message: "Master DB not found." }, cb);
  
  let sheet = ss.getSheetByName(MASTER_EXPENSES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(MASTER_EXPENSES_SHEET);
    sheet.appendRow(["ID", "EventID", "Type", "Amount", "Timestamp", "Organizer"]);
  }
  
  const id = p.id || "EXP_" + Date.now();
  const eventId = p.eventId;
  const type = p.type;
  const amount = parseFloat(p.amount) || 0;
  const timestamp = new Date();
  const organizer = p.identifier || ""; // To isolate expenses in multi-tenant mode

  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  
  if (p.id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) { foundRow = i + 1; break; }
    }
  }
  
  const rowData = [id, eventId, type, amount, timestamp, organizer];
  
  if (foundRow > -1) {
    sheet.getRange(foundRow, 1, 1, 6).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return response({ success: true, message: "Expense saved successfully.", id: id }, cb);
}

/**
 * Get expenses for a specific event or all events for an organizer
 */
function handleGetExpenses(p, cb) {
  const ss = getMasterSS();
  if (!ss) return response({ success: false, message: "Master DB not found." }, cb);
  
  const sheet = ss.getSheetByName(MASTER_EXPENSES_SHEET);
  if (!sheet) return response({ success: true, expenses: [], total: 0 }, cb);
  
  const data = sheet.getDataRange().getValues();
  const eventId = p.eventId;
  const organizer = p.identifier;
  
  const results = [];
  let total = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const matchEvent = !eventId || row[1] === eventId;
    const matchOrg = !organizer || row[5] === organizer;
    
    if (matchEvent && matchOrg) {
      results.push({
        id: row[0],
        eventId: row[1],
        type: row[2],
        amount: row[3],
        timestamp: row[4]
      });
      total += parseFloat(row[3]) || 0;
    }
  }
  
  return response({ success: true, expenses: results, total: total }, cb);
}

/**
 * Delete an expense
 */
function handleDeleteExpense(p, cb) {
  const ss = getMasterSS();
  const id = p.id;
  if (!ss || !id) return response({ success: false, message: "Invalid request." }, cb);
  
  const sheet = ss.getSheetByName(MASTER_EXPENSES_SHEET);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return response({ success: true, message: "Expense deleted." }, cb);
    }
  }
  
  return response({ success: false, message: "Expense not found." }, cb);
}

/**
 * Internal helper to calculate event expenses without a separate route
 */
function getEventExpenseTotal(eventId) {
  const ss = getMasterSS();
  if (!ss) return 0;
  const sheet = ss.getSheetByName(MASTER_EXPENSES_SHEET);
  if (!sheet) return 0;
  const data = sheet.getDataRange().getValues();
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === eventId) total += parseFloat(data[i][3]) || 0;
  }
  return total;
}
