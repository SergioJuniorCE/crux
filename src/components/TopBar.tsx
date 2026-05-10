import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "@/components/ui/sonner";
import { ddragonProfileIcon } from "@/lib/leagueAssets";
import { cn } from "@/lib/utils";
import {
  PLATFORM_REGIONS,
  REGION_LABELS,
  type PlatformRegion,
} from "../types/riot";

type CurrentProfile = {
  gameName: string;
  tagLine: string;
  platform: PlatformRegion;
  profileIconId?: number;
  dataDragonVersion?: string;
};

type Props = {
  /** The signed-in user's identity, used to render the profile chip. */
  current: CurrentProfile;
  /** Whether identity is fully configured (Riot ID + API access). */
  configured: boolean;
  /** Click handler for the profile chip — typically navigates home. */
  onSelectOwn: () => void;
};

/**
 * Sticky top bar.
 *
 * The top bar is intentionally minimal: it carries only the global player
 * search and a chip showing the signed-in user (name + region). Everything
 * else — navigation, status, theme toggle, brand — lives in the left-hand
 * sidebar.
 */
export function TopBar({ current, configured, onSelectOwn }: Props) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => setIsScrolled(window.scrollY > 4);

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  return (
    <div
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 pt-1 transition-[background-color,border-color,box-shadow] duration-300",
        isScrolled
          ? "border-border bg-background/80 shadow-sm backdrop-blur-md"
          : "border-transparent bg-background",
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
      <div className="flex w-full items-center gap-2">
        <ProfileChip
          current={current}
          configured={configured}
          onSelect={onSelectOwn}
        />
        <PlayerSearchInline platform={current.platform} />
      </div>
    </div>
  );
}

function ProfileChip({
  current,
  configured,
  onSelect,
}: {
  current: CurrentProfile;
  configured: boolean;
  onSelect: () => void;
}) {
  const hasIdentity = Boolean(current.gameName && current.tagLine);
  const iconUrl =
    configured &&
    current.profileIconId !== undefined &&
    current.dataDragonVersion
      ? ddragonProfileIcon(current.dataDragonVersion, current.profileIconId)
      : null;

  if (!hasIdentity) {
    return (
      <div
        className="hidden h-9 shrink-0 items-center gap-2 rounded-md border border-dashed border-border bg-card/60 px-2.5 text-[11px] font-medium text-muted-foreground sm:inline-flex"
        title="Not signed in"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.04] text-muted-foreground">
          <Search size={11} />
        </span>
        <span>Not signed in</span>
        <span className="rounded bg-white/[0.04] px-1 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {current.platform}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`View my profile (${current.gameName}#${current.tagLine} · ${REGION_LABELS[current.platform]})`}
      className="group hidden h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card pl-1 pr-2.5 text-left transition-colors hover:border-primary/40 hover:bg-card sm:inline-flex"
    >
      <span className="relative inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border bg-background/40">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <span className="inline-flex h-full w-full items-center justify-center text-muted-foreground">
            <Search size={11} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[12px] font-semibold tracking-[-0.01em] text-foreground">
          {current.gameName}
          <span className="ml-0.5 font-mono text-[10px] font-normal text-muted-foreground">
            #{current.tagLine}
          </span>
        </span>
        <span className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-primary/80" />
          {current.platform}
          <span className="text-muted-foreground/50">·</span>
          <span className="font-medium tracking-[0.06em] text-muted-foreground/70">
            {REGION_LABELS[current.platform]}
          </span>
        </span>
      </span>
    </button>
  );
}

/**
 * The global player search, redesigned to live in the topbar. Same submit
 * semantics as the previous PlayerSearch but with a tighter, single-input
 * shell and a compact platform selector.
 */
function PlayerSearchInline({ platform }: { platform: PlatformRegion }) {
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
    const match = raw.match(/^(.+?)\s*[#-]\s*([A-Za-z0-9]+)$/);
    if (!match) {
      const message = "Use the format Name#TAG";
      setError(message);
      toast.error("Invalid Riot ID", { description: message });
      return;
    }
    const [, gameName, tagLine] = match;
    const cleanName = gameName.trim();
    const cleanTag = tagLine.trim();
    if (!cleanName || !cleanTag) {
      const message = "Use the format Name#TAG";
      setError(message);
      toast.error("Invalid Riot ID", { description: message });
      return;
    }
    setError(null);
    navigate(
      `/profile/${encodeURIComponent(selectedPlatform)}/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`,
    );
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        "group relative flex h-9 min-w-0 flex-1 items-center gap-1 rounded-md border bg-card pl-2 pr-1 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15",
        error ? "border-red-500/50" : "border-border",
      )}
    >
      <Search size={13} className="shrink-0 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Search summoner — Name#TAG"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="Search summoner by Riot ID"
        className="h-full min-w-0 flex-1 bg-transparent pl-1 text-[12.5px] font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <X size={12} />
        </button>
      )}
      <span className="h-5 w-px bg-border" />
      <select
        value={selectedPlatform}
        onChange={(e) => setSelectedPlatform(e.target.value as PlatformRegion)}
        className="h-7 shrink-0 rounded bg-transparent pl-1.5 pr-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors focus:outline-none focus:text-foreground"
        aria-label="Select Riot platform"
        title={REGION_LABELS[selectedPlatform]}
      >
        {PLATFORM_REGIONS.map((region) => (
          <option key={region} value={region}>
            {region.toUpperCase()}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        aria-label="Search"
      >
        <ArrowRight size={13} />
      </button>
      {error && (
        <div className="absolute left-0 top-full mt-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-300 shadow-lg">
          {error}
        </div>
      )}
    </form>
  );
}
