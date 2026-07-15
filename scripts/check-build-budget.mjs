import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const assetRoot = join(process.cwd(), "dist", "assets");
const files = readdirSync(assetRoot).map((name) => ({ name, path: join(assetRoot, name) }));
const budgets = [
  { extension: ".js", gzipLimit: 130 * 1024, guardLimit: 125 * 1024, label: "JavaScript" },
  { extension: ".css", gzipLimit: 10 * 1024, guardLimit: 8 * 1024, label: "CSS" },
];

for (const budget of budgets) {
  const matched = files.filter((file) => file.name.endsWith(budget.extension));
  const gzipSize = matched.reduce((sum, file) => sum + gzipSync(readFileSync(file.path)).byteLength, 0);
  if (matched.length === 0) throw new Error(`没有找到 ${budget.label} 构建产物。`);
  if (gzipSize > budget.gzipLimit) throw new Error(`${budget.label} 压缩体积 ${gzipSize} 字节超过预算 ${budget.gzipLimit} 字节。`);
  if (gzipSize > budget.guardLimit) throw new Error(`${budget.label} 压缩体积 ${gzipSize} 字节超过扩展保护线 ${budget.guardLimit} 字节，必须先释放体积余量。`);
  console.log(`${budget.label} 压缩体积 ${gzipSize} 字节，扩展保护线检查通过。`);
}

if (files.some((file) => statSync(file.path).size === 0)) throw new Error("构建产物中存在空文件。");
