const bulkEmailTemplate = (title, body) => {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              padding: 20px;
              margin: 0;
            }
            .container {
              background-color: #ffffff;
              max-width: 600px;
              margin: 0 auto;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            h2 {
              color: #333333;
            }
            p {
              color: #555555;
              line-height: 1.6;
            }
            .footer {
              margin-top: 30px;
              font-size: 12px;
              color: #999999;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${title}</h2>
            <p>${body}</p>
            <div class="footer">
              &copy; ${new Date().getFullYear()} Seep Mela. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `;
};

module.exports = { bulkEmailTemplate };
