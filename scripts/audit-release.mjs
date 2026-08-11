import fs from 'node:fs';

const fail = (message) => { console.error(`RELEASE_CONTRACT=FAIL ${message}`); process.exit(1); };
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = fs.readFileSync('VERSION', 'utf8').trim();
const identity = fs.readFileSync('src/data/viryaIdentity.ts', 'utf8');
const llms = fs.readFileSync('public/llms.txt', 'utf8');
const home = fs.readFileSync('src/pages/index.astro', 'utf8');
const homePl = fs.readFileSync('src/pages/pl/index.astro', 'utf8');

if (pkg.version !== '1.0.0' || version !== '1.0.0') fail('version mismatch');
if (pkg.private !== true) fail('website must remain a private deployable product, not an npm SDK');
if (!identity.includes('https://www.virya.music/#band') || !identity.includes('MusicGroup')) fail('canonical MusicGroup identity missing');
if (!identity.includes('6bbW0jOKAWJWm3h6CTWaAS')) fail('canonical Spotify identity missing');
if (!llms.includes('VIRYA') || !llms.includes('virya.music')) fail('first-party llms identity missing');
if (!home.includes('serializeViryaIdentity') || !homePl.includes('serializeViryaIdentity')) fail('JSON-LD identity missing from home routes');
console.log('RELEASE_CONTRACT=PASS version=1.0.0 identity=stable npm=private');
