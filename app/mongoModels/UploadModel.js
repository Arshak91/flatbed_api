const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const Upload = new Schema({
    type: String,
    status: Number,
    OrderCount: Number,
    IncompleteOrderCount: Number,
    createdAt: Date,
    updatedAt: Date
},
{
    collection: 'Upload'
}
);

module.exports = conn.model("Upload", Upload);