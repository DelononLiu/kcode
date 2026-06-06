#!/usr/bin/env node

/**
 * 数字金字塔 CLI 脚本
 *
 * 使用方法:
 *   node number-pyramid.js [选项]
 *
 * 选项:
 *   -n, --layers <数字>  金字塔层数 (默认: 6, 范围: 1-100)
 *   -m, --mode <模式>   金字塔模式: symmetrical | repeated | continuous (默认: repeated)
 *   -h, --help          显示帮助信息
 *
 * 三种模式:
 *   symmetrical  — 数字从 1 递增到 n 再递减回 1
 *   repeated     — 每行重复当前行号数字
 *   continuous   — 数字从 1 开始连续填充
 */

'use strict';

// ---------- 生成函数 ----------

/**
 * 对称金字塔：每行数字从 1 递增到行号，再递减回 1
 * 例 (n=4):
 *       1
 *      1 2 1
 *     1 2 3 2 1
 *    1 2 3 4 3 2 1
 */
function generateSymmetrical(rows) {
  const lines = [];
  for (let r = 1; r <= rows; r++) {
    const nums = [];
    for (let i = 1; i <= r; i++) nums.push(i);
    for (let i = r - 1; i >= 1; i--) nums.push(i);
    lines.push(nums.join(' '));
  }
  return padLines(lines);
}

/**
 * 重复数字塔：每行重复当前行号，个数为 2*r-1
 * 例 (n=4):
 *       1
 *      2 2 2
 *     3 3 3 3 3
 *    4 4 4 4 4 4 4
 */
function generateRepeated(rows) {
  const lines = [];
  for (let r = 1; r <= rows; r++) {
    const count = 2 * r - 1;
    const nums = Array(count).fill(r);
    lines.push(nums.join(' '));
  }
  return padLines(lines);
}

/**
 * 连续数字塔：数字从 1 开始连续填充，每行 2*r-1 个
 * 例 (n=4):
 *       1
 *      2 3 4
 *     5 6 7 8 9
 *    10 11 12 13 14 15 16
 */
function generateContinuous(rows) {
  const lines = [];
  let counter = 1;
  for (let r = 1; r <= rows; r++) {
    const nums = [];
    for (let c = 1; c <= 2 * r - 1; c++) {
      nums.push(counter++);
    }
    lines.push(nums.join(' '));
  }
  return padLines(lines);
}

// ---------- 格式化 ----------

/**
 * 根据最长行做居中填充（左端填充空格，视觉居中）
 */
function padLines(lines) {
  if (lines.length === 0) return '';
  const maxLen = Math.max(...lines.map(l => l.length));
  return lines.map(line => {
    const pad = Math.floor((maxLen - line.length) / 2);
    return ' '.repeat(pad) + line;
  }).join('\n');
}

// ---------- 模式映射 ----------

const GENERATORS = {
  symmetrical: generateSymmetrical,
  repeated: generateRepeated,
  continuous: generateContinuous,
};

const MODE_ALIASES = {
  sym: 'symmetrical',
  symmetric: 'symmetrical',
  rep: 'repeated',
  repeat: 'repeated',
  cont: 'continuous',
};

const MODE_DESCRIPTIONS = {
  symmetrical: '数字从 1 递增到 n 再递减回 1',
  repeated: '每行重复当前行号数字',
  continuous: '数字从 1 开始连续填充',
};

// ---------- 参数解析 ----------

function parseArgs(argv) {
  const args = { layers: 6, mode: 'repeated', help: false };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }

    if (arg === '-n' || arg === '--layers') {
      i++;
      if (i >= argv.length) {
        return { error: '选项 --layers/-n 缺少参数' };
      }
      const val = parseInt(argv[i], 10);
      if (isNaN(val) || !Number.isInteger(val)) {
        return { error: `--layers 必须为整数，收到: "${argv[i]}"` };
      }
      if (val < 1 || val > 100) {
        return { error: `--layers 必须在 1-100 之间，收到: ${val}` };
      }
      args.layers = val;
      continue;
    }

    if (arg === '-m' || arg === '--mode') {
      i++;
      if (i >= argv.length) {
        return { error: '选项 --mode/-m 缺少参数' };
      }
      let mode = argv[i].toLowerCase();
      // 别名解析
      if (MODE_ALIASES[mode]) mode = MODE_ALIASES[mode];
      if (!GENERATORS[mode]) {
        return { error: `未知模式 "${argv[i]}"，可用模式: symmetrical, repeated, continuous` };
      }
      args.mode = mode;
      continue;
    }

    // 未知参数
    return { error: `未知选项 "${arg}"，使用 --help 查看帮助` };
  }

  return args;
}

// ---------- 帮助信息 ----------

function printHelp() {
  console.log(`
用法: node number-pyramid.js [选项]

选项:
  -n, --layers <数字>  金字塔层数 (默认: 6, 范围: 1-100)
  -m, --mode <模式>   金字塔模式 (默认: repeated)
                      支持以下模式:
                        symmetrical  对称金字塔 — 数字从 1 递增到 n 再递减回 1
                        repeated     重复数字塔 — 每行重复当前行号数字
                        continuous   连续数字塔 — 数字从 1 开始连续填充
  -h, --help          显示此帮助信息

示例:
  node number-pyramid.js
  node number-pyramid.js -n 8
  node number-pyramid.js --layers 10 --mode symmetrical
  node number-pyramid.js -m continuous -n 5
`);
}

// ---------- 主入口 ----------

function main() {
  const result = parseArgs(process.argv);

  // 显示帮助
  if (result.help) {
    printHelp();
    process.exit(0);
  }

  // 参数错误
  if (result.error) {
    console.error('错误:', result.error);
    console.error('使用 --help 查看帮助信息');
    process.exit(1);
  }

  // 生成并输出
  const generate = GENERATORS[result.mode];
  const output = generate(result.layers);

  console.log(output);
}

// 如果直接运行则执行 main，否则导出供测试/复用
if (require.main === module) {
  main();
}

module.exports = {
  generateSymmetrical,
  generateRepeated,
  generateContinuous,
  GENERATORS,
  MODE_DESCRIPTIONS,
};
