/**
 * ==================================================================================
 * UNIQUE DELTA FORCE - HR PORTAL
 * AUTOMATED GOOGLE FORM & SPREADSHEET CREATOR UTILITY
 * ==================================================================================
 * 
 * PURPOSE:
 * If your current Google Form gets flagged, blocked, or stops working, this script
 * allows you to programmatically recreate a brand-new Google Form and linked Responses
 * Google Sheet in 5 seconds with all 40+ matching questions and types.
 * 
 * HOW TO USE:
 * 1. Go to your active Google Apps Script project (https://script.google.com/).
 * 2. Click the "+" icon next to Files and select "Script" to create a new file.
 * 3. Name it "FormCreator" (it will automatically save as FormCreator.gs).
 * 4. Paste this entire code into that file.
 * 5. Update the ROOT_FOLDER_ID variable below with your actual main folder ID.
 * 6. In the function dropdown at the top of the editor, select "createAndSetupNewForm".
 * 7. Click "Run" (You may need to approve Google Drive & Google Form permissions).
 * 8. View the execution log at the bottom. It will print the NEW Form ID.
 * 9. Update the FORM_ID variable in your main Apps Script to the new ID, and deploy as a new version.
 * 10. Open the new Form, enable your "performflow" extension, and you are good to go!
 */

// ⚠️ CHANGE THIS to your actual Google Drive Root Folder ID before running
var ROOT_FOLDER_ID = "1XuFLT5v5s1ZSdugKr1XzT0AdYkL-QgBX";

function createAndSetupNewForm() {
  try {
    var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var timestamp = new Date().toLocaleString();
    
    Logger.log("⌛ Starting Google Form & Sheet creation...");
    
    // 1. Create a brand-new Google Form
    var form = FormApp.create("HR Portal Onboarding Form - " + timestamp);
    var formFile = DriveApp.getFileById(form.getId());
    
    // Move the Form file to your main HR Portal folder in Drive
    formFile.moveTo(rootFolder);
    
    // Configure Form: Collect Respondent Email Address
    try {
      form.setCollectEmail(true);
      Logger.log("✅ Configured form to collect email addresses.");
    } catch (e) {
      Logger.log("⚠️ Could not set collect email setting: " + e.toString());
    }
    
    // 2. Add Questions (Strictly matching the titles in the web portal)
    
    // Simple Text Questions (Short Answer)
    var textQuestions = [
      "Name",
      "Contact Number",
      "Citizenship",
      "Blood Group",
      "Height",
      "Identity Marks",
      "Spouse Name",
      "Qualification",
      "Post of Apply",
      "Unit or Facility",
      "Any Police Case",
      "Reference Name",
      "Reference Relationship",
      "Reference Contact No",
      "Father Name",
      "Mother Name",
      "Father Mobile Number",
      "Mother Mobile Number",
      "Aadhar Card No",
      "PAN Card No",
      "UAN No or EPFO",
      "ESI No",
      "PVC (Police Verification Certificate)",
      "PVC Number (If YES)",
      "Bank Name",
      "Account No",
      "IFSC Code",
      "Branch Name",
      
      // File Upload Questions (Receives URL from the portal as a text answer)
      "Aadhar Card  (Front)", // Double space matches portal mapping exactly
      "Aadhar Card  (Back)",  // Double space matches portal mapping exactly
      "PAN  Card",            // Double space matches portal mapping exactly
      "Bank Passbook or Cheque",
      "SSC - 10th, INTER, DEGREE MEMO",
      "Photo",
      "PVC",
      "Electricity Bill"
    ];
    
    textQuestions.forEach(function(title) {
      form.addTextItem().setTitle(title);
      Logger.log("   Added Short Answer field: " + title);
    });
    
    // Paragraph Questions (Long Answer)
    var paragraphQuestions = [
      "Present Address",
      "Permanent Address",
      "Reference Address",
      "Previous Employment History",
      "Previous Company & Experience"
    ];
    
    paragraphQuestions.forEach(function(title) {
      form.addParagraphTextItem().setTitle(title);
      Logger.log("   Added Paragraph field: " + title);
    });
    
    // Multiple Choice Questions
    var genderItem = form.addMultipleChoiceItem().setTitle("Gender");
    genderItem.setChoices([
      genderItem.createChoice("Male"),
      genderItem.createChoice("Female"),
      genderItem.createChoice("Other")
    ]);
    Logger.log("   Added Multiple Choice field: Gender");
    
    var maritalItem = form.addMultipleChoiceItem().setTitle("Marital Status");
    maritalItem.setChoices([
      maritalItem.createChoice("Single"),
      maritalItem.createChoice("Married"),
      maritalItem.createChoice("Divorced"),
      maritalItem.createChoice("Widowed")
    ]);
    Logger.log("   Added Multiple Choice field: Marital Status");
    
    // Date Question
    form.addDateItem().setTitle("Date of Birth");
    Logger.log("   Added Date field: Date of Birth");
    
    // 3. Create a brand-new Google Sheet for responses
    var spreadsheet = SpreadsheetApp.create("HR Portal Responses Sheet - " + timestamp);
    var spreadsheetFile = DriveApp.getFileById(spreadsheet.getId());
    
    // Move the Responses Sheet file to your main HR Portal folder in Drive
    spreadsheetFile.moveTo(rootFolder);
    Logger.log("✅ Created responses sheet and moved it to Drive folder.");
    
    // 4. Link the Sheet to the Form
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
    Logger.log("✅ Linked spreadsheet to the new Google Form.");
    
    // 5. Output Results to the Logger Console
    Logger.log("\n==================================================================");
    Logger.log("🎉 SUCCESS! NEW FORM AND SHEET CREATED!");
    Logger.log("==================================================================");
    Logger.log("📂 Root Folder Name: " + rootFolder.getName());
    Logger.log("📝 New Form Name:    " + form.getTitle());
    Logger.log("🆔 NEW FORM ID:      " + form.getId());
    Logger.log("🔗 Form Edit URL:    " + form.getEditUrl());
    Logger.log("📊 Sheet Edit URL:   " + spreadsheet.getUrl());
    Logger.log("==================================================================");
    Logger.log("👉 STEPS TO FINISH:");
    Logger.log("1. Open your main Apps Script file.");
    Logger.log("2. Update the FORM_ID variable at the top with: \"" + form.getId() + "\"");
    Logger.log("3. Deploy a new version of the Web App (Deploy -> New Deployment).");
    Logger.log("4. Open the New Form Edit URL above and configure your 'performflow' add-on.");
    Logger.log("==================================================================\n");
    
  } catch (err) {
    Logger.log("❌ Error during form setup: " + err.toString());
  }
}
