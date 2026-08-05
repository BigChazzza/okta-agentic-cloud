import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const domain = process.env.OKTA_DOMAIN;
  const clientId = process.env.P2_OKTA_CLIENT_ID;
  const authServerId = process.env.INVENTORY_AUTHZ_SERVER_ID;

  if (!domain || !clientId || !authServerId) {
    return NextResponse.json(
      { error: "OKTA_DOMAIN, P2_OKTA_CLIENT_ID, and INVENTORY_AUTHZ_SERVER_ID must be set" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const redirectUri = `${base}/api/auth/callback/p2`;

  const url = new URL(`https://${domain}/oauth2/${authServerId}/v1/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email inventory:read");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set("p2_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
