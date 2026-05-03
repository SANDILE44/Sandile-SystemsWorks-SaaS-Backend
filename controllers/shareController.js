import SharedDeal from "../models/SharedDeal.js";
import crypto from "crypto";

/* ================= CREATE SHARE ================= */
export const createShare = async (req, res) => {
  try {
    const { type, inputs, results, permissions, title } = req.body;

    if (!type || !inputs || !results) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 🔑 generate short public ID
    const shareId = crypto.randomBytes(6).toString("hex");

    const deal = await SharedDeal.create({
      shareId,
      type,
      inputs,
      results,
      permissions: {
        mode: permissions?.mode || "view", // view | edit
        isPublic: permissions?.isPublic ?? true,
      },
      meta: {
        title: title || "",
        createdBy: req.user?.id || null
      }
    });

    res.json({
      id: deal.shareId,
      url: `${process.env.FRONTEND_URL}/share/${deal.shareId}`
    });

  } catch (err) {
    console.error("Create share error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET SHARE ================= */
export const getShare = async (req, res) => {
  try {
    const deal = await SharedDeal.findOne({
      shareId: req.params.id
    });

    if (!deal) {
      return res.status(404).json({ message: "Not found" });
    }

    // 🔒 if private, block access
    if (!deal.permissions.isPublic) {
      return res.status(403).json({ message: "Private link" });
    }

    res.json({
      type: deal.type,
      inputs: deal.inputs,
      results: deal.results,
      permissions: deal.permissions,
      meta: deal.meta
    });

  } catch (err) {
    console.error("Get share error:", err);
    res.status(500).json({ message: "Server error" });
  }
};