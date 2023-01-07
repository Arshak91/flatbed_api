const mongoose = require('mongoose');
const mongoDB = require('../config/mongo_common.config');
const Schema = mongoose.Schema;

const clientsSchema = new Schema({
    city_ascii: {
        type: String,
        required: false
    },
    city: {
        type: String,
        required: false
    },
    population: {
        type: Number,
        required: false
    },
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    iso2: {
        type: String,
        required: false
    },
    shortState: {
        type: String,
        default: null,
        required: false
    },
    iso3: {
        type: String,
        required: false
    },
    admin_name: {
        type: String,
        required: false
    },
    capital: {
        type: String,
        required: false
    }
},
{
    collection: 'WorldCities'
}
);

module.exports = Cities = mongoDB.model("WorldCities", clientsSchema);
