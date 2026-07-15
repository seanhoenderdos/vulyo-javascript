export function buildAuthorizationCallbackUrl(input: {
  authorizationCode: string;
  redirectUrl: string;
  state: string;
}) {
  const callback = new URL(input.redirectUrl);
  callback.searchParams.set("code", input.authorizationCode);
  callback.searchParams.set("state", input.state);
  return callback.toString();
}
