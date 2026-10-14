import log from "@/src/utils/logger";
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker source to a local bundled file
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface AadhaarDetails {
    fullName?: string;
    fatherName?: string;
    spouseName?: string;
    maritalStatus?: 'Single' | 'Married';
    dob?: string;
    gender?: string;
    aadhaarNo?: string;
    address?: string;
    mobile?: string;
    pincode?: string;
    issuedDate?: string;
}

export const extractTextFromPDF = async (file: File, password?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const typedarray = new Uint8Array(reader.result as ArrayBuffer);

                const loadingTask = pdfjsLib.getDocument({
                    data: typedarray,
                    password: password || '',
                });

                const pdf = await loadingTask.promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += pageText + '\n';
                }

                resolve(fullText);
            } catch (error: any) {
                if (error.name === 'PasswordException') {
                    reject(new Error('PASSWORD_REQUIRED'));
                } else {
                    reject(error);
                }
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

export const parseAadhaarText = (text: string): AadhaarDetails => {
    const details: AadhaarDetails = {};

    // 1. Aadhaar Number (XXXX XXXX XXXX)
    const aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b/g;
    const aadhaarMatches = text.match(aadhaarRegex);
    if (aadhaarMatches) {
        details.aadhaarNo = aadhaarMatches[0].replace(/\s/g, '');
    }

    // 2. Date of Birth (DOB: DD/MM/YYYY or Year of Birth: YYYY)
    const dobRegex = /DOB\s*:\s*(\d{2}\/\d{2}\/\d{4})|Date of Birth\s*:\s*(\d{2}\/\d{2}\/\d{4})/i;
    const dobMatch = text.match(dobRegex);
    if (dobMatch) {
        details.dob = dobMatch[1] || dobMatch[2];
    }

    // 3. Gender (MALE/FEMALE)
    const genderRegex = /(MALE|FEMALE|Transgender)/i;
    const genderMatch = text.match(genderRegex);
    if (genderMatch) {
        details.gender = genderMatch[0].toUpperCase() === 'MALE' ? 'Male' : (genderMatch[0].toUpperCase() === 'FEMALE' ? 'Female' : 'Other');
    }

    // 4. Pincode (6 digits)
    const pincodeRegex = /\b\d{6}\b/g;
    const pincodeMatches = text.match(pincodeRegex);
    if (pincodeMatches) {
        details.pincode = pincodeMatches[pincodeMatches.length - 1];
    }

    // 5. Relation (Father/Spouse) logic
    // Updated Regex to handle spaces like "S / O"
    // Also correctly terminate on Newline, DOB literal, Address literal, or any Digits if commas are missing
    const relationRegex = /(?:S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O)[\s:]+([a-zA-Z \.]+?)(?:,|Address|$|\n|DOB|[0-9])/i;
    const relationMatch = text.match(relationRegex);

    if (relationMatch) {
        // Extract raw prefix (e.g. "S / O") and clean it to standard form "S/O"
        const rawPrefix = text.match(/(S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O)/i)?.[0]?.toUpperCase().replace(/\s/g, '');
        const rawName = relationMatch[1].replace(/\s+/g, ' ').trim();

        if (details.gender === 'Female') {
            // User Rule: If Female and C/O (or W/O naturally), mark as Married and Spouse Name
            if (rawPrefix === 'C/O' || rawPrefix === 'W/O') {
                details.maritalStatus = 'Married';
                details.spouseName = rawName;
            } else {
                // D/O usually means father
                details.fatherName = rawName;
            }
        } else {
            // Males or Others
            // S/O, C/O usually Father for males in this context (unless C/O is someone else, but Father is safest default)
            details.fatherName = rawName;
        }
    }

    // 6. Mobile Number
    const mobileRegex = /(?:Mobile|Phone)[:\s]*([6-9]\d{9})/i;
    const mobileMatch = text.match(mobileRegex);
    if (mobileMatch) {
        details.mobile = mobileMatch[1];
    }

    // 7. Issued Date
    // Pattern: "Aadhaar no. issued: 26/06/2013" or similar
    const issueDateMatch = text.match(/(?:issued|issue date)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (issueDateMatch) {
        details.issuedDate = issueDateMatch[1];
    }

    // 8. Address
    // Regex for Address block often ending with pincode
    const addressRegex = /Address[:\s]+([\s\S]*?)(?=\d{6})[ \d{6}]*/i;
    const addressMatch = text.match(addressRegex);
    if (addressMatch) {
        let rawAddr = addressMatch[1].replace(/\n/g, ', ').trim();

        // Remove S/O, C/O, W/O and the Name from the start of the address
        // The address in Aadhaar often starts with "S/O : <Name> ," or similar.
        // We want to remove that part to get the actual address.
        // Regex: Start of string -> Relation Prefix -> Chars -> First Comma
        const relationPrefixRegex = /^(?:S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O)[:\s]+.*?(?:,|$)/i;
        rawAddr = rawAddr.replace(relationPrefixRegex, '').trim();

        // Clean up leading commas or spaces if (redundant)
        rawAddr = rawAddr.replace(/^,/, '').trim();

        if (details.pincode) rawAddr += ', ' + details.pincode;
        details.address = rawAddr.replace(/\s+/g, ' ');

        // Strategy D: Father/Spouse Name Fallback (If missing, check Address start)
        // In some formats, "S/O" prefix is missing, and the name is the first part of the address.
        // e.g. "Address: Talari Venkateshwar Rao, Flat No 307..."
        if (!details.fatherName && !details.spouseName) {
            const addressParts = details.address.split(',');
            if (addressParts.length > 1) {
                const potentialName = addressParts[0].trim();
                // Validate if it looks like a name (no digits, no "H.No", "Flat", "Plot", "Ward")
                // And reasonably long
                const hasDigits = /\d/.test(potentialName);
                const hasKeywords = /H\.?No|Flat|Plot|Ward|Door|#|No\./i.test(potentialName);

                if (!hasDigits && !hasKeywords && potentialName.length > 3) {
                    // It's likely the Father's Name / Care of / Spouse Name
                    // Check gender again to decide Father vs Spouse
                    if (details.gender === 'Female') {
                        // Default to Father still, unless "Husband" keyword found?
                        // Without "W/O" or "D/O" it's ambiguous.
                        // User said "IF YOU WON'T FIND S/O OR ANY MARK IT AS FATHER NAME"
                        details.fatherName = potentialName;
                    } else {
                        details.fatherName = potentialName;
                    }

                    // Remove it from address?
                    // Usually yes, address should start with H.No etc.
                    details.address = details.address.substring(potentialName.length).replace(/^,/, '').trim();
                }
            }
        }
    }

    // 9. Full Name - Robust Bilingual Logic

    // Strategy A: "To ... S/O" (Primary)
    // Updated Regex to handle spaces like "S / O"
    // Also strip out typical non-name chars *before* S/O if needed?
    const toMatch = text.match(/To[:\s]*([\s\S]*?)(?:S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O)/i);

    if (toMatch) {
        const contentBetween = toMatch[1];
        // Clean non-English chars. Keep spaces, dots, hyphens, quotes, commas.
        const cleanName = contentBetween.replace(/[^a-zA-Z\s\.\-\',]/g, ' ').replace(/\s+/g, ' ').trim();

        log.log("--- DEBUG: Strategy A (To...S/O) Raw ---", contentBetween);
        log.log("--- DEBUG: Strategy A Clean Name ---", cleanName);

        if (cleanName.length > 2) {
            details.fullName = cleanName;
        }
    }

    // Strategy B: "Issued Date ... DOB" (Secondary/Fallback as per User Request)
    // Pattern: "Aadhaar no. issued: 26/06/2013 <Telugu> Name <Telugu> DOB"
    // Only run if fullname is still missing or very short/invalid
    if (!details.fullName || details.fullName.length < 3) {
        // Find text between "issued" date and "DOB"
        // Capture group 1: content strictly between the date and "DOB"
        const issueToDobRegex = /(?:issued|issue date)[:\s]*\d{2}\/\d{2}\/\d{4}([\s\S]*?)(?:DOB|Date of Birth)/i;
        const issueMatch = text.match(issueToDobRegex);

        if (issueMatch) {
            const contentAfterIssue = issueMatch[1];
            // Clean non-English chars
            const cleanNameFallback = contentAfterIssue.replace(/[^a-zA-Z\s\.\-\',]/g, ' ').replace(/\s+/g, ' ').trim();

            log.log("--- DEBUG: Strategy B (Issued...DOB) Raw ---", contentAfterIssue);
            log.log("--- DEBUG: Strategy B Clean Name ---", cleanNameFallback);

            if (cleanNameFallback.length > 2) {
                details.fullName = cleanNameFallback;
            }
        }
    }

    // Strategy C: Last Resort (Proximity to DOB)
    if (!details.fullName && details.dob) {
        const lines = text.split('\n');
        const dobIndex = lines.findIndex(line => line.includes(details.dob!) || (details.dob && line.includes(details.dob.split('/')[2])));
        if (dobIndex > 0) {
            const potentialNameLines = lines.slice(Math.max(0, dobIndex - 4), dobIndex);
            const nameCandidates = potentialNameLines.filter(line =>
                !line.includes('DOB') && !line.includes('Year') && !line.includes('Govt') && !line.includes('India') &&
                /^[a-zA-Z\s\.]+$/.test(line.trim()) && line.trim().length > 3
            );
            if (nameCandidates.length > 0) details.fullName = nameCandidates[nameCandidates.length - 1].trim();
        }
    }

    log.log("--- DEBUG: Extracted Text ---");
    log.log(text);
    log.log("--- DEBUG: Parsed Details ---");
    log.log(details);

    return details;
};

// Utility to check encryption details manually from raw bytes
const analyzePdfEncryption = (arrayBuffer: ArrayBuffer) => {
    try {
        const text = new TextDecoder().decode(arrayBuffer);

        // Find ALL Occurrences of /V and /R (might be false positives but usually correct in context)
        // Usually /Encrypt references an object like 2 0 obj << /Filter /Standard /V 5 /R 6 ... >>

        const vMatches = [...text.matchAll(/\/V\s+(\d+)/g)];
        const rMatches = [...text.matchAll(/\/R\s+(\d+)/g)];
        const filterMatch = text.match(/\/Filter\s*\/([a-zA-Z0-9]+)/);

        console.warn("--- PDF ENCRYPTION ANALYSIS (Full Scan) ---");

        if (vMatches.length > 0) {
            vMatches.forEach(m => console.warn(`Found Version (/V): ${m[1]}`));
            if (vMatches.some(m => parseInt(m[1]) === 5)) {
                console.warn("⚠️ DETECTED AES-256 (Version 5). This is NOT supported by pdf-lib standard decryption.");
                console.warn("SOLUTION: You MUST use the 'Rasterization' (Image) method to unlock this file.");
            }
        } else {
            console.warn("Version (/V): Not found (might be encrypted differently)");
        }

        if (rMatches.length > 0) {
            rMatches.forEach(m => console.warn(`Found Revision (/R): ${m[1]}`));
        }

        console.warn(`Filter: ${filterMatch ? filterMatch[1] : 'Unknown'}`);
    } catch (e) {
        console.error("Failed to analyze encryption:", e);
    }
};

// Utility to remove password from PDF using pdfjs-dist (which actually supports decryption)
// Strategy: Open with pdfjs-dist (supports RC4-128, AES-128, AES-256), render pages to images,
// then create a brand new unencrypted PDF with pdf-lib.
export const removePdfPassword = async (file: File, password?: string): Promise<File> => {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    log.log("--- DEBUG: Attempting Password Removal. Password provided:", !!password);

    // Step 1: Open encrypted PDF with pdfjs-dist (it handles actual decryption)
    let pdf: any;
    try {
        const loadingTask = pdfjsLib.getDocument({
            data: data,
            password: password || '',
        });
        pdf = await loadingTask.promise;
        log.log("--- DEBUG: pdfjs-dist opened PDF successfully. Pages:", pdf.numPages);
    } catch (error: any) {
        if (error.name === 'PasswordException') {
            if (!password) {
                throw new Error('PASSWORD_REQUIRED');
            } else {
                // Password was provided but rejected
                throw new Error('INVALID_PASSWORD_OR_FORMAT');
            }
        }
        throw error;
    }

    // Step 2: Check if PDF is actually encrypted by trying to detect encryption markers
    // If pdfjs opened it without a password and it's not encrypted, just try pdf-lib direct copy
    if (!password) {
        try {
            const { PDFDocument } = await import('pdf-lib');
            const srcDoc = await PDFDocument.load(arrayBuffer);
            const newDoc = await PDFDocument.create();
            const copiedPages = await newDoc.copyPages(srcDoc, srcDoc.getPageIndices());
            copiedPages.forEach(p => newDoc.addPage(p));
            const savedBytes = await newDoc.save();
            log.log("--- DEBUG: PDF was not encrypted. Direct copy succeeded.");
            return new File([savedBytes as BlobPart], file.name, { type: 'application/pdf' });
        } catch {
            // pdf-lib couldn't handle it, fall through to rasterization
            log.log("--- DEBUG: pdf-lib direct copy failed, using rasterization instead.");
        }
    }

    // Step 3: Rasterize - render each page to canvas, embed as images in new PDF
    // This is the "print to PDF" equivalent - guaranteed to strip ALL encryption
    const { PDFDocument } = await import('pdf-lib');
    const newPdfDoc = await PDFDocument.create();

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Use scale 2.5 for high quality (Aadhaar PDFs are typically A4, this gives ~600 DPI equivalent)
        const viewport = page.getViewport({ scale: 2.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Could not create canvas context');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport,
        }).promise;

        // Convert canvas to JPEG with high quality
        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const jpgImage = await newPdfDoc.embedJpg(imgDataUrl);

        // Calculate page dimensions to match original aspect ratio
        // Scale back down: the image is at 2.5x, original viewport at scale 1.0
        const origViewport = page.getViewport({ scale: 1.0 });
        const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);

        newPage.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: origViewport.width,
            height: origViewport.height,
        });

        // Clean up canvas
        canvas.width = 0;
        canvas.height = 0;
    }

    const savedBytes = await newPdfDoc.save();
    log.log("--- DEBUG: Successfully created unlocked PDF via rasterization! Size:", savedBytes.byteLength, "bytes");

    return new File([savedBytes as BlobPart], file.name, { type: 'application/pdf' });
};




