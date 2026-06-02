import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AlertCircle, ArrowLeft, CheckCircle, Lock, RefreshCcw } from 'lucide-react';
import logoSrc from '../../assets/IMG_1472.PNG';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = (params.get('email') || '').trim().toLowerCase();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const canSubmit = useMemo(() => {
    if (!token || !email) return false;
    if (!password || password.length < 6) return false;
    if (password !== confirm) return false;
    return true;
  }, [token, email, password, confirm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token || !email) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to reset password');
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-neutral-50 to-red-100/60 p-4">
      <div className="w-full max-w-xl">
        <Card className="shadow-2xl border-0 !bg-white !text-neutral-900 border border-neutral-300 shadow-black/10">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex justify-center pt-2">
              <img src={logoSrc} alt="Kinglion" className="h-24 sm:h-28 w-auto object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold !text-neutral-900">Reset password</CardTitle>
            <CardDescription className="!text-gray-600">
              {email ? `Set a new password for ${email}.` : 'Set a new password for your account.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!token || !email ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Invalid reset link. Please request a new password reset.
              </div>
            ) : null}

            {done ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Password updated. You can now log in.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">Minimum 6 characters.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-neutral-900/[0.03] to-red-100/80 border border-red-300 rounded-lg shadow-sm shadow-black/5">
                    <AlertCircle className="w-4 h-4 text-red-700" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full !bg-gradient-to-r !from-neutral-900 !to-red-800 !text-white hover:!from-black hover:!to-red-900 shadow-lg shadow-black/10"
                  disabled={loading || !canSubmit}
                >
                  {loading ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>
            )}

            <div className="flex items-center justify-between text-sm">
              <Link to="/login" className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
              {done ? (
                <Link to="/login" className="text-red-600 hover:text-red-700 font-medium">
                  Go to login
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

