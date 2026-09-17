import { describe, it, expect } from 'vitest';
import { getDictionary } from '../../src/lib/i18n';
import { getDataRepository } from '../../src/lib/repositories/dataRepository';

describe('Homepage Polish & Localization Tests', () => {
  it('provides 100% natural Marathi public copy for /mr route without English residue', () => {
    const dict = getDictionary('mr');

    // Brand and Navigation
    expect(dict.brand.name).toBe('Aheka');
    expect(dict.brand.devanagariName).toBe('आहे का?');
    expect(dict.brand.tagline).toBe('स्थानिक सेवा शोध');
    expect(dict.nav.join).toBe('Aheka वर सेवा नोंदवा');
    expect(dict.nav.vendorLogin).toBe('सेवा प्रदाता लॉगिन');

    // Hero Section
    expect(dict.home.badge).toBe('महाराष्ट्रासाठी स्थानिक सेवा शोध');
    expect(dict.home.heroHeading).toBe('कामासाठी योग्य माणूस शोधा.');
    expect(dict.home.heroSubheading).toBe('तुमच्या तालुक्यातील स्थानिक सेवा देणाऱ्यांशी थेट संपर्क करा.');

    // Search Controls & Pills
    expect(dict.home.searchPlaceholder).toBe('काय सेवा पाहिजे?');
    expect(dict.home.searchButton).toBe('शोधा');
    expect(dict.home.locationLabel).toBe('तालुका निवडा');
    expect(dict.home.popularTalukas).toBe('लोकप्रिय तालुके');

    // Categories Section
    expect(dict.home.popularServices).toBe('लोकप्रिय सेवा');
    expect(dict.home.viewAllServices).toBe('सर्व सेवा प्रकार पहा');

    // How It Works Steps
    expect(dict.home.howItWorksTitle).toBe('Aheka कसे कार्य करते?');
    expect(dict.home.step1Title).toBe('१. तालुका निवडा');
    expect(dict.home.step2Title).toBe('२. हवी असलेली सेवा निवडा');
    expect(dict.home.step3Title).toBe('३. थेट कॉल किंवा व्हॉट्सॲप करा');

    // Provider Onboarding Section
    expect(dict.home.joinSectionBadge).toBe('स्थानिक कारागीर व व्यावसायिकांसाठी');
    expect(dict.home.joinSectionTitle).toBe('तुम्ही स्थानिक सेवा प्रदाता आहात का?');
    expect(dict.home.joinCtaButton).toBe('Aheka वर सेवा नोंदवा');
  });

  it('provides polished English copy for /en route', () => {
    const dict = getDictionary('en');

    // Brand and Navigation
    expect(dict.brand.tagline).toBe('Local service search');
    expect(dict.nav.join).toBe('List Your Service');
    expect(dict.nav.vendorLogin).toBe('Vendor Login');

    // Hero Section
    expect(dict.home.badge).toBe('Hyperlocal service search for Maharashtra');
    expect(dict.home.heroHeading).toBe('Find trusted local service providers near you.');
    expect(dict.home.heroSubheading).toBe('Search by taluka and contact local professionals directly by call or WhatsApp.');

    // Search Controls & Pills
    expect(dict.home.searchPlaceholder).toBe('What service do you need?');
    expect(dict.home.searchButton).toBe('Search');
    expect(dict.home.locationLabel).toBe('Select Taluka');
    expect(dict.home.popularTalukas).toBe('Popular Talukas');

    // Provider CTA
    expect(dict.home.joinCtaButton).toBe('List Your Service');
  });

  it('strictly scopes popular talukas to the default district (Ahilyanagar) without cross-district mixing or demo labels', async () => {
    const repo = getDataRepository();
    const districts = await repo.getDistricts();
    const talukas = await repo.getTalukas();

    const ahilyanagar = districts.find(d => d.slug === 'ahilyanagar');
    expect(ahilyanagar).toBeDefined();

    const districtTalukas = talukas.filter(t => t.district_id === ahilyanagar?.id);
    const talukaSlugs = districtTalukas.map(t => t.slug);

    // Ahilyanagar should have Sangamner and Akole
    expect(talukaSlugs).toContain('sangamner');
    expect(talukaSlugs).toContain('akole');

    // Pune talukas should NOT be included in Ahilyanagar
    expect(talukaSlugs).not.toContain('haveli');
    expect(talukaSlugs).not.toContain('baramati');

    // Ensure no demo string "Mansion" exists in any taluka name
    const allTalukaNames = talukas.flatMap(t => [t.name_en, t.name_mr]);
    expect(allTalukaNames).not.toContain('Mansion');
  });

  it('has valid category data with icons and bilingual names from admin repository', async () => {
    const repo = getDataRepository();
    const categories = await repo.getCategories();

    expect(categories.length).toBeGreaterThanOrEqual(4);
    const slugs = categories.map(c => c.slug);
    expect(slugs).toContain('electrician');
    expect(slugs).toContain('plumber');
    expect(slugs).toContain('carpenter');
    expect(slugs).toContain('painter');

    // Every category must have an icon_key and localized Marathi name
    for (const cat of categories) {
      expect(cat.icon_key).toBeTruthy();
      expect(cat.name_mr).toBeTruthy();
      expect(cat.name_en).toBeTruthy();
    }
  });

  it('provides polished, localized footer copy without Maha-Local wording or vendor links', () => {
    const mrDict = getDictionary('mr');
    const enDict = getDictionary('en');

    // Marathi Footer
    expect(mrDict.footer.aboutText).toBe('तुमच्या तालुक्यातील स्थानिक सेवा देणारे सहज शोधा आणि त्यांच्याशी थेट संपर्क करा.');
    expect(mrDict.footer.connectingText).toBe('लोकांना स्थानिक सेवा देणाऱ्यांशी थेट जोडणारे व्यासपीठ.');
    expect(mrDict.footer.madeForMaharashtra).toBe('महाराष्ट्रासाठी');
    expect(mrDict.footer.popularServices).toBe('लोकप्रिय सेवा');
    expect(mrDict.footer.keyTalukas).toBe('प्रमुख तालुके');

    // English Footer
    expect(enDict.footer.aboutText).toBe("Aheka helps you find and contact local service providers across Maharashtra's towns and talukas.");
    expect(enDict.footer.connectingText).toBe('Connecting people directly with local service providers.');
    expect(enDict.footer.madeForMaharashtra).toBe('Made for Maharashtra');
    expect(enDict.footer.popularServices).toBe('Popular Services');
    expect(enDict.footer.keyTalukas).toBe('Key Talukas');
  });
});
