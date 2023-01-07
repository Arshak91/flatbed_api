const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const CapacityBoardAddress = {
    lat: String,
    lon: String,
    country: String,
    state: String,
    stateLong: String,
    zip: String,
    city: String,
    street: String,
    nsew: String,               // N / S / E / W    
    dateWindow: String,
    timeWindowFrom: Date,
    timeWindowTo: Date,
    cityId: {
        type: Schema.Types.ObjectId,
        ref: 'Cities',
        required: false
    },
    locationType: {
        type: Schema.Types.ObjectId,
        ref: 'Locations',
        required: false
    },
    accessorial: {
        type: Schema.Types.ObjectId,
        ref: 'Accessorials',
        required: false
    } 
};

const CapacityBoardOrderSchema = {
    
    orderId: Number,

    company: {
        id: Number,
        name: String
    },
    equipment: {
        eqType: Number,
        name: String,
        
        id: Number,
        feet: Number,
        cube: Number,
        weight: Number
        // feet : equipment.value,
        // cube : equipment.maxVolume,
        // weight : equipment.maxweight
    },
    
    availableSize: Number,
    usedSize: Number,
    availableWeight: Number,
    usedWeight: Number,

    flatRate: Number,
    perMileRate: Number,      // (calculated)

    start: CapacityBoardAddress,
    end: CapacityBoardAddress,
    
    distance: Number,               // (calculate)
    postedDate: Date,

    loadPriceType: {
        type: Number,
        required: false,
        default: 1
    },

    contact: {
        telephone: String,
        email: String,
        person: String
    },
    servicetime: Number
};

const CapacityBoardPublisher = {
    userType: String, // broker, shipper, carrier
    userId: String, // Number,
    dbName: String,
    phone: String,
    contactPerson: String,
    email: String,
    username: String,
    company: String,
};

const CapacityBoardTaker = {
    userType: String, // broker, shipper, carrier
    userId: String, // Number,
    dbName: String,
};

const CapacityBoard = new Schema({
    name: String,
    deleted: {
        type: Boolean,
        default: false,
        required: false
    },
    number: Number, // unique for algo
    order: {
        type: CapacityBoardOrderSchema,
        default: null,
        required: true
    },
    publishedBy: {
        type: CapacityBoardPublisher,
        required: true
    },
    takenBy: {
        type: CapacityBoardTaker,
    },
},
{
    collection: 'CapacityBoards'
}
);

//console.log(conn)
module.exports = conn.model("CapacityBoard", CapacityBoard);