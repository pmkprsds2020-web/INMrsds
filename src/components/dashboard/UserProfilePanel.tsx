'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Shield,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UNIT_MAP } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ── Props ────────────────────────────────────────────────────── */
export interface UserProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

/* ── Password strength utility ────────────────────────────────── */
function getPasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pass.length >= 6) score++;
  if (pass.length >= 9) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score++;

  if (score <= 1) return { score, label: 'Lemah', color: '#f87171' };
  if (score === 2) return { score, label: 'Sedang', color: '#fbbf24' };
  if (score === 3) return { score, label: 'Baik', color: '#4f8ef7' };
  return { score, label: 'Kuat', color: '#6ee7b7' };
}

/* ── Supabase error messages in Indonesian ─────────────────────── */
function getFirebaseErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Password saat ini salah.';
  }
  if (lower.includes('password') && lower.includes('at least')) {
    return 'Password baru terlalu lemah (minimal 6 karakter).';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
  }
  if (lower.includes('user not found')) {
    return 'Pengguna tidak ditemukan.';
  }
  if (lower.includes('network')) {
    return 'Koneksi jaringan gagal. Periksa koneksi internet Anda.';
  }
  return message || 'Terjadi kesalahan. Silakan coba lagi.';
}

/* ── Unit entries (filter out 'all') ──────────────────────────── */
const unitEntries = Object.entries(UNIT_MAP).filter(([key]) => key !== 'all');

