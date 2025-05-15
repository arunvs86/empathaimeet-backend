// testLinks.js
const axios = require('axios');
const https = require('https');

async function run() {
  try {
    const resp = await axios.post(
      'process.env.REACT_APP_API_URL/api/v1/links',
      {
        professionalsFullName: 'Arun',
        proId: 1234,
        clientName: 'UserOne',
        apptDate: 1684082400000
      },
      {
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      }
    );
    console.log('Response data:', resp.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

run();
