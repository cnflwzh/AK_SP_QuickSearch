/** 以高位优先写入非负整数，最后不足一字节的位补零。 */
export class BitWriter {
  private bytes: number[] = [];
  private position = 0;
  write(value: number, width: number): void {
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** width)
      throw new Error('Share value out of range');
    for (let bit = width - 1; bit >= 0; bit--, this.position++) {
      const index = this.position >> 3;
      this.bytes[index] =
        (this.bytes[index] ?? 0) |
        (((value >> bit) & 1) << (7 - (this.position & 7)));
    }
  }
  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** 读取位流；字段截断、额外字节或非零填充均抛出异常，由导入入口统一处理。 */
export class BitReader {
  private data: Uint8Array;
  private position = 0;
  constructor(data: Uint8Array) {
    this.data = data;
  }
  get remaining(): number {
    return this.data.length * 8 - this.position;
  }
  read(width: number): number {
    if (width > this.remaining) throw new Error('Incomplete share data');
    let value = 0;
    for (let bit = 0; bit < width; bit++, this.position++)
      value =
        value * 2 +
        ((this.data[this.position >> 3] >> (7 - (this.position & 7))) & 1);
    return value;
  }
  finish(): void {
    if (this.remaining > 7 || this.read(this.remaining))
      throw new Error('Unexpected share data');
  }
}
