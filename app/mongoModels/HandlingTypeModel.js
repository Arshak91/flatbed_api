
const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const HandlingType = new Schema({
    id: String,
    Type: String
},
{
    collection: 'HandlingTypes'
}
);

module.exports = conn.model("HandlingTypes", HandlingType);