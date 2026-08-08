'use client';

import {
  FileSpreadsheet,
  Printer,
  LogOut,
  Hospital,
  ChevronDown,
  User,
  Bell,
  Building2,
  Menu,
  Sun,
  Moon,
  Settings,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { UNIT_MAP } from '@/types';

interface DashboardHeaderProps {
  activeUnit: string;
  onExportExcel: () => void;
  onPrint: () => void;
  onLogout: () => void;
  onProfileClick?: () => void;
  userName?: string;
  onUnitChange: (unit: string) => void;
  /** Available units for the selector */
  availableUnits?: string[];
  /** Unread notification count */
  unreadNotificationCount?: number;
  /** Callback when notification bell is clicked */
  onNotificationClick?: () => void;
  /** Callback when hamburger menu is clicked (mobile) */
  onMenuClick?: () => void;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
}

export function DashboardHeader({
  activeUnit,
  onExportExcel,
  onPrint,
  onLogout,
  onProfileClick,
  userName,
  onUnitChange,
  availableUnits,
  unreadNotificationCount = 0,
  onNotificationClick,
  onMenuClick,
  onSettingsClick,
}: DashboardHeaderProps) {
  const { theme, setTheme } = useTheme();
  const userInitials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const unitKeys = availableUnits ?? Object.keys(UNIT_MAP).filter((k) => k !== 'all');
  const currentUnitMeta = UNIT_MAP[activeUnit] ?? UNIT_MAP['all'];

  return (
    <header
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border px-4 backdrop-blur-xl bg-card/90 header-gradient-border"
    >
      {/* Left: Hamburger (mobile) + Logo + Title + Unit Selector */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden size-9 text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] shrink-0"
          onClick={onMenuClick}
        >
          <Menu className="size-5" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#4f8ef7]/15">
            <Hospital className="size-4 text-[#4f8ef7]" />
          </div>
          <Badge
            variant="secondary"
            className="bg-[#4f8ef7]/15 text-[#4f8ef7] font-bold text-xs tracking-wider border-0"
          >
            MUTU
          </Badge>
        </div>
        <Separator orientation="vertical" className="h-6 bg-foreground/10" />
        <h1 className="text-sm font-semibold text-foreground/90 hidden sm:block">
          Dashboard Indikator Mutu RS
        </h1>
        <h1 className="text-sm font-semibold text-foreground/90 sm:hidden">
          Mutu RS
        </h1>

        {/* Inline unit selector */}
        <Separator orientation="vertical" className="h-6 bg-foreground/10 hidden sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex h-7 gap-1.5 px-2 text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] border border-foreground/[0.06] rounded-md"
            >
              <Building2 className="size-3" />
              <span className="text-xs font-medium max-w-[120px] truncate">
                {currentUnitMeta.label}
              </span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 dropdown-menu-animated"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Pilih Unit
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={`
                text-xs gap-2
                ${activeUnit === 'all' ? 'bg-accent text-accent-foreground' : ''}
              `}
              onClick={() => onUnitChange('all')}
            >
              <div
                className="size-4 rounded flex items-center justify-center text-[8px] font-bold"
                style={{ backgroundColor: `${UNIT_MAP['all'].color}25`, color: UNIT_MAP['all'].color }}
              >
                ALL
              </div>
              Semua Unit
            </DropdownMenuItem>
            {unitKeys.map((key) => {
              const meta = UNIT_MAP[key];
              if (!meta) return null;
              return (
                <DropdownMenuItem
                  key={key}
                  className={`
                    text-xs gap-2
                    ${activeUnit === key ? 'bg-accent text-accent-foreground' : ''}
                  `}
                  onClick={() => onUnitChange(key)}
                >
                  <div
                    className="size-4 rounded flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: `${meta.color}25`, color: meta.color }}
                  >
                    {meta.abbr}
                  </div>
                  {meta.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Settings Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06]"
              onClick={onSettingsClick}
            >
              <Settings className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pengaturan</TooltipContent>
        </Tooltip>

        {/* Theme Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06]"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </TooltipContent>
        </Tooltip>

        {/* Notification Bell */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9 text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06]"
              onClick={onNotificationClick}
            >
              <Bell className="size-4" />
              {unreadNotificationCount > 0 && (
                <span className="badge-pulse absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifikasi</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportExcel}
              className="text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] gap-1.5"
            >
              <FileSpreadsheet className="size-4" />
              <span className="hidden md:inline text-xs">Export</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export ke Excel</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrint}
              className="text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] gap-1.5"
            >
              <Printer className="size-4" />
              <span className="hidden md:inline text-xs">Cetak</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cetak Laporan</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 bg-foreground/10 mx-1" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] gap-2 px-2"
            >
              <Avatar className="size-7 ring-2 ring-[#4f8ef7]/30 ring-offset-1 ring-offset-card">
                <AvatarFallback
                  className="bg-[#4f8ef7]/15 text-[#4f8ef7] text-xs font-medium"
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-xs max-w-[100px] truncate">
                {userName}
              </span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 dropdown-menu-animated"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Akun
            </DropdownMenuLabel>
            <DropdownMenuItem
              disabled
            >
              <User className="size-4 mr-2" />
              <span className="truncate">{userName || 'Pengguna'}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onProfileClick}
            >
              <User className="size-4 mr-2" />
              Profil Pengguna
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-500 dark:text-red-400 focus:text-red-600 dark:focus:text-red-300 focus:bg-red-500/10"
              onClick={onLogout}
            >
              <LogOut className="size-4 mr-2" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
