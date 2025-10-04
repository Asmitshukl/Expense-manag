// src/components/ExpenseDetail.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function ExpenseDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenseDetail();
  }, [id]);

  const fetchExpenseDetail = async () => {
    try {
      const response = await axios.get(`/expenses/${id}`);
      setExpense(response.data.expense);
      setApprovals(response.data.approvals);
      setLineItems(response.data.lineItems);
    } catch (error) {
      console.error('Failed to fetch expense details:', error);
      alert('Expense not found');
      navigate('/expenses');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getApprovalStatusIcon = (status) => {
    if (status === 'approved') {
      return <span className="text-green-600">✓</span>;
    } else if (status === 'rejected') {
      return <span className="text-red-600">✗</span>;
    } else {
      return <span className="text-yellow-600">⏳</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Loading expense details...</div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Expense not found</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <button
          onClick={() => navigate('/expenses')}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Back to Expenses
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {/* Header */}
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Expense Details
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Submitted on {new Date(expense.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(expense.status)}`}>
              {expense.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Expense Information */}
        <div className="px-4 py-5 sm:p-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Employee</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {expense.first_name} {expense.last_name}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Category</dt>
              <dd className="mt-1 text-sm text-gray-900">{expense.category_name}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Amount</dt>
              <dd className="mt-1 text-lg font-bold text-gray-900">
                {expense.currency} {parseFloat(expense.amount).toFixed(2)}
                {expense.currency !== user.currency && expense.converted_amount && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (≈ {user.currency} {parseFloat(expense.converted_amount).toFixed(2)})
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Expense Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(expense.expense_date).toLocaleDateString()}
              </dd>
            </div>

            {expense.merchant_name && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Merchant</dt>
                <dd className="mt-1 text-sm text-gray-900">{expense.merchant_name}</dd>
              </div>
            )}

            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{expense.description}</dd>
            </div>

            {expense.receipt_url && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500 mb-2">Receipt</dt>
                <dd className="mt-1">
                  <a
                    href={`http://localhost:5000${expense.receipt_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    📎 View Receipt
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Line Items</h4>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {expense.currency} {parseFloat(item.unit_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {expense.currency} {parseFloat(item.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Timeline */}
      <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Approval Timeline
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Progress: Step {expense.current_approval_step} of {expense.total_approval_steps}
          </p>
        </div>

        <div className="px-4 py-5 sm:p-6">
          {approvals.length === 0 ? (
            <p className="text-sm text-gray-500">No approval workflow defined</p>
          ) : (
            <div className="flow-root">
              <ul className="-mb-8">
                {approvals.map((approval, index) => (
                  <li key={approval.id}>
                    <div className="relative pb-8">
                      {index !== approvals.length - 1 && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        ></span>
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                            approval.status === 'approved' ? 'bg-green-500' :
                            approval.status === 'rejected' ? 'bg-red-500' :
                            'bg-gray-300'
                          }`}>
                            {getApprovalStatusIcon(approval.status)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Step {approval.step_order}: {approval.first_name} {approval.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{approval.email}</p>
                          </div>
                          {approval.status !== 'pending' && (
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                approval.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {approval.status === 'approved' ? 'Approved' : 'Rejected'}
                              </span>
                              {approval.approved_at && (
                                <span className="ml-2 text-xs text-gray-500">
                                  on {new Date(approval.approved_at).toLocaleString()}
                                </span>
                              )}
                              {approval.comments && (
                                <p className="mt-2 text-sm text-gray-700 italic">
                                  "{approval.comments}"
                                </p>
                              )}
                            </div>
                          )}
                          {approval.status === 'pending' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-2">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExpenseDetail;