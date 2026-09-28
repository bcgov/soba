#!/usr/bin/env node

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const help = `Generate a SOBA GatewayService YAML file without deploying it.

Usage:
  node deployments/gateway/scripts/generate-gateway-config.mjs [--format resource|kong] [--output FILE]

Required environment variables:
  GATEWAY_ID             Gateway ID, e.g. gw-ca88c
  GATEWAY_HOSTNAME       Public hostname, without scheme or path
  GATEWAY_QUALIFIER      Isolated scope, e.g. proxy-proof

For PR deployments:
  PR_NUMBER             Positive PR number
  OPENSHIFT_NAMESPACE   Namespace containing the backend Service

Optional overrides (both required when PR_NUMBER is absent):
  GATEWAY_SERVICE_NAME   Defaults to soba-pr-<PR_NUMBER>-dev
  BACKEND_HOST           Defaults to soba-pr-<PR_NUMBER>-backend.<namespace>.svc

Writes YAML to stdout unless --output is supplied. Uses only Node.js built-ins.
`;

function required(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function hostname(name, value) {
  required(name, value);
  if (
    value.length > 253 ||
    !value.split('.').every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    )
  ) {
    throw new Error(`${name} must be a DNS hostname without scheme, port, or path`);
  }
  return value;
}

async function main() {
  const { values } = parseArgs({
    options: {
      output: { type: 'string', short: 'o' },
      format: { type: 'string', default: 'resource' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    process.stdout.write(help);
    return;
  }

  const env = process.env;
  if (!['resource', 'kong'].includes(values.format)) {
    throw new Error('--format must be resource or kong');
  }
  const qualifier = required('GATEWAY_QUALIFIER', env.GATEWAY_QUALIFIER);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(qualifier)) {
    throw new Error('GATEWAY_QUALIFIER must contain lowercase letters, digits, or hyphens');
  }
  const gateway = required('GATEWAY_ID', env.GATEWAY_ID);
  if (!/^gw-[a-z0-9-]+$/.test(gateway)) {
    throw new Error('GATEWAY_ID must start with gw- and contain lowercase letters, digits, or hyphens');
  }
  const pr = env.PR_NUMBER;
  if (pr !== undefined && !/^[1-9][0-9]*$/.test(pr)) {
    throw new Error('PR_NUMBER must be a positive integer');
  }

  const service = required(
    'GATEWAY_SERVICE_NAME (or PR_NUMBER)',
    env.GATEWAY_SERVICE_NAME ?? (pr ? `soba-pr-${pr}-dev` : undefined),
  );
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(service)) {
    throw new Error('GATEWAY_SERVICE_NAME must contain lowercase letters, digits, underscores, or hyphens');
  }

  let backend = env.BACKEND_HOST;
  if (backend === undefined && pr) {
    const namespace = required('OPENSHIFT_NAMESPACE', env.OPENSHIFT_NAMESPACE);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(namespace)) {
      throw new Error('OPENSHIFT_NAMESPACE must be a valid Kubernetes namespace');
    }
    backend = `soba-pr-${pr}-backend.${namespace}.svc`;
  }

  const substitutions = {
    GATEWAY_SERVICE_NAME: service,
    CONFIG_TAG: `ns.${gateway}.${qualifier}`,
    BACKEND_HOST: hostname('BACKEND_HOST', backend),
    GATEWAY_HOSTNAME: hostname('GATEWAY_HOSTNAME', env.GATEWAY_HOSTNAME),
  };
  const template = await readFile(new URL('../service.template.yaml', import.meta.url), 'utf8');
  let rendered = template.replace(/\$\{([^}]+)\}/g, (_, name) => {
    if (!Object.hasOwn(substitutions, name)) {
      throw new Error(`Unknown template variable: ${name}`);
    }
    // JSON string quoting is valid YAML and prevents values changing its structure.
    return JSON.stringify(substitutions[name]);
  });
  if (rendered.includes('${')) throw new Error('Unresolved template placeholder');

  if (values.format === 'kong') {
    const service = rendered.slice(rendered.indexOf('kind: GatewayService\n'))
      .replace('kind: GatewayService\n', '').trimEnd();
    rendered = `services:\n  - ${service.split('\n').join('\n    ')}\n`;
  }

  if (values.output !== undefined) {
    if (!values.output.trim()) throw new Error('--output must be a nonempty file path');
    const output = resolve(values.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, rendered);
    process.stderr.write(`Generated ${output}\n`);
  } else {
    process.stdout.write(rendered);
  }
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
