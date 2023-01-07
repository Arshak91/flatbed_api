const db = require('../config/db.config.js');
const Helper = require('../classes/helpers.js');
const Load = db.load;
const Order = db.order;
const Op = db.Sequelize.Op;
const uuidv1 = require('uuid/v1');
const moment = require('moment');
// const Settings = db.settings
const CapacityBoard = require('../mongoModels/CapacityBoardModel');
const CapacityBoardClass = require('../classes/capacityboard');
const LoadBoard = require('../mongoModels/LoadBoardModel');
const Fillters = require('./fillters');
const UploadClass = require('../mongoClasses/upload');
const getResponse = require('../helper/index');
const Mailer = require('../classes/mailer');


const path = require('path');
const csv = require('csv-parser');

const Settings = require('../mongoModels/SettingsModel');
// load price type
const LoadPriceType = {
    flatRate: 1,
    perMileRate: 2
};

function getSortObject(query) {
    let orderBy = query.orderBy ? query.orderBy : '_id';
    const order = query.order && query.order == 'asc' ? 1 : -1;

    if (orderBy == 'id') {
        orderBy = '_id';
    }

    const sort = {};
    sort[orderBy] = order;
    return sort;
}

exports.sendRequest = async (req, res) => {
    const orderType = { capacity: 1, loadBoard: 2 };
    const { loads, capacity, type } = req.body;

    const creator = type === orderType.capacity ? capacity.publishedBy : loads[0].publishedBy;
    const isCreatorCarrier = creator.type === ('currier' || 'carrier');

    let message = '';
    if (loads.length === 1) {
        const target = type !== orderType.capacity ? capacity.publishedBy : loads[0].publishedBy;
        const item = loads[0];
        message = `
        ${isCreatorCarrier ? 'I am interested in hauling this load.' : 'I am interested in hiring this capacity.'} \r\n
    
        Capacity information: \r\n
        \r\n
        Available size: ${capacity.order.availableSize} \r\n
        Used size: ${capacity.order.availableSize} \r\n
        Available weight: ${capacity.order.availableWeight} \r\n
        Flat rate: ${!!capacity.order.flatRate ? Math.round(capacity.order.flatRate) : 'None'} \r\n
        Per mile rate: ${!!capacity.order.perMileRate ? Math.round(capacity.order.perMileRate) : 'None'} \r\n
    
    
        Load information: \r\n
        \r\n
    
        
        Equipment: ${item.order.equipment.name} \r\n
        Size: ${item.order.size} \r\n
        Weight: ${item.order.weight} \r\n
        Distance (Mile): ${Math.round(item.order.distance / 1609)} \r\n
        Flat rate: ${!!item.order.flatRate ? Math.round(item.order.flatRate) : 'None'} \r\n
        Per mile rate: ${!!item.order.perMileRate ? Math.round(item.order.perMileRate) : 'None'} \r\n
        --------------------------------------------------------------------------------------------- 
        \r\n

        Please reply to the email or call the number: Email - ${creator.email}; Phone Number - ${creator.phone || 'None'}; \r\n`
        await Mailer.sendMail(target.email, `Confirmation request from ${creator.name} `, message, undefined, creator.email);
    } else {
        await getDublicatedUserLoads(capacity, creator, isCreatorCarrier, loads);
    }


    return res.send(getResponse(1, 'Request sent.'));
}

async function getDublicatedUserLoads(capacity, creator, isCreatorCarrier, arr) {
    const filteredData = [];
    filteredData.push(arr[0]);
    arr.splice(0, 1);
    await Promise.all(arr.map((x, y) => {
        if (x.publishedBy.userId === filteredData[0].publishedBy.userId) {
            filteredData.push(x);
            arr.splice(y, 1);
        }
    }));
    if (filteredData.length) {
        const target = filteredData[0].publishedBy;
        const message = `
    ${isCreatorCarrier ? 'I am interested in hauling this load.' : 'I am interested in hiring this capacity.'} \r\n

    Capacity information: \r\n
    \r\n
    Available size: ${capacity.order.availableSize} \r\n
    Used size: ${capacity.order.availableSize} \r\n
    Available weight: ${capacity.order.availableWeight} \r\n
    Flat rate: ${!!capacity.order.flatRate ? Math.round(capacity.order.flatRate) : 'None'} \r\n
    Per mile rate: ${!!capacity.order.perMileRate ? Math.round(capacity.order.perMileRate) : 'None'} \r\n


    Load information: \r\n
    \r\n

    ${await Promise.all(filteredData.map(async item => {
            return `
        Equipment: ${item.order.equipment.name} \r\n
        Size: ${item.order.size} \r\n
        Weight: ${item.order.weight} \r\n
        Distance (Mile): ${Math.round(item.order.distance / 1609)} \r\n
        Flat rate: ${!!item.order.flatRate ? Math.round(item.order.flatRate) : 'None'} \r\n
        Per mile rate: ${!!item.order.perMileRate ? Math.round(item.order.perMileRate) : 'None'} \r\n
        --------------------------------------------------------------------------------------------- 
        \r\n`
        }))}
    

    Please reply to the email or call the number: Email - ${creator.email}; Phone Number - ${creator.phone || 'None'}; \r\n`;



        await Mailer.sendMail(target.email, `Confirmation request from ${creator.name} `, message, undefined, creator.email);
    }

    if (arr.length) {
        getDublicatedUserLoads(capacity, creator, isCreatorCarrier, arr);
    }
    return true
};

