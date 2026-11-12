/** Resend API 로 메일 발송. 키가 없으면 false 를 돌려 호출자가 대체 경로를 쓰게 한다. */
export async function sendMail(settings: Record<string, string>, to: string, subject: string, text: string) {
  if (!settings.resend_key || !settings.mail_from) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + settings.resend_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: settings.mail_from, to: [to], subject, text }),
    });
    if (!r.ok) console.warn('mail rejected', r.status, await r.text().catch(() => ''));
    return r.ok;
  } catch (e) {
    console.warn('mail failed', e);
    return false;
  }
}

/** 여러 통을 한 번에 (Resend batch API, 요청당 100통) */
export async function sendMailBatch(settings: Record<string, string>, mails: { to: string; subject: string; text: string }[]) {
  if (!settings.resend_key || !settings.mail_from || !mails.length) return 0;
  let sent = 0;
  for (let i = 0; i < mails.length; i += 100) {
    const part = mails.slice(i, i + 100);
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + settings.resend_key, 'Content-Type': 'application/json' },
        body: JSON.stringify(part.map((m) => ({ from: settings.mail_from, to: [m.to], subject: m.subject, text: m.text }))),
      });
      if (r.ok) sent += part.length;
      else console.warn('batch mail rejected', r.status, await r.text().catch(() => ''));
    } catch (e) {
      console.warn('batch mail failed', e);
    }
  }
  return sent;
}
