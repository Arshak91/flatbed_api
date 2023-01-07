

const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;


const Owner = {
    name: String,
    id: String, // Number,
    oType: Number, // Brocker, Carrier
};

const Equipment = {
    id: String, // Number,
    eqType: Number,
    feet: Number,
    weight: Number
};

const Carrier = {
    driversCount: Number,
    name: String,
};

const Stop = {
    lat: String,
    lon: String
};

const Changed = {
    datetime: Date,
    action: String
};

const Planning = new Schema({
    autoPlanDate: Date,

    UUID: String,

    owner: Owner,
    
    orderIDs: [Number],

    equipment: Equipment,
    carrier: Carrier,
    shiftId: Number, // ete 2 hogi 120, ete 1 urisha   // 

    ordersCount: Number,
    orders: String,
    // stops: [Stop], // stopLocations: String, // { type: Sequelize.JSON },
    stops: [[Number]],

    startTime: String, // Date,
    endTime: String, // Date,

    feet: Number,
    weight: Number,
    // cube: Number, // pallet: Number, // emptymile: Number,

    totalDistance: Number,
    totalDuration: Number,

    status: Number, // 

    loadCost: Number,
    loadCostPerMile: Number,

    comment: String,
    
    feelRates: Number,
    permileRates: Number,
    permileRatesTotal: Number,

    planType: String, // { type: Sequelize.ENUM, values: ['Manual', 'Auto'] },

    changed: [Changed],
    
    // warning: Number,
    // warningData: {  },
    
    delete: Number,
    confirmed: { type: Number, default: 0 },

    Load: {},
    stopLocations: [],
    orderIdsArr: [],
    noHos: Number
},
{
    collection: 'Plannings'
}
);

//console.log(conn)
module.exports = conn.model("Planning", Planning);
