const mongoose = require('mongoose');
const mongoDB = require('../config/mongo_common.config');
const Schema = mongoose.Schema;

const MapTestingSchema = new Schema({
    location: {
        type: { type: String, default: 'Point', enum: ['Point'] },
        coordinates: [Number]
    },
    name: String,
    shortStateCode: String,
    country: String
});
MapTestingSchema.index({ location: '2dsphere' })
module.exports = MapTesting = mongoDB.model("MapTesting", MapTestingSchema);
