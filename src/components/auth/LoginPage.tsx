'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Hospital,
  ArrowRight,
  Heart,
  Shield,
  Activity,
  Stethoscope,
  TrendingUp,
  Users,
  LogIn,
  Monitor,
  Sparkles,
  BarChart3,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

export interface AuthPageProps {
  onNavigate?: (page: 'login' | 'signup' | 'forgot' | 'reset') => void;
}

const floatingIcons = [
  { Icon: Heart, delay: 0, x: '15%', y: '20%', duration: 6 },
  { Icon: Shield, delay: 1, x: '70%', y: '15%', duration: 7 },
  { Icon: Activity, delay: 2, x: '25%', y: '65%', duration: 5.5 },
  { Icon: Stethoscope, delay: 0.5, x: '75%', y: '55%', duration: 8 },
  { Icon: TrendingUp, delay: 1.5, x: '50%', y: '80%', duration: 6.5 },
  { Icon: Users, delay: 2.5, x: '85%', y: '35%', duration: 7.5 },
];

const stats = [
  { label: 'Unit Terpantau', value: '9+', icon: Hospital },
  { label: 'Indikator Mutu', value: '11', icon: Activity },
  { label: 'Tim Aktif', value: '24/7', icon: Users },
];

const features = [
  { icon: Monitor, title: 'Real-time Monitoring', desc: 'Pantau indikator mutu secara langsung', color: '#14b8a6' },
  { icon: Sparkles, title: 'AI-Powered Insights', desc: 'Analisis cerdas berbasis AI', color: '#6ee7b7' },
  { icon: ClipboardCheck, title: 'Compliance Tracking', desc: 'Lacak kepatuhan standar mutu', color: '#2dd4bf' },
];

/* ── Stagger animation variants ────────────────────────────────── */
const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.3 + i * 0.08, ease: 'easeOut' },
  }),
};

