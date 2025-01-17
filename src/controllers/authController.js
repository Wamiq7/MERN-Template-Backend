const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const otpService = require("../services/otpService");
const tokenService = require("../services/tokenService");
const { sendEmailMessage } = require("../services/sendEmail");
const { AWS_SES_SENDER, FRONTEND_URL } = require("../config/env");

// Sign Up
const signUp = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otpDetails = otpService.generateOtp();

    await User.create({
      email,
      password: hashedPassword,
      otp: { value: otpDetails.value, expiresAt: otpDetails.expiresAt },
    });

    // Simulate sending OTP (log it for simplicity)
    console.log(`OTP for ${email}: ${otpDetails.value}`);

    const emailBody = `
    <p>Hello,</p>
    <p>Thank you for signing up for XYZ! To verify your email address and complete your account creation, please use the following OTP:</p>
    <h2>${otpDetails.value}</h2>
    <p>If you did not sign up for XYZ, please ignore this email.</p>
    <p>Best regards,</p>
    <p>Team XYZ</p>
  `;

    // Send the email
    const sendOtpMail = await sendEmailMessage(
      "Email Verification OTP", // Subject
      emailBody, // Body (HTML formatted)
      AWS_SES_SENDER, // Sender email
      email // Recipient email
    );
    if (!sendOtpMail) throw new Error("No OTP sent :(");

    res.status(201).json({
      message: "User registered. Verify OTP to complete registration.",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp.value !== otp || new Date() > user.otp.expiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.otp = undefined; // Clear OTP after verification
    user.emailVerified = true;
    // Generate JWT tokens
    const accessToken = tokenService.generateAccessToken(user._id, user.role);
    const refreshToken = tokenService.generateRefreshToken(user._id, user.role);

    // Save refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    // Return tokens in response
    res.status(200).json({
      message: "OTP verified successfully",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.kyc?.name,
        selfie: user.kyc?.selfie,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Resend OTP
const resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if user has already verified email
    if (!user.otp) {
      return res.status(400).json({
        message: "Email is already verified. Please log in.",
      });
    }

    // Generate a new OTP
    const otpDetails = otpService.generateOtp();
    user.otp = { value: otpDetails.value, expiresAt: otpDetails.expiresAt };
    await user.save();

    const emailBody = `
      <p>Hello,</p>
      <p>Thank you for signing up for XYZ! To verify your email address and complete your account creation, please use the following OTP:</p>
      <h2>${otpDetails.value}</h2>
      <p>If you did not sign up for XYZ, please ignore this email.</p>
      <p>Best regards,</p>
      <p>Team XYZ</p>
    `;

    // Send the email
    const sendOtpMail = await sendEmailMessage(
      "Email Verification OTP", // Subject
      emailBody, // Body (HTML formatted)
      AWS_SES_SENDER, // Sender email
      email // Recipient email
    );
    if (!sendOtpMail) throw new Error("No OTP sent :(");

    res.status(200).json({
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(400).json({
        message: "Email is not verified. Please verify your email to proceed.",
      });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Handle OTP for 'admin'  roles
    if (user.role === "admin") {
      // Generate OTP
      const otpDetails = otpService.generateOtp();

      // Save OTP in the user object
      user.otp = { value: otpDetails.value, expiresAt: otpDetails.expiresAt };
      await user.save();

      // Simulate sending OTP (or send via email/SMS in production)
      console.log(`OTP for ${email}: ${otpDetails.value}`);
      const emailBody = `
        <p>Hello,</p>
        <p>A login attempt was made for your account. To complete the login process, please use the following OTP:</p>
        <h2>${otpDetails.value}</h2>
        <p>If you did not attempt to log in, please secure your account by changing your password immediately or contacting support.</p>
        <p>Best regards,</p>
        <p>Team XYZ</p>
      `;

      // Send the email
      const sendOtpMail = await sendEmailMessage(
        "Login Attempted", // Subject
        emailBody, // Body (HTML formatted)
        AWS_SES_SENDER, // Sender email
        email // Recipient email
      );
      if (!sendOtpMail) throw new Error("No OTP sent :(");

      return res.status(200).json({
        message: "OTP sent. Please enter OTP to complete login.",
      });
    }

    // Generate JWT tokens
    const accessToken = tokenService.generateAccessToken(user._id, user.role);
    const refreshToken = tokenService.generateRefreshToken(user._id, user.role);

    // Save refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    // Return tokens in response
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.kyc?.name,
        selfie: user.kyc?.selfie,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate reset token
    const accessToken = tokenService.generateAccessToken(user._id, user.role);

    // Store the token in the user's resetToken field
    user.resetToken = accessToken;
    await user.save();

    const resetLink = `${FRONTEND_URL}/reset-password/${accessToken}`;

    // Create the email body with text and the reset link
    const emailBody = `
      <p>Hello,</p>
      <p>You have requested to reset your password. Please click the link below to reset your password:</p>
      <p><a href="${resetLink}" target="_blank">Reset Your Password</a></p>
      <p>If you did not request this, please ignore this email or contact support.</p>
      <p>Best regards,</p>
      <p>Team XYZ</p>
    `;

    const sendOtpMail = await sendEmailMessage(
      "Reset Password",
      emailBody,
      AWS_SES_SENDER,
      email
    );
    if (!sendOtpMail) throw new Error("No OTP sent :(");

    res.status(200).json({
      message: "Password reset link sent to your email address.",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Verify reset token
    const accessToken = tokenService.verifyAccessToken(token);
    const user = await User.findOne({
      _id: accessToken.userId,
      resetToken: token,
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in the database
    user.password = hashedPassword;
    user.resetToken = undefined; // Clear the reset token
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken)
      return res.status(401).json({ message: "Refresh token is required" });

    // Verify refresh token
    const decoded = tokenService.verifyRefreshToken(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Find user in DB
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Generate new access token
    const newAccessToken = tokenService.generateAccessToken(
      user._id,
      user.role
    );

    res.status(200).json({
      message: "New access token generated",
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res
      .status(403)
      .json({ message: "Invalid or expired refresh token" });
  }
};

// Logout
const logout = async (req, res) => {
  const { userId } = req.body;

  try {
    // Find user and clear refresh token
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.refreshToken = null; // Clear the refresh token
    await user.save();

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    // Find the user by userId
    const user = await User.findById(req?.user?.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the old password matches
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
};

module.exports = {
  signUp,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  changePassword,
};
