const app          = require('./server').app;
const jwt          = require('jsonwebtoken');
const linkSecret   = "ijr2iq34rfeiadsfkjq3ew";
const { v4: uuidv4 } = require('uuid');

// In-memory appointments
const professionalAppointments = [
  {
    professionalsFullName: "Arun",
    apptDate: Date.now() + 500000,
    uuid: 1,
    clientName: "UserOne",
    waiting: false,
  },
  {
    professionalsFullName: "Arun",
    apptDate: Date.now() - 2000000,
    uuid: 2,
    clientName: "UserTwo",
    waiting: false,
  },
  {
    professionalsFullName: "Arun",
    apptDate: Date.now() + 10000000,
    uuid: 3,
    clientName: "UserThree",
    waiting: false,
  },
];

app.set('professionalAppointments', professionalAppointments);

// Generate client link for a given appointment UUID
app.get('/user-link', (req, res) => {
  const { uuid } = req.query;
  console.log("GET /user-link?uuid=", uuid);
  const apptData = app.get('professionalAppointments')
                      .find(a => String(a.uuid) === String(uuid));
  if (!apptData) {
    console.error("Appointment not found:", uuid);
    return res.status(404).json({ error: 'Appointment not found' });
  }
  const token = jwt.sign(apptData, linkSecret);
  res.json({
    link: `https://localhost:3000/join-video?token=${encodeURIComponent(token)}`,
  });
});

// Validate a token and return its payload (appointment or pro info)
app.post('/validate-link', (req, res) => {
  console.log("POST /validate-link body:", req.body);
  const { token } = req.body;
  if (!token) {
    console.error("No token provided in /validate-link");
    return res.status(400).json({ error: 'No token provided' });
  }
  try {
    const decodedData = jwt.verify(token, linkSecret);
    console.log("Token decoded successfully:", decodedData);
    res.json(decodedData);
  } catch (err) {
    console.error("Error verifying token:", err);
    res.status(401).json({ error: err.message });
  }
});

// Generate professional dashboard link
app.get('/pro-link', (req, res) => {
  const userData = {
    fullName: "Arun",    // must match your appointments’ professionalsFullName
    proId: 1234,
  };
  const token = jwt.sign(userData, linkSecret);
  res.send(
    `<a href="https://localhost:3000/dashboard?token=${token}" target="_blank">Link Here</a>`
  );
});
