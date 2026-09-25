import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Server-side defaults for the Settings page Slack fields. The token lives only in the
// SLACK_BOT_TOKEN env var (Vercel/Render dashboard) — never in source control.
// The Settings page calls this once on load to pre-fill the form; the user can still
// overwrite and save a different token/channel in their own browser session.
export async function GET() {
  return NextResponse.json({
    slackToken: process.env.SLACK_BOT_TOKEN ?? "",
    slackChannel: process.env.SLACK_DEFAULT_CHANNEL ?? "",
  });
}
