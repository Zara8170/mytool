"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-muted">&quot;{projectName}&quot; 삭제?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {loading ? "삭제 중..." : "확인"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-muted hover:text-text">
          취소
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-muted text-xs hover:text-red-400 transition-colors"
    >
      삭제
    </button>
  );
}
