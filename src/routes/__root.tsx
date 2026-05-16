import { Outlet, Link, createRootRoute, HeadContent, Scripts, useNavigate, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#16a34a" },
      { title: "PharmaAgro - Inventory" },
      { name: "description", content: "Multi-tenant pharmacy & agro inventory management" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/icon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: import.meta.env.PROD
              ? `
              if ("serviceWorker" in navigator) {
                window.addEventListener('load', function () {
                  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
                    navigator.serviceWorker.getRegistrations().then(function (registrations) {
                      registrations.forEach(function (registration) {
                        registration.unregister();
                      });
                    });
                    return;
                  }
                  navigator.serviceWorker.register('/sw.js').catch(function (error) {
                    console.warn('Service worker registration failed:', error);
                  });
                });
              }
            `
              : `
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.getRegistrations().then(function (registrations) {
                  registrations.forEach(function (registration) {
                    registration.unregister();
                  });
                });
              }
              if ("caches" in window) {
                caches.keys().then(function (keys) {
                  keys.forEach(function (key) {
                    caches.delete(key);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

function RootComponent() {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <AndroidBackButton />
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

function AndroidBackButton() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;

      import("@capacitor/app").then(({ App }) => {
        App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack && window.history.length > 1) {
            window.history.back();
            return;
          }

          if (pathname !== "/dashboard") {
            navigate({ to: "/dashboard" });
          }
        }).then((handle) => {
          removeListener = () => handle.remove();
        });
      });
    });

    return () => removeListener?.();
  }, [navigate, pathname]);

  return null;
}