exports.getAll = async (req, res) => {
    try {
        let page = req.query.page ? Math.max(0, req.query.page * 1) : Math.max(0, 1);
        let perPage = req.query.limit ? req.query.limit * 1 : 10;

        // const userId = req.user.type == 'carrier' || req.user.type == 'courier' ? req.user.id : 0
        let { timezone } = req.headers;
        let minusTime = timezone.split(':')[0];
        let dateNow = moment().format('YYYY-MM-DDTHH:mm:ss.SSS');
        let defaultDate = moment(dateNow).subtract(minusTime, 'hours').format('YYYY-MM-DDTHH:mm:ss.SSS') + "Z";
        let userId = null; // = 0
        if (req.user.type == 'carrier' || req.user.type == 'courier') {
            userId = req.user.id;
        } else if (req.user.type != 'shipper' && req.user.type != 'broker') {
            res.json({
                status: 1,
                msg: 'ok',
                data: {
                    orders: [],
                    total: 0
                }
            });
        }

        // console.log('\n', ' - query: ', req.query, '')
        const filter = await Fillters.getCapFilterObject(req.query, userId);
        // console.log('\n', ' - filter cap: ', filter, '')

        const sort = getSortObject(req.query);
        // console.log('\n', ' - sort cap: ', sort)

        const capacityList = await CapacityBoard.find(
            filter).sort(sort).limit(perPage).skip(perPage * (page - 1));

        capacityList.map(async item => {
            if (!item.loadPriceType || item.order.loadPriceType !== LoadPriceType.flatRate || item.order.loadPriceType !== LoadPriceType.perMileRate) {
                item.order.loadPriceType = LoadPriceType.flatRate;
            }
        });
        let ct = await CapacityBoard.countDocuments(filter);
        const responseData = {
            orders: capacityList,
            total: ct
        };
        return res.send({
            status: 1,
            msg: 'CapacityBoards list.',
            data: responseData
        });
    } catch (error) {
        res.json({ error });
    }
};

exports.getOne = async (req, res) => {
    if (req.user.type != 'carrier' && req.user.type != 'courier' && req.user.type != '') {
        return res.json({
            status: 0,
            msg: 'Unauthorized request'
        });
    }

    try {
        const filter = {
            _id: req.params.id,
        };
        filter['publishedBy.userId'] = parseInt(req.user.id);

        CapacityBoard.findOne(filter)
            .then(async (capacityBoard) => {
                res.json({
                    status: 1,
                    msg: 'ok',
                    data: capacityBoard
                });
            });
    } catch (error) {
        console.log(error);
        res.json({ error });
    }
};

exports.create = async (req, res) => {
    const cbc = new CapacityBoardClass();

    const data = req.body;

    const user = {
        type: req.user.type, // broker, shipper, carrier
        id: req.user.id,
        name: req.user.name,
        username: req.user.username,
        company: req.user.company,
        email: req.user.email,
        phone: req.user.Phone
    };

    const resModel = await cbc.create(data, user);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(200).json(resModel);
};

exports.createForMobile = async (req, res) => {
    const cbc = new CapacityBoardClass();

    const data = req.body;
    const user = {
        type: req.user.type, // broker, shipper, carrier
        id: req.user.id,
        name: req.user.name,
        username: req.user.username,
        company: req.user.company,
        email: req.user.email,
        phone: req.user.Phone
    };

    const resModel = await cbc.createForMobile(data, user);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(200).json(resModel);
};


exports.createAPI = async (req, res) => {
    const cbc = new CapacityBoardClass()

    const data = req.body

    const user = {
        // type: 'carrier', // broker, shipper, carrier
        // id: 1,
        type: req.user.type, // broker, shipper, carrier
        id: req.user.id,
        name: req.user.name,
        username: req.user.username,
        company: req.user.company,
        email: req.user.email,
        phone: req.user.Phone
    };
    const resModel = await cbc.create(data, user);

    res.status(201).send(resModel);
};


