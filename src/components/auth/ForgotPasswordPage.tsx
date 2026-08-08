'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Hospital, ArrowLeft, CheckCircle2, MailCheck, Sparkles, KeyRound } from 'lucide-react';
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

export default function ForgotPasswordPage({ onNavigate }: AuthPageProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [emailError, setEmailError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) return;

    setIsLoading(true);
    try {
      await resetPassword(email);
      setIsSent(true);
      toast.success('Link reset password telah dikirim ke email Anda');
    } catch (err: unknown) {
      const error = err as { code?: string };
      const message =
        error.code === 'auth/user-not-found'
          ? 'Akun dengan email ini tidak ditemukan'
          : error.code === 'auth/invalid-email'
            ? 'Format email tidak valid'
            : error.code === 'auth/too-many-requests'
              ? 'Terlalu banyak permintaan. Coba lagi nanti.'
              : 'Gagal mengirim link reset. Silakan coba lagi.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="mesh-orb-1 absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-400/5 blur-[100px]" />
        <div className="mesh-orb-2 absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-400/5 blur-[100px]" />
        <div className="mesh-orb-3 absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-teal-400/3 blur-[80px]" />
        <div className="mesh-orb-4 absolute right-1/4 bottom-1/4 h-56 w-56 rounded-full bg-emerald-400/4 blur-[70px]" />
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
          className="flex items-center justify-center gap-3 mb-6"
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${isSent ? 'bg-emerald-500 text-white' : 'bg-teal-500 text-white'}`}>
              {isSent ? <CheckCircle2 className="h-4 w-4" /> : '1'}
            </div>
            <span className={`text-xs font-medium transition-colors ${isSent ? 'text-emerald-500' : 'text-foreground'}`}>
              Masukkan Email
            </span>
          </div>
          <div className={`h-px w-8 transition-colors ${isSent ? 'bg-emerald-500/50' : 'bg-border'}`} />
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${isSent ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
              2
            </div>
            <span className={`text-xs font-medium transition-colors ${isSent ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              Reset Password
            </span>
          </div>
        </motion.div>

        {/* Forgot Password Card */}
        <Card className="auth-card-glow border-border/60 bg-card/80 backdrop-blur-xl rounded-2xl overflow-hidden">
          {/* Gradient top border */}
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-teal-500 to-amber-500" />
          {/* Animated lock icon at top */}
          <div className="flex justify-center -mt-5 mb-2">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              className="auth-icon-pulse flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-teal-500 shadow-lg shadow-amber-500/25"
            >
              <KeyRound className="size-5 text-white" />
            </motion.div>
          </div>

          <CardHeader className="pb-1 text-center">
            <AnimatePresence mode="wait">
              {!isSent ? (
                <motion.div
                  key="form-header"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/15">
                    <Mail className="h-7 w-7 text-teal-500" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Lupa Password
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-muted-foreground">
                    Masukkan email untuk menerima link reset password
                  </CardDescription>
                </motion.div>
              ) : (
                <motion.div
                  key="success-header"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Animated success icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/15"
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.25 }}
                    >
                      <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                    </motion.div>
                  </motion.div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Reset Link Terkirim!
                  </CardTitle>
                  <CardDescription className="mt-1.5 text-muted-foreground">
                    Cek inbox email Anda untuk link reset password
                  </CardDescription>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
          <CardContent className="pt-2">
            <AnimatePresence mode="wait">
              {isSent ? (
                <motion.div
                  key="success-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="flex flex-col items-center gap-4 py-2"
                >
                  {/* Email sent illustration */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                        <MailCheck className="h-5 w-5 text-teal-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Email terkirim ke</p>
                        <p className="truncate text-sm font-medium text-teal-600 dark:text-teal-400">{email}</p>
                      </div>
                    </div>
                  </motion.div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground/60 leading-relaxed">
                      Tidak menerima email? Periksa folder spam atau{' '}
                      <button
                        type="button"
                        onClick={() => setIsSent(false)}
                        className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                      >
                        coba kirim ulang
                      </button>
                    </p>
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="w-full">
                    <Button
                      type="button"
                      onClick={() => onNavigate?.('login')}
                      className="h-11 w-full text-white shadow-lg shadow-teal-500/20 transition-all duration-200 border-0 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Kembali ke Login
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="form-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Field */}
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="nama@rumahsakit.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailError) validateEmail(e.target.value);
                          }}
                          onBlur={() => validateEmail(email)}
                          className={`h-12 border-border bg-muted/30 pl-11 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-teal-500/50 focus-visible:ring-2 focus-visible:ring-teal-500/20 transition-all duration-200 ${
                            emailError ? 'border-red-500/50 focus-visible:border-red-500/50 focus-visible:ring-red-500/20' : ''
                          }`}
                          autoComplete="email"
                          disabled={isLoading}
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
                    </div>

                    {/* Send Reset Link Button */}
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="h-12 w-full text-white shadow-lg shadow-teal-500/20 transition-all duration-200 border-0 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400"
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white"
                            />
                            <span className="text-sm">Mengirim...</span>
                          </div>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Kirim Link Reset Password
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
          &copy; {new Date().getFullYear()} Dashboard Mutu RS &mdash; Semua hak dilindungi
        </motion.p>
      </motion.div>
    </div>
  );
}
