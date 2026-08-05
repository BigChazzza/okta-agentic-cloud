import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(
      new URL(`/patterns/p2?error=${encodeURIComponent(error)}`, base)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/patterns/p2?error=no_code", base));
  }

  const domain = process.env.OKTA_DOMAIN;
  const clientId = process.env.P2_OKTA_CLIENT_ID;
  const clientSecret = process.env.P2_OKTA_CLIENT_SECRET;
  const authServerId = process.env.INVENTORY_AUTHZ_SERVER_ID;
  const redirectUri = `${base}/api/auth/callback/p2`;

  if (!domain || !clientId || !clientSecret || !authServerId) {
    return NextResponse.redirect(
      new URL("/patterns/p2?error=missing_config", base)
    );
  }

  const tokenRes = await fetch(
    `https://${domain}/oauth2/${authServerId}/v1/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    }
  );

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return NextResponse.redirect(
      new URL(`/patterns/p2?error=${encodeURIComponent(body)}`, base)
    );
  }

  const tokens = await tokenRes.json() as { access_token?: string; id_token?: string };
  const accessToken = tokens.access_token;

  const response = NextResponse.redirect(new URL("/patterns/p2", base));

  if (accessToken) {
    response.cookies.set("p2_access_token", accessToken, {
      httpOnly: true,
      maxAge: 3600,
      sameSite: "lax",
      path: "/",
    });

    const snippet = accessToken.slice(0, 12) + "..." + accessToken.slice(-8);
    const eventBusUrl = process.env.EVENT_BUS_URL ?? "http://localhost:4000";
    await fetch(`${eventBusUrl}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patternId: "p2",
        actor: "Okta",
        action: "issued access_token",
        target: "Console",
        detail: "inventory:read scope granted",
        tokenSnippet: snippet,
        level: "token",
        token: accessToken,
      }),
    }).catch(() => {});
  }

  return response;
}
