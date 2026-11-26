/**
 * Real geographic coordinates (latitude, longitude) for countries and major cities,
 * plus ISO-3166 numeric-to-alpha2 mapping for TopoJSON 2D world map rendering.
 */

export interface CountryGeo {
  code: string;
  name: string;
  flag: string;
  lat: number;
  lng: number;
}

export interface ResolvedLocation {
  lat: number;
  lng: number;
  code: string;
  flag: string;
  countryName: string;
  exactCity: boolean;
}

/** Lazy-loaded 40,000-city GeoNames gazetteer keyed by `CITY_UPPER|ISO2`. */
type CityGazetteerMap = Record<string, [number, number]>;
let cityGazetteer: CityGazetteerMap | null = null;
let cityGazetteerPromise: Promise<CityGazetteerMap | null> | null = null;
const gazetteerListeners = new Set<() => void>();

export function loadCityGazetteer(): Promise<CityGazetteerMap | null> {
  if (cityGazetteer) return Promise.resolve(cityGazetteer);
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!cityGazetteerPromise) {
    cityGazetteerPromise = fetch("/data/cities-geo.json")
      .then((res) => (res.ok ? (res.json() as Promise<CityGazetteerMap>) : null))
      .then((data) => {
        if (data) {
          cityGazetteer = data;
          gazetteerListeners.forEach((fn) => fn());
        }
        return data;
      })
      .catch(() => null);
  }
  return cityGazetteerPromise;
}

export function subscribeCityGazetteer(listener: () => void): () => void {
  gazetteerListeners.add(listener);
  return () => gazetteerListeners.delete(listener);
}

export function isCityGazetteerLoaded(): boolean {
  return cityGazetteer !== null;
}

