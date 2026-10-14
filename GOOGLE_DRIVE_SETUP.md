# 📁 Google Drive Storage Setup (FREE & NO CARD)

Since Firebase Storage requires a credit card, we will use a **Google Apps Script Bridge**. This allows the HR Portal to save files directly into a folder in your Google Drive for free.

## Step 1: Create a Folder
1. Go to your [Google Drive](https://drive.google.com/).
2. Create a new folder named `HR Portal Uploads`.
3. Open the folder and **copy the Folder ID** from the web address (the string of letters/numbers after `/folders/...`).

## Step 2: Create the Upload Script
1. Go to [script.google.com](https://script.google.com/).
2. Click "**New Project**".
3. Delete everything in the editor and paste this code:

// --- PASTE THIS HIERARCHICAL CODE ---
var ROOT_FOLDER_ID = "1XuFLT5v5s1ZSdugKr1XzT0AdYkL-QgBX";
var FIREBASE_API_KEY = "AIzaSyCG5XXyHGQbJvITqCs08elQQsWz5J8Mw7w"; // Secured Firebase Web API Key for JWT Validation

var FOLDERS = {
    PENDING: 'Pending Employees',
    ACTIVE: 'Active Employees',
    RELIEVED: 'Relieved Employees',
    RECYCLE_BIN: 'Recycle Bin'
};

var FORM_ID = "1nO3SB-0g_RLJOpwj1qsReMoe37-b3kVEkYEVP6rmunc";

// SECURITY PATCH: Verify Firebase Auth token via Identity Toolkit
function verifyFirebaseToken(idToken) {
  if (!idToken) return false;
  
  var url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY;
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      payload: JSON.stringify({ idToken: idToken }),
      contentType: "application/json"
    });
    var result = JSON.parse(response.getContentText());
    if (result && result.users && result.users.length > 0) {
      return true; // Token is valid!
    }
  } catch(e) {
    return false; // Invalid token or API error
  }
  return false;
}

function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        
        // SECURITY PATCH: Enforce Authentication BEFORE allowing any action
        if (!verifyFirebaseToken(data.token)) {
            return reply({ success: false, error: "Unauthorized: Invalid or missing Firebase Authentication Token" });
        }

        var action = data.action;

        // 1. Handle Form Submissions
        if (action === 'submit_to_form') {
            return submitToForm(data);
        }

        // 2. Handle Folder Operations
        if (action === "delete_employee" ||
            action === "restore_employee" ||
            action === "permanent_delete_employee" ||
            action === "rename_employee_folder" ||
            action === "create_employee_folder" || // Support creating new folder
            action === "copy_folder_contents" ||   // Support copying docs
            action === "copy_specific_subfolders" || // Support selective copy
            action === "block_employee") {
            return handleFolderOperation(data);
        }

        // 3. Handle File Uploads
        if (data.base64) {
            return handleUpload(data);
        }

        return reply({ success: false, error: "Invalid action" });
    } catch (error) {
        return reply({ success: false, error: error.toString() });
    }
}

