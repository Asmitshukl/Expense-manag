const nodemailer = require('nodemailer');
require('dotenv').config();

const mailSender = async (email, title, body) => {
    try {
        // Create transporter
        let transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Send email
        let info = await transporter.sendMail({
            from: `"ExpenseFlow System" <${process.env.MAIL_USER}>`,
            to: email,
            subject: title,
            html: body,
        });

        console.log('✓ Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('✗ Error sending email:', error.message);
        throw error;
    }
};

module.exports = mailSender;