export default function LoginPage({ onNavigate }: AuthPageProps) {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (val: string) => {
    if (!val.trim()) {
      setEmailError('Email wajib diisi');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setEmailError('Format email tidak valid');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (val: string) => {
    if (!val) {
      setPasswordError('Password wajib diisi');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValid = validateEmail(email);
    const passValid = validatePassword(password);
    if (!emailValid || !passValid) return;

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Login berhasil!');
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      const message =
        error.code === 'auth/user-not-found'
          ? 'Akun tidak ditemukan'
          : error.code === 'auth/wrong-password'
            ? 'Password salah'
            : error.code === 'auth/invalid-credential'
              ? 'Email atau password salah'
              : error.code === 'auth/too-many-requests'
                ? 'Terlalu banyak percobaan. Coba lagi nanti.'
                : error.code === 'auth/invalid-email'
                  ? 'Format email tidak valid'
                  : 'Gagal login. Silakan coba lagi.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
      toast.success('Login dengan Google berhasil!');
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Login dibatalkan');
      } else {
        toast.error('Gagal login dengan Google');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ===== Left Decorative Panel (Desktop Only) ===== */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-900 via-emerald-900 to-teal-950">
        {/* Animated mesh gradient orbs - teal/emerald tones */}
        <div className="pointer-events-none absolute inset-0">
          <div className="mesh-orb-1 absolute -left-20 -top-20 h-96 w-96 rounded-full bg-teal-400/10 blur-[100px]" />
          <div className="mesh-orb-2 absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-400/8 blur-[120px]" />
          <div className="mesh-orb-3 absolute left-1/3 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-300/5 blur-[80px]" />
          <div className="mesh-orb-4 absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-emerald-300/6 blur-[90px]" />
          {/* Medical dot pattern */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        {/* Floating medical icons */}
        <div className="pointer-events-none absolute inset-0">
          {floatingIcons.map(({ Icon, delay, x, y, duration }, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ left: x, top: y }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0, 0.15, 0.15, 0],
                scale: [0.5, 1, 1, 0.5],
                y: [0, -12, 0, 12, 0],
              }}
              transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Icon className="h-8 w-8 text-teal-300" />
            </motion.div>
          ))}
        </div>

        {/* Top branding */}
        <div className="relative z-10 p-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-400/20 backdrop-blur-sm border border-teal-400/20">
              <Hospital className="h-6 w-6 text-teal-300" />
            </div>
            <span className="rounded-lg bg-teal-500 px-2.5 py-1 text-base font-bold tracking-wider text-white shadow-lg shadow-teal-500/20">
              MUTU
            </span>
            <span className="text-lg font-semibold text-emerald-100/80">RS</span>
          </motion.div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-center max-w-md"
          >
            {/* Medical Cross SVG */}
            <div className="mx-auto mb-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
                className="inline-flex items-center justify-center"
              >
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="drop-shadow-lg">
                  <rect x="0" y="0" width="64" height="64" rx="16" fill="rgba(20,184,166,0.15)" />
                  <rect x="24" y="12" width="16" height="40" rx="4" fill="rgba(94,234,212,0.7)" />
                  <rect x="12" y="24" width="40" height="16" rx="4" fill="rgba(94,234,212,0.7)" />
                </svg>
              </motion.div>
            </div>

            <h1 className="text-4xl font-bold text-emerald-50 leading-tight">
              Sistem Monitoring
              <br />
              <span className="bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
                Indikator Mutu
              </span>
              <br />
              Rumah Sakit
            </h1>
            <p className="mt-4 text-emerald-100/60 text-base leading-relaxed">
              Pantau dan kelola indikator mutu rumah sakit secara real-time.
              Tingkatkan kualitas pelayanan dengan data yang akurat.
            </p>
          </motion.div>

          {/* Feature highlights */}
          <div className="mt-10 space-y-3 w-full max-w-sm">
            {features.map(({ icon: FeatureIcon, title, desc, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-3 rounded-xl border border-teal-400/10 bg-teal-400/5 backdrop-blur-sm px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
                  <FeatureIcon className="h-4.5 w-4.5" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-50">{title}</p>
                  <p className="text-xs text-emerald-100/50 mt-0.5">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-10 flex gap-6"
          >
            {stats.map(({ label, value, icon: StatIcon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9 + i * 0.1 }}
                className="flex items-center gap-3 rounded-xl border border-teal-400/10 bg-teal-400/5 backdrop-blur-sm px-5 py-3.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400/10">
                  <StatIcon className="h-4.5 w-4.5 text-teal-300" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-50">{value}</p>
                  <p className="text-xs text-emerald-100/50">{label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Bottom decorative line */}
        <div className="relative z-10 p-10">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xs text-emerald-100/30"
          >
            &copy; {new Date().getFullYear()} Dashboard Mutu RS &mdash; Semua hak dilindungi
          </motion.p>
        </div>
      </div>

      {/* ===== Right Side - Login Form ===== */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
        {/* Mobile background decoration */}
        <div className="pointer-events-none fixed inset-0 lg:hidden">
          <div className="mesh-orb-1 absolute -left-32 -top-32 h-64 w-64 rounded-full bg-teal-400/5 blur-3xl" />
          <div className="mesh-orb-2 absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-emerald-400/5 blur-3xl" />
          <div className="mesh-orb-3 absolute right-1/4 top-1/3 h-48 w-48 rounded-full bg-teal-400/3 blur-[60px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[460px]"
        >
          {/* Mobile Logo */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 flex flex-col items-center gap-3 lg:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500 shadow-lg shadow-teal-500/25">
                <Hospital className="h-7 w-7 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-teal-500 px-2.5 py-1 text-lg font-bold tracking-wider text-white shadow-md shadow-teal-500/25">
                  MUTU
                </span>
                <span className="text-lg font-semibold text-foreground">RS</span>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Sistem Monitoring Indikator Mutu Rumah Sakit
            </p>
          </motion.div>

          {/* Desktop header text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-6 hidden lg:block"
          >
            <h2 className="text-2xl font-bold text-foreground">Selamat Datang</h2>
            <p className="mt-1 text-sm text-muted-foreground">Masuk ke akun Anda untuk melanjutkan</p>
          </motion.div>

          {/* Login Card */}
          <Card className="auth-card-glow border-border/60 bg-card/80 backdrop-blur-xl rounded-2xl overflow-hidden">
            {/* Gradient top border - teal/emerald */}
            <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500" />
            {/* Animated icon at top */}
            <div className="flex justify-center -mt-5 mb-2">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
                className="auth-icon-pulse flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-400 shadow-lg shadow-teal-500/25"
              >
                <LogIn className="size-5 text-white" />
              </motion.div>
            </div>

            <CardHeader className="pb-1 text-center lg:text-left">
              <CardTitle className="text-xl font-semibold text-foreground lg:hidden">
                Selamat Datang
              </CardTitle>
              <CardDescription className="text-muted-foreground lg:hidden">
                Masuk ke akun Anda untuk melanjutkan
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field - staggered */}
                <motion.div
                  custom={0}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nama@rumahsakit.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) validateEmail(e.target.value);
                      }}
                      onBlur={() => validateEmail(email)}
                      className={`h-12 border-border bg-muted/30 pl-11 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 text-sm ${
                        emailError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                      }`}
                      autoComplete="email"
                      disabled={isLoading || isGoogleLoading}
                    />
                  </div>
                  <AnimatePresence>
                    {emailError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        className="text-xs text-red-400"
                      >
                        {emailError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Password Field - staggered */}
                <motion.div
                  custom={1}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('forgot')}
                      className="text-xs font-medium text-teal-600 dark:text-teal-400 transition-colors hover:text-teal-700 dark:hover:text-teal-300 underline underline-offset-2 decoration-teal-400/30 hover:decoration-teal-500/50"
                    >
                      Lupa password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Masukkan password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) validatePassword(e.target.value);
                      }}
                      onBlur={() => validatePassword(password)}
                      className={`h-12 border-border bg-muted/30 pl-11 pr-11 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 text-sm ${
                        passwordError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                      }`}
                      autoComplete="current-password"
                      disabled={isLoading || isGoogleLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <AnimatePresence>
                    {passwordError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        className="text-xs text-red-400"
                      >
                        {passwordError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Login Button - staggered */}
                <motion.div
                  custom={2}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Button
                    type="submit"
                    disabled={isLoading || isGoogleLoading}
                    className="h-12 w-full text-white shadow-lg shadow-teal-500/20 transition-all duration-200 border-0 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white"
                        />
                        <span className="text-sm">Memproses...</span>
                      </div>
                    ) : (
                      <>
                        Masuk
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <Separator className="bg-border/50" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card/80 backdrop-blur px-3 text-xs text-muted-foreground/50">
                  atau
                </span>
              </div>

              {/* Google Login - staggered */}
              <motion.div
                custom={3}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading || isGoogleLoading}
                  onClick={handleGoogleLogin}
                  className="h-12 w-full border-border bg-muted/30 text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-all duration-200"
                >
                  {isGoogleLoading ? (
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
                      />
                      <span className="text-sm">Menghubungkan...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Masuk dengan Google
                    </>
                  )}
                </Button>
              </motion.div>

              {/* Sign Up Link - more prominent */}
              <motion.div
                custom={4}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                className="mt-6 rounded-lg border border-teal-500/10 bg-teal-500/5 p-3 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate?.('signup')}
                    className="font-semibold text-teal-600 dark:text-teal-400 transition-colors hover:text-teal-700 dark:hover:text-teal-300"
                  >
                    Daftar sekarang →
                  </button>
                </p>
              </motion.div>
            </CardContent>
          </Card>

          {/* Footer (visible on mobile) */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-muted-foreground/30 lg:hidden"
          >
            &copy; {new Date().getFullYear()} Dashboard Mutu RS &mdash; Semua hak dilindungi
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
