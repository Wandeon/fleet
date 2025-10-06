const fs = require('fs');
const sourceMap = JSON.parse(fs.readFileSync('/tmp/sourcemap.json', 'utf8'));

// Error is at line 1, column 13431
const line = 1;
const column = 13431;

console.log('Source Map Info:');
console.log(`Version: ${sourceMap.version}`);
console.log(`File: ${sourceMap.file}`);
console.log(`Sources: ${sourceMap.sources.length} files`);
console.log('');

// Parse mappings manually or use approximate match
console.log('Source files included:');
sourceMap.sources.forEach((src, idx) => {
  console.log(`  ${idx}: ${src}`);
});

console.log('\nSource content available:', sourceMap.sourcesContent ? 'YES' : 'NO');

if (sourceMap.sourcesContent) {
  // Search for .length in each source
  console.log('\nSearching for .length accesses in sources...\n');
  sourceMap.sources.forEach((src, idx) => {
    const content = sourceMap.sourcesContent[idx];
    if (content && content.includes('.length')) {
      const lines = content.split('\n');
      lines.forEach((line, lineNum) => {
        if (line.includes('.length') && !line.includes('?.length') && !line.includes('??')) {
          console.log(`${src}:${lineNum + 1}`);
          console.log(`  ${line.trim()}`);
        }
      });
    }
  });
}
