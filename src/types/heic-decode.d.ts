declare module 'heic-decode' {
  type DecodedImage = { width: number; height: number; data: Uint8ClampedArray };
  function decode(opts: { buffer: ArrayBufferLike | Uint8Array | Buffer }): Promise<DecodedImage>;
  namespace decode {
    function all(opts: { buffer: ArrayBufferLike | Uint8Array | Buffer }): Promise<(DecodedImage & { decode(): Promise<DecodedImage> })[]>;
  }
  export default decode;
}
