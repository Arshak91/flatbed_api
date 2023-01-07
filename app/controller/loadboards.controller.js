const db = require('../config/db.config.js');
const Helpers = require('../classes/helpers.js');
const Load = db.load;
const Order = db.order;
const Op = db.Sequelize.Op;
const uuidv1 = require('uuid/v1');
const moment = require('moment');
const path = require('path');
const csv = require('csv-parser');
// const fs = require('fs')
const Planning = require('../mongoModels/PlanningModel');
const LoadBoard = require('../mongoModels/LoadBoardModel');
const User = require('../mongoModels/UserModel');
const LoadBoardClass = require('../classes/loadboard');
const CapacityBoard = require('../mongoModels/CapacityBoardModel');
const Filters = require('./fillters');
const UploadClass = require('../mongoClasses/upload');
const getResponse = require('../helper/index');
const Cities = require('../mongoModels/CitiesModel');

const mongo = require('mongodb');

// const Settings = db.settings

const Settings = require('../mongoModels/SettingsModel');



function getSortObject(query) {
    let orderBy = query.orderBy ? query.orderBy : '_id';
    const order = query.order && query.order == 'asc' ? 1 : -1;

    if (orderBy == 'id') {
        orderBy = '_id'
    }

    const sort = {}
    sort[orderBy] = order
    return sort // { `${orderBy}`: order }
}
const LoadPriceType = {
    flatRate: 1,
    perMileRate: 2
};
exports.getAll = async (req, res) => {
    try {
        const page = req.query.page ? Math.max(0, req.query.page * 1) : Math.max(0, 1);
        const perPage = req.query.limit ? req.query.limit * 1 : 10;

        let { timezone } = req.headers;
        let minusTime = timezone.split(':')[0];
        let dateNow = moment().format('YYYY-MM-DDTHH:mm:ss.SSS');
        let defaultDate = moment(dateNow).subtract(minusTime, 'hours').format('YYYY-MM-DDTHH:mm:ss.SSS') + "Z";
        // const userId = req.user.type == 'shipper' || req.user.type == 'broker' ? req.user.id : 0
        let userId = null;
        if (req.user.type == 'shipper' || req.user.type == 'broker') {
            userId = req.user.id;
        } else if (req.user.type != 'carrier' && req.user.type != 'courier') {
            res.json({
                status: 1,
                msg: 'ok',
                data: {
                    orders: [],
                    total: 0
                }
            });
        }

        const filter = await Filters.getLoadFilterObject(req.query, userId);

        const sort = getSortObject(req.query);
        let loadBoards;
        loadBoards = await LoadBoard.find({
            $and: [
                {
                    ...filter
                }
            ]
        }).sort(sort).limit(perPage).skip(perPage * (page - 1)).catch(err => {
            console.log('loadboard Catch: ', err);
        });
        if (loadBoards.length) {
            await Promise.all(loadBoards.map(item => {
                if (item && item.order && (!item.order.loadPriceType || item.order.loadPriceType === 0)) {
                    item.order.loadPriceType = LoadPriceType.flatRate;
                }
            }));
        }
        let ct = await LoadBoard.countDocuments({
            $and: [
                {
                    ...filter
                }
            ]
        });
        res.json({
            status: 1,
            msg: 'ok',
            data: {
                orders: loadBoards,
                total: ct
            }
        });
    } catch (error) {
        console.log(error);
        res.json({ error });
    }
};

async function getLoadsInCityRange(cityName, range, arr) {
    const city = await Cities.find({ name: new RegExp(`^.*${cityName}.*$`, 'i') });

    if (city && city.length === 1) {
        let targetCity = city[0];
        const cityRangeList = await Cities.find({ loc: { $geoWithin: { $centerSphere: [[targetCity.latitude, targetCity.longitude], range / 3963.2] } } })
        if (cityRangeList.length) {
            await Promise.all(cityRangeList.map(async item => arr.push(item.name)));
        } else arr.push(targetCity.name);
    }
    return arr;
}

exports.getByIds = async (req, res) => {
    try {
        // const page = req.query.page ? Math.max(0, req.query.page*1) : Math.max(0, 1);
        // const perPage = req.query.limit ? req.query.limit*1 : 10;

        console.log(req.params.ids);
        const filter = {
            //type: 0
            _id: { $in: req.params.ids.split(',') },

            //$or: [ { type: 0, type: undefined }, { type: 1, 'publishedBy.type.userId': userId  } ]
        };

        // if(query.ids){
        //     //_id : { $in : [1,2,3,4] }
        //     filter['_id'] = { $in : query.ids.split(',') } // parseInt(query.equipment_type)
        // }


        // console.log('\n', ' - filter: ', filter, '')
        LoadBoard.find(filter).sort({ _id: -1 }) // .limit(perPage).skip(perPage * (page - 1))
            .then(async (loadBoards) => {

                // console.log(loadBoards)
                // let ct = await LoadBoard.countDocuments();
                // console.log(ct);
                res.json({
                    status: 1,
                    msg: 'ok',
                    data: {
                        //loads: loadBoards,
                        orders: loadBoards,
                        // total: ct
                    }
                });
            });
    } catch (error) {
        console.log(error)
        res.json({ error });
    }
};

