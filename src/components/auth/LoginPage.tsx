import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff, UserCheck, Wallet } from 'lucide-react';
import { Role, User } from '../../types';
import { api } from '../../services/api';
import { KrsLogo } from '../common/KrsLogo';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageButton, LanguageChoice } from '../common/ThemeLanguageSwitch';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
}

/** Demo accounts from the sample data (for testing; see README). */
const DEMO: Record<Role, { username: string; password: string }> = {
  ADMIN: { username: 'admin', password: 'admin123' },
  COLLECTOR: { username: 'COL101', password: '1234' },
  CUSTOMER: { username: '9876543210', password: '1234' },
};

/** Sign in: pick the language (first time), who you are, then mobile/ID and PIN. */
export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { t, hasChosenLanguage } = useLanguage();
  const [role, setRole] = useState<Role>('ADMIN');
  const [username, setUsername] = useState(DEMO.ADMIN.username);
  const [password, setPassword] = useState(DEMO.ADMIN.password);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseRole = (next: Role) => {
    setRole(next);
    setError(null);
    setUsername(DEMO[next].username);
    setPassword(DEMO[next].password);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ username: username.trim(), password: password.trim(), role });
      if (res && res.user) {
        localStorage.setItem('krs_token', res.token);
        localStorage.setItem('krs_user', JSON.stringify(res.user));
        onLoginSuccess(res.user, res.token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed', 'Could not sign in. Check the mobile/ID and PIN.'));
    } finally {
      setLoading(false);
    }
  };

  const roles: { id: Role; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'ADMIN', label: t('roleOffice', 'Office'), icon: Building2 },
    { id: 'COLLECTOR', label: t('roleCollector', 'Collector'), icon: Wallet },
    { id: 'CUSTOMER', label: t('roleCustomer', 'Customer'), icon: UserCheck },
  ];

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans">
      <header className="px-4 sm:px-8 py-3 border-b border-gold-500/15 flex items-center justify-between">
        <KrsLogo size="md" showTagline={false} />
        {hasChosenLanguage && <LanguageButton />}
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden border border-gold-500/25 shadow-2xl glass-card bg-navy-900/90">
          <div className="hidden lg:block relative min-h-[560px]">
            <img src="/krishna_divine.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-transparent" />
          </div>

          <div className="p-6 sm:p-10">
            {!hasChosenLanguage ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-black text-white leading-snug">
                  மொழியைத் தேர்ந்தெடுக்கவும்
                  <br />
                  <span className="text-slate-300 text-xl">Choose your language</span>
                </h2>
                <LanguageChoice />
              </div>
            ) : (
              <div className="space-y-5">
                <h2 className="text-2xl font-black text-white">{t('whoAreYou', 'Who are you?')}</h2>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(r => {
                    const Icon = r.icon;
                    const active = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => chooseRole(r.id)}
                        className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border-2 text-sm font-black transition-all ${
                          active ? 'bg-gold-500 border-gold-500 text-navy-950' : 'bg-navy-950 border-slate-700 text-slate-200 hover:border-gold-500/60'
                        }`}
                      >
                        <Icon className="w-7 h-7" />
                        {r.label}
                      </button>
                    );
                  })}
                </div>

                {error && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-sm text-rose-300">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">
                      {role === 'ADMIN' ? t('username', 'Username') : t('mobileOrId', 'Mobile number or ID')}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className="w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-lg text-white focus:outline-none focus:border-gold-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">
                      {role === 'ADMIN' ? t('password', 'Password') : t('pin', 'PIN')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        inputMode={role === 'ADMIN' ? 'text' : 'numeric'}
                        className="w-full px-4 py-3 pr-12 bg-navy-950 border border-slate-700 rounded-2xl text-lg text-white focus:outline-none focus:border-gold-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('hide', 'Hide') : t('show', 'Show')}
                        className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {t('signIn', 'Sign in')}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                  {t('demoAccountsNote', 'Demo accounts are filled in when you choose who you are (testing only).')}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
