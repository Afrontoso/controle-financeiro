"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Bug,
  CalendarDays,
  ChevronLeft,
  Github,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  Moon,
  Plus,
  Sigma,
  Sun,
  Target,
  Wallet,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type ViewKey = "saldos" | "totais" | "horizonte" | "orcamentos";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof Wallet;
}

const NAV_ITEMS: NavItem[] = [
  { key: "saldos", label: "saldos", icon: LayoutGrid },
  { key: "totais", label: "totais", icon: Sigma },
  { key: "horizonte", label: "horizonte", icon: CalendarDays },
  { key: "orcamentos", label: "orçamentos", icon: Target },
];

interface AppShellProps {
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  onAdd: () => void;
  onGoToday: () => void;
  children: React.ReactNode;
}

export function AppShell({ view, onViewChange, onAdd, onGoToday, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Sidebar e barra inferior coexistem no DOM (uma escondida por CSS). O menu de
  // conta ouve cliques no documento, então só pode existir um por vez.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg text-fg">
      <DesktopSidebar
        view={view}
        onViewChange={onViewChange}
        onAdd={onAdd}
        onGoToday={onGoToday}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        menuOpen={menuOpen && isDesktop}
        onToggleMenu={() => setMenuOpen((m) => !m)}
        onCloseMenu={() => setMenuOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pb-[4.5rem] md:pb-0">
        {children}
      </main>

      <MobileTabBar
        view={view}
        onViewChange={onViewChange}
        onAdd={onAdd}
        menuOpen={menuOpen && !isDesktop}
        onToggleMenu={() => setMenuOpen((m) => !m)}
        onCloseMenu={() => setMenuOpen(false)}
        onGoToday={onGoToday}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface SidebarProps {
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  onAdd: () => void;
  onGoToday: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}

function DesktopSidebar({
  view,
  onViewChange,
  onAdd,
  onGoToday,
  collapsed,
  onToggleCollapse,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: SidebarProps) {
  const today = new Date().getDate();

  return (
    <aside
      className={`relative hidden shrink-0 flex-col border-r border-border-base bg-surface transition-[width] duration-200 md:flex ${
        collapsed ? "w-[4.5rem]" : "w-56"
      }`}
    >
      <div className={`flex items-center gap-3 px-5 py-6 ${collapsed ? "justify-center px-0" : ""}`}>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          <Wallet size={18} />
        </span>
        {!collapsed && <span className="truncate text-sm font-semibold lowercase">controle</span>}
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <SidebarButton
            key={item.key}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            active={view === item.key}
            onClick={() => onViewChange(item.key)}
          />
        ))}
      </nav>

      <div className="my-5 mx-5 border-t border-border-base" />

      <div className="flex flex-col gap-1 px-3">
        <SidebarButton icon={Plus} label="adicionar" collapsed={collapsed} onClick={onAdd} accent />
        <SidebarButton
          icon={CalendarDays}
          label="ir pra hoje"
          collapsed={collapsed}
          onClick={onGoToday}
          badge={today}
        />
      </div>

      <div className="relative mt-auto flex flex-col gap-1 px-3 pb-3">
        {menuOpen && <AccountMenu onClose={onCloseMenu} placement="sidebar" />}
        <SidebarButton icon={Menu} label="menu" collapsed={collapsed} onClick={onToggleMenu} />
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="mt-1 grid h-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <ChevronLeft size={18} className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>
    </aside>
  );
}

interface SidebarButtonProps {
  icon: typeof Wallet;
  label: string;
  collapsed: boolean;
  active?: boolean;
  accent?: boolean;
  badge?: number;
  onClick: () => void;
}

function SidebarButton({
  icon: Icon,
  label,
  collapsed,
  active,
  accent,
  badge,
  onClick,
}: SidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium lowercase transition-colors ${
        collapsed ? "justify-center px-0" : ""
      } ${
        active
          ? "bg-surface-3 text-fg"
          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <span className="relative grid size-5 shrink-0 place-items-center">
        <Icon size={19} strokeWidth={active || accent ? 2.4 : 2} />
        {badge !== undefined && (
          <span className="absolute -bottom-1.5 text-[8px] font-bold tabular">{badge}</span>
        )}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */

interface TabBarProps {
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  onAdd: () => void;
  onGoToday: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}

function MobileTabBar({
  view,
  onViewChange,
  onAdd,
  onGoToday,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: TabBarProps) {
  const left = NAV_ITEMS.slice(0, 2);
  const right = NAV_ITEMS.slice(2);

  return (
    <>
      {menuOpen && <AccountMenu onClose={onCloseMenu} placement="mobile" onGoToday={onGoToday} />}

      <nav
        className="fixed inset-x-0 bottom-0 z-[120] flex items-stretch border-t border-border-base bg-surface md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {left.map((item) => (
          <TabButton
            key={item.key}
            item={item}
            active={view === item.key}
            onClick={() => onViewChange(item.key)}
          />
        ))}

        <div className="relative flex w-16 shrink-0 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="adicionar lançamento"
            className="absolute -top-5 grid size-14 place-items-center rounded-full text-white shadow-e2 transition-transform active:scale-95"
            style={{ background: "var(--entrada)" }}
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </div>

        {right.map((item) => (
          <TabButton
            key={item.key}
            item={item}
            active={view === item.key}
            onClick={() => onViewChange(item.key)}
          />
        ))}

        <button
          type="button"
          onClick={onToggleMenu}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] lowercase transition-colors ${
            menuOpen ? "text-fg" : "text-fg-subtle"
          }`}
        >
          <Menu size={20} strokeWidth={menuOpen ? 2.4 : 2} />
          menu
        </button>
      </nav>
    </>
  );
}

function TabButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] lowercase transition-colors ${
        active ? "text-fg" : "text-fg-subtle"
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.4 : 2} />
      <span className="truncate px-1">{item.label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */

function AccountMenu({
  onClose,
  placement,
  onGoToday,
}: {
  onClose: () => void;
  placement: "sidebar" | "mobile";
  onGoToday?: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // O clique que abriu o menu ainda está propagando; espera o próximo tick.
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <>
      {placement === "mobile" && (
        <div className="animate-fade-in fixed inset-0 z-[115] md:hidden" style={{ background: "var(--overlay)" }} />
      )}
      <div
        ref={ref}
        className={
          placement === "sidebar"
            ? "animate-pop-in absolute bottom-full left-3 z-50 mb-2 w-60 overflow-hidden rounded-2xl border border-border-base bg-surface shadow-e3"
            : "animate-slide-up fixed inset-x-0 bottom-[4.5rem] z-[125] mx-3 overflow-hidden rounded-2xl border border-border-base bg-surface shadow-e3 md:hidden"
        }
      >
        <div className="flex items-center gap-3 border-b border-border-base px-4 py-3">
          {session?.user?.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={session.user.image} alt="" className="size-9 shrink-0 rounded-full" />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-semibold">
              {session?.user?.name?.charAt(0) ?? "?"}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{session?.user?.name ?? "conta"}</p>
            <p className="truncate text-xs text-fg-muted">{session?.user?.email}</p>
          </div>
        </div>

        <div className="p-1.5">
          {onGoToday && (
            <MenuRow
              icon={CalendarDays}
              label="ir pra hoje"
              onClick={() => {
                onGoToday();
                onClose();
              }}
            />
          )}
          <MenuRow
            icon={theme === "dark" ? Sun : Moon}
            label={theme === "dark" ? "tema claro" : "tema escuro"}
            onClick={toggleTheme}
          />
          <MenuRow icon={LogOut} label="sair" onClick={() => signOut()} danger />
        </div>

        <div className="flex items-center justify-between border-t border-border-base px-4 py-2.5 text-xs text-fg-subtle">
          <span className="lowercase">victor assis</span>
          <span className="flex items-center gap-3">
            <a href="mailto:victor2lra@gmail.com" title="E-mail" className="hover:text-fg">
              <Mail size={15} />
            </a>
            <a
              href="https://github.com/Afrontoso"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="hover:text-fg"
            >
              <Github size={15} />
            </a>
            <a
              href="mailto:victor2lra@gmail.com?subject=Bug%20no%20controle%20financeiro"
              title="Reportar bug"
              className="hover:text-fg"
            >
              <Bug size={15} />
            </a>
          </span>
        </div>
      </div>
    </>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Wallet;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm lowercase transition-colors hover:bg-surface-2 ${
        danger ? "text-saida" : "text-fg-muted hover:text-fg"
      }`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}
