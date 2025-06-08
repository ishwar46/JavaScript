function generateStrongPassword(length) {
  const characters = [
    "ABCDEFGHJKMNPQRSTUVWXYZ",
    "abcdefghjkmnopqrstuvwxyz",
    "123456789",
  ];

  let password = "";

  characters.map((value, i) => {
    password += value.charAt(Math.floor(Math.random() * value.length));
  });

  for (let i = 3; i < length; i++) {
    password += characters
      .join("")
      .charAt(Math.floor(Math.random() * characters.join("").length));
  }

  password = password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");

  return password;
}
module.exports = generateStrongPassword;
