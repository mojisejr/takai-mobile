import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), 'utf8');
const fail = (message) => { console.error(`WARM_NOTEBOOK_FOUNDATION_FAIL: ${message}`); process.exit(1); };
const packageJson = JSON.parse(read('package.json'));
for (const dependency of ['@react-native-vector-icons/material-design-icons', 'expo-font', '@expo-google-fonts/noto-sans-thai']) if (!packageJson.dependencies?.[dependency]) fail(`missing direct dependency ${dependency}`);
const app = read('App.tsx');
for (const marker of ['useFonts', 'NotoSansThai_400Regular', 'NotoSansThai_600SemiBold', 'NotoSansThai_700Bold', 'NotoSansThai_800ExtraBold', 'if (!fontsLoaded && !fontError) return null']) if (!app.includes(marker)) fail(`font-load foundation missing ${marker}`);
const icons = read('src/theme/icons.ts');
for (const marker of ['@react-native-vector-icons/material-design-icons', 'TakaiIconKey', 'takaiIconMap', 'today:', 'people:']) if (!icons.includes(marker)) fail(`typed icon map missing ${marker}`);
const typography = read('src/theme/typography.ts');
if (!typography.includes('typographyStyle') || !typography.includes('fontFamily')) fail('typed typography helper is missing');
if (!existsSync(join(root, 'assets/brand/takai-mascot-bust.png'))) fail('mascot asset must remain available');
console.log('WARM_NOTEBOOK_FOUNDATION_PASS: direct font/icon dependencies, typed helpers, guarded font load, and mascot contract are present');
