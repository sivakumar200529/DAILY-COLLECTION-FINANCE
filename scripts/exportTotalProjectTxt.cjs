const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputFile = path.join(rootDir, 'DAILY_COLLECTION_TOTAL_PROJECT.txt');

const excludeDirs = new Set(['node_modules', '.git', 'dist', 'build', '.system_generated', 'scratch', '.gemini']);
const excludeExts = new Set(['.jpg', '.jpeg', '.png', '.ico', '.svg', '.webp', '.mp4', '.pdf', '.zip']);
const excludeFileNames = new Set([
  'package-lock.json',
  'sample_data.json',
  'krs_finance_data.json',
  'krs_finance_data.backup.json',
  'project_monitoring_data.json',
  'project_monitoring_data.backup.json',
  'DAILY_COLLECTION_TOTAL_PROJECT.txt',
  'exportTotalProjectTxt.cjs'
]);

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludeDirs.has(entry.name)) {
        results = results.concat(getAllFiles(fullPath));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!excludeExts.has(ext) && !excludeFileNames.has(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const allFilePaths = getAllFiles(rootDir);
allFilePaths.sort();

let output = '';
const sep = '='.repeat(80);
const thinSep = '-'.repeat(80);

output += `${sep}\n`;
output += ` DAILY COLLECTION - COMPLETE PROJECT CODEBASE EXPORT\n`;
output += ` Generated on: ${new Date().toISOString()}\n`;
output += ` Total Source Files: ${allFilePaths.length}\n`;
output += `${sep}\n\n`;

output += `TABLE OF CONTENTS / FILE LIST:\n`;
output += `${thinSep}\n`;
allFilePaths.forEach((fp, idx) => {
  const rel = path.relative(rootDir, fp).replace(/\\/g, '/');
  output += `[${String(idx + 1).padStart(2, '0')}] ${rel}\n`;
});
output += `${thinSep}\n\n`;

let totalLines = 0;

allFilePaths.forEach((fp, idx) => {
  const rel = path.relative(rootDir, fp).replace(/\\/g, '/');
  const content = fs.readFileSync(fp, 'utf-8');
  const lines = content.split('\n').length;
  totalLines += lines;

  output += `${sep}\n`;
  output += `FILE [${idx + 1}/${allFilePaths.length}]: ${rel} (${lines} lines)\n`;
  output += `${sep}\n`;
  output += content;
  if (!content.endsWith('\n')) {
    output += '\n';
  }
  output += '\n';
});

output += `${sep}\n`;
output += `END OF PROJECT CODEBASE EXPORT - Total Lines of Code: ${totalLines}\n`;
output += `${sep}\n`;

fs.writeFileSync(outputFile, output, 'utf-8');
console.log(`Successfully generated ${outputFile} (${allFilePaths.length} files, ${totalLines} total lines, ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB)`);
