"use client";

import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMessages } from "@/lib/i18n-client";
import { emitFavoritesChanged } from "@/lib/favorites-client";

interface FavoriteSiteButtonProps {
  siteKey: string;
  initialFavorited?: boolean;
  onChange?: (favorited: boolean) => void;
  onNotice?: (message: string) => void;
  className?: string;
  stopPropagation?: boolean;
}

interface FavoriteResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    favorited: boolean;
  };
}

export function FavoriteSiteButton({
  siteKey,
  initialFavorited = false,
  onChange,
  onNotice,
  className = "",
  stopPropagation = true,
}: FavoriteSiteButtonProps) {
  const t = useMessages();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFavorited(initialFavorited);
  }, [initialFavorited]);

  const title = useMemo(() => t.common.favoriteSite, [t]);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ siteKey }),
      });
      const result: FavoriteResponse = await response.json();
      const nextFavorited = Boolean(result.data?.favorited);

      if (!result.success) {
        onNotice?.(result.error || t.common.favoriteLoginRequired);
        return;
      }

      setFavorited(nextFavorited);
      onChange?.(nextFavorited);
      emitFavoritesChanged();
      onNotice?.(nextFavorited ? t.common.favoriteAdded : t.common.favoriteRemoved);
    } catch {
      onNotice?.(t.auth.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={title}
      disabled={loading}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
        favorited
          ? "border-amber-400/45 bg-amber-400/12 text-amber-400"
          : "border-[var(--border-color)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent-soft)]/65"
      } ${loading ? "cursor-wait opacity-70" : "cursor-pointer"} ${className}`}
    >
      <Star className={`h-3.5 w-3.5 ${favorited ? "fill-current" : ""}`} />
    </button>
  );
}
