const axios = require("axios");

const BASE_URL =
  process.env.DOIT_SMS_BASE_URL || "https://sms.doit.gov.np/api/sms";
const TOKEN = process.env.DOIT_SMS_TOKEN;

const sendSMS = async ({ mobile, message }) => {
  if (!TOKEN) {
    throw new Error("DOIT_SMS_TOKEN is not set in environment variables.");
  }

  try {
    const response = await axios.post(
      BASE_URL,
      { mobile, message },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15_000,
      }
    );
    console.log("SMS sent via DoIT:", response.data);
    return response.data;
  } catch (error) {
    const details =
      error.response?.data || error.response?.statusText || error.message;

    console.error("Error sending SMS via DoIT:", details);
    throw error;
  }
};

module.exports = { sendSMS };