/* ── Component ────────────────────────────────────────────────── */
export function UserProfilePanel({ open, onClose }: UserProfilePanelProps) {
  const { user, unitId, setUnitId } = useAuth();

  /* ── Profile state ──────────────────────────────────────────── */
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [selectedUnitId, setSelectedUnitId] = useState(unitId || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  /* ── Password state ─────────────────────────────────────────── */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /* ── Delete account state ───────────────────────────────────── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  /* ── Derived values ─────────────────────────────────────────── */
  const passwordStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const emailVerified = user?.emailVerified ?? false;

  const creationDate = useMemo(() => {
    if (!user?.metadata?.creationTime) return '—';
    try {
      return new Date(user.metadata.creationTime).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }, [user?.metadata?.creationTime]);

  const lastSignInDate = useMemo(() => {
    if (!user?.metadata?.lastSignInTime) return '—';
    try {
      return new Date(user.metadata.lastSignInTime).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }, [user?.metadata?.lastSignInTime]);

  /* ── User initials for avatar ───────────────────────────────── */
  const initials = useMemo(() => {
    const name = displayName || user?.displayName || user?.email || 'U';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [displayName, user?.displayName, user?.email]);

  /* ── Profile update handler ─────────────────────────────────── */
  const handleProfileUpdate = useCallback(async () => {
    if (!user) return;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast.error('Nama tampilan tidak boleh kosong');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      // Update Supabase Auth user metadata
      if (trimmedName !== user.displayName) {
        const { error } = await supabase.auth.updateUser({ data: { display_name: trimmedName } });
        if (error) throw error;
      }

      // Update the profiles table row
      const updateData: Record<string, string> = { display_name: trimmedName };
      if (selectedUnitId && selectedUnitId !== unitId) {
        updateData.unit_id = selectedUnitId;
      }
      const { error: profileErr } = await supabase.from('profiles').update(updateData).eq('id', user.uid);
      if (profileErr) throw profileErr;

      // Update local unit state if changed
      if (selectedUnitId && selectedUnitId !== unitId) {
        setUnitId(selectedUnitId);
      }

      setProfileSaved(true);
      toast.success('Profil berhasil diperbarui');
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(getFirebaseErrorMessage(error.message || ''));
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [user, displayName, selectedUnitId, unitId, setUnitId]);

  /* ── Password change handler ────────────────────────────────── */
  const handlePasswordChange = useCallback(async () => {
    if (!user || !user.email) return;

    if (!currentPassword) {
      toast.error('Password saat ini wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Password baru dan konfirmasi tidak cocok');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('Password baru harus berbeda dari password saat ini');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Supabase has no separate "reauthenticate" call — verify the current
      // password by signing in with it, which also refreshes the session.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthErr) throw reauthErr;

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast.success('Password berhasil diubah');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(getFirebaseErrorMessage(error.message || ''));
    } finally {
      setIsChangingPassword(false);
    }
  }, [user, currentPassword, newPassword, confirmPassword]);

  /* ── Delete account handler ─────────────────────────────────── */
  const handleDeleteAccount = useCallback(async () => {
    if (!user || !user.email) return;

    if (deleteConfirmEmail !== user.email) {
      toast.error('Email konfirmasi tidak cocok');
      return;
    }
    if (!deletePassword) {
      toast.error('Password wajib diisi untuk menghapus akun');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Gagal menghapus akun.');
      }

      // Sign out locally now that the account no longer exists.
      await supabase.auth.signOut();

      toast.success('Akun berhasil dihapus');
      setDeleteDialogOpen(false);
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(getFirebaseErrorMessage(error.message || ''));
    } finally {
      setIsDeletingAccount(false);
    }
  }, [user, deleteConfirmEmail, deletePassword, onClose]);

  /* ── Sync state from user/auth when panel opens ────────── */
  useEffect(() => {
    if (open) {
      setDisplayName(user?.displayName || '');
      setSelectedUnitId(unitId || '');
    }
  }, [open, user?.displayName, unitId]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[440px] flex flex-col border-l border-border"
            
          >
            {/* ── Header ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#4f8ef7]/10">
                  <User className="size-4 text-[#4f8ef7]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Profil Pengguna</h2>
                  <p className="text-[10px] text-muted-foreground">Kelola informasi akun Anda</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* ── Scrollable Content ───────────────────────────── */}
            <ScrollArea className="flex-1">
              <div className="px-5 py-5 space-y-6">
                {/* ── Avatar & Name Header ──────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="flex items-center gap-4"
                >
                  <Avatar className="size-14 border-2 border-[#4f8ef7]/30">
                    <AvatarFallback className="bg-[#4f8ef7]/20 text-[#4f8ef7] text-lg font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user?.displayName || 'Pengguna'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                    {unitId && UNIT_MAP[unitId] && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: UNIT_MAP[unitId].color }}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {UNIT_MAP[unitId].label}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>

                <Separator className="bg-muted/50" />

                {/* ── Profile Section ────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="size-3.5 text-[#4f8ef7]" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Informasi Profil
                    </h3>
                  </div>

                  {/* Display Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Nama Tampilan
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                      <Input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Masukkan nama tampilan"
                        className="h-10 border-border bg-muted/30 pl-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-[#4f8ef7]/50 focus-visible:ring-[#4f8ef7]/20 transition-colors"
                        disabled={isUpdatingProfile}
                      />
                    </div>
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                      <Input
                        type="email"
                        value={user?.email || ''}
                        readOnly
                        className="h-10 border-border bg-muted/20 pl-10 text-muted-foreground cursor-not-allowed focus-visible:ring-0 focus-visible:border-border"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailVerified ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-[9px] font-semibold px-1.5 gap-1">
                            <CheckCircle2 className="size-3" />
                            Terverifikasi
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-400 border-0 text-[9px] font-semibold px-1.5">
                            Belum Verifikasi
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unit Assignment */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Unit Kerja
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 z-10" />
                      <Select
                        value={selectedUnitId}
                        onValueChange={setSelectedUnitId}
                        disabled={isUpdatingProfile}
                      >
                        <SelectTrigger className="h-10 w-full border-border bg-muted/30 pl-10 text-foreground focus:ring-[#4f8ef7]/20 [&>span]:text-foreground data-[placeholder]:text-muted-foreground/40 transition-colors">
                          <SelectValue placeholder="Pilih unit kerja" />
                        </SelectTrigger>
                        <SelectContent
                          style={{
                            backgroundColor: 'hsl(var(--popover))',
                            borderColor: 'rgba(255,255,255,0.1)',
                          }}
                        >
                          {unitEntries.map(([key, unit]) => (
                            <SelectItem
                              key={key}
                              value={key}
                              className="text-foreground/80 text-xs focus:bg-[#4f8ef7]/10 focus:text-foreground"
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
                    {selectedUnitId && UNIT_MAP[selectedUnitId] && (
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground border"
                          style={{
                            backgroundColor: `${UNIT_MAP[selectedUnitId].color}15`,
                            borderColor: `${UNIT_MAP[selectedUnitId].color}30`,
                          }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: UNIT_MAP[selectedUnitId].color }}
                          />
                          {UNIT_MAP[selectedUnitId].label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Account dates */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="rounded-lg bg-muted/20 border border-border px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">
                        Akun Dibuat
                      </p>
                      <p className="text-xs text-foreground/70 font-medium">{creationDate}</p>
                    </div>
                    <div className="rounded-lg bg-muted/20 border border-border px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">
                        Login Terakhir
                      </p>
                      <p className="text-xs text-foreground/70 font-medium">{lastSignInDate}</p>
                    </div>
                  </div>

                  {/* Save profile button */}
                  <Button
                    onClick={handleProfileUpdate}
                    disabled={isUpdatingProfile}
                    className="w-full h-9 bg-[#4f8ef7] text-white shadow-lg shadow-[#4f8ef7]/20 hover:bg-[#4f8ef7]/90 transition-all duration-200 text-xs gap-1.5"
                  >
                    {isUpdatingProfile ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                      />
                    ) : profileSaved ? (
                      <>
                        <CheckCircle2 className="size-3.5" />
                        Tersimpan
                      </>
                    ) : (
                      <>
                        <Shield className="size-3.5" />
                        Simpan Perubahan
                      </>
                    )}
                  </Button>
                </motion.div>

                <Separator className="bg-muted/50" />

                {/* ── Change Password Section ────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="size-3.5 text-[#4f8ef7]" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Ubah Password
                    </h3>
                  </div>

                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Password Saat Ini
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                      <Input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Masukkan password saat ini"
                        className="h-10 border-border bg-muted/30 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-[#4f8ef7]/50 focus-visible:ring-[#4f8ef7]/20 transition-colors"
                        disabled={isChangingPassword}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Password Baru
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="h-10 border-border bg-muted/30 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-[#4f8ef7]/50 focus-visible:ring-[#4f8ef7]/20 transition-colors"
                        disabled={isChangingPassword}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Password Strength Indicator */}
                    <AnimatePresence>
                      {newPassword.length > 0 && (
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
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Konfirmasi Password Baru
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru"
                        className={`h-10 border-border bg-muted/30 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-[#4f8ef7]/50 focus-visible:ring-[#4f8ef7]/20 transition-colors ${
                          confirmPassword && confirmPassword !== newPassword
                            ? 'border-red-500/50 focus-visible:border-red-500/50'
                            : ''
                        }`}
                        disabled={isChangingPassword}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {confirmPassword && confirmPassword !== newPassword && (
                        <motion.p
                          initial={{ opacity: 0, y: -4, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -4, height: 0 }}
                          className="text-xs text-red-400"
                        >
                          Password tidak cocok
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Change password button */}
                  <Button
                    onClick={handlePasswordChange}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full h-9 bg-[#4f8ef7] text-white shadow-lg shadow-[#4f8ef7]/20 hover:bg-[#4f8ef7]/90 transition-all duration-200 text-xs gap-1.5 disabled:opacity-40"
                  >
                    {isChangingPassword ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                      />
                    ) : (
                      <>
                        <Lock className="size-3.5" />
                        Ubah Password
                      </>
                    )}
                  </Button>
                </motion.div>

                <Separator className="bg-muted/50" />

                {/* ── Danger Zone ────────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="size-3.5 text-red-400" />
                    <h3 className="text-xs font-semibold text-red-400/70 uppercase tracking-wider">
                      Zona Berbahaya
                    </h3>
                  </div>

                  <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground/80">Hapus Akun</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Setelah menghapus akun, semua data Anda akan dihapus secara permanen dan tidak dapat dikembalikan. Tindakan ini tidak dapat dibatalkan.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="w-full h-8 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 text-xs gap-1.5"
                    >
                      <Trash2 className="size-3" />
                      Hapus Akun Saya
                    </Button>
                  </div>
                </motion.div>
              </div>
            </ScrollArea>

            {/* ── Footer ─────────────────────────────────────── */}
            <div className="border-t border-border px-5 py-3">
              <p className="text-[10px] text-muted-foreground/40 text-center">
                UID: {user?.uid?.slice(0, 12)}...
              </p>
            </div>
          </motion.div>

          {/* ── Delete Account Confirmation Dialog ────────────── */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent
              className="border-red-500/20 bg-popover sm:max-w-md"
              showCloseButton
            >
              <DialogHeader>
                <DialogTitle className="text-foreground flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/15">
                    <Trash2 className="size-3.5 text-red-400" />
                  </div>
                  Hapus Akun Secara Permanen
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm pt-2">
                  Tindakan ini tidak dapat dibatalkan. Semua data Anda akan dihapus secara permanen.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-red-500/[0.06] border border-red-500/10 p-3">
                  <p className="text-xs text-red-300/80 leading-relaxed">
                    Untuk mengkonfirmasi, ketik alamat email Anda: <strong className="text-red-300">{user?.email}</strong>
                  </p>
                </div>

                {/* Email confirmation field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Konfirmasi Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      type="email"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      placeholder={user?.email || ''}
                      className="h-10 border-border bg-muted/30 pl-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-red-500/50 focus-visible:ring-red-500/20 transition-colors"
                      disabled={isDeletingAccount}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Password field for re-authentication */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Password Anda
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Masukkan password Anda"
                      className="h-10 border-border bg-muted/30 pl-10 text-foreground placeholder:text-muted-foreground/40 focus-visible:border-red-500/50 focus-visible:ring-red-500/20 transition-colors"
                      disabled={isDeletingAccount}
                      autoComplete="current-password"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={isDeletingAccount}
                  className="border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground text-xs"
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={
                    isDeletingAccount ||
                    deleteConfirmEmail !== user?.email ||
                    !deletePassword
                  }
                  className="bg-red-600 text-white hover:bg-red-700 text-xs gap-1.5 disabled:opacity-40"
                >
                  {isDeletingAccount ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                    />
                  ) : (
                    <>
                      <Trash2 className="size-3" />
                      Hapus Akun Permanen
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AnimatePresence>
  );
}
