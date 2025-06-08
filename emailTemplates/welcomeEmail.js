const welcomeEmail = (email, fullName) => {
  return `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; border: none; background-color: #ffffff;">
  <!-- Minimal Header with Red Accent -->
  <div style="padding: 40px 50px 20px 50px;">
    <div style="border-left: 4px solid #e74c3c; padding-left: 15px;">
      <h1 style="color: #333333; margin: 0; font-weight: 300; font-size: 28px; letter-spacing: 0.5px;">SEEP MELA 2082</h1>
    </div>
  </div>
  
  <!-- Content - Clean and Minimal -->
  <div style="padding: 0 50px 30px 50px;">
    <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 25px;">Hello <strong>${fullName}</strong>,</p>

    <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 25px;">
      Thank you for registering with <a href="https://kmc.seepmela.com/" target="_blank" style="color: #e74c3c; text-decoration: none;">KMC SEEP MELA 2082</a>. We're thrilled to have you join this celebration of creativity, innovation, and community spirit.
    </p>

    <div style="margin: 30px 0; padding: 20px 0; border-top: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0;">
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0;"><strong>Note:</strong> Your registration is currently pending selection. Once selected, you'll unlock full access to all features, updates, and special event content.</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 25px;">
      <strong style="color: #e74c3c;">Important:</strong> You will receive a new email and SMS notification once your registration has been selected. Please ensure your contact information is up to date.
    </p>
    
    <p style="font-size: 15px; line-height: 1.6; color: #666666;">Contact: <a href="mailto:tiu.kmc@gmail.com" style="color: #e74c3c; text-decoration: none;">tiu.kmc@gmail.com</a></p>

    <p style="font-size: 14px; color: #999999; margin-top: 30px;">If you did not initiate this request, please ignore this message.</p>
  </div>
  
  <!-- Minimal Footer -->
  <div style="padding: 20px 50px; text-align: center;">
    <p style="font-size: 12px; color: #999999; margin: 0;">© ${new Date().getFullYear()} KMC SEEP MELA 2082</p>
  </div>
</div>
`;
};

module.exports = {
  welcomeEmail,
};
