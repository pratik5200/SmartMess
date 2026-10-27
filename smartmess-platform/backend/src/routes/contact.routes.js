const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const QUERIES_FILE = path.join(__dirname, "../../uploads/contact_queries.json");

// Optional Google Apps Script Webhook URL for Google Sheet sync
// Set GOOGLE_SHEET_WEBHOOK_URL in .env to auto-sync every submission to your Google Sheet
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL || "";

// Ensure uploads folder and queries file exist
function getQueries() {
  try {
    if (!fs.existsSync(QUERIES_FILE)) {
      const dir = path.dirname(QUERIES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(QUERIES_FILE, JSON.stringify([]));
      return [];
    }
    const raw = fs.readFileSync(QUERIES_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("Error reading contact queries:", err);
    return [];
  }
}

function saveQueries(queries) {
  try {
    const dir = path.dirname(QUERIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(QUERIES_FILE, JSON.stringify(queries, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving contact queries:", err);
  }
}

// Helper to escape CSV values
function escapeCsv(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// POST /api/contact - Submit a user query (records to local storage + Google Sheet)
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message, bhawan } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message content is required" });
    }

    const queries = getQueries();
    const newQuery = {
      id: "qry_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      name: (name || "Anonymous Student").trim(),
      email: (email || "").trim(),
      subject: (subject || "General Query").trim(),
      message: message.trim(),
      bhawan: bhawan || "Not Specified",
      status: "NEW",
      createdAt: new Date().toISOString(),
    };

    queries.unshift(newQuery);
    saveQueries(queries);

    // Forward to Google Sheet Webhook if configured
    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || GOOGLE_SHEET_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        fetch(webhookUrl, {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(newQuery),
        })
          .then(async (resp) => {
            const resultText = await resp.text();
            console.log("Google Sheet sync response:", resultText.substring(0, 100));
          })
          .catch((err) => {
            console.warn("Google Sheet webhook sync note:", err.message);
          });
      } catch (sheetErr) {
        console.warn("Failed to trigger Google Sheet webhook:", sheetErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Your query has been recorded successfully. Our team will get back to you shortly.",
      query: newQuery,
    });
  } catch (err) {
    console.error("Failed to process contact query:", err);
    return res.status(500).json({ error: "Failed to submit query. Please try again." });
  }
});

// GET /api/contact - List all queries (for staff/admin view)
router.get("/", (req, res) => {
  try {
    const queries = getQueries();
    return res.json({
      success: true,
      count: queries.length,
      queries,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve queries" });
  }
});

// GET /api/contact/csv - Live CSV Feed (Can be imported into any Google Sheet via =IMPORTDATA)
router.get("/csv", (req, res) => {
  try {
    const queries = getQueries();
    const headers = ["ID", "Timestamp", "Name", "Email", "Bhawan", "Subject", "Message", "Status"];
    const rows = queries.map((q) => [
      escapeCsv(q.id),
      escapeCsv(new Date(q.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })),
      escapeCsv(q.name),
      escapeCsv(q.email),
      escapeCsv(q.bhawan),
      escapeCsv(q.subject),
      escapeCsv(q.message),
      escapeCsv(q.status),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="smartmess_contact_queries.csv"');
    return res.send(csvContent);
  } catch (err) {
    console.error("Failed to export CSV:", err);
    return res.status(500).send("Failed to export queries as CSV");
  }
});

module.exports = router;