exports.edit = async (req, res) => {
    const cbc = new CapacityBoardClass();

    const data = req.body;

    const resModel = await cbc.edit(req.params.id, data);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(200).send(resModel);
};

exports.editForMobile = async (req, res) => {
    const cbc = new CapacityBoardClass();

    const data = req.body;

    const resModel = await cbc.editForMobile(req.params.id, data);
    if (resModel.status == 0) {
        return res.status(409).json(resModel);
    }
    res.status(201).json(resModel);
};

exports.delete = async (req, res) => {
    const cbc = new CapacityBoardClass();
    console.log(req.user, 'aaaaaaaaaaa');
    const result = await cbc.delete([req.params.id], req.user);
    if (result == -1) {
        return res.status(500).send({
            status: 0,
            'msg': 'CapacityBoard delete error'
        });
    }

    res.status(200).send({
        status: 1,
        msg: `Capacity deleted`
    });
};

exports.deleteMobile = async (req, res) => {
    const cbc = new CapacityBoardClass();
    let ids;
    if (Array.isArray(req.body)) {
        ids = req.body;
    } else {
        ids = req.body.split(',');
    }
    const result = await cbc.delete(ids);
    if (result == -1) {
        return res.status(500).send({
            status: 0,
            'msg': 'CapacityBoard delete error'
        });
    }

    res.status(200).send({
        status: 1,
        msg: `Capacity deleted`
    });
};

exports.publishLoads = async (req, res) => {
    // check request
    if (req.user.type !== 'carrier') {
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

        const CapacityBoard = require('../mongoModels/CapacityBoardModel');

        let orderIds = []
        loads.forEach(l => {
            orderIds.push(l.orders)
        })

        orderIds = Helper.splitToIntArray(orderIds.join(','), ',');

        Order.findAll({
            where: {
                id: {
                    [Op.in]: orderIds
                }
            },
            include: [{ all: true, nested: false }],
        }).then(async orders => {

            await loads.forEach(async l => {
                l.isPublic = 1

                const oIds = Helper.splitToIntArray(l.orders, ',');

                const loadOrders = []
                orders.forEach(o => {
                    oIds.forEach(oId => {
                        if (o.id == oId) {
                            loadOrders.push(o)
                        }
                    })
                })
                //console.log(loadOrders)

                // create mongodb model
                let pl = new CapacityBoard({
                    load: {
                        loadId: l.id,
                        flowType: l.flowType,
                        orderIds: l.orders, // [Object], // ?
                        orders: loadOrders, // l.ordersDatas, // [Object], // ? 
                        stops: l.stops,
                        start: setCapacityBoardAddresses(l.start, l.startAddress),
                        end: setCapacityBoardAddresses(l.end, l.endAddress),
                        startTime: l.startTime,
                        endTime: l.endTime,
                        feet: l.feet,
                        weight: l.weight,
                        volume: l.cube, // (cube)
                        pallet: l.pallet,
                        totalDistance: l.totalDistance,
                        totalDuration: l.totalDuration,
                        rate: l.loadCost, // loadCost
                        fuelSurcharge: l.fuelSurcharge,
                        pickupDate: l.pickupDate,
                        deliveryDate: l.deliveryDate,
                        carTypes: l.carTypes
                    },
                    publishedBy: {
                        userType: req.user.type, // broker, shipper, carrier
                        userId: req.user.id,
                        // dbName: String,
                        // phone: String,
                        // contactPerson: String,
                        // email: String
                    },
                })

                console.log('kkk')
                pl.save()

                l.save()
            })

            let loadIds = loads.map(l => {
                return l.id
            })

            console.log('published')

            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: loadIds
            });
        }).catch(err => {
            console.log('eee')
            console.log(err)
            res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
        })
    } catch (err) {
        console.log('bbb')
        console.log(err)
        res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
    }
};

