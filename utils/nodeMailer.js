const nodemailer = require("nodemailer");

const transporterInfo = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "tiu.kmc@gmail.com",
    pass: "dlst hwgl gmie gbpt",
  },
};

exports.sendEmail = async (mailInfo) => {
  try {
    let transporter = nodemailer.createTransport(transporterInfo);
    let info = await transporter.sendMail(mailInfo);
  } catch (error) { }
};
exports.sendEmailInBulk = async (mailInfo) => {
  try {
    const transporter = nodemailer.createTransport(transporterInfo);
    const info = await transporter.sendMail(mailInfo);

    return info;
  } catch (error) {
    console.error("Error sending email to:", mailInfo.to, "|", error.message);
    throw error;
  }
};
