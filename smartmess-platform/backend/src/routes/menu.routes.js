const express = require("express");
const router = express.Router();
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const prisma = require("../db");
const fs = require("fs");
const path = require("path");

// 1. Create a folder to save the uploaded signatures securely
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 2. Configure multer to accept multiple specific files
const upload = multer({ storage: multer.memoryStorage() });
const fileUploads = upload.fields([
  { name: "menuFile", maxCount: 1 },
  { name: "secSign", maxCount: 1 },
  { name: "asstWardenSign", maxCount: 1 },
  { name: "hrSign", maxCount: 1 },
  { name: "ccbSign", maxCount: 1 },
  { name: "wardenSign", maxCount: 1 },
]);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// High-performance in-memory cache for staff feedback queries
const feedbackCache = new Map(); // bhawanId -> { data, timestamp }
const selectionCountsCache = new Map(); // bhawanId -> { data, timestamp }
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function invalidateFeedbackCache(bhawanId) {
    if (bhawanId) {
        feedbackCache.delete(bhawanId);
        selectionCountsCache.delete(bhawanId);
    } else {
        feedbackCache.clear();
        selectionCountsCache.clear();
    }
}

function invalidateSelectionCache(bhawanId) {
    if (bhawanId) {
        selectionCountsCache.delete(bhawanId);
    } else {
        selectionCountsCache.clear();
    }
}

