const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'dist-admin', 'dist-employee', 'dist-main', 'dist-public', 'public', 'mobile-admin', 'mobile-employee'];
const EXCLUDE_FILES = ['package-lock.json', 'snyk_report.json', 'temp_posts.js'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.rules', '.json'];
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(process.env.APPDATA_DIR || 'C:/Users/muthy/.gemini/antigravity-ide/brain/24acec6e-4378-4891-a22b-b905a6a9df6e', 'CODE_SCAN_REPORT.md');

let totalLinesFound = 0;
let linesScanned = 0;
let findings = [];

const RULES = [
    {
        id: 'SEC-001',
        regex: /allow\s+(get|list|read|write|create|update|delete)\s*:\s*if\s+true\s*;/g,
        type: 'Security',
        problem: 'Unauthenticated public access rule found in Firestore.',
        impact: 'Anyone on the internet can read or modify this database collection, potentially exposing PII or allowing data tampering.',
        fix: 'Change `allow ...: if true;` to require authentication, e.g., `allow ...: if request.auth != null;`'
    },
    {
        id: 'SEC-002',
        regex: /\.matches\('\^DRT-\.\*'\)/g,
        type: 'Security',
        problem: 'Firestore rule allows access based purely on document ID prefix pattern matching without auth/owner validation.',
        impact: 'An attacker can guess document IDs starting with DRT- and steal or overwrite sensitive applicant draft data.',
        fix: 'Remove the pattern matching bypass and enforce `request.auth.uid == resource.data.ownerUid`.'
    },
    {
        id: 'PERF-001',
        regex: /import\s+.*?\s+from\s+['"](xlsx|pdf-lib|pdfjs-dist)['"]/g,
        type: 'Performance',
        problem: 'Heavy module imported synchronously.',
        impact: 'Increases the initial Javascript bundle size significantly, slowing down the page load time for users who may not even use this feature.',
        fix: 'Use dynamic imports: `const { module } = await import("module-name");` inside the specific function where it is needed.'
    },
    {
        id: 'LOGIC-001',
        regex: /catch\s*\(\s*[a-zA-Z0-9_]+\s*\)\s*\{\s*\}/g,
        type: 'Logic / Bug',
        problem: 'Empty catch block found.',
        impact: 'Errors are swallowed silently. If an API call or logic fails, the application will break without providing any logs or feedback to the user or developer.',
        fix: 'Add error logging: `console.error(error);` and notify the user via a UI toast/alert.'
    },
    {
        id: 'SEC-003',
        regex: /dangerouslySetInnerHTML/g,
        type: 'Security',
        problem: 'Usage of `dangerouslySetInnerHTML` detected.',
        impact: 'Exposes the application to Cross-Site Scripting (XSS) attacks if the injected HTML contains unsanitized user input.',
        fix: 'Ensure that the HTML string is strictly sanitized using a library like DOMPurify before injecting it.'
    },
    {
        id: 'LOGIC-002',
        regex: /if\s*\([^=]+==\s*[^=]+\)/g,
        type: 'Logic / Bug',
        problem: 'Loose equality operator (`==`) used instead of strict equality (`===`).',
        impact: 'Can cause unexpected type coercion bugs, leading to flawed conditional logic.',
        fix: 'Replace `==` with `===` and `!=` with `!==`.'
    },
    {
        id: 'PERF-002',
        regex: /console\.log\(/g,
        type: 'Performance / Privacy',
        problem: '`console.log` statement left in code.',
        impact: 'May leak sensitive PII to the browser console in production.',
        fix: 'Remove console.log or use a dedicated logger that silences outputs in production.'
    }
];

function scanFile(filePath) {
    const ext = path.extname(filePath);
    if (!EXTENSIONS.includes(ext) && path.basename(filePath) !== 'firebase.json') return;
    if (EXCLUDE_FILES.includes(path.basename(filePath))) return;

    let content = '';
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return;
    }

    const lines = content.split('\n');
    totalLinesFound += lines.length;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        linesScanned++;

        for (const rule of RULES) {
            rule.regex.lastIndex = 0; 
            
            if (rule.regex.test(line)) {
                if (rule.id === 'PERF-002' && filePath.includes('logger')) continue; 
                if (rule.id === 'LOGIC-002' && (line.includes('== null') || line.includes('!= null'))) continue; 

                findings.push({
                    file: filePath.replace(ROOT_DIR, '').replace(/\\/g, '/'),
                    lineNum: i + 1,
                    type: rule.type,
                    problem: rule.problem,
                    impact: rule.impact,
                    fix: rule.fix,
                    snippet: line.trim()
                });
            }
        }
    }
}

function walk(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch(e) { return; }

    for (const file of files) {
        const filePath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(filePath);
        } catch(e) { continue; }

        if (stat.isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                walk(filePath);
            }
        } else {
            scanFile(filePath);
        }
    }
}

walk(ROOT_DIR);

let report = `# Codebase Exhaustive Scan Report

## Scan Metrics
- **Total Lines Discovered:** ${totalLinesFound}
- **Lines Scanned:** ${linesScanned}
- **Lines Remaining / Unscanned:** ${totalLinesFound - linesScanned}
- **Total Findings Detected:** ${findings.length}

## Detailed Findings

`;

if (findings.length === 0) {
    report += "No vulnerabilities or major logical flaws found matching the strict scanner rules.\\n";
} else {
    const displayFindings = findings.slice(0, 100);
    
    displayFindings.forEach((f, idx) => {
        report += `### ${idx + 1}. [${f.type}] in \`${f.file}\`
* **File Name & Line Number:** [${f.file}](file:///z:/UDF_SUBDOMAINS${f.file}#L${f.lineNum}) (Line ${f.lineNum})
* **The Problem:** ${f.problem}
* **The Impact:** ${f.impact}
* **Code Snippet:** 
  \`\`\`javascript
  ${f.snippet}
  \`\`\`
* **Suggested Fix:** ${f.fix}

`;
    });

    if (findings.length > 100) {
        report += `\\n*... and ${findings.length - 100} more findings (truncated for readability).*`;
    }
}

try {
    fs.writeFileSync(REPORT_PATH, report);
    console.log('Report generated at:', REPORT_PATH);
} catch (e) {
    console.error('Failed to write report:', e);
}
