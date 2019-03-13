const fs = require('fs');
const request = require('request-promise');
const path = require('path');
const pathInfo = 'info/info.json';
var info = JSON.parse(fs.readFileSync(pathInfo, 'utf8'));

var pathOfJcamp = '/home/abolanos/hmdbProject/jcampTest';
var listOfJcamp = createListFromPath(pathOfJcamp);

const {
    username='',
    password='',
    couchdb='',
    database=''
} = info;

const baseURL='http://'+username+':'+password+'@'+ couchdb + '/';
const limit=50000000;

var data = fs.readFileSync('/home/abolanos/hmdbProject/jcampTest/HMDB0000001_nmroned_1022_27889.jdx', 'utf8');

request({
    url: baseURL + database + '/_design/customApp/_view/entryByOwnersAndKind?reduce=false&key=["admin@cheminfo.org","sample"]&limit='+limit,
    method: 'GET',
    json: true
}).then(async function(samples) {
    var nano = require('nano')(baseURL);
    var db = nano.use(database);
    var samples = samples.rows;
    for (let sample of samples) {
        var result = await request({
            url: baseURL+ database + '/' + sample.id,
            method: 'GET',
            json: true
        });
        if (!result._attachments) continue;
        let listAttachment = Object.keys(result._attachments);
        let second = false;
        for (let e of listAttachment) {
            let name = e.replace(/\w+\//g, '').replace(/\.\w+/g, '').split('_');
            if (listOfJcamp[name[0]]) {
                if (listOfJcamp[name[0]][name[1]]) {
                    let entry = listOfJcamp[name[0]][name[1]];
                    let id = result._id;
                    let rev = result._rev;
                    let jcamp = fs.readFileSync(path.join(pathOfJcamp, entry.fileName), 'utf8');
                    console.log(id.toString(), e.toString(), 'chemical/x-jcamp-dx', {rev: rev.toString()})
                    if (second) {
                        var result = await request({
                            url: baseURL+ database + '/' + sample.id,
                            method: 'GET',
                            json: true
                        });
                        rev = result._rev
                    } else {
                        second = true;
                    }
                    
                    await db.attachment.insert(id.toString(), e.toString(), jcamp, 'chemical/x-jcamp-dx', {rev: rev.toString()})
                }
            }
        }
    }
});

function createListFromPath(path, options = {}) {
    var {
        pAccession = 0,
        pDimension = [1],
        pId = 2
    } = options;
    var list = fs.readdirSync(path);
    var result = {};
    list.forEach((e) => {
        let temp = e.split('_');
        let accession = temp[pAccession];
        let dimension = pDimension.map((e) => temp[e]).join('');
        if (dimension === 'nmrtwod') return;
        let id = String(temp[pId]).replace(/\.xml/, '');
        if (!result[accession]) result[accession] = {};
        let entry = result[accession];
        entry[id] = {
            dimension: dimension === 'nmroned' ? 1 : 2,
            fileName: e
        }
    })
    return result;
}