// 3. The Upload Route
router.post("/upload", fileUploads, async (req, res) => {
  try {
    const { bhawanId, startDate, endDate } = req.body; 

    if (!bhawanId) {
        return res.status(400).json({ error: "Bhawan ID is missing from the request." });
    }

    if (!req.files || !req.files["menuFile"]) {
      return res.status(400).json({ error: "Menu file is required" });
    }

    const menuFile = req.files["menuFile"][0];

    // --- SAVE THE MENU IMAGE TO THE SERVER FOR VIEWING LATER ---
    const ext = menuFile.originalname.split('.').pop();
    const menuFileName = `menu-${bhawanId}-latest.${ext}`;
    
    const existingFiles = fs.readdirSync(UPLOADS_DIR);
    existingFiles.forEach(file => {
        if (file.startsWith(`menu-${bhawanId}-latest.`)) {
            fs.unlinkSync(path.join(UPLOADS_DIR, file));
        }
    });
    fs.writeFileSync(path.join(UPLOADS_DIR, menuFileName), menuFile.buffer);

    // --- A. PROCESS THE MENU WITH GEMINI ---
    const filePart = {
      inlineData: {
        data: menuFile.buffer.toString("base64"),
        mimeType: menuFile.mimetype,
      },
    };

const prompt = `
You are an expert data extractor parsing a physical college mess menu. 

CRITICAL RULES:
1. DYNAMIC TIMINGS: Do NOT hardcode timings. Look closely at the menu to find the start_time and end_time for each meal. If a day (like Sunday) has different timings, extract them exactly as written. ONLY if no timings are printed on the page, use these defaults: Breakfast (07:30 AM - 09:30 AM), Lunch (12:30 PM - 02:30 PM), Dinner (07:30 PM - 09:30 PM).
2. THE "DAILY" ROW: The bottom row contains "Daily" items. DO NOT mix these into Monday-Sunday. Extract them as a completely separate 8th day called "Daily".
3. SPECIAL DINNER: If a cell says "SPECIAL DINNER", output exactly "SPECIAL DINNER" in the items array for that specific meal. Do not skip it.

You MUST return STRICT JSON using this EXACT structure (24 objects total: 7 regular days + 1 Daily row, 3 meals each). Fill in the blanks based on the image:

[
  {"day": "Monday", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Monday", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Monday", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Tuesday", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Tuesday", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Tuesday", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Wednesday", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Wednesday", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Wednesday", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Thursday", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Thursday", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Thursday", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Friday", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Friday", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Friday", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Saturday", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Saturday", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Saturday", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Sunday", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Sunday", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Sunday", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Daily", "meal_type": "Breakfast", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Daily", "meal_type": "Lunch", "start_time": "...", "end_time": "...", "items": []},
  {"day": "Daily", "meal_type": "Dinner", "start_time": "...", "end_time": "...", "items": []}
]
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [prompt, filePart],
      config: { responseMimeType: "application/json" },
    });

    const menuEntries = JSON.parse(response.text.trim());

    const createdMenus = await Promise.all(
      menuEntries.map((entry) =>
        prisma.menu.create({
          data: {
            bhawanId,
            week_start: new Date(startDate), 
            week_end: new Date(endDate),     
            day: entry.day,
            meal_type: entry.meal_type,
            start_time: entry.start_time,
            end_time: entry.end_time,
            items: entry.items,
          },
        })
      )
    );

    // --- B. PROCESS THE SIGNATURES (IF UPLOADED) ---
    const bhawanUpdateData = {};

    const processSignature = (fileArray, fieldName) => {
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const ext = file.originalname.split('.').pop();
        const fileName = `${bhawanId}-${fieldName}-${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, fileName), file.buffer);
        return `http://localhost:5000/uploads/${fileName}`;
      }
      return null;
    };

    const secSign = processSignature(req.files["secSign"], "secretary");
    if (secSign) bhawanUpdateData.messSecretarySignUrl = secSign;
    const wardenSign = processSignature(req.files["asstWardenSign"], "asstWarden");
    if (wardenSign) bhawanUpdateData.asstWardenSignUrl = wardenSign;
    const hrSign = processSignature(req.files["hrSign"], "managerHr");
    if (hrSign) bhawanUpdateData.managerHrSignUrl = hrSign;
    const ccbSign = processSignature(req.files["ccbSign"], "managerCcb");
    if (ccbSign) bhawanUpdateData.managerCcbSignUrl = ccbSign;
    const messWardenSign = processSignature(req.files["wardenSign"], "messWarden");
    if (messWardenSign) bhawanUpdateData.messWardenSignUrl = messWardenSign;

    if (Object.keys(bhawanUpdateData).length > 0) {
      await prisma.bhawan.update({
        where: { id: bhawanId },
        data: bhawanUpdateData
      });
    }

    // --- C. AUTOMATIC STORAGE RETENTION: KEEP ONLY LATEST 2 WEEKS ---
    try {
      const distinctWeeks = await prisma.menu.findMany({
        where: { bhawanId },
        select: { week_start: true },
        distinct: ['week_start'],
        orderBy: { week_start: 'desc' }
      });

      if (distinctWeeks.length > 2) {
        const weeksToDelete = distinctWeeks.slice(2).map(w => w.week_start);
        
        const oldMenus = await prisma.menu.findMany({
          where: { bhawanId, week_start: { in: weeksToDelete } },
          select: { id: true }
        });
        const oldMenuIds = oldMenus.map(m => m.id);

        if (oldMenuIds.length > 0) {
          await prisma.mealSelection.deleteMany({
            where: { menuId: { in: oldMenuIds } }
          });
          await prisma.dailyFeedback.deleteMany({
            where: { menuId: { in: oldMenuIds } }
          });
          await prisma.feedback.deleteMany({
            where: { menuId: { in: oldMenuIds } }
          });
          await prisma.menu.deleteMany({
            where: { id: { in: oldMenuIds } }
          });
          await prisma.weeklySummary.deleteMany({
            where: { bhawanId, week_start: { in: weeksToDelete } }
          });
        }
      }
    } catch (cleanupErr) {
      console.error("Automatic week cleanup error:", cleanupErr);
    }

    invalidateFeedbackCache(bhawanId);

    res.status(201).json({
      message: `Successfully populated menu and updated signatures (if any).`,
      menus: createdMenus,
    });
  } catch (error) {
    console.error("Menu parsing error:", error);
    res.status(500).json({ error: "Failed to parse menu file" });
  }
});

// Helper to check if a menu's week is completed (past Sunday 23:59:59.999)
function isMenuWeekCompleted(menu) {
  if (!menu) return true;
  let end = menu.week_end ? new Date(menu.week_end) : new Date(menu.week_start);
  if (!menu.week_end) {
    end.setUTCDate(end.getUTCDate() + 6);
  }
  const expiry = new Date(end);
  expiry.setUTCHours(23, 59, 59, 999);
  return Date.now() > expiry.getTime();
}

// ---------------------------------------------------------
// Fetch current day menu
// ---------------------------------------------------------
router.get("/today/:bhawanId", async (req, res) => {
  try {
    const { bhawanId } = req.params;
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = days[new Date().getDay()];

    const latestMenu = await prisma.menu.findFirst({
      where: { bhawanId },
      orderBy: { week_start: 'desc' } 
    });

    if (!latestMenu || isMenuWeekCompleted(latestMenu)) {
      return res.json([]); 
    }

    const menus = await prisma.menu.findMany({
      where: { bhawanId: bhawanId, day: currentDay, week_start: latestMenu.week_start },
      include: { bhawan: true }
    });
    
    res.json(menus);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve today's menu" });
  }
});

