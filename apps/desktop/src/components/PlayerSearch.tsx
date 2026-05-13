import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  PLATFORM_REGIONS,
  REGION_LABELS,
  type PlatformRegion,
} from "../types/riot";

type Props = {
  className?: string;
  platform: PlatformRegion;
  /** Optional placeholder override. */
  placeholder?: string;
};

/**
 * Global player lookup. Accepts `Name#TAG` (with or without the `#`) and
 * navigates to `/profile/:platform/:gameName/:tagLine` so the target profile
 * keeps an explicit platform instead of inheriting mutable app state.
 */
export function PlayerSearch({
  className,
  platform,
  placeholder = "Search summoner (Name#TAG)",
}: Props) {
  const [selectedPlatform, setSelectedPlatform] =
    useState<PlatformRegion>(platform);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedPlatform(platform);
  }, [platform]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) return;

    // Accept forms like "Name#TAG", "Name #TAG", "Name-TAG" (some sites use this).
    const match = raw.match(/^(.+?)\s*[#-]\s*([A-Za-z0-9]+)$/);
    if (!match) {
      const message = "Use the format Name#TAG";
      setError(message);
      toast.error("Invalid Riot ID", {
        description: message,
      });
      return;
    }
    const [, gameName, tagLine] = match;
    const cleanName = gameName.trim();
    const cleanTag = tagLine.trim();
    if (!cleanName || !cleanTag) {
      const message = "Use the format Name#TAG";
      setError(message);
      toast.error("Invalid Riot ID", {
        description: message,
      });
      return;
    }
    setError(null);
    navigate(
      `/profile/${encodeURIComponent(selectedPlatform)}/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`,
    );
  };

  const clear = () => {
    setValue("");
    setError(null);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("relative flex items-center gap-2", className)}
      role="search"
    >
      <select
        value={selectedPlatform}
        onChange={(e) => setSelectedPlatform(e.target.value as PlatformRegion)}
        className="h-8 shrink-0 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label="Select Riot platform"
        title={REGION_LABELS[selectedPlatform]}
      >
        {PLATFORM_REGIONS.map((region) => (
          <option key={region} value={region}>
            {region.toUpperCase()}
          </option>
        ))}
      </select>

      <div className="relative min-w-0 flex-1">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className={cn(
            "h-8 w-full rounded-md border bg-card pl-7 pr-7 text-[12.5px] font-medium text-foreground placeholder:text-muted-foreground/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30",
            error ? "border-red-500/50" : "border-border focus:border-white/15",
          )}
          aria-label="Search summoner by Riot ID"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
            aria-label="Clear search"
            tabIndex={-1}
          >
            <X size={12} />
          </button>
        )}
      </div>

      <button
        type="submit"
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-white/15 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label="Search player"
      >
        <ArrowRight size={12} />
        <span>Search</span>
      </button>

      {error && (
        <div className="absolute left-0 top-full mt-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-300 shadow-lg">
          {error}
        </div>
      )}
    </form>
  );
}
