import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { getDictionary, type Locale } from '../lib/i18n';
import {
  LOCATION_PREFERENCE_EVENT,
  readLocationPreference,
  type LocationPreference,
} from '../lib/location/preference';

interface SearchCategory {
  slug: string;
  name_en: string;
  name_mr: string;
  icon_key: string;
  aliases?: string[];
}

interface SearchTaluka {
  slug: string;
  name_en: string;
  name_mr: string;
  district_slug: string;
  district_name_en?: string;
  district_name_mr?: string;
}

interface SearchIslandProps {
  locale: Locale;
  categories: SearchCategory[];
  talukas: SearchTaluka[];
}

function openLocationDialog() {
  (document.getElementById('location-dialog') as HTMLDialogElement | null)?.showModal();
}

export default function SearchIsland({ locale, categories, talukas }: SearchIslandProps) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<LocationPreference | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const inputId = useId();
  const isMr = locale === 'mr';
  const dict = getDictionary(locale);

  const activeTaluka = useMemo(() => {
    if (!location) return null;
    return talukas.find((taluka) => (
      taluka.district_slug === location.districtSlug && taluka.slug === location.talukaSlug
    )) || null;
  }, [location, talukas]);

  useEffect(() => {
    const applyLocation = (candidate: LocationPreference | null) => {
      if (!candidate) {
        setLocation(null);
        return;
      }
      const isValid = talukas.some((taluka) => (
        taluka.district_slug === candidate.districtSlug && taluka.slug === candidate.talukaSlug
      ));
      setLocation(isValid ? candidate : null);
    };

    applyLocation(readLocationPreference());
    const onLocationChange = (event: Event) => {
      applyLocation((event as CustomEvent<LocationPreference>).detail || null);
      setSelectionError('');
    };
    window.addEventListener(LOCATION_PREFERENCE_EVENT, onLocationChange);
    return () => window.removeEventListener(LOCATION_PREFERENCE_EVENT, onLocationChange);
  }, [talukas]);

  const cleanQuery = query.toLowerCase().trim();
  const filteredCategories = cleanQuery
    ? categories.filter((cat) => {
        const aliases = cat.aliases || [];
        return cat.name_mr.toLowerCase().includes(cleanQuery)
          || cat.name_en.toLowerCase().includes(cleanQuery)
          || cat.slug.toLowerCase().includes(cleanQuery)
          || aliases.some((alias) => alias.toLowerCase().includes(cleanQuery) || cleanQuery.includes(alias.toLowerCase()));
      })
    : [];

  const locationName = activeTaluka
    ? `${isMr ? activeTaluka.name_mr : activeTaluka.name_en} (${isMr ? activeTaluka.district_name_mr : activeTaluka.district_name_en})`
    : '';

  const handleSelectCategory = (categorySlug: string) => {
    if (!activeTaluka) return;
    window.location.href = `/${locale}/${activeTaluka.district_slug}/${activeTaluka.slug}/${categorySlug}`;
  };

  const handleSearchSubmit = () => {
    if (!activeTaluka) {
      setSelectionError(isMr ? 'शोधण्यापूर्वी तुमचे ठिकाण निवडा.' : 'Choose your location before searching.');
      openLocationDialog();
      return;
    }
    if (filteredCategories.length > 0) {
      handleSelectCategory(filteredCategories[0].slug);
      return;
    }
    window.location.href = `/${locale}/${activeTaluka.district_slug}/${activeTaluka.slug}`;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="rounded-3xl border border-surface-border bg-white/95 p-3 shadow-lift dark:bg-ink-surface/95 sm:p-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-canvas/70 p-3 dark:bg-ink-canvas/30 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                {isMr ? 'तुमचे ठिकाण' : 'Your location'}
              </p>
              <p className="truncate text-sm font-bold text-ink-primary">
                {locationName || (isMr ? 'सेवा शोधण्यासाठी ठिकाण निवडा' : 'Choose a location to find services')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openLocationDialog}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-ink-surface dark:text-brand-300 dark:hover:bg-brand-950/40"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {activeTaluka ? dict.nav.changeLocation : dict.nav.chooseLocation}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex min-h-[54px] min-w-0 flex-1 items-center rounded-xl border border-surface-border bg-white dark:bg-ink-canvas/30">
            <Search className="ml-4 mr-2 h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <input
              id={inputId}
              type="search"
              role="combobox"
              aria-expanded={filteredCategories.length > 0}
              aria-controls="search-suggestions-list"
              aria-autocomplete="list"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={dict.home.searchPlaceholder}
              className="w-full bg-transparent py-3 pr-3 text-sm text-ink-primary placeholder-ink-muted outline-none sm:text-base"
            />
          </div>
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md active:bg-brand-800 sm:min-w-32"
          >
            <span>{dict.home.searchButton}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {selectionError && (
        <p role="status" aria-live="polite" className="mt-3 text-center text-xs font-medium text-rose-700 dark:text-rose-300">
          {selectionError}
        </p>
      )}

      {filteredCategories.length > 0 && activeTaluka && (
        <div id="search-suggestions-list" role="listbox" className="mt-3 overflow-hidden rounded-2xl border border-surface-border bg-white text-left shadow-lift dark:bg-ink-surface">
          <div className="border-b border-surface-border bg-surface-canvas/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {isMr ? 'उपलब्ध सेवा' : 'Matching Services'}
          </div>
          <div className="divide-y divide-surface-border">
            {filteredCategories.slice(0, 6).map((category) => (
              <button
                key={category.slug}
                role="option"
                aria-selected="false"
                type="button"
                onClick={() => handleSelectCategory(category.slug)}
                className="group flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-brand-50 dark:hover:bg-brand-950/40"
              >
                <div>
                  <div className="text-sm font-bold text-ink-primary transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400 sm:text-base">
                    {isMr ? category.name_mr : category.name_en}
                  </div>
                  <div className="mt-0.5 text-xs text-brand-700 dark:text-brand-400">{locationName}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-brand-600 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