export interface LocalityGeo {
  name: string;
  metro: string;
  cc: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

let localitiesCache: LocalityGeo[] | null = null;
let localitiesPromise: Promise<LocalityGeo[]> | null = null;

export function loadLocalitiesGeo(): Promise<LocalityGeo[]> {
  if (localitiesCache) return Promise.resolve(localitiesCache);
  if (typeof window === "undefined") return Promise.resolve([]);
  if (!localitiesPromise) {
    localitiesPromise = fetch("/data/localities-geo.json")
      .then((res) => (res.ok ? (res.json() as Promise<LocalityGeo[]>) : []))
      .then((list) => {
        localitiesCache = Array.isArray(list) ? list : [];
        return localitiesCache;
      })
      .catch(() => []);
  }
  return localitiesPromise;
}

/** Haversine distance in kilometers between two lat/lng points. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COUNTRY_LIST: Array<CountryGeo & { alpha3: string; numeric: string; aliases?: string[] }> = [
  { code: "US", alpha3: "USA", numeric: "840", name: "United States", flag: "🇺🇸", lat: 39.8, lng: -98.5, aliases: ["UNITED STATES OF AMERICA", "USA"] },
  { code: "IN", alpha3: "IND", numeric: "356", name: "India", flag: "🇮🇳", lat: 21.1, lng: 78.9 },
  { code: "GB", alpha3: "GBR", numeric: "826", name: "United Kingdom", flag: "🇬🇧", lat: 54.0, lng: -2.5, aliases: ["UK", "GREAT BRITAIN", "ENGLAND"] },
  { code: "CA", alpha3: "CAN", numeric: "124", name: "Canada", flag: "🇨🇦", lat: 56.1, lng: -106.3 },
  { code: "DE", alpha3: "DEU", numeric: "276", name: "Germany", flag: "🇩🇪", lat: 51.2, lng: 10.4 },
  { code: "FR", alpha3: "FRA", numeric: "250", name: "France", flag: "🇫🇷", lat: 46.2, lng: 2.2 },
  { code: "AU", alpha3: "AUS", numeric: "036", name: "Australia", flag: "🇦🇺", lat: -25.3, lng: 133.8 },
  { code: "JP", alpha3: "JPN", numeric: "392", name: "Japan", flag: "🇯🇵", lat: 36.2, lng: 138.3 },
  { code: "SG", alpha3: "SGP", numeric: "702", name: "Singapore", flag: "🇸🇬", lat: 1.35, lng: 103.82 },
  { code: "AE", alpha3: "ARE", numeric: "784", name: "United Arab Emirates", flag: "🇦🇪", lat: 24.3, lng: 54.4, aliases: ["UAE"] },
  { code: "BR", alpha3: "BRA", numeric: "076", name: "Brazil", flag: "🇧🇷", lat: -14.2, lng: -51.9 },
  { code: "MX", alpha3: "MEX", numeric: "484", name: "Mexico", flag: "🇲🇽", lat: 23.6, lng: -102.5 },
  { code: "NL", alpha3: "NLD", numeric: "528", name: "Netherlands", flag: "🇳🇱", lat: 52.1, lng: 5.3 },
  { code: "IT", alpha3: "ITA", numeric: "380", name: "Italy", flag: "🇮🇹", lat: 41.9, lng: 12.6 },
  { code: "ES", alpha3: "ESP", numeric: "724", name: "Spain", flag: "🇪🇸", lat: 40.5, lng: -3.7 },
  { code: "CN", alpha3: "CHN", numeric: "156", name: "China", flag: "🇨🇳", lat: 35.9, lng: 104.2 },
  { code: "KR", alpha3: "KOR", numeric: "410", name: "South Korea", flag: "🇰🇷", lat: 35.9, lng: 127.8, aliases: ["KOREA, REPUBLIC OF", "REPUBLIC OF KOREA"] },
  { code: "ID", alpha3: "IDN", numeric: "360", name: "Indonesia", flag: "🇮🇩", lat: -2.5, lng: 118.0 },
  { code: "RU", alpha3: "RUS", numeric: "643", name: "Russia", flag: "🇷🇺", lat: 61.5, lng: 95.3, aliases: ["RUSSIAN FEDERATION"] },
  { code: "ZA", alpha3: "ZAF", numeric: "710", name: "South Africa", flag: "🇿🇦", lat: -30.6, lng: 22.9 },
  { code: "NG", alpha3: "NGA", numeric: "566", name: "Nigeria", flag: "🇳🇬", lat: 9.1, lng: 8.7 },
  { code: "SE", alpha3: "SWE", numeric: "752", name: "Sweden", flag: "🇸🇪", lat: 60.1, lng: 18.6 },
  { code: "CH", alpha3: "CHE", numeric: "756", name: "Switzerland", flag: "🇨🇭", lat: 46.8, lng: 8.2 },
  { code: "PL", alpha3: "POL", numeric: "616", name: "Poland", flag: "🇵🇱", lat: 51.9, lng: 19.1 },
  { code: "TR", alpha3: "TUR", numeric: "792", name: "Türkiye", flag: "🇹🇷", lat: 39.0, lng: 35.2, aliases: ["TURKEY"] },
  { code: "TH", alpha3: "THA", numeric: "764", name: "Thailand", flag: "🇹🇭", lat: 15.9, lng: 100.9 },
  { code: "VN", alpha3: "VNM", numeric: "704", name: "Vietnam", flag: "🇻🇳", lat: 14.1, lng: 108.3, aliases: ["VIET NAM"] },
  { code: "PH", alpha3: "PHL", numeric: "608", name: "Philippines", flag: "🇵🇭", lat: 12.9, lng: 121.8 },
  { code: "PK", alpha3: "PAK", numeric: "586", name: "Pakistan", flag: "🇵🇰", lat: 30.4, lng: 69.3 },
  { code: "BD", alpha3: "BGD", numeric: "050", name: "Bangladesh", flag: "🇧🇩", lat: 23.7, lng: 90.4 },
  { code: "AR", alpha3: "ARG", numeric: "032", name: "Argentina", flag: "🇦🇷", lat: -38.4, lng: -63.6 },
  { code: "CL", alpha3: "CHL", numeric: "152", name: "Chile", flag: "🇨🇱", lat: -35.7, lng: -71.5 },
  { code: "CO", alpha3: "COL", numeric: "170", name: "Colombia", flag: "🇨🇴", lat: 4.6, lng: -74.3 },
  { code: "IE", alpha3: "IRL", numeric: "372", name: "Ireland", flag: "🇮🇪", lat: 53.4, lng: -8.2 },
  { code: "NZ", alpha3: "NZL", numeric: "554", name: "New Zealand", flag: "🇳🇿", lat: -40.9, lng: 174.9 },
  { code: "BE", alpha3: "BEL", numeric: "056", name: "Belgium", flag: "🇧🇪", lat: 50.5, lng: 4.5 },
  { code: "AT", alpha3: "AUT", numeric: "040", name: "Austria", flag: "🇦🇹", lat: 47.5, lng: 14.6 },
  { code: "DK", alpha3: "DNK", numeric: "208", name: "Denmark", flag: "🇩🇰", lat: 56.3, lng: 9.5 },
  { code: "NO", alpha3: "NOR", numeric: "578", name: "Norway", flag: "🇳🇴", lat: 60.5, lng: 8.5 },
  { code: "FI", alpha3: "FIN", numeric: "246", name: "Finland", flag: "🇫🇮", lat: 61.9, lng: 25.7 },
  { code: "PT", alpha3: "PRT", numeric: "620", name: "Portugal", flag: "🇵🇹", lat: 39.4, lng: -8.2 },
  { code: "CZ", alpha3: "CZE", numeric: "203", name: "Czechia", flag: "🇨🇿", lat: 49.8, lng: 15.5, aliases: ["CZECH REPUBLIC"] },
  { code: "GR", alpha3: "GRC", numeric: "300", name: "Greece", flag: "🇬🇷", lat: 39.1, lng: 21.8 },
  { code: "RO", alpha3: "ROU", numeric: "642", name: "Romania", flag: "🇷🇴", lat: 45.9, lng: 24.9 },
  { code: "HU", alpha3: "HUN", numeric: "348", name: "Hungary", flag: "🇭🇺", lat: 47.2, lng: 19.5 },
  { code: "UA", alpha3: "UKR", numeric: "804", name: "Ukraine", flag: "🇺🇦", lat: 48.4, lng: 31.2 },
  { code: "IL", alpha3: "ISR", numeric: "376", name: "Israel", flag: "🇮🇱", lat: 31.0, lng: 34.9 },
  { code: "SA", alpha3: "SAU", numeric: "682", name: "Saudi Arabia", flag: "🇸🇦", lat: 23.9, lng: 45.1 },
  { code: "QA", alpha3: "QAT", numeric: "634", name: "Qatar", flag: "🇶🇦", lat: 25.4, lng: 51.2 },
  { code: "KW", alpha3: "KWT", numeric: "414", name: "Kuwait", flag: "🇰🇼", lat: 29.3, lng: 47.5 },
  { code: "OM", alpha3: "OMN", numeric: "512", name: "Oman", flag: "🇴🇲", lat: 21.5, lng: 55.9 },
  { code: "EG", alpha3: "EGY", numeric: "818", name: "Egypt", flag: "🇪🇬", lat: 26.8, lng: 30.8 },
  { code: "MA", alpha3: "MAR", numeric: "504", name: "Morocco", flag: "🇲🇦", lat: 31.8, lng: -7.1 },
  { code: "KE", alpha3: "KEN", numeric: "404", name: "Kenya", flag: "🇰🇪", lat: -0.02, lng: 37.9 },
  { code: "GH", alpha3: "GHA", numeric: "288", name: "Ghana", flag: "🇬🇭", lat: 7.9, lng: -1.0 },
  { code: "TW", alpha3: "TWN", numeric: "158", name: "Taiwan", flag: "🇹🇼", lat: 23.7, lng: 121.0 },
  { code: "HK", alpha3: "HKG", numeric: "344", name: "Hong Kong", flag: "🇭🇰", lat: 22.3, lng: 114.2 },
  { code: "MY", alpha3: "MYS", numeric: "458", name: "Malaysia", flag: "🇲🇾", lat: 4.2, lng: 101.9 },
  { code: "LK", alpha3: "LKA", numeric: "144", name: "Sri Lanka", flag: "🇱🇰", lat: 7.9, lng: 80.8 },
  { code: "NP", alpha3: "NPL", numeric: "524", name: "Nepal", flag: "🇳🇵", lat: 28.4, lng: 84.1 },
  { code: "PE", alpha3: "PER", numeric: "604", name: "Peru", flag: "🇵🇪", lat: -9.2, lng: -75.0 },
  { code: "EC", alpha3: "ECU", numeric: "218", name: "Ecuador", flag: "🇪🇨", lat: -1.8, lng: -78.2 },
  { code: "UY", alpha3: "URY", numeric: "858", name: "Uruguay", flag: "🇺🇾", lat: -32.5, lng: -55.8 },
  { code: "CR", alpha3: "CRI", numeric: "188", name: "Costa Rica", flag: "🇨🇷", lat: 9.7, lng: -83.8 },
  { code: "PA", alpha3: "PAN", numeric: "591", name: "Panama", flag: "🇵🇦", lat: 8.5, lng: -80.8 },
  { code: "VE", alpha3: "VEN", numeric: "862", name: "Venezuela", flag: "🇻🇪", lat: 6.4, lng: -66.6 },
  { code: "BG", alpha3: "BGR", numeric: "100", name: "Bulgaria", flag: "🇧🇬", lat: 42.7, lng: 25.5 },
  { code: "HR", alpha3: "HRV", numeric: "191", name: "Croatia", flag: "🇭🇷", lat: 45.1, lng: 15.2 },
  { code: "SK", alpha3: "SVK", numeric: "703", name: "Slovakia", flag: "🇸🇰", lat: 48.7, lng: 19.7 },
  { code: "RS", alpha3: "SRB", numeric: "688", name: "Serbia", flag: "🇷🇸", lat: 44.0, lng: 21.0 },
  { code: "LT", alpha3: "LTU", numeric: "440", name: "Lithuania", flag: "🇱🇹", lat: 55.2, lng: 23.9 },
  { code: "LV", alpha3: "LVA", numeric: "428", name: "Latvia", flag: "🇱🇻", lat: 56.9, lng: 24.6 },
  { code: "EE", alpha3: "EST", numeric: "233", name: "Estonia", flag: "🇪🇪", lat: 58.6, lng: 25.0 },
  { code: "LU", alpha3: "LUX", numeric: "442", name: "Luxembourg", flag: "🇱🇺", lat: 49.8, lng: 6.1 },
  { code: "IS", alpha3: "ISL", numeric: "352", name: "Iceland", flag: "🇮🇸", lat: 64.9, lng: -19.0 },
  { code: "KZ", alpha3: "KAZ", numeric: "398", name: "Kazakhstan", flag: "🇰🇿", lat: 48.0, lng: 66.9 },
  { code: "UZ", alpha3: "UZB", numeric: "860", name: "Uzbekistan", flag: "🇺🇿", lat: 41.4, lng: 64.6 },
  { code: "IR", alpha3: "IRN", numeric: "364", name: "Iran", flag: "🇮🇷", lat: 32.4, lng: 53.7 },
  { code: "IQ", alpha3: "IRQ", numeric: "368", name: "Iraq", flag: "🇮🇶", lat: 33.2, lng: 43.7 },
  { code: "JO", alpha3: "JOR", numeric: "400", name: "Jordan", flag: "🇯🇴", lat: 30.6, lng: 36.2 },
  { code: "LB", alpha3: "LBN", numeric: "422", name: "Lebanon", flag: "🇱🇧", lat: 33.9, lng: 35.9 },
  { code: "ET", alpha3: "ETH", numeric: "231", name: "Ethiopia", flag: "🇪🇹", lat: 9.1, lng: 40.5 },
  { code: "TZ", alpha3: "TZA", numeric: "834", name: "Tanzania", flag: "🇹🇿", lat: -6.4, lng: 34.9 },
  { code: "DZ", alpha3: "DZA", numeric: "012", name: "Algeria", flag: "🇩🇿", lat: 28.0, lng: 1.7 },
  { code: "TN", alpha3: "TUN", numeric: "788", name: "Tunisia", flag: "🇹🇳", lat: 33.9, lng: 9.5 },
  { code: "MM", alpha3: "MMR", numeric: "104", name: "Myanmar", flag: "🇲🇲", lat: 21.9, lng: 95.9 },
  { code: "KH", alpha3: "KHM", numeric: "116", name: "Cambodia", flag: "🇰🇭", lat: 12.6, lng: 105.0 },
];

const COUNTRY_LOOKUP = new Map<string, CountryGeo>();
export const ISO_NUMERIC_TO_CODE = new Map<string, string>();

for (const entry of COUNTRY_LIST) {
  const geo: CountryGeo = {
    code: entry.code,
    name: entry.name,
    flag: entry.flag,
    lat: entry.lat,
    lng: entry.lng,
  };
  COUNTRY_LOOKUP.set(entry.code.toUpperCase(), geo);
  COUNTRY_LOOKUP.set(entry.alpha3.toUpperCase(), geo);
  COUNTRY_LOOKUP.set(entry.name.toUpperCase(), geo);
  ISO_NUMERIC_TO_CODE.set(entry.numeric, entry.code);
  ISO_NUMERIC_TO_CODE.set(String(Number(entry.numeric)), entry.code);
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      COUNTRY_LOOKUP.set(alias.toUpperCase(), geo);
    }
  }
}

/** Major global cities and common GA4 metro/network hubs (lat, lng). */
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // United States
  "NEW YORK": { lat: 40.71, lng: -74.01 },
  "LOS ANGELES": { lat: 34.05, lng: -118.24 },
  "CHICAGO": { lat: 41.88, lng: -87.63 },
  "HOUSTON": { lat: 29.76, lng: -95.37 },
  "PHOENIX": { lat: 33.45, lng: -112.07 },
  "PHILADELPHIA": { lat: 39.95, lng: -75.17 },
  "SAN ANTONIO": { lat: 29.42, lng: -98.49 },
  "SAN DIEGO": { lat: 32.72, lng: -117.16 },
  "DALLAS": { lat: 32.78, lng: -96.8 },
  "SAN JOSE": { lat: 37.34, lng: -121.89 },
  "SAN FRANCISCO": { lat: 37.77, lng: -122.42 },
  "AUSTIN": { lat: 30.27, lng: -97.74 },
  "SEATTLE": { lat: 47.61, lng: -122.33 },
  "DENVER": { lat: 39.74, lng: -104.99 },
  "BOSTON": { lat: 42.36, lng: -71.06 },
  "MIAMI": { lat: 25.76, lng: -80.19 },
  "ATLANTA": { lat: 33.75, lng: -84.39 },
  "DETROIT": { lat: 42.33, lng: -83.05 },
  "MINNEAPOLIS": { lat: 44.98, lng: -93.27 },
  "PORTLAND": { lat: 45.52, lng: -122.68 },
  "LAS VEGAS": { lat: 36.17, lng: -115.14 },
  "CHARLOTTE": { lat: 35.23, lng: -80.84 },
  "COLUMBUS": { lat: 39.96, lng: -83.0 },
  "ASHBURN": { lat: 39.04, lng: -77.49 },
  "DES MOINES": { lat: 41.59, lng: -93.62 },
  "BOARDMAN": { lat: 45.84, lng: -119.7 },
  "CHEYENNE": { lat: 41.14, lng: -104.82 },
  "FLINT HILL": { lat: 38.76, lng: -78.1 },
  "COUNCIL BLUFFS": { lat: 41.26, lng: -95.86 },
  "BOYDTON": { lat: 36.67, lng: -78.39 },
  "QUINCY": { lat: 47.23, lng: -119.85 },
  "THE DALLES": { lat: 45.59, lng: -121.18 },
  "MOUNTAIN VIEW": { lat: 37.39, lng: -122.08 },
  "SANTA CLARA": { lat: 37.35, lng: -121.95 },
  "LENOIR": { lat: 35.91, lng: -81.54 },
  "FOREST CITY": { lat: 35.33, lng: -81.87 },
  "PRYOR": { lat: 36.31, lng: -95.32 },
  "COFFEYVILLE": { lat: 37.04, lng: -95.62 },
  "WASHINGTON": { lat: 38.91, lng: -77.04 },
  "ORLANDO": { lat: 28.54, lng: -81.38 },
  "TAMPA": { lat: 27.95, lng: -82.46 },
  "SALT LAKE CITY": { lat: 40.76, lng: -111.89 },
  "RALEIGH": { lat: 35.78, lng: -78.64 },
  "NASHVILLE": { lat: 36.16, lng: -86.78 },
  // India
  "MUMBAI": { lat: 19.08, lng: 72.88 },
  "DELHI": { lat: 28.61, lng: 77.21 },
  "NEW DELHI": { lat: 28.61, lng: 77.21 },
  "BENGALURU": { lat: 12.97, lng: 77.59 },
  "BANGALORE": { lat: 12.97, lng: 77.59 },
  "HYDERABAD": { lat: 17.39, lng: 78.49 },
  "CHENNAI": { lat: 13.08, lng: 80.27 },
  "PUNE": { lat: 18.52, lng: 73.86 },
  "KOLKATA": { lat: 22.57, lng: 88.36 },
  "AHMEDABAD": { lat: 23.02, lng: 72.57 },
  "JAIPUR": { lat: 26.91, lng: 75.79 },
  "SURAT": { lat: 21.17, lng: 72.83 },
  "GURUGRAM": { lat: 28.46, lng: 77.03 },
  "GURGAON": { lat: 28.46, lng: 77.03 },
  "NOIDA": { lat: 28.54, lng: 77.39 },
  "THANE": { lat: 19.22, lng: 72.98 },
  "KOCHI": { lat: 9.93, lng: 76.27 },
  "CHANDIGARH": { lat: 30.73, lng: 76.78 },
  "INDORE": { lat: 22.72, lng: 75.86 },
  "LUCKNOW": { lat: 26.85, lng: 80.95 },
  "NAGPUR": { lat: 21.15, lng: 79.09 },
  "VADODARA": { lat: 22.31, lng: 73.18 },
  "COIMBATORE": { lat: 11.02, lng: 76.96 },
  "NASHIK": { lat: 19.99, lng: 73.79 },
  // Europe
  "LONDON": { lat: 51.51, lng: -0.13 },
  "MANCHESTER": { lat: 53.48, lng: -2.24 },
  "BIRMINGHAM": { lat: 52.49, lng: -1.89 },
  "EDINBURGH": { lat: 55.95, lng: -3.19 },
  "PARIS": { lat: 48.86, lng: 2.35 },
  "LYON": { lat: 45.76, lng: 4.84 },
  "MARSEILLE": { lat: 43.3, lng: 5.37 },
  "BERLIN": { lat: 52.52, lng: 13.4 },
  "FRANKFURT": { lat: 50.11, lng: 8.68 },
  "MUNICH": { lat: 48.14, lng: 11.58 },
  "HAMBURG": { lat: 53.55, lng: 9.99 },
  "AMSTERDAM": { lat: 52.37, lng: 4.9 },
  "ROTTERDAM": { lat: 51.92, lng: 4.48 },
  "DUBLIN": { lat: 53.35, lng: -6.26 },
  "MADRID": { lat: 40.42, lng: -3.7 },
  "BARCELONA": { lat: 41.39, lng: 2.17 },
  "ROME": { lat: 41.9, lng: 12.5 },
  "MILAN": { lat: 45.46, lng: 9.19 },
  "ZURICH": { lat: 47.37, lng: 8.54 },
  "GENEVA": { lat: 46.2, lng: 6.14 },
  "STOCKHOLM": { lat: 59.33, lng: 18.07 },
  "OSLO": { lat: 59.91, lng: 10.75 },
  "COPENHAGEN": { lat: 55.68, lng: 12.57 },
  "HELSINKI": { lat: 60.17, lng: 24.94 },
  "WARSAW": { lat: 52.23, lng: 21.01 },
  "PRAGUE": { lat: 50.08, lng: 14.44 },
  "VIENNA": { lat: 48.21, lng: 16.37 },
  "BRUSSELS": { lat: 50.85, lng: 4.35 },
  "LISBON": { lat: 38.72, lng: -9.14 },
  "ATHENS": { lat: 37.98, lng: 23.73 },
  "ISTANBUL": { lat: 41.01, lng: 28.98 },
  "BUDAPEST": { lat: 47.5, lng: 19.04 },
  "BUCHAREST": { lat: 44.43, lng: 26.1 },
  "KYIV": { lat: 50.45, lng: 30.52 },
  // Middle East & Africa
  "DUBAI": { lat: 25.2, lng: 55.27 },
  "ABU DHABI": { lat: 24.45, lng: 54.38 },
  "RIYADH": { lat: 24.71, lng: 46.68 },
  "DOHA": { lat: 25.29, lng: 51.53 },
  "TEL AVIV": { lat: 32.09, lng: 34.78 },
  "CAIRO": { lat: 30.04, lng: 31.24 },
  "LAGOS": { lat: 6.52, lng: 3.38 },
  "NAIROBI": { lat: -1.29, lng: 36.82 },
  "JOHANNESBURG": { lat: -26.2, lng: 28.05 },
  "CAPE TOWN": { lat: -33.92, lng: 18.42 },
  "CASABLANCA": { lat: 33.57, lng: -7.59 },
  // APAC & Oceania
  "SINGAPORE": { lat: 1.35, lng: 103.82 },
  "TOKYO": { lat: 35.68, lng: 139.65 },
  "OSAKA": { lat: 34.69, lng: 135.5 },
  "SEOUL": { lat: 37.57, lng: 126.98 },
  "HONG KONG": { lat: 22.32, lng: 114.17 },
  "TAIPEI": { lat: 25.03, lng: 121.57 },
  "SHANGHAI": { lat: 31.23, lng: 121.47 },
  "BEIJING": { lat: 39.9, lng: 116.41 },
  "SHENZHEN": { lat: 22.54, lng: 114.06 },
  "BANGKOK": { lat: 13.76, lng: 100.5 },
  "JAKARTA": { lat: -6.21, lng: 106.85 },
  "MANILA": { lat: 14.6, lng: 120.98 },
  "KUALA LUMPUR": { lat: 3.14, lng: 101.69 },
  "HO CHI MINH CITY": { lat: 10.82, lng: 106.63 },
  "HANOI": { lat: 21.03, lng: 105.85 },
  "SYDNEY": { lat: -33.87, lng: 151.21 },
  "MELBOURNE": { lat: -37.81, lng: 144.96 },
  "BRISBANE": { lat: -27.47, lng: 153.03 },
  "PERTH": { lat: -31.95, lng: 115.86 },
  "AUCKLAND": { lat: -36.85, lng: 174.76 },
  "KARACHI": { lat: 24.86, lng: 67.01 },
  "LAHORE": { lat: 31.52, lng: 74.36 },
  "DHAKA": { lat: 23.81, lng: 90.41 },
  "COLOMBO": { lat: 6.93, lng: 79.86 },
  "KATHMANDU": { lat: 27.72, lng: 85.32 },
  // Americas (Non-US)
  "TORONTO": { lat: 43.65, lng: -79.38 },
  "VANCOUVER": { lat: 49.28, lng: -123.12 },
  "MONTREAL": { lat: 45.5, lng: -73.57 },
  "CALGARY": { lat: 51.05, lng: -114.07 },
  "MEXICO CITY": { lat: 19.43, lng: -99.13 },
  "MONTERREY": { lat: 25.69, lng: -100.32 },
  "GUADALAJARA": { lat: 20.66, lng: -103.35 },
  "SAO PAULO": { lat: -23.55, lng: -46.63 },
  "SÃO PAULO": { lat: -23.55, lng: -46.63 },
  "RIO DE JANEIRO": { lat: -22.91, lng: -43.17 },
  "BUENOS AIRES": { lat: -34.6, lng: -58.38 },
  "BOGOTA": { lat: 4.71, lng: -74.07 },
  "BOGOTÁ": { lat: 4.71, lng: -74.07 },
  "SANTIAGO": { lat: -33.45, lng: -70.67 },
  "LIMA": { lat: -12.05, lng: -77.04 },
};

