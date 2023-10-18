const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

const CERT_PATH = process.env.CERT_PATH;
const KEY_PATH = process.env.KEY_PATH;

const DEBUG = process.env.DEBUG
const DEBUG_PORT = parseInt(process.env.DEBUG_PORT, 10);

const httpsOptions = {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH)
};

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the index.html file
app.use(express.static('public'));


var port = 443;

if (DEBUG) {
    port = 8443;
}
const httpsServer = https.createServer(httpsOptions, app).listen(port, () => {
    console.log('HTTPS server running on port ' + port);
});
