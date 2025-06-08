const selectionEmail = (
  date,
  time,
  location,
  sectorOfInterest,
  newPassword
) => {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; border: none; background-color: #ffffff;">
    <!-- Minimal Header with Red Accent -->
    <div style="padding: 40px 50px 20px 50px;">
      <div style="border-left: 4px solid #e74c3c; padding-left: 15px;">
        <h1 style="color: #333333; margin: 0; font-weight: 300; font-size: 28px; letter-spacing: 0.5px;">Congratulations!</h1>
      </div>
    </div>
    
    <!-- Content - Clean and Minimal -->
    <div style="padding: 0 50px 30px 50px;">
      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 25px;">
        You have been <strong>selected</strong> for the <strong>"${sectorOfInterest}"</strong> training program. We're excited to have you join us!
      </p>

      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 15px;">Please be present at the following location, date, and time:</p>

      <div style="margin: 20px 0; padding: 20px; border-left: 2px solid #e74c3c; background-color: #fafafa;">
        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 10px 0;"><strong>Location:</strong> ${location}</p>
        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 10px 0;"><strong>Date:</strong> ${date}</p>
        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0;"><strong>Time:</strong> ${time}</p>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 25px 0 15px 0;">To log into the system, please use the details below:</p>
      
      <div style="margin: 20px 0; padding: 20px; border-left: 2px solid #e74c3c; background-color: #fafafa;">
        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 10px 0;"><strong>Website:</strong> <a href="https://kmc.seepmela.com/login" target="_blank" style="color: #e74c3c; text-decoration: none;">https://kmc.seepmela.com/login</a></p>
        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 10px 0;"><strong>Username:</strong> Your registered phone number</p>
        <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0;"><strong>Password:</strong> ${newPassword}</p>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 25px 0;">We look forward to seeing you there!</p>
    </div>
    
    <!-- Minimal Footer -->
    <div style="padding: 20px 50px; border-top: 1px solid #f0f0f0;">
      <p style="font-size: 13px; color: #999999; margin: 0;">KMC SEEP MELA 2082<br>Thank you for your participation.</p>
    </div>
  </div>
`;
};
const shortListEmail = (date, time, location, sectorOfInterest) => {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 24px; border-radius: 10px; background-color: #f9f9f9;">
    <h2 style="color: #2c3e50;">🎉 Congratulations!</h2>

    <p style="font-size: 15px; color: #333;">
      You have been <strong>shortlisted</strong> for the <strong>"${sectorOfInterest}"</strong> interview !
    </p>

    <p style="font-size: 15px; color: #333;">Please be present at the following location, date, and time:</p>

    <ul style="font-size: 15px; color: #333; line-height: 1.6;">
      <li><strong>Location:</strong> ${location}</li>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time:</strong> ${time}</li>
    </ul>

    <p style="font-size: 15px; color: #333;">We look forward to seeing you there!</p>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

    <p style="font-size: 12px; color: #999;">KMC SEEP MELA 2082<br>Thank you for your participation.</p>
  </div>
`;
};

module.exports = {
  selectionEmail,
  shortListEmail,
};