exports.getOne = async (req, res) => {
    if (req.user.type != 'shipper' && req.user.type != 'broker' && req.user.type != '') {
        return res.json({
            status: 0,
            msg: 'Unauthorized request'
        });
    }

    try {
        const filter = {
            _id: req.params.id,
        }
        filter['publishedBy.userId'] = parseInt(req.user.id)

        LoadBoard.findOne(filter)
            .then(async (loadBoard) => {
                // console.log(' -- ', loadBoard)
                res.json({
                    status: 1,
                    msg: 'ok',
                    data: loadBoard
                });
            });
    } catch (error) {
        console.log(error)
        res.json({ error });
    }
};

exports.create = async (req, res) => {
    const lbc = new LoadBoardClass();

    const data = req.body;
    console.log(data, 'data');
    const user = {
        type: req.user.type, // broker, shipper, carrier
        id: req.user.id,
        name: req.user.name,
        username: req.user.username,
        company: req.user.company,
        email: req.user.email,
        phone: req.user.Phone
    };

    const resModel = await lbc.create(data.orders[0], user);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(201).send(resModel);
};

exports.createForMobile = async (req, res) => {
    const lbc = new LoadBoardClass();

    const data = req.body;
    console.log(data, 'data------------------------------');
    const user = {
        type: req.user.type, // broker, shipper, carrier
        id: req.user.id,
        name: req.user.name,
        username: req.user.username,
        company: req.user.company,
        email: req.user.email,
        phone: req.user.Phone
    };

    const resModel = await lbc.createForMobile(data, user);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(201).send(resModel);
};

exports.createAPI = async (req, res) => {
    const lbc = new LoadBoardClass()

    const data = req.body

    if (!req.user && !req.user.type && !req.user.id) {
        return res.send({
            status: 0,
            msg: 'unknown user'
        })
    }
    const user = {
        type: req.user.type, // broker, shipper, carrier
        id: req.user.id,
        name: req.user.name,
        username: req.user.username,
        company: req.user.company,
        email: req.user.email,
        phone: req.user.Phone
    }

    const resModel = await lbc.create(data, user)

    res.status(201).send(resModel)
}

exports.edit = async (req, res) => {
    const lbc = new LoadBoardClass();

    const data = req.body;

    const resModel = await lbc.edit(req.params.id, data);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(200).json(resModel);
};

exports.editforMobile = async (req, res) => {
    const lbc = new LoadBoardClass();

    const data = req.body;

    const resModel = await lbc.editForMobile(req.params.id, data);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(200).json(resModel);
};

exports.delete = async (req, res) => {
    const lbc = new LoadBoardClass();

    const result = await lbc.delete([req.params.id], req.user);

    if (result == -1) {
        return res.status(500).send({
            status: 0,
            'msg': 'LoadBoard delete error'
        });
    }

    res.status(200).send({
        status: 1,
        msg: `${req.params.id} LoadBoard deleted`
    });
};

exports.deleteMobile = async (req, res) => {
    const lbc = new LoadBoardClass();
    let ids;
    if (Array.isArray(req.body)) {
        ids = req.body;
    } else {
        ids = req.body.split(',');
    }
    const result = await lbc.delete(ids);

    if (result == -1) {
        return res.status(500).send({
            status: 0,
            'msg': 'LoadBoard delete error'
        });
    }

    res.status(200).send({
        status: 1,
        msg: `${req.body.join(',')} LoadBoard deleted`
    });
};



exports.getStopsForPlanning = async (req, res) => {
    try {
        filter = {
            // _id: { $in : loadIds },
            _id: { $in: req.params.id.split(',') }
        }

        // get loads
        const loadsBoards = await LoadBoard.find(filter).sort({ _id: -1 })
        if (!loadsBoards) {
            return res.json({ status: 1, msg: 'no loadboards', data: { orders: [], count: 0 } });
        }

        // get capacities
        const capacityBoards = await CapacityBoard.find(filter).sort({ _id: -1 })
        if (!capacityBoards) {
            return res.json({ status: 1, msg: 'no capacity', data: { orders: [], count: 0 } });
        }

        // get stops
        const stops = []

        capacityBoards.forEach(cb => {
            if (cb.order.start) {
                // console.log(cb.order.start)
                stops.push([
                    cb.order.start.lon,
                    cb.order.start.lat
                ])
            }
            if (cb.order.end) {
                // console.log(cb.order.end)
                stops.push([
                    cb.order.end.lon,
                    cb.order.end.lat
                ])
            }
        })

        loadsBoards.forEach(lb => {
            if (lb.order.start) {
                // console.log(lb.order.start)
                stops.push([
                    lb.order.start.lon,
                    lb.order.start.lat
                ])
            }
            if (lb.order.end) {
                // console.log(lb.order.end)
                stops.push([
                    lb.order.end.lon,
                    lb.order.end.lat
                ])
            }
        })

        return res.json({
            status: 1,
            msg: 'ok',
            data: stops
        });
    } catch (error) {
        console.log(error)
        res.json({ msg: error.message, status: 0 });
    }
};

