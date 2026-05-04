import express from "express";
import SavedDeal from "../models/SavedDeal.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ================= CREATE SAVED DEAL ================= */
router.post("/", auth, async (req, res) => {
  try {
    const { type, inputs, results, clientName } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Type is required" });
    }

const deal = await SavedDeal.create({
  userId: req.user.id,
  type,
  clientName: clientName?.trim() || `Project ${Date.now()}`, // 🔥 HERE
  inputs: inputs || {},
  results: results || {}
});

    res.status(201).json(deal);

  } catch (err) {
    console.error("Save deal error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= GET SAVED DEALS ================= */
router.get("/", auth, async (req, res) => {
  try {
    const deals = await SavedDeal.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.json(deals);

  } catch (err) {
    console.error("Get deals error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= DELETE DEAL ================= */
router.delete("/:id", auth, async (req, res) => {
  try {
    const deal = await SavedDeal.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.error("Delete deal error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= UPDATE DEAL ================= */
router.put("/:id", auth, async (req, res) => {
  try {
    const { type, inputs, results, clientName } = req.body;

    const updated = await SavedDeal.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id
      },
      {
        type,
        clientName: clientName?.trim() || `Project ${Date.now()}`, // 🔥 HERE
        inputs,
        results
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Deal not found" });
    }

    res.json(updated);

  } catch (err) {
    console.error("Update deal error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
