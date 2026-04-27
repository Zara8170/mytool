import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

export interface ProjectConfig {
  projectId: string;
  orgId: string;
  /** 셀프호스팅 인스턴스를 가리키도록 팀 전체에 적용할 때 사용 */
  apiUrl?: string;
}

export const PROJECT_CONFIG_DIR = ".mytool";
export const PROJECT_CONFIG_FILE = "project.json";

/**
 * 현재 디렉터리부터 위로 탐색하며 .mytool/project.json 찾음.
 * 팀원이 저장소를 clone한 어느 하위 폴더에서 실행해도 동작.
 */
export function findProjectConfig(
  startDir: string = process.cwd(),
): { config: ProjectConfig; configDir: string } | null {
  let dir = resolve(startDir);
  const root = parse(dir).root;

  while (dir !== root) {
    const candidate = join(dir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
    if (existsSync(candidate)) {
      try {
        const config = JSON.parse(readFileSync(candidate, "utf-8")) as ProjectConfig;
        if (config.projectId && config.orgId) {
          return { config, configDir: dir };
        }
      } catch {
        // 무시하고 더 위로
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 루트에서도 한 번 더 체크
  const rootCandidate = join(root, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
  if (existsSync(rootCandidate)) {
    try {
      const config = JSON.parse(readFileSync(rootCandidate, "utf-8")) as ProjectConfig;
      if (config.projectId && config.orgId) {
        return { config, configDir: root };
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export function writeProjectConfig(
  projectRoot: string,
  config: ProjectConfig,
): string {
  const path = join(projectRoot, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
  return path;
}