// ---------------------------------------------------------
// Fetch the full week menu
// ---------------------------------------------------------
router.get("/week/:bhawanId", async (req, res) => {
  try {
    const { bhawanId } = req.params;
    const latestMenu = await prisma.menu.findFirst({
      where: { bhawanId },
      orderBy: { week_start: 'desc' } 
    });

    if (!latestMenu || isMenuWeekCompleted(latestMenu)) {
      return res.json([]); 
    }

    const menus = await prisma.menu.findMany({
      where: { bhawanId: bhawanId, week_start: latestMenu.week_start },
      include: { bhawan: true } 
    });
    
    res.json(menus);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve full week menu" });
  }
});

// Setup multer specifically for the single food photo upload
const ratingUpload = multer({ storage: multer.memoryStorage() }).single('foodPhoto');

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

// Handle Student Ratings & Photos
router.post("/rate/:menuId", ratingUpload, async (req, res) => {
    try {
        const { menuId } = req.params;
        const rating = parseInt(req.body.rating, 10);
        const comment = req.body.comment || null;
        const studentId = req.body.studentId || null; 

        const menu = await prisma.menu.findUnique({ where: { id: menuId } });
        if (!menu) return res.status(404).json({ error: "Menu not found" });

        // Time-lock verification:
        // Opens at meal's start_time and remains open until midnight (12:00 AM / EOD)
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const mealStart = parseTimeToMinutes(menu.start_time);

        if (currentMinutes < mealStart) {
            return res.status(403).json({ error: `Rating is not open yet. Opens at ${menu.start_time}.` });
        }
        
        let imageUrl = null;

        if (req.file) {
            const ext = req.file.originalname.split('.').pop();
            const fileName = `feedback-${menuId}-${Date.now()}.${ext}`;
            const uploadPath = path.join(__dirname, "../../uploads", fileName);
            fs.writeFileSync(uploadPath, req.file.buffer);
            imageUrl = `http://localhost:5000/uploads/${fileName}`;
        }

        if (studentId) {
            const existing = await prisma.feedback.findFirst({ where: { menuId, studentId } });
            if (existing) {
                await prisma.feedback.update({
                    where: { id: existing.id },
                    data: { rating, comment, imageUrl: imageUrl || existing.imageUrl }
                });
            } else {
                await prisma.feedback.create({
                    data: { menuId, studentId, rating, comment, imageUrl }
                });
            }
        } else {
            await prisma.feedback.create({
                data: { menuId, studentId, rating, comment, imageUrl }
            });
        }

        const allFeedbacks = await prisma.feedback.findMany({ where: { menuId } });
        const totalScore = allFeedbacks.reduce((sum, fb) => sum + fb.rating, 0);
        const averageRating = totalScore / allFeedbacks.length;

        await prisma.menu.update({
            where: { id: menuId },
            data: { averageRating, ratingCount: allFeedbacks.length }
        });

        invalidateFeedbackCache(menu.bhawanId);

        res.status(200).json({ message: "Rating submitted successfully", averageRating });
    } catch (error) {
        console.error("Meal rating error:", error);
        res.status(500).json({ error: "Failed to submit rating" });
    }
});

