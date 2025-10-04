// src/components/ApprovalRules.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ApprovalRules({ user }) {
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    ruleName: '',
    isManagerApprover: true,
    approvalType: 'sequential',
    percentageThreshold: '',
    specificApproverId: '',
    minAmount: '0',
    maxAmount: '',
    approvalSteps: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, usersRes] = await Promise.all([
        axios.get('/approval-rules'),
        axios.get('/users')
      ]);
      setRules(rulesRes.data);
      setUsers(usersRes.data.filter(u => u.role === 'manager' || u.role === 'admin'));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const addApprovalStep = () => {
    setFormData({
      ...formData,
      approvalSteps: [
        ...formData.approvalSteps,
        { approverId: '', approverRole: 'specific_user' }
      ]
    });
  };

  const removeApprovalStep = (index) => {
    setFormData({
      ...formData,
      approvalSteps: formData.approvalSteps.filter((_, i) => i !== index)
    });
  };

  const updateApprovalStep = (index, field, value) => {
    const newSteps = [...formData.approvalSteps];
    newSteps[index][field] = value;
    setFormData({
      ...formData,
      approvalSteps: newSteps
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/approval-rules', formData);
      alert('Approval rule created successfully!');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create approval rule');
    }
  };

  const resetForm = () => {
    setFormData({
      ruleName: '',
      isManagerApprover: true,
      approvalType: 'sequential',
      percentageThreshold: '',
      specificApproverId: '',
      minAmount: '0',
      maxAmount: '',
      approvalSteps: []
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Rules</h1>
          <p className="mt-1 text-sm text-gray-500">Configure approval workflows based on expense amounts</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Rule
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <p className="text-gray-500">No approval rules configured yet.</p>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{rule.rule_name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Amount Range: {user.currency} {parseFloat(rule.min_amount).toFixed(2)} - {
                      rule.max_amount ? `${user.currency} ${parseFloat(rule.max_amount).toFixed(2)}` : 'No Limit'
                    }
                  </p>
                </div>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {rule.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Rule Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Approval Type</p>
                  <p className="text-sm font-medium capitalize">{rule.approval_type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Manager First</p>
                  <p className="text-sm font-medium">{rule.is_manager_approver ? 'Yes' : 'No'}</p>
                </div>
                {rule.percentage_threshold && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Threshold</p>
                    <p className="text-sm font-medium">{rule.percentage_threshold}%</p>
                  </div>
                )}
                {rule.approver_first_name && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Auto-Approver</p>
                    <p className="text-sm font-medium">{rule.approver_first_name} {rule.approver_last_name}</p>
                  </div>
                )}
              </div>

              {/* Approval Flow Visualization */}
              {rule.steps && rule.steps.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Approval Flow</p>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {rule.is_manager_approver && (
                      <>
                        <div className="flex-shrink-0 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
                          Manager
                        </div>
                        <svg className="w-6 h-6 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                    {rule.steps.map((step, index) => (
                      <React.Fragment key={step.id}>
                        <div className="flex-shrink-0 px-4 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-medium">
                          {step.first_name} {step.last_name}
                        </div>
                        {index < rule.steps.length - 1 && (
                          <svg className="w-6 h-6 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Approval Rule</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
                    <input
                      type="text"
                      name="ruleName"
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      value={formData.ruleName}
                      onChange={handleChange}
                      placeholder="e.g., Standard Approval Flow"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        name="minAmount"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        value={formData.minAmount}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        name="maxAmount"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        value={formData.maxAmount}
                        onChange={handleChange}
                        placeholder="Leave empty for no limit"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isManagerApprover"
                        className="h-4 w-4 text-blue-600 rounded"
                        checked={formData.isManagerApprover}
                        onChange={handleChange}
                      />
                      <span className="ml-2 text-sm text-gray-700">Require manager approval first</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Approval Type *</label>
                    <select
                      name="approvalType"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      value={formData.approvalType}
                      onChange={handleChange}
                    >
                      <option value="sequential">Sequential (Multi-level)</option>
                      <option value="percentage">Percentage-based</option>
                      <option value="specific_approver">Specific Approver</option>
                      <option value="hybrid">Hybrid (Percentage OR Specific)</option>
                    </select>
                  </div>

                  {(formData.approvalType === 'percentage' || formData.approvalType === 'hybrid') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Percentage Threshold (%)</label>
                      <input
                        type="number"
                        name="percentageThreshold"
                        min="1"
                        max="100"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        value={formData.percentageThreshold}
                        onChange={handleChange}
                        placeholder="e.g., 60"
                      />
                    </div>
                  )}

                  {(formData.approvalType === 'specific_approver' || formData.approvalType === 'hybrid') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specific Approver (Auto-approve)</label>
                      <select
                        name="specificApproverId"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        value={formData.specificApproverId}
                        onChange={handleChange}
                      >
                        <option value="">Select approver</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.first_name} {u.last_name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(formData.approvalType === 'sequential' || formData.approvalType === 'hybrid') && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Approval Steps</label>
                        <button
                          type="button"
                          onClick={addApprovalStep}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                        >
                          + Add Step
                        </button>
                      </div>

                      {formData.approvalSteps.map((step, index) => (
                        <div key={index} className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-gray-600 w-16">Step {index + 1}:</span>
                          <select
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                            value={step.approverId}
                            onChange={(e) => updateApprovalStep(index, 'approverId', e.target.value)}
                            required
                          >
                            <option value="">Select approver</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.first_name} {u.last_name} ({u.role})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeApprovalStep(index)}
                            className="text-red-600 hover:text-red-800 p-2"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {formData.approvalSteps.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No steps added yet.</p>
                      )}
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• <strong>Sequential:</strong> Expenses go through each step in order</li>
                      <li>• <strong>Percentage:</strong> Approved when X% of approvers approve</li>
                      <li>• <strong>Specific Approver:</strong> Auto-approved if this person approves</li>
                      <li>• <strong>Hybrid:</strong> Combines percentage AND specific approver rules</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Rule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalRules;