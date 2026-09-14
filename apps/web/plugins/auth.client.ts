import type { SessionUser } from '~/stores/auth';

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore();
  auth.restore();
  if (!auth.token) return;

  try {
    const api = useApi();
    auth.setUser(await api.get<SessionUser>('/auth/me'), !auth.assumptionProfile);
  } catch {
    auth.clear();
  }
});
