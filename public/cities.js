const root = typeof window !== 'undefined' ? window : global;

root.WORLD_CITIES = [
  // Europe
  { city: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "Germany", lat: 52.5200, lng: 13.4050 },
  { city: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038 },
  { city: "Barcelona", country: "Spain", lat: 41.3851, lng: 2.1734 },
  { city: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964 },
  { city: "Milan", country: "Italy", lat: 45.4642, lng: 9.1900 },
  { city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041 },
  { city: "Brussels", country: "Belgium", lat: 50.8503, lng: 4.3517 },
  { city: "Vienna", country: "Austria", lat: 48.2082, lng: 16.3738 },
  { city: "Bern", country: "Switzerland", lat: 46.9480, lng: 7.4474 },
  { city: "Zurich", country: "Switzerland", lat: 47.3769, lng: 8.5417 },
  { city: "Lisbon", country: "Portugal", lat: 38.7223, lng: -9.1393 },
  { city: "Porto", country: "Portugal", lat: 41.1579, lng: -8.6291 },
  { city: "Dublin", country: "Ireland", lat: 53.3498, lng: -6.2603 },
  { city: "Edinburgh", country: "United Kingdom", lat: 55.9533, lng: -3.1883 },
  { city: "Stockholm", country: "Sweden", lat: 59.3293, lng: 18.0686 },
  { city: "Oslo", country: "Norway", lat: 59.9139, lng: 10.7522 },
  { city: "Copenhagen", country: "Denmark", lat: 55.6761, lng: 12.5683 },
  { city: "Helsinki", country: "Finland", lat: 60.1699, lng: 24.9384 },
  { city: "Reykjavik", country: "Iceland", lat: 64.1466, lng: -21.9426 },
  { city: "Prague", country: "Czech Republic", lat: 50.0755, lng: 14.4378 },
  { city: "Warsaw", country: "Poland", lat: 52.2297, lng: 21.0122 },
  { city: "Krakow", country: "Poland", lat: 50.0647, lng: 19.9450 },
  { city: "Budapest", country: "Hungary", lat: 47.4979, lng: 19.0402 },
  { city: "Bucharest", country: "Romania", lat: 44.4268, lng: 26.1025 },
  { city: "Athens", country: "Greece", lat: 37.9838, lng: 23.7275 },
  { city: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784 },
  { city: "Ankara", country: "Turkey", lat: 39.9334, lng: 32.8597 },
  { city: "Kyiv", country: "Ukraine", lat: 50.4501, lng: 30.5234 },
  { city: "Moscow", country: "Russia", lat: 55.7558, lng: 37.6173 },
  { city: "Saint Petersburg", country: "Russia", lat: 59.9343, lng: 30.3351 },
  { city: "Zagreb", country: "Croatia", lat: 45.8150, lng: 15.9819 },
  { city: "Belgrade", country: "Serbia", lat: 44.7866, lng: 20.4489 },
  { city: "Sofia", country: "Bulgaria", lat: 42.6977, lng: 23.3219 },
  { city: "Bratislava", country: "Slovakia", lat: 48.1486, lng: 17.1077 },
  { city: "Ljubljana", country: "Slovenia", lat: 46.0569, lng: 14.5058 },
  { city: "Tallinn", country: "Estonia", lat: 59.4370, lng: 24.7536 },
  { city: "Riga", country: "Latvia", lat: 56.9496, lng: 24.1052 },
  { city: "Vilnius", country: "Lithuania", lat: 54.6872, lng: 25.2797 },
  { city: "Minsk", country: "Belarus", lat: 53.9045, lng: 27.5615 },
  { city: "Valletta", country: "Malta", lat: 35.8989, lng: 14.5146 },
  { city: "Nicosia", country: "Cyprus", lat: 35.1856, lng: 33.3823 },
  { city: "Tbilisi", country: "Georgia", lat: 41.7151, lng: 44.8271 },
  { city: "Yerevan", country: "Armenia", lat: 40.1792, lng: 44.4991 },
  { city: "Baku", country: "Azerbaijan", lat: 40.4093, lng: 49.8671 },

  // North America - USA
  { city: "New York City", country: "United States", lat: 40.7128, lng: -74.0060 },
  { city: "Los Angeles", country: "United States", lat: 34.0522, lng: -118.2437 },
  { city: "Chicago", country: "United States", lat: 41.8781, lng: -87.6298 },
  { city: "Houston", country: "United States", lat: 29.7604, lng: -95.3698 },
  { city: "Phoenix", country: "United States", lat: 33.4484, lng: -112.0740 },
  { city: "Philadelphia", country: "United States", lat: 39.9526, lng: -75.1652 },
  { city: "San Antonio", country: "United States", lat: 29.4241, lng: -98.4936 },
  { city: "San Diego", country: "United States", lat: 32.7157, lng: -117.1611 },
  { city: "Dallas", country: "United States", lat: 32.7767, lng: -96.7970 },
  { city: "San Francisco", country: "United States", lat: 37.7749, lng: -122.4194 },
  { city: "Seattle", country: "United States", lat: 47.6062, lng: -122.3321 },
  { city: "Denver", country: "United States", lat: 39.7392, lng: -104.9903 },
  { city: "Washington, D.C.", country: "United States", lat: 38.9072, lng: -77.0369 },
  { city: "Boston", country: "United States", lat: 42.3601, lng: -71.0589 },
  { city: "Las Vegas", country: "United States", lat: 36.1699, lng: -115.1398 },
  { city: "Miami", country: "United States", lat: 25.7617, lng: -80.1918 },
  { city: "Atlanta", country: "United States", lat: 33.7490, lng: -84.3880 },
  { city: "New Orleans", country: "United States", lat: 29.9511, lng: -90.0715 },
  { city: "Minneapolis", country: "United States", lat: 44.9778, lng: -93.2650 },
  { city: "Detroit", country: "United States", lat: 42.3314, lng: -83.0458 },
  { city: "St. Louis", country: "United States", lat: 38.6270, lng: -90.1994 },
  { city: "Honolulu", country: "Hawaii, United States", lat: 21.3069, lng: -157.8583 },
  { city: "Anchorage", country: "Alaska, United States", lat: 61.2181, lng: -149.9003 },

  // Canada & Mexico
  { city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832 },
  { city: "Montreal", country: "Canada", lat: 45.5017, lng: -73.5673 },
  { city: "Vancouver", country: "Canada", lat: 49.2827, lng: -123.1207 },
  { city: "Calgary", country: "Canada", lat: 51.0447, lng: -114.0719 },
  { city: "Ottawa", country: "Canada", lat: 45.4215, lng: -75.6972 },
  { city: "Edmonton", country: "Canada", lat: 53.5461, lng: -113.4938 },
  { city: "Quebec City", country: "Canada", lat: 46.8139, lng: -71.2080 },
  { city: "Winnipeg", country: "Canada", lat: 49.8951, lng: -97.1384 },
  { city: "Halifax", country: "Canada", lat: 44.6488, lng: -63.5752 },
  { city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332 },
  { city: "Guadalajara", country: "Mexico", lat: 20.6597, lng: -103.3496 },
  { city: "Monterrey", country: "Mexico", lat: 25.6866, lng: -100.3161 },
  { city: "Cancun", country: "Mexico", lat: 21.1619, lng: -86.8515 },
  { city: "Tijuana", country: "Mexico", lat: 32.5149, lng: -117.0382 },

  // Central America & Caribbean
  { city: "Guatemala City", country: "Guatemala", lat: 14.6349, lng: -90.5069 },
  { city: "San Salvador", country: "El Salvador", lat: 13.6929, lng: -89.2182 },
  { city: "Tegucigalpa", country: "Honduras", lat: 14.0723, lng: -87.1921 },
  { city: "Managua", country: "Nicaragua", lat: 12.1150, lng: -86.2362 },
  { city: "San Jose", country: "Costa Rica", lat: 9.9281, lng: -84.0907 },
  { city: "Panama City", country: "Panama", lat: 8.9824, lng: -79.5199 },
  { city: "Havana", country: "Cuba", lat: 23.1136, lng: -82.3666 },
  { city: "Santo Domingo", country: "Dominican Republic", lat: 18.4861, lng: -69.9312 },
  { city: "San Juan", country: "Puerto Rico", lat: 18.4655, lng: -66.1057 },
  { city: "Kingston", country: "Jamaica", lat: 18.0179, lng: -76.8099 },
  { city: "Nassau", country: "Bahamas", lat: 25.0480, lng: -77.3554 },

  // South America
  { city: "Sao Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
  { city: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729 },
  { city: "Brasilia", country: "Brazil", lat: -15.7975, lng: -47.8919 },
  { city: "Salvador", country: "Brazil", lat: -12.9777, lng: -38.5016 },
  { city: "Fortaleza", country: "Brazil", lat: -3.7319, lng: -38.5267 },
  { city: "Belo Horizonte", country: "Brazil", lat: -19.9167, lng: -43.9345 },
  { city: "Manaus", country: "Brazil", lat: -3.1190, lng: -60.0217 },
  { city: "Curitiba", country: "Brazil", lat: -25.4290, lng: -49.2671 },
  { city: "Porto Alegre", country: "Brazil", lat: -30.0346, lng: -51.2177 },
  { city: "Buenos Aires", country: "Argentina", lat: -34.6037, lng: -58.3816 },
  { city: "Cordoba", country: "Argentina", lat: -31.4201, lng: -64.1888 },
  { city: "Rosario", country: "Argentina", lat: -32.9468, lng: -60.6393 },
  { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458 },
  { city: "Santiago", country: "Chile", lat: -33.4489, lng: -70.6693 },
  { city: "Valparaiso", country: "Chile", lat: -33.0472, lng: -71.6127 },
  { city: "Lima", country: "Peru", lat: -12.0464, lng: -77.0428 },
  { city: "Cusco", country: "Peru", lat: -13.5319, lng: -71.9675 },
  { city: "Bogota", country: "Colombia", lat: 4.7110, lng: -74.0721 },
  { city: "Medellin", country: "Colombia", lat: 6.2442, lng: -75.5812 },
  { city: "Cali", country: "Colombia", lat: 3.4516, lng: -76.5320 },
  { city: "Cartagena", country: "Colombia", lat: 10.3910, lng: -75.4794 },
  { city: "Caracas", country: "Venezuela", lat: 10.4806, lng: -66.9036 },
  { city: "Quito", country: "Ecuador", lat: -0.1807, lng: -78.4678 },
  { city: "Guayaquil", country: "Ecuador", lat: -2.1894, lng: -79.8891 },
  { city: "La Paz", country: "Bolivia", lat: -16.5000, lng: -68.1500 },
  { city: "Sucre", country: "Bolivia", lat: -19.0196, lng: -65.2619 },
  { city: "Montevideo", country: "Uruguay", lat: -34.9011, lng: -56.1645 },
  { city: "Asuncion", country: "Paraguay", lat: -25.2637, lng: -57.5759 },
  { city: "Georgetown", country: "Guyana", lat: 6.8013, lng: -58.1551 },
  { city: "Paramaribo", country: "Suriname", lat: 5.8520, lng: -55.2038 },

  // Asia - East Asia
  { city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { city: "Osaka", country: "Japan", lat: 34.6937, lng: 135.5023 },
  { city: "Kyoto", country: "Japan", lat: 35.0116, lng: 135.7681 },
  { city: "Sapporo", country: "Japan", lat: 43.0618, lng: 141.3545 },
  { city: "Fukuoka", country: "Japan", lat: 33.5904, lng: 130.4017 },
  { city: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.9780 },
  { city: "Busan", country: "South Korea", lat: 35.1796, lng: 129.0756 },
  { city: "Beijing", country: "China", lat: 39.9042, lng: 116.4074 },
  { city: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737 },
  { city: "Guangzhou", country: "China", lat: 23.1291, lng: 113.2644 },
  { city: "Shenzhen", country: "China", lat: 22.5431, lng: 114.0579 },
  { city: "Hong Kong", country: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { city: "Taipei", country: "Taiwan", lat: 25.0330, lng: 121.5654 },
  { city: "Kaohsiung", country: "Taiwan", lat: 22.6273, lng: 120.3014 },
  { city: "Ulaanbaatar", country: "Mongolia", lat: 47.9188, lng: 106.9176 },

  // Southeast Asia
  { city: "Bangkok", country: "Thailand", lat: 13.7563, lng: 100.5018 },
  { city: "Chiang Mai", country: "Thailand", lat: 18.7883, lng: 98.9853 },
  { city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { city: "Kuala Lumpur", country: "Malaysia", lat: 3.1390, lng: 101.6869 },
  { city: "Penang", country: "Malaysia", lat: 5.4164, lng: 100.3327 },
  { city: "Jakarta", country: "Indonesia", lat: -6.2088, lng: 106.8456 },
  { city: "Bali / Denpasar", country: "Indonesia", lat: -8.6705, lng: 115.2126 },
  { city: "Surabaya", country: "Indonesia", lat: -7.2575, lng: 112.7521 },
  { city: "Manila", country: "Philippines", lat: 14.5995, lng: 120.9842 },
  { city: "Cebu City", country: "Philippines", lat: 10.3157, lng: 123.8854 },
  { city: "Ho Chi Minh City", country: "Vietnam", lat: 10.8231, lng: 106.6297 },
  { city: "Hanoi", country: "Vietnam", lat: 21.0285, lng: 105.8542 },
  { city: "Phnom Penh", country: "Cambodia", lat: 11.5564, lng: 104.9282 },
  { city: "Vientiane", country: "Laos", lat: 17.9757, lng: 102.6331 },
  { city: "Yangon", country: "Myanmar", lat: 16.8661, lng: 96.1951 },
  { city: "Bandar Seri Begawan", country: "Brunei", lat: 4.9031, lng: 114.9398 },

  // South Asia
  { city: "New Delhi", country: "India", lat: 28.6139, lng: 77.2090 },
  { city: "Mumbai", country: "India", lat: 19.0760, lng: 72.8777 },
  { city: "Bengaluru", country: "India", lat: 12.9716, lng: 77.5946 },
  { city: "Kolkata", country: "India", lat: 22.5726, lng: 88.3639 },
  { city: "Chennai", country: "India", lat: 13.0827, lng: 80.2707 },
  { city: "Hyderabad", country: "India", lat: 17.3850, lng: 78.4867 },
  { city: "Islamabad", country: "Pakistan", lat: 33.6844, lng: 73.0479 },
  { city: "Karachi", country: "Pakistan", lat: 24.8607, lng: 67.0011 },
  { city: "Lahore", country: "Pakistan", lat: 31.5204, lng: 74.3587 },
  { city: "Dhaka", country: "Bangladesh", lat: 23.8103, lng: 90.4125 },
  { city: "Colombo", country: "Sri Lanka", lat: 6.9271, lng: 79.8612 },
  { city: "Kathmandu", country: "Nepal", lat: 27.7172, lng: 85.3240 },
  { city: "Thimphu", country: "Bhutan", lat: 27.4728, lng: 89.6393 },

  // Middle East & Central Asia
  { city: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708 },
  { city: "Abu Dhabi", country: "United Arab Emirates", lat: 24.4539, lng: 54.3773 },
  { city: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lng: 46.6753 },
  { city: "Jeddah", country: "Saudi Arabia", lat: 21.4858, lng: 39.1925 },
  { city: "Doha", country: "Qatar", lat: 25.2854, lng: 51.5310 },
  { city: "Kuwait City", country: "Kuwait", lat: 29.3759, lng: 47.9774 },
  { city: "Manama", country: "Bahrain", lat: 26.2285, lng: 50.5860 },
  { city: "Muscat", country: "Oman", lat: 23.5880, lng: 58.3829 },
  { city: "Amman", country: "Jordan", lat: 31.9454, lng: 35.9284 },
  { city: "Jerusalem", country: "Israel / Palestine", lat: 31.7683, lng: 35.2137 },
  { city: "Tel Aviv", country: "Israel", lat: 32.0853, lng: 34.7818 },
  { city: "Beirut", country: "Lebanon", lat: 33.8938, lng: 35.5018 },
  { city: "Baghdad", country: "Iraq", lat: 33.3152, lng: 44.3661 },
  { city: "Tehran", country: "Iran", lat: 35.6892, lng: 51.3890 },
  { city: "Astana", country: "Kazakhstan", lat: 51.1694, lng: 71.4491 },
  { city: "Almaty", country: "Kazakhstan", lat: 43.2220, lng: 76.8512 },
  { city: "Tashkent", country: "Uzbekistan", lat: 41.2995, lng: 69.2401 },

  // Africa
  { city: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357 },
  { city: "Alexandria", country: "Egypt", lat: 31.2001, lng: 29.9187 },
  { city: "Casablanca", country: "Morocco", lat: 33.5731, lng: -7.5898 },
  { city: "Marrakech", country: "Morocco", lat: 31.6295, lng: -7.9811 },
  { city: "Rabat", country: "Morocco", lat: 34.0209, lng: -6.8416 },
  { city: "Algiers", country: "Algeria", lat: 36.7538, lng: 3.0588 },
  { city: "Tunis", country: "Tunisia", lat: 36.8065, lng: 10.1815 },
  { city: "Tripoli", country: "Libya", lat: 32.8872, lng: 13.1913 },
  { city: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241 },
  { city: "Johannesburg", country: "South Africa", lat: -26.2041, lng: 28.0473 },
  { city: "Durban", country: "South Africa", lat: -29.8587, lng: 31.0218 },
  { city: "Nairobi", country: "Kenya", lat: -1.2921, lng: 36.8219 },
  { city: "Mombasa", country: "Kenya", lat: -4.0435, lng: 39.6682 },
  { city: "Addis Ababa", country: "Ethiopia", lat: 9.0300, lng: 38.7400 },
  { city: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792 },
  { city: "Abuja", country: "Nigeria", lat: 9.0765, lng: 7.3986 },
  { city: "Accra", country: "Ghana", lat: 5.6037, lng: -0.1870 },
  { city: "Dakar", country: "Senegal", lat: 14.7167, lng: -17.4677 },
  { city: "Abidjan", country: "Ivory Coast", lat: 5.3600, lng: -4.0083 },
  { city: "Kinshasa", country: "DR Congo", lat: -4.4419, lng: 15.2663 },
  { city: "Luanda", country: "Angola", lat: -8.8390, lng: 13.2894 },
  { city: "Dar es Salaam", country: "Tanzania", lat: -6.7924, lng: 39.2083 },
  { city: "Kampala", country: "Uganda", lat: 0.3476, lng: 32.5825 },
  { city: "Kigali", country: "Rwanda", lat: -1.9706, lng: 30.1044 },
  { city: "Antananarivo", country: "Madagascar", lat: -18.8792, lng: 47.5079 },
  { city: "Windhoek", country: "Namibia", lat: -22.5609, lng: 17.0658 },
  { city: "Gaborone", country: "Botswana", lat: -24.6282, lng: 25.9231 },
  { city: "Harare", country: "Zimbabwe", lat: -17.8252, lng: 31.0335 },
  { city: "Lusaka", country: "Zambia", lat: -15.3875, lng: 28.3228 },
  { city: "Maputo", country: "Mozambique", lat: -25.9692, lng: 32.5732 },
  { city: "Port Louis", country: "Mauritius", lat: -20.1609, lng: 57.5012 },

  // Oceania
  { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
  { city: "Melbourne", country: "Australia", lat: -37.8136, lng: 144.9631 },
  { city: "Brisbane", country: "Australia", lat: -27.4698, lng: 153.0251 },
  { city: "Perth", country: "Australia", lat: -31.9505, lng: 115.8605 },
  { city: "Adelaide", country: "Australia", lat: -34.9285, lng: 138.6007 },
  { city: "Canberra", country: "Australia", lat: -35.2809, lng: 149.1300 },
  { city: "Darwin", country: "Australia", lat: -12.4634, lng: 130.8456 },
  { city: "Hobart", country: "Tasmania, Australia", lat: -42.8821, lng: 147.3272 },
  { city: "Auckland", country: "New Zealand", lat: -36.8485, lng: 174.7633 },
  { city: "Wellington", country: "New Zealand", lat: -41.2865, lng: 174.7762 },
  { city: "Christchurch", country: "New Zealand", lat: -43.5321, lng: 172.6362 },
  { city: "Suva", country: "Fiji", lat: -18.1416, lng: 178.4419 },
  { city: "Port Moresby", country: "Papua New Guinea", lat: -9.4438, lng: 147.1803 },
  { city: "Noumea", country: "New Caledonia", lat: -22.2758, lng: 166.4580 },
  { city: "Papeete", country: "French Polynesia", lat: -17.5516, lng: -149.5585 },
  { city: "Apia", country: "Samoa", lat: -13.8333, lng: -171.7667 },

  // Remote & Atlantic / Pacific / Indian Islands
  { city: "Ponta Delgada", country: "Azores, Portugal", lat: 37.7412, lng: -25.6756 },
  { city: "Funchal", country: "Madeira, Portugal", lat: 32.6669, lng: -16.9241 },
  { city: "Las Palmas", country: "Canary Islands, Spain", lat: 28.1235, lng: -15.4363 },
  { city: "Santa Cruz de Tenerife", country: "Canary Islands, Spain", lat: 28.4636, lng: -16.2518 },
  { city: "Praia", country: "Cape Verde", lat: 14.9330, lng: -23.5133 },
  { city: "Nuuk", country: "Greenland", lat: 64.1814, lng: -51.6941 },
  { city: "Hamilton", country: "Bermuda", lat: 32.2948, lng: -64.7830 },
  { city: "Longyearbyen", country: "Svalbard, Norway", lat: 78.2232, lng: 15.6267 },
  { city: "Ushuaia", country: "Tierra del Fuego, Argentina", lat: -54.8019, lng: -68.3030 },
  { city: "Stanley", country: "Falkland Islands", lat: -51.6977, lng: -57.8517 }
];

/**
 * Fast client-side nearest city finder using Haversine formula
 */
root.findNearestCity = function(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  let nearest = null;
  let minDist = Infinity;

  const cities = root.WORLD_CITIES || [];
  for (let i = 0; i < cities.length; i++) {
    const c = cities[i];
    const dLat = toRad(c.lat - lat);
    const dLon = toRad(c.lng - lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) * Math.cos(toRad(c.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (dist < minDist) {
      minDist = dist;
      nearest = c;
    }
  }

  if (!nearest) return null;
  return {
    city: nearest.city,
    country: nearest.country,
    distanceKm: Math.round(minDist),
  };
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WORLD_CITIES: root.WORLD_CITIES,
    findNearestCity: root.findNearestCity,
  };
}
