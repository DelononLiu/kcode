import { describe, it, expect } from 'vitest';

/**
 * 数字金字塔核心算法
 */

/** 对称金字塔：1 ··· n ··· 1 */
function generateSymmetrical(rows: number): string[] {
  const lines: string[] = [];
  for (let r = 1; r <= rows; r++) {
    const nums: number[] = [];
    for (let i = 1; i <= r; i++) nums.push(i);
    for (let i = r - 1; i >= 1; i--) nums.push(i);
    lines.push(nums.join(' '));
  }
  return padLines(lines);
}

/** 重复数字塔：每行重复当前行号 (2r-1) 次 */
function generateRepeated(rows: number): string[] {
  const lines: string[] = [];
  for (let r = 1; r <= rows; r++) {
    const count = 2 * r - 1;
    const nums = Array(count).fill(r);
    lines.push(nums.join(' '));
  }
  return padLines(lines);
}

/** 连续数字塔：从 1 开始顺序填充每一行 */
function generateContinuous(rows: number): string[] {
  const lines: string[] = [];
  let counter = 1;
  for (let r = 1; r <= rows; r++) {
    const nums: number[] = [];
    for (let c = 1; c <= 2 * r - 1; c++) {
      nums.push(counter++);
    }
    lines.push(nums.join(' '));
  }
  return padLines(lines);
}

function padLines(lines: string[]): string[] {
  if (lines.length === 0) return [];
  const maxLen = Math.max(...lines.map(l => l.length));
  return lines.map(line => {
    const pad = Math.floor((maxLen - line.length) / 2);
    return ' '.repeat(pad) + line;
  });
}

// ---------- 测试 ----------

describe('数字金字塔', () => {
  describe('对称金字塔', () => {
    it('1 层输出 ["1"]', () => {
      const result = generateSymmetrical(1);
      expect(result).toHaveLength(1);
      expect(result[0].trim()).toBe('1');
    });

    it('3 层格式正确', () => {
      const result = generateSymmetrical(3);
      expect(result).toHaveLength(3);
      // 第 1 行: "  1"
      expect(result[0].trim()).toBe('1');
      // 第 2 行: " 1 2 1"
      expect(result[1].trim()).toBe('1 2 1');
      // 第 3 行: "1 2 3 2 1"
      expect(result[2].trim()).toBe('1 2 3 2 1');
    });

    it('5 层对称性检查：首尾数字一致', () => {
      const result = generateSymmetrical(5);
      expect(result).toHaveLength(5);
      result.forEach((line, idx) => {
        const nums = line.trim().split(/\s+/).map(Number);
        expect(nums[0]).toBe(1);
        expect(nums[nums.length - 1]).toBe(1);
        expect(nums.length).toBe(2 * (idx + 1) - 1);
      });
    });

    it('边界：层数为 0 返回空数组', () => {
      expect(generateSymmetrical(0)).toEqual([]);
    });
  });

  describe('重复数字塔', () => {
    it('1 层输出 ["1"]', () => {
      const result = generateRepeated(1);
      expect(result).toHaveLength(1);
      expect(result[0].trim()).toBe('1');
    });

    it('3 层每行重复当前行号', () => {
      const result = generateRepeated(3);
      // 第 1 行: "  1"
      expect(result[0].trim()).toBe('1');
      // 第 2 行: " 2 2 2"
      expect(result[1].trim()).toBe('2 2 2');
      // 第 3 行: "3 3 3 3 3"
      expect(result[2].trim()).toBe('3 3 3 3 3');
    });

    it('4 层第 4 行有 7 个数字', () => {
      const result = generateRepeated(4);
      const nums = result[3].trim().split(/\s+/);
      expect(nums).toHaveLength(7);
      nums.forEach(n => expect(Number(n)).toBe(4));
    });
  });

  describe('连续数字塔', () => {
    it('1 层输出 ["1"]', () => {
      const result = generateContinuous(1);
      expect(result).toHaveLength(1);
      expect(result[0].trim()).toBe('1');
    });

    it('3 层数字连续无间断', () => {
      const result = generateContinuous(3);
      const allNums = result.join(' ').trim().split(/\s+/).map(Number);
      for (let i = 0; i < allNums.length; i++) {
        expect(allNums[i]).toBe(i + 1);
      }
    });

    it('4 层总数字数 = 1 + 3 + 5 + 7 = 16', () => {
      const result = generateContinuous(4);
      const allNums = result.join(' ').trim().split(/\s+/).map(Number);
      expect(allNums).toHaveLength(16);
      expect(allNums[0]).toBe(1);
      expect(allNums[15]).toBe(16);
    });
  });

  describe('padLines 居中填充', () => {
    it('较短行填充更多前导空格', () => {
      const lines = ['1', '1 2 1', '1 2 3 2 1'];
      const padded = padLines(lines);
      // 填充后在左端添加了空格，越短的行空格越多
      expect(padded[0].length).toBeLessThan(padded[2].length);
      expect(padded[1].length).toBeLessThan(padded[2].length);
    });

    it('等长行不做额外填充', () => {
      const lines = ['a b', 'c d'];
      const padded = padLines(lines);
      expect(padded).toEqual(lines);
    });

    it('所有行的前导空格数在合理范围内', () => {
      const lines = ['1', '1 2 1', '1 2 3 2 1'];
      const padded = padLines(lines);
      // 第一行 (最短) 有最多前导空格
      const leading1 = padded[0].length - padded[0].trimStart().length;
      const leading2 = padded[1].length - padded[1].trimStart().length;
      expect(leading1).toBeGreaterThan(leading2);
    });
  });
});
