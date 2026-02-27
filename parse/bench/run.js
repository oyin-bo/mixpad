// @ts-check
import { performance } from 'perf_hooks';
import { getDataset } from './datasets.js';
import { parseWithParser } from './adapters.js';

const datasets = [
  'small-simple',
  'medium-mixed',
  'pathological',
  'large-text-heavy',
  'docs-collection'
];

const parsers = [
  'mixpad-scan0',
  'mixpad-full',
  'commonmark',
  'markdown-it',
  'marked',
  'micromark',
  'remark'
];

/**
 * Run a single benchmark for a parser and dataset.
 * @param {string} parserName 
 * @param {string} datasetName 
 * @param {string} content 
 * @param {number} iterations 
 */
async function runParserDataset(parserName, datasetName, content, iterations = 5) {
  // Warmup run
  try { await parseWithParser(parserName, content); } catch (e) {}
  
  const times = [];
  const memoryDeltas = [];

  for (let i = 0; i < iterations; i++) {
    if (global.gc) global.gc();
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();
    
    await parseWithParser(parserName, content);
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    times.push(endTime - startTime);
    memoryDeltas.push(Math.max(0, endMemory - startMemory));
  }

  // Use median
  times.sort((a, b) => a - b);
  const medianTime = times[Math.floor(times.length / 2)];
  
  memoryDeltas.sort((a, b) => a - b);
  const medianMemory = memoryDeltas[Math.floor(memoryDeltas.length / 2)];

  const contentSize = Buffer.byteLength(content, 'utf8');
  const throughput = (contentSize / (1024 * 1024)) / (medianTime / 1000); // MB/s

  return {
    time: medianTime,
    memory: medianMemory,
    throughput: throughput
  };
}

/**
 * Format bytes to a human readable form
 * @param {number} bytes 
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  console.log("# Mixpad Parser Benchmarks\n");
  console.log("System: " + process.platform + " " + process.arch + ", Node " + process.version + "\n");

  for (const dsName of datasets) {
    const dataset = getDataset(dsName);
    const contentSize = Buffer.byteLength(dataset.content, 'utf8');
    
    console.log(`### Dataset: ${dsName} (${formatBytes(contentSize)})\n`);
    console.log("| Parser | Time (ms) | Throughput (MB/s) | Memory Delta |");
    console.log("|--------|-----------|-------------------|--------------|");

    for (const parser of parsers) {
      try {
        const result = await runParserDataset(parser, dsName, dataset.content);
        console.log(`| ${parser} | ${result.time.toFixed(2)} | ${result.throughput.toFixed(1)} | ${formatBytes(result.memory)} |`);
      } catch (e) {
        console.log(`| ${parser} | ERROR | - | - |`);
      }
    }
    console.log("\n");
  }
}

main().catch(console.error);
