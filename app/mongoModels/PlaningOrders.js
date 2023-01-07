

const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;
const Constants = require('../constants');
const OrderEquipmentsMode = new Schema({
    code: {
        type: String,
        required: false
    },
    name: {
        type: String,
        required: false
    },
    id: {
        type: Schema.Types.ObjectId,
        ref: 'Equipment',
        required: false,
        default: null
    },
    typeName: {
        type: String,
        required: false
    }
});
const OrderChangesAddressModel = new Schema({
    lat: {
        type: Number,
        required: true,
    },
    lon: {
        type: Number,
        required: true,
    },
    country: {
        type: String,
        required: false,
    },
    state: {
        type: String,
        required: false,
    },
    stateLong: {
        type: String,
        required: false,
    },
    city: {
        type: String,
        required: false,
    },
    cityId: {
        type: Schema.Types.ObjectId,
        ref: 'WorldCities',
        required: false,
        default: null
    },
    timeWindowFrom: {
        type: String,
        required: false,
    },
    timeWindowTo: {
        type: String,
        required: false,
    }
});
const OrderChangesModel = new Schema({
    equipment: OrderEquipmentsMode,
    size: {
        type: Number,
        required: false,
        default: null
    },
    weight: {
        type: Number,
        required: false,
        default: null
    },
    perMileRate: {
        type: Number,
        required: false,
        default: null
    },
    perMileRateTotal: {
        type: Number,
        required: false,
        default: null
    },
    start: OrderChangesAddressModel,
    end: OrderChangesAddressModel,
    distance: {
        type: Number,
        required: false
    },
    postedDate: {
        type: String,
        required: false
    },
    notes: {
        type: String,
        required: false
    },
    servicetime: {
        type: Number,
        required: false
    }
});

const PlaningOrder = new Schema({
    status: {
        type: Number,
        default: Constants.OrderStatusType.notChanged,
        required: true
    },
    isCapacity: {
        type: Boolean,
        default: false
    },
    loadId: {
        type: Schema.Types.ObjectId,
        ref: 'LoadBoard',
        required: false,
        default: null
    },
    capacityId: {
        type: Schema.Types.ObjectId,
        ref: 'CapacityBoard',
        required: false,
        default: null
    },
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
        required: false,
        default: null
    },
    changes: {
        type: [OrderChangesModel]
    },
    createdDate: {
        type: String,
        default: new Date()
    },
    updateDate: {
        type: String,
        required: false,
        default: null
    }
},
    {
        collection: 'PlaningOrder'
    }
);

module.exports = conn.model('PlaningOrder', PlaningOrder);
