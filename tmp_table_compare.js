const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname);
const srcRoot = path.join(root, 'src');
const sqlRoot = path.join(root, 'supabase');
const tableRegex = /\.from\(\s*['\"]([a-zA-Z0-9_\.]+)['\"]\)/g;
const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
const createViewRegex = /CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;

function walk(dir, pattern) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, pattern));
    } else if (entry.isFile() && full.endsWith(pattern)) {
      results.push(full);
    }
  }
  return results;
}

const refs = new Set();
for (const file of walk(srcRoot, '.ts')) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = tableRegex.exec(text))) {
    refs.add(m[1]);
  }
}

const sqlTables = new Set();
const sqlViews = new Set();
for (const file of walk(sqlRoot, '.sql')) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = createTableRegex.exec(text))) {
    sqlTables.add(m[1]);
  }
  while ((m = createViewRegex.exec(text))) {
    sqlViews.add(m[1]);
  }
}

console.log('CODE_TABLES:');
for (const t of [...refs].sort()) console.log(t);
console.log('\nSQL_TABLES:');
for (const t of [...sqlTables].sort()) console.log(t);
console.log('\nSQL_VIEWS:');
for (const t of [...sqlViews].sort()) console.log(t);
console.log('\nMISSING_FROM_SQL:');
for (const t of [...refs].sort()) {
  if (!sqlTables.has(t) && !sqlViews.has(t)) console.log(t);
}
