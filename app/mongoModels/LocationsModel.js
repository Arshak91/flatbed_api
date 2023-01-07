const mongoose = require('mongoose');
const mongoDB = require('../config/mongo_common.config');
const Schema = mongoose.Schema;

const locationSchema = new Schema({
    name: {
        type: String
    },
},
    {
        collection: 'Locations'
    }
);

module.exports = Locations = mongoDB.model("Locations", locationSchema);
