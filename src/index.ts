import { mainWorkflow } from './workflow';

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('请提供查询参数，如: node src/index.js "This Is a Long Drive Modest Mouse"');
    process.exit(1);
  }

  const sourceSites = ["genius.com", "songmeanings.com"];

  try {
    await mainWorkflow(query, sourceSites);
  } catch (error) {
    console.error(`❌ 程序发生致命错误，终止运行: ${(error as Error).message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("\n🔥🔥🔥 程序出现未捕获的致命错误:", error);
  process.exit(1);
});