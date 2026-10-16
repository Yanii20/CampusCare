const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");
 
const db = new Database(path.join(__dirname, "..", "campuscare.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
 
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'staff', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
 
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Normal',
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    assigned_to INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );
`);
 
// Migration: add safety flag column to existing databases (IR-1)
const requestColumns = db.prepare("PRAGMA table_info(requests)").all();
if (!requestColumns.some(c => c.name === "is_safety")) {
  db.exec("ALTER TABLE requests ADD COLUMN is_safety INTEGER NOT NULL DEFAULT 0");
}
 
const seedUsers = [
  { name: "Campus Administrator", email: "admin@campuscare.local", password: "Admin123!", role: "admin" },
  { name: "Maintenance Staff", email: "staff@campuscare.local", password: "Staff123!", role: "staff" },
  { name: "Sample Student", email: "student@campuscare.local", password: "Student123!", role: "student" },
  { name: "Sample Faculty", email: "faculty@campuscare.local", password: "Faculty123!", role: "faculty" }
];
 
const insertUser = db.prepare("INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)");
for (const user of seedUsers) {
  insertUser.run(user.name, user.email, bcrypt.hashSync(user.password, 10), user.role);
}
 
module.exports = db;
 
