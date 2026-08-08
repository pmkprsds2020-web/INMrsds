'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Hospital,
  ArrowRight,
  User,
  Building2,
  Heart,
  Shield,
  Activity,
  Stethoscope,
  TrendingUp,
  Users,
  CheckCircle2,
  UserPlus,
  Sparkles,
  BarChart3,
  ClipboardCheck,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { UNIT_MAP } from '@/types';

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

const features = [
  { icon: Shield, title: 'Keamanan Data', desc: 'Enkripsi end-to-end untuk data pasien', color: '#14b8a6' },
  { icon: Monitor, title: 'Real-time Monitoring', desc: 'Pantau indikator mutu secara langsung', color: '#2dd4bf' },
  { icon: BarChart3, title: 'Analisis Trend', desc: 'Visualisasi data dan laporan otomatis', color: '#6ee7b7' },
];

/* ── Stagger animation variants ────────────────────────────────── */
const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.3 + i * 0.07, ease: 'easeOut' },
  }),
};

function getPasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pass.length >= 6) score++;
  if (pass.length >= 9) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;

  if (score <= 1) return { score, label: 'Lemah', color: '#f87171' };
  if (score === 2) return { score, label: 'Sedang', color: '#fbbf24' };
  if (score === 3) return { score, label: 'Baik', color: '#14b8a6' };
  return { score, label: 'Kuat', color: '#34d399' };
}

