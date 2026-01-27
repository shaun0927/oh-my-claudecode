import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/**
 * HUD Windows Compatibility Tests
 *
 * These tests verify fixes for GitHub Issue #138:
 * - Bug 1: File naming (sisyphus-hud.mjs → omc-hud.mjs)
 * - Bug 2: Windows ~ expansion (documentation updates)
 * - Bug 3: Windows dynamic import() requires file:// URLs
 * - Bug 4: Version sorting (numeric vs lexicographic)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..', '..');

describe('HUD Windows Compatibility (Issue #138)', () => {
  describe('Bug 1: File Naming (Rebranding)', () => {
    it('session-start.mjs should reference omc-hud.mjs, not sisyphus-hud.mjs', () => {
      const sessionStartPath = join(packageRoot, 'scripts', 'session-start.mjs');
      expect(existsSync(sessionStartPath)).toBe(true);

      const content = readFileSync(sessionStartPath, 'utf-8');

      // Should use the new name
      expect(content).toContain('omc-hud.mjs');

      // Should NOT use the old name
      expect(content).not.toContain('sisyphus-hud.mjs');
    });

    it('installer should create omc-hud.mjs, not sisyphus-hud.mjs', () => {
      const installerPath = join(packageRoot, 'src', 'installer', 'index.ts');
      expect(existsSync(installerPath)).toBe(true);

      const content = readFileSync(installerPath, 'utf-8');

      // Should use the new name
      expect(content).toContain('omc-hud.mjs');

      // Should NOT use the old name
      expect(content).not.toContain('sisyphus-hud.mjs');
    });
  });

  describe('Bug 2: Windows ~ Path Expansion', () => {
    it('hud.md should document Windows path syntax', () => {
      const hudMdPath = join(packageRoot, 'commands', 'hud.md');
      expect(existsSync(hudMdPath)).toBe(true);

      const content = readFileSync(hudMdPath, 'utf-8');

      // Should document Windows path
      expect(content).toContain('%USERPROFILE%');

      // Should explain the issue
      expect(content).toMatch(/Windows.*Node\.js.*doesn.*expand.*~/i);
    });

    it('SKILL.md should document Windows path syntax', () => {
      const skillMdPath = join(packageRoot, 'skills', 'hud', 'SKILL.md');
      expect(existsSync(skillMdPath)).toBe(true);

      const content = readFileSync(skillMdPath, 'utf-8');

      // Should document Windows path
      expect(content).toContain('%USERPROFILE%');

      // Should explain the issue
      expect(content).toMatch(/Windows.*Node\.js.*doesn.*expand.*~/i);
    });

    it('installer should use absolute paths for statusLine command', () => {
      const installerPath = join(packageRoot, 'src', 'installer', 'index.ts');
      const content = readFileSync(installerPath, 'utf-8');

      // The installer constructs the path using join() which produces absolute paths
      // It uses: command: 'node ' + hudScriptPath
      expect(content).toContain("command: 'node ' + hudScriptPath");

      // hudScriptPath is constructed with join(HUD_DIR, ...), not hardcoded with ~
      expect(content).toContain("join(HUD_DIR, 'omc-hud.mjs')");
    });
  });

  describe('Bug 3: Windows Dynamic Import Path', () => {
    it('installer HUD script should use pathToFileURL for imports', () => {
      const installerPath = join(packageRoot, 'src', 'installer', 'index.ts');
      const content = readFileSync(installerPath, 'utf-8');

      // Should import pathToFileURL
      expect(content).toContain("pathToFileURL");

      // Should use pathToFileURL for plugin path import
      expect(content).toContain('pathToFileURL(pluginPath).href');

      // Should use pathToFileURL for dev path import
      expect(content).toContain('pathToFileURL(devPath).href');
    });

    it('hud.md embedded script should use pathToFileURL', () => {
      const hudMdPath = join(packageRoot, 'commands', 'hud.md');
      const content = readFileSync(hudMdPath, 'utf-8');

      // Should import pathToFileURL
      expect(content).toContain('import { pathToFileURL } from "node:url"');

      // Should use pathToFileURL for imports
      expect(content).toContain('pathToFileURL(pluginPath).href');
      expect(content).toContain('pathToFileURL(devPath).href');
    });

    it('SKILL.md embedded script should use pathToFileURL', () => {
      const skillMdPath = join(packageRoot, 'skills', 'hud', 'SKILL.md');
      const content = readFileSync(skillMdPath, 'utf-8');

      // Should import pathToFileURL
      expect(content).toContain('import { pathToFileURL } from "node:url"');

      // Should use pathToFileURL for imports
      expect(content).toContain('pathToFileURL(pluginPath).href');
      expect(content).toContain('pathToFileURL(devPath).href');
    });

    it('pathToFileURL should correctly convert paths', () => {
      // Unix path
      const unixPath = '/home/user/test.js';
      expect(pathToFileURL(unixPath).href).toBe('file:///home/user/test.js');

      // Path with spaces
      const spacePath = '/path/with spaces/file.js';
      expect(pathToFileURL(spacePath).href).toBe('file:///path/with%20spaces/file.js');
    });
  });

  describe('Bug 4: Version Sorting', () => {
    it('installer HUD script should use numeric version sorting', () => {
      const installerPath = join(packageRoot, 'src', 'installer', 'index.ts');
      const content = readFileSync(installerPath, 'utf-8');

      // Should use localeCompare with numeric option
      expect(content).toContain('localeCompare(b, undefined, { numeric: true })');
    });

    it('hud.md embedded script should use numeric version sorting', () => {
      const hudMdPath = join(packageRoot, 'commands', 'hud.md');
      const content = readFileSync(hudMdPath, 'utf-8');

      // Should use localeCompare with numeric option
      expect(content).toContain('localeCompare(b, undefined, { numeric: true })');

      // Should NOT use simple sort().reverse()
      // The old pattern was: versions.sort().reverse()[0]
      expect(content).not.toMatch(/versions\.sort\(\)\.reverse\(\)/);
    });

    it('SKILL.md embedded script should use numeric version sorting', () => {
      const skillMdPath = join(packageRoot, 'skills', 'hud', 'SKILL.md');
      const content = readFileSync(skillMdPath, 'utf-8');

      // Should use localeCompare with numeric option
      expect(content).toContain('localeCompare(b, undefined, { numeric: true })');

      // Should NOT use simple sort().reverse()
      expect(content).not.toMatch(/versions\.sort\(\)\.reverse\(\)/);
    });

    it('numeric sort should correctly order versions', () => {
      const versions = ['3.5.0', '3.10.0', '3.9.0'];

      // Incorrect lexicographic sort
      const lexSorted = [...versions].sort().reverse();
      expect(lexSorted[0]).toBe('3.9.0'); // Wrong! 9 > 5 > 1 lexicographically

      // Correct numeric sort
      const numSorted = [...versions].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ).reverse();
      expect(numSorted[0]).toBe('3.10.0'); // Correct! 10 > 9 > 5 numerically
    });

    it('should handle edge cases in version sorting', () => {
      // Single digit vs double digit
      const versions1 = ['1.0.0', '10.0.0', '2.0.0', '9.0.0'];
      const sorted1 = [...versions1].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ).reverse();
      expect(sorted1).toEqual(['10.0.0', '9.0.0', '2.0.0', '1.0.0']);

      // Patch version comparison
      const versions2 = ['1.0.1', '1.0.10', '1.0.9', '1.0.2'];
      const sorted2 = [...versions2].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ).reverse();
      expect(sorted2).toEqual(['1.0.10', '1.0.9', '1.0.2', '1.0.1']);
    });
  });
});
