import React, { useState, useId } from 'react';
import { Search, MapPin, ArrowRight, ChevronDown } from 'lucide-react';
import { getDictionary, type Locale } from '../lib/i18n';

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
  defaultDistrictSlug?: string;
  defaultTalukaSlug?: string;
}

export default function SearchIsland({
  locale,
  categories,
  talukas,
  defaultDistrictSlug,
  defaultTalukaSlug,
}: SearchIslandProps) {
  const initialTaluka = defaultTalukaSlug
    ? (talukas.find((t) => t.slug === defaultTalukaSlug) || talukas[0])
    : talukas[0];

  const [query, setQuery] = useState('');
  const [selectedTalukaSlug, setSelectedTalukaSlug] = useState(initialTaluka?.slug || '');
  const inputId = useId();

  const isMr = locale === 'mr';
  const locationLabels = getDictionary(locale).locationDetection;

  const cleanQuery = query.toLowerCase().trim();
  const filteredCategories = cleanQuery
    ? categories.filter((cat) => {
        const nameMr = cat.name_mr.toLowerCase();
        const nameEn = cat.name_en.toLowerCase();
        const slug = cat.slug.toLowerCase();
        const aliases = cat.aliases || [];

        return (
          nameMr.includes(cleanQuery) ||
          nameEn.includes(cleanQuery) ||
          slug.includes(cleanQuery) ||
          aliases.some((a) => a.toLowerCase().includes(cleanQuery) || cleanQuery.includes(a.toLowerCase()))
        );
      })
    : [];

  const activeTaluka = talukas.find((t) => t.slug === selectedTalukaSlug) || talukas[0];

  const handleSelectCategory = (catSlug: string) => {
    if (!activeTaluka) return;
    window.location.href = `/${locale}/${activeTaluka.district_slug}/${activeTaluka.slug}/${catSlug}`;
  };

  const handleSearchSubmit = () => {
    if (filteredCategories.length > 0) {
      handleSelectCategory(filteredCategories[0].slug);
    } else if (activeTaluka) {
      window.location.href = `/${locale}/${activeTaluka.district_slug}/${activeTaluka.slug}`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Search Bar Container */}
      <div className="bg-white dark:bg-ink-surface rounded-2xl shadow-lift border border-surface-border p-2 sm:p-2.5 transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          
          {/* Taluka Selector Dropdown (Desktop: Left | Mobile: Top) */}
          <div className="relative flex items-center min-w-full sm:min-w-[190px] sm:max-w-[220px] border-b sm:border-b-0 sm:border-r border-surface-border pb-2 sm:pb-0 sm:pr-2">
            <MapPin className="w-4 h-4 text-brand-600 ml-2.5 mr-1 flex-shrink-0" />
            <select
              aria-label={isMr ? 'तालुका निवडा' : 'Select Taluka'}
              value={selectedTalukaSlug}
              onChange={(e) => setSelectedTalukaSlug(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm font-semibold text-ink-primary py-2.5 px-1 pr-6 focus:outline-none cursor-pointer truncate appearance-none"
            >
              {talukas.length === 0 ? (
                <option value="">{isMr ? 'तालुका उपलब्ध नाही' : 'No talukas available'}</option>
              ) : (
                talukas.map((t) => (
                  (() => {
                    const districtName = isMr ? t.district_name_mr : t.district_name_en;
                    const talukaName = isMr ? t.name_mr : t.name_en;
                    return (
                      <option
                        key={t.slug}
                        value={t.slug}
                        className="bg-white dark:bg-ink-surface text-ink-primary font-medium"
                      >
                        {districtName ? `${talukaName} (${districtName})` : talukaName}
                      </option>
                    );
                  })()
                ))
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-ink-muted absolute right-3 pointer-events-none" />
          </div>

          {/* Service Search Input (Desktop: Middle | Mobile: Middle) */}
          <div className="relative flex-1 flex items-center min-h-[44px]">
            <Search className="w-5 h-5 text-ink-muted ml-2 mr-2 flex-shrink-0" />
            <input
              id={inputId}
              type="search"
              role="combobox"
              aria-expanded={filteredCategories.length > 0}
              aria-controls="search-suggestions-list"
              aria-autocomplete="list"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isMr
                  ? 'काय सेवा पाहिजे? (उदा. प्लंबर, वायरमन...)'
                  : 'What service do you need? (e.g. Plumber, Electrician...)'
              }
              className="w-full bg-transparent text-sm sm:text-base text-ink-primary placeholder-ink-muted py-2 pr-2 focus:outline-none"
            />
          </div>

          {/* Search Button (Desktop: Right | Mobile: Bottom Full Width) */}
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-sm sm:text-base px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md flex-shrink-0"
          >
            <span>{isMr ? 'शोधा' : 'Search'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => (document.getElementById('location-dialog') as HTMLDialogElement | null)?.showModal()}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-950 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{locationLabels.useMyLocation}</span>
      </button>

      {/* Instant Suggestions Dropdown */}
      {filteredCategories.length > 0 && activeTaluka && (
        <div
          id="search-suggestions-list"
          role="listbox"
          className="mt-2 bg-white dark:bg-ink-surface rounded-2xl shadow-lift border border-surface-border overflow-hidden z-30 transition-all text-left"
        >
          <div className="px-4 py-2.5 bg-surface-canvas/60 border-b border-surface-border text-xs font-semibold text-ink-muted uppercase tracking-wider">
            {isMr ? 'उपलब्ध सेवा' : 'Matching Services'}
          </div>
          <div className="divide-y divide-surface-border">
            {filteredCategories.slice(0, 6).map((cat) => (
              <button
                key={cat.slug}
                role="option"
                aria-selected="false"
                type="button"
                onClick={() => handleSelectCategory(cat.slug)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors group"
              >
                <div>
                  <div className="font-bold text-sm sm:text-base text-ink-primary group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {isMr ? cat.name_mr : cat.name_en}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    <span className="text-brand-700 dark:text-brand-400 font-medium">
                      {isMr ? activeTaluka.name_mr : activeTaluka.name_en}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-brand-600 group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
