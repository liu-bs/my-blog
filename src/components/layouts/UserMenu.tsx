"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { LogIn, NotepadText, SquareArrowRightExit, BookUser, Columns3Cog } from "lucide-react";
import { formatTemplate, messages } from "@/texts";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "@/components/AuthProvider";
import { getInitials, joinName } from "@shared/format";
import { useDismissable } from "@/hooks/useDismissable";
import { useLogoutRedirect } from "@/hooks/useLogoutRedirect";

export const userMenuItems = [
  { href: "/profile", labelKey: "profile", icon: BookUser },
  { href: "/write", labelKey: "write", icon: NotepadText },
  { href: "/settings", labelKey: "settings", icon: Columns3Cog },
] as const;

export function UserMenu() {

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { user, loading } = useAuth();

  const isLoggedIn = !!user;

  const userMenuRef = useRef<HTMLDivElement>(null);

  const hoverOpenedRef = useRef(false);

  const panelId = useId();

  const displayName = joinName(user?.firstName ?? "", user?.lastName ?? "");

  const initials = getInitials(user?.firstName ?? "", user?.lastName ?? "");

  const handleLogout = useLogoutRedirect(() => setUserMenuOpen(false));

  useDismissable(userMenuOpen, () => setUserMenuOpen(false), [userMenuRef]);

  if (loading && !user) {
    return <span aria-hidden="true" className="h-9 w-9 shrink-0" />;
  }

  if (!isLoggedIn) {
    return (
      <Link href="/login" className="bar-btn">
        <LogIn size={18} strokeWidth={2.25} className="h-4.5 w-4.5 shrink-0" />
        {messages.nav.login}
      </Link>
    );
  }

  return (

    <div
      ref={userMenuRef}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        hoverOpenedRef.current = true;
        setUserMenuOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hoverOpenedRef.current = false;
        setUserMenuOpen(false);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setUserMenuOpen(false);
        }
      }}
    >

      <button
        onClick={() => {
          if (hoverOpenedRef.current) {
            hoverOpenedRef.current = false;
            setUserMenuOpen(true);
          } else {
            setUserMenuOpen((v) => !v);
          }
        }}
        aria-label={messages.nav.userMenu}
        aria-expanded={userMenuOpen}
        aria-controls={panelId}
        className="icon-btn-ghost"
      >

        <Avatar
          initials={initials}
          src={user?.avatar || undefined}
          size="sm"
          alt={formatTemplate(messages.nav.avatarAlt, { name: displayName })}
        />
      </button>

      <div
        className={`absolute top-full right-0 z-(--z-modal) pt-2 ${userMenuOpen ? "" : "pointer-events-none"}`}
      >

        <div
          id={panelId}
          className={`w-56 origin-top-right overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-(--shadow-lg) transition-[opacity,scale,visibility] duration-[var(--duration-fast)] ease-smooth ${
            userMenuOpen ? "visible scale-100 opacity-100" : "invisible scale-98 opacity-0"
          }`}
        >

          <div className="row-sm px-3.5 py-3">
            <Avatar
              initials={initials}
              src={user?.avatar || undefined}
              size="md"
              alt={formatTemplate(messages.nav.avatarAlt, { name: displayName })}
            />
            <div className="min-w-0">

              <p className="m-0 truncate text-(length:--type-xs) leading-normal font-semibold text-heading">
                {displayName}
              </p>

              <p className="m-0 truncate text-(length:--type-xs) leading-normal text-faint">
                @{user?.username}
              </p>
            </div>
          </div>

          <div className="mx-3 border-t border-stroke/60" />

          <div className="p-1.5">
            {userMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setUserMenuOpen(false)}
                  className="group row-sm min-h-9 rounded-md px-2.5 py-2 text-(length:--type-xs) leading-normal font-medium text-body transition-[background-color,color] duration-[var(--duration-fast)] ease-smooth hover:bg-btn-hover-bg hover:text-heading"
                >

                  <Icon
                    size={16}
                    strokeWidth={2.25}
                    className="h-4 w-4 shrink-0 text-muted transition-colors duration-[var(--duration-fast)] ease-smooth group-hover:text-heading"
                  />
                  {messages.nav[item.labelKey]}
                </Link>
              );
            })}
          </div>

          <div className="mx-3 border-t border-stroke/60" />

          <div className="p-1.5">
            <button
              onClick={handleLogout}
              className="group row-sm min-h-9 w-full rounded-md px-2.5 py-2 text-(length:--type-xs) leading-normal font-medium text-muted transition-[background-color,color] duration-[var(--duration-fast)] ease-smooth hover:bg-state-error-bg hover:text-state-error"
            >

              <SquareArrowRightExit
                size={16}
                strokeWidth={2.25}
                className="h-4 w-4 shrink-0 transition-colors duration-[var(--duration-fast)] ease-smooth group-hover:text-state-error"
              />
              {messages.nav.logout}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
