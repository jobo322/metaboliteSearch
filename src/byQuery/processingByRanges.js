const Pool = require('worker-threads-pool');
const path = require('path');
const fs = require('fs');
const request = require('request-promise');
const {workerData} = require('worker_threads');

const pathInfo = path.resolve(path.join('data', 'info.json'));
var info = JSON.parse(fs.readFileSync(pathInfo, 'utf8'));
const {
    username='',
    password='',
    couchdb='',
    database=''
} = info;

const maxThreads = 8;
const maxWaiting = 4000;

const baseURL='http://'+username+':'+password+'@'+couchdb + '/';
const limit=50000000;

var worker = path.resolve(path.join('src', 'workerByRange.js'));
var pool = new Pool({max: maxThreads, maxWaiting: maxWaiting});
console.log(pool)
pool.destroy();
var sqrtPI = Math.sqrt(Math.PI);
request({
    url:baseURL + database + '/_design/customApp/_view/entryByOwnersAndKind?reduce=false&key=["airwave","sample"]&limit='+limit,
    json: true
}).then(async function(result) {
    var samples = result.rows.splice(0,600);
    var batchSize = Math.floor(samples.length / maxThreads);
    console.log(batchSize)
    var list = new Array(maxThreads).fill(0), diff = samples.length - batchSize * maxThreads;
    console.log(diff)
    list.forEach((e,i,arr) => arr[i] = samples.splice(0, batchSize))
    for (let i = 0; i < diff; i++) {
        list[i] = list[i].concat(samples.splice(0, 1));
    }
    console.log(JSON.stringify(samples))
    console.log(JSON.stringify(list))
    for (let i = 0; i < maxThreads; i++) {
        pool.acquire(worker, {
            workerData: {
                index: i,
                sqrtPI,
                samples: list[i],
                couchdb,
                database,
                baseURL,
                username,
                password
            }
        }, function (err, worker) {
            if (err) throw err
            worker.on('message', (data) => console.log(data));
            console.log(`started worker ${i} (pool size: ${pool.size})`)
            worker.on('exit', function () {
                console.log(`worker ${i} exited (pool size: ${pool.size})`)
            })
        });
    }

    // console.log(JSON.stringify(result));
})

