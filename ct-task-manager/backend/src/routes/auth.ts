import { Router, Request, Response } from 'express';
import { register, login, getMe, sendOTP, verifyOTP, resetPassword, changePassword } from '../controllers/authController';
import { authenticate, authorizeRoles } from '../middleware/auth';

const router = Router();

// @route   POST /api/auth/send-otp
// @desc    Send OTP to email for registration or forgot password
// @access  Public
router.post('/send-otp', sendOTP);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP for an email
// @access  Public
router.post('/verify-otp', verifyOTP);

// @route   POST /api/auth/reset-password
// @desc    Reset password using verified OTP
// @access  Public
router.post('/reset-password', resetPassword);

// @route   POST /api/auth/change-password
// @desc    Change password for authenticated user
// @access  Private
router.post('/change-password', authenticate, changePassword);

// @route   POST /api/auth/register
// @desc    Register a new user (requires verified email OTP)
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', login);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', authenticate, getMe);

// @route   GET /api/auth/protected-test
// @desc    Test protected route
// @access  Private
router.get('/protected-test', authenticate, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'You are authenticated',
    user: req.user,
  });
});

// @route   GET /api/auth/super-admin-test
// @desc    Test super_admin role authorization
// @access  Private (Super Admin)
router.get(
  '/super-admin-test',
  authenticate,
  authorizeRoles('super_admin'),
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'You are a Super Admin',
    });
  }
);

export default router;
