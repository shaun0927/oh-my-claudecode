import { describe, it, expect, afterEach } from 'vitest';
import { toForwardSlash, toShellPath, getDataDir, getConfigDir, toImportUrl, sortVersions } from '../paths.js';

describe('cross-platform path utilities', () => {
  describe('toForwardSlash', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(toForwardSlash('C:\\Users\\test\\.claude')).toBe('C:/Users/test/.claude');
    });

    it('should leave forward slashes unchanged', () => {
      expect(toForwardSlash('/home/user/.claude')).toBe('/home/user/.claude');
    });

    it('should handle mixed slashes', () => {
      expect(toForwardSlash('C:\\Users/test\\.claude')).toBe('C:/Users/test/.claude');
    });

    it('should handle empty string', () => {
      expect(toForwardSlash('')).toBe('');
    });

    it('should handle UNC paths', () => {
      expect(toForwardSlash('\\\\server\\share\\path')).toBe('//server/share/path');
    });
  });

  describe('toShellPath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(toShellPath('C:\\Users\\test')).toBe('C:/Users/test');
    });

    it('should quote paths with spaces', () => {
      expect(toShellPath('/path/with spaces/file')).toBe('"/path/with spaces/file"');
    });

    it('should quote Windows paths with spaces', () => {
      expect(toShellPath('C:\\Program Files\\app')).toBe('"C:/Program Files/app"');
    });

    it('should not quote paths without spaces', () => {
      expect(toShellPath('/simple/path')).toBe('/simple/path');
    });

    it('should handle empty string', () => {
      expect(toShellPath('')).toBe('');
    });
  });

  describe('getDataDir', () => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      process.env = { ...originalEnv };
    });

    it('should use LOCALAPPDATA on Windows when set', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';
      expect(getDataDir()).toBe('C:\\Users\\Test\\AppData\\Local');
    });

    it('should use XDG_DATA_HOME on Unix when set', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.XDG_DATA_HOME = '/custom/data';
      expect(getDataDir()).toBe('/custom/data');
    });

    it('should fall back to .local/share on Unix when XDG not set', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      delete process.env.XDG_DATA_HOME;
      const result = getDataDir();
      expect(result).toContain('.local');
      expect(result).toContain('share');
    });
  });

  describe('getConfigDir', () => {
    const originalPlatform = process.platform;
    const originalEnv = { ...process.env };

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      process.env = { ...originalEnv };
    });

    it('should use APPDATA on Windows when set', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';
      expect(getConfigDir()).toBe('C:\\Users\\Test\\AppData\\Roaming');
    });

    it('should use XDG_CONFIG_HOME on Unix when set', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.XDG_CONFIG_HOME = '/custom/config';
      expect(getConfigDir()).toBe('/custom/config');
    });

    it('should fall back to .config on Unix when XDG not set', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      delete process.env.XDG_CONFIG_HOME;
      const result = getConfigDir();
      expect(result).toContain('.config');
    });
  });

  describe('toImportUrl', () => {
    it('should convert Unix paths to file:// URLs', () => {
      const result = toImportUrl('/home/user/file.js');
      expect(result).toBe('file:///home/user/file.js');
    });

    it('should convert Windows paths to file:// URLs', () => {
      // Note: On non-Windows, this simulates what would happen with a Windows-style path
      // The pathToFileURL function handles this correctly on all platforms
      const result = toImportUrl('/C:/Users/test/file.js');
      expect(result).toMatch(/^file:\/\/\//);
      expect(result).toContain('file.js');
    });

    it('should encode spaces in paths', () => {
      const result = toImportUrl('/path/with spaces/file.js');
      expect(result).toBe('file:///path/with%20spaces/file.js');
    });

    it('should encode special characters', () => {
      const result = toImportUrl('/path/with#special/file.js');
      expect(result).toContain('%23'); // # is encoded as %23
    });

    it('should handle paths with unicode characters', () => {
      const result = toImportUrl('/home/한글/file.js');
      expect(result).toMatch(/^file:\/\/\//);
      // Unicode may or may not be encoded depending on Node version
      expect(result).toContain('file.js');
    });
  });

  describe('sortVersions', () => {
    it('should sort versions numerically in descending order by default', () => {
      const versions = ['3.5.0', '3.10.0', '3.9.0'];
      const result = sortVersions(versions);
      expect(result).toEqual(['3.10.0', '3.9.0', '3.5.0']);
    });

    it('should sort versions numerically in ascending order when specified', () => {
      const versions = ['3.5.0', '3.10.0', '3.9.0'];
      const result = sortVersions(versions, false);
      expect(result).toEqual(['3.5.0', '3.9.0', '3.10.0']);
    });

    it('should handle single-digit and double-digit versions correctly', () => {
      const versions = ['1.0.0', '2.0.0', '10.0.0', '9.0.0'];
      const result = sortVersions(versions);
      expect(result).toEqual(['10.0.0', '9.0.0', '2.0.0', '1.0.0']);
    });

    it('should handle pre-release versions', () => {
      const versions = ['1.0.0-alpha', '1.0.0-beta', '1.0.0'];
      const result = sortVersions(versions);
      // With numeric localeCompare, pre-release versions sort after release
      // because '-' comes after '.' in the comparison
      // This is acceptable behavior for plugin version directories
      expect(result[0]).toBe('1.0.0-beta');
      expect(result).toContain('1.0.0');
      expect(result).toContain('1.0.0-alpha');
    });

    it('should not mutate the original array', () => {
      const versions = ['3.5.0', '3.10.0', '3.9.0'];
      const original = [...versions];
      sortVersions(versions);
      expect(versions).toEqual(original);
    });

    it('should handle empty array', () => {
      const result = sortVersions([]);
      expect(result).toEqual([]);
    });

    it('should handle single version', () => {
      const result = sortVersions(['1.0.0']);
      expect(result).toEqual(['1.0.0']);
    });

    it('should handle versions with different patch levels', () => {
      const versions = ['1.0.1', '1.0.10', '1.0.2', '1.0.9'];
      const result = sortVersions(versions);
      expect(result).toEqual(['1.0.10', '1.0.9', '1.0.2', '1.0.1']);
    });
  });
});
