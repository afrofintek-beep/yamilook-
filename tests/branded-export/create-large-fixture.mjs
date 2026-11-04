import { copyFileSync, openSync, writeSync, ftruncateSync, closeSync, statSync } from 'node:fs';
// A live WebM (no Duration/Cues) followed by a large valid EBML Void element.
// This models a >100 MiB MediaRecorder source without committing user media.
const path = 'tests/branded-export/large.webm';
copyFileSync('tests/branded-export/live.webm', path);
const start = statSync(path).size;
const padding = 125 * 1024 * 1024;
const header = Buffer.alloc(9); header[0] = 0xec; header.writeBigUInt64BE(0x0100000000000000n | BigInt(padding), 1);
const fd = openSync(path, 'r+'); writeSync(fd, header, 0, header.length, start); ftruncateSync(fd, start + header.length + padding); closeSync(fd);

// Same byte count as the real 413 rejection, using a sparse MP4 free box.
const uploadPath = 'tests/branded-export/upload.mov';
copyFileSync('tests/branded-export/fixture.mp4', uploadPath);
const uploadStart = statSync(uploadPath).size;
const totalSize = 398338993;
const free = Buffer.alloc(8); free.writeUInt32BE(totalSize - uploadStart, 0); free.write('free', 4);
const uploadFd = openSync(uploadPath, 'r+'); writeSync(uploadFd, free, 0, 8, uploadStart); ftruncateSync(uploadFd, totalSize); closeSync(uploadFd);
