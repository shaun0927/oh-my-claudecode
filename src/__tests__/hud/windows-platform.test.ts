import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..', '..', '..');

/**
 * Windows Platform Compatibility Tests
 *
 * Verifies that HUD components work correctly on Windows by:
 * 1. Checking bridge NODE_PATH separator uses platform-aware logic
 * 2. Mocking process.platform to test Windows code paths
 * 3. Verifying ASCII fallback for emoji on Windows
 * 4. Verifying shell:true for git execSync on Windows
 * 5. Verifying safe mode auto-enable on Windows
 *
 * Related: GitHub Issue #739
 */

describe('Windows HUD Platform Fixes (#739)', () => {
  // =========================================================================
  // P0: NODE_PATH separator in bridge files
  // =========================================================================
  describe('P0: Bridge NODE_PATH separator', () => {
    const bridgeFiles = [
      'bridge/mcp-server.cjs',
      'bridge/team-bridge.cjs',
      'bridge/codex-server.cjs',
      'bridge/gemini-server.cjs',
    ];

    for (const file of bridgeFiles) {
      describe(file, () => {
        let content: string;

        beforeEach(() => {
          content = readFileSync(join(packageRoot, file), 'utf-8');
        });

        it('should NOT have hardcoded colon separator', () => {
          // The old buggy pattern: ':' + process.env.NODE_PATH
          expect(content).not.toMatch(/process\.env\.NODE_PATH \? ':' \+ process\.env\.NODE_PATH/);
        });

        it('should use platform-aware separator variable', () => {
          // The fix: var _sep = process.platform === 'win32' ? ';' : ':';
          expect(content).toContain("process.platform === 'win32' ? ';' : ':'");
        });

        it('should use _sep variable for NODE_PATH concatenation', () => {
          expect(content).toMatch(/_sep \+ process\.env\.NODE_PATH/);
        });
      });
    }

    // Also verify the build scripts (source of truth)
    const buildScripts = [
      'scripts/build-mcp-server.mjs',
      'scripts/build-bridge-entry.mjs',
      'scripts/build-codex-server.mjs',
      'scripts/build-gemini-server.mjs',
    ];

    for (const script of buildScripts) {
      it(`${script} should use platform-aware separator in banner`, () => {
        const content = readFileSync(join(packageRoot, script), 'utf-8');
        expect(content).toContain("process.platform === 'win32' ? ';' : ':'");
        expect(content).not.toMatch(/NODE_PATH \? ':' \+ process\.env\.NODE_PATH/);
      });
    }
  });

  // =========================================================================
  // P0: NODE_PATH separator logic validation
  // =========================================================================
  describe('P0: NODE_PATH separator logic', () => {
    it('should produce semicolon on win32', () => {
      const sep = 'win32' === 'win32' ? ';' : ':';
      expect(sep).toBe(';');
    });

    it('should produce colon on darwin', () => {
      const sep = 'darwin' === 'win32' ? ';' : ':';
      expect(sep).toBe(':');
    });

    it('should produce colon on linux', () => {
      const sep = 'linux' === 'win32' ? ';' : ':';
      expect(sep).toBe(':');
    });

    it('should correctly build NODE_PATH with existing value on Windows', () => {
      const platform = 'win32';
      const globalRoot = 'C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules';
      const existingNodePath = 'C:\\some\\other\\path';
      const sep = platform === 'win32' ? ';' : ':';
      const result = globalRoot + (existingNodePath ? sep + existingNodePath : '');
      expect(result).toBe('C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules;C:\\some\\other\\path');
      expect(result).not.toContain(':C:\\');
    });

    it('should correctly build NODE_PATH without existing value on Windows', () => {
      const platform = 'win32';
      const globalRoot = 'C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules';
      const existingNodePath = '';
      const sep = platform === 'win32' ? ';' : ':';
      const result = globalRoot + (existingNodePath ? sep + existingNodePath : '');
      expect(result).toBe('C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules');
    });
  });

  // =========================================================================
  // P1: Call counts emoji vs ASCII
  // =========================================================================
  describe('P1: Call counts Windows ASCII fallback', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      vi.resetModules();
    });

    it('should use emoji icons on macOS/Linux (current platform)', async () => {
      // On non-Windows, should use emoji
      const { renderCallCounts } = await import('../../hud/elements/call-counts.js');
      const result = renderCallCounts(42, 7, 3);
      expect(result).toContain('\u{1F527}'); // 🔧
      expect(result).toContain('\u{1F916}'); // 🤖
      expect(result).toContain('\u26A1');    // ⚡
    });

    it('should use ASCII icons on Windows', async () => {
      // Mock platform as win32 BEFORE importing the module
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.resetModules();

      const mod = await import('../../hud/elements/call-counts.js');
      const result = mod.renderCallCounts(42, 7, 3);
      expect(result).toBe('T:42 A:7 S:3');
      expect(result).not.toContain('\u{1F527}');
      expect(result).not.toContain('\u{1F916}');
      expect(result).not.toContain('\u26A1');
    });

    it('should return null for zero counts on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.resetModules();

      const mod = await import('../../hud/elements/call-counts.js');
      expect(mod.renderCallCounts(0, 0, 0)).toBeNull();
    });

    it('should render partial counts correctly on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.resetModules();

      const mod = await import('../../hud/elements/call-counts.js');
      expect(mod.renderCallCounts(10, 0, 0)).toBe('T:10');
      expect(mod.renderCallCounts(0, 5, 0)).toBe('A:5');
      expect(mod.renderCallCounts(0, 0, 2)).toBe('S:2');
    });
  });

  // =========================================================================
  // P1: Git shell:true on Windows
  // =========================================================================
  describe('P1: Git execSync shell option', () => {
    it('git.ts should use conditional shell option', () => {
      const content = readFileSync(
        join(packageRoot, 'src', 'hud', 'elements', 'git.ts'),
        'utf-8',
      );
      // Should have platform-conditional shell option
      expect(content).toContain("shell: process.platform === 'win32' ? true : undefined");
    });

    it('shell option logic should produce true on win32', () => {
      const shell = 'win32' === 'win32' ? true : undefined;
      expect(shell).toBe(true);
    });

    it('shell option logic should produce undefined on darwin', () => {
      const shell = 'darwin' === 'win32' ? true : undefined;
      expect(shell).toBeUndefined();
    });

    it('shell option logic should produce undefined on linux', () => {
      const shell = 'linux' === 'win32' ? true : undefined;
      expect(shell).toBeUndefined();
    });
  });

  // =========================================================================
  // P2: Safe mode auto-enable on Windows
  // =========================================================================
  describe('P2: Safe mode auto-enable on Windows', () => {
    it('index.ts should auto-enable safe mode on Windows', () => {
      const content = readFileSync(
        join(packageRoot, 'src', 'hud', 'index.ts'),
        'utf-8',
      );
      // Should have Windows safe mode auto-enable
      expect(content).toContain("process.platform === 'win32'");
      // Should combine config safeMode with platform check
      expect(content).toMatch(/config\.elements\.safeMode \|\| process\.platform === 'win32'/);
    });

    it('safe mode logic: config=false on Mac → disabled', () => {
      const configSafeMode = false;
      const platform = 'darwin';
      const useSafeMode = configSafeMode || platform === 'win32';
      expect(useSafeMode).toBe(false);
    });

    it('safe mode logic: config=false on Windows → auto-enabled', () => {
      const configSafeMode = false;
      const platform = 'win32';
      const useSafeMode = configSafeMode || platform === 'win32';
      expect(useSafeMode).toBe(true);
    });

    it('safe mode logic: config=true on Mac → enabled', () => {
      const configSafeMode = true;
      const platform = 'darwin';
      const useSafeMode = configSafeMode || platform === 'win32';
      expect(useSafeMode).toBe(true);
    });

    it('safe mode logic: config=true on Windows → enabled', () => {
      const configSafeMode = true;
      const platform = 'win32';
      const useSafeMode = configSafeMode || platform === 'win32';
      expect(useSafeMode).toBe(true);
    });

    it('safe mode logic: config=false on Linux → disabled', () => {
      const configSafeMode = false;
      const platform = 'linux';
      const useSafeMode = configSafeMode || platform === 'win32';
      expect(useSafeMode).toBe(false);
    });
  });
});
