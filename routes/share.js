import express from "express";
import {
  createShare,
  getShare
} from "../controllers/shareController.js";

const router = express.Router();

router.post("/", createShare);
router.get("/:id", getShare);

export default router;