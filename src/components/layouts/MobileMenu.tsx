"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, FileText, Home, LogIn, SquareArrowRightExit, UserPlus } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { NAV_LINKS } from "@/config/site";
import { isRouteActive } from "@/lib/url";
import { useDismissable } from "@/hooks/useDismissable";
import { useLogoutRedirect } from "@/hooks/useLogoutRedirect";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/components/AuthProvider";
import { getInitials, joinName } from "@shared/format";
import { ThemeGlyph, useThemeMode } from "./ThemeToggle";
import { userMenuItems } from "./UserMenu";

const NAV_ICONS = { home: Home, posts: FileText } as const;

const ROW_ICON = { size: 18, strokeWidth: 2.25, className: "h-4.5 w-4.5 shrink-0" } as const;

export function MobileMenu() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isDark, setDark } = useThemeMode();

  const [mobileOpen, setMobileOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const toggleRef = useRef<HTMLButtonElement>(null);

  const wasOpenRef = useRef(false);

  const isLoggedIn = !!user;

  const displayName = joinName(user?.firstName ?? "", user?.lastName ?? "");

  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  const close = () => setMobileOpen(false);

  const handleLogout = useLogoutRedirect(close);

  const isActive = (href: string) => isRouteActive(pathname, href);

  useEffect(() => {
    setMounted(true);
  }, []);

  useDismissable(mobileOpen, close, [mobileMenuRef, toggleRef], {
    lockScroll: true,
  });

  useEffect(() => {
    if (mobileOpen) {
      mobileMenuRef.current?.focus();
    } else if (wasOpenRef.current) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  const handleTrap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !mobileOpen) return;
    const root = mobileMenuRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>

      <button
        ref={toggleRef}
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? messages.nav.closeMenu : messages.nav.openMenu}
        aria-expanded={mobileOpen}
        className="icon-btn-ghost hidden max-md:flex"
      >
        {mobileOpen ? <X {...ROW_ICON} /> : <Menu {...ROW_ICON} />}
      </button>

      {mounted &&
        createPortal(
          <div
            className={`fixed top-(--nav-h) right-0 bottom-0 left-0 z-(--z-overlay) modal-overlay transition-[opacity,visibility] duration-[var(--duration-fast)] ease-smooth ${
              mobileOpen
                ? "pointer-events-auto visible opacity-100"
                : "pointer-events-none invisible opacity-0"
            }`}
            onClick={close}
            aria-hidden="true"
          />,
          document.body,
        )}

      {mounted &&
        createPortal(
          <div
            ref={mobileMenuRef}
            tabIndex={-1}
            onKeyDown={handleTrap}
            aria-hidden={!mobileOpen}
            inert={!mobileOpen ? true : undefined}
            className={`mobile-sheet transition-[opacity,visibility,translate] duration-[var(--duration-fast)] ease-smooth ${
              mobileOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible -translate-y-1 opacity-0"
            }`}
          >

            {isLoggedIn && (
              <Link href="/profile" onClick={close} className="sheet-identity">
                <Avatar
                  initials={initials}
                  src={user?.avatar || undefined}
                  size="lg"
                  alt={formatTemplate(messages.nav.avatarAlt, { name: displayName })}
                />

                <span className="min-w-0">
                  <span className="block truncate text-(length:--type-xs) leading-snug font-semibold text-heading">
                    {displayName}
                  </span>
                  <span className="block truncate text-(length:--type-xs) leading-snug text-faint">
                    @{user?.username}
                  </span>
                </span>
              </Link>
            )}

            <div className="sheet-group">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                const Icon = NAV_ICONS[link.key];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                    className={active ? "sheet-item sheet-item-on" : "sheet-item"}
                  >
                    <Icon {...ROW_ICON} />
                    {messages.nav[link.key]}
                  </Link>
                );
              })}
            </div>

            {isLoggedIn ? (
              <div className="sheet-group">
                {userMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className="sheet-item-sub"
                    >
                      <Icon {...ROW_ICON} />
                      {messages.nav[item.labelKey]}
                    </Link>
                  );
                })}
              </div>
            ) : (
              !loading && (
                <div className="sheet-group">

                  <Link href="/login" onClick={close} className="sheet-item-sub">
                    <LogIn {...ROW_ICON} />
                    {messages.nav.login}
                  </Link>

                  <Link href="/register" onClick={close} className="sheet-item-sub">
                    <UserPlus {...ROW_ICON} />
                    {messages.nav.register}
                  </Link>
                </div>
              )
            )}

            <div className="sheet-group">
              <button
                onClick={() => {
                  setDark(!isDark);
                  close();
                }}
                className="sheet-item-sub"
              >
                <ThemeGlyph isDark={isDark} />
                {messages.nav.theme}
                <span className="sheet-value">
                  {isDark ? messages.nav.themeDark : messages.nav.themeLight}
                </span>
              </button>
            </div>

            {isLoggedIn && (
              <div className="sheet-group">
                <button onClick={handleLogout} className="sheet-item-sub sheet-item-danger">
                  <SquareArrowRightExit {...ROW_ICON} />
                  {messages.nav.logout}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
