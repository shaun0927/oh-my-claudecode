#!/usr/bin/env node
/**
 * Test script to validate GitHub Actions workflow logic
 * Tests the JavaScript logic used in pr-check.yml and cleanup.yml workflows
 */

const assert = require('assert');

console.log('Testing GitHub Actions workflow logic...\n');

// Mock GitHub API
function createMockGitHub() {
  return {
    rest: {
      issues: {
        listLabelsOnIssue: async () => ({
          data: [
            { name: 'size/M' },
            { name: 'bug' },
            { name: 'size/S' },
            { name: 'enhancement' }
          ]
        }),
        removeLabel: async ({ name }) => {
          console.log(`  [MOCK] Removed label: ${name}`);
          return { data: {} };
        },
        addLabels: async ({ labels }) => {
          console.log(`  [MOCK] Added labels: ${labels.join(', ')}`);
          return { data: {} };
        },
        listComments: async () => ({
          data: [
            { body: 'Great PR!', user: { type: 'User' } },
            { body: 'LGTM', user: { type: 'User' } }
          ]
        }),
        createComment: async ({ body }) => {
          console.log(`  [MOCK] Created comment: ${body.substring(0, 50)}...`);
          return { data: {} };
        }
      },
      actions: {
        listArtifactsForRepo: async ({ page }) => {
          // Simulate paginated response
          if (page === 1) {
            return {
              data: {
                artifacts: Array(100).fill(null).map((_, i) => ({
                  id: i + 1,
                  name: `artifact-${i + 1}`,
                  created_at: new Date(Date.now() - (i < 50 ? 40 : 10) * 24 * 60 * 60 * 1000).toISOString()
                }))
              }
            };
          } else if (page === 2) {
            return {
              data: {
                artifacts: Array(30).fill(null).map((_, i) => ({
                  id: 101 + i,
                  name: `artifact-${101 + i}`,
                  created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
                }))
              }
            };
          }
          return { data: { artifacts: [] } };
        },
        deleteArtifact: async ({ artifact_id }) => {
          return { data: {} };
        },
        getActionsCacheList: async ({ page }) => {
          if (page === 1) {
            return {
              data: {
                actions_caches: Array(100).fill(null).map((_, i) => ({
                  id: i + 1,
                  key: `cache-${i + 1}`,
                  last_accessed_at: new Date(Date.now() - (i < 50 ? 20 : 5) * 24 * 60 * 60 * 1000).toISOString()
                }))
              }
            };
          }
          return { data: { actions_caches: [] } };
        },
        deleteActionsCacheById: async ({ cache_id }) => {
          return { data: {} };
        }
      }
    }
  };
}

const context = {
  repo: { owner: 'test-owner', repo: 'test-repo' },
  issue: { number: 123 }
};

// Test 1: Size label removal removes all size/* labels
async function testSizeLabelRemoval() {
  console.log('Test 1: Size label removal');

  const github = createMockGitHub();
  const removedLabels = [];

  github.rest.issues.removeLabel = async ({ name }) => {
    removedLabels.push(name);
    return { data: {} };
  };

  // Simulate the workflow logic
  const { data: currentLabels } = await github.rest.issues.listLabelsOnIssue({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number
  });

  for (const label of currentLabels) {
    if (label.name.startsWith('size/')) {
      await github.rest.issues.removeLabel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        name: label.name
      });
    }
  }

  assert.deepStrictEqual(removedLabels.sort(), ['size/M', 'size/S'].sort(),
    'Should remove only size/* labels');
  console.log('  PASS: Removes all size/* labels\n');
}

// Test 2: Comment deduplication finds existing "Large PR Alert" comment
async function testCommentDeduplication() {
  console.log('Test 2: Comment deduplication');

  const github = createMockGitHub();
  let commentCreated = false;

  github.rest.issues.createComment = async () => {
    commentCreated = true;
    return { data: {} };
  };

  // Test when no existing alert exists
  const { data: comments } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number
  });

  const existingAlert = comments.find(c =>
    c.body.includes('Large PR Alert') &&
    c.user.type === 'Bot'
  );

  if (!existingAlert) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: '**Large PR Alert**\n\nThis PR has many changes.'
    });
  }

  assert.strictEqual(commentCreated, true,
    'Should create comment when no existing alert');
  console.log('  PASS: Creates comment when no existing alert exists');

  // Test when existing alert exists
  commentCreated = false;
  github.rest.issues.listComments = async () => ({
    data: [
      { body: 'Great PR!', user: { type: 'User' } },
      { body: '**Large PR Alert**\n\nThis is large.', user: { type: 'Bot' } }
    ]
  });

  const { data: comments2 } = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number
  });

  const existingAlert2 = comments2.find(c =>
    c.body.includes('Large PR Alert') &&
    c.user.type === 'Bot'
  );

  if (!existingAlert2) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: '**Large PR Alert**\n\nThis PR has many changes.'
    });
  }

  assert.strictEqual(commentCreated, false,
    'Should not create comment when alert already exists');
  console.log('  PASS: Skips comment when existing alert found\n');
}

