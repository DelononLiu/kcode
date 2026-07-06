#!/usr/bin/env python3
"""数字金字塔 — 层数作为入参，默认 5 层"""

import sys

def pyramid(layers: int) -> str:
    lines = []
    width = layers * 2 - 1
    for i in range(1, layers + 1):
        nums = ' '.join(str(j) for j in range(1, i + 1))
        lines.append(nums.center(width * 2 - 1))
    return '\n'.join(lines)


if __name__ == '__main__':
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    print(pyramid(n))
