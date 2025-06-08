const nodeMail = require("nodemailer");

exports.sendEmail = async (options) => {
  const transporter = nodeMail.createTransport({
    host: process.env.SMTP_HOST || 587,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    service: process.env.SMTP_SERVICE,
  });
  const mailOptions = {
    from: process.env.SMTP_EMAIL,
    subject: options.subject,
    html: options.html,
    to: options.to,
  };
  await transporter.sendMail(mailOptions);
};
