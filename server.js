// Get dependencies
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
// const redis = require('redis');
// const client = redis.createClient({host : '127.0.0.1', port : 6379});

//const fileupload = require('express-fileupload');

//var upload = require('express-fileupload');

// Get our API routes
//const api = require('./server/routes/api');

const app = express();
require('dotenv').config();

// for file upload
var upload = require('express-fileupload');
app.use(upload({
  limits: { fileSize: 5 * 1024 * 1024 },
}));

// Parsers for POST data
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));
//app.use(bodyParser.urlencoded({ extended: false }));

// Set our api routes
const mongoApi = require('./app/router/mongoRouters.js');
mongoApi(app);
const api = require('./app/router/router.js');
api(app);
const apiKey = require('./app/router/routesByKeys');
apiKey(app);

// Point static path to dist
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/resources', express.static(path.join(__dirname, 'resources')));

// // for file upload
// var upload = require('express-fileupload');
// app.use(upload());

// const swaggerUi = require('swagger-ui-express');
// const swaggerDoc = require('./swagger.json');
// this.app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Catch all other routes and return the index file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

/**
 * Get port from environment and store in Express.
 */
const port = process.env.PORT || '8080';
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port, () => {
  console.log(`API running on localhost:${port}`);
});

// http.createServer(function (req, res) {
//   console.log("Request: " + req.method + " to " + req.url);
// }).listen(8080);

// client.on('ready', function() {
//   console.log('connected');
// });





// const db = require('./app/config/db.config.js');

// // force: true will drop the table if it already exists
// db.sequelize.sync({force: true}).then(() => {
//   console.log('Drop and Resync with { force: true }');
//   //initial();
// });

// // force: false will create new table
// db.sequelize.sync().then(() => {
//   console.log('Drop and Resync with { force: false }');
//   //initial();
// });

// // alter: true will modify the table if it already exists
// db.sequelize.sync({ alter: true }).then(() => {
//   console.log('Resync with { alter: true }');
//   //initial();
// }).catch(err => { console.log(err) });
