import { vulyoRoutes } from "@vulyo/core/routes";
import { vulyoMiddleware } from "@vulyo/nextjs";

export default vulyoMiddleware({
  publicRoutes: [vulyoRoutes.app.home],
  signInUrl: vulyoRoutes.app.home,
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