export default function SignupPage({ onNavigate }: AuthPageProps) {
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unitId, setUnitId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [displayNameError, setDisplayNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [unitError, setUnitError] = useState('');

  // Filter out the 'all' unit for signup
  const unitEntries = useMemo(
    () => Object.entries(UNIT_MAP).filter(([key]) => key !== 'all'),
    []
  );

  const selectedUnit = useMemo(
    () => (unitId ? UNIT_MAP[unitId] : null),
    [unitId]
  );

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const validateDisplayName = (val: string) => {
    if (!val.trim()) { setDisplayNameError('Nama lengkap wajib diisi'); return false; }
    setDisplayNameError('');
    return true;
  };

  const validateEmail = (val: string) => {
    if (!val.trim()) { setEmailError('Email wajib diisi'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setEmailError('Format email tidak valid'); return false; }
    setEmailError('');
    return true;
  };

  const validatePassword = (val: string) => {
    if (val.length < 6) { setPasswordError('Password minimal 6 karakter'); return false; }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (val: string) => {
    if (val !== password) { setConfirmPasswordError('Password dan konfirmasi tidak cocok'); return false; }
    setConfirmPasswordError('');
    return true;
  };

  const validateUnit = (val: string) => {
    if (!val) { setUnitError('Pilih unit kerja Anda'); return false; }
    setUnitError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValid = validateDisplayName(displayName);
    const emailValid = validateEmail(email);
    const passValid = validatePassword(password);
    const confirmValid = validateConfirmPassword(confirmPassword);
    const unitValid = validateUnit(unitId);

    if (!nameValid || !emailValid || !passValid || !confirmValid || !unitValid) return;

    if (!acceptTerms) {
      toast.error('Anda harus menyetujui syarat dan ketentuan');
      return;
    }

    setIsLoading(true);
    try {
      await signup(email, password, displayName.trim(), unitId);
      toast.success('Pendaftaran berhasil! Selamat datang.');
    } catch (err: unknown) {
      const error = err as { code?: string };
      const message =
        error.code === 'auth/email-already-in-use'
          ? 'Email sudah terdaftar'
          : error.code === 'auth/weak-password'
            ? 'Password terlalu lemah (minimal 6 karakter)'
            : error.code === 'auth/invalid-email'
              ? 'Format email tidak valid'
              : 'Gagal mendaftar. Silakan coba lagi.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ===== Left Decorative Panel (Desktop Only) ===== */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-950">
        {/* Animated mesh gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="mesh-orb-1 absolute -left-20 -top-20 h-96 w-96 rounded-full bg-emerald-400/8 blur-[100px]" />
          <div className="mesh-orb-2 absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-teal-400/10 blur-[120px]" />
          <div className="mesh-orb-3 absolute left-1/3 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-300/5 blur-[80px]" />
          <div className="mesh-orb-4 absolute right-1/4 top-1/4 h-56 w-56 rounded-full bg-emerald-300/6 blur-[90px]" />
          {/* Dot pattern */}
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
              <Icon className="h-8 w-8 text-emerald-300" />
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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/20 backdrop-blur-sm border border-emerald-400/20">
              <Hospital className="h-6 w-6 text-emerald-300" />
            </div>
            <span className="rounded-lg bg-emerald-500 px-2.5 py-1 text-base font-bold tracking-wider text-white shadow-lg shadow-emerald-500/20">
              MUTU
            </span>
            <span className="text-lg font-semibold text-emerald-100/80">RS</span>
          </motion.div>
        </div>

        {/* Center content - features */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-center max-w-md mb-10"
          >
            <h1 className="text-4xl font-bold text-emerald-50 leading-tight">
              Bergabung dengan
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                Tim Mutu RS
              </span>
            </h1>
            <p className="mt-4 text-emerald-100/60 text-base leading-relaxed">
              Daftar untuk mengakses dashboard indikator mutu dan berkontribusi
              pada peningkatan kualitas pelayanan rumah sakit.
            </p>
          </motion.div>

          <div className="space-y-3 w-full max-w-sm">
            {features.map(({ icon: FeatureIcon, title, desc, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.12 }}
                className="flex items-center gap-3 rounded-xl border border-emerald-400/10 bg-emerald-400/5 backdrop-blur-sm px-4 py-3"
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
        </div>

        {/* Bottom */}
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

      {/* ===== Right Side - Signup Form ===== */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
        {/* Mobile background - animated orbs */}
        <div className="pointer-events-none fixed inset-0 lg:hidden">
          <div className="mesh-orb-1 absolute -right-32 -top-32 h-64 w-64 rounded-full bg-emerald-400/5 blur-3xl" />
          <div className="mesh-orb-2 absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-teal-400/5 blur-3xl" />
          <div className="mesh-orb-3 absolute left-1/4 bottom-1/3 h-48 w-48 rounded-full bg-emerald-400/3 blur-[60px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[480px]"
        >
          {/* Mobile Logo */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 flex flex-col items-center gap-2 lg:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/25">
                <Hospital className="h-7 w-7 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-emerald-500 px-2.5 py-1 text-lg font-bold tracking-wider text-white shadow-md shadow-emerald-500/25">
                  MUTU
                </span>
                <span className="text-lg font-semibold text-foreground">RS</span>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">Dashboard Mutu Rumah Sakit</p>
          </motion.div>

          {/* Desktop header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-5 hidden lg:block"
          >
            <h2 className="text-2xl font-bold text-foreground">Buat Akun Baru</h2>
            <p className="mt-1 text-sm text-muted-foreground">Daftar untuk mengakses dashboard mutu</p>
          </motion.div>

          {/* Signup Card */}
          <Card className="auth-card-glow border-border/60 bg-card/80 backdrop-blur-xl rounded-2xl overflow-hidden">
            {/* Gradient top border - emerald/teal */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
            {/* Animated icon at top */}
            <div className="flex justify-center -mt-5 mb-2">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
                className="auth-icon-pulse flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/25"
              >
                <UserPlus className="size-5 text-white" />
              </motion.div>
            </div>

            <CardHeader className="pb-1 text-center lg:text-left">
              <CardTitle className="text-xl font-semibold text-foreground lg:hidden">
                Buat Akun Baru
              </CardTitle>
              <CardDescription className="text-muted-foreground lg:hidden">
                Daftar untuk mengakses dashboard mutu
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* ── Section: Informasi Pribadi ── */}
                <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="size-3.5 text-teal-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Informasi Pribadi</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="displayName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Nama Lengkap
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          id="displayName"
                          type="text"
                          placeholder="Dr. Nama Lengkap"
                          value={displayName}
                          onChange={(e) => {
                            setDisplayName(e.target.value);
                            if (displayNameError) validateDisplayName(e.target.value);
                          }}
                          onBlur={() => validateDisplayName(displayName)}
                          className={`h-11 border-border bg-muted/30 pl-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 ${
                            displayNameError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                          }`}
                          autoComplete="name"
                          disabled={isLoading}
                        />
                      </div>
                      <AnimatePresence>
                        {displayNameError && (
                          <motion.p initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -4, height: 0 }} className="text-xs text-red-400">
                            {displayNameError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="nama@rumahsakit.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailError) validateEmail(e.target.value);
                          }}
                          onBlur={() => validateEmail(email)}
                          className={`h-11 border-border bg-muted/30 pl-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 ${
                            emailError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                          }`}
                          autoComplete="email"
                          disabled={isLoading}
                        />
                      </div>
                      <AnimatePresence>
                        {emailError && (
                          <motion.p initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -4, height: 0 }} className="text-xs text-red-400">
                            {emailError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>

                <Separator className="bg-border/30" />

                {/* ── Section: Unit Kerja ── */}
                <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="size-3.5 text-teal-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Kerja</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pilih Unit
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 z-10" />
                      <Select value={unitId} onValueChange={(v) => { setUnitId(v); if (unitError) validateUnit(v); }} disabled={isLoading}>
                        <SelectTrigger
                          className={`h-11 w-full border-border bg-muted/30 pl-10 text-foreground focus:ring-2 focus:ring-teal-500/20 [&>span]:text-foreground data-[placeholder]:text-muted-foreground/40 transition-colors ${
                            unitError ? 'border-red-500/50 focus:ring-red-500/20' : ''
                          }`}
                        >
                          <SelectValue placeholder="Pilih unit kerja" />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-card">
                          {unitEntries.map(([key, unit]) => (
                            <SelectItem
                              key={key}
                              value={key}
                              className="text-foreground/80 focus:bg-teal-500/10 focus:text-foreground"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: unit.color }}
                                />
                                {unit.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Selected unit chip */}
                    <AnimatePresence>
                      {selectedUnit && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, height: 0 }}
                          animate={{ opacity: 1, scale: 1, height: 'auto' }}
                          exit={{ opacity: 0, scale: 0.9, height: 0 }}
                          className="flex items-center gap-2 pt-1"
                        >
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground border"
                            style={{
                              backgroundColor: `${selectedUnit.color}15`,
                              borderColor: `${selectedUnit.color}30`,
                            }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: selectedUnit.color }}
                            />
                            {selectedUnit.label}
                            <CheckCircle2 className="h-3 w-3 ml-0.5" style={{ color: selectedUnit.color }} />
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {unitError && (
                        <motion.p initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -4, height: 0 }} className="text-xs text-red-400">
                          {unitError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                <Separator className="bg-border/30" />

                {/* ── Section: Keamanan ── */}
                <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="size-3.5 text-teal-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Keamanan</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  <div className="space-y-3">
                    {/* Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          id="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Minimal 6 karakter"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (passwordError) validatePassword(e.target.value);
                          }}
                          onBlur={() => validatePassword(password)}
                          className={`h-11 border-border bg-muted/30 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 ${
                            passwordError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                          }`}
                          autoComplete="new-password"
                          disabled={isLoading}
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
                      {/* Password Strength Indicator */}
                      <AnimatePresence>
                        {password.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-1.5 pt-1"
                          >
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4].map((level) => (
                                <div
                                  key={level}
                                  className="h-1.5 flex-1 rounded-full transition-colors duration-300 bg-muted"
                                  style={{
                                    backgroundColor:
                                      passwordStrength.score >= level
                                        ? passwordStrength.color
                                        : undefined,
                                  }}
                                />
                              ))}
                            </div>
                            <p className="text-xs" style={{ color: passwordStrength.color }}>
                              Kekuatan: {passwordStrength.label}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <AnimatePresence>
                        {passwordError && (
                          <motion.p initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -4, height: 0 }} className="text-xs text-red-400">
                            {passwordError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Konfirmasi Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Ulangi password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (confirmPasswordError) validateConfirmPassword(e.target.value);
                          }}
                          onBlur={() => validateConfirmPassword(confirmPassword)}
                          className={`h-11 border-border bg-muted/30 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 ${
                            confirmPasswordError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                          }`}
                          autoComplete="new-password"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <AnimatePresence>
                        {confirmPasswordError && (
                          <motion.p initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -4, height: 0 }} className="text-xs text-red-400">
                            {confirmPasswordError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>

                <Separator className="bg-border/30" />

                {/* ── Terms & Submit ── */}
                <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-4">
                  {/* Terms Acceptance */}
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                      className="mt-0.5 border-border data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500"
                      disabled={isLoading}
                    />
                    <label
                      htmlFor="terms"
                      className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none"
                    >
                      Saya menyetujui{' '}
                      <span className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors">
                        syarat dan ketentuan
                      </span>{' '}
                      serta{' '}
                      <span className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors">
                        kebijakan privasi
                      </span>{' '}
                      Dashboard Mutu RS
                    </label>
                  </div>

                  {/* Signup Button */}
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="h-12 w-full text-white shadow-lg shadow-teal-500/20 transition-all duration-200 border-0 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400"
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
                          Daftar
                          <ArrowRight className="ml-1.5 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              </form>

              {/* Sign In Link */}
              <p className="mt-5 text-center text-sm text-muted-foreground/60">
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate?.('login')}
                  className="font-medium text-teal-600 dark:text-teal-400 transition-colors hover:text-teal-700 dark:hover:text-teal-300"
                >
                  Masuk di sini
                </button>
              </p>
            </CardContent>
          </Card>

          {/* Footer (mobile) */}
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
