const ObjectId = require('mongodb').ObjectID;
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const dateFormat = require('dateformat');
let collection;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

MongoClient.connect("mongodb://127.0.0.1:27017/clway", function(err, db) {
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
    let responseData = {};
    let records = [];
    collection.find({
        "ts": {
            //$gte: "2017-09-18 00:00:00.000",
            //$lte: "2017-09-18 23:59:59.000"
            $gte: req.query.date + " 00:00:00.000",
            $lte: req.query.date + " 23:59:59.000"
        },
        "device_code": 888039
    }).toArray(function(err, results) {
        responseData.payload = results;
        res.contentType('application/json');
        res.send(JSON.stringify(responseData));
    });
});

app.get('/heatmap', function(req, res, next) {
    let records = [];
    let fullDate;
    let resultado = [];

    for(let semanaIndex = 1; semanaIndex <= 52; semanaIndex++){
        for(let diaIndex = 1; diaIndex <= 7; diaIndex++){;
            resultado.push({
                day: diaIndex,
                week: semanaIndex,
                value: 0,
                dateDay: '',
                fullDate: ''
            });
        }
    }

    if(req.query.date){
        fullDate = req.query.date ? req.query.date : '';
    }

    collection.find({
        "device_code": 888039,
        "sensor_code": 2
    }).toArray(function(err, results) {
        let oldDate = '';
        let mediaTemperatura = [];
        let valorTemperatura = 0;
        let count = 0;
        results.map((valor, index) => {
            let newDate = dateFormat(new Date(valor.ts), "yyyy-mm-dd");            
            
            if(oldDate === ''){
                oldDate = newDate;
            }

            if(oldDate !== newDate){
                let semana = dateFormat(new Date(valor.ts), "W");
                let diaDaSemana = dateFormat(new Date(valor.ts), "N");
                let diaDoMes = dateFormat(new Date(valor.ts), "dd");
                let dataCompleta = dateFormat(new Date(valor.ts), "yyyy-mm-dd HH:MM:ss");

                resultado[(parseInt(semana-1)*7) + parseInt(diaDaSemana -1)] = {
                    day: diaDaSemana,
                    week: semana,
                    value: valorTemperatura/count,
                    dateDay: diaDoMes,
                    fullDate: dataCompleta
                };

                mediaTemperatura.push({
                    day: diaDaSemana,
                    week: semana,
                    value: valorTemperatura/count,
                    dateDay: diaDoMes,
                    fullDate: dataCompleta
                });
                oldDate = newDate;
                count = 1;
                valorTemperatura = valor.payload;
            } else {
                count++;
                valorTemperatura = valorTemperatura + valor.payload;
            }
        });
        
        res.contentType('application/json');
        res.send(JSON.stringify(resultado));
    });
});

app.post('/dateWeatherData', function(req, res, next) {
    let responseData = {};
    let records = [];
    collection.find({
        "ts": {
            $gte: req.body.date + " 00:00:00.000",
            $lte: req.body.date + " 23:59:59.000"
        },
        "sensor_code": parseInt(req.body.sensor_code),
        "device_code": 888039
    }).toArray(function(err, results) {
        responseData.payload = results;
        res.contentType('application/json');
        res.send(JSON.stringify(responseData));
    });
});

app.listen(9000);
