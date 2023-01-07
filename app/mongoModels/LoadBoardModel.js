// Company
// Equipment
// Product
// Size
// Weight
// Partial/Full
// Pool/No Pool

// Pickup City
// N/S/E/W
// Pickup State
// Pickup Zip
// Pickup Country
// Pickup date/window

// Delivery City
// N/S/E/W
// Delivery State
// Delivery ZIP
// Delivery Country
// Delivery date/window

// Distance (calculate)
// Posted date
// Flat Rate
// Per mile rate

// Telephone
// E-mail
// Contact person



const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const LoadBoardAddress = {
    lat: String,
    lon: String,
    country: String,
    state: String,
    stateLong: String,
    zip: String,
    city: String,
    cityId: {
        type: Schema.Types.ObjectId,
        ref: 'WorldCities'
    },
    street: String,
    nsew: String,               // N / S / E / W    
    timeWindowFrom: Date,
    timeWindowTo: Date,
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

const LoadBoardOrderSchema = {
    
    orderId: Number,

    company: {
        id: Number,
        name: String
    },
    equipment: {
        eqType: Number,
        name: String,

        id: String, // Number,
        feet: Number,
        cube: Number,
        weight: Number,

        typeName: String,
        code: String
        // feet : equipment.value,
        // cube : equipment.maxVolume,
        // weight : equipment.maxweight
    },
    product: Object,

    size: Number,
    weight: Number,
    poolNoPool: String,             // Pool/No Pool

    start: LoadBoardAddress,
    end: LoadBoardAddress,
    
    distance: Number,               // (calculate)
    postedDate: Date,
    flatRate: Number,
    perMileRate: Number,

    HandlingType_id: String,
    Quantity: String,

    notes: String,
    contact: {
        telephone: String,
        email: String,
        person: String
    },
    servicetime: Number
};

const LoadBoardPublisher = {
    userType: String, // broker, shipper, carrier
    userId: String, // Number,
    dbName: String,
    phone: String,
    contactPerson: String,
    email: String,
    username: String,
    company: String
};

const LoadBoardTaker = {
    userType: String, // broker, shipper, carrier
    userId: String, // Number,
    dbName: String,
};

const LoadBoard = new Schema({
    name: {
        type: String,
        default: null
    },
    deleted: {
        type: Boolean,
        default: false,
        required: false
    },
    number: Number, // unique for algo
    type: Number, // 1 public , 2 private
    loadType: String, // Partial/Full
    loadPriceType: {
        type: Number,
        required: false,
        default: null
    },
    order: {
        type: LoadBoardOrderSchema,
        default: null,
        required: true
    },
    publishedBy: {
        type: LoadBoardPublisher,
        required: true
    },
    takenBy: {
        type: LoadBoardTaker,
    },
},
{
    collection: 'LoadBoards'
}
);

//console.log(conn)
module.exports = conn.model("LoadBoard", LoadBoard);