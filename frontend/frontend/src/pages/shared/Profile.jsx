import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  User, KeyRound, Save, Mail, Shield, CheckCircle2, AlertCircle,
  X, Eye, EyeOff, QrCode, Smartphone, RefreshCcw, ChevronRight,
  Lock, Camera, Bell, LogOut, Sun, Moon, Monitor, History, Laptop, Plug,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile Info', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'security', label: '2FA Security', icon: Shield },
  { id: 'activity', label: 'Your Activity', icon: History },
  { id: 'sessions', label: 'Sessions & Logins', icon: Laptop },
];

const AVATAR_COLORS = {
  slate: 'from-gray-800 to-gray-600',
  blue: 'from-blue-700 to-blue-500',
  emerald: 'from-emerald-700 to-emerald-500',
  violet: 'from-violet-700 to-violet-500',
  rose: 'from-rose-700 to-rose-500',
  amber: 'from-amber-700 to-amber-500',
};

function StrengthBar({ strength }) {
  const segments = 4;
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const color = colors[strength - 1] || 'bg-gray-200 dark:bg-neutral-700';
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength ? color : 'bg-gray-200 dark:bg-neutral-700'}`}
          />
        ))}
      </div>
      {strength > 0 && (
        <p className={`text-xs font-medium ${
          strength >= 3 ? 'text-green-600 dark:text-green-400' :
          strength >= 2 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'
        }`}>
          {labels[strength]}
        </p>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center shadow-md">
        <Icon className="w-5 h-5 text-white dark:text-gray-900" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function FloatingInput({ label, icon: Icon, type = 'text', value, onChange, placeholder, suffix }) {
  return (
    <div className="relative group">
      <Label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-4 h-4 text-gray-400 dark:text-neutral-500 transition-colors group-focus-within:text-gray-700 dark:group-focus-within:text-neutral-300" />
          </div>
        )}
        <Input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${Icon ? 'pl-10' : 'pl-4'} ${suffix ? 'pr-10' : 'pr-4'} h-12 rounded-xl bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white/20 focus:border-transparent transition-all text-sm placeholder:text-gray-400 dark:placeholder:text-neutral-600`}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser, setTheme, API_BASE_URL } = useAuth();
  const { confirm } = useConfirmDialog();
  const [activeSection, setActiveSection] = useState('profile');
  const [prefs, setPrefs] = useState({
    email_notifications: true,
    alert_uploads: true,
    alert_inventory: true,
    alert_forecast_failures: true,
    digest: 'instant',
    avatar_color: 'slate',
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [myActivity, setMyActivity] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '', passwordTotpCode: '' });
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [twoFA, setTwoFA] = useState({ loading: false, qr: '', secret: '', otpauth: '' });
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAStep, setTwoFAStep] = useState('idle');
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const roleLabel = user?.role ? `${String(user.role).charAt(0).toUpperCase()}${String(user.role).slice(1)}` : 'User';

  const applyThemeFromUser = (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGet('/api/users/me');
        setProfile((p) => ({ ...p, name: data.name || '', email: data.email || '' }));
        setIs2FAEnabled(data?.totp_enabled === true || data?.totp_enabled === 1 || data?.totp_enabled === '1' || data?.totp_enabled === 'true');
        if (data.theme) applyThemeFromUser(data.theme);

        const prefRes = await apiGet('/api/users/me/preferences').catch(() => ({}));
        if (prefRes?.preferences) setPrefs((p) => ({ ...p, ...prefRes.preferences }));

        const actRes = await apiGet('/api/users/me/activity').catch(() => ({}));
        setMyActivity(actRes.activity || []);

        const loginRes = await apiGet('/api/users/me/login-history').catch(() => ({}));
        setLoginHistory(loginRes.logins || []);

        const sessRes = await apiGet('/api/users/me/sessions').catch(() => ({}));
        setSessions(sessRes.sessions || []);
      } catch (e) {
        setMsg({ type: 'error', text: 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user?.id]);

  const handleThemeChange = async (theme) => {
    try {
      await apiPut('/api/users/me', { theme });
      updateUser({ theme });
      setTheme(theme);
      setMsg({ type: 'success', text: 'Theme updated' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to save theme' });
    }
  };

  const savePreferences = async (patch) => {
    setPrefsSaving(true);
    try {
      const res = await apiPut('/api/users/me/preferences', { ...prefs, ...patch });
      if (res.preferences) setPrefs((p) => ({ ...p, ...res.preferences }));
      setMsg({ type: 'success', text: 'Preferences saved' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to save preferences' });
    } finally {
      setPrefsSaving(false);
    }
  };

  const cycleAvatarColor = async () => {
    const keys = Object.keys(AVATAR_COLORS);
    const idx = keys.indexOf(prefs.avatar_color);
    const next = keys[(idx + 1) % keys.length];
    setPrefs((p) => ({ ...p, avatar_color: next }));
    await savePreferences({ avatar_color: next });
  };

  const handleRevokeOtherSessions = async () => {
    const ok = await confirm('Sign out all other devices? You will stay signed in on this browser.', {
      title: 'Revoke other sessions',
      confirmText: 'Revoke',
    });
    if (!ok) return;
    setSessionsLoading(true);
    try {
      const res = await apiPost('/api/users/me/sessions/revoke-others', {});
      setSessions(res.sessions || []);
      setMsg({ type: 'success', text: res.message || 'Other sessions cleared' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to revoke sessions' });
    } finally {
      setSessionsLoading(false);
    }
  };

  const avatarGradient = AVATAR_COLORS[prefs.avatar_color] || AVATAR_COLORS.slate;

  useEffect(() => {
    if (user) {
      setHasChanges(profile.name !== (user.name || '') || profile.email !== (user.email || ''));
    }
  }, [profile.name, profile.email, user]);

  useEffect(() => {
    if (profile.newPassword) {
      let s = 0;
      if (profile.newPassword.length >= 8) s++;
      if (profile.newPassword.length >= 12) s++;
      if (/[a-z]/.test(profile.newPassword) && /[A-Z]/.test(profile.newPassword)) s++;
      if (/\d/.test(profile.newPassword)) s++;
      if (/[^a-zA-Z0-9]/.test(profile.newPassword)) s++;
      setPasswordStrength(Math.min(s, 4));
    } else {
      setPasswordStrength(0);
    }
  }, [profile.newPassword]);

  const handleUpdateProfile = async () => {
    if (!profile.name || !profile.email) return setMsg({ type: 'error', text: 'Name and email are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return setMsg({ type: 'error', text: 'Please enter a valid email address' });
    setProfileLoading(true); setMsg({ type: '', text: '' });
    try {
      await apiPut('/api/users/me', { name: profile.name, email: profile.email });
      updateUser({ name: profile.name, email: profile.email });
      setMsg({ type: 'success', text: 'Profile updated successfully' });
      setHasChanges(false);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to update profile' });
    } finally { setProfileLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!profile.currentPassword || !profile.newPassword || !profile.confirmPassword) return setMsg({ type: 'error', text: 'Please fill in all password fields' });
    if (is2FAEnabled && String(profile.passwordTotpCode || '').trim().length !== 6) {
      return setMsg({ type: 'error', text: 'Enter the 6-digit 2FA code to update password' });
    }
    if (profile.newPassword.length < 8) return setMsg({ type: 'error', text: 'New password must be at least 8 characters' });
    if (profile.newPassword !== profile.confirmPassword) return setMsg({ type: 'error', text: 'New passwords do not match' });
    if (profile.currentPassword === profile.newPassword) return setMsg({ type: 'error', text: 'New password must be different from current password' });
    setPasswordLoading(true); setMsg({ type: '', text: '' });
    try {
      await apiPut('/api/users/me/password', {
        currentPassword: profile.currentPassword,
        newPassword: profile.newPassword,
        totpCode: is2FAEnabled ? String(profile.passwordTotpCode || '').trim() : undefined
      });
      setProfile((p) => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '', passwordTotpCode: '' }));
      setMsg({ type: 'success', text: 'Password changed successfully' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to change password' });
    } finally { setPasswordLoading(false); }
  };

  const handleStart2FA = async () => {
    setTwoFA((p) => ({ ...p, loading: true })); setTwoFAStep('idle'); setTwoFACode(''); setMsg({ type: '', text: '' });
    try {
      const data = await apiPost('/api/auth/2fa/setup', {});
      setTwoFA({ loading: false, qr: data.qrCodeDataUrl || '', secret: data.secretBase32 || '', otpauth: data.otpauthUrl || '' });
      setTwoFAStep('scan');
      setMsg({ type: 'success', text: 'Scan the QR code in your authenticator app, then enter the 6-digit code.' });
    } catch (e) {
      setTwoFA((p) => ({ ...p, loading: false }));
      setMsg({ type: 'error', text: e.message || 'Failed to start 2FA setup' });
    }
  };

  const handleActivate2FA = async () => {
    if (!twoFACode || twoFACode.trim().length !== 6) return setMsg({ type: 'error', text: 'Enter the 6-digit code from your authenticator app.' });
    setTwoFA((p) => ({ ...p, loading: true })); setMsg({ type: '', text: '' });
    try {
      await apiPost('/api/auth/2fa/activate', { code: twoFACode.trim() });
      setTwoFACode(''); setTwoFA({ loading: false, qr: '', secret: '', otpauth: '' }); setTwoFAStep('idle');
      setIs2FAEnabled(true);
      setMsg({ type: 'success', text: '2FA enabled successfully.' });
    } catch (e) {
      setTwoFA((p) => ({ ...p, loading: false }));
      setMsg({ type: 'error', text: e.message || 'Failed to activate 2FA' });
    }
  };

  const handleDisable2FA = async () => {
    const ok = await confirm('Disable two-factor authentication for your account?', {
      title: 'Disable 2FA',
      confirmText: 'Disable',
      variant: 'danger',
    });
    if (!ok) return;
    setTwoFA((p) => ({ ...p, loading: true }));
    setMsg({ type: '', text: '' });
    try {
      await apiPost('/api/auth/2fa/disable', {});
      setTwoFA({ loading: false, qr: '', secret: '', otpauth: '' });
      setTwoFAStep('idle');
      setTwoFACode('');
      setIs2FAEnabled(false);
      setMsg({ type: 'success', text: '2FA disabled successfully.' });
    } catch (e) {
      setTwoFA((p) => ({ ...p, loading: false }));
      setMsg({ type: 'error', text: e.message || 'Failed to disable 2FA' });
    }
  };

  const togglePw = (field) => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-neutral-800 border-t-gray-900 dark:border-t-white animate-spin" />
          <p className="text-sm text-gray-500 dark:text-neutral-400 font-medium tracking-wide">Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">

        {/* ── Page title ── */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-1">Account</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings & Profile</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-3">

            {/* Avatar card */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-sm">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center shadow-lg`}>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      {getInitials(user?.name || profile.name)}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="Change avatar color"
                    onClick={cycleAvatarColor}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center shadow-md hover:scale-110 transition-transform border-2 border-white dark:border-neutral-900"
                  >
                    <Camera className="w-3.5 h-3.5 text-white dark:text-gray-900" />
                  </button>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
                    {user?.name || profile.name || 'Your Name'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 truncate max-w-[180px]">
                    {user?.email || profile.email || 'your@email.com'}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-neutral-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-2 shadow-sm space-y-0.5">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setActiveSection(id); setMsg({ type: '', text: '' }); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeSection === id
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {label}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-opacity ${activeSection === id ? 'opacity-60' : 'opacity-0'}`} />
                </button>
              ))}
            </nav>

            {/* Encryption notice */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-3.5 h-3.5 text-gray-500 dark:text-neutral-400" />
                </div>
                <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                  Your data is protected with industry-standard encryption. We never share your information.
                </p>
              </div>
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0 space-y-4">

            {/* Alert */}
            {msg.text && (
              <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border text-sm font-medium animate-in slide-in-from-top-1 duration-200 ${
                msg.type === 'success'
                  ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}>
                {msg.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span className="flex-1">{msg.text}</span>
                <button onClick={() => setMsg({ type: '', text: '' })} className="hover:opacity-60 transition-opacity flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Profile section ── */}
            {activeSection === 'profile' && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
                  <SectionHeader
                    icon={User}
                    title="Profile Information"
                    description="Update your name and email address visible across the platform"
                  />
                </div>
                <div className="px-8 py-7 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FloatingInput
                      label="Full Name"
                      icon={User}
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="John Doe"
                    />
                    <FloatingInput
                      label="Email Address"
                      icon={Mail}
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>

                  {/* Read-only role */}
                  <div>
                    <Label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">Role</Label>
                    <div className="h-12 px-4 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 flex items-center gap-3">
                      <Shield className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                      <span className="text-sm text-gray-600 dark:text-neutral-400 font-medium">{roleLabel}</span>
                      <span className="ml-auto text-xs text-gray-400 dark:text-neutral-600 bg-gray-100 dark:bg-neutral-700 px-2 py-0.5 rounded-md">Read only</span>
                    </div>
                  </div>
                </div>

                <div className="px-8 pb-8 flex items-center gap-4">
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={profileLoading || !hasChanges}
                    className="h-11 px-6 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold shadow-md transition-all disabled:opacity-40"
                  >
                    {profileLoading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                    ) : (
                      <><Save className="w-4 h-4" /> Save Changes</>
                    )}
                  </Button>
                  {hasChanges && (
                    <div className="flex items-center gap-2 text-xs text-orange-500 dark:text-orange-400 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      Unsaved changes
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Appearance ── */}
            {activeSection === 'appearance' && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
                  <SectionHeader icon={Sun} title="Appearance" description="Theme and display preferences" />
                </div>
                <div className="px-8 py-7 space-y-6">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 block">Theme</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'light', label: 'Light', icon: Sun },
                        { id: 'dark', label: 'Dark', icon: Moon },
                      ].map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleThemeChange(id)}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                            (user?.theme || 'light') === id
                              ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-neutral-800'
                              : 'border-gray-200 dark:border-neutral-700 hover:border-gray-400'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-semibold text-sm">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 block">Avatar color</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(AVATAR_COLORS).map(([key, gradient]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setPrefs((p) => ({ ...p, avatar_color: key })); savePreferences({ avatar_color: key }); }}
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} ring-2 ring-offset-2 ${
                            prefs.avatar_color === key ? 'ring-gray-900 dark:ring-white' : 'ring-transparent'
                          }`}
                          title={key}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notifications ── */}
            {activeSection === 'notifications' && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
                  <SectionHeader icon={Bell} title="Notifications" description="Choose what you want to be notified about" />
                </div>
                <div className="px-8 py-7 space-y-4">
                  {[
                    { key: 'email_notifications', label: 'Email notifications', desc: 'Receive alerts by email' },
                    { key: 'alert_uploads', label: 'Data uploads', desc: 'When sales or product data is uploaded' },
                    { key: 'alert_inventory', label: 'Inventory alerts', desc: 'Low stock and warehouse alerts' },
                    { key: 'alert_forecast_failures', label: 'Forecast failures', desc: 'When ML forecasting fails' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-4 rounded-xl border dark:border-neutral-700">
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prefs[key] === true}
                          onChange={(e) => {
                            const v = e.target.checked;
                            setPrefs((p) => ({ ...p, [key]: v }));
                            savePreferences({ [key]: v });
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  ))}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 block">Digest frequency</Label>
                    <select
                      value={prefs.digest || 'instant'}
                      onChange={(e) => { setPrefs((p) => ({ ...p, digest: e.target.value })); savePreferences({ digest: e.target.value }); }}
                      className="w-full h-11 px-4 rounded-xl border dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm"
                    >
                      <option value="instant">Instant</option>
                      <option value="daily">Daily digest</option>
                      <option value="weekly">Weekly digest</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Password section ── */}
            {activeSection === 'password' && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
                  <SectionHeader
                    icon={KeyRound}
                    title="Change Password"
                    description="Choose a strong password to keep your account secure"
                  />
                </div>

                {/* Requirements bar */}
                <div className="mx-8 mt-7 grid grid-cols-3 gap-3">
                  {[
                    { label: '8+ characters', met: profile.newPassword.length >= 8 },
                    { label: 'Upper & lower', met: /[a-z]/.test(profile.newPassword) && /[A-Z]/.test(profile.newPassword) },
                    { label: 'Number & symbol', met: /\d/.test(profile.newPassword) && /[^a-zA-Z0-9]/.test(profile.newPassword) },
                  ].map(({ label, met }) => (
                    <div key={label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                      met
                        ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                        : 'bg-gray-50 dark:bg-neutral-800/50 border-gray-200 dark:border-neutral-700 text-gray-400 dark:text-neutral-500'
                    }`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${met ? 'text-green-500' : 'text-gray-300 dark:text-neutral-600'}`} />
                      {label}
                    </div>
                  ))}
                </div>

                <div className="px-8 py-7 space-y-5">
                  <FloatingInput
                    label="Current Password"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={profile.currentPassword}
                    onChange={(e) => setProfile({ ...profile, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    suffix={
                      <button type="button" onClick={() => togglePw('current')} className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors">
                        {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  <div className="space-y-2">
                    <FloatingInput
                      label="New Password"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={profile.newPassword}
                      onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      suffix={
                        <button type="button" onClick={() => togglePw('new')} className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors">
                          {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                    {profile.newPassword && <StrengthBar strength={passwordStrength} />}
                  </div>

                  <div className="space-y-1">
                    <FloatingInput
                      label="Confirm New Password"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={profile.confirmPassword}
                      onChange={(e) => setProfile({ ...profile, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      suffix={
                        <button type="button" onClick={() => togglePw('confirm')} className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors">
                          {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                    {profile.confirmPassword && profile.newPassword !== profile.confirmPassword && (
                      <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium pt-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                      </p>
                    )}
                  </div>

                  {is2FAEnabled && (
                    <div className="space-y-1">
                      <FloatingInput
                        label="2FA Code"
                        type="text"
                        value={profile.passwordTotpCode}
                        onChange={(e) => setProfile({ ...profile, passwordTotpCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="Enter 6-digit code"
                      />
                      <p className="text-xs text-gray-500 dark:text-neutral-400">
                        Required because 2FA is enabled on your account.
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-8 pb-8 flex items-center gap-3">
                  <Button
                    onClick={handleChangePassword}
                    disabled={passwordLoading || !profile.currentPassword || !profile.newPassword || !profile.confirmPassword || (is2FAEnabled && String(profile.passwordTotpCode || '').trim().length !== 6)}
                    className="h-11 px-6 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold shadow-md transition-all disabled:opacity-40"
                  >
                    {passwordLoading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating…</>
                    ) : (
                      <><KeyRound className="w-4 h-4" /> Update Password</>
                    )}
                  </Button>
                  {(profile.currentPassword || profile.newPassword || profile.confirmPassword || profile.passwordTotpCode) && (
                    <Button
                      variant="ghost"
                      onClick={() => setProfile(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '', passwordTotpCode: '' }))}
                      className="h-11 px-4 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm font-medium"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── 2FA section ── */}
            {activeSection === 'activity' && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
                  <SectionHeader icon={History} title="Your recent activity" description="Last 5 actions on your account" />
                </div>
                <div className="px-8 py-6">
                  {myActivity.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No recent activity</p>
                  ) : (
                    <ul className="space-y-3">
                      {myActivity.map((row) => (
                        <li key={row.id} className="flex justify-between items-start p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50 text-sm">
                          <div>
                            <p className="font-semibold">{row.action}</p>
                            <p className="text-xs text-gray-500">{row.entity_type} {row.entity_id ? `#${row.entity_id}` : ''}</p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                            {new Date(row.created_at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'sessions' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                  <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-start">
                    <SectionHeader icon={Laptop} title="Active sessions" description="Devices where you are signed in" />
                    <Button variant="outline" size="sm" disabled={sessionsLoading} onClick={handleRevokeOtherSessions}>
                      Sign out others
                    </Button>
                  </div>
                  <div className="px-8 py-6 space-y-3">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border dark:border-neutral-700">
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-2">
                            {s.device}
                            {s.current && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">This device</span>}
                          </p>
                          <p className="text-xs text-gray-500">{s.ip || '—'} · {s.lastActive ? new Date(s.lastActive).toLocaleString() : ''}</p>
                        </div>
                        <Monitor className="w-5 h-5 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                  <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
                    <SectionHeader icon={History} title="Login history" description="Recent sign-in attempts" />
                  </div>
                  <div className="px-8 py-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase">
                          <th className="pb-2">Time</th>
                          <th className="pb-2">Action</th>
                          <th className="pb-2">Device</th>
                          <th className="pb-2">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loginHistory.map((row) => (
                          <tr key={row.id} className="border-t dark:border-neutral-800">
                            <td className="py-2 text-gray-600 dark:text-gray-400">{new Date(row.created_at).toLocaleString()}</td>
                            <td className="py-2">
                              <span className={row.action === 'LOGIN_FAILED' ? 'text-red-600 font-medium' : ''}>{row.action}</span>
                            </td>
                            <td className="py-2">{row.device}</td>
                            <td className="py-2 font-mono text-xs">{row.ip_address || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {loginHistory.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No login history</p>}
                  </div>
                </div>
              </div>
            )}

            {user?.role === 'admin' && activeSection === 'profile' && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 p-6">
                <div className="flex items-start gap-3">
                  <Plug className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Integrations (read-only)</p>
                    <p className="text-xs text-gray-500 mt-1">
                      API base: <code className="bg-gray-100 dark:bg-neutral-800 px-1 rounded">{API_BASE_URL}</code>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Webhooks and API keys can be configured in System Settings when enabled for your deployment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-neutral-800">
                  <SectionHeader
                    icon={Smartphone}
                    title="Two-Factor Authentication"
                    description="Add a second layer of security using Google Authenticator or Authy"
                  />
                </div>

                <div className="px-8 py-7 space-y-6">
                  {/* Explainer steps */}
                  {twoFAStep === 'idle' && !twoFA.qr && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { step: '01', title: 'Install App', desc: 'Download Google Authenticator or Authy on your phone.' },
                        { step: '02', title: 'Scan QR Code', desc: 'Click Enable 2FA to reveal a QR code to scan.' },
                        { step: '03', title: 'Enter Code', desc: 'Type the 6-digit code from the app to activate.' },
                      ].map(({ step, title, desc }) => (
                        <div key={step} className="relative rounded-2xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50 p-5">
                          <span className="text-4xl font-black text-gray-100 dark:text-neutral-700 leading-none block mb-3 select-none">{step}</span>
                          <p className="font-semibold text-gray-800 dark:text-white text-sm mb-1">{title}</p>
                          <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">{desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!is2FAEnabled && (
                    <div className="flex items-center gap-4">
                      <Button
                        onClick={handleStart2FA}
                        disabled={twoFA.loading}
                        className="h-11 px-6 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold shadow-md transition-all"
                      >
                        {twoFA.loading ? (
                          <><RefreshCcw className="w-4 h-4 animate-spin" /> Preparing…</>
                        ) : (
                          <><QrCode className="w-4 h-4" /> Enable 2FA</>
                        )}
                      </Button>
                      <span className="text-xs text-gray-400 dark:text-neutral-500 font-medium">
                        {twoFAStep === 'scan' ? 'Scan QR → confirm → activate' : 'Takes less than 2 minutes'}
                      </span>
                    </div>
                  )}

                  {is2FAEnabled && (
                    <div className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                      Two-factor authentication is currently enabled on this account.
                    </div>
                  )}

                  {is2FAEnabled && (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={handleDisable2FA}
                        disabled={twoFA.loading}
                        className="h-11 px-6 rounded-xl gap-2 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        {twoFA.loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Disable 2FA
                      </Button>
                    </div>
                  )}

                  {twoFA.qr && (
                    <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-neutral-700">
                        {/* QR */}
                        <div className="md:col-span-2 flex items-center justify-center p-8 bg-gray-50 dark:bg-neutral-800/50">
                          <div className="p-3 bg-white dark:bg-neutral-900 rounded-2xl shadow-inner border border-gray-200 dark:border-neutral-700">
                            <img src={twoFA.qr} alt="2FA QR code" className="w-44 h-44 block" />
                          </div>
                        </div>
                        {/* Controls */}
                        <div className="md:col-span-3 p-7 space-y-5">
                          {twoFA.secret && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">Manual Entry Key</p>
                              <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 px-4 py-3">
                                <code className="text-xs font-mono text-gray-700 dark:text-neutral-300 break-all flex-1">{twoFA.secret}</code>
                              </div>
                            </div>
                          )}

                          {twoFAStep === 'scan' ? (
                            <div className="space-y-3">
                              <p className="text-sm text-gray-600 dark:text-neutral-400">
                                Open your authenticator app and scan the QR code, or manually enter the key above.
                              </p>
                              <Button
                                onClick={() => setTwoFAStep('verify')}
                                disabled={twoFA.loading}
                                className="w-full h-11 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold"
                              >
                                <Smartphone className="w-4 h-4" /> I've scanned the QR code
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <FloatingInput
                                label="6-digit code"
                                type="text"
                                value={twoFACode}
                                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                              />
                              <Button
                                onClick={handleActivate2FA}
                                disabled={twoFA.loading}
                                className="w-full h-11 rounded-xl gap-2 bg-gray-900 hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-white font-semibold"
                              >
                                {twoFA.loading ? (
                                  <><RefreshCcw className="w-4 h-4 animate-spin" /> Activating…</>
                                ) : (
                                  <><Shield className="w-4 h-4" /> Verify & Activate</>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}