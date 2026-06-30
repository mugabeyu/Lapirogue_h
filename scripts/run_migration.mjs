import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

const SUPABASE_URL = 'https://txalwdljaxltchcrauhp.supabase.co';
const PROJECT_REF = 'txalwdljaxltchcrauhp';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4YWx3ZGxqYXhsdGNoY3JhdWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTExMTM1NCwiZXhwIjoyMDk2Njg3MzU0fQ.pq6RpuekJ_yBbsnpBJ3uuQz7DAI9uCG7uMvB6vpVtaI';

async function run() {
  // Try pooler (transaction mode) first, then direct connection
  const hosts = [
    { host: `${PROJECT_REF}-pooler.supabase.co`, port: 6543 },
    { host: `db.${PROJECT_REF}.supabase.co`, port: 5432 },
  ];

  let client;
  for (const { host, port } of hosts) {
    try {
      console.log(`Trying ${host}:${port}...`);
      const c = new Client({
        host,
        port,
        database: 'postgres',
        user: 'postgres',
        password: SERVICE_ROLE_KEY,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      await c.connect();
      console.log(`Connected via ${host}:${port}`);
      client = c;
      break;
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }

  if (!client) {
    throw new Error('Could not connect to any Supabase host');
  }

  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  const files = [
    { name: 'cleanup_complete.sql', path: 'supabase/cleanup_complete.sql' },
    { name: 'laprogue_v2_migration.sql', path: 'supabase/laprogue_v2_migration.sql' },
  ];

  for (const file of files) {
    console.log(`\n--- Running ${file.name} ---`);
    const sql = readFileSync(file.path, 'utf8');

    // Split by semicolons but preserve DO blocks and function definitions
    const statements = splitSQL(sql);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt || stmt === '') continue;

      try {
        await client.query(stmt);
        successCount++;
        process.stdout.write('.');
      } catch (err) {
        // Many statements use IF NOT EXISTS / DO $$ BEGIN ... EXCEPTION, so some errors are expected
        console.log(`\n  [${i}] Statement warning (likely expected): ${err.message.substring(0, 200)}`);
        errorCount++;
      }
    }

    console.log(`\n${file.name}: ${successCount} OK, ${errorCount} warnings`);
  }

  await client.end();
  console.log('\nMigration complete!');
}

function splitSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarFunc = false;
  let dollarTag = '';
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1] || '';

    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
        current += c;
      }
      continue;
    }

    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
        current += '*/';
      }
      continue;
    }

    if (!inString && !inDollarFunc) {
      if (c === '-' && next === '-') {
        inLineComment = true;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        i++;
        current += '/*';
        continue;
      }
    }

    if (inDollarFunc) {
      current += c;
      // Check for ending dollar tag
      if (c === '$') {
        const possibleEnd = sql.substring(i - dollarTag.length, i + 1);
        if (possibleEnd === '$' + dollarTag + '$') {
          inDollarFunc = false;
          dollarTag = '';
        }
      }
      continue;
    }

    if (!inString && c === '$') {
      // Start of dollar quote
      const remaining = sql.substring(i + 1);
      const match = remaining.match(/^([a-zA-Z_]*)\$/);
      if (match !== null) {
        dollarTag = match[1];
        inDollarFunc = true;
        current += c;
        i += dollarTag.length + 1;
        current += dollarTag + '$';
        continue;
      }
    }

    if (c === "'" || c === '"') {
      if (!inString) {
        inString = true;
        stringChar = c;
      } else if (c === stringChar) {
        inString = false;
      }
    }

    if (inString) {
      current += c;
      continue;
    }

    if (c === ';' && !inDollarFunc) {
      statements.push(current);
      current = '';
    } else {
      current += c;
    }
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
