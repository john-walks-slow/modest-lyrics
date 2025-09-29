import { mainWorkflow } from './main/workflows';

const TEST_QUERY = "";
const TEST_SOURCES: string[] = [];

async function main() {
  const query = process.argv[2] || TEST_QUERY;
  if (!query) {
    console.error('请提供查询参数，如: node src/index.js "This Is a Long Drive Modest Mouse" [sourceSites]');
    console.error('sourceSites 可选，逗号分隔站点列表，如: genius.com,songmeanings.com 或留空使用默认');
    process.exit(1);
  }

  let sourceSites: string[] = TEST_SOURCES;
  const sitesArg = process.argv[3];
  if (sitesArg !== undefined) {
    if (sitesArg.trim() === '') {
      sourceSites = [];
    } else {
      sourceSites = sitesArg.split(',').map(site => site.trim()).filter(site => site.length > 0);
    }
  }

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