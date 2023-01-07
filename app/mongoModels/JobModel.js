const mongoose = require('mongoose');
const conn = require('../config/mongo_common.config.js');
const Schema = mongoose.Schema;

const Job = new Schema({
    name: String,
    UUID: String,
    params: Object, // { type: Sequelize.JSON },
    filters: Object, // { type: Sequelize.JSON },
    status: Object, // { type: Sequelize.JSON },
    eta: Object, // { type: Sequelize.JSON },
    percentage: Object, // { type: Sequelize.JSON },
    loadOrderIds: Object, // { type: Sequelize.JSON },
    loads: Object, // { type: Sequelize.JSON },
    drivingminutes: Object, // { type: Sequelize.JSON },
    totalRunTime: Object, // { type: Sequelize.JSON },
    totalDistance: Object, // { type: Sequelize.JSON },
    totalDuration: Object, // { type: Sequelize.JSON },
    Infeasible: Object, // { type: Sequelize.JSON },
    InfeasibleCount: Number, //{ type: Sequelize.DOUBLE },
    loadsCount: Number, //{ type: Sequelize.DOUBLE },
    errorMessage: String,
    createdAt: Date, // { type: Sequelize.DATE },
    updatedAt: Date // { type: Sequelize.DATE }
},
{
    collection: 'Jobs'
}
);

module.exports = conn.model("Job", Job);