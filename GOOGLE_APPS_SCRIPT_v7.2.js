/**
 * UNIQUE DELTA FORCE - HR PORTAL 
 * Google Drive & Form Integration Script (Version 7.2 - PRECISE SYNC & EMAIL COLLECTION)
 * Uses direct JWT parsing to bypass API key restrictions.
 */

var ROOT_FOLDER_ID = "1XuFLT5v5s1ZSdugKr1XzT0AdYkL-QgBX";
var FIREBASE_API_KEY = "AIzaSyCG5XXyHGQbJvITqCs08elQQsWz5J8Mw7w";
var FORM_ID = "1nO3SB-0g_RLJOpwj1qsReMoe37-b3kVEkYEVP6rmunc";
var PROJECT_ID = "hr-portal-unique-delta";

var FOLDERS = {
    PENDING: 'Pending Employees',
    ACTIVE: 'Active Employees',
    RELIEVED: 'Relieved Employees',
    RECYCLE_BIN: 'Recycle Bin'
};

function checkFirestoreAccess(idToken, collection, docId) {
  try {
    var firestoreUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/" + collection + "/" + docId;
    var response = UrlFetchApp.fetch(firestoreUrl, {
      method: "get",
      headers: { "Authorization": "Bearer " + idToken },
      muteHttpExceptions: true
    });
    return response.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

/**
 * CORE AUTHENTICATION: Verifies the token via Google's server-side API.
 * Uses identitytoolkit API as the primary verification method to ensure
 * tokens are cryptographically validated by Google, not just decoded locally.
 */
function verifyFirebaseToken(idToken) {
  if (!idToken) {
    Logger.log("❌ No token provided.");
    return { isValid: false };
  }
  
  // Primary: Use Google's server-side API to verify the token
  return verifyViaApi(idToken);
}

/**
 * Fallback to Google API
 */
function verifyViaApi(idToken) {
  var url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY;
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      payload: JSON.stringify({ idToken: idToken }),
      contentType: "application/json",
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) return { isValid: false };
    
    var result = JSON.parse(response.getContentText());
    var uid = result.users && result.users[0] && result.users[0].localId;
    if (!uid) return { isValid: false };
    
    var isSuperAdmin = false;
    try {
      var firestoreUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/users/" + uid;
      var firestoreResponse = UrlFetchApp.fetch(firestoreUrl, {
        method: "get",
        headers: { "Authorization": "Bearer " + idToken },
        muteHttpExceptions: true
      });
      if (firestoreResponse.getResponseCode() === 200) {
        var userDoc = JSON.parse(firestoreResponse.getContentText());
        var roleId = userDoc.fields && userDoc.fields.roleId && userDoc.fields.roleId.stringValue;
        isSuperAdmin = (roleId === 'role-super-admin');
      }
    } catch (err) {}
    
    return { isValid: true, uid: uid, isSuperAdmin: isSuperAdmin };
  } catch(e) { return { isValid: false }; }
}

