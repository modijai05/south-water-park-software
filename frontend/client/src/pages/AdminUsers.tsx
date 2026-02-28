import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { usersApi } from '@/lib/api';

interface UserRow {
  _id: string;
  username: string;
  role: string;
  active: boolean;
  email?: string;
  fullName?: string;
  createdAt?: string;
  entriesCount?: number;
  successRate?: number;
  lastLogin?: string | undefined;
  performanceRating?: number;
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [logsFor, setLogsFor] = useState<{ id: string; username: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const usersData = await usersApi.list();
      const usersWithStats = await Promise.all(
        (Array.isArray(usersData) ? usersData : []).map(async (user: any) => {
          try {
            const logs = await usersApi.logs(user._id);
            const successCount = logs.logs?.filter((l: any) => l.success).length || 0;
            const totalCount = logs.logs?.length || 0;
            const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
            const lastLogin = logs.logs?.length > 0 ? logs.logs[0].timestamp : null;
            
            return {
              ...(user as UserRow),
              entriesCount: 0,
              successRate,
              lastLogin: lastLogin || undefined,
              performanceRating: 0
            } as UserRow;
          } catch {
            return {
              ...(user as UserRow),
              entriesCount: 0,
              successRate: 0,
              lastLogin: undefined,
              performanceRating: 0
            } as UserRow;
          }
        })
      );
      setUsers(usersWithStats);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await usersApi.update(id, { active });
      
      // Trigger real-time sync event for user management
      window.dispatchEvent(new CustomEvent('user-updated', { 
        detail: { 
          action: 'toggle-active',
          userId: id,
          active: active,
          timestamp: new Date().toISOString()
        } 
      }));
      
      fetchUsers();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    try {
      await usersApi.delete(id);
      
      // Trigger real-time sync event for user management
      window.dispatchEvent(new CustomEvent('user-updated', { 
        detail: { 
          action: 'delete',
          userId: id,
          timestamp: new Date().toISOString()
        } 
      }));
      
      fetchUsers();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const resetUserPassword = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to reset password for "${username}"? This will log them out if they are currently logged in.`)) {
      return;
    }
    
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    
    try {
      await usersApi.resetPassword(id, newPassword);
      
      // Trigger real-time sync event for password reset
      window.dispatchEvent(new CustomEvent('user-updated', { 
        detail: { 
          action: 'reset-password',
          userId: id,
          username: username,
          passwordChanged: true,
          timestamp: new Date().toISOString()
        } 
      }));
      
      alert(`Password for "${username}" has been reset successfully.`);
      fetchUsers();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <Layout title="👥 Manage Users">
      <div className="space-y-6">
        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h2 className="heading-md text-blue-900 mb-2">
            👥 Manage Users - Complete Staff Administration
          </h2>
          <p className="text-blue-800 text-lg">
            Create, edit, and manage staff accounts with performance tracking.
          </p>
        </motion.div>

        {/* Header with Add Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="modern-card">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h2 className="heading-lg text-blue-900 mb-2">👥 All Users</h2>
              <motion.button
                type="button"
                onClick={() => setShowCreate(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary"
              >
                ➕ Add New User
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="modern-card bg-white border-2 border-blue-200 shadow-xl max-h-[70vh] overflow-hidden flex flex-col">
            {loading ? (
              <p className="text-blue-900 text-center py-8">Loading users…</p>
            ) : users.length === 0 ? (
              <p className="text-blue-900 text-center py-8">No users found. Create one to get started.</p>
            ) : (
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-sm min-w-[1200px]">
                  <thead>
                    <tr className="border-b-2 border-blue-200 bg-blue-50">
                      <th className="py-3 px-4 text-blue-900 font-bold text-left w-32">👤 Username</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-left w-36">👨‍💼 Full Name</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-left w-40">📧 Email</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-center w-24">🎯 Role</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-center w-24">✓ Status</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-center w-28">📅 Created</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-center w-24">📊 Entries</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-center w-32">✅ Success Rate</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-center w-36">🕐 Last Login</th>
                      <th className="py-3 px-4 text-blue-900 font-bold text-center w-auto">⚙️ Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(users) && users.map((u, idx) => (
                      <motion.tr
                        key={u._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border-b border-blue-100 hover:bg-blue-50 transition"
                      >
                        <td className="py-3 px-4 font-bold text-blue-900 text-left">{u.username}</td>
                        <td className="py-3 px-4 text-blue-800 text-left">
                          {u.fullName || <span className="text-blue-600 italic">Not set</span>}
                        </td>
                        <td className="py-3 px-4 text-blue-800 text-left">
                          {u.email ? (
                            <a href={`mailto:${u.email}`} className="text-blue-600 hover:text-blue-800 underline">
                              {u.email}
                            </a>
                          ) : (
                            <span className="text-blue-600 italic">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex px-3 py-1 rounded-lg font-bold text-xs border ${
                            u.role === 'admin' 
                              ? 'bg-gradient-to-r from-blue-800 to-blue-900 text-white border-blue-700' 
                              : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500'
                          }`}>
                            {u.role === 'admin' ? '👑 Admin' : '👨 Staff'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleActive(u._id, !u.active)}
                            className={`inline-flex px-3 py-1 rounded-lg font-bold text-xs transition border ${
                              u.active 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500 hover:from-blue-700 hover:to-blue-800' 
                                : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-400 hover:from-gray-600 hover:to-gray-700'
                            }`}
                          >
                            {u.active ? '✅ Active' : '❌ Inactive'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-xs text-blue-800">
                            {u.createdAt ? dayjs(u.createdAt).format('DD/MM/YY') : 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-blue-900">{u.entriesCount || 0}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${
                            u.successRate! >= 80 ? 'text-blue-800' : 
                            u.successRate! >= 60 ? 'text-blue-700' : 'text-blue-600'
                          }`}>
                            {u.successRate || 0}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-xs text-blue-800">
                            {u.lastLogin ? dayjs(u.lastLogin).format('DD/MM/YY hh:mm A') : 'Never'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            <motion.button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="px-2 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-xs border border-blue-500 transition"
                            >
                              ✏️ Edit
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => resetUserPassword(u._id, u.username)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="px-2 py-1 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-xs border border-blue-400 transition"
                              title="Reset Password"
                            >
                              🔑 Reset
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => setLogsFor({ id: u._id, username: u.username })}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="px-2 py-1 rounded-lg bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold text-xs border border-blue-600 transition"
                            >
                              📋 Logs
                            </motion.button>
                            {u.role === 'staff' && (
                              <motion.button
                                type="button"
                                onClick={() => handleDelete(u._id)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="px-2 py-1 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold text-xs border border-gray-500 transition"
                              >
                                🗑️ Delete
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchUsers(); }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={() => { setEditingUser(null); fetchUsers(); }}
        />
      )}

      {logsFor && (
        <LogsModal
          userId={logsFor.id}
          username={logsFor.username}
          onClose={() => setLogsFor(null)}
        />
      )}
    </Layout>
  );
}

function EditUserModal({ user, onClose, onUpdated }: { 
  user: UserRow; 
  onClose: () => void; 
  onUpdated: () => void; 
}) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email || '');
  const [fullName, setFullName] = useState(user.fullName || '');
  const [role, setRole] = useState<'staff' | 'admin'>(user.role as 'staff' | 'admin');
  const [active, setActive] = useState(user.active);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const updateData: any = {};
    if (username.trim() !== user.username) updateData.username = username.trim();
    if (email.trim() !== (user.email || '')) updateData.email = email.trim() || undefined;
    if (fullName.trim() !== (user.fullName || '')) updateData.fullName = fullName.trim() || undefined;
    if (role !== user.role) updateData.role = role;
    if (active !== user.active) updateData.active = active;
    if (password) updateData.password = password;

    if (Object.keys(updateData).length === 0) {
      setError('No changes made');
      return;
    }

    if (password && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
      setError('Invalid email format');
      return;
    }

    setSaving(true);
    try {
      await usersApi.update(user._id, updateData);
      
      // Trigger real-time sync event for user updates
      if (updateData.username || updateData.password) {
        window.dispatchEvent(new CustomEvent('user-updated', { 
          detail: { 
            action: 'update-user',
            userId: user._id,
            username: updateData.username || user.username,
            passwordChanged: !!updateData.password,
            timestamp: new Date().toISOString()
          } 
        }));
      }
      
      onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="modern-card rounded-2xl p-8 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        <h3 className="heading-lg text-blue-900 mb-6">✏️ Edit User: {user.username}</h3>
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2">
          {error && <p className="text-red-900 font-bold bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👤 Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-modern"
                placeholder="Enter username"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">📧 Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-modern"
                placeholder="Enter email address"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">👨‍💼 Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-modern"
              placeholder="Enter full name"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">🎯 Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'staff' | 'admin')}
              className="input-modern"
            >
              <option value="staff">👨 Staff</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">✓ Status</label>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="active" className="text-blue-900 font-medium">
                {active ? '✅ Active' : '❌ Inactive'}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">🔐 New Password (leave empty to keep current)</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-modern pr-12"
                placeholder="Optional - enter new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <motion.button
              type="submit"
              disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : {}}
              whileTap={!saving ? { scale: 0.98 } : {}}
              className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '⏳ Saving…' : '💾 Save Changes'}
            </motion.button>
            <motion.button
              type="button"
              onClick={onClose}
              disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : {}}
              whileTap={!saving ? { scale: 0.98 } : {}}
              className="flex-1 py-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ❌ Cancel
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Username and password required');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Invalid email format');
      return;
    }
    setSaving(true);
    try {
      await usersApi.create(username.trim(), password, role, email.trim() || undefined, fullName.trim() || undefined);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="modern-card rounded-2xl p-8 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        <h3 className="heading-lg text-blue-900 mb-6">➕ Create New User</h3>
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2">
          {error && <p className="text-red-900 font-bold bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}
          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">👤 Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-modern"
              placeholder="Enter username"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">📨 Email (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-modern"
              placeholder="Enter email address"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">👨‍💼 Full Name (Optional)</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-modern"
              placeholder="Enter full name"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">🔐 Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-modern pr-12"
                placeholder="Enter password (min 6 characters)"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">🎯 Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'staff' | 'admin')}
              className="input-modern"
            >
              <option value="staff">👨 Staff</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>
          <div className="flex gap-3 mt-6">
            <motion.button 
              type="button" 
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-blue-900 font-bold"
            >
              Cancel
            </motion.button>
            <motion.button 
              type="submit" 
              disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : {}}
              whileTap={!saving ? { scale: 0.98 } : {}}
              className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '⏳ Creating…' : '✅ Create User'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function LogsModal({ userId, username, onClose }: { userId: string; username: string; onClose: () => void }) {
  const [logs, setLogs] = useState<{ timestamp: string; success: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.logs(userId).then((res) => setLogs(res.logs ?? [])).finally(() => setLoading(false));
  }, [userId]);

  const successCount = logs.filter((l) => l.success).length;
  const total = logs.length;
  const starRating = total === 0 ? 0 : Math.min(5, Math.round((successCount / total) * 5));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="modern-card rounded-2xl p-8 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="mb-4">
          <h3 className="text-2xl font-black bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent mb-2">📋 Login Logs</h3>
          <p className="text-white font-bold text-lg">{username}</p>
        </div>
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 p-4 rounded-lg mb-4 border border-cyan-400/30">
          <p className="text-cyan-200 font-bold text-sm mb-1">✅ Success Rate: <span className="text-white font-black">{successCount}/{total}</span></p>
          <p className="text-cyan-200 font-bold text-sm">⭐ Rating: <span className="text-yellow-300 font-black">{'★'.repeat(starRating)}{'☆'.repeat(5 - starRating)}</span></p>
        </div>
        <div className="overflow-y-auto flex-1 text-sm bg-white/5 rounded-lg p-4 border border-white/10 max-h-[50vh]">
          {loading ? (
            <p className="text-white/70 text-center">Loading logs…</p>
          ) : !Array.isArray(logs) || logs.length === 0 ? (
            <p className="text-white/70 text-center">No login history</p>
          ) : (
            <ul className="space-y-2">
                {Array.isArray(logs) && logs.slice(0, 50).map((l, i) => (
                <motion.li 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-2 rounded border-l-4 pl-3 font-semibold ${l.success ? 'bg-green-500/20 border-green-500 text-green-200' : 'bg-red-500/20 border-red-500 text-red-200'}`}
                >
                  {l.success ? '✅' : '❌'} {dayjs(l.timestamp).format('DD/MM/YY hh:mm A')}
                </motion.li>
              ))}
            </ul>
          )}
        </div>
        <motion.button 
          type="button" 
          onClick={onClose}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold w-full border-2 border-cyan-300 transition"
        >
          Close
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
