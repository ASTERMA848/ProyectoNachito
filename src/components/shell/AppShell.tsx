"use client";

import { createContext, Suspense, useContext, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TopBar, iconSize, type MenuEntry, type TopBarSection } from "@/components/ui";
import { appForPath, visibleApps, type AppDef } from "./apps";
import { LeaveGuardProvider, useLeaveGuardContext } from "./LeaveGuard";
import { UiFeedbackProvider } from "./UiFeedback";
import { UserMenu, type ShellUser } from "./UserMenu";
import styles from "./AppShell.module.css";

// Un menú con filtro (?filter=...) está activo si la URL tiene ese mismo filtro;
// el menú sin filtro, si ningún otro coincide.
function sectionsFor(app: AppDef, pathname: string, search: URLSearchParams | null): TopBarSection[] {
  const sections = app.sections ?? [];
  const current = search?.getAll("filter").sort().join("&") ?? "";
  const withQuery = sections.find((section) => {
    const url = new URL(section.href, "http://local");
    return url.search && url.pathname === pathname && url.searchParams.getAll("filter").sort().join("&") === current;
  });
  return sections.map((section) => {
    const url = new URL(section.href, "http://local");
    const active = withQuery ? section === withQuery : !url.search && (pathname === url.pathname || pathname.startsWith(`${url.pathname}/`));
    return { id: section.id, label: section.label, href: section.href, active };
  });
}

function ShellBar({ user, search }: { user: ShellUser; search: string | null }) {
  const pathname = usePathname();
  const { navigate } = useLeaveGuardContext();
  const app = appForPath(pathname);
  const apps: MenuEntry[] = visibleApps(user.role).map((item) => ({
    id: item.id,
    label: item.label,
    icon: <item.icon size={iconSize.sm} />,
    onSelect: () => void navigate(item.href),
  }));
  return (
    <TopBar
      appName={app.label}
      apps={apps}
      sections={sectionsFor(app, pathname, search === null ? null : new URLSearchParams(search))}
      end={<UserMenu user={user} />}
    />
  );
}

// useSearchParams necesita un Suspense alrededor; mientras resuelve se muestra la barra sin menú activo.
function ShellBarWithSearch({ user }: { user: ShellUser }) {
  const search = useSearchParams();
  return <ShellBar user={user} search={search?.toString() ?? ""} />;
}

const ShellUserContext = createContext<ShellUser | null>(null);

// Usuario de la sesión para las pantallas de la interfaz nueva (rol, tema, nombre).
export function useShellUser() {
  const user = useContext(ShellUserContext);
  if (!user) throw new Error("useShellUser se usa dentro de AppShell");
  return user;
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <ShellUserContext.Provider value={user}>
      <UiFeedbackProvider>
        <LeaveGuardProvider>
          <div className={`ui-app ${styles.shell}`}>
            <Suspense fallback={<ShellBar user={user} search={null} />}>
              <ShellBarWithSearch user={user} />
            </Suspense>
            <main className={styles.main}>{children}</main>
          </div>
        </LeaveGuardProvider>
      </UiFeedbackProvider>
    </ShellUserContext.Provider>
  );
}
