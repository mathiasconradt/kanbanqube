"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const iconSize = 1024;
const resourceIconPath = path.resolve(__dirname, "..", "resources", "kanbanqube_icon_large.png");
const repoIconPath = path.resolve(__dirname, "..", "..", "archive", "kanbanqube_icon_large.png");
const packageIconPath = path.resolve(__dirname, "..", "node_modules", "kanbanqube", "public", "icon_flat.png");
const sourceIconPath = [resourceIconPath, repoIconPath, packageIconPath].find((candidate) => fs.existsSync(candidate));
const outputDir = path.resolve(__dirname, "..", "assets", "icons");
const outputPath = path.join(outputDir, "kanbanqube-icon.icns");
const crcTable = createCrcTable();

if (!sourceIconPath) {
  throw new Error("Could not find KanbanQube icon PNG.");
}

fs.mkdirSync(outputDir, { recursive: true });

const source = readPng(fs.readFileSync(sourceIconPath));
const canvas = Buffer.alloc(iconSize * iconSize * 4);
const offsetX = Math.floor((iconSize - source.width) / 2);
const offsetY = Math.floor((iconSize - source.height) / 2);

for (let y = 0; y < source.height; y += 1) {
  const sourceStart = y * source.width * 4;
  const targetStart = ((offsetY + y) * iconSize + offsetX) * 4;
  source.rgba.copy(canvas, targetStart, sourceStart, sourceStart + source.width * 4);
}

writeIcns(writePng(iconSize, iconSize, canvas), outputPath);

function readPng(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("Icon source must be a PNG file.");
  }

  let offset = 8;
  let header = null;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12]
      };
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (header?.bitDepth !== 8 || header.interlace !== 0) {
    throw new Error("Icon source must be an 8-bit non-interlaced PNG.");
  }

  const bytesPerPixel = bytesPerPixelForColorType(header.colorType);
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const raw = unfilterScanlines(inflated, header.width, header.height, bytesPerPixel);

  return {
    width: header.width,
    height: header.height,
    rgba: convertToRgba(raw, header.colorType)
  };
}

function bytesPerPixelForColorType(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type: ${colorType}`);
}

function unfilterScanlines(inflated, width, height, bytesPerPixel) {
  const rowLength = width * bytesPerPixel;
  const output = Buffer.alloc(rowLength * height);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rowStart = y * rowLength;
    const previousRowStart = rowStart - rowLength;

    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= bytesPerPixel ? output[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[previousRowStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? output[previousRowStart + x - bytesPerPixel] : 0;
      const value = inflated[inputOffset + x];
      output[rowStart + x] = unfilterByte(filter, value, left, up, upLeft);
    }

    inputOffset += rowLength;
  }

  return output;
}

function unfilterByte(filter, value, left, up, upLeft) {
  if (filter === 0) return value;
  if (filter === 1) return (value + left) & 0xff;
  if (filter === 2) return (value + up) & 0xff;
  if (filter === 3) return (value + Math.floor((left + up) / 2)) & 0xff;
  if (filter === 4) return (value + paethPredictor(left, up, upLeft)) & 0xff;
  throw new Error(`Unsupported PNG filter: ${filter}`);
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function convertToRgba(raw, colorType) {
  const pixelCount = pixelCountForRaw(raw, colorType);
  const rgba = Buffer.alloc(pixelCount * 4);
  let source = 0;
  let target = 0;

  for (let i = 0; i < pixelCount; i += 1) {
    if (colorType === 0) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source];
      rgba[target + 2] = raw[source];
      rgba[target + 3] = 255;
      source += 1;
    } else if (colorType === 2) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source + 1];
      rgba[target + 2] = raw[source + 2];
      rgba[target + 3] = 255;
      source += 3;
    } else if (colorType === 4) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source];
      rgba[target + 2] = raw[source];
      rgba[target + 3] = raw[source + 1];
      source += 2;
    } else {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source + 1];
      rgba[target + 2] = raw[source + 2];
      rgba[target + 3] = raw[source + 3];
      source += 4;
    }
    target += 4;
  }

  return rgba;
}

function pixelCountForRaw(raw, colorType) {
  return raw.length / bytesPerPixelForColorType(colorType);
}

function writePng(width, height, rgba) {
  const rows = [];
  const rowLength = width * 4;
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]), rgba.subarray(y * rowLength, (y + 1) * rowLength));
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  return Array.from({ length: 256 }, (_value, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}

function writeIcns(png, filePath) {
  const entrySize = 8 + png.length;
  const totalSize = 8 + entrySize;
  const icon = Buffer.alloc(totalSize);

  icon.write("icns", 0, "ascii");
  icon.writeUInt32BE(totalSize, 4);
  icon.write("ic10", 8, "ascii");
  icon.writeUInt32BE(entrySize, 12);
  png.copy(icon, 16);

  fs.writeFileSync(filePath, icon);
}
