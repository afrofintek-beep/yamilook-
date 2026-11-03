import { copyFileSync, openSync, writeSync, ftruncateSync, closeSync, statSync } from 'node:fs';
// A live WebM (no Duration/Cues) followed by a large valid EBML Void element.
// This models a >100 MiB MediaRecorder source without committing user media.
const path = 'tests/branded-export/large.webm';
copyFileSync('tests/branded-export/live.webm', path);
const start = statSync(path).size;
const padding = 125 * 1024 * 1024;
const header = Buffer.alloc(9); header[0] = 0xec; header.writeBigUInt64BE(0x0100000000000000n | BigInt(padding), 1);
const fd = openSync(path, 'r+'); writeSync(fd, header, 0, header.length, start); ftruncateSync(fd, start + header.length + padding); closeSync(fd);