// Fetch a specific student's feedback history
router.get("/feedback/student/:studentId", async (req, res) => {
    try {
        const history = await prisma.feedback.findMany({
            where: { studentId: req.params.studentId },
            include: { menu: true }, 
            orderBy: { createdAt: 'desc' }
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch student feedback history" });
    }
});

// Fetch CRITICAL alerts
router.get("/alerts/:bhawanId", async (req, res) => {
    try {
        const alerts = await prisma.menu.findMany({
            where: { bhawanId: req.params.bhawanId, averageRating: { lte: 2.0, gt: 0 } },
            include: { feedbacks: { include: { student: true } } },
            orderBy: { week_start: 'desc' }
        });
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch staff alerts" });
    }
});

// Fetch ALL Feedback (Good and Bad) for the Graph & Filters - OPTIMIZED
router.get("/all-feedback/:bhawanId", async (req, res) => {
    try {
        const { bhawanId } = req.params;
        const cached = feedbackCache.get(bhawanId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return res.json(cached.data);
        }

        const menus = await prisma.menu.findMany({
            where: { bhawanId },
            include: { 
                feedbacks: { 
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        rating: true,
                        comment: true,
                        imageUrl: true,
                        createdAt: true,
                        menuId: true
                    }
                },
                dailyRatings: true
            },
            orderBy: { week_start: 'desc' }
        });

        feedbackCache.set(bhawanId, { data: menus, timestamp: Date.now() });
        res.json(menus);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch all feedback" });
    }
});

// Fetch ALL Menus for a Bhawan
router.get("/bhawan/:bhawanId", async (req, res) => {
    try {
        const menus = await prisma.menu.findMany({
            where: { bhawanId: req.params.bhawanId },
            orderBy: { week_start: 'desc' }
        });
        res.json(menus);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch menus for bhawan" });
    }
});

// Delete a specific Menu
router.delete("/:menuId", async (req, res) => {
    try {
        const { menuId } = req.params;
        // FIXED: Delete all dependent child records first to prevent foreign key violation crashes
        await prisma.mealSelection.deleteMany({
            where: { menuId }
        });
        await prisma.feedback.deleteMany({
            where: { menuId }
        });
        await prisma.dailyFeedback.deleteMany({
            where: { menuId }
        });
        await prisma.menu.delete({
            where: { id: menuId }
        });
        invalidateFeedbackCache();
        res.json({ message: "Menu deleted successfully" });
    } catch (error) {
        console.error("Delete menu error:", error);
        res.status(500).json({ error: "Failed to delete menu" });
    }
});

// Fetch the currently uploaded menu image
router.get("/latest-image/:bhawanId", (req, res) => {
    try {
        const uploadDir = path.join(__dirname, "../../uploads");
        if (!fs.existsSync(uploadDir)) return res.json({ url: null });

        const files = fs.readdirSync(uploadDir);
        const match = files.find(f => f.startsWith(`menu-${req.params.bhawanId}-latest.`));
        
        if (match) {
            res.json({ url: `http://localhost:5000/uploads/${match}` });
        } else {
            res.json({ url: null });
        }
    } catch (error) {
        console.error("Error fetching latest menu image:", error);
        res.json({ url: null });
    }
});

// Update specific start/end times for a single menu item
router.put("/:menuId/time", async (req, res) => {
    try {
        const { start_time, end_time } = req.body;
        await prisma.menu.update({
            where: { id: req.params.menuId },
            data: { start_time, end_time }
        });
        invalidateFeedbackCache();
        res.json({ message: "Time updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update time" });
    }
});

// Bulk Delete the ENTIRE Latest Menu Upload
router.delete("/latest-week/:bhawanId", async (req, res) => {
    try {
        const bhawanId = req.params.bhawanId;

        const latestMenu = await prisma.menu.findFirst({
            where: { bhawanId },
            orderBy: { week_start: 'desc' }
        });

        if (!latestMenu) {
            return res.status(404).json({ error: "No menus found to delete." });
        }

        const latestWeekStart = latestMenu.week_start;
        const menusToDelete = await prisma.menu.findMany({
            where: { bhawanId, week_start: latestWeekStart }
        });
        const menuIds = menusToDelete.map(m => m.id);

        // FIXED: Delete all dependent child records first to prevent foreign key violation crashes
        await prisma.mealSelection.deleteMany({
            where: { menuId: { in: menuIds } }
        });
        await prisma.feedback.deleteMany({
            where: { menuId: { in: menuIds } }
        });
        await prisma.dailyFeedback.deleteMany({
            where: { menuId: { in: menuIds } }
        });
        await prisma.menu.deleteMany({
            where: { id: { in: menuIds } }
        });

        const uploadDir = path.join(__dirname, "../../uploads");
        if (fs.existsSync(uploadDir)) {
            const files = fs.readdirSync(uploadDir);
            const match = files.find(f => f.startsWith(`menu-${bhawanId}-latest.`));
            if (match) {
                try {
                    fs.unlinkSync(path.join(uploadDir, match));
                } catch (unlinkErr) {
                    console.warn("Could not remove latest image file:", unlinkErr.message);
                }
            }
        }

        invalidateFeedbackCache(bhawanId);
        res.json({ message: "Latest menu upload deleted successfully." });
    } catch (error) {
        console.error("Delete latest week error:", error);
        res.status(500).json({ error: "Failed to bulk delete latest menu" });
    }
});

// ---------------------------------------------------------
// ---------------------------------------------------------
// NEW: Issue Non-Veg Coupon
// ---------------------------------------------------------
router.post("/selection", async (req, res) => {
    try {
        const { studentId, menuId } = req.body;
        // Veg coupons cannot be issued - only NON-VEG coupons exist
        const choice = 'NON-VEG';
        
        const selection = await prisma.mealSelection.upsert({
            where: { studentId_menuId: { studentId, menuId } },
            update: { choice },
            create: { studentId, menuId, choice }
        });
        invalidateSelectionCache();
        res.json({ message: "Non-Veg coupon issued successfully!", selection });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to issue Non-Veg coupon" });
    }
});

// ---------------------------------------------------------
// NEW: Get Active Non-Veg Tickets for a Student Profile
// ---------------------------------------------------------
router.get("/tickets/:studentId", async (req, res) => {
    try {
        const tickets = await prisma.mealSelection.findMany({
            where: { studentId: req.params.studentId, choice: 'NON-VEG' },
            include: { menu: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tickets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch tickets" });
    }
});
// ---------------------------------------------------------
// NEW: Fetch Non-Veg Coupon Headcounts for Staff Dashboard
// ---------------------------------------------------------
router.get("/selection-counts/:bhawanId", async (req, res) => {
    try {
        const { bhawanId } = req.params;
        const cached = selectionCountsCache.get(bhawanId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            return res.json(cached.data);
        }

        const latestMenu = await prisma.menu.findFirst({
            where: { bhawanId },
            orderBy: { week_start: 'desc' }
        });

        if (!latestMenu || isMenuWeekCompleted(latestMenu)) return res.json([]);

        // Get all meals for this latest menu week (excluding 'Daily')
        const weekMenus = await prisma.menu.findMany({
            where: { 
                week_start: latestMenu.week_start, 
                bhawanId: req.params.bhawanId,
                day: { not: 'Daily' }
            }
        });

        const selections = await prisma.mealSelection.findMany({
            where: { 
                menu: { 
                    week_start: latestMenu.week_start, 
                    bhawanId: req.params.bhawanId 
                },
                choice: 'NON-VEG'
            },
            include: { menu: true }
        });

        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
        const mealOrder = { 'Breakfast': 1, 'Lunch': 2, 'Dinner': 3 };

        // Match coupon meals configured in the menu section:
        // Wednesday Dinner, Sunday Dinner, or any special meal
        const couponMenus = weekMenus.filter(menu => 
            (menu.meal_type === 'Dinner' && (menu.day === 'Wednesday' || menu.day === 'Sunday')) ||
            (Array.isArray(menu.items) && menu.items.some(i => typeof i === 'string' && i.toUpperCase().includes('SPECIAL DINNER')))
        );

        const counts = {};
        couponMenus.forEach(menu => {
            const key = `${menu.day} - ${menu.meal_type}`;
            counts[key] = { 
                menuTitle: key, 
                date: menu.week_start, 
                day: menu.day, 
                meal_type: menu.meal_type,
                start_time: menu.start_time,
                end_time: menu.end_time,
                isCouponMeal: true,
                'NON-VEG': 0 
            };
        });

        selections.forEach(sel => {
            const key = `${sel.menu.day} - ${sel.menu.meal_type}`;
            if (counts[key]) {
                counts[key]['NON-VEG']++;
            } else {
                counts[key] = { 
                    menuTitle: key, 
                    date: sel.menu.week_start, 
                    day: sel.menu.day, 
                    meal_type: sel.menu.meal_type,
                    start_time: sel.menu.start_time,
                    end_time: sel.menu.end_time,
                    isCouponMeal: true,
                    'NON-VEG': 1 
                };
            }
        });

        const sortedCounts = Object.values(counts).sort((a, b) => {
            const dayDiff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
            if (dayDiff !== 0) return dayDiff;
            return (mealOrder[a.meal_type] || 99) - (mealOrder[b.meal_type] || 99);
        });

        selectionCountsCache.set(bhawanId, { data: sortedCounts, timestamp: Date.now() });
        res.json(sortedCounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch selection counts" });
    }
});

module.exports = router;