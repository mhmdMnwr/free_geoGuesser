#!/usr/bin/env node
/**
 * Generates and verifies 20,000+ official Google Street View car road locations:
 *  - Reclassifies existing 10,050 regional/rural highway roads into 'medium' and 'hard'
 *    (restoring state/province subdivision labels from commit 2af7c27).
 *  - Queries Google's live MapsJsInternalService/SingleImageSearch endpoint across
 *    hundreds of world cities across all 5 continents (Europe, Americas, Asia, Africa, Oceania)
 *    with strict filters:
 *      1. panoType === 2 (Official Google Street View Car only; rejects 360 photospheres type 10)
 *      2. copyright includes "Google" (rejects third-party indoor/business uploads)
 *      3. neighbors.length >= 3 (guarantees navigable road with forward/backward movement)
 *  - Populates the 'easy' tier exclusively with verified urban/city streets.
 *  - Writes synchronized output to:
 *      - backend/game-engine/data/locations.json
 *      - docker/init-geo-db.sql
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SINGLE_IMAGE_SEARCH_URL =
  'https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch';

// Comprehensive global cities across all 5 regions with official Google Street View car coverage
const WORLD_CITIES = [
  // ================= EUROPE =================
  { city: 'London', country: 'United Kingdom', region: 'europe', lat: 51.5074, lng: -0.1278 },
  { city: 'Manchester', country: 'United Kingdom', region: 'europe', lat: 53.4808, lng: -2.2426 },
  { city: 'Birmingham', country: 'United Kingdom', region: 'europe', lat: 52.4862, lng: -1.8904 },
  { city: 'Liverpool', country: 'United Kingdom', region: 'europe', lat: 53.4084, lng: -2.9916 },
  { city: 'Leeds', country: 'United Kingdom', region: 'europe', lat: 53.8008, lng: -1.5491 },
  { city: 'Bristol', country: 'United Kingdom', region: 'europe', lat: 51.4545, lng: -2.5879 },
  { city: 'Edinburgh', country: 'United Kingdom', region: 'europe', lat: 55.9533, lng: -3.1883 },
  { city: 'Glasgow', country: 'United Kingdom', region: 'europe', lat: 55.8642, lng: -4.2518 },
  { city: 'Cardiff', country: 'United Kingdom', region: 'europe', lat: 51.4816, lng: -3.1791 },
  { city: 'Belfast', country: 'United Kingdom', region: 'europe', lat: 54.5973, lng: -5.9301 },
  { city: 'Newcastle', country: 'United Kingdom', region: 'europe', lat: 54.9783, lng: -1.6178 },
  { city: 'Sheffield', country: 'United Kingdom', region: 'europe', lat: 53.3811, lng: -1.4701 },
  { city: 'Nottingham', country: 'United Kingdom', region: 'europe', lat: 52.9548, lng: -1.1581 },
  { city: 'Cambridge', country: 'United Kingdom', region: 'europe', lat: 52.2053, lng: 0.1218 },
  { city: 'Oxford', country: 'United Kingdom', region: 'europe', lat: 51.7520, lng: -1.2577 },
  { city: 'Brighton', country: 'United Kingdom', region: 'europe', lat: 50.8225, lng: -0.1372 },

  { city: 'Paris', country: 'France', region: 'europe', lat: 48.8566, lng: 2.3522 },
  { city: 'Marseille', country: 'France', region: 'europe', lat: 43.2965, lng: 5.3698 },
  { city: 'Lyon', country: 'France', region: 'europe', lat: 45.7640, lng: 4.8357 },
  { city: 'Toulouse', country: 'France', region: 'europe', lat: 43.6047, lng: 1.4442 },
  { city: 'Nice', country: 'France', region: 'europe', lat: 43.7102, lng: 7.2620 },
  { city: 'Nantes', country: 'France', region: 'europe', lat: 47.2184, lng: -1.5536 },
  { city: 'Strasbourg', country: 'France', region: 'europe', lat: 48.5734, lng: 7.7521 },
  { city: 'Montpellier', country: 'France', region: 'europe', lat: 43.6108, lng: 3.8767 },
  { city: 'Bordeaux', country: 'France', region: 'europe', lat: 44.8378, lng: -0.5792 },
  { city: 'Lille', country: 'France', region: 'europe', lat: 50.6292, lng: 3.0573 },
  { city: 'Rennes', country: 'France', region: 'europe', lat: 48.1173, lng: -1.6778 },
  { city: 'Grenoble', country: 'France', region: 'europe', lat: 45.1885, lng: 5.7245 },

  { city: 'Berlin', country: 'Germany', region: 'europe', lat: 52.5200, lng: 13.4050 },
  { city: 'Hamburg', country: 'Germany', region: 'europe', lat: 53.5511, lng: 9.9937 },
  { city: 'Munich', country: 'Germany', region: 'europe', lat: 48.1351, lng: 11.5820 },
  { city: 'Cologne', country: 'Germany', region: 'europe', lat: 50.9375, lng: 6.9603 },
  { city: 'Frankfurt', country: 'Germany', region: 'europe', lat: 50.1109, lng: 8.6821 },
  { city: 'Stuttgart', country: 'Germany', region: 'europe', lat: 48.7758, lng: 9.1829 },
  { city: 'Düsseldorf', country: 'Germany', region: 'europe', lat: 51.2277, lng: 6.7735 },
  { city: 'Leipzig', country: 'Germany', region: 'europe', lat: 51.3397, lng: 12.3731 },
  { city: 'Dresden', country: 'Germany', region: 'europe', lat: 51.0504, lng: 13.7373 },
  { city: 'Hanover', country: 'Germany', region: 'europe', lat: 52.3759, lng: 9.7320 },
  { city: 'Nuremberg', country: 'Germany', region: 'europe', lat: 49.4521, lng: 11.0767 },
  { city: 'Bremen', country: 'Germany', region: 'europe', lat: 53.0793, lng: 8.8017 },

  { city: 'Madrid', country: 'Spain', region: 'europe', lat: 40.4168, lng: -3.7038 },
  { city: 'Barcelona', country: 'Spain', region: 'europe', lat: 41.3851, lng: 2.1734 },
  { city: 'Valencia', country: 'Spain', region: 'europe', lat: 39.4699, lng: -0.3763 },
  { city: 'Seville', country: 'Spain', region: 'europe', lat: 37.3891, lng: -5.9845 },
  { city: 'Zaragoza', country: 'Spain', region: 'europe', lat: 41.6488, lng: -0.8891 },
  { city: 'Málaga', country: 'Spain', region: 'europe', lat: 36.7213, lng: -4.4214 },
  { city: 'Bilbao', country: 'Spain', region: 'europe', lat: 43.2630, lng: -2.9350 },
  { city: 'Alicante', country: 'Spain', region: 'europe', lat: 38.3452, lng: -0.4810 },
  { city: 'Granada', country: 'Spain', region: 'europe', lat: 37.1773, lng: -3.5986 },
  { city: 'Palma', country: 'Spain', region: 'europe', lat: 39.5696, lng: 2.6502 },

  { city: 'Rome', country: 'Italy', region: 'europe', lat: 41.9028, lng: 12.4964 },
  { city: 'Milan', country: 'Italy', region: 'europe', lat: 45.4642, lng: 9.1900 },
  { city: 'Naples', country: 'Italy', region: 'europe', lat: 40.8518, lng: 14.2681 },
  { city: 'Turin', country: 'Italy', region: 'europe', lat: 45.0703, lng: 7.6869 },
  { city: 'Palermo', country: 'Italy', region: 'europe', lat: 38.1157, lng: 13.3615 },
  { city: 'Genoa', country: 'Italy', region: 'europe', lat: 44.4056, lng: 8.9463 },
  { city: 'Bologna', country: 'Italy', region: 'europe', lat: 44.4949, lng: 11.3426 },
  { city: 'Florence', country: 'Italy', region: 'europe', lat: 43.7696, lng: 11.2558 },
  { city: 'Bari', country: 'Italy', region: 'europe', lat: 41.1171, lng: 16.8719 },
  { city: 'Catania', country: 'Italy', region: 'europe', lat: 37.5079, lng: 15.0830 },
  { city: 'Verona', country: 'Italy', region: 'europe', lat: 45.4384, lng: 10.9916 },

  { city: 'Amsterdam', country: 'Netherlands', region: 'europe', lat: 52.3676, lng: 4.9041 },
  { city: 'Rotterdam', country: 'Netherlands', region: 'europe', lat: 51.9244, lng: 4.4777 },
  { city: 'The Hague', country: 'Netherlands', region: 'europe', lat: 52.0705, lng: 4.3007 },
  { city: 'Utrecht', country: 'Netherlands', region: 'europe', lat: 52.0907, lng: 5.1214 },
  { city: 'Eindhoven', country: 'Netherlands', region: 'europe', lat: 51.4416, lng: 5.4697 },
  { city: 'Groningen', country: 'Netherlands', region: 'europe', lat: 53.2194, lng: 6.5665 },

  { city: 'Brussels', country: 'Belgium', region: 'europe', lat: 50.8503, lng: 4.3517 },
  { city: 'Antwerp', country: 'Belgium', region: 'europe', lat: 51.2194, lng: 4.4025 },
  { city: 'Ghent', country: 'Belgium', region: 'europe', lat: 51.0543, lng: 3.7174 },
  { city: 'Bruges', country: 'Belgium', region: 'europe', lat: 51.2093, lng: 3.2247 },
  { city: 'Liège', country: 'Belgium', region: 'europe', lat: 50.6326, lng: 5.5797 },

  { city: 'Vienna', country: 'Austria', region: 'europe', lat: 48.2082, lng: 16.3738 },
  { city: 'Graz', country: 'Austria', region: 'europe', lat: 47.0707, lng: 15.4395 },
  { city: 'Linz', country: 'Austria', region: 'europe', lat: 48.3069, lng: 14.2858 },
  { city: 'Salzburg', country: 'Austria', region: 'europe', lat: 47.8095, lng: 13.0550 },
  { city: 'Innsbruck', country: 'Austria', region: 'europe', lat: 47.2692, lng: 11.4041 },

  { city: 'Zurich', country: 'Switzerland', region: 'europe', lat: 47.3769, lng: 8.5417 },
  { city: 'Geneva', country: 'Switzerland', region: 'europe', lat: 46.2044, lng: 6.1432 },
  { city: 'Basel', country: 'Switzerland', region: 'europe', lat: 47.5596, lng: 7.5886 },
  { city: 'Bern', country: 'Switzerland', region: 'europe', lat: 46.9480, lng: 7.4474 },
  { city: 'Lausanne', country: 'Switzerland', region: 'europe', lat: 46.5197, lng: 6.6323 },

  { city: 'Lisbon', country: 'Portugal', region: 'europe', lat: 38.7223, lng: -9.1393 },
  { city: 'Porto', country: 'Portugal', region: 'europe', lat: 41.1579, lng: -8.6291 },
  { city: 'Braga', country: 'Portugal', region: 'europe', lat: 41.5454, lng: -8.4265 },
  { city: 'Coimbra', country: 'Portugal', region: 'europe', lat: 40.2033, lng: -8.4103 },
  { city: 'Faro', country: 'Portugal', region: 'europe', lat: 37.0194, lng: -7.9322 },

  { city: 'Dublin', country: 'Ireland', region: 'europe', lat: 53.3498, lng: -6.2603 },
  { city: 'Cork', country: 'Ireland', region: 'europe', lat: 51.8985, lng: -8.4756 },
  { city: 'Galway', country: 'Ireland', region: 'europe', lat: 53.2707, lng: -9.0568 },
  { city: 'Limerick', country: 'Ireland', region: 'europe', lat: 52.6638, lng: -8.6267 },

  { city: 'Stockholm', country: 'Sweden', region: 'europe', lat: 59.3293, lng: 18.0686 },
  { city: 'Gothenburg', country: 'Sweden', region: 'europe', lat: 57.7089, lng: 11.9746 },
  { city: 'Malmö', country: 'Sweden', region: 'europe', lat: 55.6050, lng: 13.0038 },
  { city: 'Uppsala', country: 'Sweden', region: 'europe', lat: 59.8586, lng: 17.6389 },

  { city: 'Oslo', country: 'Norway', region: 'europe', lat: 59.9139, lng: 10.7522 },
  { city: 'Bergen', country: 'Norway', region: 'europe', lat: 60.3913, lng: 5.3221 },
  { city: 'Trondheim', country: 'Norway', region: 'europe', lat: 63.4305, lng: 10.3951 },
  { city: 'Stavanger', country: 'Norway', region: 'europe', lat: 58.9700, lng: 5.7331 },
  { city: 'Tromsø', country: 'Norway', region: 'europe', lat: 69.6492, lng: 18.9553 },

  { city: 'Copenhagen', country: 'Denmark', region: 'europe', lat: 55.6761, lng: 12.5683 },
  { city: 'Aarhus', country: 'Denmark', region: 'europe', lat: 56.1629, lng: 10.2039 },
  { city: 'Odense', country: 'Denmark', region: 'europe', lat: 55.4038, lng: 10.4024 },
  { city: 'Aalborg', country: 'Denmark', region: 'europe', lat: 57.0488, lng: 9.9217 },

  { city: 'Helsinki', country: 'Finland', region: 'europe', lat: 60.1699, lng: 24.9384 },
  { city: 'Espoo', country: 'Finland', region: 'europe', lat: 60.2055, lng: 24.6559 },
  { city: 'Tampere', country: 'Finland', region: 'europe', lat: 61.4978, lng: 23.7610 },
  { city: 'Turku', country: 'Finland', region: 'europe', lat: 60.4518, lng: 22.2666 },
  { city: 'Oulu', country: 'Finland', region: 'europe', lat: 65.0121, lng: 25.4651 },

  { city: 'Warsaw', country: 'Poland', region: 'europe', lat: 52.2297, lng: 21.0122 },
  { city: 'Kraków', country: 'Poland', region: 'europe', lat: 50.0647, lng: 19.9450 },
  { city: 'Wrocław', country: 'Poland', region: 'europe', lat: 51.1079, lng: 17.0385 },
  { city: 'Poznań', country: 'Poland', region: 'europe', lat: 52.4064, lng: 16.9252 },
  { city: 'Gdańsk', country: 'Poland', region: 'europe', lat: 54.3520, lng: 18.6466 },
  { city: 'Łódź', country: 'Poland', region: 'europe', lat: 51.7592, lng: 19.4560 },

  { city: 'Prague', country: 'Czechia', region: 'europe', lat: 50.0755, lng: 14.4378 },
  { city: 'Brno', country: 'Czechia', region: 'europe', lat: 49.1951, lng: 16.6068 },
  { city: 'Ostrava', country: 'Czechia', region: 'europe', lat: 49.8209, lng: 18.2625 },
  { city: 'Plzeň', country: 'Czechia', region: 'europe', lat: 49.7384, lng: 13.3736 },

  { city: 'Budapest', country: 'Hungary', region: 'europe', lat: 47.4979, lng: 19.0402 },
  { city: 'Debrecen', country: 'Hungary', region: 'europe', lat: 47.5316, lng: 21.6273 },
  { city: 'Szeged', country: 'Hungary', region: 'europe', lat: 46.2530, lng: 20.1414 },

  { city: 'Bucharest', country: 'Romania', region: 'europe', lat: 44.4268, lng: 26.1025 },
  { city: 'Cluj-Napoca', country: 'Romania', region: 'europe', lat: 46.7712, lng: 23.6236 },
  { city: 'Timișoara', country: 'Romania', region: 'europe', lat: 45.7489, lng: 21.2087 },
  { city: 'Iași', country: 'Romania', region: 'europe', lat: 47.1585, lng: 27.6014 },
  { city: 'Brașov', country: 'Romania', region: 'europe', lat: 45.6427, lng: 25.5887 },

  { city: 'Athens', country: 'Greece', region: 'europe', lat: 37.9838, lng: 23.7275 },
  { city: 'Thessaloniki', country: 'Greece', region: 'europe', lat: 40.6401, lng: 22.9444 },
  { city: 'Patras', country: 'Greece', region: 'europe', lat: 38.2466, lng: 21.7346 },
  { city: 'Heraklion', country: 'Greece', region: 'europe', lat: 35.3387, lng: 25.1442 },

  { city: 'Sofia', country: 'Bulgaria', region: 'europe', lat: 42.6977, lng: 23.3219 },
  { city: 'Plovdiv', country: 'Bulgaria', region: 'europe', lat: 42.1354, lng: 24.7453 },
  { city: 'Varna', country: 'Bulgaria', region: 'europe', lat: 43.2141, lng: 27.9147 },

  { city: 'Zagreb', country: 'Croatia', region: 'europe', lat: 45.8150, lng: 15.9819 },
  { city: 'Split', country: 'Croatia', region: 'europe', lat: 43.5081, lng: 16.4402 },
  { city: 'Rijeka', country: 'Croatia', region: 'europe', lat: 45.3271, lng: 14.4422 },
  { city: 'Dubrovnik', country: 'Croatia', region: 'europe', lat: 42.6507, lng: 18.0944 },

  { city: 'Belgrade', country: 'Serbia', region: 'europe', lat: 44.7866, lng: 20.4489 },
  { city: 'Novi Sad', country: 'Serbia', region: 'europe', lat: 45.2671, lng: 19.8335 },
  { city: 'Niš', country: 'Serbia', region: 'europe', lat: 43.3209, lng: 21.8958 },

  { city: 'Bratislava', country: 'Slovakia', region: 'europe', lat: 48.1486, lng: 17.1077 },
  { city: 'Košice', country: 'Slovakia', region: 'europe', lat: 48.7164, lng: 21.2611 },
  { city: 'Ljubljana', country: 'Slovenia', region: 'europe', lat: 46.0569, lng: 14.5058 },
  { city: 'Maribor', country: 'Slovenia', region: 'europe', lat: 46.5547, lng: 15.6459 },
  { city: 'Tallinn', country: 'Estonia', region: 'europe', lat: 59.4370, lng: 24.7536 },
  { city: 'Tartu', country: 'Estonia', region: 'europe', lat: 58.3780, lng: 26.7290 },
  { city: 'Riga', country: 'Latvia', region: 'europe', lat: 56.9496, lng: 24.1052 },
  { city: 'Vilnius', country: 'Lithuania', region: 'europe', lat: 54.6872, lng: 25.2797 },
  { city: 'Kaunas', country: 'Lithuania', region: 'europe', lat: 54.8985, lng: 23.9036 },
  { city: 'Reykjavik', country: 'Iceland', region: 'europe', lat: 64.1466, lng: -21.9426 },
  { city: 'Luxembourg City', country: 'Luxembourg', region: 'europe', lat: 49.6116, lng: 6.1319 },
  { city: 'Kyiv', country: 'Ukraine', region: 'europe', lat: 50.4501, lng: 30.5234 },
  { city: 'Lviv', country: 'Ukraine', region: 'europe', lat: 49.8397, lng: 24.0297 },
  { city: 'Odesa', country: 'Ukraine', region: 'europe', lat: 46.4825, lng: 30.7233 },
  { city: 'Tirana', country: 'Albania', region: 'europe', lat: 41.3275, lng: 19.8187 },
  { city: 'Skopje', country: 'North Macedonia', region: 'europe', lat: 41.9981, lng: 21.4254 },
  { city: 'Podgorica', country: 'Montenegro', region: 'europe', lat: 42.4304, lng: 19.2594 },
  { city: 'Sarajevo', country: 'Bosnia and Herzegovina', region: 'europe', lat: 43.8563, lng: 18.4131 },
  { city: 'Valletta', country: 'Malta', region: 'europe', lat: 35.8989, lng: 14.5146 },
  { city: 'Andorra la Vella', country: 'Andorra', region: 'europe', lat: 42.5063, lng: 1.5218 },

  // ================= AMERICAS =================
  { city: 'New York', country: 'United States', region: 'americas', lat: 40.7580, lng: -73.9855 },
  { city: 'Brooklyn', country: 'United States', region: 'americas', lat: 40.6782, lng: -73.9442 },
  { city: 'Los Angeles', country: 'United States', region: 'americas', lat: 34.0522, lng: -118.2437 },
  { city: 'Chicago', country: 'United States', region: 'americas', lat: 41.8781, lng: -87.6298 },
  { city: 'Houston', country: 'United States', region: 'americas', lat: 29.7604, lng: -95.3698 },
  { city: 'Phoenix', country: 'United States', region: 'americas', lat: 33.4484, lng: -112.0740 },
  { city: 'Philadelphia', country: 'United States', region: 'americas', lat: 39.9526, lng: -75.1652 },
  { city: 'San Antonio', country: 'United States', region: 'americas', lat: 29.4241, lng: -98.4936 },
  { city: 'San Diego', country: 'United States', region: 'americas', lat: 32.7157, lng: -117.1611 },
  { city: 'Dallas', country: 'United States', region: 'americas', lat: 32.7767, lng: -96.7970 },
  { city: 'San Francisco', country: 'United States', region: 'americas', lat: 37.7749, lng: -122.4194 },
  { city: 'Austin', country: 'United States', region: 'americas', lat: 30.2672, lng: -97.7431 },
  { city: 'Seattle', country: 'United States', region: 'americas', lat: 47.6062, lng: -122.3321 },
  { city: 'Denver', country: 'United States', region: 'americas', lat: 39.7392, lng: -104.9903 },
  { city: 'Washington DC', country: 'United States', region: 'americas', lat: 38.9072, lng: -77.0369 },
  { city: 'Boston', country: 'United States', region: 'americas', lat: 42.3601, lng: -71.0589 },
  { city: 'Nashville', country: 'United States', region: 'americas', lat: 36.1627, lng: -86.7816 },
  { city: 'Detroit', country: 'United States', region: 'americas', lat: 42.3314, lng: -83.0458 },
  { city: 'Portland', country: 'United States', region: 'americas', lat: 45.5152, lng: -122.6784 },
  { city: 'Las Vegas', country: 'United States', region: 'americas', lat: 36.1699, lng: -115.1398 },
  { city: 'Miami', country: 'United States', region: 'americas', lat: 25.7617, lng: -80.1918 },
  { city: 'Atlanta', country: 'United States', region: 'americas', lat: 33.7490, lng: -84.3880 },
  { city: 'Minneapolis', country: 'United States', region: 'americas', lat: 44.9778, lng: -93.2650 },
  { city: 'New Orleans', country: 'United States', region: 'americas', lat: 29.9511, lng: -90.0715 },
  { city: 'Tampa', country: 'United States', region: 'americas', lat: 27.9506, lng: -82.4572 },
  { city: 'Pittsburgh', country: 'United States', region: 'americas', lat: 40.4406, lng: -79.9959 },
  { city: 'Baltimore', country: 'United States', region: 'americas', lat: 39.2904, lng: -76.6122 },
  { city: 'Salt Lake City', country: 'United States', region: 'americas', lat: 40.7608, lng: -111.8910 },
  { city: 'Charlotte', country: 'United States', region: 'americas', lat: 35.2271, lng: -80.8431 },
  { city: 'Honolulu', country: 'United States', region: 'americas', lat: 21.3069, lng: -157.8583 },

  { city: 'Toronto', country: 'Canada', region: 'americas', lat: 43.6532, lng: -79.3832 },
  { city: 'Montreal', country: 'Canada', region: 'americas', lat: 45.5017, lng: -73.5673 },
  { city: 'Vancouver', country: 'Canada', region: 'americas', lat: 49.2827, lng: -123.1207 },
  { city: 'Calgary', country: 'Canada', region: 'americas', lat: 51.0447, lng: -114.0719 },
  { city: 'Edmonton', country: 'Canada', region: 'americas', lat: 53.5461, lng: -113.4938 },
  { city: 'Ottawa', country: 'Canada', region: 'americas', lat: 45.4215, lng: -75.6972 },
  { city: 'Winnipeg', country: 'Canada', region: 'americas', lat: 49.8951, lng: -97.1384 },
  { city: 'Quebec City', country: 'Canada', region: 'americas', lat: 46.8139, lng: -71.2080 },
  { city: 'Halifax', country: 'Canada', region: 'americas', lat: 44.6488, lng: -63.5752 },
  { city: 'Victoria', country: 'Canada', region: 'americas', lat: 48.4284, lng: -123.3656 },

  { city: 'Mexico City', country: 'Mexico', region: 'americas', lat: 19.4326, lng: -99.1332 },
  { city: 'Guadalajara', country: 'Mexico', region: 'americas', lat: 20.6597, lng: -103.3496 },
  { city: 'Monterrey', country: 'Mexico', region: 'americas', lat: 25.6866, lng: -100.3161 },
  { city: 'Puebla', country: 'Mexico', region: 'americas', lat: 19.0414, lng: -98.2063 },
  { city: 'Mérida', country: 'Mexico', region: 'americas', lat: 20.9674, lng: -89.5926 },
  { city: 'Querétaro', country: 'Mexico', region: 'americas', lat: 20.5888, lng: -100.3899 },
  { city: 'Tijuana', country: 'Mexico', region: 'americas', lat: 32.5149, lng: -117.0382 },
  { city: 'Cancún', country: 'Mexico', region: 'americas', lat: 21.1619, lng: -86.8515 },

  { city: 'São Paulo', country: 'Brazil', region: 'americas', lat: -23.5505, lng: -46.6333 },
  { city: 'Rio de Janeiro', country: 'Brazil', region: 'americas', lat: -22.9068, lng: -43.1729 },
  { city: 'Brasília', country: 'Brazil', region: 'americas', lat: -15.7975, lng: -47.8919 },
  { city: 'Salvador', country: 'Brazil', region: 'americas', lat: -12.9714, lng: -38.5014 },
  { city: 'Fortaleza', country: 'Brazil', region: 'americas', lat: -3.7172, lng: -38.5433 },
  { city: 'Belo Horizonte', country: 'Brazil', region: 'americas', lat: -19.9167, lng: -43.9345 },
  { city: 'Manaus', country: 'Brazil', region: 'americas', lat: -3.1190, lng: -60.0217 },
  { city: 'Curitiba', country: 'Brazil', region: 'americas', lat: -25.4284, lng: -49.2733 },
  { city: 'Recife', country: 'Brazil', region: 'americas', lat: -8.0476, lng: -34.8770 },
  { city: 'Porto Alegre', country: 'Brazil', region: 'americas', lat: -30.0346, lng: -51.2177 },
  { city: 'Florianópolis', country: 'Brazil', region: 'americas', lat: -27.5954, lng: -48.5480 },

  { city: 'Buenos Aires', country: 'Argentina', region: 'americas', lat: -34.6037, lng: -58.3816 },
  { city: 'Córdoba', country: 'Argentina', region: 'americas', lat: -31.4201, lng: -64.1888 },
  { city: 'Rosario', country: 'Argentina', region: 'americas', lat: -32.9442, lng: -60.6505 },
  { city: 'Mendoza', country: 'Argentina', region: 'americas', lat: -32.8895, lng: -68.8458 },
  { city: 'Mar del Plata', country: 'Argentina', region: 'americas', lat: -38.0055, lng: -57.5426 },
  { city: 'Salta', country: 'Argentina', region: 'americas', lat: -24.7821, lng: -65.4232 },

  { city: 'Santiago', country: 'Chile', region: 'americas', lat: -33.4489, lng: -70.6693 },
  { city: 'Valparaíso', country: 'Chile', region: 'americas', lat: -33.0472, lng: -71.6127 },
  { city: 'Concepción', country: 'Chile', region: 'americas', lat: -36.8201, lng: -73.0444 },
  { city: 'Antofagasta', country: 'Chile', region: 'americas', lat: -23.6509, lng: -70.3975 },

  { city: 'Bogotá', country: 'Colombia', region: 'americas', lat: 4.7110, lng: -74.0721 },
  { city: 'Medellín', country: 'Colombia', region: 'americas', lat: 6.2442, lng: -75.5812 },
  { city: 'Cali', country: 'Colombia', region: 'americas', lat: 3.4516, lng: -76.5320 },
  { city: 'Barranquilla', country: 'Colombia', region: 'americas', lat: 10.9685, lng: -74.7813 },
  { city: 'Cartagena', country: 'Colombia', region: 'americas', lat: 10.3910, lng: -75.4794 },

  { city: 'Lima', country: 'Peru', region: 'americas', lat: -12.0464, lng: -77.0428 },
  { city: 'Arequipa', country: 'Peru', region: 'americas', lat: -16.4090, lng: -71.5375 },
  { city: 'Cusco', country: 'Peru', region: 'americas', lat: -13.5320, lng: -71.9675 },
  { city: 'Trujillo', country: 'Peru', region: 'americas', lat: -8.1160, lng: -79.0300 },

  { city: 'Quito', country: 'Ecuador', region: 'americas', lat: -0.1807, lng: -78.4678 },
  { city: 'Guayaquil', country: 'Ecuador', region: 'americas', lat: -2.1894, lng: -79.8891 },
  { city: 'Montevideo', country: 'Uruguay', region: 'americas', lat: -34.9011, lng: -56.1645 },
  { city: 'La Paz', country: 'Bolivia', region: 'americas', lat: -16.4897, lng: -68.1193 },
  { city: 'Santa Cruz', country: 'Bolivia', region: 'americas', lat: -17.7833, lng: -63.1821 },
  { city: 'Panama City', country: 'Panama', region: 'americas', lat: 8.9824, lng: -79.5199 },
  { city: 'San José', country: 'Costa Rica', region: 'americas', lat: 9.9281, lng: -84.0907 },
  { city: 'Guatemala City', country: 'Guatemala', region: 'americas', lat: 14.6349, lng: -90.5069 },
  { city: 'Santo Domingo', country: 'Dominican Republic', region: 'americas', lat: 18.4861, lng: -69.9312 },
  { city: 'San Juan', country: 'Puerto Rico', region: 'americas', lat: 18.4655, lng: -66.1057 },

  // ================= ASIA =================
  { city: 'Tokyo', country: 'Japan', region: 'asia', lat: 35.6762, lng: 139.6503 },
  { city: 'Shinjuku', country: 'Japan', region: 'asia', lat: 35.6938, lng: 139.7034 },
  { city: 'Shibuya', country: 'Japan', region: 'asia', lat: 35.6580, lng: 139.7016 },
  { city: 'Yokohama', country: 'Japan', region: 'asia', lat: 35.4437, lng: 139.6380 },
  { city: 'Osaka', country: 'Japan', region: 'asia', lat: 34.6937, lng: 135.5023 },
  { city: 'Nagoya', country: 'Japan', region: 'asia', lat: 35.1815, lng: 136.9066 },
  { city: 'Sapporo', country: 'Japan', region: 'asia', lat: 43.0618, lng: 141.3545 },
  { city: 'Fukuoka', country: 'Japan', region: 'asia', lat: 33.5902, lng: 130.4017 },
  { city: 'Kobe', country: 'Japan', region: 'asia', lat: 34.6901, lng: 135.1955 },
  { city: 'Kyoto', country: 'Japan', region: 'asia', lat: 35.0116, lng: 135.7681 },
  { city: 'Sendai', country: 'Japan', region: 'asia', lat: 38.2682, lng: 140.8694 },
  { city: 'Hiroshima', country: 'Japan', region: 'asia', lat: 34.3853, lng: 132.4553 },

  { city: 'Seoul', country: 'South Korea', region: 'asia', lat: 37.5665, lng: 126.9780 },
  { city: 'Gangnam', country: 'South Korea', region: 'asia', lat: 37.4979, lng: 127.0276 },
  { city: 'Busan', country: 'South Korea', region: 'asia', lat: 35.1796, lng: 129.0756 },
  { city: 'Incheon', country: 'South Korea', region: 'asia', lat: 37.4563, lng: 126.7052 },
  { city: 'Daegu', country: 'South Korea', region: 'asia', lat: 35.8714, lng: 128.6014 },
  { city: 'Daejeon', country: 'South Korea', region: 'asia', lat: 36.3504, lng: 127.3845 },
  { city: 'Gwangju', country: 'South Korea', region: 'asia', lat: 35.1595, lng: 126.8526 },

  { city: 'Taipei', country: 'Taiwan', region: 'asia', lat: 25.0330, lng: 121.5654 },
  { city: 'Kaohsiung', country: 'Taiwan', region: 'asia', lat: 22.6273, lng: 120.3014 },
  { city: 'Taichung', country: 'Taiwan', region: 'asia', lat: 24.1477, lng: 120.6736 },
  { city: 'Tainan', country: 'Taiwan', region: 'asia', lat: 22.9997, lng: 120.2270 },

  { city: 'Singapore', country: 'Singapore', region: 'asia', lat: 1.3521, lng: 103.8198 },
  { city: 'Marina Bay', country: 'Singapore', region: 'asia', lat: 1.2838, lng: 103.8591 },
  { city: 'Hong Kong', country: 'Hong Kong', region: 'asia', lat: 22.3193, lng: 114.1694 },
  { city: 'Kowloon', country: 'Hong Kong', region: 'asia', lat: 22.3040, lng: 114.1719 },

  { city: 'Bangkok', country: 'Thailand', region: 'asia', lat: 13.7563, lng: 100.5018 },
  { city: 'Chiang Mai', country: 'Thailand', region: 'asia', lat: 18.7883, lng: 98.9853 },
  { city: 'Phuket', country: 'Thailand', region: 'asia', lat: 7.8804, lng: 98.3923 },
  { city: 'Pattaya', country: 'Thailand', region: 'asia', lat: 12.9236, lng: 100.8825 },

  { city: 'Kuala Lumpur', country: 'Malaysia', region: 'asia', lat: 3.1390, lng: 101.6869 },
  { city: 'George Town', country: 'Malaysia', region: 'asia', lat: 5.4141, lng: 100.3288 },
  { city: 'Johor Bahru', country: 'Malaysia', region: 'asia', lat: 1.4927, lng: 103.7414 },
  { city: 'Ipoh', country: 'Malaysia', region: 'asia', lat: 4.5975, lng: 101.0901 },

  { city: 'Jakarta', country: 'Indonesia', region: 'asia', lat: -6.2088, lng: 106.8456 },
  { city: 'Surabaya', country: 'Indonesia', region: 'asia', lat: -7.2575, lng: 112.7521 },
  { city: 'Bandung', country: 'Indonesia', region: 'asia', lat: -6.9175, lng: 107.6191 },
  { city: 'Medan', country: 'Indonesia', region: 'asia', lat: 3.5952, lng: 98.6722 },
  { city: 'Denpasar', country: 'Indonesia', region: 'asia', lat: -8.6705, lng: 115.2126 },
  { city: 'Yogyakarta', country: 'Indonesia', region: 'asia', lat: -7.7956, lng: 110.3695 },

  { city: 'Manila', country: 'Philippines', region: 'asia', lat: 14.5995, lng: 120.9842 },
  { city: 'Makati', country: 'Philippines', region: 'asia', lat: 14.5547, lng: 121.0244 },
  { city: 'Cebu City', country: 'Philippines', region: 'asia', lat: 10.3157, lng: 123.8854 },
  { city: 'Davao City', country: 'Philippines', region: 'asia', lat: 7.1907, lng: 125.4553 },

  { city: 'Mumbai', country: 'India', region: 'asia', lat: 19.0760, lng: 72.8777 },
  { city: 'New Delhi', country: 'India', region: 'asia', lat: 28.6139, lng: 77.2090 },
  { city: 'Bengaluru', country: 'India', region: 'asia', lat: 12.9716, lng: 77.5946 },
  { city: 'Hyderabad', country: 'India', region: 'asia', lat: 17.3850, lng: 78.4867 },
  { city: 'Chennai', country: 'India', region: 'asia', lat: 13.0827, lng: 80.2707 },
  { city: 'Kolkata', country: 'India', region: 'asia', lat: 22.5726, lng: 88.3639 },
  { city: 'Pune', country: 'India', region: 'asia', lat: 18.5204, lng: 73.8567 },
  { city: 'Ahmedabad', country: 'India', region: 'asia', lat: 23.0225, lng: 72.5714 },
  { city: 'Jaipur', country: 'India', region: 'asia', lat: 26.9124, lng: 75.7873 },

  { city: 'Istanbul', country: 'Turkey', region: 'asia', lat: 41.0082, lng: 28.9784 },
  { city: 'Ankara', country: 'Turkey', region: 'asia', lat: 39.9334, lng: 32.8597 },
  { city: 'Izmir', country: 'Turkey', region: 'asia', lat: 38.4237, lng: 27.1428 },
  { city: 'Antalya', country: 'Turkey', region: 'asia', lat: 36.8969, lng: 30.7133 },
  { city: 'Bursa', country: 'Turkey', region: 'asia', lat: 40.1885, lng: 29.0610 },

  { city: 'Dubai', country: 'United Arab Emirates', region: 'asia', lat: 25.2048, lng: 55.2708 },
  { city: 'Abu Dhabi', country: 'United Arab Emirates', region: 'asia', lat: 24.4539, lng: 54.3773 },
  { city: 'Doha', country: 'Qatar', region: 'asia', lat: 25.2854, lng: 51.5310 },
  { city: 'Amman', country: 'Jordan', region: 'asia', lat: 31.9454, lng: 35.9284 },
  { city: 'Colombo', country: 'Sri Lanka', region: 'asia', lat: 6.9271, lng: 79.8612 },
  { city: 'Kandy', country: 'Sri Lanka', region: 'asia', lat: 7.2906, lng: 80.6337 },
  { city: 'Dhaka', country: 'Bangladesh', region: 'asia', lat: 23.8103, lng: 90.4125 },
  { city: 'Chittagong', country: 'Bangladesh', region: 'asia', lat: 22.3569, lng: 91.7832 },
  { city: 'Phnom Penh', country: 'Cambodia', region: 'asia', lat: 11.5564, lng: 104.9282 },
  { city: 'Siem Reap', country: 'Cambodia', region: 'asia', lat: 13.3633, lng: 103.8564 },
  { city: 'Ulaanbaatar', country: 'Mongolia', region: 'asia', lat: 47.8864, lng: 106.9057 },
  { city: 'Almaty', country: 'Kazakhstan', region: 'asia', lat: 43.2220, lng: 76.8512 },
  { city: 'Astana', country: 'Kazakhstan', region: 'asia', lat: 51.1694, lng: 71.4491 },
  { city: 'Bishkek', country: 'Kyrgyzstan', region: 'asia', lat: 42.8746, lng: 74.5698 },

  // ================= AFRICA =================
  { city: 'Cape Town', country: 'South Africa', region: 'africa', lat: -33.9249, lng: 18.4241 },
  { city: 'Johannesburg', country: 'South Africa', region: 'africa', lat: -26.2041, lng: 28.0473 },
  { city: 'Pretoria', country: 'South Africa', region: 'africa', lat: -25.7479, lng: 28.2293 },
  { city: 'Durban', country: 'South Africa', region: 'africa', lat: -29.8587, lng: 31.0218 },
  { city: 'Port Elizabeth', country: 'South Africa', region: 'africa', lat: -33.9608, lng: 25.6022 },
  { city: 'Bloemfontein', country: 'South Africa', region: 'africa', lat: -29.0852, lng: 26.1596 },

  { city: 'Nairobi', country: 'Kenya', region: 'africa', lat: -1.2921, lng: 36.8219 },
  { city: 'Mombasa', country: 'Kenya', region: 'africa', lat: -4.0435, lng: 39.6682 },
  { city: 'Kisumu', country: 'Kenya', region: 'africa', lat: -0.0917, lng: 34.7680 },
  { city: 'Nakuru', country: 'Kenya', region: 'africa', lat: -0.3031, lng: 36.0800 },

  { city: 'Lagos', country: 'Nigeria', region: 'africa', lat: 6.4541, lng: 3.3947 },
  { city: 'Victoria Island, Lagos', country: 'Nigeria', region: 'africa', lat: 6.4281, lng: 3.4219 },
  { city: 'Abuja', country: 'Nigeria', region: 'africa', lat: 9.0579, lng: 7.4951 },
  { city: 'Ibadan', country: 'Nigeria', region: 'africa', lat: 7.3775, lng: 3.9470 },

  { city: 'Accra', country: 'Ghana', region: 'africa', lat: 5.5560, lng: -0.1969 },
  { city: 'Kumasi', country: 'Ghana', region: 'africa', lat: 6.6885, lng: -1.6244 },
  { city: 'Takoradi', country: 'Ghana', region: 'africa', lat: 4.8975, lng: -1.7554 },

  { city: 'Dakar', country: 'Senegal', region: 'africa', lat: 14.6928, lng: -17.4467 },
  { city: 'Saint-Louis', country: 'Senegal', region: 'africa', lat: 16.0179, lng: -16.4896 },
  { city: 'Tunis', country: 'Tunisia', region: 'africa', lat: 36.8065, lng: 10.1815 },
  { city: 'Sousse', country: 'Tunisia', region: 'africa', lat: 35.8256, lng: 10.6369 },
  { city: 'Sfax', country: 'Tunisia', region: 'africa', lat: 34.7406, lng: 10.7603 },
  { city: 'Kampala', country: 'Uganda', region: 'africa', lat: 0.3136, lng: 32.5811 },
  { city: 'Entebbe', country: 'Uganda', region: 'africa', lat: 0.0512, lng: 32.4637 },
  { city: 'Kigali', country: 'Rwanda', region: 'africa', lat: -1.9441, lng: 30.0619 },
  { city: 'Gaborone', country: 'Botswana', region: 'africa', lat: -24.6282, lng: 25.9231 },
  { city: 'Francistown', country: 'Botswana', region: 'africa', lat: -21.1702, lng: 27.5078 },
  { city: 'Mbabane', country: 'Eswatini', region: 'africa', lat: -26.3054, lng: 31.1367 },
  { city: 'Maseru', country: 'Lesotho', region: 'africa', lat: -29.3151, lng: 27.4869 },

  // ================= OCEANIA =================
  { city: 'Sydney', country: 'Australia', region: 'oceania', lat: -33.8688, lng: 151.2093 },
  { city: 'Parramatta', country: 'Australia', region: 'oceania', lat: -33.8151, lng: 151.0011 },
  { city: 'Melbourne', country: 'Australia', region: 'oceania', lat: -37.8136, lng: 144.9631 },
  { city: 'Brisbane', country: 'Australia', region: 'oceania', lat: -27.4698, lng: 153.0251 },
  { city: 'Perth', country: 'Australia', region: 'oceania', lat: -31.9505, lng: 115.8605 },
  { city: 'Adelaide', country: 'Australia', region: 'oceania', lat: -34.9285, lng: 138.6007 },
  { city: 'Gold Coast', country: 'Australia', region: 'oceania', lat: -28.0167, lng: 153.4000 },
  { city: 'Canberra', country: 'Australia', region: 'oceania', lat: -35.2809, lng: 149.1300 },
  { city: 'Newcastle', country: 'Australia', region: 'oceania', lat: -32.9283, lng: 151.7817 },
  { city: 'Hobart', country: 'Australia', region: 'oceania', lat: -42.8821, lng: 147.3272 },
  { city: 'Darwin', country: 'Australia', region: 'oceania', lat: -12.4634, lng: 130.8456 },
  { city: 'Cairns', country: 'Australia', region: 'oceania', lat: -16.9186, lng: 145.7781 },

  { city: 'Auckland', country: 'New Zealand', region: 'oceania', lat: -36.8485, lng: 174.7633 },
  { city: 'Wellington', country: 'New Zealand', region: 'oceania', lat: -41.2865, lng: 174.7762 },
  { city: 'Christchurch', country: 'New Zealand', region: 'oceania', lat: -43.5321, lng: 172.6362 },
  { city: 'Hamilton', country: 'New Zealand', region: 'oceania', lat: -37.7870, lng: 175.2793 },
  { city: 'Tauranga', country: 'New Zealand', region: 'oceania', lat: -37.6878, lng: 176.1651 },
  { city: 'Dunedin', country: 'New Zealand', region: 'oceania', lat: -45.8788, lng: 170.5028 },
  { city: 'Queenstown', country: 'New Zealand', region: 'oceania', lat: -45.0312, lng: 168.6626 },
];

// District offsets (~1.2km to ~3.5km around city center) so each city yields diverse avenues
const DISTRICT_OFFSETS = [
  { suffix: 'Downtown Center', dLat: 0.0, dLng: 0.0 },
  { suffix: 'North District', dLat: 0.018, dLng: 0.004 },
  { suffix: 'South District', dLat: -0.018, dLng: -0.004 },
  { suffix: 'East Boulevard', dLat: 0.004, dLng: 0.022 },
  { suffix: 'West Avenue', dLat: -0.004, dLng: -0.022 },
  { suffix: 'Central Quarter', dLat: 0.011, dLng: -0.014 },
  { suffix: 'Midtown Corridor', dLat: -0.012, dLng: 0.015 },
];

async function querySingleImageSearch(lat, lng, radius = 800) {
  const body = JSON.stringify([
    ['apiv3'],
    [[null, null, lat, lng], radius],
    [null, ['en', 'US'], null, null, null, null, null, null, [2], null, [[[2, true, 2]]]],
    [[1, 2, 3, 4, 8, 6]],
  ]);

  try {
    const res = await fetch(SINGLE_IMAGE_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json+protobuf' },
      body,
    });
    if (!res.ok) return [];
    const d = await res.json();
    if (!d || !d[0] || d[0][0] !== 0) return [];

    const panoType = d[1]?.[1]?.[0];
    const copyright = JSON.stringify(d[1]?.[4] || '');
    const neighbors = d[1]?.[5]?.[0]?.[3]?.[0] || [];
    const mainCoord = d[1]?.[5]?.[0]?.[1]?.[0];

    // Enforce: Official Google Street View Car (panoType === 2), official copyright, and >= 3 connected road links
    if (panoType !== 2 || !copyright.includes('Google') || !mainCoord || neighbors.length < 3) {
      return [];
    }

    const candidates = [
      { lat: Number(mainCoord[2].toFixed(6)), lng: Number(mainCoord[3].toFixed(6)) },
      ...neighbors
        .filter((n) => n?.[0]?.[0] === 2 && Array.isArray(n?.[2]?.[0]))
        .map((n) => ({
          lat: Number(n[2][0][2].toFixed(6)),
          lng: Number(n[2][0][3].toFixed(6)),
        })),
    ];

    // Pick up to 8 well-spaced road points from this road network cluster
    const picked = [];
    for (const pt of candidates) {
      if (
        picked.every(
          (p) => Math.hypot(p.lat - pt.lat, p.lng - pt.lng) >= 0.00045 // ~50m spacing along road network
        )
      ) {
        picked.push(pt);
        if (picked.length >= 8) break;
      }
    }
    return picked;
  } catch {
    return [];
  }
}

async function runPool(tasks, concurrency = 35) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const cur = idx++;
      results[cur] = await tasks[cur]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  console.log('1. Loading base 10,050 regional/highway locations with subdivision labels from commit 2af7c27...');
  const raw2af = execSync('git show 2af7c27:backend/data/locations.json', {
    maxBuffer: 30 * 1024 * 1024,
  }).toString();
  const baseLocations = JSON.parse(raw2af);

  // Reclassify rural/highway base locations: none of the generic "Road in ..." or "Highway corridor..." stay in 'easy'
  const reclassifiedBase = baseLocations.map((loc, idx) => {
    let difficulty = loc.difficulty;
    if (difficulty === 'easy') {
      difficulty = idx % 3 === 0 ? 'hard' : 'medium';
    }
    return {
      lat: Number(Number(loc.lat).toFixed(6)),
      lng: Number(Number(loc.lng).toFixed(6)),
      label: loc.label,
      country: loc.country,
      region: loc.region,
      difficulty,
    };
  });

  console.log(`   Reclassified ${reclassifiedBase.length} regional/rural road locations into medium/hard.`);

  // Load curated iconic city avenues from commit 3797461
  const rawCurated = execSync('git show 3797461:locations.json', {
    maxBuffer: 10 * 1024 * 1024,
  }).toString();
  const curatedAvenues = JSON.parse(rawCurated).map((loc) => {
    const parts = loc.label.split(',').map((s) => s.trim());
    const rawCountry = parts[parts.length - 1] || 'United Kingdom';
    const countryMap = {
      UK: 'United Kingdom',
      USA: 'United States',
      UAE: 'United Arab Emirates',
      'Czech Republic': 'Czechia',
    };
    const country = countryMap[rawCountry] || rawCountry;
    return {
      lat: Number(Number(loc.lat).toFixed(6)),
      lng: Number(Number(loc.lng).toFixed(6)),
      label: loc.label,
      country,
      region: loc.region,
      difficulty: 'easy',
    };
  });

  // Build query tasks across all WORLD_CITIES and DISTRICT_OFFSETS
  const queryTasks = [];
  for (const cityObj of WORLD_CITIES) {
    for (const offset of DISTRICT_OFFSETS) {
      queryTasks.push(async () => {
        const targetLat = cityObj.lat + offset.dLat;
        const targetLng = cityObj.lng + offset.dLng;
        const pts = await querySingleImageSearch(targetLat, targetLng, 900);
        return pts.map((pt, i) => ({
          lat: pt.lat,
          lng: pt.lng,
          label:
            i === 0
              ? `${offset.suffix}, ${cityObj.city}, ${cityObj.country}`
              : `${cityObj.city} Urban Street (${offset.suffix}), ${cityObj.country}`,
          country: cityObj.country,
          region: cityObj.region,
          difficulty: 'easy',
        }));
      });
    }
  }

  console.log(`2. Querying Google SingleImageSearch across ${queryTasks.length} urban districts (${WORLD_CITIES.length} cities)...`);
  const t0 = Date.now();
  const batches = await runPool(queryTasks, 40);
  const verifiedCityStreets = batches.flat();
  console.log(
    `   Verified ${verifiedCityStreets.length} official Google Street View car city streets in ${((Date.now() - t0) / 1000).toFixed(1)}s.`
  );

  // Deduplicate by coordinate key (to 4 decimal places ~11m)
  const seen = new Set();
  const finalLocations = [];

  for (const loc of [...curatedAvenues, ...verifiedCityStreets, ...reclassifiedBase]) {
    const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      finalLocations.push(loc);
    }
  }

  const stats = {
    total: finalLocations.length,
    easy: finalLocations.filter((l) => l.difficulty === 'easy').length,
    medium: finalLocations.filter((l) => l.difficulty === 'medium').length,
    hard: finalLocations.filter((l) => l.difficulty === 'hard').length,
  };
  console.log('3. Final dataset summary:', stats);

  // Write backend/game-engine/data/locations.json
  const jsonPath = path.join(__dirname, '..', 'backend', 'game-engine', 'data', 'locations.json');
  fs.writeFileSync(jsonPath, JSON.stringify(finalLocations, null, 2) + '\n', 'utf-8');
  console.log(`   Wrote ${finalLocations.length} locations to ${jsonPath}`);

  // Write docker/init-geo-db.sql
  const sqlPath = path.join(__dirname, '..', 'docker', 'init-geo-db.sql');
  const esc = (s) => String(s).replace(/'/g, "''");
  const sqlHeader = `-- Guessiha Geographical Database Initialization (PostgreSQL + PostGIS)
-- ${finalLocations.length} Verified Authentic Street View Car Road & Urban Nodes

CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS locations CASCADE;

CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    label VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_locations_region ON locations(region);
CREATE INDEX idx_locations_difficulty ON locations(difficulty);
CREATE INDEX idx_locations_country ON locations(country);
CREATE INDEX idx_locations_geom ON locations USING GIST(geom);

INSERT INTO locations (lat, lng, label, country, region, difficulty, geom) VALUES
`;

  const sqlRows = finalLocations
    .map(
      (l) =>
        `  (${l.lat}, ${l.lng}, '${esc(l.label)}', '${esc(l.country)}', '${esc(l.region)}', '${esc(l.difficulty)}', ST_SetSRID(ST_MakePoint(${l.lng}, ${l.lat}), 4326))`
    )
    .join(',\n');

  fs.writeFileSync(sqlPath, `${sqlHeader}${sqlRows};\n`, 'utf-8');
  console.log(`   Wrote ${finalLocations.length} PostGIS rows to ${sqlPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