exports.getByPlanningId = async (req, res) => {
    try {
        // console.log(req.params);
        let filter = {
            _id: req.params.id,
        }

        const planning = await Planning.findOne(filter)

        if (!planning || !planning.stops) {
            return res.json({
                status: 1,
                msg: 'ok',
                data: { orders: [] }
            });
        }

        if (!planning.orders) {
            return res.json({ status: 1, msg: 'no orders', data: { orders: [], count: 0 } });
        }

        filter = {
            // _id: { $in : loadIds },
            _id: { $in: planning.orders.split(',') }
        }

        // get loads
        const loadsBoards = await LoadBoard.find(filter).sort({ _id: -1 })
        if (!loadsBoards) {
            return res.json({ status: 1, msg: 'no loadboards', data: { orders: [], count: 0 } });
        }

        // get capacities
        const capacityBoards = await CapacityBoard.find(filter).sort({ _id: -1 })
        if (!capacityBoards) {
            return res.json({ status: 1, msg: 'no capacity', data: { orders: [], count: 0 } });
        }

        // get stops
        const stops = []
        // capacityBoards.forEach(cb => { cb.cap = 1; stops.push(cb) })
        // loadsBoards.forEach(lb => { lb.cap = 0; stops.push(lb) })

        capacityBoards.forEach(cb => { stops.push(getStopModel(cb, 1)) })
        loadsBoards.forEach(lb => { stops.push(getStopModel(lb, 0)) })
        
        let planingFilter = {};
        planingFilter['$or'] = [
            { loadId: { $in: loadsBoards.map(x => x.id) } },
            { capacityId: { $in: capacityBoards.map(x => x.id) } }
        ];
        const planingOrders = await PlaningOrders.find(planingFilter);

        await Promise.all(planingOrders.map(item => {
            const loadIndex = stops.findIndex(x => x.id.toString() === (item.loadId ? item.loadId.toString() : null));
            const capIndex = stops.findIndex(x => x.id.toString() === (item.capacityId ? item.capacityId.toString() : null));
            if (loadIndex > -1) {
                stops[loadIndex].status = item.status;
            }
            if (capIndex > -1) {
                stops[capIndex].status = item.status;
            }
        }));

        return res.json({
            status: 1,
            msg: 'ok',
            data: {
                planningId: req.params.id,
                orders: stops,
                count: stops.length
            }
        });
    } catch (error) {
        console.log(error)
        res.json({ msg: error.message, status: 0 });
    }
};
// set or edit load price from shipper or broker
exports.setOrderPriceFromShipper = async (req, res) => {
    const { capacityId, loadId, price } = req.body;
    const [user, capacity, load] = await Promise.all([
        User.findById(req.user.id),
        CapacityBoard.findById(capacityId),
        LoadBoard.findById(loadId)
    ]);

    if (!capacity) return res.status(400).send({ status: 0, msg: 'Capacity not found.' });

    if (!load) return res.status(400).send({ status: 0, msg: 'Load not found.' });

    if (user && user.type === 'carrier') return res.status(400).send({ status: 0, msg: 'Wrong user type, type must be a shipper or broker' });

    load.order.flatRate = price;
    console.log(load.order);

    await Promise.all([
        load.updateOne(load),
        load.save()
    ]);
    return res.status(200).send({ status: 1, msg: 'Load price successful set.' });

}
function getStopModel(stop, cap) {
    const model = {
        cap: cap,
        id: stop._id,
        order: stop.order,
        contact: {
            email: stop.publishedBy.email,
            name: stop.publishedBy.name,
            phone: stop.publishedBy.phone,
        }
    };
    return model;
}


exports.fixIt = async (req, res) => {


    // let plannings = await Planning.find()

    // for(let i = 0; i < plannings.length; i ++){
    //     plannings[i].ordersCount = plannings[i].orders.split(',').length

    //     await plannings[i].save()
    // }

    // const Equipment = require('../mongoModels/EquipmentModel');

    // const equipments = await Equipment.find()

    // equipments.forEach(async eq=>{
    //     await Equipment.updateOne({ _id: eq._id }, {
    //         id: eq._id.toString()
    //     })
    // })

    return res.json('fixIt')

    // const Job = require('../mongoModels/JobModel')
    // uid = 'f14f9200-21f5-11eb-ab6f-c9bda903c893'

    // // return res.json( await Job.findOne({ UUID: uid }) )

    // const startJob = await Job.updateOne({ UUID: uid }, { status: 1, updatedAt: Date.now() });
    // // const startJob = await Job.updateOne({ UUID: uid }, {  $set: { status: 0, updatedAt: Date.now() } });
    // return res.json(startJob)

    // const loadboards = await LoadBoard.find()
    // //const loadboards = await CapacityBoard.find()
    // // const loadboards = [await LoadBoard.findById("5fa153a9f96d6adc3c9cf2cd")]
    // let cnt = 0
    // for(let i = 0; i < loadboards.length; i++){
    //     if(!loadboards[i].order.equipment.name){
    //         // await CapacityBoard.deleteOne({ _id: loadboards[i]._id })
    //         await LoadBoard.updateOne({ _id: loadboards[i]._id }, { $set: { 
    //                 'order.equipment._id': loadboards[i].order.equipment._id.toString(),
    //                 // 'order.equipment._id': loadboards[i].order.equipment.id,
    //                 'order.equipment.name': `${loadboards[i].order.equipment.code} - ${loadboards[i].order.typeName}` 
    //             }, 
    //             //$unset: { 'order.equipment.__v': "" }
    //         }, function(err, res) {
    //             if (err) {
    //                 console.log(' - err: ', err);
    //                 return
    //             }
    //             console.log('- ', loadboards[i]._id)
    //             cnt++
    //         });
    //     }
    // }
    // // loadboards.forEach(lb0 => {
    // //     lb.order.equipment.__v = undefined
    // //     lb.order.equipment._id = lb.order.equipment._id.toString()
    // //     lb.save()
    // // })

    // return res.json(cnt)

    // const city = 'Miami'
    // //const filter = { LocationName: { $eq: city } }
    // // const filter = { LocationName: new RegExp(`.${city}.`) }
    // const filter = { LocationName: new RegExp(`^${city}$`, 'i') }
    // // const filter = { LocationName: /^miami$/i }


    // const ZipCode = require('../mongoModels/ZipCodesModel');
    // const zips = await ZipCode.find(filter)

    // const zips = await ZipCode.aggregate([ 
    //     { $group: 
    //         { 
    //             LocationName: { $toLower: "$LocationName" }, 
    //         }
    //     },
    //     { $match: 
    //         { LocationName: city.toLowerCase() } 
    //     }
    // ])

    // return res.json(zips)

    // const loadboards = await LoadBoard.find()



    // let doneCount = 0
    // // loadboards.forEach(lb => {
    // //     if(lb.order){
    // //         console.log('-eqId 1: ', lb.order.equipment.id)
    // //         lb.order.equipment.id = '5f97ee6b889b842cace17fef'
    // //         lb.save()
    // //         console.log('-eqId 2: ', lb.order.equipment.id)
    // //         doneCount++
    // //     }else{
    // //         console.log(' - lb: ', lb)
    // //     }
    // // })

    // // loadboards.forEach(lb => {
    // //     LoadBoard.updateOne({ _id: lb._id }, { $set: { 'order.equipment.id': '5f97ee6b889b842cace17fef' } }, function(err, res) {
    // //         if (err) {
    // //             console.log(' - err: ', err);
    // //             return
    // //         }
    // //         doneCount++
    // //     });
    // // })
    // // for(let i = 0; i < loadboards.length; i++){
    // //     if(loadboards[i].order.equipment.id >= 0){
    // //         LoadBoard.updateOne({ _id: loadboards[i]._id }, { $set: { 'order.equipment.id': '5f97ee6b889b842cace17fef' } }, function(err, res) {
    // //             if (err) {
    // //                 console.log(' - err: ', err);
    // //                 return
    // //             }
    // //             doneCount++
    // //         });
    // //         // const lb = await LoadBoard.findById(loadboards[i]._id)
    // //         // lb.order.equipment.id = '5f97ee6b889b842cace17fef'
    // //         // await lb.save();
    // //         //console.log('-eqId 1: ', lb.order.equipment.id)
    // //         // loadboards[i].order.equipment.id = '5f97ee6b889b842cace17fef'
    // //         // loadboards[i].save()
    // //         //console.log('-eqId 2: ', lb.order.equipment.id)
    // //         // doneCount++
    // //     }
    // // }

    // res.json({
    //     msg: 'ok',
    //     doneCount
    // })
}

