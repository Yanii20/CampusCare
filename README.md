# CampusCare — Campus Maintenance Request System

A Node.js and Express web application for submitting, tracking, and managing campus maintenance requests. This is a student project scaffold for the Campus System midterm.

## Features
- Login/logout with session-based authentication
- Role-based access for students, faculty, maintenance staff, and administrators
- Submit and track maintenance requests
- Persistent SQLite storage
- Admin/staff request management, assignment, and status updates
- Input validation and password hashing
- Admin user list
- Responsive EJS/HTML/CSS interface

## Requirements
- Node.js (LTS recommended)
- Git
- npm

## Installation
1. Open this folder in VS Code.
2. In the terminal, run `npm install`.
3. Copy `.env.example` to `.env` and change `SESSION_SECRET` to a long random value.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The SQLite database file `campuscare.sqlite` is created automatically when the application starts.

## Demo accounts
These accounts are seeded for local classroom testing. Change or remove them before any real deployment:
- Admin: `admin@gmail.com` / `Admin123!`
- Maintenance staff: `staff@gmail.com` / `Staff123!`
- Student: `student@gmail.com` / `Student123!`
- Faculty: `faculty@campuscare.local` / `Faculty123!`

Registration is available only for Student and Faculty roles. Staff/admin accounts are seeded by the local demo setup; the public registration form cannot create privileged accounts.

## Project structure
- `app.js` — Express app, routes, sessions, validation and authorization
- `config/database.js` — SQLite schema and local demo accounts
- `views/` — EJS page templates
- `views/partials/` — shared header/footer
- `public/css/` — styles
- `.env.example` — environment variable template

## Testing checklist
- Log in with valid and invalid credentials
- Try submitting a request with missing fields
- Submit a valid request and refresh/restart to verify persistence
- Confirm students only see their own requests
- Confirm a student cannot open `/requests/manage` or `/admin/users`
- Log in as staff/admin and update a request's status and assignment
- Log out and try to open `/dashboard`

## Known limitations
- This is an educational starter, not production-ready.
- Sessions use the default in-memory session store; configure a persistent session store for deployment.
- Demo credentials are intentionally included for local testing only.
- No file/image upload or email notification is implemented.
- User management currently displays accounts but does not create privileged roles through the UI.

## AI Assistance Disclosure
AI assistance was used to help draft and organize parts of the starter implementation and documentation. The team must review, understand, test, and modify the code and disclose assistance according to the instructor's requirements.

## License
This project is provided for educational use under the MIT License. See `LICENSE`.
