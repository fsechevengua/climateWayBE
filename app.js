var ObjectId = require('mongodb').ObjectID;
var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var bodyParser = require('body-parser');
var collection;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

MongoClient.connect("mongodb://127.0.0.1:9001/clway", function(err, db) {
    if (!!err) {
        console.log('Error on MongoDb connection');
    } else {
        console.log('MongoDb is Connected');
    }
    collection = db.collection('records');
});

app.all('/*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, POST", "PUT");
    next();
});

app.get('/', function(req, res) {
    res.send('Welcome to API');
});

app.get('/weatherData', function(req, res, next) {
    var responseData = {};
    var records = [];
    collection.find({
        "ts": {
            $gte: new Date("2017-05-05T00:00:00.000Z"),
            $lte: new Date("2017-05-05T23:59:59.000Z")
            //$gte: new Date(req.body.date + "T00:00:00.000Z"),
            //$lte: new Date(req.body.date + "T23:59:59.000Z")
        },
        "device_code": 888011
    }).toArray(function(err, results) {
        responseData.payload = results;
        res.contentType('application/json');
        res.send(JSON.stringify(responseData));
    });
});

app.post('/dateWeatherData', function(req, res, next) {
    var responseData = {};
    var records = [];
    collection.find({
        "ts": {
            $gte: new Date("2017-05-05T00:00:00.000Z"),
            $lte: new Date("2017-05-05T23:59:59.000Z")
            //$gte: new Date(req.body.date + "T00:00:00.000Z"),
            //$lte: new Date(req.body.date + "T23:59:59.000Z")
        },
        "sensor_code": parseInt(req.body.sensor_code),
        "device_code": 888011
    }).toArray(function(err, results) {
        responseData.payload = results;
        res.contentType('application/json');
        res.send(JSON.stringify(responseData));
    });
});

app.listen(9000);