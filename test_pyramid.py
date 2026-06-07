#!/usr/bin/env python3
"""对称数字金字塔测试。"""

import unittest
from pyramid import make_pyramid_lines, parse_args, build_parser


class TestPyramid(unittest.TestCase):
    """测试 make_pyramid_lines 输出正确性。"""

    def test_1_layer(self) -> None:
        """最小层数：1 层，只有 "1"。"""
        lines = make_pyramid_lines(1)
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0].strip(), "1")

    def test_5_layers_content(self) -> None:
        """5 层金字塔：验证每行去除空白后内容正确。"""
        lines = make_pyramid_lines(5)
        self.assertEqual(len(lines), 5)
        expected = [
            "1",
            "121",
            "12321",
            "1234321",
            "123454321",
        ]
        for i, exp in enumerate(expected):
            self.assertEqual(lines[i].strip(), exp)

    def test_5_layers_alignment(self) -> None:
        """5 层金字塔：验证居中对齐，所有行等宽。"""
        lines = make_pyramid_lines(5)
        widths = [len(line) for line in lines]
        self.assertEqual(len(set(widths)), 1, "所有行应等宽（居中对齐）")

    def test_3_layers(self) -> None:
        """3 层金字塔。"""
        lines = make_pyramid_lines(3)
        self.assertEqual(len(lines), 3)
        expected = ["1", "121", "12321"]
        for i, exp in enumerate(expected):
            self.assertEqual(lines[i].strip(), exp)

    def test_10_layers(self) -> None:
        """10 层金字塔：验证多位数（10 及以上）正确处理。"""
        lines = make_pyramid_lines(10)
        self.assertEqual(len(lines), 10)
        # 第 10 行: 12345678910987654321
        bottom = lines[9].strip()
        self.assertTrue(bottom.startswith("1"))
        self.assertTrue(bottom.endswith("1"))
        self.assertIn("10", bottom)


class TestBuildParser(unittest.TestCase):
    """测试 build_parser 返回正确的 ArgumentParser。"""

    def test_parser_defaults(self) -> None:
        """默认值检查：layers 默认 5，short/long 选项齐全。"""
        parser = build_parser()
        # parse known args without optional flag → should get default
        ns = parser.parse_args([])
        self.assertEqual(ns.layers, 5)

    def test_parser_short_flag(self) -> None:
        """短标志 -n 可正常工作。"""
        parser = build_parser()
        ns = parser.parse_args(["-n", "3"])
        self.assertEqual(ns.layers, 3)

    def test_parser_long_flag(self) -> None:
        """长标志 --layers 可正常工作。"""
        parser = build_parser()
        ns = parser.parse_args(["--layers", "10"])
        self.assertEqual(ns.layers, 10)


class TestParseArgs(unittest.TestCase):
    """测试命令行参数解析。"""

    def test_default(self) -> None:
        """无参数时返回默认值 5。"""
        self.assertEqual(parse_args([]), 5)

    def test_custom_short(self) -> None:
        """短标志 -n 指定层数。"""
        self.assertEqual(parse_args(["-n", "3"]), 3)
        self.assertEqual(parse_args(["-n", "10"]), 10)

    def test_custom_long(self) -> None:
        """长标志 --layers 指定层数。"""
        self.assertEqual(parse_args(["--layers", "7"]), 7)

    def test_invalid_string(self) -> None:
        """非数字参数应退出。"""
        with self.assertRaises(SystemExit):
            parse_args(["-n", "abc"])

    def test_negative(self) -> None:
        """负数参数应退出。"""
        with self.assertRaises(SystemExit):
            parse_args(["-n", "-1"])

    def test_zero(self) -> None:
        """0 参数应退出。"""
        with self.assertRaises(SystemExit):
            parse_args(["-n", "0"])

    def test_unknown_flag(self) -> None:
        """未定义的标志应退出。"""
        with self.assertRaises(SystemExit):
            parse_args(["--unknown"])


if __name__ == "__main__":
    unittest.main()
