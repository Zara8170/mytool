import { redirect } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { serverFetch, ServerApiError } from "@/lib/server-api";
import type { MeResponse } from "@mytool/shared";

export default async function HomePage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  try {
    const me = await serverFetch<MeResponse>("/api/auth/me");
    if (me.organizations.length === 0) {
      // 일반적으로 회원가입 시 자동 생성되지만 안전 가드
      return (
        <main className="p-8">
          <h1 className="text-2xl font-bold">No organizations</h1>
          <p className="text-muted">
            Run <code className="bg-panel px-2 py-1 rounded">mytool</code> in
            your project to create one.
          </p>
        </main>
      );
    }
    // 첫 org의 첫 프로젝트 또는 settings로
    const firstOrgId = me.organizations[0]!.id;
    const projects = await serverFetch<{
      projects: Array<{ id: string; name: string; slug: string }>;
    }>(`/api/orgs/${firstOrgId}/projects`);

    if (projects.projects.length === 0) {
      redirect("/settings");
    }
    redirect(`/dashboard/${projects.projects[0]!.id}`);
  } catch (err) {
    if (err instanceof ServerApiError && err.status === 401) {
      redirect("/login");
    }
    throw err;
  }
}