exports.deleteByUser = async (req, res) => {
    let { userIds } = req.body, users = [], loadArr = [], capArr = [];
    for (const userId of userIds) {
        let loads = await LoadBoard.deleteMany({
            'publishedBy.userId': userId
        });
        let cap = await CapacityBoard.deleteMany({
            'publishedBy.userId': userId
        });
        let user = await User.deleteOne({
            _id: userId
        });
        users.push(user);
        loadArr.push(loads);
        capArr.push(cap);
    }

    res.json({
        users,
        loadArr,
        capArr
    });
};






// #############
// P U B L I S H

exports.publishLoads = async (req, res) => {
    // check request
    if (req.user.type !== 'shipper') {
        return res.status(401).send('Unauthorized request')
    }

    if (req.body.loadIds == undefined) {
        return res.status(500).send({
            'description': 'loadIds is not set',
            'error': 'Incorrect params'
        });
    }

    // publish
    try {
        let loads = await Load.findAll({
            where: { id: { [Op.in]: req.body.loadIds } },
            include: [{ all: true, nested: false }]
        });

        let orderIds = []
        loads.forEach(l => {
            orderIds.push(l.orders)
        })

        orderIds = Helper.splitToIntArray(orderIds.join(','), ',');

        // load orders and publish
        orderIds = await publishByOrderIds(orderIds, {
            type: req.user.type, // broker, shipper, carrier
            id: req.user.id
        })

        // return ok
        res.status(200).send({
            status: 1,
            msg: 'ok',
            data: orderIds
        });
    } catch (err) {
        console.log('bbb')
        console.log(err)
        res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
    }
};

exports.publishOrders = async (req, res) => {
    // check request
    if (req.user.type !== 'shipper') {
        return res.status(401).send('Unauthorized request')
    }

    if (req.body.orderIds == undefined) {
        return res.status(500).send({
            'description': 'orderIds is not set',
            'error': 'Incorrect params'
        });
    }

    // publish
    try {
        // load orders and publish
        const orderIds = await publishByOrderIds(req.body.orderIds, {
            type: req.user.type, // broker, shipper, carrier
            id: req.user.id
        })

        // return ok
        res.status(200).send({
            status: 1,
            msg: 'ok',
            data: orderIds
        });
    } catch (err) {
        res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
    }
};

