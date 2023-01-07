const Helper = require('../classes/helpers');
const db = require('../config/db.config.js');
const orderController = require('./orderscontroller');
const Settings = db.settings;
const Op = db.Sequelize.Op;

const attributes = [
    'id',
    'userId',
    'userType',
    'exchangeRate',
    'units',
    'Currency',
    'defaultCurrency',
    'defaultServiceTime',
    'orders',
    'loads',
    'loadTemps',
    'drivers',
    'pieceTime',
    'apiConfigs',
    'durationMultiplier',
    'fileHeaders',
    'createdAt',
    'updatedAt'
];
exports.create = async (req, res) => {
    try {
        const settings = await Settings.create({
            userId: req.user.id,
            exchangeRate: req.body.exchangeRate,
            units: req.body.units,
            Currency: req.body.Currency,
            defaultCurrency: req.body.defaultCurrency,
            defaultServiceTime: req.body.defaultServiceTime,
            pieceTime: req.body.pieceTime,
            orders: req.body.orders,
            loads: req.body.loads,
            loadTemps: req.body.loadTemps,
            drivers: req.body.drivers,
            apiConfigs: req.body.apiConfigs,
            autoplan: req.body.autoplan
        });
        res.json({
            status: 1,
            msg: 'created',
            data: settings
        });
    } catch (error) {
        res.status(409).json({
            status: 0,
            error
        });
    }
};

exports.edit = async (req, res) => {
    try {
        let { id } = req.user;
        let { defaultServiceTime, pieceTime, updateAll } = req.body;
        let settings = await Settings.update(req.body, {
            where: {
                userId: id
            }
        });
        if (updateAll) {
            await orderController.editAll({
                serviceTime: defaultServiceTime,
                pieceTime: pieceTime
            });
        }

        res.json({
            status: 1,
            msg: 'updated',
            data: settings
        });
    } catch (error) {
        res.status(409).json({
            status: 0,
            error
        });
    }
};

exports.get = async (req, res) => {
    try {
        let userId;
        userId = req.query.userId ? req.query.userId : req.user.id ? req.user.id : null;
        let attr = req.query.fields ? req.query.fields.split(',') : attributes;
        let settings;
        settings = await Settings.findOne({
            attributes: attr,
            where: {
                userId
            }
        });
        if (!settings) {
            settings = await Settings.findOne({
                attributes: attr,
                where: {
                    userId: 0
                }
            });
        }
        res.json({
            status: 1,
            msg: 'find setting',
            data: settings
        });
    } catch (error) {
        res.status(409).json({
            status: 0,
            error
        });
    }
};

exports.getAll = async (req, res) => {
    try {
        let sortAndPagination = await Helper.sortAndPagination(req);
        let where = req.query;
        const data = await Helper.filters(where, Op);
        // console.log(data);
        if (data.bool) {
            const settings = await Settings.findAndCountAll({
                where: data.where,
                include: [{ all: true, nested: false }],
                ...sortAndPagination
            });
            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: {
                    settings: settings.rows,
                    total: settings.count
                }
            });
        }
    } catch (error) {
        res.status(409).json({
            status: 0,
            error
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || ids.length == 0 ) {
            res.status(500).send({
                status: 0,
                msg: 'no ids for delete'
            });
            return;
        } else {
            await Settings.destroy({
                where: {
                    id: {
                        [Op.in]: ids
                    }
                }
            });
            res.status(200).send({
                status: 1,
                msg: 'deleted',
                "Count": ids.length, 
            });
        }

    } catch (error) {
        res.status(409).json({
            status: 0,
            error
        });
    }
};
