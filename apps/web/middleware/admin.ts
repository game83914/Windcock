import type { CapabilitySummary, SessionUser } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const auth = useAuthStore();
  auth.restore();
  if (!auth.token) return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);

  if (!auth.role) {
    try {
      auth.setUser(await useApi().get<SessionUser>('/auth/me'));
    } catch {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }
  if (!auth.capabilitySummary) {
    try { auth.setCapabilities(await useApi().get<CapabilitySummary>('/me/capabilities')); }
    catch { return navigateTo('/'); }
  }
  if (!auth.canModerate) return navigateTo('/');
});
