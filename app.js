const ObjectId = require('mongodb').ObjectID;
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const dateFormat = require('dateformat');
let collection;

function getWeatherValue(code, result) {
    switch (code) {
        case 0:
            return result.temperature;
        case 1:
            return result.humidity;
        case 2:
            return result.windSpeed;
        case 3:
            return result.windDirection;
        case 4:
            return result.precipitation;
        case 5:
            return result.barometricPressure;
        case 9:
            return result.deaths;
        default:
            return result.solarIrradiation;
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
    if (req.query.dateRange['begin']) {
        collection.find({
            "timestamp": {
                $gte: dateFormat(new Date(req.query.dateRange['begin']), "yyyy-mm-ddT00:00:00Z"),
                $lte: dateFormat(new Date(req.query.dateRange['end']), "yyyy-mm-ddT23:59:59Z")
            },
            "collectorId": parseInt(req.query.device)
        }).sort({ "timestamp": 1 }).toArray(function(err, results) {
            responseData.payload = results;
            res.contentType('application/json');
            res.send(JSON.stringify(responseData));
        });
    } else {
        collection.find({
            "timestamp": {
                $gte: req.query.date + "T00:00:00Z",
                $lte: req.query.date + "T23:59:59Z"
            },
            "collectorId": parseInt(req.query.device)
        }).sort({ "timestamp": 1 }).toArray(function(err, results) {
            responseData.payload = results;
            res.contentType('application/json');
            res.send(JSON.stringify(responseData));
        });
    }
});

function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    // Return array of year and week number
    return weekNo;
}

