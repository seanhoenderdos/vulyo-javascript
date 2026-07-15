export type VulyoId = string;

export type SafeEndUser = {
  id: VulyoId;
  appId: VulyoId;
  appInstanceId: VulyoId;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  imageUrl?: string | null;
};

export type SessionClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  sid: string;
  jti: string;
  app_id: string;
  app_instance_id: string;
  token_version: number;
  iat: number;
  nbf: number;
  exp: number;
};
