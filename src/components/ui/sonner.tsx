import { Toaster as Sonner, type ToasterProps } from "sonner";

type Props = ToasterProps & {
  isDark?: boolean;
};

export function Toaster({ isDark = true, ...props }: Props) {
  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      closeButton
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

// Re-exporting sonner's toast keeps call sites aligned with the UI wrapper.
// eslint-disable-next-line react-refresh/only-export-components
export { toast } from "sonner";
