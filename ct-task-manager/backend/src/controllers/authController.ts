import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import VerifiedUser from '../models/VerifiedUser';
import Department from '../models/Department';
import OTP from '../models/OTP';
import { sendOtpEmail } from '../services/emailService';
import {
  findMatchingDepartment,
  formatDepartmentDisplayName,
} from '../utils/normalization';

/**
 * Send OTP for Registration or Forgot Password
 */
export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { email, purpose, universityId, name } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email and purpose are required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (purpose === 'registration') {
      // 1. Check if email is already in registered users
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email is already registered.',
        });
      }

      // 2. If universityId is provided, validate against VerifiedUser list
      if (universityId) {
        if (universityId.length !== 5 || !/^\d+$/.test(universityId)) {
          return res.status(400).json({
            success: false,
            message: 'University ID must contain exactly 5 digits.',
          });
        }

        const existingId = await User.findOne({ universityId });
        if (existingId) {
          return res.status(409).json({
            success: false,
            message: 'This University ID is already registered.',
          });
        }

        const verifiedRecord = await VerifiedUser.findOne({ universityId });
        if (!verifiedRecord) {
          return res.status(404).json({
            success: false,
            message: 'Your University ID could not be found in university records. Please contact IT admin.',
          });
        }

        if (verifiedRecord.isRegistered) {
          return res.status(409).json({
            success: false,
            message: 'This University ID is already registered.',
          });
        }
      }
    } else if (purpose === 'forgot_password') {
      // For forgot password, user must exist
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'No registered account found with this email address.',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP purpose.',
      });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any previous active OTP for this email and purpose
    await OTP.deleteMany({ email: normalizedEmail, purpose });

    // Save new OTP record
    await OTP.create({
      email: normalizedEmail,
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      verified: false,
    });

    // Send email using Nodemailer
    await sendOtpEmail(normalizedEmail, otp, purpose, name);

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}.`,
    });
  } catch (error: any) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again later.',
      error: error.message,
    });
  }
};

/**
 * Verify OTP
 */
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and purpose are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      purpose,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please request a new one.',
      });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new verification code.',
      });
    }

    if (otpRecord.otp !== otp.trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. (${5 - otpRecord.attempts} attempts remaining)`,
      });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return res.status(200).json({
      success: true,
      message: 'Verification code verified successfully.',
    });
  } catch (error: any) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying code.',
    });
  }
};

/**
 * Reset Password using verified OTP
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword, confirmNewPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      purpose: 'forgot_password',
      otp: otp.trim(),
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code.',
      });
    }

    // Find User
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    user.passwordHash = passwordHash;
    await user.save();

    // Invalidate OTP
    await OTP.deleteMany({ email: normalizedEmail, purpose: 'forgot_password' });

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error: any) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.',
    });
  }
};

/**
 * Register a new user (with verified OTP)
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { universityId, name, phone, email, password, confirmPassword, department, otp } = req.body;

    // 1. Basic validation
    if (!universityId || !name || !phone || !email || !password || !confirmPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: 'All fields including email verification code (OTP) must be provided.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    if (universityId.length !== 5 || !/^\d+$/.test(universityId)) {
      return res.status(400).json({
        success: false,
        message: 'University ID must contain exactly 5 digits.',
      });
    }

    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must contain exactly 10 digits.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Validate OTP
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      purpose: 'registration',
      otp: otp.trim(),
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired email verification code. Please request a new code.',
      });
    }

    // 3. Check duplicates in User collection
    const existingUserById = await User.findOne({ universityId });
    if (existingUserById) {
      return res.status(409).json({
        success: false,
        message: 'This University ID is already registered.',
      });
    }

    const existingUserByEmail = await User.findOne({ email: normalizedEmail });
    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered.',
      });
    }

    // 4. Verify against verified_users list
    const verifiedUser = await VerifiedUser.findOne({ universityId });
    if (!verifiedUser) {
      return res.status(404).json({
        success: false,
        message: 'Your University ID could not be verified in university records. Please contact administrator.',
      });
    }

    if (verifiedUser.isRegistered) {
      return res.status(409).json({
        success: false,
        message: 'This University ID is already registered.',
      });
    }

    // 5. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 6. Determine Role (First Super Admin Logic)
    let role: 'super_admin' | 'staff' = 'staff';
    const superAdminExists = await User.exists({ role: 'super_admin' });
    if (!superAdminExists) {
      role = 'super_admin';
    }

    // 7. Resolve canonical department
    let finalDepartment = department ? String(department).trim() : (verifiedUser.department ? String(verifiedUser.department).trim() : null);
    if (finalDepartment) {
      const allDepts = await Department.find({}).lean();
      const matched = findMatchingDepartment(allDepts, finalDepartment);
      finalDepartment = matched ? matched.name : formatDepartmentDisplayName(finalDepartment);
    }

    // Create User with the verified registration email
    let newUser;
    try {
      newUser = new User({
        universityId,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        department: finalDepartment,
        passwordHash,
        role,
      });
      await newUser.save();
    } catch (error: any) {
      if (error.code === 11000 && error.keyPattern && error.keyPattern.role === 1) {
        newUser = new User({
          universityId,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
          department: finalDepartment,
          passwordHash,
          role: 'staff',
        });
        await newUser.save();
      } else {
        throw error;
      }
    }

    // 8. Update VerifiedUser record
    await VerifiedUser.findByIdAndUpdate(verifiedUser._id, {
      isRegistered: true,
      registeredUserId: newUser._id,
    });

    // 9. Clean up OTP record
    await OTP.deleteMany({ email: normalizedEmail, purpose: 'registration' });

    // 10. Return response
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: newUser._id,
          universityId: newUser.universityId,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          department: newUser.department,
          role: newUser.role,
        },
      },
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during registration.',
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { universityId, password } = req.body;

    if (!universityId || !password) {
      return res.status(400).json({
        success: false,
        message: 'University ID and password are required.',
      });
    }

    const user = await User.findOne({ universityId });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid University ID or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by super admin.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid University ID or password.',
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Internal server error.',
      });
    }

    const payload = {
      userId: user._id,
      universityId: user.universityId,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          universityId: user.universityId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          department: user.department,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during login.',
    });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          universityId: user.universityId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          department: user.department,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (error) {
    console.error('GetMe Error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred.',
    });
  }
};
