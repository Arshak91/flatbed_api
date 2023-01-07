const nomjs = require('../classes/nominatim');
const request  = require('request-promise');
const axios = require('axios');
const env = process.env.SERVER == 'local' ? require('../config/env.local') : require('../config/env');
// const Helpers = require('../classes/helpers');

async function GetDistDur(points){
  try {
    let mapUrl = env.mapHost + env.mapPort +  env.mapUri;
    let newStr = points; // await Helpers.joinLatLon(points);
    let arrLatLon = [], status = 1;
    if (newStr.slice(-1) == ';') {
       newStr = newStr.slice(0, -1);
    }
    let pointsArray = newStr.split(';');
    let newPoints = "";
    pointsArray.forEach(point => {
        let latlon = point.split(',');
        let lat = parseFloat(latlon[0]).toFixed(7);
        let lon = parseFloat(latlon[1]).toFixed(7);
        arrLatLon.push({
          lat,
          lon
        });
        newPoints += lon + ',' + lat + ';';
        
    });
    // console.log('new!!!', newPoints);
    newPoints = newPoints.slice(0, -1);
    // console.log( mapUrl + newPoints + '?overview=false');
    let result, matrix = '?annotations=distance,duration&generate_hints=false&exclude=ferry', map = '?overview=false&exclude=ferry';
    result = await request(mapUrl + newPoints + map, { json: true }, (err, res, body) => {
      if (err) { return err; }
      
    });
    let data;
    
    if (!result) {
      status = 0;
      return {
        distDur: [],
        arrLatLon,
        status,
        code: "Error",
        msg: "map Error"
      };
    } else {
      // let distance = 0;
      // let duration = 0;
      // let legs =[];
      // for (let i = 0, len = result.distances.length - 1; i < len; i++) {
      //   distance += result.distances[i][i + 1];
      //   duration += result.durations[i][i + 1];
      //   legs[i] = { distance: result.distances[i][i + 1], duration:result.durations[i][i + 1]};
      // }
      // data = {
      //   distance: distance,
      //   duration: duration,
      //   legs: legs,
      // };
      data = {
        distance: result.routes[0].distance,
        duration: result.routes[0].duration,
        legs: result.routes[0].legs,
      };
      return {
        distDur: data,
        arrLatLon,
        status,
        code: result.code,
        msg: result.message
      };
    }
  } catch (error) {
    return {
      error,
      status: 0,
      distDur: [],
      code: "Error",
      msg: "map Error"
    };
  }
  
}
async function GeoCode(query){
    const result =  await nomjs.NominatimJS.search({ q: query }, function(err, data){
      if(err){return err;}        
    });
    return result;
     
}
async function GeoLoc(query){
  const loc = await axios.get(encodeURI(`https://maps.googleapis.com/maps/api/geocode/json?key=${env.mapKey}&address=${query}`)).catch(err => {
    console.log('error', err);
  });
  return loc;
}
async function OSRMGeoLoc(query) {
  let mapUrl = env.mapHost + env.mapPort;
  const loc = await axios.get(`${mapUrl}/nearest/v1/driving/${query}?number=1`).catch(err => {
    console.log('error', err);
  });
  return loc;
}

async function GeoLocByZip(zip){
  const loc = axios.get(`https://maps.googleapis.com/maps/api/geocode/json?key=${env.mapKey}&address=${zip}`);
  return loc;
}

exports.GetDistDur = GetDistDur;
exports.GeoCode = GeoCode;
exports.GeoLoc = GeoLoc;
exports.OSRMGeoLoc = OSRMGeoLoc;
