const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();

const pool = require('./config/database');
const mailSender = require('./utils/mailSender');
const { authenticateToken, requireRole, JWT_SECRET } = require('./middleware/auth');
const { generateOTP, generateRandomPassword } = require('./utils/generateOTP');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload configuration
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = 'uploads/receipts';
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images and PDFs are allowed'));
    }
});

// ==================== CURRENCY CONVERSION ====================
let currencyCache = {
    rates: {},
    lastUpdated: null
};

async function fetchExchangeRates(baseCurrency = 'USD') {
    try {
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        currencyCache.rates = response.data.rates;
        currencyCache.lastUpdated = new Date();
        console.log('✓ Exchange rates updated successfully');
        return response.data.rates;
    } catch (error) {
        console.error('✗ Exchange rate fetch error:', error.message);
        return currencyCache.rates;
    }
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    
    if (!currencyCache.lastUpdated || (new Date() - currencyCache.lastUpdated) > 3600000) {
        await fetchExchangeRates();
    }

    if (!currencyCache.rates[fromCurrency] || !currencyCache.rates[toCurrency]) {
        console.warn(`Currency conversion not available for ${fromCurrency} to ${toCurrency}`);
        return amount;
    }

    const rate = currencyCache.rates[toCurrency] / currencyCache.rates[fromCurrency];
    return amount * rate;
}