app.get('/heatmap', function(req, res, next) {
    let resultado = [];
    const tipo = req.query.tipo;

    for (let semanaIndex = 1; semanaIndex <= 52; semanaIndex++) {
        for (let diaIndex = 1; diaIndex <= 7; diaIndex++) {
            resultado.push({
                day: diaIndex,
                week: semanaIndex,
                value: null,
                dateDay: '',
                fullDate: dateFormat(new Date(Date.UTC(2018, 0, diaIndex + (semanaIndex - 1) * 7)), "yyyy-mm-dd")
            });
        }
    }

    if (req.query.date) {
        fullDate = req.query.date ? req.query.date : '';
    }

    collection.find({
        "collectorId": parseInt(req.query.device),
    }).toArray(function(err, results) {
        let oldDate = '';
        let oldValue = '';
        let valorTemperatura = 0;
        let count = 0;

        results.sort(function(a, b) {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        results.map((valor, index) => {
            let newDate = dateFormat(new Date(valor.timestamp), "yyyy-mm-dd");

            if (oldDate === '') {
                oldDate = newDate;
                oldValue = valor;
            }

            if (oldDate !== newDate) {
                let semana = getWeekNumber(new Date(oldValue.timestamp));
                let diaDaSemana = dateFormat(new Date(oldValue.timestamp), "N");
                let diaDoMes = dateFormat(new Date(oldValue.timestamp), "dd");
                let dataCompleta = dateFormat(new Date(oldValue.timestamp), "yyyy-mm-dd HH:MM:ss");

                resultado[(parseInt(semana - 1) * 7) + parseInt(diaDaSemana - 1)] = {
                    day: diaDaSemana,
                    week: semana,
                    value: tipo == 'media' ? valorTemperatura / count : valorTemperatura,
                    dateDay: diaDoMes,
                    fullDate: dataCompleta,
                    cycle: oldValue.cycle != null ? oldValue.cycle : ''
                };

                oldDate = newDate;
                oldValue = valor;
                count = 1;
                valorTemperatura = (Math.round((getWeatherValue(parseInt(req.query.sensorCode), oldValue) * 100) / 100));
            } else {
                let valor_resultado = getWeatherValue(parseInt(req.query.sensorCode), valor);
                if (tipo == 'media') {
                    count++;
                    valorTemperatura = valorTemperatura + valor_resultado;
                } else if (tipo == 'minima') {
                    valorTemperatura = valorTemperatura >= valor_resultado ? valorTemperatura : valor_resultado;
                } else if (tipo == 'maxima') {
                    valorTemperatura = valorTemperatura <= valor_resultado ? valorTemperatura : valor_resultado;
                }

            }

            if (index == results.length - 1) {
                let semana = dateFormat(new Date(oldValue.timestamp), "W");
                let diaDaSemana = dateFormat(new Date(oldValue.timestamp), "N");
                let diaDoMes = dateFormat(new Date(oldValue.timestamp), "dd");
                let dataCompleta = dateFormat(new Date(oldValue.timestamp), "yyyy-mm-dd HH:MM:ss");

                resultado[(parseInt(semana - 1) * 7) + parseInt(diaDaSemana - 1)] = {
                    day: diaDaSemana,
                    week: semana,
                    value: tipo == 'media' ? valorTemperatura / count : valorTemperatura,
                    dateDay: diaDoMes,
                    fullDate: dataCompleta,
                    cycle: oldValue.cycle != null ? oldValue.cycle : ''
                };

                oldDate = newDate;
                oldValue = valor;
                count = 1;
                valorTemperatura = (Math.round((getWeatherValue(parseInt(req.query.sensorCode), oldValue) * 100) / 100));
            }
        });

        res.contentType('application/json');
        res.send(JSON.stringify(resultado));
    });
});

app.post('/dateWeatherData', function(req, res, next) {
    let responseData = {};
    // Se for utilizado seleção de data com heatmap, busca utilizando begin e end.
    if (req.body.dateRange['begin']) {
        const begin = req.body.dateRange['begin'].substr(0, 10);
        const end = req.body.dateRange['end'].substr(0, 10);
        collection.find({
            "timestamp": {
                $gte: new Date(begin + 'T00:00:00Z').toISOString(),
                $lte: new Date(end + 'T23:59:59Z').toISOString()
            },
            "collectorId": parseInt(req.body.device)
        }).sort({ "timestamp": 1 }).toArray(function(err, results) {
            results.map((valor, index) => {
                results[index].payload = getWeatherValue(parseInt(req.body.sensor_code), valor);
            });
            responseData.payload = results;
            res.contentType('application/json');
            res.send(JSON.stringify(responseData));
        });
    } else {
        if(!req.body.date){
            console.log('Não Enviou');
        }
        collection.find({
            "timestamp": {
                $gte: new Date(req.body.date + 'T00:00:00Z').toISOString(),
                $lte: new Date(req.body.date + 'T23:59:59Z').toISOString()
            },
            "collectorId": parseInt(req.body.device)
        }).sort({ "timestamp": 1 }).toArray(function(err, results) {
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
        res.contentType('application/json');
        res.send(JSON.stringify(results));
    });
});

app.post('/save-min-max', function(req, res, next) {
    data = req.body.minMax;
    data.map((object, index) => {
        if (object.min && object.max) {
            collectionMinMax.update({ 'minMaxTipo': object.tipo }, { 'minMaxTipo': object.tipo, "min": object.min, "max": object.max, "normal": object.normal }, { upsert: true });
        }
    });
    res.end();
});

function calculaMedia(data, key) {
    var sum = 0;
    for (var i = 0; i < data.length; i++) {
        if (typeof data[i][key] !== 'undefined') {
            sum += data[i][key] ? parseFloat(data[i][key]) : 0;
        }
    }
    return Math.ceil(sum / data.length);
}

app.get('/bullet', function(req, res, next) {
    let device = req.query.device;
    // Pega a data mais atual salva no banco

    collection.find({ "collectorId": parseInt(device) , "temperature": {$ne : 0}}).sort({ "timestamp": -1 }).limit(1).toArray(function(err, data_atual) {
        // Pega os dados dos sensores
        collection.find({
            "timestamp": {
                $gte: dateFormat(new Date(data_atual[0].timestamp), "yyyy-mm-dd'T'00:00:00Z"),
                $lte: dateFormat(new Date(data_atual[0].timestamp), "yyyy-mm-dd'T'23:59:59Z")
            },
            "collectorId": parseInt(device)
        }).toArray(function(err, results) {
            // Pega os ranges de cada sensor
            collectionMinMax.find({}).toArray(function(err, ranges) {
                let resultado = [];
                const media_temperatura = calculaMedia(results, 'temperature');
                const media_pressao = calculaMedia(results, 'barometricPressure');
                const media_umidade = calculaMedia(results, 'humidity');
                const media_velocidade_vento = calculaMedia(results, 'windSpeed');
                const media_mortes_aves = calculaMedia(results, 'deaths');

                resultado.push({
                    title: 'Temperatura',
                    subtitle: 'Graus Célcius',
                    ranges: [35, 100,100],
                    measures: [10, 35], 
                    markers: [media_temperatura]
                }, {
                    title: 'Pressão',
                    subtitle: 'Pressão Atmosférica (bar)',
                    ranges: [1200, 3000, 3000],
                    measures: [1000, 1200],
                    markers: [media_pressao]
                }, {
                    title: 'Umidade',
                    subtitle: '%',
                    ranges: [100, 100, 100],
                    measures: [2, 100],
                    markers: [media_umidade]
                }, {
                    title: 'Vento',
                    subtitle: 'M/s',
                    ranges: [15, 50, 50],
                    measures: [2, 15],
                    markers: [media_velocidade_vento]
                }, {
                    title: 'Morte de Aves',
                    subtitle: 'Número de aves mortas',
                    ranges: [250, 250, 250],
                    measures: [0, 250],
                    markers: [media_mortes_aves]
                });

                res.contentType('application/json');
                res.send(JSON.stringify(resultado));
                res.end();
            });
        });
    });


});

app.listen(9000);