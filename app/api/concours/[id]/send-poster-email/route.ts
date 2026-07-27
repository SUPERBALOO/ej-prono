import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erreur inconnue";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeHttpUrl(
  value: string,
  fieldName: string,
  baseUrl?: string
) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = baseUrl
      ? new URL(trimmed, baseUrl)
      : new URL(trimmed);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error(
      `${fieldName} doit etre un lien public valide`
    );
  }
}

function buildEmailHtml({
  concoursName,
  message,
  imageUrl,
  ctaUrl,
}: {
  concoursName: string;
  message: string;
  imageUrl: string;
  ctaUrl: string;
}) {
  const safeMessage = escapeHtml(message).replace(
    /\n/g,
    "<br />"
  );
  const safeConcoursName = escapeHtml(concoursName);

  return `
<!doctype html>
<html>
  <body style="margin:0;background:#10243a;font-family:Arial,sans-serif;color:#ffffff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#10243a;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#33465d;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:26px 24px 12px;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;">EJ Prono</h1>
                <p style="margin:8px 0 0;color:#d8aa82;font-weight:bold;">${safeConcoursName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 22px;font-size:17px;line-height:1.5;color:#f4f7fb;">
                ${safeMessage}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 24px;">
                <img src="${imageUrl}" alt="Affiche des gagnants EJ Prono" style="display:block;width:100%;max-width:680px;border-radius:14px;border:0;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 30px;">
                <a href="${ctaUrl}" style="display:inline-block;background:#d8aa82;color:#1e3047;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px;">
                  Ouvrir EJ Prono
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function assertAdmin(token: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: "Session invalide", status: 401 };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

  if (profileError) {
    throw profileError;
  }

  if (!profile?.is_admin) {
    return {
      error: "Action reservee aux administrateurs",
      status: 403,
    };
  }

  return { user };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    const adminCheck = await assertAdmin(token);

    if ("error" in adminCheck) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.MAIL_FROM ||
      process.env.RESEND_FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return NextResponse.json(
        {
          error:
            "Variables RESEND_API_KEY et MAIL_FROM manquantes",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const subject = String(body.subject || "")
      .trim()
      .slice(0, 160);
    const message = String(body.message || "")
      .trim()
      .slice(0, 2500);
    const imageUrl = normalizeHttpUrl(
      String(body.imageUrl || ""),
      "Le lien de l'affiche"
    );
    const ctaUrl =
      normalizeHttpUrl(
        String(body.ctaUrl || `/concours/${id}`),
        "Le lien du bouton",
        req.nextUrl.origin
      ) || `${req.nextUrl.origin}/concours/${id}`;

    if (!subject || !message || !imageUrl) {
      return NextResponse.json(
        {
          error:
            "Sujet, message et lien public de l'affiche requis",
        },
        { status: 400 }
      );
    }

    const { data: concours, error: concoursError } =
      await supabase
        .from("concours")
        .select("id,nom")
        .eq("id", id)
        .single();

    if (concoursError || !concours) {
      return NextResponse.json(
        { error: "Concours introuvable" },
        { status: 404 }
      );
    }

    const { data: participants, error: participantsError } =
      await supabase
        .from("participants_concours")
        .select("joueur_id")
        .eq("concours_id", id);

    if (participantsError) {
      throw participantsError;
    }

    const userIds = Array.from(
      new Set(
        (participants || [])
          .map((participant: any) => participant.joueur_id)
          .filter(Boolean)
      )
    );

    const html = buildEmailHtml({
      concoursName: concours.nom || "Concours EJ Prono",
      message,
      imageUrl,
      ctaUrl,
    });

    let sent = 0;
    let skippedWithoutEmail = 0;
    const failures: string[] = [];

    for (const userId of userIds) {
      const {
        data: { user },
      } = await supabase.auth.admin.getUserById(userId);

      const email = user?.email;

      if (!email) {
        skippedWithoutEmail++;
        continue;
      }

      const response = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email,
            subject,
            html,
          }),
        }
      );

      if (response.ok) {
        sent++;
      } else {
        const errorText = await response.text();
        failures.push(`${email}: ${errorText}`);
      }
    }

    return NextResponse.json({
      success: true,
      participantsChecked: userIds.length,
      sent,
      skippedWithoutEmail,
      failed: failures.length,
      failures: failures.slice(0, 5),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    console.error(error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
