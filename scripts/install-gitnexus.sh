#!/usr/bin/env bash

NODE_HOME=~/node-v24.13.0-linux-x64

echo "=== 1. 安装 gitnexus ==="
npm install -g gitnexus --ignore-scripts

echo "=== 2. 运行 ladybugdb 安装脚本 ==="
node "$NODE_HOME/lib/node_modules/gitnexus/node_modules/@ladybugdb/core/install.js"

echo "=== 3. 替换 libstdc++ ==="
cp ~/miniforge3/lib/libstdc++.so.6.0.34 "$NODE_HOME/lib/libstdc++.so.6"

echo "=== 4. 重命名 gitnexus → _gitnexus（真实入口） ==="
mv "$NODE_HOME/bin/gitnexus" "$NODE_HOME/bin/_gitnexus"

echo "=== 5. 写入 shell 包装器 gitnexus（LD_LIBRARY_PATH） ==="
cat > "$NODE_HOME/bin/gitnexus" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
__DIR__="$(cd "$(dirname "$0")" && pwd)"
export LD_LIBRARY_PATH="$__DIR__/../lib${LD_LIBRARY_PATH:+:}${LD_LIBRARY_PATH:-}"
exec "$__DIR__/_gitnexus" "$@"
WRAPPER
chmod +x "$NODE_HOME/bin/gitnexus"

echo "=== 完成 ==="
gitnexus --version
