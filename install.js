import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('--- STARTING SAP DMC MCP SERVER SETUP ---');

// 1. Run npm install
console.log('\n[1/3] Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ Dependencies installed successfully.');
} catch (err) {
  console.error('X Failed to install dependencies:', err);
  process.exit(1);
}

// 2. Run npm run build
console.log('\n[2/3] Compiling TypeScript codebase...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ Code compiled successfully.');
} catch (err) {
  console.error('X Compilation failed:', err);
  process.exit(1);
}

// 3. Register server in Claude Desktop config
console.log('\n[3/3] Registering MCP server in Claude Desktop config...');

// Standard Windows AppData paths for Claude Desktop config
const userProfile = process.env.USERPROFILE || '';
const appData = process.env.APPDATA || '';

const possibleConfigPaths = [
  // 1. Windows Store package path (extremely common)
  join(userProfile, 'AppData', 'Local', 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  // 2. Standard Roaming path
  join(appData, 'Claude', 'claude_desktop_config.json')
];

let configPath = '';
for (const p of possibleConfigPaths) {
  if (existsSync(p)) {
    configPath = p;
    break;
  }
}

if (!configPath) {
  // Default to standard Roaming path if neither exists
  configPath = join(appData, 'Claude', 'claude_desktop_config.json');
  console.log(`⚠ Config file not found. Creating a new one at default path: ${configPath}`);
} else {
  console.log(`✓ Located Claude Desktop configuration at: ${configPath}`);
}

let config = { mcpServers: {} };
if (existsSync(configPath)) {
  try {
    const rawContent = readFileSync(configPath, 'utf8');
    config = JSON.parse(rawContent);
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
  } catch (parseError) {
    console.warn('⚠ Failed to parse existing config, creating a clean config structure.');
  }
}

// Set up server paths using forward slashes for Windows safety
const mainScriptPath = join(__dirname, 'dist', 'index.js').replace(/\\/g, '/');

// Register the server (no credentials needed in JSON since they read from local .env)
config.mcpServers['sap-dmc-multi-protocol'] = {
  command: 'node',
  args: [mainScriptPath]
};

try {
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('✓ Successfully registered MCP Server inside Claude Desktop!');
} catch (writeError) {
  console.error('X Failed to write Claude configuration:', writeError);
  process.exit(1);
}

console.log('\n==================================================');
console.log('🎉 SETUP SUCCESSFUL!');
console.log('==================================================');
console.log('1. Copy .env.example to .env (if you haven\'t already).');
console.log('2. Configure your BTP Client ID/Secret and credentials in .env.');
console.log('3. Restart Claude Desktop completely (Quit from System Tray first!).');
console.log('==================================================\n');
