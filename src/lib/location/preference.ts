export const LOCATION_PREFERENCE_STORAGE_KEY = 'aheka_location_v1';
export const LOCATION_PREFERENCE_EVENT = 'aheka:location-changed';

export interface LocationPreference {
  districtSlug: string;
  talukaSlug: string;
}

function isLocationPreference(value: unknown): value is LocationPreference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.districtSlug === 'string'
    && candidate.districtSlug.trim().length > 0
    && typeof candidate.talukaSlug === 'string'
    && candidate.talukaSlug.trim().length > 0;
}

export function readLocationPreference(): LocationPreference | null {
  try {
    const stored = window.localStorage.getItem(LOCATION_PREFERENCE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return isLocationPreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLocationPreference(preference: LocationPreference): void {
  window.localStorage.setItem(LOCATION_PREFERENCE_STORAGE_KEY, JSON.stringify(preference));
  window.dispatchEvent(new CustomEvent<LocationPreference>(LOCATION_PREFERENCE_EVENT, {
    detail: preference,
  }));
}