// ============================================
// FOLDER OPERATIONS
// ============================================
function handleFolderOperation(data) {
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);

    // Portal sends 'oldFolderName' (rename), 'folderName' (delete), or constructs from ID/Name
    var searchName = data.oldFolderName || data.folderName || (data.uniqueId + " - " + data.employeeName);

    // --- NEW: CREATE FOLDER ACTION ---
    if (data.action === "create_employee_folder") {
        var active = getOrCreateFolder(root, FOLDERS.ACTIVE);
        // Standard Portal Format: ID - Name
        var folderName = data.uniqueId + " - " + data.employeeName;

        // Check if exists first to avoid duplicates
        var existing = getFolderByName(active, folderName);
        if (existing) {
            return reply({ success: true, message: "Folder already exists", folderId: existing.getId() });
        }

        var newFolder = active.createFolder(folderName);
        return reply({ success: true, message: "Created new folder", folderId: newFolder.getId() });
    }

    // --- NEW: COPY FOLDER CONTENTS ACTION ---
    if (data.action === "copy_folder_contents") {
        var active = getOrCreateFolder(root, FOLDERS.ACTIVE);
        // Source might be in RELIEVED (most likely for rejoin) or ACTIVE/PENDING
        var relieved = getOrCreateFolder(root, FOLDERS.RELIEVED);
        var pending = getOrCreateFolder(root, FOLDERS.PENDING);

        var sourceFolder = getFolderByName(root, data.sourceFolderName) ||
            getFolderByName(relieved, data.sourceFolderName) ||
            getFolderByName(active, data.sourceFolderName) ||
            getFolderByName(pending, data.sourceFolderName);

        var targetFolder = getFolderByName(active, data.targetFolderName);

        if (!sourceFolder) return reply({ success: false, error: "Source folder not found: " + data.sourceFolderName });
        if (!targetFolder) return reply({ success: false, error: "Target folder not found: " + data.targetFolderName });

        var files = sourceFolder.getFiles();
        while (files.hasNext()) {
            var file = files.next();
            file.makeCopy(file.getName(), targetFolder);
        }

        return reply({ success: true, message: "Files copied successfully" });
    }

    // --- NEW: COPY SPECIFIC SUBFOLDERS ACTION ---
    if (data.action === "copy_specific_subfolders") {
        var active = getOrCreateFolder(root, FOLDERS.ACTIVE);
        var relieved = getOrCreateFolder(root, FOLDERS.RELIEVED);
        var pending = getOrCreateFolder(root, FOLDERS.PENDING);

        var sourceFolder = getFolderByName(root, data.sourceFolderName) ||
            getFolderByName(relieved, data.sourceFolderName) ||
            getFolderByName(active, data.sourceFolderName) ||
            getFolderByName(pending, data.sourceFolderName);

        var targetFolder = getFolderByName(active, data.targetFolderName);

        if (!sourceFolder) return reply({ success: false, error: "Source folder not found" });
        if (!targetFolder) return reply({ success: false, error: "Target folder not found" });

        var foldersToCopy = data.foldersToCopy || [];
        var report = [];

        for (var i = 0; i < foldersToCopy.length; i++) {
            var subName = foldersToCopy[i];
            var subSource = getFolderByName(sourceFolder, subName);

            if (subSource) {
                var subTarget = getOrCreateFolder(targetFolder, subName);
                var files = subSource.getFiles();
                var count = 0;
                while (files.hasNext()) {
                    var file = files.next();
                    file.makeCopy(file.getName(), subTarget);
                    count++;
                }
                report.push(subName + ": " + count + " files");
            } else {
                report.push(subName + ": Not found");
            }
        }

        return reply({ success: true, message: "Selective copy complete", details: report });
    }
    // ---------------------------------

    if (!searchName || searchName.indexOf('undefined') !== -1) {
        return reply({ success: false, error: "Identification failed: Name or ID is missing" });
    }

    var parents = [
        getOrCreateFolder(root, FOLDERS.ACTIVE),
        getOrCreateFolder(root, FOLDERS.PENDING),
        getOrCreateFolder(root, FOLDERS.RELIEVED),
        getOrCreateFolder(root, FOLDERS.RECYCLE_BIN),
        root
    ];

    var employeeFolder = null;
    for (var i = 0; i < parents.length; i++) {
        var found = getFolderByName(parents[i], searchName);
        if (found) { employeeFolder = found; break; }
    }

    if (!employeeFolder) {
        return reply({ success: false, error: "Folder not found: " + searchName });
    }

    // --- EXECUTE ACTIONS ---
    if (data.action === "rename_employee_folder" && data.newFolderName) {
        employeeFolder.setName(data.newFolderName);
        var activeFolder = getOrCreateFolder(root, FOLDERS.ACTIVE);
        employeeFolder.moveTo(activeFolder);
        return reply({ success: true, message: "Renamed and Moved to Active" });
    }

    if (data.action === "delete_employee") {
        var bin = getOrCreateFolder(root, FOLDERS.RECYCLE_BIN);
        employeeFolder.moveTo(bin);
        return reply({ success: true, message: "Moved to Recycle Bin" });
    }

    if (data.action === "restore_employee") {
        var active = getOrCreateFolder(root, FOLDERS.ACTIVE);
        employeeFolder.moveTo(active);
        return reply({ success: true, message: "Restored to Active" });
    }

    if (data.action === "block_employee") {
        var relieved = getOrCreateFolder(root, FOLDERS.RELIEVED);
        employeeFolder.moveTo(relieved);
        return reply({ success: true, message: "Moved to Relieved/Blocked" });
    }

    if (data.action === "permanent_delete_employee") {
        employeeFolder.setTrashed(true);
        return reply({ success: true, message: "Permanently deleted" });
    }

    return reply({ success: true, message: "No action taken" });
}

// ============================================
// FILE UPLOAD
// ============================================
function handleUpload(data) {
    var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var isPending = data.uniqueId && data.uniqueId.startsWith('SUB-');
    var targetParent = getOrCreateFolder(root, isPending ? FOLDERS.PENDING : FOLDERS.ACTIVE);

    // Standard Portal Format: ID - Name
    var folderName = data.uniqueId ? (data.uniqueId + " - " + data.employeeName) : data.employeeName;
    var employeeFolder = getOrCreateFolder(targetParent, folderName);

    var base64String = data.base64;
    // Strip metadata prefix if present
    if (base64String.indexOf(',') !== -1) {
        base64String = base64String.split(',')[1];
    }

    // Determine Subfolder based on Operation Name
    var subFolderName = null;
    var op = data.operationName || "";

    if (op === "Joining Documents" || op === "Profile Completion") subFolderName = "Joining Documents";
    else if (op === "Leave Proofs") subFolderName = "Leave Requests";
    else if (op === "Profile Updates") subFolderName = "Account Updates";
    else if (op === "Resignations") subFolderName = "Resignations";
    else if (op.indexOf("Discip") !== -1) subFolderName = "Disciplinary Actions";

    var targetFolder = employeeFolder;
    if (subFolderName) {
        targetFolder = getOrCreateFolder(employeeFolder, subFolderName);
    }

    var decoded = Utilities.base64Decode(base64String);
    var blob = Utilities.newBlob(decoded, "application/octet-stream", data.filename);

    var file = targetFolder.createFile(blob);
    if (data.operationName) {
        file.setName(data.operationName + " - " + data.filename);
    }

    return reply({
        success: true,
        url: file.getUrl(),
        fileId: file.getId()
    });
}

// ============================================
// FORM SUBMISSION
// ============================================
function submitToForm(data) {
    try {
        var fields = data.fields;
        if (!fields || fields.length === 0) return reply({ success: false, error: "No fields provided" });
        var form = FormApp.openById(FORM_ID);
        var items = form.getItems();
        var response = form.createResponse();
        var titleMap = {};
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var key = item.getTitle().trim().toLowerCase().replace(/\s+/g, ' ');
            titleMap[key] = item;
        }
        var filled = [];
        var failed = [];
        for (var j = 0; j < fields.length; j++) {
            var title = fields[j].title;
            var val = fields[j].value;
            if (!val || val === "undefined" || val === "null") continue;
            var lookupKey = title.trim().toLowerCase().replace(/\s+/g, ' ');
            var matchedItem = titleMap[lookupKey];
            if (matchedItem) {
                try {
                    var itemType = matchedItem.getType();
                    if (itemType == FormApp.ItemType.PARAGRAPH_TEXT) {
                        response.withItemResponse(matchedItem.asParagraphTextItem().createResponse(String(val)));
                    } else {
                        response.withItemResponse(matchedItem.asTextItem().createResponse(String(val)));
                    }
                    filled.push(title);
                } catch (e) { failed.push(title + " (" + e.toString() + ")"); }
            } else { failed.push(title); }
        }
        response.submit();
        return reply({ success: true, filled: filled, failed: failed });
    } catch (e) { return reply({ success: false, error: e.toString() }); }
}

// ============================================
// HELPERS
// ============================================
function reply(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function getOrCreateFolder(parent, name) {
    var folders = parent.getFoldersByName(name);
    return folders.hasNext() ? folders.next() : parent.createFolder(name);
}
function getFolderByName(parent, name) {
    var folders = parent.getFoldersByName(name);
    return folders.hasNext() ? folders.next() : null;
}
```

### **How this works:**
1. The script automatically creates a **"Recycle Bin"** folder inside your main HR Portal folder.
2. When you soft-delete an employee:
    *   📂 Their folder is **moved** (not trashed) to the Recycle Bin subfolder.
3. When you restore an employee:
    *   📂 Their folder is **moved back** to the main directory.
4. Permanent deletion removes the Firestore record but **keeps** the folder in Recycle Bin for safety.

## Step 3: Deployment Settings (Important)
1. Click "**Deploy**" -> "**New Deployment**".
2. Select type: "**Web App**".
3. **Description**: `HR Portal Storage`.
4. **Execute as**: `Me` (Your email).
5. **Who has access**: `Anyone` (Crucial for the portal to talk to it).
6. Click "**Deploy**".
7. Copy the "**Web App URL**" (it starts with `https://script.google.com/macros/s/...`).

## Step 4: Give me the URL
Paste that Web App URL here, and I will update the code to use it instead of the 750KB limit!
