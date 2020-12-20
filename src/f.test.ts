import { uint32toUint8Array, uint8ArrayToUint32 } from "./f";

describe("uint32toUintArray", () => {
  test("throws on negative numbers", () => {
    expect(() => uint32toUint8Array(-1)).toThrow(RangeError);
  });
  test("throws on numbers bigger than 2 ** 32", () => {
    expect(() => uint32toUint8Array(2 ** 32)).toThrow(RangeError);
  });
  test("converts numbers to uint8 arrays", () => {
    expect(uint32toUint8Array(0)).toEqual(Uint8Array.from([0, 0, 0, 0]));
    expect(uint32toUint8Array(1)).toEqual(Uint8Array.from([0, 0, 0, 1]));
    expect(uint32toUint8Array(255)).toEqual(Uint8Array.from([0, 0, 0, 255]));
    expect(uint32toUint8Array(256)).toEqual(Uint8Array.from([0, 0, 1, 0]));
    expect(uint32toUint8Array(2 ** 32 - 1)).toEqual(
      Uint8Array.from([255, 255, 255, 255])
    );
  });
});

describe("uint8ArrayToUint32", () => {
  test("throws on arrays without the right amount of bytes", () => {
    expect(() => uint8ArrayToUint32(Uint8Array.from([]))).toThrow(RangeError);
    expect(() => uint8ArrayToUint32(Uint8Array.from([0, 0, 0, 0, 0]))).toThrow(
      RangeError
    );
  });
  test("converts uint8 arrays to numbers", () => {
    expect(uint8ArrayToUint32(Uint8Array.from([0, 0, 0, 0]))).toEqual(0);
    expect(uint8ArrayToUint32(Uint8Array.from([0, 0, 0, 1]))).toEqual(1);
    expect(uint8ArrayToUint32(Uint8Array.from([0, 0, 0, 255]))).toEqual(255);
    expect(uint8ArrayToUint32(Uint8Array.from([0, 0, 1, 0]))).toEqual(256);
    expect(uint8ArrayToUint32(Uint8Array.from([255, 255, 255, 255]))).toEqual(
      2 ** 32 - 1
    );
  });
});
