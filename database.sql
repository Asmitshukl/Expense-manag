-- database.sql
CREATE DATABASE IF NOT EXISTS expense_system;
USE expense_system;

-- Companies Table
CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    default_currency VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('employee', 'manager', 'finance', 'director', 'admin') DEFAULT 'employee',
    manager_id INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Expense Categories Table
CREATE TABLE expense_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Expenses Table
CREATE TABLE expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    employee_id INT NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    converted_amount DECIMAL(10, 2),
    description TEXT NOT NULL,
    expense_date DATE NOT NULL,
    merchant_name VARCHAR(255),
    receipt_url VARCHAR(500),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    current_approval_step INT DEFAULT 1,
    total_approval_steps INT DEFAULT 0,
    final_approved_by INT,
    final_approved_at TIMESTAMP NULL,
    director_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (final_approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Expense Line Items Table
CREATE TABLE expense_line_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    expense_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

-- Approval Requests Table
CREATE TABLE approval_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    expense_id INT NOT NULL,
    approver_id INT NOT NULL,
    step_order INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    comments TEXT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Approval Rules Table
CREATE TABLE approval_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    is_manager_approver BOOLEAN DEFAULT TRUE,
    approval_type ENUM('sequential', 'percentage', 'specific_approver', 'hybrid') DEFAULT 'sequential',
    percentage_threshold INT,
    specific_approver_id INT,
    min_amount DECIMAL(10, 2) DEFAULT 0,
    max_amount DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (specific_approver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Approval Steps Table
CREATE TABLE approval_steps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    approval_rule_id INT NOT NULL,
    step_order INT NOT NULL,
    approver_id INT,
    approver_role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_rule_id) REFERENCES approval_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    user_id INT,
    expense_id INT,
    action VARCHAR(100) NOT NULL,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
);

-- Indexes for better performance
CREATE INDEX idx_expenses_employee ON expenses(employee_id);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_company ON expenses(company_id);
CREATE INDEX idx_approval_requests_approver ON approval_requests(approver_id);
CREATE INDEX idx_approval_requests_expense ON approval_requests(expense_id);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);