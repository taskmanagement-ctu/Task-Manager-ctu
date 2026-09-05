import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import VerifiedUser from '../models/VerifiedUser';

export const register = async (req: Request, res: Response) => {
  try {
    const { universityId, name, phone, email, password, confirmPassword, department } = req.body;

    // 1. Basic validation
    if (!universityId || !name || !phone || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided.',
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

    // 2. Check duplicates in User collection
    const existingUserById = await User.findOne({ universityId });
    if (existingUserById) {
      return res.status(409).json({
        success: false,
        message: 'This University ID is already registered.',
      });
    }

    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered.',
      });
    }

    // 3. Verify against verified_users list
    // Use an atomic findOneAndUpdate to ensure the same verified user can't be registered twice concurrently
    const verifiedUser = await VerifiedUser.findOne({ universityId });
    if (!verifiedUser) {
      return res.status(404).json({
        success: false,
        message: 'Your University ID could not be verified. Please contact the university administrator.',
      });
    }

    if (verifiedUser.isRegistered) {
      return res.status(409).json({
        success: false,
        message: 'This University ID is already registered.',
      });
    }

    // Check if the provided details reasonably match the verified record (name, email, phone)
    if (
      verifiedUser.name.toLowerCase() !== name.toLowerCase().trim() ||
      verifiedUser.email.toLowerCase() !== email.toLowerCase().trim() ||
      verifiedUser.phone !== phone.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'The provided information does not match the verified university records.',
      });
    }

    // 4. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Determine Role (First Super Admin Logic)
    let role: 'super_admin' | 'staff' = 'staff';
    const superAdminExists = await User.exists({ role: 'super_admin' });
    if (!superAdminExists) {
      role = 'super_admin';
    }

    // 6. Create User
    // If multiple concurrent requests try to become super_admin, the unique partial index on User schema
    // will throw a MongoServerError (E11000 duplicate key error) for one of them, which we catch and retry as staff.
    let newUser;
    try {
      newUser = new User({
        universityId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        department: department ? department.trim() : null,
        passwordHash,
        role,
      });
      await newUser.save();
    } catch (error: any) {
      // Handle the case where the race condition unique partial index throws a duplicate key error
      if (error.code === 11000 && error.keyPattern && error.keyPattern.role === 1) {
        // Someone else just became the first super_admin! Fallback to staff.
        newUser = new User({
          universityId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim(),
          department: department ? department.trim() : null,
          passwordHash,
          role: 'staff',
        });
        await newUser.save();
      } else {
        throw error;
      }
    }

    // 7. Update the VerifiedUser record
    await VerifiedUser.findByIdAndUpdate(verifiedUser._id, {
      isRegistered: true,
      registeredUserId: newUser._id,
    });

    // 8. Return response without password hash
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
    const user = req.user; // Attached by authenticate middleware
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
