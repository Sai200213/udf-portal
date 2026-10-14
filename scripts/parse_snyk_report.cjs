const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '../snyk_report.json');
const outputPath = path.join(__dirname, '../snyk_vulnerabilities_report.md');

try {
  const rawData = fs.readFileSync(reportPath, 'utf8');
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (e) {
    if (rawData.trim().startsWith('[')) {
      data = JSON.parse(rawData);
    } else {
      const lines = rawData.trim().split('\n').filter(Boolean);
      data = lines.map(line => JSON.parse(line));
    }
  }

  const projects = Array.isArray(data) ? data : [data];

  let mdContent = `# Snyk Security Vulnerability Report\n\n`;
  mdContent += `This report lists the third-party package dependencies vulnerabilities detected by the Snyk scan, matching the target list from the dashboard screenshot.\n\n`;

  mdContent += `## 📊 Project Severity Summary\n\n`;
  mdContent += `| Target / Project | Critical | High | Medium | Low | Package Manager |\n`;
  mdContent += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  const vulnDetails = [];

  projects.forEach((proj, idx) => {
    const list = Array.isArray(proj) ? proj : [proj];
    list.forEach(p => {
      const displayPath = p.displayTargetFile || p.path || `Project ${idx}`;
      const packageManager = p.packageManager || 'N/A';
      
      let critical = 0;
      let high = 0;
      let medium = 0;
      let low = 0;

      const vulns = p.vulnerabilities || [];
      vulns.forEach(v => {
        if (v.severity === 'critical') critical++;
        else if (v.severity === 'high') high++;
        else if (v.severity === 'medium') medium++;
        else if (v.severity === 'low') low++;
      });

      mdContent += `| **${displayPath}** | ${critical} | ${high} | ${medium} | ${low} | ${packageManager} |\n`;

      if (vulns.length > 0) {
        vulnDetails.push({
          target: displayPath,
          critical,
          high,
          medium,
          low,
          items: vulns
        });
      }
    });
  });

  mdContent += `\n---\n\n## 🔍 Critical & High Vulnerabilities Breakdown\n\n`;

  if (vulnDetails.length === 0) {
    mdContent += `No vulnerabilities found.\n`;
  } else {
    vulnDetails.forEach(detail => {
      const criticalAndHigh = detail.items.filter(v => v.severity === 'critical' || v.severity === 'high');
      if (criticalAndHigh.length === 0) return;

      mdContent += `### 📁 ${detail.target}\n`;
      mdContent += `*Total: ${detail.critical} Critical, ${detail.high} High, ${detail.medium} Medium, ${detail.low} Low*\n\n`;

      const seen = new Set();
      const uniqueVulns = [];
      criticalAndHigh.forEach(v => {
        const id = v.id || v.title;
        if (!seen.has(id)) {
          seen.add(id);
          uniqueVulns.push(v);
        }
      });

      uniqueVulns.forEach(v => {
        const severityBadge = v.severity === 'critical' ? '🔴 **CRITICAL**' : '🟠 **HIGH**';
        const fixStr = v.isUpgradable || v.isPatchable ? `Upgrade ${v.name}@${v.version} to ${v.upgradePath ? v.upgradePath.join(' or ') : 'latest'}` : 'No direct patch available';
        const desc = v.description ? v.description.substring(0, 300) + '...' : v.title;

        mdContent += `#### ${severityBadge}: ${v.title} in \`${v.name}\`\n`;
        mdContent += `*   **Vulnerability ID:** [${v.id}](${v.semver ? v.semver.vulnerable : 'https://security.snyk.io/vuln/' + v.id})\n`;
        mdContent += `*   **Introduced via:** \`${v.from ? v.from.join(' > ') : v.name}\`\n`;
        mdContent += `*   **Fix Action:** ${fixStr}\n`;
        mdContent += `*   **Details:** ${desc.replace(/\r?\n/g, ' ')}\n\n`;
      });
    });
  }

  fs.writeFileSync(outputPath, mdContent, 'utf8');
  console.log('Report generated successfully at:', outputPath);
} catch (err) {
  console.error('Error parsing Snyk JSON report:', err);
}
