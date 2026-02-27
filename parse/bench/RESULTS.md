
> mixpad@0.1.0 bench
> node --expose-gc parse/bench/run.js

# Mixpad Parser Benchmarks

System: win32 x64, Node v22.17.1

### Dataset: small-simple (31 B)

| Parser | Time (ms) | Throughput (MB/s) | Memory Delta |
|--------|-----------|-------------------|--------------|
| mixpad-scan0 | 0.05 | 0.6 | 6.5 KB |
| mixpad-full | 0.96 | 0.0 | 9.9 KB |
| commonmark | 1.08 | 0.0 | 41.6 KB |
| markdown-it | 1.09 | 0.0 | 24.2 KB |
| marked | 0.85 | 0.0 | 31.0 KB |
| micromark | 3.08 | 0.0 | 186.6 KB |
| remark | 1.55 | 0.0 | 169.0 KB |


### Dataset: medium-mixed (50.0 KB)

| Parser | Time (ms) | Throughput (MB/s) | Memory Delta |
|--------|-----------|-------------------|--------------|
| mixpad-scan0 | 1.11 | 43.8 | 1.9 KB |
| mixpad-full | 23.95 | 2.0 | 1.8 MB |
| commonmark | 10.89 | 4.5 | 4.4 MB |
| markdown-it | 18.35 | 2.7 | 3.4 MB |
| marked | 9.93 | 4.9 | 1.6 MB |
| micromark | 179.45 | 0.3 | 23.5 MB |
| remark | 197.60 | 0.2 | 24.1 MB |


### Dataset: pathological (181.5 KB)

| Parser | Time (ms) | Throughput (MB/s) | Memory Delta |
|--------|-----------|-------------------|--------------|
| mixpad-scan0 | 0.29 | 604.1 | 1.3 KB |
| mixpad-full | 49.74 | 3.6 | 6.3 MB |
| commonmark | 20.31 | 8.7 | 8.5 MB |
| markdown-it | 49.33 | 3.6 | 6.0 MB |
| marked | 20.77 | 8.5 | 6.6 MB |
| micromark | 236.36 | 0.7 | 16.7 MB |
| remark | 284.05 | 0.6 | 19.1 MB |


### Dataset: large-text-heavy (500.0 KB)

| Parser | Time (ms) | Throughput (MB/s) | Memory Delta |
|--------|-----------|-------------------|--------------|
| mixpad-scan0 | 0.03 | 14751.7 | 1.2 KB |
| mixpad-full | 12.56 | 38.9 | 1.1 MB |
| commonmark | 6.75 | 72.4 | 3.3 MB |
| markdown-it | 29.32 | 16.7 | 3.3 MB |
| marked | 14.67 | 33.3 | 1.2 MB |
| micromark | 154.62 | 3.2 | 15.4 MB |
| remark | 164.47 | 3.0 | 14.8 MB |


### Dataset: docs-collection (242.9 KB)

| Parser | Time (ms) | Throughput (MB/s) | Memory Delta |
|--------|-----------|-------------------|--------------|
| mixpad-scan0 | 0.04 | 6608.3 | 1.2 KB |
| mixpad-full | 25.45 | 9.3 | 5.4 MB |
| commonmark | 40.36 | 5.9 | 5.4 MB |
| markdown-it | 63.56 | 3.7 | 10.6 MB |
| marked | 34.78 | 6.8 | 13.0 MB |
| micromark | 440.92 | 0.5 | 46.8 MB |
| remark | 458.50 | 0.5 | 49.9 MB |