app.get('/api/currencies', async (req, res) => {
    try {
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,currencies');
        const currencies = new Set();
        
        response.data.forEach(country => {
            if (country.currencies) {
                Object.keys(country.currencies).forEach(code => currencies.add(code));
            }
        });

        res.json(Array.from(currencies).sort());
    } catch (error) {
        console.error('Fetch currencies error:', error);
        res.json(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CNY', 'CHF', 'SEK']);
    }
});

// ==================== AUTHENTICATION ROUTES ====================

// Register with OTP
app.post('/api/auth/register', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { email, password, firstName, lastName, companyName, currency } = req.body;

        if (!email || !password || !firstName || !lastName || !companyName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const [existingUsers] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        const [companyResult] = await connection.query(
            'INSERT INTO companies (name, default_currency) VALUES (?, ?)',
            [companyName, currency || 'USD']
        );

        const companyId = companyResult.insertId;

        const categories = ['Travel', 'Food & Entertainment', 'Office Supplies', 
                          'Transportation', 'Accommodation', 'Communication', 'Training', 'Other'];
        
        for (const category of categories) {
            await connection.query(
                'INSERT INTO expense_categories (company_id, name) VALUES (?, ?)',
                [companyId, category]
            );
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [userResult] = await connection.query(
            'INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, email_verified, otp, otp_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [companyId, email, passwordHash, firstName, lastName, 'admin', false, otp, otpExpires]
        );

        const userId = userResult.insertId;

        await mailSender(
            email,
            'Verify Your Email - ExpenseFlow',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Welcome to ExpenseFlow!</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <h2 style="color: #333;">Hi ${firstName},</h2>
                    <p style="color: #666;">Thank you for registering! Please verify your email address using the OTP below:</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #667eea; font-size: 48px; letter-spacing: 10px; margin: 0;">${otp}</h1>
                        <p style="color: #999; margin-top: 10px;">This OTP will expire in 10 minutes</p>
                    </div>
                    <p style="color: #666;">If you didn't request this, please ignore this email.</p>
                </div>
            </div>`
        );

        await connection.commit();

        res.status(201).json({
            message: 'Registration successful. Please check your email for OTP verification.',
            userId,
            email
        });

    } catch (error) {
        await connection.rollback();
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    } finally {
        connection.release();
    }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expires > NOW()',
            [email, otp]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const user = users[0];

        await pool.query(
            'UPDATE users SET email_verified = TRUE, otp = NULL, otp_expires = NULL WHERE id = ?',
            [user.id]
        );

        const [company] = await pool.query(
            'SELECT name, default_currency FROM companies WHERE id = ?',
            [user.company_id]
        );

        const token = jwt.sign(
            { userId: user.id, companyId: user.company_id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        await mailSender(
            email,
            'Welcome to ExpenseFlow - Email Verified!',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Email Verified!</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <h2 style="color: #333;">Welcome, ${user.first_name}!</h2>
                    <p style="color: #666;">Your email has been successfully verified.</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 8px 0;"><strong>Company:</strong> ${company[0].name}</p>
                        <p style="margin: 8px 0;"><strong>Role:</strong> Administrator</p>
                        <p style="margin: 8px 0;"><strong>Currency:</strong> ${company[0].default_currency}</p>
                    </div>
                </div>
            </div>`
        );

        res.json({
            message: 'Email verified successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                companyId: user.company_id,
                companyName: company[0].name,
                currency: company[0].default_currency
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;

        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND email_verified = FALSE',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found or already verified' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            'UPDATE users SET otp = ?, otp_expires = ? WHERE email = ?',
            [otp, otpExpires, email]
        );

        await mailSender(
            email,
            'New OTP - ExpenseFlow',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #667eea; padding: 30px; text-align: center;">
                    <h1 style="color: white;">Your New OTP</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9; text-align: center;">
                    <h1 style="color: #667eea; font-size: 48px; letter-spacing: 10px;">${otp}</h1>
                    <p style="color: #999;">Expires in 10 minutes</p>
                </div>
            </div>`
        );

        res.json({ message: 'OTP resent successfully' });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Email not found' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(
            'UPDATE users SET otp = ?, otp_expires = ? WHERE email = ?',
            [otp, otpExpires, email]
        );

        await mailSender(
            email,
            'Password Reset OTP - ExpenseFlow',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #ef4444; padding: 30px; text-align: center;">
                    <h1 style="color: white;">Password Reset Request</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <p style="color: #666;">Use this OTP to reset your password:</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #ef4444; font-size: 48px; letter-spacing: 10px;">${otp}</h1>
                        <p style="color: #999;">Expires in 10 minutes</p>
                    </div>
                </div>
            </div>`
        );

        res.json({ message: 'Password reset OTP sent to your email' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send reset OTP' });
    }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expires > NOW()',
            [email, otp]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            'UPDATE users SET password_hash = ?, otp = NULL, otp_expires = NULL, temp_password = NULL WHERE email = ?',
            [passwordHash, email]
        );

        await mailSender(
            email,
            'Password Changed Successfully - ExpenseFlow',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #10b981; padding: 30px; text-align: center;">
                    <h1 style="color: white;">Password Changed</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <p style="color: #666;">Your password has been successfully changed.</p>
                </div>
            </div>`
        );

        res.json({ message: 'Password reset successful' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await pool.query(
            `SELECT u.*, c.name as company_name, c.default_currency 
             FROM users u 
             JOIN companies c ON u.company_id = c.id 
             WHERE u.email = ? AND u.is_active = TRUE`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        if (!user.email_verified) {
            return res.status(403).json({ 
                error: 'Email not verified. Please verify your email first.',
                needsVerification: true,
                email: email
            });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { 
                userId: user.id, 
                companyId: user.company_id, 
                email: user.email, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                companyId: user.company_id,
                companyName: user.company_name,
                currency: user.default_currency,
                managerId: user.manager_id,
                hasTemporaryPassword: !!user.temp_password
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.*, c.name as company_name, c.default_currency 
             FROM users u 
             JOIN companies c ON u.company_id = c.id 
             WHERE u.id = ?`,
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            companyId: user.company_id,
            companyName: user.company_name,
            currency: user.default_currency,
            managerId: user.manager_id
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ==================== EMAIL NOTIFICATIONS ====================
async function sendExpenseSubmissionEmail(connection, expenseId, employeeId, companyId) {
    try {
        const [employee] = await connection.query(
            'SELECT email, first_name, last_name FROM users WHERE id = ?',
            [employeeId]
        );

        const [expense] = await connection.query(
            `SELECT e.*, c.name as category_name FROM expenses e
             JOIN expense_categories c ON e.category_id = c.id
             WHERE e.id = ?`,
            [expenseId]
        );

        const [approvers] = await connection.query(
            `SELECT DISTINCT u.email, u.first_name FROM users u
             JOIN approval_requests ar ON u.id = ar.approver_id
             WHERE ar.expense_id = ? AND ar.step_order = 1`,
            [expenseId]
        );

        await mailSender(
            employee[0].email,
            'Expense Submitted Successfully - ExpenseFlow',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">ExpenseFlow</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <h2 style="color: #333;">Expense Submitted Successfully!</h2>
                    <p style="color: #666;">Hi ${employee[0].first_name},</p>
                    <p style="color: #666;">Your expense has been submitted.</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 8px 0;"><strong>Amount:</strong> ${expense[0].currency} ${parseFloat(expense[0].amount).toFixed(2)}</p>
                        <p style="margin: 8px 0;"><strong>Category:</strong> ${expense[0].category_name}</p>
                    </div>
                </div>
            </div>`
        );

        if (approvers.length > 0) {
            await mailSender(
                approvers[0].email,
                'New Expense Awaiting Your Approval - ExpenseFlow',
                `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f59e0b; padding: 30px; text-align: center;">
                        <h1 style="color: white;">New Expense Requires Approval</h1>
                    </div>
                    <div style="padding: 30px; background: #f9f9f9;">
                        <p>New expense from ${employee[0].first_name} ${employee[0].last_name}</p>
                        <p><strong>Amount:</strong> ${expense[0].currency} ${parseFloat(expense[0].amount).toFixed(2)}</p>
                    </div>
                </div>`
            );
        }
    } catch (error) {
        console.error('Error sending expense submission email:', error);
    }
}

async function sendApprovalNotificationEmail(connection, expenseId, action, comments, approverId) {
    try {
        const [expense] = await connection.query(
            `SELECT e.*, u.email, u.first_name, c.name as category_name
             FROM expenses e
             JOIN users u ON e.employee_id = u.id
             JOIN expense_categories c ON e.category_id = c.id
             WHERE e.id = ?`,
            [expenseId]
        );

        const [approver] = await connection.query(
            'SELECT first_name, role FROM users WHERE id = ?',
            [approverId]
        );

        const status = action === 'approve' ? 'Approved' : 'Rejected';
        const color = action === 'approve' ? '#10b981' : '#ef4444';

        await mailSender(
            expense[0].email,
            `Expense ${status} - ExpenseFlow`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${color}; padding: 30px; text-align: center;">
                    <h1 style="color: white;">Expense ${status}</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <p>Hi ${expense[0].first_name},</p>
                    <p>Your expense has been ${action}d by ${approver[0].first_name} (${approver[0].role}).</p>
                    ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
                </div>
            </div>`
        );
    } catch (error) {
        console.error('Error sending approval notification:', error);
    }
}

// ==================== USER MANAGEMENT - FIXED ====================
app.post('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { email, firstName, lastName, role, managerId } = req.body;

        if (!email || !firstName || !lastName || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // FIX: Check within company only
        const [existing] = await connection.query(
            'SELECT id FROM users WHERE email = ? AND company_id = ?',
            [email, req.user.companyId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already exists in your company' });
        }

        const tempPassword = generateRandomPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        // FIX: Set email_verified to TRUE for admin-created users
        const [result] = await connection.query(
            'INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, manager_id, email_verified, temp_password) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)',
            [req.user.companyId, email, passwordHash, firstName, lastName, role, managerId || null, tempPassword]
        );

        await connection.query(
            'INSERT INTO audit_logs (company_id, user_id, action, details) VALUES (?, ?, ?, ?)',
            [req.user.companyId, req.user.userId, 'USER_CREATED', JSON.stringify({ email, role })]
        );

        await connection.commit();

        // Get company info for email
        const [company] = await connection.query(
            'SELECT name FROM companies WHERE id = ?',
            [req.user.companyId]
        );

        await mailSender(
            email,
            'Your ExpenseFlow Account Has Been Created',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Welcome to ExpenseFlow!</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <h2 style="color: #333;">Hi ${firstName},</h2>
                    <p style="color: #666;">Your account has been created by an administrator.</p>
                    <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px;">
                        <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${tempPassword}</code></p>
                        <p style="margin: 8px 0;"><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
                        <p style="margin: 8px 0;"><strong>Company:</strong> ${company[0].name}</p>
                    </div>
                    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <p style="color: #856404; margin: 0;"><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                            Login Now
                        </a>
                    </div>
                </div>
            </div>`
        );

        res.status(201).json({
            message: 'User created successfully. Credentials sent to email.',
            userId: result.insertId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user: ' + error.message });
    } finally {
        connection.release();
    }
});

app.get('/api/users', authenticateToken, requireRole(['admin', 'manager', 'finance', 'director']), async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.manager_id,
                    m.first_name as manager_first_name, m.last_name as manager_last_name
             FROM users u
             LEFT JOIN users m ON u.manager_id = m.id
             WHERE u.company_id = ?
             ORDER BY u.created_at DESC`,
            [req.user.companyId]
        );

        res.json(users);

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

app.put('/api/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { role, managerId, isActive } = req.body;
        const userId = req.params.id;

        await pool.query(
            'UPDATE users SET role = ?, manager_id = ?, is_active = ? WHERE id = ? AND company_id = ?',
            [role, managerId || null, isActive !== undefined ? isActive : true, userId, req.user.companyId]
        );

        await pool.query(
            'INSERT INTO audit_logs (company_id, user_id, action, details) VALUES (?, ?, ?, ?)',
            [req.user.companyId, req.user.userId, 'USER_UPDATED', JSON.stringify({ userId, role, managerId })]
        );

        res.json({ message: 'User updated successfully' });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// ==================== EXPENSE ROUTES - FIXED APPROVAL FLOW ====================

async function getApprovalFlow(connection, companyId, employeeId) {
    const flow = [];
    let stepOrder = 1;

    // Step 1: Manager
    const [employee] = await connection.query(
        'SELECT manager_id FROM users WHERE id = ?',
        [employeeId]
    );

    if (employee[0]?.manager_id) {
        flow.push({ 
            approverId: employee[0].manager_id, 
            stepOrder: stepOrder++
        });
    }

    // Step 2: Finance
    const [finance] = await connection.query(
        'SELECT id FROM users WHERE company_id = ? AND role = ? AND is_active = TRUE ORDER BY id LIMIT 1',
        [companyId, 'finance']
    );
    
    if (finance.length > 0) {
        flow.push({ 
            approverId: finance[0].id, 
            stepOrder: stepOrder++
        });
    }

    // Step 3: Director
    const [director] = await connection.query(
        'SELECT id FROM users WHERE company_id = ? AND role = ? AND is_active = TRUE ORDER BY id LIMIT 1',
        [companyId, 'director']
    );
    
    if (director.length > 0) {
        flow.push({ 
            approverId: director[0].id, 
            stepOrder: stepOrder++
        });
    }

    // Step 4: Admin
    const [admin] = await connection.query(
        'SELECT id FROM users WHERE company_id = ? AND role = ? AND is_active = TRUE ORDER BY id LIMIT 1',
        [companyId, 'admin']
    );
    
    if (admin.length > 0) {
        flow.push({ 
            approverId: admin[0].id, 
            stepOrder: stepOrder++
        });
    }

    return flow;
}

app.post('/api/expenses', authenticateToken, upload.single('receipt'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { amount, currency, categoryId, description, expenseDate, merchantName, lineItems } = req.body;
        const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;

        const [company] = await connection.query(
            'SELECT default_currency FROM companies WHERE id = ?',
            [req.user.companyId]
        );

        const defaultCurrency = company[0].default_currency;
        const convertedAmount = await convertCurrency(parseFloat(amount), currency, defaultCurrency);

        // CRITICAL FIX: Set current_approval_step = 1 on creation
        const [expenseResult] = await connection.query(
            `INSERT INTO expenses (company_id, employee_id, category_id, amount, currency, 
             converted_amount, description, expense_date, merchant_name, receipt_url, current_approval_step) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [req.user.companyId, req.user.userId, categoryId, amount, currency, 
             convertedAmount, description, expenseDate, merchantName, receiptUrl]
        );

        const expenseId = expenseResult.insertId;

        if (lineItems && Array.isArray(JSON.parse(lineItems))) {
            const items = JSON.parse(lineItems);
            for (const item of items) {
                await connection.query(
                    'INSERT INTO expense_line_items (expense_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)',
                    [expenseId, item.description, item.quantity, item.unitPrice, item.amount]
                );
            }
        }

        const approvalFlow = await getApprovalFlow(connection, req.user.companyId, req.user.userId);

        await connection.query(
            'UPDATE expenses SET total_approval_steps = ? WHERE id = ?',
            [approvalFlow.length, expenseId]
        );

        // Create all approval requests
        for (const approver of approvalFlow) {
            await connection.query(
                'INSERT INTO approval_requests (expense_id, approver_id, step_order, status) VALUES (?, ?, ?, ?)',
                [expenseId, approver.approverId, approver.stepOrder, 'pending']
            );
        }

        await connection.query(
            'INSERT INTO audit_logs (company_id, user_id, expense_id, action, details) VALUES (?, ?, ?, ?, ?)',
            [req.user.companyId, req.user.userId, expenseId, 'EXPENSE_SUBMITTED', 
             JSON.stringify({ amount, currency, categoryId, steps: approvalFlow.length })]
        );

        await sendExpenseSubmissionEmail(connection, expenseId, req.user.userId, req.user.companyId);

        await connection.commit();

        res.status(201).json({
            message: 'Expense submitted successfully',
            expenseId,
            approvalSteps: approvalFlow.length
        });

    } catch (error) {
        await connection.rollback();
        console.error('Submit expense error:', error);
        res.status(500).json({ error: 'Failed to submit expense' });
    } finally {
        connection.release();
    }
});

app.get('/api/expenses', authenticateToken, async (req, res) => {
    try {
        let query;
        let params;

        if (req.user.role === 'admin') {
            query = `
                SELECT e.*, u.first_name, u.last_name, u.email, c.name as category_name,
                       (SELECT COUNT(*) FROM approval_requests WHERE expense_id = e.id AND status = 'approved') as approved_count
                FROM expenses e
                JOIN users u ON e.employee_id = u.id
                JOIN expense_categories c ON e.category_id = c.id
                WHERE e.company_id = ?
                ORDER BY e.created_at DESC
            `;
            params = [req.user.companyId];
        } else if (['manager', 'finance', 'director'].includes(req.user.role)) {
            query = `
                SELECT DISTINCT e.*, u.first_name, u.last_name, u.email, c.name as category_name,
                       ar.status as my_approval_status,
                       (SELECT COUNT(*) FROM approval_requests WHERE expense_id = e.id AND status = 'approved') as approved_count
                FROM expenses e
                JOIN users u ON e.employee_id = u.id
                JOIN expense_categories c ON e.category_id = c.id
                LEFT JOIN approval_requests ar ON e.id = ar.expense_id AND ar.approver_id = ?
                WHERE e.company_id = ? 
                AND (u.manager_id = ? OR ar.approver_id = ? OR u.id = ?)
                ORDER BY e.created_at DESC
            `;
            params = [req.user.userId, req.user.companyId, req.user.userId, req.user.userId, req.user.userId];
        } else {
            query = `
                SELECT e.*, c.name as category_name,
                       (SELECT COUNT(*) FROM approval_requests WHERE expense_id = e.id AND status = 'approved') as approved_count
                FROM expenses e
                JOIN expense_categories c ON e.category_id = c.id
                WHERE e.employee_id = ? AND e.company_id = ?
                ORDER BY e.created_at DESC
            `;
            params = [req.user.userId, req.user.companyId];
        }

        const [expenses] = await pool.query(query, params);
        res.json(expenses);

    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ error: 'Failed to get expenses' });
    }
});

app.get('/api/expenses/:id', authenticateToken, async (req, res) => {
    try {
        const [expenses] = await pool.query(
            `SELECT e.*, u.first_name, u.last_name, u.email, c.name as category_name
             FROM expenses e
             JOIN users u ON e.employee_id = u.id
             JOIN expense_categories c ON e.category_id = c.id
             WHERE e.id = ? AND e.company_id = ?`,
            [req.params.id, req.user.companyId]
        );

        if (expenses.length === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        const [approvals] = await pool.query(
            `SELECT ar.*, u.first_name, u.last_name, u.email, u.role
             FROM approval_requests ar
             JOIN users u ON ar.approver_id = u.id
             WHERE ar.expense_id = ?
             ORDER BY ar.step_order`,
            [req.params.id]
        );

        const [lineItems] = await pool.query(
            'SELECT * FROM expense_line_items WHERE expense_id = ?',
            [req.params.id]
        );

        res.json({
            expense: expenses[0],
            approvals,
            lineItems
        });

    } catch (error) {
        console.error('Get expense error:', error);
        res.status(500).json({ error: 'Failed to get expense' });
    }
});

// ==================== APPROVAL ROUTES - FIXED ====================

// CRITICAL FIX: Only show approvals matching current step
app.get('/api/approvals/pending', authenticateToken, async (req, res) => {
    try {
        const [approvals] = await pool.query(
            `SELECT DISTINCT ar.*, e.*, u.first_name, u.last_name, u.email, c.name as category_name,
                    e.current_approval_step, e.total_approval_steps
             FROM approval_requests ar
             JOIN expenses e ON ar.expense_id = e.id
             JOIN users u ON e.employee_id = u.id
             JOIN expense_categories c ON e.category_id = c.id
             WHERE ar.approver_id = ? 
             AND ar.status = 'pending'
             AND e.status = 'pending'
             AND ar.step_order = e.current_approval_step
             ORDER BY ar.created_at DESC`,
            [req.user.userId]
        );

        res.json(approvals);

    } catch (error) {
        console.error('Get pending approvals error:', error);
        res.status(500).json({ error: 'Failed to get pending approvals' });
    }
});

// CRITICAL FIX: Proper approval flow logic
app.post('/api/approvals/:id/action', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const approvalRequestId = req.params.id;
        const { action, comments } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const [approvalRequests] = await connection.query(
            'SELECT * FROM approval_requests WHERE id = ? AND approver_id = ?',
            [approvalRequestId, req.user.userId]
        );

        if (approvalRequests.length === 0) {
            return res.status(404).json({ error: 'Approval request not found or not authorized' });
        }

        const approvalRequest = approvalRequests[0];

        const [expenses] = await connection.query(
            'SELECT * FROM expenses WHERE id = ?',
            [approvalRequest.expense_id]
        );

        const expense = expenses[0];

        // Update this approval request
        await connection.query(
            'UPDATE approval_requests SET status = ?, comments = ?, approved_at = NOW() WHERE id = ?',
            [action === 'approve' ? 'approved' : 'rejected', comments, approvalRequestId]
        );

        if (action === 'reject') {
            // Reject expense and cancel all pending approvals
            await connection.query(
                'UPDATE expenses SET status = ? WHERE id = ?',
                ['rejected', expense.id]
            );

            await connection.query(
                'UPDATE approval_requests SET status = ? WHERE expense_id = ? AND status = ?',
                ['rejected', expense.id, 'pending']
            );

        } else {
            // DIRECTOR OVERRIDE LOGIC
            if (req.user.role === 'director') {
                await connection.query(
                    'UPDATE expenses SET status = ?, final_approved_at = NOW(), final_approved_by = ?, director_override = TRUE, current_approval_step = total_approval_steps WHERE id = ?',
                    ['approved', req.user.userId, expense.id]
                );
                
                await connection.query(
                    'UPDATE approval_requests SET status = ?, comments = ?, approved_at = NOW() WHERE expense_id = ? AND status = ?',
                    ['approved', 'Auto-approved via Director override', expense.id, 'pending']
                );
            } else {
                // Check approval status
                const [approvalStats] = await connection.query(
                    `SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                     FROM approval_requests 
                     WHERE expense_id = ?`,
                    [expense.id]
                );

                const stats = approvalStats[0];

                // If all approvals done, mark as approved
                if (stats.pending === 0 && stats.approved === stats.total) {
                    await connection.query(
                        'UPDATE expenses SET status = ?, final_approved_at = NOW(), final_approved_by = ?, current_approval_step = total_approval_steps WHERE id = ?',
                        ['approved', req.user.userId, expense.id]
                    );
                } else {
                    // FIX: Only increment if there are more steps
                    if (expense.current_approval_step < expense.total_approval_steps) {
                        await connection.query(
                            'UPDATE expenses SET current_approval_step = current_approval_step + 1 WHERE id = ?',
                            [expense.id]
                        );
                    }
                }
            }
        }

        await connection.query(
            'INSERT INTO audit_logs (company_id, user_id, expense_id, action, details) VALUES (?, ?, ?, ?, ?)',
            [req.user.companyId, req.user.userId, expense.id, 
             action === 'approve' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
             JSON.stringify({ comments, step: approvalRequest.step_order, role: req.user.role })]
        );

        await sendApprovalNotificationEmail(connection, expense.id, action, comments, req.user.userId);

        await connection.commit();

        res.json({ 
            message: `Expense ${action}d successfully`,
            directorOverride: req.user.role === 'director' && action === 'approve'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Approval action error:', error);
        res.status(500).json({ error: 'Failed to process approval' });
    } finally {
        connection.release();
    }
});

// ==================== APPROVAL RULES ====================

app.post('/api/approval-rules', authenticateToken, requireRole(['admin']), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { 
            ruleName, isManagerApprover, approvalType, 
            percentageThreshold, specificApproverId, 
            minAmount, maxAmount, approvalSteps 
        } = req.body;

        const [result] = await connection.query(
            `INSERT INTO approval_rules 
             (company_id, rule_name, is_manager_approver, approval_type, 
              percentage_threshold, specific_approver_id, min_amount, max_amount) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.companyId, ruleName, isManagerApprover, approvalType, 
             percentageThreshold, specificApproverId, minAmount, maxAmount]
        );

        const ruleId = result.insertId;

        if (approvalSteps && Array.isArray(approvalSteps)) {
            for (let i = 0; i < approvalSteps.length; i++) {
                await connection.query(
                    'INSERT INTO approval_steps (approval_rule_id, step_order, approver_id, approver_role) VALUES (?, ?, ?, ?)',
                    [ruleId, i + 1, approvalSteps[i].approverId, approvalSteps[i].approverRole || 'specific_user']
                );
            }
        }

        await connection.commit();

        res.status(201).json({
            message: 'Approval rule created successfully',
            ruleId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create approval rule error:', error);
        res.status(500).json({ error: 'Failed to create approval rule' });
    } finally {
        connection.release();
    }
});

app.get('/api/approval-rules', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const [rules] = await pool.query(
            `SELECT ar.*, u.first_name as approver_first_name, u.last_name as approver_last_name
             FROM approval_rules ar
             LEFT JOIN users u ON ar.specific_approver_id = u.id
             WHERE ar.company_id = ?
             ORDER BY ar.min_amount`,
            [req.user.companyId]
        );

        for (const rule of rules) {
            const [steps] = await pool.query(
                `SELECT ast.*, u.first_name, u.last_name
                 FROM approval_steps ast
                 JOIN users u ON ast.approver_id = u.id
                 WHERE ast.approval_rule_id = ?
                 ORDER BY ast.step_order`,
                [rule.id]
            );
            rule.steps = steps;
        }

        res.json(rules);

    } catch (error) {
        console.error('Get approval rules error:', error);
        res.status(500).json({ error: 'Failed to get approval rules' });
    }
});

// ==================== CATEGORIES ====================

app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const [categories] = await pool.query(
            'SELECT * FROM expense_categories WHERE company_id = ? AND is_active = TRUE',
            [req.user.companyId]
        );
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

// ==================== DASHBOARD STATS ====================

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        let stats = {};

        if (req.user.role === 'admin') {
            const [totalExpenses] = await pool.query(
                'SELECT COUNT(*) as count, SUM(converted_amount) as total FROM expenses WHERE company_id = ?',
                [req.user.companyId]
            );

            const [pendingExpenses] = await pool.query(
                'SELECT COUNT(*) as count FROM expenses WHERE company_id = ? AND status = ?',
                [req.user.companyId, 'pending']
            );

            const [approvedExpenses] = await pool.query(
                'SELECT COUNT(*) as count, SUM(converted_amount) as total FROM expenses WHERE company_id = ? AND status = ?',
                [req.user.companyId, 'approved']
            );

            stats = {
                totalExpenses: totalExpenses[0].count,
                totalAmount: totalExpenses[0].total || 0,
                pendingExpenses: pendingExpenses[0].count,
                approvedExpenses: approvedExpenses[0].count,
                approvedAmount: approvedExpenses[0].total || 0
            };

        } else if (['manager', 'finance', 'director'].includes(req.user.role)) {
            const [pendingApprovals] = await pool.query(
                `SELECT COUNT(*) as count FROM approval_requests ar
                 JOIN expenses e ON ar.expense_id = e.id
                 WHERE ar.approver_id = ? AND ar.status = ? AND e.status = ?
                 AND ar.step_order = e.current_approval_step`,
                [req.user.userId, 'pending', 'pending']
            );

            stats = {
                pendingApprovals: pendingApprovals[0].count
            };

        } else {
            const [myExpenses] = await pool.query(
                'SELECT COUNT(*) as count, SUM(amount) as total FROM expenses WHERE employee_id = ?',
                [req.user.userId]
            );

            const [myPending] = await pool.query(
                'SELECT COUNT(*) as count FROM expenses WHERE employee_id = ? AND status = ?',
                [req.user.userId, 'pending']
            );

            const [myApproved] = await pool.query(
                'SELECT COUNT(*) as count FROM expenses WHERE employee_id = ? AND status = ?',
                [req.user.userId, 'approved']
            );

            stats = {
                myExpenses: myExpenses[0].count,
                myTotal: myExpenses[0].total || 0,
                myPending: myPending[0].count,
                myApproved: myApproved[0].count
            };
        }

        res.json(stats);

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

app.get('/api/dashboard/recent-expenses', authenticateToken, async (req, res) => {
    try {
        let query;
        let params;

        if (req.user.role === 'admin') {
            query = `
                SELECT e.*, u.first_name, u.last_name, c.name as category_name
                FROM expenses e
                JOIN users u ON e.employee_id = u.id
                JOIN expense_categories c ON e.category_id = c.id
                WHERE e.company_id = ?
                ORDER BY e.created_at DESC
                LIMIT 5
            `;
            params = [req.user.companyId];
        } else if (['manager', 'finance', 'director'].includes(req.user.role)) {
            query = `
                SELECT DISTINCT e.*, u.first_name, u.last_name, c.name as category_name
                FROM expenses e
                JOIN users u ON e.employee_id = u.id
                JOIN expense_categories c ON e.category_id = c.id
                LEFT JOIN approval_requests ar ON e.id = ar.expense_id
                WHERE e.company_id = ? 
                AND (u.manager_id = ? OR ar.approver_id = ?)
                ORDER BY e.created_at DESC
                LIMIT 5
            `;
            params = [req.user.companyId, req.user.userId, req.user.userId];
        } else {
            query = `
                SELECT e.*, c.name as category_name
                FROM expenses e
                JOIN expense_categories c ON e.category_id = c.id
                WHERE e.employee_id = ? AND e.company_id = ?
                ORDER BY e.created_at DESC
                LIMIT 5
            `;
            params = [req.user.userId, req.user.companyId];
        }

        const [expenses] = await pool.query(query, params);
        res.json(expenses);

    } catch (error) {
        console.error('Get recent expenses error:', error);
        res.status(500).json({ error: 'Failed to get recent expenses' });
    }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size is too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== SERVER INITIALIZATION ====================

fetchExchangeRates().then(() => {
    console.log('✓ Initial currency rates loaded');
});

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('  EXPENSE REIMBURSEMENT SYSTEM');
    console.log('========================================');
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log('\n🔐 Authentication Features:');
    console.log('  - OTP Email Verification');
    console.log('  - Forgot Password with OTP');
    console.log('  - Auto-generated Passwords');
    console.log('\n👥 Available Roles:');
    console.log('  - employee: Submits expenses');
    console.log('  - manager: First approval level');
    console.log('  - finance: Second approval level');
    console.log('  - director: Instant approval override');
    console.log('  - admin: Final approval & full access');
    console.log('\n✅ Approval Flow: Employee → Manager → Finance → Director → Admin');
    console.log('========================================\n');
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});