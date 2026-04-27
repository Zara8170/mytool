/**
 * stdin에서 모든 데이터를 읽어 문자열로 반환.
 *
 * - 타임아웃 안에 데이터가 전혀 안 들어오면 null 반환 (TTY 등에서 안전)
 * - 데이터가 들어오기 시작하면 EOF까지 읽음
 *
 * Claude Code의 hook은 stdin으로 JSON을 한 번에 보내므로 빠르게 EOF에 도달.
 */
export async function readStdinWithTimeout(timeoutMs: number): Promise<string | null> {
  if (process.stdin.isTTY) {
    // 터미널에서 직접 실행한 경우 stdin이 없을 수 있음
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = [];
    let receivedAny = false;
    let settled = false;

    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeAllListeners("data");
      process.stdin.removeAllListeners("end");
      process.stdin.removeAllListeners("error");
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish(receivedAny ? Buffer.concat(chunks).toString("utf-8") : null);
    }, timeoutMs);

    process.stdin.on("data", (chunk: Buffer) => {
      receivedAny = true;
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      finish(Buffer.concat(chunks).toString("utf-8"));
    });
    process.stdin.on("error", () => {
      finish(null);
    });
  });
}
