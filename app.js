require("dotenv").config();
 
const express = require("express");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("./config/database");
 
const app = express();
const PORT = process.env.PORT || 3000;
 
// The system uses three roles: Requester (student/faculty), Technician (staff), Administrator (admin)
const ROLE_LABELS = { student: "Requester", faculty: "Requester", staff: "Technician", admin: "Administrator" };
 
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
 
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 4 }
}));
 
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.flash = req.session.flash || null;
  res.locals.roleLabel = (role) => ROLE_LABELS[role] || role;
  delete req.session.flash;
  next();
});
 
function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: "error", message: "Please log in to continue." };
    return res.redirect("/login");
  }
  next();
}
 
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.session.flash = { type: "error", message: "Please log in to continue." };
      return res.redirect("/login");
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render("error", {
        title: "Access denied",
        message: "You do not have permission to access this page."
      });
    }
    next();
  };
}
 
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
 
app.get("/", (req, res) => res.redirect(req.session.user ? "/dashboard" : "/login"));
 
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { title: "Sign in", error: null });
});
 
app.post("/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) {
    return res.status(400).render("login", { title: "Sign in", error: "Enter both your email and password." });
  }
  const account = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!account || !bcrypt.compareSync(password, account.password_hash)) {
    return res.status(401).render("login", { title: "Sign in", error: "Invalid email or password." });
  }
  req.session.user = { id: account.id, name: account.name, email: account.email, role: account.role };
  res.redirect("/dashboard");
});
 
app.post("/logout", requireLogin, (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});
 
// Dashboard: Administrator sees all requests, Technician sees only assigned jobs, Requester sees own requests
app.get("/dashboard", requireLogin, (req, res) => {
  const { id, role } = req.session.user;
  let scope = "";
  let params = [];
  if (role === "staff") {
    scope = "requests.assigned_to = ?";
    params = [id];
  } else if (role === "student" || role === "faculty") {
    scope = "requests.user_id = ?";
    params = [id];
  }
 
  const where = (extra) => {
    const parts = [scope, extra].filter(Boolean);
    return parts.length ? " WHERE " + parts.join(" AND ") : "";
  };
  const count = (extra) =>
    db.prepare("SELECT COUNT(*) AS n FROM requests" + where(extra)).get(...params).n;
 
  const counts = {
    total: count(""),
    pending: count("requests.status = 'Pending'"),
    progress: count("requests.status = 'In Progress'"),
    completed: count("requests.status = 'Completed'")
  };
  const recent = db.prepare(
    `SELECT requests.*, users.name AS requester_name
     FROM requests JOIN users ON users.id = requests.user_id${where("")}
     ORDER BY requests.created_at DESC LIMIT 6`
  ).all(...params);
 
  res.render("dashboard", { title: "Dashboard", counts, recent });
});
 
app.get("/requests/new", requireRole("student", "faculty"), (req, res) => {
  res.render("new-request", { title: "New request", error: null, form: {} });
});
 
app.post("/requests", requireRole("student", "faculty"), (req, res) => {
  const form = {
    title: String(req.body.title || "").trim(),
    category: String(req.body.category || "").trim(),
    location: String(req.body.location || "").trim(),
    priority: String(req.body.priority || "Normal"),
    description: String(req.body.description || "").trim(),
    is_safety: req.body.is_safety === "on" ? 1 : 0
  };
  const categories = ["Electrical", "Plumbing", "Furniture", "Air Conditioning", "Cleaning", "Other"];
  const priorities = ["Low", "Normal", "High", "Urgent"];
  if (!form.title || !form.category || !form.location || !form.description) {
    return res.status(400).render("new-request", { title: "New request", error: "Please complete all required fields.", form });
  }
  if (form.title.length > 100 || form.location.length > 120 || form.description.length > 1500 ||
      !categories.includes(form.category) || !priorities.includes(form.priority)) {
    return res.status(400).render("new-request", { title: "New request", error: "Please check the field values and length limits.", form });
  }
  const result = db.prepare(`
    INSERT INTO requests (user_id, title, category, location, priority, description, is_safety, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')
  `).run(req.session.user.id, form.title, form.category, form.location, form.priority, form.description, form.is_safety);
  req.session.flash = { type: "success", message: `Request #${result.lastInsertRowid} was submitted.` };
  res.redirect("/requests/mine");
});
 
app.get("/requests/mine", requireLogin, (req, res) => {
  const requests = db.prepare("SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC").all(req.session.user.id);
  res.render("my-requests", { title: "My requests", requests });
});
 
// Manage: Administrator sees all requests, Technician sees only requests assigned to them
app.get("/requests/manage", requireRole("admin", "staff"), (req, res) => {
  const status = String(req.query.status || "");
  const allowedStatuses = ["Pending", "In Progress", "Completed"];
  const isTechnician = req.session.user.role === "staff";
 
  let sql = `SELECT requests.*, users.name AS requester_name FROM requests JOIN users ON users.id = requests.user_id`;
  const where = [];
  const params = [];
  if (allowedStatuses.includes(status)) {
    where.push("requests.status = ?");
    params.push(status);
  }
  if (isTechnician) {
    where.push("requests.assigned_to = ?");
    params.push(req.session.user.id);
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY requests.created_at DESC";
 
  const requests = db.prepare(sql).all(...params);
  const staff = db.prepare("SELECT id, name FROM users WHERE role = 'staff' ORDER BY name").all();
  res.render("manage-requests", { title: "Manage requests", requests, staff, selectedStatus: status });
});
 
app.get("/requests/:id", requireLogin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).render("error", { title: "Not found", message: "That request could not be found." });
  const request = db.prepare(`SELECT requests.*, users.name AS requester_name, users.email AS requester_email, assigned.name AS assigned_name
    FROM requests JOIN users ON users.id = requests.user_id
    LEFT JOIN users AS assigned ON assigned.id = requests.assigned_to
    WHERE requests.id = ?`).get(id);
  if (!request) return res.status(404).render("error", { title: "Not found", message: "That request could not be found." });
 
  // Administrator: any request. Requester: own requests. Technician: only requests assigned to them.
  const role = req.session.user.role;
  const isOwner = request.user_id === req.session.user.id;
  const isAssignedTechnician = role === "staff" && request.assigned_to === req.session.user.id;
  if (role !== "admin" && !isOwner && !isAssignedTechnician) {
    return res.status(403).render("error", { title: "Access denied", message: "You do not have access to this request." });
  }
  res.render("request-details", { title: `Request #${request.id}`, request });
});
 
// Update: Technician can update only their own assigned jobs. Only the Administrator can assign.
app.post("/requests/:id/update", requireRole("admin", "staff"), (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "");
  const allowedStatuses = ["Pending", "In Progress", "Completed"];
  const existing = Number.isInteger(id)
    ? db.prepare("SELECT id, assigned_to FROM requests WHERE id = ?").get(id)
    : null;
 
  if (!existing || !allowedStatuses.includes(status)) {
    req.session.flash = { type: "error", message: "Invalid request or status." };
    return res.redirect("/requests/manage");
  }
 
  const isAdmin = req.session.user.role === "admin";
 
  if (!isAdmin && existing.assigned_to !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Access denied",
      message: "You can only update requests assigned to you."
    });
  }
 
  // Keep the current assignment unless the Administrator picks a technician
  let assignedTo = existing.assigned_to;
  if (isAdmin && req.body.assigned_to) {
    assignedTo = Number(req.body.assigned_to);
    const technician = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'staff'").get(assignedTo);
    if (!technician) {
      req.session.flash = { type: "error", message: "Please choose a valid technician." };
      return res.redirect("/requests/manage");
    }
  }
 
  db.prepare("UPDATE requests SET status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(status, assignedTo, id);
  req.session.flash = { type: "success", message: `Request #${id} was updated.` };
  res.redirect("/requests/manage");
});
 
app.get("/admin/users", requireRole("admin"), (req, res) => {
  const users = db.prepare("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC").all();
  res.render("users", { title: "User management", users });
});
 
app.get("/register", (req, res) => {
  res.render("register", { title: "Create account", error: null, form: {} });
});
 
app.post("/register", (req, res) => {
  const form = {
    name: String(req.body.name || "").trim(),
    email: String(req.body.email || "").trim().toLowerCase(),
    password: String(req.body.password || ""),
    role: String(req.body.role || "")
  };
  if (form.name.length < 2 || form.name.length > 80 || !validEmail(form.email) || form.password.length < 8 || !["student", "faculty"].includes(form.role)) {
    return res.status(400).render("register", { title: "Create account", error: "Enter a valid name and email, choose Student or Faculty, and use a password of at least 8 characters.", form });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(form.email)) {
    return res.status(409).render("register", { title: "Create account", error: "An account with that email already exists.", form });
  }
  const hash = bcrypt.hashSync(form.password, 12);
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").run(form.name, form.email, hash, form.role);
  req.session.flash = { type: "success", message: "Account created. You can now sign in." };
  res.redirect("/login");
});
 
app.use((req, res) => res.status(404).render("error", { title: "Page not found", message: "The page you requested does not exist." }));
 
app.listen(PORT, () => {
  console.log(`CampusCare is running at http://localhost:${PORT}`);
});
 
