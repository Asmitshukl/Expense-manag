// frontend/src/App.jsx - Updated with OTP and Forgot Password routes
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import Login from './components/Login';
import Register from './components/Register';
import VerifyOTP from './components/VerifyOTP';
import ForgotPassword from './components/ForgotPassword';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SubmitExpense from './components/SubmitExpense';
import ExpenseList from './components/ExpenseList';
import ExpenseDetail from './components/ExpenseDetail';
import PendingApprovals from './components/PendingApprovals';
import UserManagement from './components/UserManagement';
import ApprovalRules from './components/ApprovalRules';

// Axios configuration
axios.defaults.baseURL = '/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOTP onLogin={handleLogin} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard user={user} />} />
            <Route path="submit-expense" element={<SubmitExpense user={user} />} />
            <Route path="expenses" element={<ExpenseList user={user} />} />
            <Route path="expenses/:id" element={<ExpenseDetail user={user} />} />
            <Route path="approvals" element={<PendingApprovals user={user} />} />
            {user.role === 'admin' && (
              <>
                <Route path="users" element={<UserManagement user={user} />} />
                <Route path="approval-rules" element={<ApprovalRules user={user} />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

export default App;