'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Eye,
  EyeOff,
  Hospital,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  Mail,
  KeyRound,
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
import { useAuth } from '@/contexts/AuthContext';

export interface AuthPageProps {
  onNavigate?: (page: 'login' | 'signup' | 'forgot' | 'reset') => void;
}

type VerifyState = 'loading' | 'valid' | 'invalid' | 'success';

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

export default function ResetPasswordPage({ onNavigate }: AuthPageProps) {
  const { verifyResetCode, confirmReset } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>('loading');
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string>('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const verify = useCallback(async () => {
    // Supabase authenticates the browser directly from the emailed recovery
    // link (no separate oobCode to extract from the URL). The SDK parses
    // that link asynchronously right after mount, so retry briefly before
    // giving up.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const email = await verifyResetCode();
        setVerifiedEmail(email);
        setOobCode('supabase-recovery-session');
        setVerifyState('valid');
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    setVerifyState('invalid');
    toast.error('Link reset password tidak valid atau sudah kadaluarsa');
  }, [verifyResetCode]);

  useEffect(() => {
    verify();
  }, [verify]);

  const validatePassword = (val: string) => {
    if (val.length < 6) {
      setPasswordError('Password minimal 6 karakter');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (val: string) => {
    if (val !== newPassword) {
      setConfirmPasswordError('Password dan konfirmasi tidak cocok');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oobCode) {
      toast.error('Kode reset tidak valid');
      return;
    }

    const passValid = validatePassword(newPassword);
    const confirmValid = validateConfirmPassword(confirmPassword);
    if (!passValid || !confirmValid) return;

    setIsLoading(true);
    try {
      await confirmReset(oobCode, newPassword);
      setVerifyState('success');
      toast.success('Password berhasil diubah!');
    } catch (err: unknown) {
      const error = err as { code?: string };
      const message =
        error.code === 'auth/expired-action-code'
          ? 'Link reset sudah kadaluarsa. Silakan minta link baru.'
          : error.code === 'auth/invalid-action-code'
            ? 'Link reset tidak valid. Silakan minta link baru.'
            : error.code === 'auth/user-disabled'
              ? 'Akun ini telah dinonaktifkan'
              : error.code === 'auth/weak-password'
                ? 'Password terlalu lemah (minimal 6 karakter)'
                : 'Gagal mengubah password. Silakan coba lagi.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step indicator helper
  const getStep = () => {
    if (verifyState === 'loading') return 1;
    if (verifyState === 'invalid') return 1;
    if (verifyState === 'valid') return 2;
    if (verifyState === 'success') return 3;
    return 1;
  };
  const currentStep = getStep();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="mesh-orb-1 absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-400/5 blur-[100px]" />
        <div className="mesh-orb-2 absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-400/5 blur-[100px]" />
        <div className="mesh-orb-3 absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-400/3 blur-[80px]" />
        <div className="mesh-orb-4 absolute right-1/3 bottom-1/4 h-56 w-56 rounded-full bg-emerald-400/4 blur-[70px]" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, hsl(var(--muted-foreground) / 0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[460px]"
      >
        {/* Logo & Brand */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 flex flex-col items-center gap-3"
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

        {/* Step Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-2 mb-6"
        >
          <div className="flex items-center gap-1.5">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${currentStep > 1 ? 'bg-emerald-500 text-white' : 'bg-teal-500 text-white'}`}>
              {currentStep > 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : '1'}
            </div>
            <span className={`text-[10px] font-medium transition-colors ${currentStep > 1 ? 'text-emerald-500' : 'text-foreground'}`}>
              Verifikasi
            </span>
          </div>
          <div className={`h-px w-6 transition-colors ${currentStep > 1 ? 'bg-emerald-500/50' : 'bg-border'}`} />
          <div className="flex items-center gap-1.5">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${currentStep > 2 ? 'bg-emerald-500 text-white' : currentStep === 2 ? 'bg-teal-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              {currentStep > 2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : '2'}
            </div>
            <span className={`text-[10px] font-medium transition-colors ${currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
              Password Baru
            </span>
          </div>
          <div className={`h-px w-6 transition-colors ${currentStep > 2 ? 'bg-emerald-500/50' : 'bg-border'}`} />
          <div className="flex items-center gap-1.5">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${currentStep === 3 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              3
            </div>
            <span className={`text-[10px] font-medium transition-colors ${currentStep === 3 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              Selesai
            </span>
          </div>
        </motion.div>

        {/* Reset Password Card */}
        <Card className="auth-card-glow border-border/60 bg-card/80 backdrop-blur-xl rounded-2xl overflow-hidden">
          {/* Gradient top border */}
          <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-purple-400 to-teal-500" />
          {/* Animated lock icon at top */}
          <div className="flex justify-center -mt-5 mb-2">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              className="auth-icon-pulse flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-purple-500 shadow-lg shadow-teal-500/25"
            >
              <KeyRound className="size-5 text-white" />
            </motion.div>
          </div>

          <CardHeader className="pb-1 text-center">
            <AnimatePresence mode="wait">
              {verifyState === 'loading' && (
                <motion.div key="loading-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Memverifikasi...
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-muted-foreground">
                    Memverifikasi link reset password Anda
                  </CardDescription>
                </motion.div>
              )}

              {verifyState === 'valid' && (
                <motion.div key="valid-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/15">
                    <ShieldCheck className="h-7 w-7 text-teal-500" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Reset Password
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-muted-foreground">
                    Masukkan password baru untuk akun Anda
                  </CardDescription>
                  {/* Show verified email */}
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-teal-500/15 bg-teal-500/5 px-3 py-1">
                    <Mail className="h-3.5 w-3.5 text-teal-500/60" />
                    <span className="text-xs text-teal-600 dark:text-teal-400 truncate max-w-[260px]">{verifiedEmail}</span>
                  </div>
                </motion.div>
              )}

              {verifyState === 'invalid' && (
                <motion.div key="invalid-header" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Link Tidak Valid
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-muted-foreground">
                    Link reset password ini tidak valid atau sudah kadaluarsa
                  </CardDescription>
                </motion.div>
              )}

              {verifyState === 'success' && (
                <motion.div key="success-header" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Password Diubah!
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-muted-foreground">
                    Password Anda telah berhasil diubah
                  </CardDescription>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
          <CardContent className="pt-2">
            <AnimatePresence mode="wait">
              {/* Loading State */}
              {verifyState === 'loading' && (
                <motion.div key="loading-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-10">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-10 w-10 rounded-full border-2 border-teal-500/20 border-t-teal-500"
                  />
                  <p className="text-sm text-muted-foreground/60">
                    Memverifikasi link reset...
                  </p>
                </motion.div>
              )}

              {/* Invalid State */}
              {verifyState === 'invalid' && (
                <motion.div key="invalid-content" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-5 py-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/15">
                    <motion.div initial={{ scale: 0, rotate: 45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}>
                      <AlertCircle className="h-8 w-8 text-red-400" />
                    </motion.div>
                  </motion.div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground/70">
                      Link Tidak Valid atau Kadaluarsa
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground/70 leading-relaxed max-w-[280px]">
                      Link reset password ini tidak valid atau sudah kadaluarsa.
                      Silakan minta link reset baru untuk melanjutkan.
                    </p>
                  </div>
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="w-full">
                    <Button
                      type="button"
                      onClick={() => onNavigate?.('forgot')}
                      className="h-11 w-full text-white shadow-lg shadow-teal-500/20 transition-all duration-200 border-0 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400"
                    >
                      Minta Link Reset Baru
                    </Button>
                  </motion.div>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('login')}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-teal-600 dark:hover:text-teal-400"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Kembali ke halaman login
                  </button>
                </motion.div>
              )}

              {/* Success State */}
              {verifyState === 'success' && (
                <motion.div key="success-content" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-5 py-4">
                  {/* Animated checkmark */}
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/15">
                    <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.25 }}>
                      <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                    </motion.div>
                  </motion.div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground/70">
                      Password Berhasil Diubah!
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground/70 leading-relaxed">
                      Anda sekarang bisa login dengan password baru Anda.
                    </p>
                  </div>
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="w-full">
                    <Button
                      type="button"
                      onClick={() => onNavigate?.('login')}
                      className="h-11 w-full text-white shadow-lg shadow-teal-500/20 transition-all duration-200 border-0 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400"
                    >
                      Masuk Sekarang
                    </Button>
                  </motion.div>
                </motion.div>
              )}

              {/* Valid State - Show Reset Form */}
              {verifyState === 'valid' && (
                <motion.div key="valid-content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* New Password Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Password Baru
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          id="new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="Minimal 6 karakter"
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (passwordError) validatePassword(e.target.value);
                          }}
                          onBlur={() => validatePassword(newPassword)}
                          className={`h-11 border-border bg-muted/30 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 ${
                            passwordError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                          }`}
                          autoComplete="new-password"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Password Strength Indicator */}
                      <AnimatePresence>
                        {newPassword.length > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 pt-1">
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4].map((level) => (
                                <motion.div key={level} className="h-1.5 flex-1 rounded-full transition-colors duration-300 bg-muted" style={{ backgroundColor: passwordStrength.score >= level ? passwordStrength.color : undefined }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: level * 0.05 }} />
                              ))}
                            </div>
                            <p className="text-xs transition-colors duration-300" style={{ color: passwordStrength.color }}>
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

                    {/* Confirm Password Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-confirm-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Konfirmasi Password Baru
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          id="reset-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Ulangi password baru"
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

                    {/* Submit Button */}
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="h-11 w-full text-white shadow-lg shadow-teal-500/20 transition-all duration-200 border-0 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400"
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white" />
                            <span className="text-sm">Menyimpan...</span>
                          </div>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Ubah Password
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>

                  {/* Back to Login Link */}
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('login')}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-teal-600 dark:hover:text-teal-400"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Kembali ke halaman login
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-center text-xs text-muted-foreground/30"
        >
          &copy; {new Date().getFullYear()} Dashboard Mutu RS &mdash; Semua hak
          dilindungi
        </motion.p>
      </motion.div>
    </div>
  );
}