// Test 3: Pagination loop for artifact cleanup
async function testArtifactPagination() {
  console.log('Test 3: Artifact pagination');

  const github = createMockGitHub();
  let deletedCount = 0;
  let pagesAccessed = [];

  github.rest.actions.listArtifactsForRepo = async ({ page }) => {
    pagesAccessed.push(page);
    if (page === 1) {
      return {
        data: {
          artifacts: Array(100).fill(null).map((_, i) => ({
            id: i + 1,
            name: `artifact-${i + 1}`,
            created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
          }))
        }
      };
    } else if (page === 2) {
      return {
        data: {
          artifacts: Array(30).fill(null).map((_, i) => ({
            id: 101 + i,
            name: `artifact-${101 + i}`,
            created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
          }))
        }
      };
    }
    return { data: { artifacts: [] } };
  };

  github.rest.actions.deleteArtifact = async () => {
    deletedCount++;
    return { data: {} };
  };

  // Simulate the workflow pagination logic
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data } = await github.rest.actions.listArtifactsForRepo({
      owner: context.repo.owner,
      repo: context.repo.repo,
      per_page: 100,
      page: page
    });

    for (const artifact of data.artifacts) {
      const createdAt = new Date(artifact.created_at);
      if (createdAt < cutoffDate) {
        await github.rest.actions.deleteArtifact({
          owner: context.repo.owner,
          repo: context.repo.repo,
          artifact_id: artifact.id
        });
      }
    }

    hasMore = data.artifacts.length === 100;
    page++;
  }

  assert.deepStrictEqual(pagesAccessed, [1, 2],
    'Should access both pages');
  assert.strictEqual(deletedCount, 130,
    'Should delete all 130 old artifacts');
  console.log('  PASS: Pagination loops through all pages\n');
}

// Test 4: Pagination loop for cache cleanup
async function testCachePagination() {
  console.log('Test 4: Cache pagination');

  const github = createMockGitHub();
  let deletedCount = 0;
  let pagesAccessed = [];

  github.rest.actions.getActionsCacheList = async ({ page }) => {
    pagesAccessed.push(page);
    if (page === 1) {
      return {
        data: {
          actions_caches: Array(100).fill(null).map((_, i) => ({
            id: i + 1,
            key: `cache-${i + 1}`,
            last_accessed_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
          }))
        }
      };
    } else if (page === 2) {
      return {
        data: {
          actions_caches: Array(25).fill(null).map((_, i) => ({
            id: 101 + i,
            key: `cache-${101 + i}`,
            last_accessed_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
          }))
        }
      };
    }
    return { data: { actions_caches: [] } };
  };

  github.rest.actions.deleteActionsCacheById = async () => {
    deletedCount++;
    return { data: {} };
  };

  // Simulate the workflow pagination logic
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 14);

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data } = await github.rest.actions.getActionsCacheList({
      owner: context.repo.owner,
      repo: context.repo.repo,
      per_page: 100,
      page: page
    });

    const caches = data.actions_caches || [];
    for (const cache of caches) {
      const lastUsed = new Date(cache.last_accessed_at);
      if (lastUsed < cutoffDate) {
        await github.rest.actions.deleteActionsCacheById({
          owner: context.repo.owner,
          repo: context.repo.repo,
          cache_id: cache.id
        });
      }
    }

    hasMore = caches.length === 100;
    page++;
  }

  assert.deepStrictEqual(pagesAccessed, [1, 2],
    'Should access both pages');
  assert.strictEqual(deletedCount, 125,
    'Should delete all 125 old caches');
  console.log('  PASS: Cache pagination loops through all pages\n');
}

// Run all tests
async function runTests() {
  try {
    await testSizeLabelRemoval();
    await testCommentDeduplication();
    await testArtifactPagination();
    await testCachePagination();

    console.log('All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\nTest failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
