/**
 * Tracks resource usage history for sparkline graphs
 */
export class ResourceHistory {
  private cpuHistory: number[] = [];
  private memoryHistory: number[] = [];
  private maxDataPoints: number;

  constructor(maxDataPoints: number = 30) {
    this.maxDataPoints = maxDataPoints;
  }

  /**
   * Add a data point to the history
   */
  addDataPoint(cpu: number, memory: number): void {
    this.cpuHistory.push(cpu);
    this.memoryHistory.push(memory);

    // Keep only the last N data points
    if (this.cpuHistory.length > this.maxDataPoints) {
      this.cpuHistory.shift();
    }
    if (this.memoryHistory.length > this.maxDataPoints) {
      this.memoryHistory.shift();
    }
  }

  /**
   * Get CPU history
   */
  getCpuHistory(): number[] {
    return [...this.cpuHistory];
  }

  /**
   * Get memory history
   */
  getMemoryHistory(): number[] {
    return [...this.memoryHistory];
  }

  /**
   * Generate ASCII sparkline from data
   */
  static generateSparkline(data: number[], width: number = 20): string {
    if (data.length === 0) return '─'.repeat(width);

    // Sparkline characters from lowest to highest
    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

    // Get the last 'width' data points
    const slice = data.slice(-width);
    const max = Math.max(...slice, 1); // Avoid division by zero
    const min = Math.min(...slice, 0);
    const range = max - min || 1;

    return slice
      .map((value) => {
        const normalized = (value - min) / range;
        const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
        return chars[index];
      })
      .join('');
  }

  /**
   * Get CPU sparkline
   */
  getCpuSparkline(width: number = 20): string {
    return ResourceHistory.generateSparkline(this.cpuHistory, width);
  }

  /**
   * Get memory sparkline
   */
  getMemorySparkline(width: number = 20): string {
    return ResourceHistory.generateSparkline(this.memoryHistory, width);
  }

  /**
   * Generate Braille sparkline from data.
   * Each Braille character encodes 2 data points (left + right columns) with 4 vertical levels,
   * giving 2x horizontal resolution compared to block sparklines.
   *
   * Braille dot positions:
   *   Left column (dots 1-4 top-to-bottom): dot1=0x01, dot2=0x02, dot3=0x04, dot7=0x40
   *   Right column (dots 4-8 top-to-bottom): dot4=0x08, dot5=0x10, dot6=0x20, dot8=0x80
   *
   * We fill from bottom to top, so:
   *   Left fill levels 0-4:  [0, 0x40, 0x44, 0x46, 0x47]
   *   Right fill levels 0-4: [0, 0x80, 0xA0, 0xB0, 0xB8]
   */
  static generateBrailleSparkline(data: number[], width: number = 20): string {
    if (data.length === 0) return '⠀'.repeat(width); // Braille blank (U+2800)

    // Left column fill levels (bottom to top): none, dot7, dot7+dot3, dot7+dot3+dot2, dot7+dot3+dot2+dot1
    const leftDots = [0, 0x40, 0x44, 0x46, 0x47];
    // Right column fill levels (bottom to top): none, dot8, dot8+dot6, dot8+dot6+dot5, dot8+dot6+dot5+dot4
    const rightDots = [0, 0x80, 0xa0, 0xb0, 0xb8];

    // We need width*2 data points (2 per Braille char). Take the last width*2 points.
    const needed = width * 2;
    const slice = data.slice(-needed);
    const max = Math.max(...slice, 1);
    const min = Math.min(...slice, 0);
    const range = max - min || 1;

    // Normalize each value to 0-4 (4 vertical levels)
    const levels = slice.map((v) => {
      const normalized = (v - min) / range;
      return Math.min(Math.round(normalized * 4), 4);
    });

    // Pad with zeros on the left if we don't have enough data
    while (levels.length < needed) {
      levels.unshift(0);
    }

    // Build braille characters, 2 data points per char
    const chars: string[] = [];
    for (let i = 0; i < needed; i += 2) {
      const leftVal = levels[i]!;
      const rightVal = levels[i + 1]!;
      const codePoint = 0x2800 + leftDots[leftVal]! + rightDots[rightVal]!;
      chars.push(String.fromCharCode(codePoint));
    }

    return chars.join('');
  }

  /**
   * Get CPU braille sparkline
   */
  getCpuBrailleSparkline(width: number = 20): string {
    return ResourceHistory.generateBrailleSparkline(this.cpuHistory, width);
  }

  /**
   * Get memory braille sparkline
   */
  getMemoryBrailleSparkline(width: number = 20): string {
    return ResourceHistory.generateBrailleSparkline(this.memoryHistory, width);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.cpuHistory = [];
    this.memoryHistory = [];
  }
}
