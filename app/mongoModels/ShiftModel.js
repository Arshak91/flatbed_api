
const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const Shift = new Schema({
    id: String,
    
    shiftName: String,
    shift: Number,
    break_time: Number,
    drivingtime: Number,
    max_shift: Number,
    rest: Number,
    recharge: Number,
    status: Number,
    createdAt: Date,
    updatedAt: Date,
},
{
    collection: 'Shifts'
}
);

module.exports = conn.model("Shift", Shift);