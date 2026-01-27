/**
 * Cross-Platform Path Utilities
 *
 * Provides utility functions for handling paths across Windows, macOS, and Linux.
 * These utilities ensure paths in configuration files use forward slashes
 * (which work universally) and handle platform-specific directory conventions.
 */

import { join } from 'path';
import { pathToFileURL } from 'url';
import { homedir } from 'os';

/**
 * Convert a path to use forward slashes (for JSON/config files)
 * This is necessary because settings.json commands are executed
 * by shells that expect forward slashes even on Windows
 */
export function toForwardSlash(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Get Claude config directory path
 */
export function getClaudeConfigDir(): string {
  return join(homedir(), '.claude');
}

/**
 * Get a path suitable for use in shell commands
 * Converts backslashes to forward slashes for cross-platform compatibility
 */
export function toShellPath(path: string): string {
  const normalized = toForwardSlash(path);
  // Windows paths with spaces need quoting
  if (normalized.includes(' ')) {
    return `"${normalized}"`;
  }
  return normalized;
}

/**
 * Get Windows-appropriate data directory
 * Falls back to sensible locations instead of XDG paths
 */
export function getDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  }
  return process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
}

/**
 * Get Windows-appropriate config directory
 */
export function getConfigDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

/**
 * Convert a file path to a file:// URL suitable for dynamic import()
 *
 * On Windows, dynamic import() requires file:// URLs instead of plain paths.
 * This is because Windows paths like C:\path\to\file.js are not valid URLs.
 *
 * @param filePath - Absolute file path to convert
 * @returns file:// URL string suitable for import()
 *
 * @example
 * // Windows
 * toImportUrl('C:\\Users\\test\\file.js')
 * // => 'file:///C:/Users/test/file.js'
 *
 * // Unix
 * toImportUrl('/home/user/file.js')
 * // => 'file:///home/user/file.js'
 *
 * // Spaces are encoded
 * toImportUrl('C:\\Program Files\\app\\file.js')
 * // => 'file:///C:/Program%20Files/app/file.js'
 */
export function toImportUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

/**
 * Sort version strings numerically (not lexicographically)
 *
 * Standard sort() treats version strings as text, so "3.10.0" < "3.9.0" because
 * "1" < "9" in lexicographic order. This function uses numeric comparison.
 *
 * @param versions - Array of version strings to sort
 * @param descending - Sort in descending order (default: true, latest first)
 * @returns Sorted array of version strings
 *
 * @example
 * sortVersions(['3.5.0', '3.10.0', '3.9.0'])
 * // => ['3.10.0', '3.9.0', '3.5.0']
 *
 * sortVersions(['1.0.0', '2.0.0', '10.0.0'], false)
 * // => ['1.0.0', '2.0.0', '10.0.0']
 */
export function sortVersions(versions: string[], descending: boolean = true): string[] {
  const sorted = [...versions].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  return descending ? sorted.reverse() : sorted;
}
