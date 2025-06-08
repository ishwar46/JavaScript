const OTPGenerationEmail = (email, otp) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
      <h2 style="color: #333;">Welcome to SEEP MELA 2082!</h2>
      <p>Hi <strong>${email}</strong>,</p>

      <p>Thank you for registering with us. We’re excited to have you on board.</p>

      <p>To verify your email or phonenumber and complete your signup, please use the OTP below:</p>
      <div style="font-size: 24px; font-weight: bold; background-color: #f5f5f5; padding: 10px 20px; display: inline-block; border-radius: 6px;">
        ${otp}
      </div>

      <p style="margin-top: 20px;">This OTP is valid for <strong>5 minutes</strong>. Please do not share it with anyone.</p>
      <p>Once verified, you'll have full access to all our features and updates!</p>

      <p>If you didn’t request this email, you can safely ignore it.</p>

      <hr style="margin: 30px 0;">
      <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} KMC SEEP MELA 2082. All rights reserved.</p>
    </div>
  `;
};

module.exports = {
  OTPGenerationEmail,
};