exports.uploadLoads = async (req, res) => {
    // console.log(' --- body ', req.body)
    if (!req.user && !req.user.type && !req.user.id) {
        return res.send({
            status: 0,
            msg: 'unknown user'
        });
    }


    console.log(' -- loads upload started');
    let uploadCl;
    uploadCl = new UploadClass({
        data: {
            type: "LoadBoard",
            status: 0
        }
    });
    let { data } = await uploadCl.create();
    res.json(getResponse(1, "loads upload started", { uploadId: data._doc._id }));
    try {

        if (req.body.saveFields != 0 && req.body.fileHeaders && req.user.id) {
            // console.log(' - headers:', req.body.fileHeaders)
            let settings = await Settings.findOne({ userId: req.user.id });
            if (!settings) {
                settings = new Settings({
                    userId: req.user.id,
                    fileHeaders: JSON.parse(req.body.fileHeaders),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                await settings.save();
            } else {
                await Settings.updateOne({ userId: req.user.id }, {
                    fileHeaders: JSON.parse(req.body.fileHeaders),
                    updatedAt: Date.now()
                });
            }
        }


        const loads = JSON.parse(req.body.changedFile);
        let { uploadedCount, errorsCount } = await saveLoadsDAT(loads, req.user, req.headers.timezone);

        console.log(' -- loads upload end');
        uploadCl = new UploadClass({
            data: {
                status: 1,
                OrderCount: uploadedCount,
                IncompleteOrderCount: errorsCount

            },
            id: data._doc._id
        });
        await uploadCl.edit();
    } catch (error) {
        console.log('ERROR!', error);
        res.json({
            status: 0,
            error
        });
    }
};


async function saveLoadsDAT(loads, _user, timezone) {
    let uploadedCount = 0;
    let errorsCount = 0;

    const lbc = new LoadBoardClass();

    const user = {
        type: _user.type,
        id: _user.id,
        name: _user.name,
        username: _user.username,
        company: _user.company,
        email: _user.email,
        phone: _user.Phone
    }
    for (let i = 0; i < loads.length; i++) {
        const l = loads[i]

        const data = {
            pickupdateFrom: l.pickupdateFrom,
            equipmentCode: l.Equipment,
            fromCityState: l.pickupCity,
            toCityState: l.deliveryCity,
            deliveryCompany: l.deliveryCompanyName,
            notes: `${l.deliveryCompanyName} ${l.Contact}`,
            size: l.Size,
            weight: l.Weight,
            rate: l.flatRate,
            loadType: l.loadType,
        };

        const lb = await lbc.createUploadDAT(data, user, timezone);
        if (typeof lb == 'string') {
            // console.log('- save error: ', lb, data)
            errorsCount++;
        } else {
            // console.log('---- done: ', lb._id)
            uploadedCount++;
        }
    }

    return {
        uploadedCount,
        errorsCount
    };
}

async function old_Upload(req) {
    let b = req.body.changedFile ? Buffer.from(req.body.changedFile) : null;
    let s = b ? b.toString('base64') : null;
    if (!s) {
        console.log('changedFile: ', req.body.changedFile);
    }

    // console.log(' --', req.files)

    let fileArr = [];
    let fileName = req.body.fileName, type;
    if (req.files && req.files.files) {
        if (Array.isArray(req.files.files)) {
            // console.log(' -- 1')
            for (const file of req.files.files) {
                // CSV:  0
                // EDF:  1
                let ext = path.extname(file.name);
                ext == ".csv" ? type = 0 :
                    ext == ".edf" ? type = 1 : type = 2;
                if (type == 0 || type == 1) {
                    fileArr.push({
                        FileType: type,
                        FileName: file.name,
                        Data: Buffer.from(file.data).toString('base64'),
                        DataBytes: Buffer.from(file.data)
                    });
                }
            }
        } else {
            // console.log(' -- 2')
            let file = req.files.files;
            // console.log(' -- file ', file)
            let ext = path.extname(file.name);
            // console.log(' -- ext ', ext)
            ext == ".csv" ? type = 0 :
                ext == ".edf" ? type = 1 : type = 2;
            if (type == 0 || type == 1) {
                fileArr.push({
                    FileType: type,
                    FileName: file.name,
                    Data: Buffer.from(file.data).toString('base64'),
                    DataBytes: Buffer.from(file.data)
                });
            }
            fileName = file.name;
        }
    } else {
        // console.log(' -- 3')
        fileArr.push({
            FileType: req.body.fileType,
            FileName: fileName,
            Data: req.body.changedFile ? s : 'null',
            DataBytes: req.body.changedFile ? Buffer.from(req.body.changedFile) : undefined
        });
    }

    // console.log('\n --- fileArr ', fileArr)
    let { equipmentTypeId } = req.body;

    for (let i = 0; i < fileArr.length; i++) {
        if (fileArr[i].DataBytes) {
            const options = undefined // {separator: ';'} // undefined
            const results = await execCSVAsync(fileArr[i].DataBytes, options);
            // console.log(' - ', results)
            results.forEach(r => {
                storeLoadInDB(r, req.user, '5f97ee6b889b842cace17ffa') // equipmentTypeId)
            });
        }
    }

    return fileArr;
}


async function execCSVAsync(file, options) {
    return new Promise(function (resolve, reject) {
        const results = [];
        // fs.createReadStream(file)
        bufferToStream(file)
            .pipe(csv(options))
            .on('data', (data) => {
                results.push(data)
            })
            .on('end', () => {
                resolve(results);
            })
            .on('error', reject);
    })
}

var Readable = require('stream').Readable;
const PlaningOrders = require('../mongoModels/PlaningOrders.js');

function bufferToStream(buffer) {
    var stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
}

async function storeLoadInDB(r, _user, eqId) {
    // console.log('\n -- ', r)

    const lbc = new LoadBoardClass()

    // const data = r // req.body

    const data = {
        "orders": [{
            "isPrivate": r.isPrivate,
            "deliveryCompanyName": r.deliveryCompanyName,
            "pickupCompanyName": r.pickupCompanyName,
            "eqId": eqId,
            "products": [{
                "Size": r.Size,
                "Weight": r.Weight,

                "SizeUsed": r.UsedSize,
                "WeightUsed": r.UsedWeight,
                "SizeAvailable": r.AvailableSize,
                "WeightAvailable": r.AvailableWeight,
            }],
            "loadtype": "Partial",
            "flatRate": r.flatRate == '' ? 0 : r.flatRate,
            "perMileRate": r.perMileRate == '' ? 0 : r.perMileRate,
            "pickupCountry": r.pickupCountry,
            "pickupZip": r.pickupZip,
            "pickupState": r.pickupState,
            "pickupCity": r.pickupCity,
            "pickupdateFrom": r.pickupdateFrom,
            "pickupdateTo": r.pickupdateTo,
            "deliveryCountry": r.deliveryCountry,
            "deliveryZip": r.deliveryZip,
            "deliveryState": r.deliveryState,
            "deliveryCity": r.deliveryCity,
            "deliverydateFrom": r.deliverydateFrom,
            "deliverydateTo": r.deliverydateTo
        }
        ]
    }

    const user = {
        type: _user.type, // broker, shipper, carrier
        id: _user.id
    }

    // console.log(data)
    const resModel = await lbc.create(data, user)

    return resModel
}


async function uploadSpecial(req, res) {
    console.log(' -- loads upload special started');
    try {

        var xlsx = require('node-xlsx');

        // var obj = xlsx.parse(__dirname + '/myFile.xlsx'); // parses a file


        const uid = uuidv1();

        let b = req.body.changedFile ? Buffer.from(req.body.changedFile) : null;
        let s = b ? b.toString('base64') : null;
        if (!s) {
            console.log('changedFile: ', req.body.changedFile);
        }

        // console.log(' --', req.files)

        let fileArr = []
        let type = 2
        let fileName = req.body.fileName;
        if (req.files && req.files.files) {
            if (Array.isArray(req.files.files)) {
                // console.log(' -- 1')
                for (const file of req.files.files) {
                    // CSV:  0
                    // EDF:  1
                    let ext = path.extname(file.name);
                    ext == ".csv" ? type = 0 :
                        ext == ".edf" ? type = 1 : type = 2;
                    if (type == 0 || type == 1) {
                        fileArr.push({
                            FileType: type,
                            FileName: file.name,
                            Data: Buffer.from(file.data).toString('base64'),
                            DataBytes: Buffer.from(file.data)
                        });
                    }
                }
            } else {
                // console.log(' -- 2')
                let file = req.files.files;
                // console.log(' -- file ', file)
                let ext = path.extname(file.name);
                // console.log(' -- ext ', ext)
                ext == ".csv" ? type = 0 :
                    ext == ".edf" ? type = 1 : type = 2;
                if (type == 0 || type == 1 || type == 2) {
                    fileArr.push({
                        FileType: type,
                        FileName: file.name,
                        Data: Buffer.from(file.data).toString('base64'),
                        DataBytes: Buffer.from(file.data)
                    });
                }
                fileName = file.name;
            }
        } else {
            // console.log(' -- 3')
            fileArr.push({
                FileType: req.body.fileType,
                FileName: fileName,
                Data: req.body.changedFile ? s : 'null',
                DataBytes: req.body.changedFile ? Buffer.from(req.body.changedFile) : undefined
            });
        }

        // console.log('\n --- fileArr ', fileArr)
        let { equipmentTypeId } = req.body;

        for (let i = 0; i < fileArr.length; i++) {
            if (fileArr[i].DataBytes) {
                // console.log('\n --- bytes ', fileArr[i].DataBytes)
                // console.log('\n --- bytes 1 ')

                var obj = xlsx.parse(bufferToStream(fileArr[i].DataBytes)); //  fs.readFileSync(__dirname + '/myFile.xlsx'));
                console.log(' --- ', obj)

                // const options = undefined // {separator: ';'} // undefined
                // const results = await execCSVAsync(fileArr[i].DataBytes, options);
                // // console.log(' - ', results)
                // results.forEach(r => {
                //   //   storeLoadInDB(r, req.user, equipmentTypeId)
                // })
            }
        }

        res.json({
            status: 1,
            data: fileArr, // sendFile.data,
            UUID: uid,
        });
    } catch (error) {
        console.log('ERROR!', error);
        res.json({
            status: 0,
            error
        });
    }
}



async function publishByOrderIds(orderIds, user) {
    const orders = await Order.findAll({
        where: {
            id: { [Op.in]: orderIds },
            // flowType: 3, // E2E
            // loadtype: 2, // partial , chshtel karogha 2-@ full-na
        },
        include: [{ all: true, nested: false }]
    })
    // }).then(orders => {
    //     console.log('o', orders)
    // });

    await orders.forEach(async o => {
        const loadboardExist = await LoadBoard.find({ 'order.orderId': o.id })
        if (!loadboardExist || loadboardExist.length == 0) {
            return
        }

        // create mongodb model
        const loadboard = new LoadBoard({
            order: {

                orderId: o.id,

                company: {
                    id: o.companyId,
                    deliveryCompanyName: o.deliveryCompanyName,
                    pickupCompanyName: o.pickupCompanyName
                },
                equipment: {
                    eqType: o.eqType,
                    // name: String
                },
                product: o.productDescription,        // Object,

                size: o.feet,
                weight: o.weight,
                loadType: o.loadtype,               // Partial/Full
                // poolNoPool: String,              // Pool/No Pool

                start: getStartAddress(o),
                end: getEndAddress(o),

                distance: o.custDistance,           // (calculate)
                postedDate: new Date(),
                flatRate: o.flatRate,
                perMileRate: o.permileRate,

                // contact: {
                //     telephone: String,
                //     email: String,
                //     person: String
                // }
            },
            publishedBy: {
                userType: user.type, // broker, shipper, carrier
                userId: user.id,
                // dbName: String,
                // phone: String,
                // contactPerson: String,
                // email: String
            },
        })

        loadboard.save()

        o.isPublic = 1
        o.save()
    })

    console.log('orders published !!!')

    const oIds = orders.map(o => {
        return o.id
    })

    return oIds
}

function getStartAddress(o) {
    return {
        lat: o.pickupLat,
        lon: o.pickupLon,
        country: o.pickupCountry,
        state: o.pickupState,
        zip: o.pickupZip,
        city: o.pickupCity,
        // nsew: String,               // N / S / E / W    
        timeWindowFrom: o.pickupdateFrom,
        timeWindowTo: o.pickupdateTo
    }
}

function getEndAddress(o) {
    return {
        lat: o.deliveryLat,
        lon: o.deliveryLon,
        country: o.deliveryCountry,
        state: o.deliveryState,
        zip: o.deliveryZip,
        city: o.deliveryCity,
        timeWindowFrom: o.deliverydateFrom,
        timeWindowTo: o.deliverydateTo
        // nsew: String,               // N / S / E / W    
    }
}









exports.getUploadOrdersStatus = async (req, res) => {
    try {
        let url = 'http://192.168.1.109:4774/upload',
            // let url = `${env.uploadHost}${env.uploadPort}/upload`,
            result;
        result = await axios.get(url).catch(err => {
            console.log('error', err);
        });
        // console.log('status', result);
        let { data, status, statusText } = result;
        if (status == 200) {
            res.json({
                ...data,
                msg: statusText
            });
        } else {
            res.status(409).json({
                status: 0,
                msg: statusText
            });
        }

    } catch (error) {
        res.status(409).json({
            status: 0,
            error
        });
    }
};







// ############
// for engine

exports.ordersForEngine = async (req, res) => {
    try {
        let dateRange = req.query.dateRange;
        let timezone = req.query.timezone;
        let date = Helpers.getFlatbedDatesFromEndFormatted(req.query.date, timezone, dateRange);
        // console.log('-- date: ', date)

        // date = {
        //     from: new Date(date.from.replace('T', ' ')),
        //     to: new Date(date.to.replace('T', ' '))
        // };
        // console.log('-- date: ', date)

        // get capacity boards
        const capacityBoards = await CapacityBoard.find({
            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lte: date.to
            },
            // "order.start.timeWindowFrom": { 
            //     $lte: date.to
            // },
            // "order.end.timeWindowTo": { 
            //     $gte: date.from
            // },
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        }) // .sort('_id')


        // get loadboard filter
        const userId = req.query.userId ? req.query.userId : null;
        const maxCount = req.query.maxCount ? parseInt(req.query.maxCount) : 400;

        const loadBoards = await LoadBoard.find({
            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lte: date.to
            },
            "publishedBy.userId": userId,
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        }).limit(maxCount);

        // combine

        // console.log(' - cb', capacityBoards.length)
        // console.log(' - lb', loadBoards.length)


        let idIndex = 1

        // create post data
        const orders = []
        capacityBoards.forEach(cb => {
            // console.log(cb.number)
            if (!cb.order.end) { // || !cb.order.end.timeWindowFrom || !cb.order.end.timeWindowTo){
                return
            }
            orders.push({
                "id": idIndex++, // cb.number, // cb._id,
                "sid": `cap__${cb._id}`,
                "ssid": cb._id,
                "IsCapacity": true,
                "feet": cb.order.usedSize,
                "weight": cb.order.usedWeight,
                "priority": 0,
                "cube": 0,
                "flowType": 3,
                "deliveryLat": cb.order.end.lat,
                "deliveryLon": cb.order.end.lon,
                "pickupLat": cb.order.start.lat,
                "pickupLon": cb.order.start.lon,
                "deliverydateFrom": cb.order.end.timeWindowFrom,
                "deliverydateTo": cb.order.end.timeWindowTo,
                "pickupdateFrom": cb.order.start.timeWindowFrom,
                "pickupdateTo": cb.order.start.timeWindowTo,
                "servicetime": 1200
            })
        })

        loadBoards.forEach(lb => {
            // console.log(' lb', lb)
            orders.push({
                "id": idIndex++, // lb.number, // lb._id,
                "sid": `load__${lb._id}`,
                "ssid": lb._id,
                "IsCapacity": false,
                "feet": lb.order.size,
                "weight": lb.order.weight,
                "cube": 0,
                "flowType": 3,
                "priority": 1,
                "deliveryLat": lb.order.end.lat,
                "deliveryLon": lb.order.end.lon,
                "pickupLat": lb.order.start.lat,
                "pickupLon": lb.order.start.lon,
                "deliverydateFrom": lb.order.end.timeWindowFrom,
                "deliverydateTo": lb.order.end.timeWindowTo,
                "pickupdateFrom": lb.order.start.timeWindowFrom,
                "pickupdateTo": lb.order.start.timeWindowTo,
                "servicetime": 1200
            })
        })

        const data = {
            status: 1,
            msg: "ok",
            data: {
                orders: orders,
                count: orders.length
            }
        }

        // console.log(data)

        // response
        return res.status(200).json(data);
    } catch (ex) {
        console.log(ex);
        res.json({ ex });
    }
};


