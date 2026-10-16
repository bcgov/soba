import { readFile, appendFile } from 'node:fs/promises';

const taskFile = '.scannerwork/report-task.txt';
const pollIntervalMs = 5000;
const pollTimeoutMs = 10 * 60 * 1000;

function readTaskMetadata(contents) {
  return Object.fromEntries(
    contents.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
}

async function getJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`SonarQube API returned HTTP ${response.status} for ${url.pathname}`);
  return response.json();
}

async function waitForAnalysis(ceTaskUrl, token) {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    const { task } = await getJson(ceTaskUrl, token);
    if (task?.status === 'SUCCESS') return;
    if (task?.status === 'FAILED' || task?.status === 'CANCELED') {
      throw new Error(`SonarQube processing ${task.status.toLowerCase()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error('Timed out waiting for SonarQube to process the branch scan');
}

async function main() {
  const token = process.env.SONAR_TOKEN;
  const branch = process.env.SONAR_BRANCH;
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!token || !branch || !summaryFile) throw new Error('Missing SonarQube token or Actions context');

  const task = readTaskMetadata(await readFile(taskFile, 'utf8'));
  if (!task.serverUrl || !task.ceTaskUrl || !task.projectKey) {
    throw new Error('SonarQube scan task metadata is incomplete');
  }
  const serverUrl = new URL(task.serverUrl);
  const ceTaskUrl = new URL(task.ceTaskUrl);
  const allowedHosts = new Set(['sonarcloud.io', 'sonarqube.us']);
  if (serverUrl.protocol !== 'https:' || !allowedHosts.has(serverUrl.hostname) || ceTaskUrl.origin !== serverUrl.origin) {
    throw new Error('Unexpected SonarQube Cloud server URL');
  }

  await waitForAnalysis(ceTaskUrl, token);
  const issuesUrl = new URL('/api/issues/search', serverUrl);
  issuesUrl.search = new URLSearchParams({
    componentKeys: task.projectKey,
    branch,
    resolved: 'false',
    ps: '1',
  }).toString();
  const result = await getJson(issuesUrl, token);
  const count = result.paging?.total ?? result.total;
  if (!Number.isInteger(count) || count < 0) throw new Error('SonarQube returned no issue count');

  const reportUrl = new URL('/project/issues', serverUrl);
  reportUrl.search = new URLSearchParams({ id: task.projectKey, branch, resolved: 'false' }).toString();
  await appendFile(summaryFile, [
    `## SonarQube ${branch} branch report`,
    '',
    `**${count} open issues** in Overall Code.`,
    '',
    `[View the issues in SonarQube Cloud](${reportUrl})`,
    '',
  ].join('\n'));
}

main().catch((error) => {
  console.error(`Could not publish SonarQube issue count: ${error.message}`);
  process.exitCode = 1;
});
