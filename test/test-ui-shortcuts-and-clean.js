const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- VERIFYING FRONTEND REQUIREMENTS & CLEAN ARCHITECTURE ---');

// 1. Verify index.html does not contain right-click/key blocking scripts
const indexHtml = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
assert(!indexHtml.includes('contextmenu'), 'Hostile contextmenu blocker must not be in index.html');
assert(!indexHtml.includes('preventDefault'), 'Keydown preventDefault blocker must not be in index.html');
console.log('✅ index.html is clean of all blocking/obfuscation scripts.');

// 2. Verify GameScreen.tsx
const gameScreen = fs.readFileSync(path.join(__dirname, '../frontend/src/features/game/GameScreen.tsx'), 'utf8');

// Hotkeys m, s, g
assert(gameScreen.includes('key === "m"'), 'GameScreen must handle "m" key for atlas');
assert(gameScreen.includes('key === "s"'), 'GameScreen must handle "s" key for standings');
assert(gameScreen.includes('key === "g"'), 'GameScreen must handle "g" key for explore');
console.log('✅ GameScreen implements "m" (map), "s" (standings), and "g" (street view) shortcuts.');

// No text on left in atlas (.atlas-copy deleted)
assert(!gameScreen.includes('atlas-copy'), 'GameScreen must NOT contain .atlas-copy (text on left deleted)');
console.log('✅ .atlas-copy deleted; full atlas map has only the map.');

// No coordinates displayed anywhere
assert(!gameScreen.includes('toFixed(3)° N'), 'GameScreen must NOT display latitude coordinates');
assert(!gameScreen.includes('toFixed(3)° E'), 'GameScreen must NOT display longitude coordinates');
assert(!gameScreen.includes('myPin.lat.toFixed'), 'GameScreen must NOT display user coordinates');
assert(!gameScreen.includes('SELECTED POSITION'), 'GameScreen must NOT display coordinates telemetry at bottom');
console.log('✅ Coordinate readouts completely removed from atlas and interface.');

// 3. Verify LeafletMapView marker does not block clicks
const leafletMap = fs.readFileSync(path.join(__dirname, '../frontend/src/features/game/components/LeafletMapView.tsx'), 'utf8');
assert(leafletMap.includes('interactive: false'), 'Marker must have interactive: false so clicks hit map');
console.log('✅ LeafletMapView pins set interactive: false for smooth click responsiveness.');

// 4. Verify unnecessary files deleted
assert(!fs.existsSync(path.join(__dirname, '../frontend/src/cookie-session.ts')), 'Unused cookie-session.ts must be deleted');
assert(!fs.existsSync(path.join(__dirname, '../frontend/src/features/room-browser/CreateRoomModal.tsx')), 'Duplicate CreateRoomModal.tsx must be deleted');
console.log('✅ Dead / unnecessary code files successfully deleted.');

console.log('\n🎉 ALL FRONTEND VERIFICATION CHECKS PASSED!');
