const db = require('../config/db.config.js');
const Order = db.order;
// const op = db.Sequelize.Op;
// const seq = db.sequelize;

module.exports = class Order {


    constructor(params) {
        this.data = params.data;        
    }

    async create(){
        console.log(this.data);
        
        let theLoad = await Order.create({});
        
        return theLoad;

    }


};

