import { createHash } from "crypto";
import log = require("./log.js");

function Utils() {}

const zeroValue = "0".charCodeAt(0);
const aValue = "A".charCodeAt(0);

// Codifica un número como 16 caracteres hex: el double IEEE-754 big-endian
Utils.intToString = function (val: number): string {
  const bytes = new Buffer(8);
  let b: number;
  let res = "";
  bytes.writeDoubleBE(val);
  let i = 0;
  while (i < bytes.length) {
    b = (bytes[i] >> 4) & 15;
    res = res + String.fromCharCode(b > 9 ? aValue + b - 10 : zeroValue + b);
    b = bytes[i] & 15;
    res = res + String.fromCharCode(b > 9 ? aValue + b - 10 : zeroValue + b);
    i++;
  }

  return res;
};

Utils.string2Bin = function (str: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < str.length; i++) {
    result.push(str.charCodeAt(i).toString(2));
  }
  return result;
};

Utils.bin2String = function (array: string[]): string {
  let result = "";
  for (let i = 0; i < array.length; i++) {
    result += String.fromCharCode(parseInt(array[i], 2));
  }
  return result;
};

// Inverso de intToString. Devuelve 0 si str está vacío y -1 si no tiene 16 caracteres
Utils.stringToInt = function (str: string | undefined): number {
  if (!str) return 0;

  if (str.length != 16) {
    log.warn({ str }, "Número codificado inválido");
    return -1;
  }

  let b: number;
  let ch: number;
  const bytes = new Buffer(8);
  let loc = 0;

  for (let i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i);
    b = ch >= aValue ? 10 + ch - aValue : ch - zeroValue;
    i++;
    b = b << 4;
    ch = str.charCodeAt(i);
    b = b | (ch >= aValue ? 10 + ch - aValue : ch - zeroValue);
    b = b & 0xff;
    bytes.writeUInt8(b, loc++);
  }

  return bytes.readDoubleBE(0);
};

Utils.randInt = function (): number {
  return parseInt(String(Math.random() * 1000));
};

Utils.md5 = function (str: string): string {
  return createHash("md5").update(str).digest("hex");
};

export = Utils;
