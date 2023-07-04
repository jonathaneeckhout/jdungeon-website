const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

const oneDay = 24 * 60 * 60 * 1000; // One day in milliseconds
const oneHour = 60 * 60 * 1000; // One hour in milliseconds
const verificationInformationMaxStorageDuration = oneDay;

const DB_HOST = process.env.POSTGRES_HOST;
const DB_PORT = parseInt(process.env.POSTGRES_PORT, 10);
const DB_USER = process.env.POSTGRES_USER;
const DB_PASSWORD = process.env.POSTGRES_PASSWORD;
const DB_DB = process.env.POSTGRES_DB;

const MAIL_HOST = process.env.MAIL_HOST;
const MAIL_PORT = parseInt(process.env.MAIL_PORT, 10);
const MAIL_USER = process.env.MAIL_USER;
const MAIL_KEY = process.env.MAIL_KEY;

const CERT_PATH = process.env.CERT_PATH;
const KEY_PATH = process.env.KEY_PATH;

const pool = new Pool({
    user: DB_USER,
    host: DB_HOST,
    database: DB_DB,
    password: DB_PASSWORD,
    port: DB_PORT,
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
  );
`;

pool.query(createTableQuery, (err, result) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('Table created successfully');
    }
});

const httpsOptions = {
    key: fs.readFileSync(CERT_PATH),
    cert: fs.readFileSync(KEY_PATH)
};

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the index.html file
app.use(express.static('public'));

// Handle POST request to register a new user
app.post('/register', (req, res) => {
    // Retrieve the submitted email address
    const { username, email, password } = req.body;

    if (!username || username == "" || !email || email == "" || !password || password == "") {
        console.log("Invalid user input");
        res.status(500).send('Invalid input');
        return;
    }

    pool.query('SELECT * FROM players WHERE username = $1 OR email = $2', [username, email], (err, result) => {
        if (err) {
            console.error('Error executing query', err);
            res.status(500).send('Failed to create account');
        } else {
            // This means the username or password already exists
            if (result.rowCount > 0) {
                res.status(500).send('Username or E-mail address is already in use');
            } else {
                // Hash the password
                const hashedPassword = hashPassword(password);

                // Generate a verification code (you can use a library or your own logic)
                const verificationCode = generateVerificationCode();

                // Save the verification information for later
                saveVerificationInformation(username, email, hashedPassword, verificationCode);
                // Create a verification link
                const verificationLink = `https://jdungeon.org/verify?email=${encodeURIComponent(email)}&code=${verificationCode}`;

                // Send the verification email
                const subject = 'JDungeon Account Verification';
                const message = `Welcome to JDungeon! Please click the following link to verify your email address: ${verificationLink}`;


                const transporter = nodemailer.createTransport({
                    host: MAIL_HOST,
                    port: MAIL_PORT,
                    secure: true,
                    auth: {
                        user: MAIL_USER,
                        pass: MAIL_KEY,
                    },
                });

                const mailOptions = {
                    from: MAIL_USER,
                    to: email,
                    subject: subject,
                    text: message,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending verification email:', error);
                        res.status(500).send('Failed to create account');
                    } else {
                        console.log('Verification email sent successfully:', info.response);
                        res.send('Verification email sent successfully.');
                    }
                });
            }
        }
    });
});

// Handle GET request to verify the user
app.get('/verify', (req, res) => {
    // Retrieve the email and verification code from the query parameters
    const email = req.query.email;
    const verificationCode = req.query.code;

    // Retrieve the saved verification code from the database or in-memory store
    const data = getVerificationCode(email);
    if (!data) {
        console.error("Could not fetch cached verification data");
        res.status(500).send('Error registering user, please try again.');
        return;
    }

    if (verificationCode === data.verificationCode) {
        // Verification successful
        // Update the user's status as verified in the database or perform any necessary actions
        pool.query('INSERT INTO players (username, email, password) VALUES ($1, $2, $3)', [data.username, data.email, data.password], (err, result) => {
            if (err) {
                console.error('Error executing query', err);
                res.status(500).send('Error registering user, please try again.');
            } else {
                console.log('New user inserted successfully');
                res.send('Email verified successfully. Your account has been created, you\'re ready to start your adventure!');
            }
        });
    } else {
        // Verification failed
        res.send('Invalid verification link.');
    }
});

// Function to generate a random verification code
function generateVerificationCode() {
    // Generate a random 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
}

var verificationInformationCache = {}

function saveVerificationInformation(username, email, hashedPassword, verificationCode) {
    if (email in verificationInformationCache) {
        delete verificationInformationCache.email;
    }

    verificationInformationCache[email] = { username: username, email: email, password: hashedPassword, verificationCode: verificationCode, date: new Date() };
}

function getVerificationCode(email) {
    if (email in verificationInformationCache) {
        return verificationInformationCache[email];
    } else {
        return null;
    }
}

// Cleanup depricated verification requests after 1 day
const verificationDepricatedCheckInterval = setInterval(() => {
    var currentDate = new Date();
    for (const key in verificationInformationCache) {
        if (verificationInformationCache.hasOwnProperty(key)) {
            const value = verificationInformationCache[key];
            const timeDifference = currentDate - value.date;

            if (timeDifference > verificationInformationMaxStorageDuration) {
                delete verificationInformationCache[key];
            }
        }
    }
}, oneHour);

function hashPassword(password) {
    const hash = crypto.createHash('sha256');
    hash.update(password);
    const hashedPassword = hash.digest('hex');
    return hashedPassword;
}

const httpsServer = https.createServer(httpsOptions, app).listen(443, () => {
    console.log('HTTPS server running on port 443');
});
