const Pool = require('worker-threads-pool');
const path = require('path');
const fs = require('fs');
const request = require('request-promise');


const pathInfo = path.resolve(path.join('data', 'info.json'));
var info = JSON.parse(fs.readFileSync(pathInfo, 'utf8'));
const {
    username='',
    password='',
    couchdb='',
    database=''
} = info;

const baseURL='http://'+username+':'+password+'@'+couchdb + '/';
const limit=50000000;

var worker = path.resolve(path.join('src', 'worker.js'));
var pool = new Pool({max: 8, maxWaiting: 4000});

request({
    url:baseURL + database + '/_design/customApp/_view/entryByOwnersAndKind?reduce=false&key=["airwave","sample"]&limit='+limit,
    json: true
}).then(async function(result) {
    var samples = result.rows;
    for (let i = 722; i < samples.length; i++) {
        sample = samples[i]
        pool.acquire(worker, {
            workerData: {
                sample,
                couchdb,
                database,
                baseURL,
                username,
                password
            }
        }, function (err, worker) {
            if (err) throw err
            worker.on('message', (msg) => console.log(msg));
            console.log(`started worker ${i} (pool size: ${pool.size})`)
            worker.on('exit', function () {
                console.log(`worker ${i} exited (pool size: ${pool.size})`)
            })
            
        });
    }
    console.log('termina loop principal');
})