
const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const Equipment = new Schema({
    id: String,
    
    typeName: String,

    code: String,

    type: String, // 'Tractor', 'Trailer', 'Truck'
    trailerType: String,
    name: String,
    horsePower: Number,
    
    value: Number,
    valueUnit: String,

    groupType: Number,

    externalLength: String,
    externalWidth: String,
    externalHeight: String,

    internalLength: String,
    internalWidth: String,
    internalHeight: String,
    maxweight: Number,
    maxVolume: Number,
    enable: Boolean
    // eqType: String, // { type: Sequelize.ENUM, values: ['Dry','Reefer','Frozen','Cooler','Multi']},  
},
{
    collection: 'Equipments'
}
);

module.exports = conn.model("Equipment", Equipment);