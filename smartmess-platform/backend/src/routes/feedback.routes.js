const express = require("express");
const router = express.Router();
const prisma = require("../db");

// Helper to convert time string (e.g., "07:30 AM" or "7:30 PM") to minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let [hours, minutes] = [parseInt(match[1], 10), parseInt(match[2], 10)];
  const modifier = match[3].toUpperCase();
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function getISTMinutes() {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    let h = 0, m = 0;
    for (const part of parts) {
      if (part.type === 'hour') h = parseInt(part.value, 10);
      if (part.type === 'minute') m = parseInt(part.value, 10);
    }
    if (h === 24) h = 0;
    return h * 60 + m;
  } catch (e) {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

// Submit granular daily item rating
router.post("/daily", async (req, res) => {
  try {
    const { studentId, menuId, item_name, rating, comment } = req.body;

    const menu = await prisma.menu.findUnique({
      where: { id: menuId },
    });

    if (!menu) {
      return res.status(404).json({ error: "Meal entry not found" });
    }

    // Time-lock verification (Indian Standard Time):
    // Opens at meal's start_time and remains open until midnight (12:00 AM / EOD)
    const currentMinutes = getISTMinutes();
    const mealStart = parseTimeToMinutes(menu.start_time);

    // Allow a 2-minute buffer for client/server clock sync
    if (currentMinutes + 2 < mealStart) {
      return res.status(403).json({
        error: `Rating window not open yet. Rating opens at ${menu.start_time}.`,
      });
    }

    // Check if user already rated this item, and update or create
    let feedback;
    if (studentId) {
      const existing = await prisma.dailyFeedback.findFirst({
        where: { studentId, menuId, item_name }
      });
      if (existing) {
        feedback = await prisma.dailyFeedback.update({
          where: { id: existing.id },
          data: {
            rating: Number(rating),
            comment: comment || null,
          }
        });
      } else {
        feedback = await prisma.dailyFeedback.create({
          data: {
            studentId,
            menuId,
            item_name,
            rating: Number(rating),
            comment: comment || null,
          },
        });
      }
    } else {
      feedback = await prisma.dailyFeedback.create({
        data: {
          menuId,
          item_name,
          rating: Number(rating),
          comment: comment || null,
        },
      });
    }

    res.status(201).json({ message: "Feedback saved", feedback });
  } catch (error) {
    console.error("Daily feedback error:", error);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// Fetch all item ratings by a student for a specific menu
router.get("/daily/:studentId/:menuId", async (req, res) => {
  try {
    const { studentId, menuId } = req.params;
    const ratings = await prisma.dailyFeedback.findMany({
      where: { studentId, menuId }
    });
    res.json(ratings);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve daily item ratings" });
  }
});

// Submit Sunday weekly summary rating
router.post("/weekly", async (req, res) => {
  try {
    const { studentId, bhawanId, week_start, overall, suggestions } = req.body;

    const weekly = await prisma.weeklySummary.create({
      data: {
        studentId,
        bhawanId,
        week_start: new Date(week_start),
        overall: Number(overall),
        suggestions,
      },
    });

    res.status(201).json(weekly);
  } catch (error) {
    res.status(500).json({ error: "Failed to record weekly summary" });
  }
});

module.exports = router;