const request = require('request-promise');
const process = require('../process');
// const hamsters = require('hamsters.js');
// const Worker = require('worker_threads').Worker;
// const Worker = require('webworker-threads').Worker;
// var Worker = require("tiny-worker");

const fs = require('fs');
const pathInfo = 'info/info.json';
var info = JSON.parse(fs.readFileSync(pathInfo, 'utf8'));
const {
    username='',
    password='',
    couchdb='',
    database=''
} = info;
console.log(couchdb)
const baseURL='http://'+username+':'+password+'@'+ couchdb + '/';
const limit=50000000;

// request({
//     url: baseURL+ database + '/' + 'f6a6ab81eac74a08a996efd818b49103',
//     method: 'GET',
//     json: true
// }).then(async function(result) {
//     console.log(result)
    
// })


request({
    url:baseURL + database + '/_design/customApp/_view/entryByOwnersAndKind?reduce=false&key=["juan.sebastian.rocha@correounivalle.edu.co","sample"]&limit='+limit,
    json: true
}).then(async function(result) {
    // fs.writeFileSync('listParra', JSON.stringify(result.rows));
    for (let sample of result.rows) {
        let data = await request({
            url: baseURL+ database + '/' + sample.id,
            method: 'GET',
            json: true
        });
        var id = data._id;
        var entryUrl = 'http://'+username+':'+password+'@'+ couchdb + '/' + database + '/';
        let nmrs = data.$content.spectra.nmr;
        if (nmrs === undefined) {
            console.log(id + ' has not nmr');
            console.log(Object.keys(data.$content.spectra))
            continue
        }
        for (let nmr of nmrs) {
            if (nmr.jcamp.filename.length > 0) {
                var url = entryUrl + id + '/' + nmr.jcamp.filename;
                console.log(sample.id, nmr.jcamp.filename, data.$id)
                var jcamp = await request({
                    url: url,
                    method: 'GET'
                });
                let name = nmr.jcamp.filename.replace('spectra/nmr/','')
                fs.writeFileSync('/home/abolanos/spectrosRocha/'+name, jcamp);
            }
            else {
                console.log('sample id ' + sample.id + ' has not good data');
            }
        } 
    }
});