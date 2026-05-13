import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";

type UseErrorToastOptions = {
  error: string | null | undefined;
  title?: string;
  description?: string;
  enabled?: boolean;
};

function normalizeError(error: string | null | undefined): string | null {
  if (!error) return null;
  const trimmed = error.trim();
  return trimmed ? trimmed : null;
}

/**
 * Shows a toast once whenever the provided error message changes.
 * Prevents duplicate toasts from repeated renders / StrictMode replays.
 */
export function useErrorToast({
  error,
  title = "Something went wrong",
  description,
  enabled = true,
}: UseErrorToastOptions) {
  const lastShownRef = useRef<string | null>(null);
  const normalizedError = normalizeError(error);

  useEffect(() => {
    if (!enabled || !normalizedError) return;

    if (lastShownRef.current === normalizedError) {
      return;
    }

    toast.error(title, {
      description: description ?? normalizedError,
    });

    lastShownRef.current = normalizedError;
  }, [description, enabled, normalizedError, title]);

  useEffect(() => {
    if (!normalizedError) {
      lastShownRef.current = null;
    }
  }, [normalizedError]);

  return {
    hasError: Boolean(normalizedError),
    errorMessage: normalizedError,
    resetShownError() {
      lastShownRef.current = null;
    },
  };
}
