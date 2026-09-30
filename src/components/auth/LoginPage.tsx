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
  Wallet,
  Zap,
  CreditCard,
  Printer,
  ChevronRight
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
      setError(err.message || t('authentication failed. please verify your credentials.', 'Authentication failed. Please verify your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Ambience Glows */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[700px] h-[700px] bg-gradient-to-br from-gold-500/10 via-blue-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-royal-blue/15 via-indigo-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 px-4 sm:px-8 py-3.5 border-b border-gold-500/15 bg-navy-950/80 backdrop-blur-md flex items-center justify-between">
        <KrsLogo size="md" showTagline={false} />
        <div className="flex items-center gap-3">
          <ThemeLanguageSwitch variant="login" showLabels={true} />
        </div>
      </header>

      {/* Main Split-Screen Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-10">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-gold-500/25 shadow-2xl glass-card bg-navy-900/90 backdrop-blur-xl">
          
          {/* LEFT SECTION: Visual Section with Elegant Lord Krishna Artwork */}
          <div className="lg:col-span-6 relative min-h-[380px] lg:min-h-[640px] overflow-hidden flex flex-col justify-between p-6 sm:p-10 bg-navy-950">
            {/* Background Image with Cinematic Lighting */}
            <img 
              src="/krishna_divine.jpg" 
              alt="Lord Krishna Divine Finance Motif"
              className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 hover:scale-100 transition-transform duration-1000 ease-out brightness-90 contrast-105"
            />
            
            {/* Rich Vignette & Cinematic Dark/Gold Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-950/80 via-transparent to-navy-950/90" />
            <div className="absolute inset-0 bg-gradient-to-b from-navy-950/40 via-transparent to-navy-950" />

            {/* Top Brand Pill in Visual */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-navy-950/80 border border-gold-500/40 backdrop-blur-md shadow-lg">
                <div className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-gold-300">
                  {t('appName', 'DAILY COLLECTION')} • {t('location', 'chennai, Tamil Nadu')}
                </span>
              </div>
            </div>

            {/* Bottom Content Card on Visual Section */}
            <div className="relative z-10 space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gold-400 uppercase tracking-widest block font-sans">
                  {t('Indian Cultural Identity + Modern FinTech', 'Indian Cultural Identity + Modern FinTech')}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {t('Doorstep Microfinance', 'Doorstep Microfinance')} &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-amber-400 to-gold-500">{t('100-Day Smart Ledger', '100-Day Smart Ledger')}</span>
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {t('Empowering local shopkeepers, merchants & field agents with precision financial tracking, instant receipts & digital collections.', 'Empowering local shopkeepers, merchants & field agents with precision financial tracking, instant receipts & digital collections.')}
                </p>
              </div>

              {/* 3 Core SaaS Pillar Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <div className="p-2.5 rounded-xl bg-navy-900/80 border border-slate-700/80 backdrop-blur-md">
                  <Zap className="w-4 h-4 text-amber-400 mb-1" />
                  <h4 className="text-[11px] font-bold text-white leading-snug">{t('1-Tap Collect', '1-Tap Collect')}</h4>
                  <p className="text-[10px] text-slate-400">{t('Field Mobile Agent', 'Field Mobile Agent')}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-navy-900/80 border border-slate-700/80 backdrop-blur-md">
                  <Printer className="w-4 h-4 text-emerald-400 mb-1" />
                  <h4 className="text-[11px] font-bold text-white leading-snug">{t('Thermal Print', 'Thermal Print')}</h4>
                  <p className="text-[10px] text-slate-400">{t('WhatsApp & PDF', 'WhatsApp & PDF')}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-navy-900/80 border border-slate-700/80 backdrop-blur-md">
                  <CreditCard className="w-4 h-4 text-blue-400 mb-1" />
                  <h4 className="text-[11px] font-bold text-white leading-snug">{t('Online UPI', 'Online UPI')}</h4>
                  <p className="text-[10px] text-slate-400">{t('Razorpay Gateway', 'Razorpay Gateway')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SECTION: Interactive High-End Authentication Card */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-navy-900/95 border-t lg:border-t-0 lg:border-l border-slate-800">
            <div>
              {/* Form Header */}
              <div className="mb-5 pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      {t('Welcome Back', 'Welcome Back')}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t('Sign in to access your daily collection workspace', 'Sign in to access your daily collection workspace')}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-400/20 to-amber-500/20 border border-gold-500/30 flex items-center justify-center text-gold-400 shadow-md">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* 3 Role Selection Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-navy-950 border border-slate-800 mb-5 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleRoleChange('ADMIN')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                    selectedRole === 'ADMIN'
                      ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-navy-950 shadow-md shadow-gold-500/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t('roleAdmin', '1. ADMIN')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('COLLECTOR')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                    selectedRole === 'COLLECTOR'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-navy-950 shadow-md shadow-emerald-500/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t('roleAgent', '2. AGENT')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('CUSTOMER')}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                    selectedRole === 'CUSTOMER'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t('roleCustomer', '3. CUSTOMER')}</span>
                </button>
              </div>

              {/* Role Scope Notice */}
              <div className="mb-4 p-3 rounded-xl bg-navy-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                {selectedRole === 'ADMIN' ? (
                  <Shield className="w-4 h-4 text-gold-400 flex-shrink-0 mt-0.5" />
                ) : selectedRole === 'COLLECTOR' ? (
                  <Wallet className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Building className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <strong className="text-white block font-semibold">
                    {selectedRole === 'ADMIN' 
                      ? t('adminTitle', '1. Administrator (Can Do Anything)')
                      : selectedRole === 'COLLECTOR'
                      ? t('agentTitle', '2. Collection Agent (Collect & Reports)')
                      : t('customerTitle', '3. Customer Portal (Passbook & Pay)')}
                  </strong>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {selectedRole === 'ADMIN'
                      ? t('adminDesc', 'Full master controls: Edit/delete accounts, plans, settings, audits & customers')
                      : selectedRole === 'COLLECTOR'
                      ? t('agentDesc', 'Field agent workspace: Collect doorstep dues, 1-tap collect & reports')
                      : t('customerDesc', 'Customer passbook: Track repayments, view receipts & pay via UPI/Netbanking')}
                  </span>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    {selectedRole === 'ADMIN' 
                      ? t('usernameOrEmail', 'Admin Username / Email') 
                      : selectedRole === 'COLLECTOR' 
                      ? t('agentIdPlaceholder', 'Agent ID / Mobile (e.g. COL101)') 
                      : t('customerIdPlaceholder', 'Customer ID / Mobile Number')}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-gold-400 transition-colors">
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
                      className="w-full pl-10 pr-4 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all font-sans"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      {selectedRole === 'ADMIN' ? t('password', 'Password') : t('pinCode', 'Password / PIN')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-gold-400 hover:text-gold-300 transition-colors font-semibold"
                    >
                      {t('needHelp', 'Need Help?')}
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-gold-400 transition-colors">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder={selectedRole === 'ADMIN' ? '••••••••' : t('pinPlaceholder', '4-digit PIN (e.g. 1234)')}
                      className="w-full pl-10 pr-10 py-2.5 bg-navy-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 bg-navy-950 text-gold-500 focus:ring-gold-400 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 select-none font-medium">{t('rememberMe', 'Remember this session')}</span>
                  </label>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-200 cursor-pointer ${
                    selectedRole === 'ADMIN'
                      ? 'bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 shadow-gold-500/20 font-black'
                      : selectedRole === 'COLLECTOR'
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-navy-950 shadow-emerald-500/20 font-black'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 font-black'
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

              {/* Instant 1-Click Login Assistant (3 Personas) */}
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
                    className="p-2 rounded-xl bg-navy-950 border border-gold-500/25 hover:border-gold-500 text-left transition-all group cursor-pointer"
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
                    className="p-2 rounded-xl bg-navy-950 border border-emerald-500/25 hover:border-emerald-500 text-left transition-all group cursor-pointer"
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
                    className="p-2 rounded-xl bg-navy-950 border border-blue-500/25 hover:border-blue-500 text-left transition-all group cursor-pointer"
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

            {/* Bottom mini copyright inside login panel */}
            <div className="pt-4 mt-4 border-t border-slate-800/60 text-center">
              <span className="text-[10px] text-slate-500 font-mono">
                {t('copyright', '© 2026 DAILY COLLECTION • chennai, Tamil Nadu')}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-900 bg-navy-950/90 backdrop-blur-md">
        <p>
          {t('copyright', '© 2026 DAILY COLLECTION • chennai, Tamil Nadu')}
        </p>
      </footer>

      {/* Demo Credentials Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-in fade-in">
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
                <span className="font-bold text-emerald-400 block font-sans">{t('Collection Agent', 'Collection Agent')}</span>
                <span className="text-slate-300 block">{t('Agent ID:', 'Agent ID:')} COL101</span>
                <span className="text-slate-400 block">{t('PIN:', 'PIN:')} 1234</span>
              </div>
              <div className="p-3 rounded-xl bg-navy-950 border border-slate-800">
                <span className="font-bold text-blue-400 block font-sans">{t('Customer Account', 'Customer Account')}</span>
                <span className="text-slate-300 block">{t('Cust ID:', 'Cust ID:')} 9876543210 ({t('or DC10001', 'or DC10001')})</span>
                <span className="text-slate-400 block">{t('PIN:', 'PIN:')} 1234</span>
              </div>
            </div>
            <button
              onClick={() => setShowForgotPassword(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              {t('Close', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
