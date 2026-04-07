/**
 * Tests for titleToSlug validation and reserved file guards.
 *
 * Bug 1: titleToSlug("日本語") produces ".md" — all non-ASCII titles
 *         collide on the same hidden dotfile, causing silent data loss.
 * Bug 2: titleToSlug("Log") produces "log.md" which overwrites the
 *         wiki operation log, destroying all history.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { titleToSlug, writePageUnsafe, ensureWikiDir, withWikiLock } from '../storage.js';
import { WIKI_SCHEMA_VERSION } from '../types.js';
import type { WikiPage } from '../types.js';

function makePage(filename: string): WikiPage {
  return {
    filename,
    frontmatter: {
      title: 'Test',
      tags: [],
      created: '2025-01-01T00:00:00.000Z',
      updated: '2025-01-01T00:00:00.000Z',
      sources: [],
      links: [],
      category: 'reference',
      confidence: 'medium',
      schemaVersion: WIKI_SCHEMA_VERSION,
    },
    content: '\n# Test\n\nContent.\n',
  };
}

describe('titleToSlug — non-ASCII fallback', () => {
  it('should produce valid slug for Latin titles', () => {
    expect(titleToSlug('Auth Architecture')).toBe('auth-architecture.md');
  });

  it('should NOT produce bare ".md" for CJK titles', () => {
    const slug = titleToSlug('日本語ドキュメント');
    expect(slug).not.toBe('.md');
    expect(slug).toMatch(/^page-[0-9a-f]+\.md$/);
  });

  it('should NOT produce bare ".md" for Korean titles', () => {
    const slug = titleToSlug('인증 아키텍처');
    expect(slug).not.toBe('.md');
    expect(slug).toMatch(/^page-[0-9a-f]+\.md$/);
  });

  it('should NOT produce bare ".md" for empty string', () => {
    const slug = titleToSlug('');
    expect(slug).not.toBe('.md');
    expect(slug).toMatch(/^page-[0-9a-f]+\.md$/);
  });

  it('should produce deterministic slugs for same title', () => {
    const slug1 = titleToSlug('テスト');
    const slug2 = titleToSlug('テスト');
    expect(slug1).toBe(slug2);
  });

  it('should produce different slugs for different CJK titles', () => {
    const slug1 = titleToSlug('日本語');
    const slug2 = titleToSlug('中文');
    expect(slug1).not.toBe(slug2);
  });
});

describe('titleToSlug — reserved file protection', () => {
  it('should NOT produce "index.md"', () => {
    const slug = titleToSlug('Index');
    expect(slug).not.toBe('index.md');
    expect(slug).toBe('index-page.md');
  });

  it('should NOT produce "log.md"', () => {
    const slug = titleToSlug('Log');
    expect(slug).not.toBe('log.md');
    expect(slug).toBe('log-page.md');
  });

  it('should allow similar but non-reserved names', () => {
    expect(titleToSlug('Logging')).toBe('logging.md');
    expect(titleToSlug('Indexing')).toBe('indexing.md');
  });
});

describe('writePageUnsafe — reserved file guard', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wiki-guard-test-'));
    ensureWikiDir(tempDir);
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('should throw when writing to index.md', () => {
    expect(() => {
      withWikiLock(tempDir, () => {
        writePageUnsafe(tempDir, makePage('index.md'));
      });
    }).toThrow('Cannot write to reserved wiki file');
  });

  it('should throw when writing to log.md', () => {
    expect(() => {
      withWikiLock(tempDir, () => {
        writePageUnsafe(tempDir, makePage('log.md'));
      });
    }).toThrow('Cannot write to reserved wiki file');
  });

  it('should allow writing to non-reserved files', () => {
    expect(() => {
      withWikiLock(tempDir, () => {
        writePageUnsafe(tempDir, makePage('auth.md'));
      });
    }).not.toThrow();
  });
});