exports.ordersForEngineByLoadIds = async (req, res) => {
    try {
        let dateRange = req.query.dateRange;
        let timezone = req.query.timezone;
        let date = Helpers.getFlatbedDatesFromEndFormatted(req.query.date, timezone, dateRange);
        // console.log('-- date: ', date)

        // date = {
        //     from: new Date(date.from.replace('T', ' ')),
        //     to: new Date(date.to.replace('T', ' '))
        // };
        // console.log('-- date: ', date)

        const capacityBoards = await CapacityBoard.find({
            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lt: date.to // $lte: date.to
            },
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        }) //.sort('_id')

        // console.log(' --- cap --- ', capacityBoards)

        // get loadboard filter fith max size and weight
        const userId = req.query.userId ? req.query.userId : null
        const maxCount = req.query.maxCount ? parseInt(req.query.maxCount) : 400

        const loadBoards = await LoadBoard.find({
            "_id": { $in: req.params.loadIds.split(',') },

            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lt: date.to // $lte: date.to
            },
            "publishedBy.userId": userId,
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        }).limit(maxCount)

        let idIndex = 1

        // console.log(loadBoards)

        // create post data
        const orders = []
        capacityBoards.forEach(cb => {
            // console.log(cb.number)
            if (!cb.order.end) {
                return
            }
            orders.push({
                "id": idIndex++, // cb.number, // cb._id,
                "sid": `cap__${cb._id}`,
                "ssid": cb._id,
                "IsCapacity": true,
                "feet": cb.order.usedSize,
                "weight": cb.order.usedWeight,
                "priority": 0,
                "cube": 0,
                "flowType": 3,
                "deliveryLat": cb.order.end.lat,
                "deliveryLon": cb.order.end.lon,
                "pickupLat": cb.order.start.lat,
                "pickupLon": cb.order.start.lon,
                "deliverydateFrom": cb.order.end.timeWindowFrom,
                "deliverydateTo": cb.order.end.timeWindowTo,
                "pickupdateFrom": cb.order.start.timeWindowFrom,
                "pickupdateTo": cb.order.start.timeWindowTo,
                "servicetime": 1200
            })
        })

        loadBoards.forEach(lb => {
            // console.log(' lb', lb)
            orders.push({
                "id": idIndex++, // lb.number, // lb._id,
                "sid": `load__${lb._id}`,
                "ssid": lb._id,
                "IsCapacity": false,
                "feet": lb.order.size,
                "weight": lb.order.weight,
                "cube": 0,
                "flowType": 3,
                "deliveryLat": lb.order.end.lat,
                "deliveryLon": lb.order.end.lon,
                "pickupLat": lb.order.start.lat,
                "pickupLon": lb.order.start.lon,
                "deliverydateFrom": lb.order.end.timeWindowFrom,
                "deliverydateTo": lb.order.end.timeWindowTo,
                "pickupdateFrom": lb.order.start.timeWindowFrom,
                "pickupdateTo": lb.order.start.timeWindowTo,
                "servicetime": 1200
            })
        })

        const data = {
            status: 1,
            msg: "ok",
            data: {
                orders: orders,
                count: orders.length
            }
        }

        // console.log(data)

        // response
        return res.status(200).json(data)
    } catch (ex) {
        res.json({ ex });
    }
};

