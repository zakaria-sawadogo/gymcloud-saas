// §14.x — jsqr est une librairie JS pure, sans typage officiel fourni.
// Déclaration minimale, couvrant uniquement ce qu'on utilise réellement.
declare module 'jsqr' {
  interface QRCodePoint {
    x: number;
    y: number;
  }

  interface QRCodeLocation {
    topLeftCorner: QRCodePoint;
    topRightCorner: QRCodePoint;
    bottomLeftCorner: QRCodePoint;
    bottomRightCorner: QRCodePoint;
  }

  interface QRCode {
    binaryData: number[];
    data: string;
    chunks: unknown[];
    location: QRCodeLocation;
  }

  interface Options {
    inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
  }

  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: Options,
  ): QRCode | null;

  export default jsQR;
}
