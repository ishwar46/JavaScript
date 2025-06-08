const nepaliToEnglishNumbers = (str) => {
  const map = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9",
  };
  return str.replace(/[०-९]/g, (digit) => map[digit]);
};

const getAgeFromBsDate = (nepaliDateStr) => {
  // Convert to English numbers
  const engDateStr = nepaliToEnglishNumbers(nepaliDateStr); // "2082-1-2"
  const [bsYear, bsMonth, bsDay] = engDateStr.split("-").map(Number);

  // Approximate conversion: BS to AD = -56 years and -8 months
  let adYear = bsYear - 56;
  let adMonth = bsMonth - 8;
  let adDay = bsDay;

  if (adMonth <= 0) {
    adMonth += 12;
    adYear -= 1;
  }

  const birthDate = new Date(adYear, adMonth - 1, adDay); // JS months are 0-indexed
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  // Adjust if birthday hasn't occurred yet this year
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age--;

  return age;
};

module.exports = {
  getAgeFromBsDate,
};