exports.changeTimeWindows = async (req, res) => {
    let loadBoards, from, start, end;

    loadBoards = await LoadBoard.find({});
    for (const [l, load] of loadBoards.entries()) {
        let startFrom, startTo, endFrom, endTo, obj = {};
        let range = await Helpers.rangeDates({
            start: load.order.start,
            end: load.order.end
        });
        from = load.order.start.timeWindowFrom.split('T')[1];
        start = moment(load.order.start.timeWindowFrom, 'YYYY-MM-DDTHH:mm:ss.SSS');
        startFrom = moment(from, "HH:mm:ss.SSS").format('YYYY-MM-DDTHH:mm:ss.SSS');
        startTo = moment(startFrom, 'YYYY-MM-DDTHH:mm:ss.SSS').add(moment.duration(range.startRange, 'days')).format('YYYY-MM-DDTHH:mm:ss.SSS');
        end = moment(startFrom, 'YYYY-MM-DDTHH:mm:ss.SSS').add(moment.duration(range.startEndRange, 'days'));
        endFrom = moment(startFrom, 'YYYY-MM-DDTHH:mm:ss.SSS').add(moment.duration(range.startEndRange, 'days')).format('YYYY-MM-DDTHH:mm:ss.SSS');
        endTo = moment(end.add(moment.duration(range.endRange, 'days')), 'YYYY-MM-DDTHH:mm:ss.SSS').format('YYYY-MM-DDTHH:mm:ss.SSS');
        if (load.order.end && load.order.end.city) {
            obj = {
                "order.start.timeWindowFrom": startFrom + "Z",
                "order.start.timeWindowTo": startTo + "Z",
                "order.end.timeWindowFrom": endFrom + "Z",
                "order.end.timeWindowTo": endTo + "Z"
            };
        } else {
            obj = {
                "order.start.timeWindowFrom": startFrom + "Z",
                "order.start.timeWindowTo": startTo + "Z",
                "order.end": null
            };
        }
        await LoadBoard.findOneAndUpdate({
            _id: load._id
        }, obj, { new: true });
        console.log(l);
    }
    res.json({
        loadBoards
    });

};