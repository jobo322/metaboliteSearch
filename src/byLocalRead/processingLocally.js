const Pool = require('worker-threads-pool');
const path = require('path');
const fs = require('fs');
const request = require('request-promise');
const {workerData} = require('worker_threads');

const pathInfo = path.resolve(path.join('info', 'infoLocal2'));
var info = require(pathInfo);

const {
    pathToData='',
    existList = []
} = info;
const maxThreads = 4;
const maxWaiting = 4000;
var worker = path.resolve(path.join('src', 'byLocalRead','workerFitByLocalRead.js'));
var pool = new Pool({max: maxThreads, maxWaiting: maxWaiting});
var sqrtPI = Math.sqrt(Math.PI);
var listSamples = fs.readdirSync(pathToData);
console.log(listSamples.length, existList.length)

if (existList.length > 0) {
    let dontMatch = [];
    listSamples = listSamples.filter((sample,i,arr) => {
        let entry = sample.toLowerCase().replace(/\.[a-z]*/g, '').replace(/-/g,'_');
        let index = existList.indexOf(entry);
        if (index === -1) {
            // dontMatch.push(sample);
            return false
        }
        return true;
    });
}
console.log(listSamples.length);

var samples = listSamples.slice(0,600);   
var batchSize = Math.floor(samples.length / maxThreads);
console.log(batchSize);

var list = new Array(maxThreads).fill(0), diff = samples.length - batchSize * maxThreads;
list.forEach((e,i,arr) => arr[i] = samples.splice(0, batchSize));
for (let i = 0; i < diff; i++) {
    list[i] = list[i].concat(samples.splice(0, 1));
}
console.log(pathInfo)
for (let i = 0; i < maxThreads; i++) {
    pool.acquire(worker, {
        workerData: {
            index: i,
            sqrtPI,
            pathToData,
            pathInfo,
            samples: list[i]
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
