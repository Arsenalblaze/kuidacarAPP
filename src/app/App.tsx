import { useEffect, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { processAuthDeepLink } from "./utils/authDeepLinks";
import { toast } from "sonner";
import { translateAuthErrorMessage } from "./utils/authErrors";
import type { NotificationClickEvent } from "@onesignal/capacitor-plugin";
import { OneSignal, syncOneSignalIdentity } from "./utils/oneSignal";

const navigatedDeepLinks = new Set<string>();

function OneSignalIdentitySync() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || isLoading) return;

    let active = true;
    let clickListenerAdded = false;
    const handleNotificationClick = (event: NotificationClickEvent) => {
      const additionalData = event.notification.additionalData as Record<string, unknown> | undefined;
      const target = event.result.url ?? additionalData?.url;
      if (typeof target === "string" && target.startsWith("/") && !target.startsWith("//")) {
        void router.navigate(target);
      }
    };

    void syncOneSignalIdentity(user?.id ?? null)
      .then(async () => {
        if (!active) return;
        OneSignal.Notifications.addEventListener("click", handleNotificationClick);
        clickListenerAdded = true;
      })
      .catch((error) => {
        console.error("Não foi possível sincronizar a identidade OneSignal:", error);
      });

    return () => {
      active = false;
      if (clickListenerAdded) {
        OneSignal.Notifications.removeEventListener("click", handleNotificationClick);
      }
    };
  }, [isLoading, user?.id]);

  return null;
}

export default function App() {
  const [deepLinksReady, setDeepLinksReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let removeAppUrlListener: (() => void) | undefined;

    const handleUrl = async (url: string) => {
      try {
        const result = await processAuthDeepLink(url);
        if (!isMounted || !result) return;
        if (navigatedDeepLinks.has(url)) return;
        navigatedDeepLinks.add(url);

        await router.navigate(result.path, {
          replace: true,
          state: result.error ? { authLinkError: result.error } : undefined,
        });
        if (result.error && result.type === "confirmation") {
          toast.error(translateAuthErrorMessage(result.error));
        } else if (result.confirmed) {
          toast.success("E-mail confirmado. Já pode iniciar sessão.");
        }
      } catch (error) {
        console.error("Erro ao processar deep link:", error);
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Não foi possível processar este link.";
          toast.error(translateAuthErrorMessage(message));
        }
      }
    };

    const setupDeepLinks = async () => {
      if (Capacitor.isNativePlatform()) {
        const listener = await CapacitorApp.addListener("appUrlOpen", ({ url }) => {
          void handleUrl(url);
        });

        if (isMounted) {
          removeAppUrlListener = () => {
            void listener.remove().catch((error) => {
              console.error("Não foi possível remover o listener de deep links:", error);
            });
          };
        } else {
          await listener.remove();
          return;
        }

        const launch = await CapacitorApp.getLaunchUrl();
        if (launch?.url) await handleUrl(launch.url);
      } else {
        await handleUrl(window.location.href);
      }
      if (isMounted) setDeepLinksReady(true);
    };

    void setupDeepLinks().catch((error) => {
      console.error("Não foi possível inicializar os deep links:", error);
      if (isMounted) toast.error("Não foi possível inicializar os links da aplicação.");
      if (isMounted) setDeepLinksReady(true);
    });

    return () => {
      isMounted = false;
      removeAppUrlListener?.();
    };
  }, []);

  return (
    <AuthProvider>
      <OneSignalIdentitySync />
      {deepLinksReady && <RouterProvider router={router} />}
      <Toaster />
    </AuthProvider>
  );
}