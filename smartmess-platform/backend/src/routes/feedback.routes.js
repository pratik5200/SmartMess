const express = require("express");
const router = express.Router();
const prisma = require("../db");

// Helper to convert "07:30 AM" string to minutes from midnight
function parseTimeToMinutes(timeStr) {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
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

    // Time-lock verification:
    // Opens at meal's start_time and remains open until midnight (12:00 AM / EOD)
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const mealStart = parseTimeToMinutes(menu.start_time);

    if (currentMinutes < mealStart) {
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