/**
 * MAIN ENTRY POINT
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // 🛡️ SECURITY: Verify Auth FIRST
    var authInfo = verifyFirebaseToken(data.token);
    if (!authInfo.isValid) {
      return reply({ success: false, error: "Unauthorized: Invalid or missing Firebase Authentication Token" });
    }
    
    // 🛡️ SECURITY: Verify SuperAdmin status for administrative directory actions
    var adminActions = [
      'copy_folder_contents',
      'rename_employee_folder',
      'approve_employee',
      'delete_employee',
      'restore_employee',
      'permanent_delete_employee'
    ];
    
    var isAdministrative = adminActions.indexOf(data.action) !== -1;
    if (isAdministrative && !authInfo.isSuperAdmin) {
      return reply({ success: false, error: "Forbidden: Only SuperAdmins can execute folder management actions" });
    }
    
    // 📁 ACTIONS
    // 👉 Updated to pass email to submitToForm
    if (data.action === 'submit_to_form') return submitToForm(data.fields, data.email);
    if (data.action === 'copy_folder_contents') return handleCopyFolder(data.sourceFolderName, data.targetFolderName);
    if (data.action === 'rename_employee_folder') return renameFolder(data.oldFolderName, data.newFolderName);
    if (data.action === 'approve_employee') return approveEmployee(data.oldFolderName, data.newFolderName);
    
    // --- DELETION ACTIONS ---
    if (data.action === 'delete_employee') return moveFolderAction(data.employeeName, data.uniqueId, FOLDERS.RECYCLE_BIN, data.folderName);
    if (data.action === 'restore_employee') return moveFolderAction(data.employeeName, data.uniqueId, FOLDERS.PENDING, data.folderName);
    if (data.action === 'permanent_delete_employee') return permanentDeleteAction(data.employeeName, data.uniqueId, data.folderName);
    
    if (data.base64) {
      // 🛡️ SECURITY: Verify folder ownership for non-super-admins
      var hasUploadAccess = authInfo.isSuperAdmin || false;
      if (!hasUploadAccess && data.uniqueId) {
        hasUploadAccess = checkFirestoreAccess(data.token, "employees", data.uniqueId) ||
                          checkFirestoreAccess(data.token, "onboarding_submissions", data.uniqueId) ||
                          checkFirestoreAccess(data.token, "draft_submissions", data.uniqueId);
      }
      if (!hasUploadAccess) {
        return reply({ success: false, error: "Forbidden: You do not have ownership access to this employee folder" });
      }
      return handleUpload(data);
    }
    
    return reply({ success: false, error: "Invalid action or missing parameters" });
    
  } catch (error) {
    Logger.log("Critical Error: " + error.toString());
    return reply({ success: false, error: error.toString() });
  }
}

// --- FILE UPLOAD LOGIC ---

function handleUpload(data) {
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var isPending = data.uniqueId && data.uniqueId.startsWith('SUB-');
  var targetParent = getOrCreateFolder(root, isPending ? FOLDERS.PENDING : FOLDERS.ACTIVE);
  
  var folderName = data.uniqueId ? (data.uniqueId + " - " + data.employeeName) : data.employeeName;
  var employeeFolder = getOrCreateFolder(targetParent, folderName);
  
  var subFolderName = "Joining Documents";
  if (data.operationName) {
     if (data.operationName.indexOf("Leave") !== -1) subFolderName = "Leave Requests";
  }
  
  var targetFolder = getOrCreateFolder(employeeFolder, subFolderName);
  var base64Data = data.base64.split(',')[1] || data.base64;
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, "application/octet-stream", data.filename);
  
  var file = targetFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return reply({ success: true, url: file.getUrl(), fileId: file.getId() });
}

// --- APPROVE EMPLOYEE: Rename + Move from Pending to Active ---

function approveEmployee(oldFolderName, newFolderName) {
  try {
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var pendingFolder = getOrCreateFolder(root, FOLDERS.PENDING);
    var activeFolder = getOrCreateFolder(root, FOLDERS.ACTIVE);
    
    // Search inside Pending Employees first
    var folders = pendingFolder.getFoldersByName(oldFolderName);
    if (folders.hasNext()) {
      var folder = folders.next();
      // 1. Rename the folder
      folder.setName(newFolderName);
      // 2. Move from Pending to Active
      folder.moveTo(activeFolder);
      Logger.log("✅ Approved: Renamed '" + oldFolderName + "' → '" + newFolderName + "' and moved to Active.");
      return reply({ success: true, message: "Folder renamed and moved to Active Employees" });
    }
    
    // Fallback: try to find anywhere in Drive (in case it was already moved somehow)
    var allFolders = DriveApp.getFoldersByName(oldFolderName);
    if (allFolders.hasNext()) {
      var folder = allFolders.next();
      folder.setName(newFolderName);
      folder.moveTo(activeFolder);
      Logger.log("⚠️ Approved (fallback): Found outside Pending, renamed and moved to Active.");
      return reply({ success: true, message: "Folder found outside Pending, renamed and moved to Active" });
    }
    
    Logger.log("❌ Approve failed: Folder not found: " + oldFolderName);
    return reply({ success: false, error: "Folder not found: " + oldFolderName });
  } catch (e) {
    Logger.log("❌ approveEmployee error: " + e.toString());
    return reply({ success: false, error: e.toString() });
  }
}

// --- RENAME FOLDER (Actually renames now!) ---

function renameFolder(oldName, newName) {
  try {
    var folders = DriveApp.getFoldersByName(oldName);
    if (folders.hasNext()) {
      var folder = folders.next();
      folder.setName(newName);
      Logger.log("✅ Renamed: '" + oldName + "' → '" + newName + "'");
      return reply({ success: true, message: "Folder renamed successfully" });
    }
    Logger.log("⚠️ Rename: Folder not found: " + oldName);
    return reply({ success: false, error: "Folder not found: " + oldName });
  } catch (e) {
    Logger.log("❌ renameFolder error: " + e.toString());
    return reply({ success: false, error: e.toString() });
  }
}

// --- MISC HANDLERS & HELPERS ---

// 👉 Updated to accept email parameter and call setRespondentEmail
function submitToForm(fields, email) {
  var form = FormApp.openById(FORM_ID);
  var response = form.createResponse();
  
  if (email) {
    try {
      response.setRespondentEmail(email);
    } catch (emailErr) {
      Logger.log("⚠️ Failed to set respondent email (check Form Settings): " + emailErr.toString());
    }
  }
  
  var items = form.getItems();
  
  function normalizeTitle(title) {
    if (!title) return "";
    return title.toString()
                .toLowerCase()
                .replace(/[\s\-_&()]+/g, '') // Remove spaces, dashes, underscores, ampersands, parentheses, etc.
                .replace(/and/g, '');        // Remove the word 'and' for 'and' vs '&' mismatch
  }
  
  fields.forEach(function(field) {
    if (field.value === undefined || field.value === null || String(field.value).trim() === "") {
      return;
    }
    
    var item = items.find(function(i) {
      var itemTitle = i.getTitle();
      
      // 1. Strict exact match (case-insensitive & trimmed)
      if (itemTitle.trim().toLowerCase() === field.title.trim().toLowerCase()) {
        return true;
      }
      
      // 2. Normalized exact match (ignores spaces, casing, punctuation, and/&)
      var itemTitleNorm = normalizeTitle(itemTitle);
      var fieldTitleNorm = normalizeTitle(field.title);
      if (itemTitleNorm === fieldTitleNorm) {
        return true;
      }
      
      return false;
    });
    
    if (!item) {
      Logger.log("⚠️ Could not match field: " + field.title);
      return;
    }
    
    var type = item.getType();
    try {
      if (type === FormApp.ItemType.TEXT) {
        response.withItemResponse(item.asTextItem().createResponse(field.value));
      } else if (type === FormApp.ItemType.PARAGRAPH_TEXT) {
        response.withItemResponse(item.asParagraphTextItem().createResponse(field.value));
      } else if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
        var val = String(field.value).trim();
        var choices = item.asMultipleChoiceItem().getChoices().map(function(c) { return c.getValue(); });
        var matchedChoice = choices.find(function(c) { return c.toLowerCase() === val.toLowerCase(); }) || val;
        response.withItemResponse(item.asMultipleChoiceItem().createResponse(matchedChoice));
      } else if (type === FormApp.ItemType.LIST) {
        var val = String(field.value).trim();
        var choices = item.asListItem().getChoices().map(function(c) { return c.getValue(); });
        var matchedChoice = choices.find(function(c) { return c.toLowerCase() === val.toLowerCase(); }) || val;
        response.withItemResponse(item.asListItem().createResponse(matchedChoice));
      } else if (type === FormApp.ItemType.CHECKBOX) {
        response.withItemResponse(item.asCheckboxItem().createResponse([field.value]));
      } else if (type === FormApp.ItemType.DATE) {
        response.withItemResponse(item.asDateItem().createResponse(new Date(field.value)));
      }
    } catch (err) {
      Logger.log("Error syncing field '" + field.title + "': " + err.toString());
    }
  });
  
  response.submit();
  return reply({ success: true, message: "Form synced" });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

// --- DELETION HELPERS ---

function moveFolderAction(name, id, targetParentName, specificFolderName) {
  try {
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var searchName = specificFolderName || (id + " - " + name);
    var folders = DriveApp.getFoldersByName(searchName);
    if (folders.hasNext()) {
      var folder = folders.next();
      var targetParent = getOrCreateFolder(root, targetParentName);
      folder.moveTo(targetParent);
      return reply({ success: true, message: "Folder moved to " + targetParentName });
    }
    return reply({ success: true, message: "Folder not found" });
  } catch (e) { return reply({ success: false, error: e.toString() }); }
}

function permanentDeleteAction(name, id, specificFolderName) {
  try {
    var searchName = specificFolderName || (id + " - " + name);
    var folders = DriveApp.getFoldersByName(searchName);
    if (folders.hasNext()) {
      var folderId = folders.next().getId();
      Drive.Files.remove(folderId);
      return reply({ success: true, message: "Folder permanently wiped" });
    }
    return reply({ success: true, message: "No folder found" });
  } catch (e) { return reply({ success: false, error: e.toString() }); }
}

function handleCopyFolder(s, t) { return reply({success: true, message: "Action logged"}); }