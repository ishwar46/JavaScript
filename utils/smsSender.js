const axios = require("axios");

const BASE_URL = "http://api.sparrowsms.com/v2/sms/";
const TOKEN = process.env.SPARROW_SMS_TOKEN;
const FROM_IDENTITY = process.env.SPARROW_SMS_FROM;

const sendSMS = async ({ mobile, message }) => {
  if (!TOKEN) {
    throw new Error("SPARROW_SMS_TOKEN is not set in environment variables.");
  }

  if (!FROM_IDENTITY) {
    throw new Error("SPARROW_SMS_FROM is not set in environment variables.");
  }

  try {
    const response = await axios.post(
      BASE_URL,
      {
        token: TOKEN,
        from: FROM_IDENTITY,
        to: mobile,
        text: message
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15_000,
      }
    );

    console.log("SMS sent via Sparrow:", response.data);
    return response.data;
  } catch (error) {
    const details =
      error.response?.data || error.response?.statusText || error.message;

    console.error("Error sending SMS via Sparrow:", details);
    throw error;
  }
};

module.exports = { sendSMS };