exports.publishOrders = async (req, res) => {
    // check request
    if (req.user.type !== 'carrier') {
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

        const CapacityBoard = require('../mongoModels/CapacityBoardModel');

        let orderIds = []
        loads.forEach(l => {
            orderIds.push(l.orders)
        })

        orderIds = Helper.splitToIntArray(orderIds.join(','), ',');

        Order.findAll({
            where: {
                id: {
                    [Op.in]: orderIds
                }
            },
            include: [{ all: true, nested: false }],
        }).then(async orders => {

            await loads.forEach(async l => {
                l.isPublic = 1

                const oIds = Helper.splitToIntArray(l.orders, ',');

                const loadOrders = []
                orders.forEach(o => {
                    oIds.forEach(oId => {
                        if (o.id == oId) {
                            loadOrders.push(o)
                        }
                    })
                })
                //console.log(loadOrders)

                // create mongodb model
                let pl = new CapacityBoard({
                    load: {
                        loadId: l.id,
                        flowType: l.flowType,
                        orderIds: l.orders, // [Object], // ?
                        orders: loadOrders, // l.ordersDatas, // [Object], // ? 
                        stops: l.stops,
                        start: setCapacityBoardAddresses(l.start, l.startAddress),
                        end: setCapacityBoardAddresses(l.end, l.endAddress),
                        startTime: l.startTime,
                        endTime: l.endTime,
                        feet: l.feet,
                        weight: l.weight,
                        volume: l.cube, // (cube)
                        pallet: l.pallet,
                        totalDistance: l.totalDistance,
                        totalDuration: l.totalDuration,
                        rate: l.loadCost, // loadCost
                        fuelSurcharge: l.fuelSurcharge,
                        pickupDate: l.pickupDate,
                        deliveryDate: l.deliveryDate,
                        carTypes: l.carTypes
                    },
                    publishedBy: {
                        userType: req.user.type, // broker, shipper, carrier
                        userId: req.user.id,
                        // dbName: String,
                        // phone: String,
                        // contactPerson: String,
                        // email: String
                    },
                })

                console.log('kkk')
                pl.save()

                l.save()
            })

            let loadIds = loads.map(l => {
                return l.id
            })

            console.log('published')

            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: loadIds
            });
        }).catch(err => {
            console.log('eee')
            console.log(err)
            res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
        })
    } catch (err) {
        console.log('bbb')
        console.log(err)
        res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
    }
};


function setCapacityBoardAddresses(locStr, addressStr) {
    let addr = {}

    if (locStr) {
        const loc = JSON.parse(locStr);

        addr['lat'] = loc.Lat;
        addr['lon'] = loc.Lon;
    }

    if (addressStr && addressStr != null) {
        const address = addressStr.split(',').map(v => v.trim());
        addr['country'] = address.pop();
        addr['zip'] = address.pop();
        // addr['state'] = '';
        addr['city'] = address.length > 1 ? address.pop() : address[0];
        addr['street'] = address.length > 0 ? address.pop() : address[0];
        addr['addressFull'] = address;
    }

    return addr;
}






