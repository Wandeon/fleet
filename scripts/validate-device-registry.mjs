#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const YAMLModule = await (async () => {
  try {
    return await import('yaml');
  } catch (err) {
    return await import('../apps/api/node_modules/yaml/dist/index.js');
  }
})();
const YAML = YAMLModule.default;

const ROOT = path.resolve(process.cwd());

function loadYaml(relativePath) {
  const file = path.join(ROOT, relativePath);
  const text = fs.readFileSync(file, 'utf8');
  return YAML.parse(text);
}

function loadJson(relativePath) {
  const file = path.join(ROOT, relativePath);
  const text = fs.readFileSync(file, 'utf8');
  return JSON.parse(text);
}

const errors = [];

const inventory = loadYaml('inventory/devices.yaml');
const registry = loadYaml('inventory/device-interfaces.yaml');
const inventoryIds = new Set(Object.keys(inventory?.devices || {}));

if (!Array.isArray(registry?.devices)) {
  console.error('device-interfaces.yaml missing devices array');
  process.exit(1);
}

for (const entry of registry.devices) {
  if (!inventoryIds.has(entry.id)) {
    errors.push(`Device ${entry.id} missing from inventory/devices.yaml`);
  }
}

const promConfig = loadYaml('infra/vps/prometheus.yml');
const jobTargets = new Map();
const targetFileMap = {
  'audio-player': 'infra/vps/targets-audio.json',
  'media-control': 'infra/vps/targets-hdmi-media.json',
  'camera-control': 'infra/vps/targets-camera.json',
};

for (const [job, file] of Object.entries(targetFileMap)) {
  try {
    const json = loadJson(file);
    const targets = new Set();
    for (const item of json) {
      if (Array.isArray(item.targets)) {
        for (const target of item.targets) targets.add(target);
      }
    }
    jobTargets.set(job, targets);
  } catch (err) {
    errors.push(`Unable to read ${file} for job ${job}`);
  }
}

const declaredJobs = new Set();
if (Array.isArray(promConfig?.scrape_configs)) {
  for (const scrape of promConfig.scrape_configs) {
    if (scrape.job_name) declaredJobs.add(scrape.job_name);
  }
}

for (const device of registry.devices) {
  if (!device.api?.base_url) {
    errors.push(`Device ${device.id} missing api.base_url`);
  }
  const opIds = new Set();
  for (const op of device.operations || []) {
    if (!op.id) {
      errors.push(`Device ${device.id} has operation without id`);
      continue;
    }
    if (opIds.has(op.id)) {
      errors.push(`Device ${device.id} has duplicate operation id ${op.id}`);
    }
    opIds.add(op.id);
    if (op.ui?.type === 'slider' && !op.ui?.body_key) {
      errors.push(`Device ${device.id} slider operation ${op.id} missing ui.body_key`);
    }
  }
  for (const target of device.monitoring?.prometheus_targets || []) {
    const job = target.job;
    const value = target.target;
    if (job && !declaredJobs.has(job)) {
      errors.push(`Job ${job} referenced by ${device.id} is not present in infra/vps/prometheus.yml`);
    }
    if (!jobTargets.has(job)) {
      errors.push(`Job ${job} referenced by ${device.id} is not present in infra/vps/prometheus.yml`);
      continue;
    }
    const knownTargets = jobTargets.get(job);
    if (!knownTargets.has(value)) {
      errors.push(`Target ${value} for job ${job} (device ${device.id}) missing from infra/vps targets`);
    }
  }
}

if (errors.length) {
  console.error('Device registry validation failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Device registry validation passed.');
