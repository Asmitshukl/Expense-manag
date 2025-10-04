// src/components/UserManagement.jsx - Updated without password field
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'employee',
    managerId: ''
  });
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/users', formData);
      alert('User created successfully! Login credentials have been sent to their email.');
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser(userToEdit);
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      await axios.put(`/users/${userId}`, updates);
      alert('User updated successfully!');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'employee',
      managerId: ''
    });
  };

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  const getRoleBadgeColor = (role) => {
    const colors = {
      employee: 'bg-gray-100 text-gray-800',
      manager: 'bg-blue-100 text-blue-800',
      finance: 'bg-green-100 text-green-800',
      director: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleDescription = (role) => {
    const descriptions = {
      employee: 'Submits expenses',
      manager: 'First approval level',
      finance: 'Second approval level',
      director: 'Can override all approvals',
      admin: 'Final approval & full access'
    };
    return descriptions[role] || '';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employees, managers, finance, and directors
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <span className="font-medium">Approval Flow:</span>
            <span className="px-2 py-1 bg-gray-100 rounded">Employee</span>
            <span>→</span>
            <span className="px-2 py-1 bg-blue-100 rounded">Manager</span>
            <span>→</span>
            <span className="px-2 py-1 bg-green-100 rounded">Finance</span>
            <span>→</span>
            <span className="px-2 py-1 bg-purple-100 rounded">Director*</span>
            <span>→</span>
            <span className="px-2 py-1 bg-red-100 rounded">Admin</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            * Director can instantly approve any expense, bypassing all other approvals
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {['employee', 'manager', 'finance', 'director', 'admin'].map(role => (
          <div key={role} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-xs text-gray-500 uppercase">{role}s</p>
            <p className="text-2xl font-bold text-gray-900">
              {users.filter(u => u.role === role).length}
            </p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Manager
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  No users found. Create your first user to get started.
                </td>
              </tr>
            ) : (
              users.map((usr) => (
                <tr key={usr.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                          {usr.first_name.charAt(0)}{usr.last_name.charAt(0)}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {usr.first_name} {usr.last_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{usr.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser?.id === usr.id ? (
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="finance">Finance</option>
                        <option value="director">Director</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(usr.role)}`}>
                          {usr.role.charAt(0).toUpperCase() + usr.role.slice(1)}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{getRoleDescription(usr.role)}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingUser?.id === usr.id ? (
                      <select
                        value={editingUser.manager_id || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, manager_id: e.target.value })}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">No Manager</option>
                        {managers.filter(m => m.id !== usr.id).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.first_name} {m.last_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      usr.manager_first_name ? 
                        `${usr.manager_first_name} ${usr.manager_last_name}` : 
                        <span className="text-gray-400 italic">No Manager</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      usr.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {usr.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingUser?.id === usr.id ? (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleUpdateUser(usr.id, {
                            role: editingUser.role,
                            managerId: editingUser.manager_id || null,
                            isActive: usr.is_active
                          })}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      usr.id !== user.id && (
                        <button
                          onClick={() => handleEditUser(usr)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Edit
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Create New User
                  </h3>

                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> A secure password will be automatically generated and sent to the user's email along with their login credentials.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          First Name *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={formData.firstName}
                          onChange={handleChange}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={formData.lastName}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={formData.email}
                        onChange={handleChange}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Login credentials will be sent to this email
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role *
                      </label>
                      <select
                        name="role"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={formData.role}
                        onChange={handleChange}
                      >
                        <option value="employee">Employee - Submits expenses</option>
                        <option value="manager">Manager - First approval level</option>
                        <option value="finance">Finance - Second approval level</option>
                        <option value="director">Director - Can override all approvals</option>
                      </select>
                      <div className="mt-2 p-2 bg-purple-50 rounded text-xs text-purple-800">
                        <strong>Director Special Power:</strong> Can instantly approve any expense, bypassing all other approvals.
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Manager (Optional)
                      </label>
                      <select
                        name="managerId"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={formData.managerId}
                        onChange={handleChange}
                      >
                        <option value="">No Manager</option>
                        {managers.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.first_name} {m.last_name} ({m.role})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Required for employees to enable proper approval workflow
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Create User & Send Credentials
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;