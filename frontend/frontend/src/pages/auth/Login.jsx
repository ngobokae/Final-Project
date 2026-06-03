import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCcw
} from 'lucide-react';
import logoSrc from '../../assets/IMG_1472.PNG';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // reused UI for TOTP code
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('credentials');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();

  // The login screen is designed for a light surface, so render it in light
  // mode regardless of the visitor's stored theme, then restore their theme
  // when they navigate away.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');

    return () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user.theme === 'dark') {
            root.classList.add('dark');
          }
        } catch {
          // Ignore parse errors
        }
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result?.requires2fa) {
        setTempToken(result.tempToken);
        setStep('otp');
        setOtpSent(true);
        setLoading(false);
        return;
      }
      if (!result.success) {
        setError(result.error || 'Invalid email or password');
        setLoading(false);
        return;
      }
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const role = currentUser.role || 'admin';
      navigate(`/${role}`);
      setLoading(false);
    } catch (error) {
      setError(error.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    
    if (otpValue.length !== 6) {
      setError('Please enter the complete code');
      return;
    }

    setLoading(true);

    try {
      if (!tempToken) {
        setError('2FA session expired. Please sign in again.');
        setOtp(['', '', '', '', '', '']);
        document.getElementById('otp-0')?.focus();
        setLoading(false);
        setStep('credentials');
        return;
      }

      const result = await verify2FA(tempToken, otpValue);
      if (!result.success) {
        setError(result.error || 'Invalid code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        document.getElementById('otp-0')?.focus();
        setLoading(false);
        return;
      }

      setError('');
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const role = currentUser.role || 'admin';
      navigate(`/${role}`);
      setLoading(false);
    } catch (e2) {
      setError(e2?.message || 'Verification failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-neutral-50 to-red-100/60 p-4">
      <div className="w-full max-w-2xl grid grid-cols-1 items-center">
        <Card className="shadow-2xl border-0 !bg-white !text-neutral-900 border border-neutral-300 shadow-black/10">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex justify-center pt-2">
              <img
                src={logoSrc}
                  alt="Kinglion"
                className="h-28 sm:h-32 md:h-36 w-auto max-w-[420px] object-contain"
              />
            </div>

            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold !text-neutral-900">
                {step === 'credentials' ? 'Welcome Back' : 'Verify TOTP'}
              </CardTitle>
              {step === 'otp' && (
                <Badge variant="outline" className="gap-1">
                  <Shield className="w-3 h-3" />
                  Secure
                </Badge>
              )}
            </div>
            <CardDescription className="!text-gray-600">
              {step === 'credentials' 
                ? 'Enter your credentials to access your dashboard'
                : `Enter the 6-digit code from your authenticator app`
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {step === 'credentials' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-neutral-900/[0.03] to-red-100/80 border border-red-300 rounded-lg shadow-sm shadow-black/5">
                    <AlertCircle className="w-4 h-4 text-red-700" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    <span className="text-gray-600">Remember me</span>
                  </label>
                  <Link to="/forget-password" className="text-red-600 hover:text-red-700 font-medium">
                    Forgot password?
                  </Link>
                </div>

                <Button 
                  type="submit" 
                  className="w-full !bg-gradient-to-r !from-neutral-900 !to-red-800 !text-white hover:!from-black hover:!to-red-900 shadow-lg shadow-black/10"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Login
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>Enter 6-digit code</Label>
                  <div className="flex gap-2 justify-center">
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-12 text-center text-lg font-semibold"
                        required
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-neutral-900/[0.03] to-red-100/80 border border-red-300 rounded-lg shadow-sm shadow-black/5">
                    <AlertCircle className="w-4 h-4 text-red-700" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full !bg-gradient-to-r !from-neutral-900 !to-red-800 !text-white hover:!from-black hover:!to-red-900 shadow-lg shadow-black/10"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Login
                        <CheckCircle className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => setStep('credentials')}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      ← Back to login
                    </button>
                  </div>
                </div>
              </form>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