/** Deterministic offset in [-1, 1] from string hash so unknown cities in the same country do not stack on one pixel. */
function stableHashOffset(seed: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 1000) / 500 - 1;
  const b = (((h >>> 10) ^ h) >>> 0) % 1000 / 500 - 1;
  return [a, b];
}

export function resolveCountryGeo(rawCountry: string | null | undefined): CountryGeo | null {
  if (!rawCountry) return null;
  const normalized = rawCountry.trim().toUpperCase();
  if (!normalized || normalized === "(NOT SET)" || normalized === "UNKNOWN") return null;
  return COUNTRY_LOOKUP.get(normalized) ?? null;
}

export function resolveCityGeo(city: string, country: string): ResolvedLocation | null {
  const cleanCity = city.trim().toUpperCase();
  const countryGeo = resolveCountryGeo(country);
  const code = countryGeo?.code ?? country.trim().slice(0, 2).toUpperCase();

  // 1. Check the 40k GeoNames gazetteer first for exact sub-kilometer accuracy (including suburbs & neighboring metros)
  if (cityGazetteer && code) {
    const exact = cityGazetteer[`${cleanCity}|${code}`];
    if (exact) {
      return {
        lat: exact[0],
        lng: exact[1],
        code,
        flag: countryGeo?.flag ?? "📍",
        countryName: countryGeo?.name ?? country,
        exactCity: true,
      };
    }
  }

  // 2. Synchronous curated city lookup (used immediately on first paint before gazetteer resolves)
  const directCity = CITY_COORDINATES[cleanCity];
  if (directCity) {
    return {
      lat: directCity.lat,
      lng: directCity.lng,
      code,
      flag: countryGeo?.flag ?? "📍",
      countryName: countryGeo?.name ?? country,
      exactCity: true,
    };
  }

  // 3. Country centroid fallback with minimal jitter when a small town is unlisted
  if (!countryGeo) return null;
  const [dLat, dLng] = stableHashOffset(`${cleanCity}:${countryGeo.code}`);
  return {
    lat: Math.max(-75, Math.min(75, countryGeo.lat + dLat * 0.28)),
    lng: countryGeo.lng + dLng * 0.35,
    code: countryGeo.code,
    flag: countryGeo.flag,
    countryName: countryGeo.name,
    exactCity: false,
  };
}

/**
 * Known cloud datacenter & automated monitoring hubs, aligned with the backend
 * traffic diagnostics engine (`KNOWN_DATACENTER_CITIES` in google-report.ts).
 */
const KNOWN_DATACENTER_HUBS: Record<string, string> = {
  "council bluffs": "Google US cloud datacenter & crawler hub",
  ashburn: "AWS US-East cloud datacenter hub",
  boardman: "AWS US-West cloud datacenter hub",
  "the dalles": "Google cloud datacenter hub",
  "des moines": "Cloud datacenter / automated monitoring hub",
  lenoir: "Google US datacenter hub",
  boydton: "Microsoft Azure datacenter hub",
  quincy: "Cloud datacenter / crawler hub",
  "forest city": "Cloud datacenter hub",
  pryor: "Google US datacenter hub",
  coffeyville: "Automated crawler / datacenter hub",
  "santa clara": "Cloud infrastructure / monitoring hub",
  cheyenne: "Microsoft Azure / cloud datacenter hub",
  "flint hill": "Northern Virginia cloud / crawler hub",
};

export function detectDatacenterCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  return KNOWN_DATACENTER_HUBS[key] ?? null;
}
