/**
 * Methods to determine resource types based on the magic
 * bytes of buffer data.
 */
export class ResourceTypes {
  static isGzipped(buffer: Buffer): boolean {
    if (buffer.length < 2) {
      return false;
    }
    return buffer[0] === 0x1f && buffer[1] === 0x8b;
  }

  static startsWith(buffer: Buffer, magic: string) {
    if (buffer.length < magic.length) {
      return false;
    }
    const actual = buffer.toString("utf8", 0, magic.length);
    return actual === magic;
  }

  static isB3dm(buffer: Buffer): boolean {
    return this.startsWith(buffer, "b3dm");
  }

  static isI3dm(buffer: Buffer): boolean {
    return this.startsWith(buffer, "i3dm");
  }

  static isPnts(buffer: Buffer): boolean {
    return this.startsWith(buffer, "pnts");
  }

  static isCmpt(buffer: Buffer): boolean {
    return this.startsWith(buffer, "cmpt");
  }

  static isGlb(buffer: Buffer): boolean {
    return this.startsWith(buffer, "glTF");
  }

  static isSubt(buffer: Buffer): boolean {
    return this.startsWith(buffer, "subt");
  }

  static isProbablyJson(buffer: Buffer): boolean {
    for (let i = 0; i < buffer.length; i++) {
      const c = String.fromCharCode(buffer[i]);
      // NOTE: This regex HAS to be declared here, otherwise the `test`
      // call will randomly return wrong values.
      // For details, refer to https://stackoverflow.com/q/3891641
      // They gotta be kidding. Un. Be. Lie. Va. Ble.
      const whitespaceRegex = /\s/g;
      if (whitespaceRegex.test(c)) {
        continue;
      }
      if (c === "{" || c === "[") {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }
}