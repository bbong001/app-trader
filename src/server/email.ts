import nodemailer from 'nodemailer';

export function createMailer() {
  const user = "buihoanglong1901@gmail.com";
  const pass = "clbg vxix jhrr tpww";

  if (!user || !pass) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD are required');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export async function sendVerificationCodeEmail(params: {
  to: string;
  code: string;
}) {
  const transporter = createMailer();
  const from = "buihoanglong1901@gmail.com";

  await transporter.sendMail({
    from,
    to: params.to,
    subject: 'Your verification code',
    text: `Your verification code is: ${params.code}. It expires in 10 minutes.`,
    html: `<p>Your verification code is:</p><h2 style="letter-spacing:2px">${params.code}</h2><p>This code expires in 10 minutes.</p>`,
  });
}

