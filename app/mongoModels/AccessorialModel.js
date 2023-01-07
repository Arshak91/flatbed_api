
const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const Accessorial = new Schema({
    id: String,
    ServiceOption: String,
},
{
    collection: 'Accessorials'
}
);

module.exports = conn.model("Accessorials", Accessorial);