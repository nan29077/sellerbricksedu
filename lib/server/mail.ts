/** Resend API 로 메일 발송. 키가 없으면 false 를 돌려 호출자가 대체 경로를 쓰게 한다. */
export async function sendMail(settings: Record<string, string>, to: string, subject: string, text: string) {
  if (!settings.resend_key || !settings.mail_from) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + settings.resend_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: settings.mail_from, to: [to], subject, text }),
    });
    return r.ok;
  } catch (e) {
    console.warn('mail failed', e);
    return false;
  }
}
