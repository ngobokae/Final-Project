import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
});

// Create connection with loaded env vars
const dbConfig = {
  host: envVars.DB_HOST || 'localhost',
  user: envVars.DB_USER || 'root',
  password: envVars.DB_PASSWORD || '',
  database: envVars.DB_NAME || 'manufacturing_system',
};

const pool = mysql.createPool(dbConfig);

const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    throw error;
  }
};

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    const sqlFile = path.join(__dirname, 'add-file-upload-tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolon to get individual SQL statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      try {
        await query(statement);
        console.log('✓ Success');
      } catch (error) {
        // Ignore "table already exists" and "duplicate column" errors
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.message.includes('already exists') ||
            error.message.includes('Duplicate column') ||
            error.message.includes('Duplicate key')) {
          console.log('✓ Already exists (skipping)');
        } else {
          console.error('✗ Error:', error.message);
        }
      }
    }

    console.log('Migration complete!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
