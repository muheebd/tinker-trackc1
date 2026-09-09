const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log(`Removed existing database at ${DB_PATH}`);
}

const db = new DatabaseSync(DB_PATH);
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
db.close();

console.log(`Database created at ${DB_PATH} with schema applied.`);
