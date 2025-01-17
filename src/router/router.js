const express = require("express");

const authRoutes = require("../routes/authRoutes");
const contactUsRoutes = require("../routes/contactUsRoutes");
const userRoutes = require("../routes/userRoutes");
const kycRoutes = require("../routes/kycRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/kyc", kycRoutes);
router.use("/contact-us", contactUsRoutes);

module.exports = router;
