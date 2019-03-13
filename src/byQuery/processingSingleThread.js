const request = require('request-promise');
const process = require('../process');
// const hamsters = require('hamsters.js');
// const Worker = require('worker_threads').Worker;
// const Worker = require('webworker-threads').Worker;
// var Worker = require("tiny-worker");

const fs = require('fs');
const pathInfo = '';
var info = JSON.parse(fs.readFileSync(pathInfo, 'utf8'));
const {
    username='',
    password='',
    couchdb='',
    database=''
} = info;

const baseURL='http://'+username+':'+password+'@'+couchdb + '/';
console.log(baseURL);
const limit=50000000;



request({
    url:baseURL + database + '/_design/customApp/_view/entryByOwnersAndKind?reduce=false&key=["airwave","sample"]&limit='+limit,
    json: true
}).then(function(result) {
    var params = {
        threads: 4,
        request: request,
    }
    params.array = result.rows.slice(0,4);
    hamsters.run(params, async function(params) {
        var counter = 0;
        for (var i = 0; i < params.array.length; i++) {
            let sample = params.array[i];
            let url = baseURL+ database + '/' + sample.id
            var data = await params.request({
                url: url,
                method: 'GET',
                json: true
            });
            // if (data.$content) {
            //     var nmr = data.$content.spectra.nmr[0];
            //     var entry = data.$id[0];
            //     console.time(entry)
            //     var id = data._id;
            //     var entryUrl = 'http://'+username+':'+password+'@'+ couchdb + '/' + database + '/';
            //     var urlJcamp = entryUrl + id + '/' + nmr.jcamp.filename;
        
            //     var nmrJcamp = await request({
            //         url: urlJcamp,
            //         method: 'GET'
            //     });
            //     // var processedData = process(nmrJcamp);
            //     // nmr.normaFactor = processedData.normaFactor;
            //     // nmr.fitPeaks = [{
            //     //     functionName: 'pseudoVoigt',
            //     //     peaks: processedData.optPeaks.slice()
            //     // }];
            //     // console.timeEnd(entry)
            //     // await request({
            //     //     url: baseURL+'eln/'+sample.id,
            //     //     method: 'PUT',
            //     //     body: data,
            //     //     json: true
            //     // });
            // }
        }
    }, function(result) {console.log(result)});
});



// async function updateAll(samples) {
//     var counter = 0;
//     console.time('updateAll');
//     // for (var sample of samples) {
//     for (var i = 0; i < 1; i++) {
//         let sample = samples[i];
//         console.log(sample)
//         counter++;
//         try {
//             var data = await request({
//                 url: baseURL+ database + '/' + sample.id,
//                 method: 'GET',
//                 json: true
//             });
//             if (data.$content) {
//                 // console.log(data);
//                 var nmrs = data.$content.spectra.nmr;
//                 var entry = data.$id[0];
//                 console.log(entry)
//                 var id = data._id;
//                 var entryUrl = 'http://'+username+':'+password+'@'+ couchdb + '/' + database + '/';
//                 for (let nmr of nmrs) {
//                     var url = entryUrl + id + '/' + nmr.jcamp.filename;
//                     var nmrJcamp = await request({
//                         url: url,
//                         method: 'GET'
//                     });
//                     var optPeaks = process(nmrJcamp);
//                     nmr.fitPeaks = [{
//                         functionName: 'pseudoVoigt',
//                         peaks: optPeaks.slice()
//                     }]
//                     // console.log('\n\n\n\n\n' + entry)
//                     // console.log(JSON.stringify(optPeaks));
//                 };
//             }
//             // console.log('it has fit', data.$content.spectra.nmr[0].hasOwnProperty('fitPeaks'));
//             // await request({
//             //     url: baseURL+'eln/'+sample.id,
//             //     method: 'PUT',
//             //     body: data,
//             //     json: true
//             // });
//         } catch(error) {
//             console.log(error)
//         }
//     }
//     console.timeEnd('updateAll');
// }
