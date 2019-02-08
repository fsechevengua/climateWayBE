const ObjectId = require('mongodb').ObjectID;
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const dateFormat = require('dateformat');
let collection;

function getWeatherValue(code, result){
    switch(code){
        case 0:
            return result.temperature != null ? result.temperature : 0;
        case 1:
            return result.humidity != null ? result.humidity : 0;
        case 2:
            return result.windSpeed != null ? result.windSpeed : 0;
        case 3:
            return result.windDirection != null ? result.windDirection : 0;
        case 4:
            return result.precipitation != null ? result.precipitation : 0;
        case 5:
            return result.barometricPressure != null ? result.barometricPressure : 0;
        default:
            return  result.solarIrradiation != null ? result.solarIrradiation : 0;
    }
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

MongoClient.connect("mongodb://127.0.0.1:27017/eaware", function(err, db) {
    if (!!err) {
        console.log('Error on MongoDb connection');
    } else {
        console.log('MongoDb is Connected');
    }
    collection = db.collection('records');
    collectionMinMax = db.collection('minmax');
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

app.get('/loadDevices', function(req, res, next) {
    results = collection.distinct('collectorId', function(err, docs) {
        res.contentType('application/json');
        res.send(JSON.stringify(docs.sort()));
        res.end();
    });
});
    

app.get('/weatherData', function(req, res, next) {
    let responseData = {};
    let records = [];
    if(req.query.dateRange['begin']){
        collection.find({
            "timestamp": {
                $gte: dateFormat(new Date(req.query.dateRange['begin']), "yyyy-mm-ddT00:00:00Z"),
                $lte: dateFormat(new Date(req.query.dateRange['end']), "yyyy-mm-ddT23:59:59Z")
            },
            "collectorId": parseInt(req.query.device)
        }).toArray(function(err, results) {
            responseData.payload = results;
            res.contentType('application/json');
            res.send(JSON.stringify(responseData));
        });
    } else {
        collection.find({
            "timestamp": {
                $gte: req.query.date + "T00:00:00.000Z",
                $lte: req.query.date + "T23:59:59.000Z"
            },
            "collectorId": parseInt(req.query.device)
        }).toArray(function(err, results) {
            responseData.payload = results;
            res.contentType('application/json');
            res.send(JSON.stringify(responseData));
        });
    }
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
        "collectorId": parseInt(req.query.device),
        //"sensor_code": parseInt(req.query.sensorCode),
    }).toArray(function(err, results) {
        let oldDate = '';
        let oldValue = '';
        let mediaTemperatura = [];
        let valorTemperatura = 0;
        let count = 0;

        results.sort(function(a,b){
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        results.map((valor, index) => {
            let newDate = dateFormat(new Date(valor.timestamp), "yyyy-mm-dd");

            if(oldDate === ''){
                oldDate = newDate;
                oldValue = valor;
            }

            if(oldDate !== newDate){
                let semana = dateFormat(new Date(oldValue.timestamp), "W");
                let diaDaSemana = dateFormat(new Date(oldValue.timestamp), "N");
                let diaDoMes = dateFormat(new Date(oldValue.timestamp), "dd");
                let dataCompleta = dateFormat(new Date(oldValue.timestamp), "yyyy-mm-dd HH:MM:ss");

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
                oldValue = valor;
                count = 1;
                valorTemperatura = (Math.round(getWeatherValue(parseInt(req.query.sensorCode),oldValue) * 100) / 100) ;
            } else {
                count++;
                valorTemperatura = valorTemperatura + (Math.round(getWeatherValue(parseInt(req.query.sensorCode),oldValue) * 100) / 100) ;
            }

            if(index == results.length - 1){
                let semana = dateFormat(new Date(oldValue.timestamp), "W");
                let diaDaSemana = dateFormat(new Date(oldValue.timestamp), "N");
                let diaDoMes = dateFormat(new Date(oldValue.timestamp), "dd");
                let dataCompleta = dateFormat(new Date(oldValue.timestamp), "yyyy-mm-dd HH:MM:ss");

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
                oldValue = valor;
                count = 1;
                valorTemperatura = (Math.round(getWeatherValue(parseInt(req.query.sensorCode),oldValue) * 100) / 100) ;
            }
        });

        res.contentType('application/json');
        res.send(JSON.stringify(resultado));
    });
});

app.post('/dateWeatherData', function(req, res, next) {
    let responseData = {};
    // Se for utilizado seleção de data com heatmap, busca utilizando begin e end. 
    if(req.body.dateRange['begin']){
        collection.find({
            "timestamp": {
                $gte: dateFormat(new Date(req.body.dateRange['begin']), "yyyy-mm-ddT00:00:00Z"),
                $lte: dateFormat(new Date(req.body.dateRange['end']), "yyyy-mm-ddT23:59:59Z")
            },
            //"sensor_code": parseInt(req.body.sensor_code),
            "collectorId": 1
        }).toArray(function(err, results) {

            results.map((valor, index) => {
                results[index].payload = getWeatherValue(parseInt(req.body.sensor_code), valor);
            });

            responseData.payload = results;
            res.contentType('application/json');
            res.send(JSON.stringify(responseData));
        });
    } else{
        collection.find({
            "timestamp": {
                $gte: req.body.date + "T00:00:00.000Z",
                $lte: req.body.date + "T23:59:59.000Z"
            },
           // "sensor_code": parseInt(req.body.sensor_code),
            "collectorId": 1
        }).toArray(function(err, results) {
            results.map((valor, index) => {
                results[index].payload = getWeatherValue(parseInt(req.body.sensor_code), valor);
            });

            responseData.payload = results;
            res.contentType('application/json');
            res.send(JSON.stringify(responseData));
        });
    }
});

app.get('/min-max', function(req, res, next) {
    collectionMinMax.find({}).toArray(function(err, results) {
        console.log(results);
        res.contentType('application/json');
        res.send(JSON.stringify(results));
    });
});
app.post('/save-min-max', function(req, res, next) {
    data = req.body.minMax;
    data.map((object, index) => {
        if(object.min && object.max){
            collectionMinMax.update( 
                {'minMaxTipo' : object.tipo},
                {'minMaxTipo' : object.tipo, "min": object.min, "max" : object.max },
                { upsert: true } 
            )
        }
    })
    res.end();
});

app.listen(9000);