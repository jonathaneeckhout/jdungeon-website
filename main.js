const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

const CERT_PATH = process.env.CERT_PATH;
const KEY_PATH = process.env.KEY_PATH;

const DEBUG = process.env.DEBUG

const httpsOptions = {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH)
};

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the index.html file
app.use(express.static('public'));

// Handle GET request get the version of JDungeon
app.get('/version', (req, res) => {
    const versionPath = 'public/images/.version.json';

    fs.readFile(versionPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading JSON file:', err);
            res.json({ error: true, reason: "api error" });
            return;
        }

        try {
            const jsonData = JSON.parse(data);
            res.json({ error: false, version: jsonData.version });
        } catch (parseError) {
            console.error('Error parsing JSON data:', parseError);
            res.json({ error: true, reason: "api error" });
        }
    });
});

var port = 443;

if (DEBUG) {
    port = 8443;
}
const httpsServer = https.createServer(httpsOptions, app).listen(port, () => {
    console.log('HTTPS server running on port ' + port);
});
