/**
 * Where a beacon comes from, to the level of a province and a town, looked up
 * in a GeoIP database in the MaxMind DB format (the free "IP to City Lite" by
 * DB-IP). The address is used for this lookup and then dropped: only the three
 * names below are stored.
 *
 * The file is read through its descriptor, a few small pieces per lookup, so
 * its 120 MB never sit in memory. Without the file every lookup answers null
 * and the collector carries on.
 *
 * Format: https://maxmind.github.io/MaxMind-DB/
 */
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { isIP } from 'node:net';

const MARKER = Buffer.from('\xab\xcd\xefMaxMind.com', 'latin1');
const PAGE = 4096;
const MAX_PAGES = 256;
const MAX_DEPTH = 32;

/** The bytes of an address: 4 for IPv4 (also when it arrives wrapped in IPv6), 16 for IPv6. */
export function addressBytes(ip) {
  if (typeof ip !== 'string') return null;
  const kind = isIP(ip);
  if (kind === 4) return Uint8Array.from(ip.split('.').map(Number));
  if (kind !== 6) return null;

  let text = ip.split('%')[0];
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = text.slice(0, dotted.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups =
    tail === undefined ? left : [...left, ...new Array(8 - left.length - right.length).fill('0'), ...right];
  if (groups.length !== 8) return null;

  const out = new Uint8Array(16);
  groups.forEach((group, i) => {
    const n = parseInt(group, 16);
    out[i * 2] = n >> 8;
    out[i * 2 + 1] = n & 255;
  });
  const mapped = out.subarray(0, 10).every((byte) => byte === 0) && out[10] === 255 && out[11] === 255;
  return mapped ? out.slice(12) : out;
}

/** A place name as stored: plain text, bounded. */
const name = (value) => {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/[^\p{L}\p{N} .,'()-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return text || null;
};

/**
 * Opens the database, or returns null when it is missing or not a MaxMind DB.
 * The result has lookup(ip) -> { country, region, city } | null, and close().
 */
export function openGeo(path) {
  let fd;
  try {
    fd = openSync(path, 'r');
  } catch {
    return null;
  }

  try {
    const size = fstatSync(fd).size;
    const pages = new Map();

    const page = (index) => {
      let buffer = pages.get(index);
      if (buffer) return buffer;
      buffer = Buffer.alloc(PAGE);
      readSync(fd, buffer, 0, PAGE, index * PAGE);
      if (pages.size >= MAX_PAGES) pages.delete(pages.keys().next().value);
      pages.set(index, buffer);
      return buffer;
    };

    /** `length` bytes at `position`. Most reads fall inside one cached page. */
    const bytes = (position, length) => {
      if (position < 0 || position + length > size) throw new Error('read outside the database');
      const index = Math.floor(position / PAGE);
      const offset = position - index * PAGE;
      if (offset + length <= PAGE) return page(index).subarray(offset, offset + length);
      const buffer = Buffer.alloc(length);
      readSync(fd, buffer, 0, length, position);
      return buffer;
    };

    const uint = (position, length) => {
      let n = 0;
      for (const byte of bytes(position, length)) n = n * 256 + byte;
      return n;
    };

    /** Decodes the field at `position`; pointers are relative to `base`. Returns [value, next position]. */
    const decode = (position, base, depth = 0) => {
      if (depth > MAX_DEPTH) throw new Error('database nested too deep');
      const control = bytes(position, 1)[0];
      position += 1;
      let type = control >> 5;

      if (type === 1) {
        const width = (control >> 3) & 3;
        const high = control & 7;
        const rest = uint(position, width + 1);
        const pointer =
          width === 0
            ? high * 2 ** 8 + rest
            : width === 1
              ? high * 2 ** 16 + rest + 2048
              : width === 2
                ? high * 2 ** 24 + rest + 526336
                : rest;
        return [decode(base + pointer, base, depth + 1)[0], position + width + 1];
      }

      if (type === 0) {
        type = 7 + bytes(position, 1)[0];
        position += 1;
      }

      let length = control & 31;
      if (length === 29) {
        length = 29 + uint(position, 1);
        position += 1;
      } else if (length === 30) {
        length = 285 + uint(position, 2);
        position += 2;
      } else if (length === 31) {
        length = 65821 + uint(position, 3);
        position += 3;
      }

      switch (type) {
        case 2:
          return [bytes(position, length).toString('utf8'), position + length];
        case 3:
          return [bytes(position, 8).readDoubleBE(0), position + 8];
        case 4:
          return [Buffer.from(bytes(position, length)), position + length];
        case 5:
        case 6:
        case 9:
        case 10:
          return [uint(position, length), position + length];
        case 7: {
          const map = {};
          for (let i = 0; i < length; i++) {
            let key;
            [key, position] = decode(position, base, depth + 1);
            let value;
            [value, position] = decode(position, base, depth + 1);
            map[String(key)] = value;
          }
          return [map, position];
        }
        case 8: {
          const n = uint(position, length);
          return [length === 4 && n >= 2 ** 31 ? n - 2 ** 32 : n, position + length];
        }
        case 11: {
          const list = [];
          for (let i = 0; i < length; i++) {
            let value;
            [value, position] = decode(position, base, depth + 1);
            list.push(value);
          }
          return [list, position];
        }
        case 14:
          return [length !== 0, position];
        case 15:
          return [bytes(position, 4).readFloatBE(0), position + 4];
        default:
          throw new Error(`unknown field type ${type}`);
      }
    };

    // The metadata sits at the very end, after a marker.
    const tailLength = Math.min(size, 128 * 1024);
    const tail = Buffer.alloc(tailLength);
    readSync(fd, tail, 0, tailLength, size - tailLength);
    const marker = tail.lastIndexOf(MARKER);
    if (marker < 0) throw new Error('not a MaxMind DB');
    const metaStart = size - tailLength + marker + MARKER.length;
    const meta = decode(metaStart, metaStart)[0];

    const nodeCount = meta.node_count;
    const recordSize = meta.record_size;
    const ipVersion = meta.ip_version;
    if (!Number.isInteger(nodeCount) || ![24, 28, 32].includes(recordSize) || ![4, 6].includes(ipVersion)) {
      throw new Error('unsupported MaxMind DB');
    }
    const nodeBytes = recordSize / 4;
    const treeSize = nodeCount * nodeBytes;
    const dataStart = treeSize + 16;

    /** The node, or data pointer, that `node` leads to for a 0 or 1 bit. */
    const follow = (node, bit) => {
      const b = bytes(node * nodeBytes, nodeBytes);
      if (recordSize === 24) return bit ? b[3] * 65536 + b[4] * 256 + b[5] : b[0] * 65536 + b[1] * 256 + b[2];
      if (recordSize === 28) {
        return bit
          ? (b[3] & 15) * 2 ** 24 + b[4] * 65536 + b[5] * 256 + b[6]
          : (b[3] >> 4) * 2 ** 24 + b[0] * 65536 + b[1] * 256 + b[2];
      }
      return bit ? b.readUInt32BE(4) : b.readUInt32BE(0);
    };

    // In an IPv6 database the IPv4 addresses live under 96 zero bits.
    let v4Start = 0;
    if (ipVersion === 6) {
      for (let i = 0; i < 96 && v4Start < nodeCount; i++) v4Start = follow(v4Start, 0);
    }

    return {
      built: Number.isInteger(meta.build_epoch) ? new Date(meta.build_epoch * 1000).toISOString().slice(0, 10) : null,

      lookup(ip) {
        try {
          const address = addressBytes(ip);
          if (!address) return null;
          if (address.length === 16 && ipVersion === 4) return null;

          let node = address.length === 4 ? v4Start : 0;
          for (let i = 0; i < address.length * 8 && node < nodeCount; i++) {
            node = follow(node, (address[i >> 3] >> (7 - (i & 7))) & 1);
          }
          if (node <= nodeCount) return null;

          const record = decode(node - nodeCount + treeSize, dataStart)[0];
          if (!record || typeof record !== 'object') return null;
          const code = record.country?.iso_code;
          const place = {
            country: typeof code === 'string' && /^[A-Z]{2}$/.test(code) ? code : null,
            region: name(record.subdivisions?.[0]?.names?.en),
            city: name(record.city?.names?.en),
          };
          return place.country || place.region || place.city ? place : null;
        } catch {
          return null;
        }
      },

      close() {
        closeSync(fd);
      },
    };
  } catch (error) {
    closeSync(fd);
    console.error('geo: cannot use the database:', error instanceof Error ? error.message : error);
    return null;
  }
}
