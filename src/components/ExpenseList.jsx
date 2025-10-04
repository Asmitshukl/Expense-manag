// src/components/ExpenseList.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function ExpenseList({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get('/expenses');
      setExpenses(response.data);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesFilter = filter === 'all' || expense.status === filter;
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          expense.merchant_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Loading expenses...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Expenses</h1>
        <p className="mt-1 text-sm text-gray-500">Track and manage your expense claims</p>
      </div>

      {/* Search and New Button */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Link
          to="/submit-expense"
          className="inline-flex items-center justify-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Expense
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        {['all', 'pending', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {expenses.filter(e => status === 'all' || e.status === status).length}
            </span>
          </button>
        ))}
      </div>

      {/* Expense Cards */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <h3 className="text-gray-900">No expenses found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by submitting a new expense</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExpenses.map((expense) => (
            <Link
              key={expense.id}
              to={`/expenses/${expense.id}`}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-3">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(expense.status)}`}>
                  {expense.status.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(expense.expense_date).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
                {expense.description}
              </h3>
              <p className="text-sm text-gray-600 mb-3">{expense.category_name}</p>

              <div className="text-2xl font-bold text-gray-900 mb-2">
                {expense.currency} {parseFloat(expense.amount).toFixed(2)}
              </div>

              {expense.merchant_name && (
                <div className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">Merchant:</span> {expense.merchant_name}
                </div>
              )}

              {expense.status === 'pending' && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>Approval Progress</span>
                    <span>Step {expense.current_approval_step}/{expense.total_approval_steps}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{width: `${(expense.approved_count / expense.total_approval_steps) * 100}%`}}
                    />
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExpenseList;