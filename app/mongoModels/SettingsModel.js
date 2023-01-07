const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const settingsFilters = {
    capacityFilters: {
        type: Object,
        default: null
    },
    loadsFilters: {
        type: Object,
        default: null
    },
    matchingFilters: {
        type: Object,
        default: null
    }
}

const Settings = new Schema({
    userId: String,
    userType: String, // { type: Sequelize.STRING },
    exchangeRate: String, // { type: Sequelize.STRING },
    units: Object, // { type: Sequelize.JSON },
    Currency: Object, // { type: Sequelize.JSON },
    defaultCurrency: String, // { type: Sequelize.STRING },
    defaultServiceTime: Number, // { type: Sequelize.DOUBLE },
    pieceTime: Number, // { type: Sequelize.DOUBLE },
    orders: Object, // { type: Sequelize.JSON },
    loads: Object, // { type: Sequelize.JSON },
    loadTemps: Object, // { type: Sequelize.JSON },
    drivers: Object, // { type: Sequelize.JSON },
    apiConfigs: Object, // { type: Sequelize.JSON },
    autoplan: Object, // { type: Sequelize.JSON },
    country: String, // { type: Sequelize.STRING },
    countryCode: String, // { type: Sequelize.STRING },
    durationMultiplier: Number, // { type: Sequelize.DOUBLE },
    fileHeaders: Object, // { type: Sequelize.JSON }
    shiftName: String,
    filters: settingsFilters,
    listFilters: {
        loadsFilters: Array,
        capacityFilters: Array,
        matchingFilters: Array
    },
    createdAt: Date,
    updatedAt: Date,
},
{
    collection: 'Settings'
}
);

module.exports = conn.model("Settings", Settings);