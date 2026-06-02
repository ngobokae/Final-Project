import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AlertCircle, ArrowLeft, Mail, RefreshCcw } from 'lucide-react';
import logoSrc from '../../assets/IMG_1472.PNG';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // keep auth pages light
    document.documentElement.classList.remove('dark');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to request reset link');
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Failed to request reset link');
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
            <CardTitle className="text-2xl font-bold !text-neutral-900">Forgot password</CardTitle>
            <CardDescription className="!text-gray-600">
              Enter your email and we’ll send you a password reset link.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {done ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                If that email exists, a reset link has been sent. Check your inbox (and spam).
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
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
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>
            )}

            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