exports.getUploadOrdersStatus = async (req, res) => {
    try {
        let url = 'http://192.168.1.109:4774/upload',
            // let url = `${ env.uploadHost } ${ env.uploadPort } /upload`,
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




exports.uploadLoads = async (req, res) => {
    if (!req.user && !req.user.type && !req.user.id) {
        return res.send({
            status: 0,
            msg: 'unknown user'
        });
    }

    console.log(' -- capacities upload started');

    let uploadCl;
    uploadCl = new UploadClass({
        data: {
            type: "CapacityBoard",
            status: 0
        }
    });
    let { data } = await uploadCl.create();
    res.json(getResponse(1, "capacities upload started", { uploadId: data._doc._id }));
    try {

        // console.log(' - headers:', req.body.saveFields, req.user.id, req.body.fileHeaders)
        if (req.body.saveFields != 0 && req.body.fileHeaders && req.user.id) {
            let settings = await Settings.findOne({ userId: req.user.id })
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
            // const settings = await Settings.findOne({ where: { userId: req.user.id } })
            // if(!settings){
            //     await Settings.create({
            //         userId: req.user.id,
            //         fileHeaders: JSON.parse(req.body.fileHeaders)
            //     });
            // }else{
            //     settings.fileHeaders = JSON.parse(req.body.fileHeaders)
            //     await settings.save()
            // }
        }
        let timezone = req.body.timezone;
        const loads = JSON.parse(req.body.changedFile);
        const { uploadedCount, errorsCount } = await saveCapacitiesDAT(loads, req.user, timezone);

        console.log(' -- capacities upload end');
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


async function saveCapacitiesDAT(loads, _user, timezone) {
    let uploadedCount = 0;
    let errorsCount = 0;

    const cbc = new CapacityBoardClass();

    const user = {
        type: _user.type, // broker, shipper, carrier
        id: _user.id,
        name: _user.name,
        username: _user.username,
        company: _user.company,
        email: _user.email,
        phone: _user.Phone
    };

    for (let i = 0; i < loads.length; i++) {
        const l = loads[i];

        const data = {
            pickupdateFrom: l.pickupdateFrom,
            pickupdateTo: l.pickupdateTo,
            equipmentCode: l.Equipment,
            fromCityState: l.pickupCity,
            toCityState: l.deliveryCity,
            deliveryCompany: l.deliveryCompanyName,
            notes: `${l.deliveryCompanyName} ${l.Contact}`,
            size: l.Size,
            weight: l.Weight
        };

        const cb = await cbc.createUploadDAT(data, user, timezone);
        if (typeof cb == 'string') {
            // console.log('- save error: ', cb, data)
            errorsCount++;
        } else {
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

    let fileArr = []
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
            })
        }
    }

    return fileArr
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
const { order } = require('../config/db.config.js');
const { filter, some } = require('all-the-cities');

function bufferToStream(buffer) {
    var stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
}

async function storeLoadInDB(r, _user, eqId) {
    // console.log('\n -- ', r)

    const cbc = new CapacityBoardClass()

    // const data = r // req.body

    const data = {
        "orders": [{
            "isPrivate": r.isPrivate,
            "deliveryCompanyName": r.deliveryCompanyName,
            "pickupCompanyName": r.pickupCompanyName,
            "eqId": eqId,
            "products": [{
                // "Size" : r.Size,
                // "Weight" : r.Weight,

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
    const resModel = await cbc.create(data, user)

    return resModel
}






// ############
// for engine


exports.ordersForEngine = async (req, res) => {
    try {
        let dateRange = req.query.dateRange;
        let timezone = req.query.timezone;
        let date = Helper.getFlatbedDatesFromEndFormatted(req.query.date, timezone, dateRange);
        // console.log('-- date: ', date)

        // date = {
        //     from: new Date(date.from.replace('T', ' ')),
        //     to: new Date(date.to.replace('T', ' '))
        // };
        // console.log('-- date: ', date)

        const userId = req.query.userId ? req.query.userId : null;
        const maxCount = req.query.maxCount ? parseInt(req.query.maxCount) : 400

        // get capacity boards
        const capacityBoards = await CapacityBoard.find({
            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lt: date.to
            },
            "publishedBy.userId": userId,
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        }).limit(maxCount); // .sort('_id')

        // get loadboard filter
        const loadBoards = await LoadBoard.find({
            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lt: date.to
            },
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        });

        // combine
        let idIndex = 1;

        // create post data
        const orders = [];

        capacityBoards.forEach(cb => {
            // console.log(cb.number)
            if (!cb.order.end) {
                return;
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
            });
        });

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
            });
        });

        const data = {
            status: 1,
            msg: "ok",
            data: {
                orders: orders,
                count: orders.length
            }
        }

        // response
        return res.status(200).json(data)
    } catch (ex) {
        res.json({ ex });
    }
}

exports.ordersForEngineByCapIds = async (req, res) => {
    try {
        let dateRange = req.query.dateRange;
        let timezone = req.query.timezone;
        let date = Helper.getFlatbedDatesFromEndFormatted(req.query.date, timezone, dateRange);
        // console.log('-- date: ', date)

        // date = {
        //     from: new Date(date.from.replace('T', ' ')),
        //     to: new Date(date.to.replace('T', ' '))
        // };
        // console.log('-- date: ', date)

        const userId = req.query.userId ? req.query.userId : null;
        const maxCount = req.query.maxCount ? parseInt(req.query.maxCount) : 400

        // get capacity boards
        const capacityBoards = await CapacityBoard.find({
            "_id": { $in: req.params.capIds.split(',') },

            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lt: date.to // $lte: date.to
            },
            "publishedBy.userId": userId,
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        }).limit(maxCount); //.sort('_id');

        // get loadboard filter
        const loadBoards = await LoadBoard.find({
            "order.start.timeWindowFrom": {
                $gte: date.from,
                $lt: date.to // $lte: date.to
            },
            "order.end": { $exists: true },
            "order.end.timeWindowFrom": { $exists: true }
        });

        let idIndex = 1

        // create post data
        const orders = [];
        capacityBoards.forEach(cb => {
            // console.log(cb.number)
            if (!cb.order.end) {
                return;
            }
            orders.push({
                "id": idIndex++, // cb.number, // cb._id,
                "sid": `cap__${cb._id}`,
                "ssid": cb._id,
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
            });
        });

        loadBoards.forEach(lb => {
            // console.log(' lb', lb)
            orders.push({
                "id": idIndex++, // lb.number, // lb._id,
                "sid": `load__${lb._id}`,
                "ssid": lb._id,
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
            });
        });

        const data = {
            status: 1,
            msg: "ok",
            data: {
                orders: orders,
                count: orders.length
            }
        };

        // response
        return res.status(200).json(data);
    } catch (ex) {
        res.json({ ex });
    }
};
