import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { useActiveProfile } from "../store/settingsStore";
import { checkProvider } from "../services/modelService";
import { logger } from "../store/logStore";

/**
 * Pings the active server every few seconds and records whether it is
 * online. Mount once at the top of the app.
 */
export function useProviderStatus() {
  const profile = useActiveProfile();

  const { id, name, kind, baseUrl, apiKey } = profile;

  useEffect(() => {
    let cancelled = false;
    let previous: boolean | null = null;

    const check = async () => {
      const online = await checkProvider({ kind, baseUrl, apiKey });

      if (cancelled) return;

      useAppStore.getState().setProviderOnline(online);

      if (previous !== online) {
        if (online) {
          logger.info("provider", `${name} is online (${baseUrl})`);
        } else {
          logger.warn("provider", `${name} is not reachable at ${baseUrl}`);
        }

        previous = online;
      }
    };

    useAppStore.getState().setProviderOnline(false);
    check();

    const timer = setInterval(check, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, name, kind, baseUrl, apiKey]);
}
