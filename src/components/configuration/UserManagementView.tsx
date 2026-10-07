import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  UserPlus,
  Edit3,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Share2,
  Phone,
  ShieldCheck,
  UserCheck,
  Users,
  Building2,
  Wallet,
} from 'lucide-react';
import { Role, User, CustomerPersonalDetails, Collector } from '../../types';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, ConfirmSheet, EmptyState, PageTitle, PillTabs, Sheet, Spinner } from '../common/ui';

const inputClass =
  'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none';

type RoleFilter = 'ALL' | 'ADMIN' | 'COLLECTOR' | 'CUSTOMER';

interface UserFormData {
  id?: string;
  username: string;
  password: string;
  role: Role;
  name: string;
  phone: string;
  email: string;
  customer_id?: string;
  collector_id?: string;
  is_active: boolean;
}

const emptyForm: UserFormData = {
  username: '',
  password: '',
  role: 'CUSTOMER',
  name: '',
  phone: '',
  email: '',
  is_active: true,
};

export const UserManagementView: React.FC = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[] | null>(null);
  const [customers, setCustomers] = useState<CustomerPersonalDetails[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [search, setSearch] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [editing, setEditing] = useState<UserFormData | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [uList, cList, colList] = await Promise.all([
        api.getUsers(),
        api.getCustomers().catch(() => []),
        api.getCollectors().catch(() => []),
      ]);
      setUsers(uList);
      setCustomers(cList);
      setCollectors(colList);
    } catch (err) {
      console.error(err);
      setUsers([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const shareViaWhatsApp = (u: User) => {
    const cleanPhone = (u.phone || '').replace(/\D/g, '');
    const loginUrl = window.location.origin;
    const pass = u.password || '1234';
    const message = encodeURIComponent(
      `*DAILY COLLECTION - Login Credentials*\n\n` +
      `Hello ${u.name},\nHere are your portal login details:\n\n` +
      `🔹 *Role:* ${u.role}\n` +
      `👤 *User ID / Username:* ${u.username}\n` +
      `🔑 *Password / PIN:* ${pass}\n` +
      `🌐 *Login Link:* ${loginUrl}\n\n` +
      `_Please keep your credentials safe._`
    );
    const target = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(target, '_blank');
  };

  const generateRandomPin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const openCreateModal = () => {
    setError(null);
    setEditing({
      ...emptyForm,
      role: roleFilter === 'ALL' ? 'CUSTOMER' : roleFilter,
      password: generateRandomPin(),
    });
  };

  const openEditModal = (u: User) => {
    setError(null);
    setEditing({
      id: u.id,
      username: u.username,
      password: u.password || '1234',
      role: u.role,
      name: u.name,
      phone: u.phone,
      email: u.email,
      customer_id: u.customer_id,
      collector_id: u.collector_id,
      is_active: u.is_active,
    });
  };

  const handlePickCustomer = (custId: string) => {
    const cust = customers.find(c => c.id === custId);
    if (!cust || !editing) return;
    setEditing({
      ...editing,
      customer_id: cust.id,
      username: cust.id,
      name: cust.full_name,
      phone: cust.mobile_number,
      email: cust.email || '',
    });
  };

  const handlePickCollector = (colId: string) => {
    const col = collectors.find(c => c.id === colId);
    if (!col || !editing) return;
    setEditing({
      ...editing,
      collector_id: col.id,
      username: col.id,
      name: col.name,
      phone: col.mobile,
      email: col.email || '',
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setError(null);

    const cleanUsername = editing.username.trim();
    const cleanPassword = editing.password.trim();
    const cleanName = editing.name.trim();

    if (!cleanUsername) {
      return setError(t('enterUsername', 'Please enter a User ID / Username.'));
    }
    if (!cleanPassword) {
      return setError(t('enterPassword', 'Please enter a Password / PIN.'));
    }
    if (!cleanName) {
      return setError(t('needName', 'Please enter full name.'));
    }

    setBusy(true);
    try {
      if (editing.id) {
        await api.updateUser(editing.id, {
          username: cleanUsername,
          password: cleanPassword,
          role: editing.role,
          name: cleanName,
          phone: editing.phone.trim(),
          email: editing.email.trim(),
          is_active: editing.is_active,
        });
      } else {
        await api.createUser({
          username: cleanUsername,
          password: cleanPassword,
          role: editing.role,
          name: cleanName,
          phone: editing.phone.trim(),
          email: editing.email.trim(),
          customer_id: editing.customer_id,
          collector_id: editing.collector_id,
        });
      }
      setEditing(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save user.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteUser(deleting.id);
      setDeleting(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  if (!users) return <Spinner />;

  // Filtered users list
  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = u.name.toLowerCase().includes(q);
      const matchUser = u.username.toLowerCase().includes(q);
      const matchPhone = (u.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      const matchCustId = u.customer_id?.toLowerCase().includes(q);
      const matchColId = u.collector_id?.toLowerCase().includes(q);
      return matchName || matchUser || matchPhone || matchCustId || matchColId;
    }
    return true;
  });

  const totalAdmins = users.filter(u => u.role === 'ADMIN').length;
  const totalCollectors = users.filter(u => u.role === 'COLLECTOR').length;
  const totalCustomers = users.filter(u => u.role === 'CUSTOMER').length;
  const totalActive = users.filter(u => u.is_active).length;

  return (
    <div className="space-y-4">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-gold-400" />
            {t('userManagement', 'User Logins & Passwords')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {t('userManageDesc', 'Create and manage User ID and Passwords for Admins, Agents, and Customers.')}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            title={t('refresh', 'Refresh')}
            className="p-3 rounded-2xl bg-navy-900 border border-slate-700 text-slate-300 hover:text-white hover:border-gold-500/50 transition-all cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <BigButton
            tone="gold"
            icon={UserPlus}
            label={t('addUser', 'Create User')}
            onClick={openCreateModal}
          />
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
            <span>{t('allUsers', 'All Users')}</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white">{users.length}</div>
          <div className="text-xs text-emerald-400 mt-0.5">{totalActive} {t('active', 'Active')}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-1">
            <span>{t('admins', 'Admins')}</span>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{totalAdmins}</div>
          <div className="text-xs text-slate-400 mt-0.5">{t('fullAccess', 'Full access')}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-cyan-500/20 bg-cyan-500/5">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-300 mb-1">
            <span>{t('agents', 'Agents / Field')}</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400">{totalCollectors}</div>
          <div className="text-xs text-slate-400 mt-0.5">{t('collectionTeam', 'Collection team')}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300 mb-1">
            <span>{t('customers', 'Customers')}</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{totalCustomers}</div>
          <div className="text-xs text-slate-400 mt-0.5">{t('borrowerPortals', 'Borrower passbooks')}</div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <PillTabs<RoleFilter>
          value={roleFilter}
          onChange={setRoleFilter}
          tabs={[
            { id: 'ALL', label: `${t('allUsers', 'All')} (${users.length})` },
            { id: 'ADMIN', label: `${t('admins', 'Admins')} (${totalAdmins})` },
            { id: 'COLLECTOR', label: `${t('agents', 'Agents')} (${totalCollectors})` },
            { id: 'CUSTOMER', label: `${t('customers', 'Customers')} (${totalCustomers})` },
          ]}
        />

        <div className="relative min-w-[260px] md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchUsers', 'Search name, User ID, phone...')}
            className="w-full pl-10 pr-4 py-2 bg-navy-950 border border-slate-700 focus:border-gold-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <EmptyState icon={Users} text={t('noUsersFound', 'No users found matching your search.')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredUsers.map(u => {
            const isRevealed = !!revealedPasswords[u.id];
            const displayPassword = u.password || '1234';
            const roleBadgeColor =
              u.role === 'ADMIN'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : u.role === 'COLLECTOR'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

            return (
              <div
                key={u.id}
                className={`glass-card rounded-2xl p-4 border flex flex-col justify-between transition-all ${
                  u.is_active ? 'border-slate-800' : 'border-rose-500/30 bg-rose-950/10 opacity-75'
                }`}
              >
                <div>
                  {/* Top line: Role badge & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide border ${roleBadgeColor}`}>
                      {u.role === 'ADMIN' ? t('roleOffice', 'ADMIN') : u.role === 'COLLECTOR' ? t('roleCollector', 'AGENT') : t('roleCustomer', 'CUSTOMER')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          u.is_active ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <span className="text-xs font-semibold text-slate-400">
                        {u.is_active ? t('active', 'Active') : t('deactivated', 'Deactivated')}
                      </span>
                    </div>
                  </div>

                  {/* User Name & Details */}
                  <div className="text-lg font-black text-white truncate">{u.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 mb-3">
                    {u.phone ? (
                      <span className="flex items-center gap-1 font-mono text-slate-300">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {u.phone}
                      </span>
                    ) : (
                      <span>{t('noPhone', 'No phone')}</span>
                    )}
                    {u.customer_id && <span className="font-mono text-emerald-400 font-bold">({u.customer_id})</span>}
                    {u.collector_id && <span className="font-mono text-cyan-400 font-bold">({u.collector_id})</span>}
                  </div>

                  {/* Credentials Box */}
                  <div className="bg-navy-950/90 border border-slate-800 rounded-xl p-3 space-y-2 mb-3">
                    {/* Username / User ID */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">{t('userId', 'User ID')}:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/20">
                          {u.username}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(u.username, `user-${u.id}`)}
                          title={t('copy', 'Copy User ID')}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedKey === `user-${u.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password / PIN */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">{t('password', 'Password')}:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700 min-w-[5rem] text-center">
                          {isRevealed ? displayPassword : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(u.id)}
                          title={isRevealed ? t('hide', 'Hide') : t('show', 'Show')}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(displayPassword, `pass-${u.id}`)}
                          title={t('copyPassword', 'Copy Password')}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedKey === `pass-${u.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-800/80">
                  {/* Share on WhatsApp */}
                  <button
                    type="button"
                    onClick={() => shareViaWhatsApp(u)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer"
                    title={t('shareWhatsApp', 'Send login details via WhatsApp')}
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('shareWhatsApp', 'WhatsApp')}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer"
                      title={t('edit', 'Edit Credentials')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete button (protected for USR001) */}
                    {u.id !== 'USR001' && (
                      <button
                        type="button"
                        onClick={() => setDeleting(u)}
                        className="p-2 rounded-xl text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer"
                        title={t('delete', 'Delete User')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit User Sheet */}
      {editing && (
        <Sheet
          title={editing.id ? t('editUser', 'Edit User Login') : t('addUser', 'Create User Login')}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            {/* Role Selector (only allowed when creating new) */}
            {!editing.id && (
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('role', 'Role')} *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ADMIN', 'COLLECTOR', 'CUSTOMER'] as Role[]).map(r => {
                    const active = editing.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEditing({ ...editing, role: r })}
                        className={`py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          active
                            ? 'bg-gold-500 border-gold-500 text-navy-950 shadow-md shadow-gold-500/20'
                            : 'bg-navy-950 border-slate-700 text-slate-300 hover:border-gold-500/50'
                        }`}
                      >
                        {r === 'ADMIN' ? t('roleOffice', 'Admin') : r === 'COLLECTOR' ? t('roleCollector', 'Agent') : t('roleCustomer', 'Customer')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Autofill Helper for Customer */}
            {!editing.id && editing.role === 'CUSTOMER' && customers.length > 0 && (
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1.5">
                  {t('linkExistingCustomer', 'Autofill from existing customer (Optional)')}
                </label>
                <select
                  className={inputClass}
                  value={editing.customer_id || ''}
                  onChange={e => handlePickCustomer(e.target.value)}
                >
                  <option value="">{t('selectOrTypeNew', '-- Select customer to autofill details --')}</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.id} - {c.mobile_number})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Autofill Helper for Collector */}
            {!editing.id && editing.role === 'COLLECTOR' && collectors.length > 0 && (
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1.5">
                  {t('linkExistingCollector', 'Autofill from existing agent (Optional)')}
                </label>
                <select
                  className={inputClass}
                  value={editing.collector_id || ''}
                  onChange={e => handlePickCollector(e.target.value)}
                >
                  <option value="">{t('selectOrTypeNew', '-- Select agent to autofill details --')}</option>
                  {collectors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id} - {c.mobile})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* User ID / Username */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">
                {t('userId', 'User ID / Username')} *
              </label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. KRS10001 or COL101 or agent_ravi"
                value={editing.username}
                onChange={e => setEditing({ ...editing, username: e.target.value })}
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                {t('usernameHint', 'This is the exact ID or phone number used to log into the application.')}
              </p>
            </div>

            {/* Password / PIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-bold text-slate-300">
                  {t('password', 'Password / PIN')} *
                </label>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, password: generateRandomPin() })}
                  className="text-xs text-gold-400 hover:text-gold-300 font-bold cursor-pointer"
                >
                  {t('generatePin', '⚡ Generate 6-digit PIN')}
                </button>
              </div>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. 1234 or secure password"
                value={editing.password}
                onChange={e => setEditing({ ...editing, password: e.target.value })}
                required
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">
                {t('fullName', 'Full Name')} *
              </label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Ramesh Kumar"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                required
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">
                {t('mobile', 'Mobile Number')}
              </label>
              <input
                type="tel"
                inputMode="tel"
                maxLength={14}
                className={inputClass}
                placeholder="e.g. 9876543210"
                value={editing.phone}
                onChange={e => setEditing({ ...editing, phone: e.target.value })}
              />
            </div>

            {/* Email (Optional) */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">
                {t('emailOptional', 'Email (Optional)')}
              </label>
              <input
                type="email"
                className={inputClass}
                placeholder="e.g. user@dailycollection.com"
                value={editing.email}
                onChange={e => setEditing({ ...editing, email: e.target.value })}
              />
            </div>

            {/* Active Status Checkbox */}
            <label className="flex items-center justify-between gap-3 text-base font-bold text-white p-3 rounded-2xl bg-navy-950 border border-slate-800">
              <span>{t('accountActive', 'Account Active (Allowed to log in)')}</span>
              <input
                type="checkbox"
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                checked={editing.is_active}
                onChange={e => setEditing({ ...editing, is_active: e.target.checked })}
              />
            </label>

            {error && (
              <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">
                {error}
              </div>
            )}

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <BigButton label={t('cancel', 'Cancel')} onClick={() => setEditing(null)} />
              <BigButton
                tone="gold"
                icon={Check}
                label={busy ? t('saving', 'Saving...') : t('save', 'Save')}
                onClick={handleSave}
                disabled={busy}
              />
            </div>
          </div>
        </Sheet>
      )}

      {/* Delete User Confirmation */}
      {deleting && (
        <ConfirmSheet
          title={t('deleteUserQuestion', 'Delete this user login?')}
          message={`${deleting.name} (${deleting.username}) - ${t(
            'deleteUserExplain',
            'This will permanently remove the login account. Linked customer or collector records will not be deleted.'
          )}`}
          yesLabel={t('yesDelete', 'Yes, delete')}
          noLabel={t('no', 'No')}
          danger
          busy={busy}
          onYes={handleDelete}
          onNo={() => setDeleting(null)}
        />
      )}
    </div>
  );
};
