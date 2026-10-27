const express = require("express");
const router = express.Router();
const prisma = require("../db");

// Register a new Bhawan
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Bhawan name is required" });

    const bhawan = await prisma.bhawan.create({
      data: { name: name.trim() },
    });
    res.status(201).json(bhawan);
  } catch (error) {
    res.status(400).json({ error: "Bhawan already exists or database error" });
  }
});

// List all Bhawans
router.get("/", async (req, res) => {
  try {
    const bhawans = await prisma.bhawan.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(bhawans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bhawans" });
  }
});

module.exports = router;