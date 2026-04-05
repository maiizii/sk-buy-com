const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(process.cwd(), "data", "sks-import-sites.local.json");

if (!fs.existsSync(inputPath)) {
  console.error(JSON.stringify({
    success: false,
    error: `导入文件不存在: ${inputPath}`,
  }, null, 2));
  process.exit(1);
}

process.env.SKS_IMPORT_SITES_JSON = fs.readFileSync(inputPath, "utf8");
require("./sks-import-sites.cjs");
