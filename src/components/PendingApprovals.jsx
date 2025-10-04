// src/components/PendingApprovals.jsx - Enhanced with Director Powers
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PendingApprovals({ user }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [action, setAction] = useState(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      const response = await axios.get('/approvals/pending');
      setApprovals(response.data);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async (approvalId, actionType) => {
    setSelectedApproval(approvalId);
    setAction(actionType);
  };

  const submitApprovalAction = async () => {
    if (!selectedApproval || !action) return;

    setProcessing(true);
    try {
      const response = await axios.post(`/approvals/${selectedApproval}/action`, {
        action,
        comments
      });

      if (response.data.directorOverride) {
        alert(`🎉 As Director, you have instantly approved this expense! All other approvals have been bypassed.`);
      } else {
        alert(`Expense ${action}d successfully!`);
      }
      
      setSelectedApproval(null);
      setAction(null);
      setComments('');
      fetchPendingApprovals();
    } catch (error) {
      alert(error.response?.data?.error || `Failed to ${action} expense`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="mt-1 text-sm text-gray-500">Review and approve expense claims</p>
        {user.role === 'director' && (
          <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              <strong>⚡ Director Powers:</strong> Your approval will instantly approve the expense and bypass all other pending approvals.
            </p>
          </div>
        )}
      </div>

      {approvals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-gray-900">No pending approvals</h3>
          <p className="text-sm text-gray-500">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div key={approval.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  {/* Employee Info */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {approval.first_name} {approval.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{approval.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                        Step {approval.step_order}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(approval.expense_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Expense Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Category</p>
                      <p className="text-sm font-medium">{approval.category_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Amount</p>
                      <p className="text-lg font-bold text-gray-900">
                        {approval.currency} {parseFloat(approval.amount).toFixed(2)}
                      </p>
                      {approval.converted_amount && approval.currency !== user.currency && (
                        <p className="text-xs text-gray-500">
                          ≈ {user.currency} {parseFloat(approval.converted_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Merchant</p>
                      <p className="text-sm font-medium">{approval.merchant_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Receipt</p>
                      {approval.receipt_url ? (
                        <a
                          href={`http://localhost:5000${approval.receipt_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500">No receipt</p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-900">{approval.description}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprovalAction(approval.id, 'approve')}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                      {user.role === 'director' ? '⚡ Instant Approve' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => handleApprovalAction(approval.id, 'reject')}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 mx-4">
            <h3 className="text-lg font-medium mb-4">
              {action === 'approve' ? 'Approve Expense' : 'Reject Expense'}
            </h3>
            
            {user.role === 'director' && action === 'approve' && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800">
                  <strong>Director Override:</strong> This will instantly approve the expense and mark all other pending approvals as complete.
                </p>
              </div>
            )}

            <textarea
              rows="3"
              className="w-full border border-gray-300 rounded-lg p-3"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={action === 'reject' ? 'Comments required for rejection...' : 'Add your comments (optional)...'}
              required={action === 'reject'}
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={submitApprovalAction}
                disabled={processing || (action === 'reject' && !comments.trim())}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                  action === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processing 
                  ? 'Processing...' 
                  : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
              <button
                onClick={() => {
                  setSelectedApproval(null);
                  setAction(null);
                  setComments('');
                }}
                disabled={processing}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingApprovals;