const express = require("express");
const db = require("../config/database");

module.exports = function (requireRole) {
  const router = express.Router();

  router.get("/", requireRole("admin", "staff"), (req, res) => {
    const total = db.prepare("SELECT COUNT(*) AS n FROM requests").get().n;

    const byStatus = db.prepare(
      "SELECT status, COUNT(*) AS n FROM requests GROUP BY status ORDER BY n DESC"
    ).all();

    const byCategory = db.prepare(
      "SELECT category, COUNT(*) AS n FROM requests GROUP BY category ORDER BY n DESC"
    ).all();

    const byLocation = db.prepare(
      "SELECT location, COUNT(*) AS n FROM requests GROUP BY location ORDER BY n DESC LIMIT 10"
    ).all();

    const avg = db.prepare(
      `SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24) AS hours
       FROM requests WHERE status = 'Completed'`
    ).get().hours;

    res.render("reports", {
      title: "Reports",
      total,
      byStatus,
      byCategory,
      byLocation,
      avgHours: avg === null ? null : avg.toFixed(1)
    });
  });

  return router;
};