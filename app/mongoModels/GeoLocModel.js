const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const GeoLoc = new Schema({
    Latitude: Number,
    Longitude: Number,
    CountryLong: String,
    CountryShort: String,
    StateLong: String,
    StateShort: String,
    CityLong: String,
    CityShort: String,
    CityState: String,
    PostalCode: String
},
{
    collection: 'GeoLocs'
}
);

module.exports = conn.model("GeoLoc", GeoLoc);