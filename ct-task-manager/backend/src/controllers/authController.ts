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

const maskEmail = (emailStr: string): string => {
  const parts = emailStr.split('@');
  if (parts.length !== 2) return emailStr;
  const [userPart, domain] = parts;
  if (userPart.length <= 3) {
    return `${userPart[0]}***@${domain}`;
  }
  const first = userPart.slice(0, 2);
  const last = userPart.slice(-2);
  return `${first}${'*'.repeat(Math.max(3, userPart.length - 4))}${last}@${domain}`;
};

/**
 * Send OTP for Registration or Forgot Password
 */
export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { email, identifier, purpose, universityId, name } = req.body;
    const rawInput = String(email || identifier || '').trim();

    if (!rawInput || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Identifier (Email or University ID) and purpose are required.',
      });
    }

    let targetEmail = '';
    let targetName = name || '';
    let targetUniversityId = '';

    if (purpose === 'registration') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawInput)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address.',
        });
      }

      targetEmail = rawInput.toLowerCase();

      // 1. Check if email is already in registered users
      const existingEmail = await User.findOne({ email: targetEmail });
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

        targetUniversityId = universityId;
        if (!targetName) targetName = verifiedRecord.name;
      }
    } else if (purpose === 'forgot_password') {
      // Allow 5-digit University ID or Email
      if (/^\d{5}$/.test(rawInput)) {
        const userById = await User.findOne({ universityId: rawInput });
        if (!userById) {
          return res.status(404).json({
            success: false,
            message: `No registered account found with University ID ${rawInput}.`,
          });
        }
        targetEmail = userById.email.toLowerCase().trim();
        targetName = userById.name;
        targetUniversityId = userById.universityId;
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(rawInput)) {
          return res.status(400).json({
            success: false,
            message: 'Please enter a valid 5-digit University ID or email address.',
          });
        }
        const userByEmail = await User.findOne({ email: rawInput.toLowerCase().trim() });
        if (!userByEmail) {
          return res.status(404).json({
            success: false,
            message: 'No registered account found with this email address.',
          });
        }
        targetEmail = userByEmail.email.toLowerCase().trim();
        targetName = userByEmail.name;
        targetUniversityId = userByEmail.universityId;
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
    await OTP.deleteMany({ email: targetEmail, purpose });

    // Save new OTP record
    await OTP.create({
      email: targetEmail,
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      verified: false,
    });

    console.log(`[OTP] Generated 6-digit code for ${targetEmail} (${purpose})`);

    // Send email using Nodemailer
    try {
      await sendOtpEmail(targetEmail, otp, purpose, targetName);
    } catch (mailError: any) {
      console.error(`[OTP Error] Failed to send email to ${targetEmail}:`, mailError.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to deliver verification email. Please contact administrator.',
        error: mailError.message,
      });
    }

    const masked = maskEmail(targetEmail);
    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${masked}.`,
      email: targetEmail,
      maskedEmail: masked,
      universityId: targetUniversityId,
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
    const { email, identifier, otp, purpose } = req.body;
    const rawInput = String(email || identifier || '').trim();

    if (!rawInput || !otp || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Identifier, OTP, and purpose are required.',
      });
    }

    let targetEmail = rawInput.toLowerCase();
    if (/^\d{5}$/.test(rawInput)) {
      const user = await User.findOne({ universityId: rawInput });
      if (user) targetEmail = user.email.toLowerCase().trim();
    }

    const otpRecord = await OTP.findOne({
      email: targetEmail,
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

    if (otpRecord.otp !== String(otp).trim()) {
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
    const { email, identifier, otp, newPassword, confirmNewPassword } = req.body;
    const rawInput = String(email || identifier || '').trim();

    if (!rawInput || !otp || !newPassword || !confirmNewPassword) {
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

    // Resolve user by ID or email
    let user = null;
    if (/^\d{5}$/.test(rawInput)) {
      user = await User.findOne({ universityId: rawInput });
    } else {
      user = await User.findOne({ email: rawInput.toLowerCase().trim() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const normalizedEmail = user.email.toLowerCase().trim();

    // Verify OTP
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      purpose: 'forgot_password',
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code. Please request a new code.',
      });
    }

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new verification code.',
      });
    }

    if (otpRecord.otp !== String(otp).trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. (${5 - otpRecord.attempts} attempts remaining)`,
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
      universityId: user.universityId,
    });
  } catch (error: any) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.',
      error: error.message,
    });
  }
};

/**
 * Change Password for authenticated user
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please login again.',
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password.',
      });
    }

    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully. Your account is secured with the new password.',
    });
  } catch (error: any) {
    console.error('Change Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password. Please try again.',
      error: error.message,
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
        baseDepartment: finalDepartment,
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
          baseDepartment: finalDepartment,
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
