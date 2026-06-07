#!/usr/bin/env python3
"""对称数字金字塔命令行脚本。

用法:
    python pyramid.py [-n 层数]

示例:
    python pyramid.py        # 默认 5 层
    python pyramid.py -n 3   # 3 层
"""

import argparse
import sys


def make_pyramid_lines(layers: int) -> list[str]:
    """生成对称数字金字塔的每行文本。

    Args:
        layers: 金字塔层数（> 0）。

    Returns:
        每行已居中对齐的字符串列表。
    """
    # 最大行数字符串长度：最底层 "1 → layers → 1" 的长度
    bottom = "".join(str(i) for i in range(1, layers + 1)) + \
             "".join(str(i) for i in range(layers - 1, 0, -1))
    width = len(bottom)

    lines: list[str] = []
    for row in range(1, layers + 1):
        # 升序部分: 1 → row
        ascending = "".join(str(i) for i in range(1, row + 1))
        # 降序部分: row-1 → 1
        descending = "".join(str(i) for i in range(row - 1, 0, -1))
        line = ascending + descending
        lines.append(line.center(width))

    return lines


def print_pyramid(layers: int) -> None:
    """打印对称数字金字塔到标准输出。

    Args:
        layers: 金字塔层数。
    """
    for line in make_pyramid_lines(layers):
        print(line)


def build_parser() -> argparse.ArgumentParser:
    """构建命令行参数解析器。

    Returns:
        配置好的 ArgumentParser 实例。
    """
    parser = argparse.ArgumentParser(
        description="打印对称数字金字塔",
    )
    parser.add_argument(
        "-n", "--layers",
        type=int,
        default=5,
        help="金字塔层数（默认: 5）",
    )
    return parser


def parse_args(argv: list[str]) -> int:
    """解析命令行参数，返回层数。

    Args:
        argv: 命令行参数列表（不含程序名）。

    Returns:
        金字塔层数。

    Raises:
        SystemExit: 参数格式错误或层数非法时退出。
    """
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.layers < 1:
        print("错误：层数必须大于 0", file=sys.stderr)
        sys.exit(1)
    return args.layers


def main() -> None:
    """入口函数。"""
    layers = parse_args(sys.argv[1:])
    print_pyramid(layers)


if __name__ == "__main__":
    main()
