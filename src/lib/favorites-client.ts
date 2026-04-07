export const FAVORITES_CHANGED_EVENT = "sk-buy-favorites-change";
export const FAVORITES_FILTER_CHANGED_EVENT = "sk-buy-favorites-filter-change";
export const FAVORITES_ONLY_STORAGE_KEY = "sk-buy-favorites-only";

export function subscribeFavoritesOnly(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(FAVORITES_FILTER_CHANGED_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(FAVORITES_FILTER_CHANGED_EVENT, handleChange);
  };
}

export function emitFavoritesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  }
}

export function emitFavoritesFilterChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAVORITES_FILTER_CHANGED_EVENT));
  }
}

export function getFavoritesOnlyFromStorage() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FAVORITES_ONLY_STORAGE_KEY) === "1";
}

export function setFavoritesOnlyToStorage(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_ONLY_STORAGE_KEY, value ? "1" : "0");
  emitFavoritesFilterChanged();
}
