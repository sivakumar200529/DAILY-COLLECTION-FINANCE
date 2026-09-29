import React, { useState } from 'react';
import { User } from '../../types';
import { api } from '../../services/api';
import { KrsLogo } from '../common/KrsLogo';
import { 
  Shield, 
  UserCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  User as UserIcon, 
  Phone, 
  ArrowRight, 
  Sparkles, 
  Building, 
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  Wallet
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeLanguageSwitch } from '../common/ThemeLanguageSwitch';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'COLLECTOR' | 'CUSTOMER'>('ADMIN');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleRoleChange = (role: 'ADMIN' | 'COLLECTOR' | 'CUSTOMER') => {
    setSelectedRole(role);
    setError(null);
    if (role === 'ADMIN') {
      setUsername('admin');
      setPassword('admin123');
    } else if (role === 'COLLECTOR') {
      setUsername('COL101');
      setPassword('1234');
    } else {
      setUsername('9876543210');
      setPassword('1234');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({
        username: username.trim(),
        password: password.trim(),
        role: selectedRole,
      });

      if (res && res.user) {
        localStorage.setItem('krs_token', res.token);
        localStorage.setItem('krs_user', JSON.stringify(res.user));
        onLoginSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Ambience Glows */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-gold-500/10 via-amber-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-blue-600/10 via-indigo-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 px-4 sm:px-8 py-4 border-b border-gold-500/15 bg-navy-950/70 backdrop-blur-md flex items-center justify-between">
        <KrsLogo size="md" showTagline={false} />
        <ThemeLanguageSwitch variant="login" showLabels={true} />
      </header>

      {/* Main Login Container - Clean Centered Layout */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="glass-card rounded-3xl border border-gold-500/30 shadow-2xl p-6 sm:p-8 backdrop-blur-xl bg-navy-900/90 relative">
              
              {/* Card Header with Bespoke Logo */}
              <div className="text-center pb-5 mb-5 border-b border-slate-800">
                <KrsLogo size="md" variant="vertical" showSubtitle={true} />
              </div>

              {/* 3 Role Toggle Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-navy-950 border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => handleRoleChange('ADMIN')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                    selectedRole === 'ADMIN'
                      ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 shadow-md shadow-gold-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t('roleAdmin', '1. ADMIN')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('COLLECTOR')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                    selectedRole === 'COLLECTOR'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-navy-950 font-black shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t('roleAgent', '2. AGENT')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('CUSTOMER')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                    selectedRole === 'CUSTOMER'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t('roleCustomer', '3. CUSTOMER')}</span>
                </button>
              </div>

              {/* Form Sub-Header */}
              <div className="mb-4">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  {selectedRole === 'ADMIN' ? (
                    <>
                      <Shield className="w-4 h-4 text-gold-400 flex-shrink-0" />
                      {t('adminTitle', '1. Administrator (Can Do Anything)')}
                    </>
                  ) : selectedRole === 'COLLECTOR' ? (
                    <>
                      <Wallet className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {t('agentTitle', '2. Collection Agent (Collect & Reports)')}
                    </>
                  ) : (
                    <>
                      <Building className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      {t('customerTitle', '3. Customer Portal (Passbook & Pay)')}
                    </>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedRole === 'ADMIN'
                    ? t('adminDesc', 'Full master controls: Edit/delete accounts, plans, settings, audits & customers')
                    : selectedRole === 'COLLECTOR'
                    ? t('agentDesc', 'Field agent workspace: Collect doorstep dues, 1-tap collect & reports')
                    : t('customerDesc', 'Customer passbook: Track repayments, view receipts & pay via UPI/Netbanking')}
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    {selectedRole === 'ADMIN' 
                      ? t('usernameOrEmail', 'Admin Username / Email') 
                      : selectedRole === 'COLLECTOR' 
                      ? t('agentIdPlaceholder', 'Agent ID / Mobile (e.g. COL101)') 
                      : t('customerIdPlaceholder', 'Customer ID / Mobile Number')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      {selectedRole === 'ADMIN' ? <UserIcon className="w-4 h-4" /> : selectedRole === 'COLLECTOR' ? <Wallet className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder={
                        selectedRole === 'ADMIN' 
                          ? t('admin or admin@dailycollection.com', 'admin or admin@dailycollection.com') 
                          : selectedRole === 'COLLECTOR' 
                          ? t('e.g. COL101 or 9842111223', 'e.g. COL101 or 9842111223') 
                          : t('e.g. 9876543210 or KRS10001', 'e.g. 9876543210 or KRS10001')
                      }
                      className="w-full pl-10 pr-4 py-2.5 bg-navy-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all font-sans"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      {selectedRole === 'ADMIN' ? t('password', 'Password') : t('pinCode', 'Password / PIN')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-gold-400 hover:text-gold-300 transition-colors font-medium"
                    >
                      {t('needHelp', 'Need Help?')}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder={selectedRole === 'ADMIN' ? '••••••••' : t('pinPlaceholder', '4-digit PIN (e.g. 1234)')}
                      className="w-full pl-10 pr-10 py-2.5 bg-navy-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 bg-navy-950 text-gold-500 focus:ring-gold-400"
                    />
                    <span className="text-xs text-slate-300 select-none">{t('rememberMe', 'Remember this session')}</span>
                  </label>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-200 ${
                    selectedRole === 'ADMIN'
                      ? 'bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 shadow-gold-500/20'
                      : selectedRole === 'COLLECTOR'
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-navy-950 shadow-emerald-500/20 font-black'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'
                  } disabled:opacity-50`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>
                        {selectedRole === 'COLLECTOR' 
                          ? `${t('signIn', 'Sign In')} (${t('roleAgent', '2. AGENT')})` 
                          : selectedRole === 'ADMIN' 
                          ? `${t('signIn', 'Sign In')} (${t('roleAdmin', '1. ADMIN')})` 
                          : `${t('signIn', 'Sign In')} (${t('roleCustomer', '3. CUSTOMER')})`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Demo Credentials Assistant (1-Click) */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                  {t('instantLogin', 'Instant 1-Click Login (3 Personas)')}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('ADMIN');
                      setUsername('admin');
                      setPassword('admin123');
                    }}
                    className="p-2 rounded-xl bg-navy-950 border border-gold-500/25 hover:border-gold-500 text-left transition-all group"
                  >
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-gold-400 group-hover:scale-125 transition-transform" />
                      <span className="font-bold text-gold-300 text-[11px] truncate">{t('roleAdmin', '1. Admin')}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate">admin / admin123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('COLLECTOR');
                      setUsername('COL101');
                      setPassword('1234');
                    }}
                    className="p-2 rounded-xl bg-navy-950 border border-emerald-500/25 hover:border-emerald-500 text-left transition-all group"
                  >
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform" />
                      <span className="font-bold text-emerald-300 text-[11px] truncate">{t('roleAgent', '2. Agent')}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate">COL101 / 1234</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('CUSTOMER');
                      setUsername('9876543210');
                      setPassword('1234');
                    }}
                    className="p-2 rounded-xl bg-navy-950 border border-blue-500/25 hover:border-blue-500 text-left transition-all group"
                  >
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-400 group-hover:scale-125 transition-transform" />
                      <span className="font-bold text-blue-300 text-[11px] truncate">{t('roleCustomer', '3. Customer')}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5 truncate">9876543210</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
      </main>

      {/* Footer Credentials Reminder */}
      <footer className="relative z-10 px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-900 bg-navy-950">
        <p>
          {t('copyright', '© 2026 DAILY COLLECTION • chennai, Tamil Nadu')}
        </p>
      </footer>

      {/* Credentials Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm">
          <div className="glass-card rounded-2xl border border-gold-500/30 p-6 max-w-sm w-full bg-navy-900 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-gold-400" />
              {t('Demo Credentials Guide', 'Demo Credentials Guide')}
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              {t('Pre-configured test accounts ready for demonstration:', 'Pre-configured test accounts ready for demonstration:')}
            </p>
            <div className="space-y-2.5 text-xs mb-5 font-mono">
              <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                <span className="font-bold text-gold-400 block font-sans">{t('Admin Account', 'Admin Account')}</span>
                <span className="text-slate-300 block">{t('User:', 'User:')} admin</span>
                <span className="text-slate-400 block">{t('Pass:', 'Pass:')} admin123</span>
              </div>
              <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                <span className="font-bold text-blue-400 block font-sans">{t('Customer Account', 'Customer Account')}</span>
                <span className="text-slate-300 block">{t('Cust ID:', 'Cust ID:')} 9876543210 ({t('or DC10001', 'or DC10001')})</span>
                <span className="text-slate-400 block">{t('PIN:', 'PIN:')} 1234</span>
              </div>
            </div>
            <button
              onClick={() => setShowForgotPassword(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
            >
              {t('Close', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
