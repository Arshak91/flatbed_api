const moment = require('moment');
const fs = require('fs');
const mime = require('mime');
const path = require('path');
const axios = require('axios');
const request = require('request');
const db = require('../config/db.config.js');
const Osmap = require('./osmap.controller');
const osrm = require('../controller/osmap.controller');
const { createLoadFn } = require('./loads.controller');
const { creatTempLoadsfromOrder } = require('./load_temps.controller');
const Helpers = require('../classes/helpers');
const Calculations = require('../classes/calculations');
const Errors = require('../errors/orderErrors');
const Warnings = require('../warnings/orderWarnings');
const LoadTemp_Controller = require('../controller/load_temps.controller');
const Load_Controller = require('../controller/loads.controller');
const ClassApiKey = require('../mongoClasses/apiKey');
const UploadClass = require('../classes/uploads');
const Consignee = require('../controller/consignees.controller');
const uuidv1 = require('uuid/v1');
const env = process.env.SERVER == 'local' ? require('../config/env.local') : require('../config/env');

// const seq = db.sequelize;
const Op = db.Sequelize.Op;
const Order = db.order;
const HandlingUnit = db.handlingUnit;
const Images = db.image;
const Items = db.item;
const seq = db.sequelize;
const pieceType = db.piecetypes;
const freightClass = db.freightclasses;
const Load = db.load;
const LoadTemp = db.loadTemp;
const Status = db.status;
const Consignees = db.consignee;
const Vendors = db.vendors;
const Settings = db.settings;
const Depo = db.depo;
const Sequelize = db.Sequelize;
const sequelize = db.sequelize;
const includeTrue = [{ all: true, nested: true }];
const includeFalse = [{ all: true, nested: false }];
const allowedExtensions = [
    'image/apng',
    'image/bmp',
    'image/gif',
    'image/x-icon',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/svg+xml',
    'image/webp'
];

const AutoplanAttributes = [
    'orders.id',
    'orders.feet',
    'orders.weight',
    'orders.cube',
    'orders.flowType',
    'orders.deliveryLat',
    'orders.deliveryLon',
    'orders.pickupLat',
    'orders.pickupLon',
    'orders.deliverydateFrom',
    'orders.deliverydateTo', 
    'orders.pickupdateFrom',
    'orders.pickupdateTo', 
    'orders.servicetime',
    'orders.eta',
    'orders.ata',
    'consignees.driverId as driverId'
];

// methods
const saveHandlingUnits = async (units, orderId, req) => {
    const handlingUnit = [];
    const Images = [];
    if (!units.length) return [];
    for (const unit of units) {        
        const unitSaved = await saveHandlingUnit(unit, orderId);
        handlingUnit.push(unitSaved);
        let saveImages;
        if (unit.images && unit.images.length) {
            saveImages = await saveHandlingUnitsImages(unit.images, unitSaved.id, req);
            Images.push(saveImages);
        }
        if (unit.id) {
            if (unit.removedImages && unit.removedImages.length) {
                await removeHandlingUnitImages(unit.removedImages, unit.id);
            }
        }
    }
    return {
        'handlingUnit': handlingUnit,
        Images
    };
};
  
const saveHandlingUnit = async (data, orderId) => {
    let handling, volume, piece, where;
    if (data.volume) {
        volume = data.volume;
    } else {
        if (!data.sku) {
            if (data.piecetype_id || (data.piecetype_id && data.freightclasses_id)) {
                if (data.freightclasses_id) {
                    where = {
                        id: data.piecetype_id,
                        freightclasses_id: data.freightclasses_id
                    };
                } else {
                    where = {
                        id: data.piecetype_id,
                    };
                }
                piece = await pieceType.findOne({
                    where
                });
                volume = data.Weight/piece.density;
            } else if (data.Length && data.Width && data.Height) {
                volume = data.Length * data.Width * data.Height;
            } else {
                volume = null;
            }
        } else {
            if (data.piecetype_id) {
                piece = await pieceType.findOne({
                    where: {
                        id: data.piecetype_id
                    }
                });
                volume = data.Weight/piece.density;
            } else {
                volume = null;
            }
        }
    }
    // console.log('here', orderId);
    
    if (data.id) {
        await HandlingUnit.update({
            HandlingType_id: data.HandlingType_id,
            Quantity: data.Quantity ? data.Quantity : 1,
            piecetype_id: data.piecetype_id ? data.piecetype_id : 0,
            sku: data.sku ? data.sku : 0,
            brand: data.brand ? data.brand : 0,
            specialneeds: data.specialneeds ? data.specialneeds : 0,
            productdescription: data.productdescription,
            freightclasses_id: data.freightclasses_id ? data.freightclasses_id : null, // ?
            nmfcnumber: data.nmfcnumber, // ?
            nmfcsubcode: data.nmfcsubcode, // ?
            Weight: data.Weight ? data.Weight : 0,
            Length: data.Length ? data.Length : 0,
            Width: data.Width ? data.Width : 0,
            Height: data.Height ? data.Height : 0,
            mintemperature: data.mintemperature ? data.mintemperature : 0,
            maxtemperature: data.maxtemperature ? data.maxtemperature : 0,
            stackable: data.stackable,
            turnable: data.turnable,
            density: piece ? piece.density : null,
            volume: volume,
            orders_id: orderId
        }, { where: { id: data.id}});
        handling = await HandlingUnit.findOne({ where: {id: data.id}});
    } else {
        handling = await HandlingUnit.create({
            HandlingType_id: data.HandlingType_id,
            Quantity: data.Quantity,
            piecetype_id: data.piecetype_id ? data.piecetype_id : 0,
            sku: data.sku ? data.sku : 0,
            brand: data.brand ? data.brand : 0,
            specialneeds: data.specialneeds ? data.specialneeds : 0,
            productdescription: data.productdescription,
            freightclasses_id: data.freightclasses_id, // ?
            nmfcnumber: data.nmfcnumber, // ?
            nmfcsubcode: data.nmfcsubcode, // ?
            Weight: data.Weight ? data.Weight : 0,
            Length: data.Length ? data.Length : 0,
            Width: data.Width ? data.Width : 0,
            Height: data.Height ? data.Height : 0,
            mintemperature: data.mintemperature ? data.mintemperature : 0,
            maxtemperature: data.maxtemperature ? data.maxtemperature : 0,
            stackable: data.stackable,
            turnable: data.turnable,
            density: piece ? piece.density : null,
            volume: volume,
            orders_id: orderId
        }).catch(err => {
            console.log('handling Err', err);
        });
    }
    return handling.dataValues;
};
  
const saveHandlingUnitsImages = async (images, unitId, req) => {
    let error, msg;
    for (const [i, image] of images.entries()) {
        let matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/),
        response = {};
        
        if (matches.length !== 3) {
            return {
                msg: "file is invalid",
                status: 0
            };
        }
        response.type = matches[1];
        response.data = Buffer.from(matches[2], 'base64');
        let decodedImg = response;
        let imageBuffer = decodedImg.data;
        let type = decodedImg.type;
        let extension = mime.getExtension(type);
        let fileName = `image${i}_${Date.now()}.` + extension;
        let path = "./resources/0/images/";
        if (!fs.existsSync(path)){
            fs.mkdirSync(path, { recursive: true });
        }
        if (allowedExtensions.includes(type)) {
            try {
                console.log(`Action: Save Image -> File Path: ${path}${fileName} , File Name: ${fileName}`);
                let getInfo = await Helpers.getRemoteInfo(req);
                let { urls } = await Helpers.getOrderImagePath('images', fileName, getInfo.host);
                console.log(urls.Path);
                
                fs.writeFileSync(`${path}${fileName}`, imageBuffer, 'utf8');
                await Images.create({
                    image_url: urls.Path,
                    HandlingUnits_id: unitId,
                    filename: fileName
                });
                error = false;
                msg = "image uploaded";
            } catch (e) {
                error = true;
                msg = e;
            }
        } else {
            error = true;
            msg = "image mimeType is invalid";
        }
        
    }
    if (!error) {
        return {
            msg,
            status: 1
        };
    } else {
        return {
            msg,
            status: 0
        };
    }
};

const removeHandlingUnitImages = async (imageIds, unitId) => {
    const images = await Images.findAll({
        where: {
            HandlingUnits_id: unitId
        }
    });
    if (images) {
        for (const image of images) {
            if (imageIds.includes(image.id)) {
                let filePath = `./resources/0/images/${image.filename}`;
                await Images.destroy({
                    where: {
                        id: image.id
                    }
                });
                console.log(`Action: Remove ->  Image Path: ${filePath}`);
                fs.unlinkSync(filePath);
            }
        }
        return {
            status: 1,
            msg: "Image successfully deleted"
        };
    } else {
        return {
            status: 0,
            msg: "such images doesn't exist"
        };
    }
    

};

const removeHandlingUnits = async (handlingUnitIds) => {
    let imageIds = [], images = [], product = [];
    for (const handlingUnitId of handlingUnitIds) {
        let images = await Images.findAll({
            where: {
                HandlingUnits_id: handlingUnitId
            }
        });
        if (images) {
            images.forEach(image => {
                imageIds.push(image.id*1);
            });
        }
        images.push(await removeHandlingUnitImages(imageIds, handlingUnitId));
    }
    await HandlingUnit.destroy({
        where: {
            id: {
                [Op.in]: handlingUnitIds
            }
        }
    });
    return {
        images,
        product
    };
};

const saveItems = async (items, unit_id) => {
    let saveItem;
    for (const item of items) {
        saveItem = await saveHandlingUnitItem(item, unit_id);
    }
    return saveItem;
};
  
const saveHandlingUnitItem = async (item, unit_id) => {
    
    let piece, freight;
    if (item.piecetype_id) {
        piece = await pieceType.findOne({
            where: {
                id: item.piecetype_id
            }
        });
    }
    if (item.freightclasses_id) {
        freight = await freightClass.findOne({
            where: {
                id: item.freightclasses_id
            }
        });
    }
    let Item;
    if (item.sku) {
        // const Sku = await sku.findOne({
        //     where: {
        //         id: item.sku
        //     }
        // });
        // if (item.Weight) {
        //     item.volume = item.Weight/piece.density;
        // } else {
        //     item.volume = Sku.weight/piece.density;
        // }
        if (item.id) {
            await Items.update({
                ...item,
                Handling_Unit_id: unit_id
            }, {
                where: {
                    id: item.id
                }
            });
            Item = await Items.findOne({where: {id: item.id}});
        } else {
            Item = await Items.create({
                ...item,
                Handling_Unit_id: unit_id
            });
        }
        
    } else {
        if (freight) {
            if (piece) {
                item.volume = item.Weight/piece.density;
            }
        } else if (!item.freightclasses_id && piece) {
            item.volume = item.Weight/piece.density;
        } else {
            item.volume = item.Length * item.Width * item.Height;
        }
        item.Handling_Unit_id = unit_id;
        item.density = piece.density;
        
        if (item.id) {
            await Items.update(item, {
                where: {
                    id: item.id
                }
            });
            Item = await Items.findOne({where: {id: item.id}});
        } else {
            Item = await Items.create(item);
        }
    }
    return Item;
};
  
const removeHandlingUnitItems = (savedItems, unit_id) => {
  let condition = { where: { Handling_Unit_id: unit_id } };
  if (savedItems && savedItems.length) {
    condition = {
      where: {
        Handling_Unit_id: unit_id,
        [Op.and]:{id: {[Op.notIn]:savedItems.map(it => it.id)}}
      }
    };
  }
  return Items.destroy(condition);
};
  
const cleanImages = removed => {
  if (!removed.length) return Promise.resolve([]);
  return Images.destroy({ where : seq.or({ id : removed.map(img => img.id) }) });
};
  
// Common
  function getTotals(Handling_Units, type )
{

    let total = 1000;
    return total;
  }

  function getDateParam(date) {
    if (date) {
        return date;
    }
    var now = new Date();

    var month = now.getMonth() + 1;
    month = month >= 10 ? month : '0' + month;

    var day = now.getDate();
    day = day >= 10 ? day : '0' + day;

    date = now.getFullYear() + '-' + month + '-' + day;

    return date;
  }

  function findAll(where, res) {
    Order.findAll({
            where: where
        })
        .then(orders => {
            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: orders
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access orders table',
                'error': err
            });
        });
  }


exports.getall = async (req, res) => {
    try {
        // let bool = true;
        const sortAndPagiantion = await Helpers.sortAndPagination(req);
        const where = req.query;
        const data = await Helpers.filters(where, Op, 'order');
        let orders;
        // console.log("filters:",data);
        if (data.bool) {
            orders = await Order.findAndCountAll({
                where: data.where,
                include: includeFalse,
                distinct: true,
                ...sortAndPagiantion
            });
            console.log('-- orders done --');
            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: {
                    orders: orders.rows,
                    total: orders.count
                }
            });
        } else {
            res.status(200).send({
                status: 1,
                msg: 'fillter incorrect',
                data: {
                    orders: [],
                    total: 0
                }
            });
        }

    } catch (err) {
        console.log(' -- orders all -- ', err)
        res.status(500).send({
            'description': 'Can not access orders table',
            'error': err
        });
    }

};

exports.get = (req, res) => {
    var id = req.params.id;

    Order.findOne({
            where: {
                id: id
            },
              include: includeTrue //  [{ all: true, nested: false, include: [{ all: true, nested: false }] }]
        })
        .then(order => {
            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: order
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access orders table',
                'error': err.msg
            });
        });
};

exports.create = async (req, res) => {
    // console.log(req.body);
    //  type --> feet, weight, volume
    // let totalfeet = getTotals(req.body.handlingUnits, type);
    // let totalweight;
    // let totalvolume;
    try {
        const errors = await Errors.createOrderError(req.body.orders);
        if (errors.error) {
            res.status(409).json({
                status: errors.error,
                msg: errors.msg
            });
        } else {
            let apikey = req.headers['x-api-key'], key, userId, id;
            if (apikey) {
                key = new ClassApiKey({data: {apikey}});
                userId = await key.getBy({
                    Key: apikey
                });
            }
            if(req.user) {
                id = req.user.id;
            } else if (userId) {
                id = userId.key.userId;
            }
            let createdOrders = [], errorArr = [];
            let warning, message, warningArray = [];
            const settings = await Settings.findOne({
                where: {
                    userId: id
                }
            });
            let i = 0, upload = false;
            if (req.body.Automated) {
                upload = true;
            }
            for (const order of req.body.orders) {
                // let poOrder;
                // poOrder = await Order.findAndCountAll({ where: {po: order.po }});
                
                let pickupLatLon = {
                    lat: 0,
                    lon: 0
                }, deliveryLatLon = {
                    lat: 0,
                    lon: 0
                };
                let LatLons;
                let points = [], cons, consignee;
                cons = order.consigneeName ? await Helpers.getOne({
                    key: 'name',
                    value: order.consigneeName.toLowerCase(),
                    table: Consignees
                }) : null;
                if (!order.deliveryZip || !order.deliveryCity || !order.deliveryStreetAddress || !order.deliveryState ) {
                    errorArr.push({
                        po: order.po,
                        status: 0,
                        msg: "invalid delivery address"
                    });
                }
                if (!order.deliveryLat && !order.deliveryLon && !cons && upload) {
                    LatLons = await Helpers.orderLatLon({
                        pickupAddr: !order.pickupLat && !order.pickupLon ? `${order.pickupZip}+${order.pickupCity}+${order.pickupStreetAddress}+${order.pickupState}` : null,
                        deliveryAddr: !order.deliveryLat && !order.deliveryLon ? `${order.deliveryZip}+${order.deliveryCity}+${order.deliveryStreetAddress}+${order.deliveryState}` : null
                    });
                    points.push({
                        address: {
                            lat: LatLons.deliveryLatLon.data.results[0].geometry.location.lat,
                            lon: LatLons.deliveryLatLon.data.results[0].geometry.location.lng,
                            zip: order.deliveryZip,
                            city: order.deliveryCity,
                            state: order.deliveryState,
                            country: order.deliveryCountry,
                            countryCode: order.deliveryCountryCode,
                            streetAddress: order.deliveryStreetAddress
                        }
                    });
                    consignee = await Consignee.createInTimeOrderCreate({
                        name: order.consigneeName,
                        companyLegalName: order.deliveryCompanyName,
                        serviceTime: order.serviceTime ? order.serviceTime : 0,
                        points: points

                    });
                    // console.log('-----', consignee);
                } else if (!order.deliveryLat && !order.deliveryLon && !cons && !upload) {
                    LatLons = await Helpers.orderLatLon({
                        pickupAddr: !order.pickupLat && !order.pickupLon ? `${order.pickupZip}+${order.pickupCity}+${order.pickupStreetAddress}+${order.pickupState}` : null,
                        deliveryAddr: !order.deliveryLat && !order.deliveryLon ? `${order.deliveryZip}+${order.deliveryCity}+${order.deliveryStreetAddress}+${order.deliveryState}` : null
                    });
                    points.push({
                        address: {
                            lat: LatLons.deliveryLatLon.data.results[0].geometry.location.lat,
                            lon: LatLons.deliveryLatLon.data.results[0].geometry.location.lng,
                            zip: order.deliveryZip,
                            city: order.deliveryCity,
                            state: order.deliveryState,
                            country: order.deliveryCountry,
                            countryCode: order.deliveryCountryCode,
                            streetAddress: order.deliveryStreetAddress
                        }
                    });
                    consignee = await Consignee.createInTimeOrderCreate({
                        name: order.consigneeName,
                        companyLegalName: order.deliveryCompanyName,
                        serviceTime: order.serviceTime ? order.serviceTime : 0,
                        points: points

                    });
                } else if (!order.deliveryLat && !order.deliveryLon && cons) {
                    for (const point of cons.dataValues.points) {
                        if (point.address.zip == order.deliveryZip && point.address.city == order.deliveryCity && point.address.state == order.deliveryState && point.address.country == order.deliveryCountry && point.address.countryCode == order.deliveryCountryCode && point.address.streetAddress == order.deliveryStreetAddress) {
                            order.deliveryLon = point.address.lon;
                            order.deliveryLat = point.address.lat;
                        }
                    }
                }
                // console.log(LatLons);
                if (order.pickupLon && order.pickupLat) {
                    pickupLatLon.lat = order.pickupLat;
                    pickupLatLon.lon = order.pickupLon;
                } else {
                    pickupLatLon.lat = LatLons.pickupLatLon.data.results[0].geometry.location.lat;
                    pickupLatLon.lon = LatLons.pickupLatLon.data.results[0].geometry.location.lng;
                }
                if (order.deliveryLon && order.deliveryLat) {
                    deliveryLatLon.lat = order.deliveryLat;
                    deliveryLatLon.lon = order.deliveryLon;
                } else {
                    deliveryLatLon.lat = LatLons.deliveryLatLon.data.results[0].geometry.location.lat;
                    deliveryLatLon.lon = LatLons.deliveryLatLon.data.results[0].geometry.location.lng;
                }
                
                // console.log(LatLons.pickupLatLon.data.results[0].geometry.location);
                // console.log(LatLons.deliveryLatLon.data.results[0].geometry.location);
                let consignees;
                if (order.consigneeId) {
                    consignees = await Consignees.findOne({
                        where: {
                            id: order.consigneeId
                        }
                    });
                } else if (upload) {
                    consignees = consignee.data;
                }
                //  = order.consigneeId ?  : null;
                let vendors = order.vendorId ? await Vendors.findOne({
                    where: {
                        id: order.vendorId
                    }
                }) : null;
                warning = false, message = "ok";
                const { distDur, msg, status } = await Warnings.createOrder({
                    pickupLat: pickupLatLon.lat,
                    pickupLon: pickupLatLon.lon,
                    deliveryLat: deliveryLatLon.lat,
                    deliveryLon: deliveryLatLon.lon
                });
                if (!status) {
                    warning = true,
                    message = msg;
                }

                if (order.products && order.products.length) {
                    let newOrder = await Order.create({
                        // Load type
                        loadtype: order.loadtype ? order.loadtype : 0,
                        // load_id: order.load_id,

                        flowType: order.flowType,
                        depoid: order.depoid,

                        // Pickup
                        pickupCompanyName: order.pickupCompanyName,
                        pickupState: order.pickupState,
                        pickupStreetAddress: order.pickupStreetAddress,
                        pickupLocationtypeid: order.pickupLocationtype,
                        // --
                        pickupCountry: order.pickupCountry,
                        pickupCountryCode: order.pickupCountryCode,
                        pickupCity: order.pickupCity,
                        pickupZip: order.pickupZip,
                        pickupAccessorials: order.pickupAccessorials,
                        // --
                        pickupdateFrom: new Date(order.pickupdateFrom),
                        pickupdateTo: new Date(order.pickupdateTo),
                        // --
                        pickupLon: pickupLatLon.lon,
                        pickupLat: pickupLatLon.lat,

                        vendorid: order.vendorId ? order.vendorId : 0,
                        consigneeid: consignees ? consignees.dataValues.id : 0,
                        // Delivery
                        deliveryCompanyName: order.deliveryCompanyName,
                        deliveryState: order.deliveryState,
                        deliveryStreetAddress: order.deliveryStreetAddress,
                        deliveryLocationtypeid: order.deliveryLocationtype,
                        // --
                        deliveryCountry: order.deliveryCountry,
                        deliveryCountryCode: order.deliveryCountryCode,
                        deliveryCity: order.deliveryCity,
                        deliveryZip: order.deliveryZip,
                        deliveryAccessorials: order.deliveryAccessorials,
                        // --
                        deliverydateFrom: new Date(order.deliverydateFrom),
                        deliverydateTo: new Date(order.deliverydateTo),
                        // --
                        deliveryLon: deliveryLatLon.lon,
                        deliveryLat: deliveryLatLon.lat,
            
                        // Equipment Type
                        eqType: order.eqType,
            
                        // References
                        bol: order.bol,
                        pro: order.pro,
                        po: order.po,
            
                        // Rating
                        currency: order.currency,
                        rate: order.rate,
            
                        // Notes
                        notes: order.notes,
            
                        //// Statuses
                        isPlanned: 0,
                        confirmed: 0,
                        status: 0,  // order.status,
                        statusInternal: 1,
                        isfreezed: 0,
            
                        //// Dimentions
                        pallet: null,
            
                        // Other
                        companyid: 0, // order.companyid ,
                        carrierid: 0, // order.carrierid ,
                        customerid: 0, // order.customerid ,
            
                        //// Other
                        // servicetime: 900,
                        custDistance: status ? distDur.distance : 0,
                        custDuration: status ? distDur.duration : 0,
                        bh: order.bh,
                        delivery: `${order.deliveryStreetAddress}, ${order.deliveryCity}, ${order.deliveryState} ${order.deliveryZip}, ${order.deliveryCountry}`,
                        pickup: `${order.pickupStreetAddress}, ${order.pickupCity}, ${order.pickupState} ${order.pickupZip}, ${order.pickupCountry}`,
                        loadTempIds: [],
                        loadIds: [],
                        flowTypes: [],
                        timeInfo: {
                            loadTemps: {},
                            loads: {},
                            loadsArr: []
                        },
                        pieceCount: order.pieceCount ? order.pieceCount : 0,
                    });
                    // .then(async newOrder => {
                            if (!status) {
                                warningArray.push({
                                    warning,
                                    orderId: newOrder.id,
                                    message
                                });
                            }
                            let handlingUnits = await saveHandlingUnits(order.products, newOrder.id, req);
                            const orderTypes = {
                                stackable: 0,
                                turnable: 0,
                                hazmat: 0
                            };
                            if (!handlingUnits.handlingUnit) {
                                console.log('error Handling', newOrder.id, );
                                res.status(500).json({ status: 0, msg: 'handling error'});
                            }
                            let cube = 0, feet = 0, weight = 0, specialneeds = [], quantity = 0;
                            for (const item of handlingUnits.handlingUnit) {
                                if (item.stackable) orderTypes.stackable = 1;
                                if (item.turnable) orderTypes.turnable = 1;
                                if (item.hazmat) orderTypes.hazmat = 1;
                                if (item.Length && item.Width && item.Height) {
                                    let val = item.Length * item.Width * item.Height;
                                    cube += (val*item.Quantity);
                                } else if (item.volume > 0) {
                                    cube += (item.volume*item.Quantity);
                                }
                                feet += item.Length ? (item.Length*item.Quantity) : 0;
                                
                                weight += item.Weight && item.Quantity ? (item.Weight * item.Quantity) : 0;
                                quantity += item.Quantity;
                                specialneeds.push({
                                    id: item.id,
                                    specialneeds: item.specialneeds
                                });
                            }
                            let servicetime = 0, pieceTime = 0;
                            if (order.flowType == 1) {
                                servicetime = order.serviceTime ? order.serviceTime 
                                    : vendors ? vendors.serviceTime 
                                    : settings ? settings.defaultServiceTime : 0;
                            } else if (order.flowType == 2) {
                                if (order.serviceTime) {
                                    servicetime = order.serviceTime;
                                } else if(consignees) {
                                    if (consignees.serviceTime) {
                                        servicetime = consignees.dataValues.serviceTime;
                                    } else {
                                        if (settings) {
                                            servicetime = settings.defaultServiceTime;
                                        }
                                    }
                                } else {
                                    if (settings) {
                                        servicetime = settings.dataValues.defaultServiceTime;
                                    }
                                }
                                if (order.pieceTime) {
                                    pieceTime = order.pieceTime;
                                } else {
                                    if (settings) {
                                        pieceTime = settings.dataValues.pieceTime ? settings.dataValues.pieceTime : 0;
                                    }
                                }
                            } else if (order.flowType == 3) {
                                servicetime = order.serviceTime ? order.serviceTime
                                    : settings ? settings.defaultServiceTime : 0;
                            }
                            // servicetime = parseInt(servicetime, 10);
                            await Order.update({
                                orderTypes: orderTypes,
                                cube: cube,
                                feet: feet,
                                pieceCount: quantity,
                                weight: weight,
                                specialneeds: specialneeds,
                                servicetime: servicetime + (pieceTime * order.pieceCount),
                                pieceTime: pieceTime
                            },{
                                where: {
                                    id: newOrder.id
                                }
                            }).catch(err => {
                                console.log('catch!!!!!', err.message);
                            });
                            const updateOrder = await Order.findOne({
                                where: {
                                    id: newOrder.id
                                }
                            });
                            if (newOrder.loadtype && newOrder.loadtype == "2" && order.createLoad) {
                                
                                const loadTemp = await creatTempLoadsfromOrder(newOrder);
                                createdOrders.push({
                                    ...updateOrder.dataValues,
                                    'products': handlingUnits.handlingUnit,
                                    loadTemp
                                });
                            } else {
                                createdOrders.push({
                                    ...updateOrder.dataValues,
                                    'products': handlingUnits.handlingUnit
                                });
                            }
                        // }).catch(err => {
                        //     console.log('55555', err.message);
                        //     errorArr.push({ status: 0, msg: err.message, err: err, data: order });
                        // });
                } else {
                    errorArr.push({
                        status: 0,
                        msg: "Add products to the order."
                    });
                }
            }
            // console.log('error Arr', errorArr);
            res.status(200).json({
                status: 1,
                warnings: warningArray,
                warning: warningArray.length ? true : false,
                msg: 'Order created',
                data: createdOrders,
                errors: errorArr,
                error: errorArr.length ? true : false,
            });
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ status: 0, msg: error.message});
    }
};

exports.edit = async (req, res) => {
    try {
        let orders = [], upload = false;
        if (req.body.Automated) {
            upload = true;
        }
        orders.push(req.body);
        const errors = await Errors.createOrderError(orders);
        if (errors.error) {
            // console.log('error ----- here');
            res.status(409).json({
                status: errors.error,
                msg: errors.msg
            });
        } else {
            let pickupLatLon = {
                lat: 0,
                lon: 0
            }, deliveryLatLon = {
                lat: 0,
                lon: 0
            };
            let points = [], cons, consignee;
            cons = req.body.consigneeName ? await Helpers.getOne({
                key: 'name',
                value: req.body.consigneeName,
                table: Consignees
            }) : null;
            let LatLons, userId, userKeyData;
            if (!req.body.deliveryLat && !req.body.deliveryLon && !cons && upload) {
                LatLons = await Helpers.orderLatLon({
                    pickupAddr: !req.body.pickupLat && !req.body.pickupLon ? `${req.body.pickupZip}+${req.body.pickupCity}+${req.body.pickupStreetAddress}+${req.body.pickupState}` : null,
                    deliveryAddr: !req.body.deliveryLat && !req.body.deliveryLon ? `${req.body.deliveryZip}+${req.body.deliveryCity}+${req.body.deliveryStreetAddress}+${req.body.deliveryState}` : null
                });
                points.push({
                    address: {
                        lat: LatLons.deliveryLatLon.data.results[0].geometry.location.lat,
                        lon: LatLons.deliveryLatLon.data.results[0].geometry.location.lng,
                        zip: req.body.deliveryZip,
                        city: req.body.deliveryCity,
                        state: req.body.deliveryState,
                        country: req.body.deliveryCountry,
                        countryCode: req.body.deliveryCountryCode,
                        streetAddress: req.body.deliveryStreetAddress
                    }
                });
                consignee = await Consignee.createInTimeOrderCreate({
                    name: req.body.consigneeName,
                    companyLegalName: req.body.deliveryCompanyName,
                    serviceTime: req.body.serviceTime ? req.body.serviceTime : 0,
                    points: points

                });
                // console.log('-----', consignee);
            } else if (!req.body.deliveryLat && !req.body.deliveryLon && !cons && !upload) {
                LatLons = await Helpers.orderLatLon({
                    pickupAddr: !req.body.pickupLat && !req.body.pickupLon ? `${req.body.pickupZip}+${req.body.pickupCity}+${req.body.pickupStreetAddress}+${req.body.pickupState}` : null,
                    deliveryAddr: !req.body.deliveryLat && !req.body.deliveryLon ? `${req.body.deliveryZip}+${req.body.deliveryCity}+${req.body.deliveryStreetAddress}+${req.body.deliveryState}` : null
                });
            } else if (!req.body.deliveryLat && !req.body.deliveryLon && cons) {
                for (const point of cons.dataValues.points) {
                    if (point.address.zip == req.body.deliveryZip && point.address.city == req.body.deliveryCity && point.address.state == req.body.deliveryState && point.address.country == req.body.deliveryCountry && point.address.countryCode == req.body.deliveryCountryCode && point.address.streetAddress == req.body.deliveryStreetAddress) {
                        req.body.deliveryLon = point.address.lon;
                        req.body.deliveryLat = point.address.lat;
                    }
                }
            }
            if (req.body.pickupLon && req.body.pickupLat) {
                pickupLatLon.lat = req.body.pickupLat;
                pickupLatLon.lon = req.body.pickupLon;
            } else {
                pickupLatLon.lat = LatLons.pickupLatLon.data.results[0].geometry.location.lat;
                pickupLatLon.lon = LatLons.pickupLatLon.data.results[0].geometry.location.lng;
            }
            if (req.body.deliveryLon && req.body.deliveryLat) {
                deliveryLatLon.lat = req.body.deliveryLat;
                deliveryLatLon.lon = req.body.deliveryLon;
            } else {
                deliveryLatLon.lat = LatLons.deliveryLatLon.data.results[0].geometry.location.lat;
                deliveryLatLon.lon = LatLons.deliveryLatLon.data.results[0].geometry.location.lng;
            }
            // deliveryLatLon.lat = LatLons.deliveryLatLon.data.results[0].geometry.location.lat;
            // deliveryLatLon.lon = LatLons.deliveryLatLon.data.results[0].geometry.location.lng;
            // pickupLatLon.lat = LatLons.pickupLatLon.data.results[0].geometry.location.lat;
            // pickupLatLon.lon = LatLons.pickupLatLon.data.results[0].geometry.location.lng;
            let apikey = req.headers['x-api-key'], key;
            if (apikey) {
                key = new ClassApiKey({data: {apikey}});
                userKeyData = await key.getBy({
                    Key: apikey
                });
            }
            if(req.user) {
                userId = req.user.id;
            } else if (userKeyData) {
                userId = userKeyData.key.userId;
            }
            let settings, id, orderObj,
                consignees, vendors, warning, message;
            //
            settings = await Settings.findOne({
                where: {
                    userId: userId
                }
            });
            // consignee = req.body.consigneeId ? await Consignees.findOne({
            //     where: {
            //         id: req.body.consigneeId
            //     }
            // }) : null;
            if (req.body.consigneeId) {
                consignees = await Consignees.findOne({
                    where: {
                        id: req.body.consigneeId
                    }
                });
            } else if (upload) {
                consignees = consignee.data;
            }
            vendors = req.body.vendorId ? await Vendors.findOne({
                where: {
                    id: req.body.vendorId
                }
            }) : null;
            // Get data for single 
            warning = false, message = "Order Edited";
            const { distDur, msg, status } = await Warnings.editOrder(req.body);
            if (!status) {
                warning = true,
                message = msg;
            }
            id = req.params.id;
            orderObj = {
                id: id,
                // Load type
                loadtype: req.body.loadtype ? req.body.loadtype : 0,
                // load_id: req.body.load_id,
                flowType: req.body.flowType,
                // depoid: req.body.deliveryDepoId,
                depoid: req.body.depoid ? req.body.depoid*1 : 0,

                // Pickup
                pickupCompanyName: req.body.pickupCompanyName,
                pickupState: req.body.pickupState,
                pickupStreetAddress: req.body.pickupStreetAddress,
                pickupLocationtypeid: req.body.pickupLocationtype,
                // --
                pickupCountry: req.body.pickupCountry,
                pickupCountryCode: req.body.pickupCountryCode,
                pickupCity: req.body.pickupCity,
                pickupZip: req.body.pickupZip,
                pickupAccessorials: req.body.pickupAccessorials,
                // --
                pickupdateFrom: new Date(req.body.pickupdateFrom),
                pickupdateTo: new Date(req.body.pickupdateTo),
                // --
                pickupLon: pickupLatLon.lon,
                pickupLat: pickupLatLon.lat,

                vendorid: req.body.vendorId ? req.body.vendorId*1 : 0,
                consigneeid: consignees ? consignees.dataValues.id : 0,
                // Delivery
                deliveryCompanyName: req.body.deliveryCompanyName,
                deliveryState: req.body.deliveryState,
                deliveryStreetAddress: req.body.deliveryStreetAddress,
                deliveryLocationtypeid: req.body.deliveryLocationtype,
                // --
                deliveryCountry: req.body.deliveryCountry,
                deliveryCountryCode: req.body.deliveryCountryCode,
                deliveryCity: req.body.deliveryCity,
                deliveryZip: req.body.deliveryZip,
                deliveryAccessorials: req.body.deliveryAccessorials,
                // --
                deliverydateFrom: new Date(req.body.deliverydateFrom),
                deliverydateTo: new Date(req.body.deliverydateTo),
                // --
                deliveryLon: deliveryLatLon.lon,
                deliveryLat: deliveryLatLon.lat,

                // Equipment Type
                eqType: req.body.eqType,

                // References
                bol: req.body.bol,
                pro: req.body.pro,
                po: req.body.po,

                // Rating
                currency: req.body.currency,
                rate: req.body.rate,

                // Notes
                notes: req.body.notes,

                //// Dimentions
                pallet: null,

                // Other
                companyid: 0, // req.body.companyid ,
                carrierid: 0, // req.body.carrierid ,
                customerid: 0, // req.body.customerid ,

                //// Other
                custDistance: status ? distDur.distance : 0,
                custDuration: status ? distDur.duration : 0,
                bh: req.body.bh,
                delivery: `${req.body.deliveryStreetAddress}, ${req.body.deliveryCity}, ${req.body.deliveryState} ${req.body.deliveryZip}, ${req.body.deliveryCountry}`,
                pickup: `${req.body.pickupStreetAddress}, ${req.body.pickupCity}, ${req.body.pickupState} ${req.body.pickupZip}, ${req.body.pickupCountry}`,
                pieceCount: req.body.pieceCount ? req.body.pieceCount : 0,
                pieceTime: req.body.pieceTime ? req.body.pieceTime : 0
            };
            let cube = 0, feet = 0, weight = 0, specialneeds = [], handlingUnits, quantity = 0;
            let orderTypes = { stackable: 0, turnable: 0, hazmat: 0 };
            if (req.body.removeProductIds && req.body.removeProductIds.length) { await removeHandlingUnits(req.body.removeProductIds); }
            if (req.body.products && req.body.products.length) {
                handlingUnits = await saveHandlingUnits(req.body.products, id, req);
                for (const item of handlingUnits.handlingUnit) {
                    if (item.stackable) orderTypes.stackable = 1;
                    if (item.turnable) orderTypes.turnable = 1;
                    if (item.hazmat) orderTypes.hazmat = 1;
                    if (item.Length && item.Width && item.Height) {
                        let val = item.Length * item.Width * item.Height;
                        cube += (val*item.Quantity);
                    } else 
                    if(item.volume > 0) {
                        cube += (item.volume*item.Quantity);
                    }

                    feet += item.Length ? (item.Length*item.Quantity) : 0;                
                    weight += item.Weight && item.Quantity ? (item.Weight * item.Quantity) : 0;
                    quantity += item.Quantity;
                    specialneeds.push({ id: item.id, specialneeds: item.specialneeds });
                }
            }
            let servicetime;
            if (req.body.flowType == 1) {
                servicetime = req.body.serviceTime ? req.body.serviceTime 
                    : vendors ? vendors.serviceTime 
                    : settings ? settings.defaultServiceTime : 0;
            } else if (req.body.flowType == 2) {
                if (req.body.serviceTime) {
                    servicetime = req.body.serviceTime;
                } else if(consignees) {
                    if (consignees.serviceTime) {
                        servicetime = consignees.dataValues.serviceTime;
                    } else {
                        if (settings) {
                            servicetime = settings.defaultServiceTime;
                        }
                    }
                }  else {
                    if (settings) {
                        servicetime = settings.defaultServiceTime;
                    }
                }
            } else if (req.body.flowType == 3) {
                servicetime = req.body.serviceTime ? req.body.serviceTime
                    : settings ? settings.defaultServiceTime : 0;
            }
            let changeOrder, order;
            servicetime = parseInt(servicetime, 10);
            changeOrder = await Order.update({
                ...orderObj,
                cube,
                feet,
                weight,
                pieceCount: quantity,
                specialneeds: specialneeds,
                orderTypes: orderTypes,
                servicetime
            }, {
                where: {id: id}
            });
            order = await Order.findOne({
                where: {
                    id: id
                }
            });

            if (changeOrder[0]) {
                res.status(200).json({
                    status: 1,
                    warning,
                    msg: message,
                    data: [{
                        ...order.dataValues,
                        'products': handlingUnits
                    }],
                    error: false,
                });
            } else {
                res.status(200).json({
                    status: 1,
                    msg: 'Order doesn\'t changed',
                    data: {}
                });
            }
        }
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: 0,
            error,
            msg: "catch error"
        });
    }
    
};

exports.delete = async (req, res) => {
    var ids = req.query.ids;
    if (!ids || ids.trim() == '') {
        res.status(200).send({
            status: 0,
            msg: 'no ids for delete'
        });
        return;
    }
    let orderIds = await Helpers.splitToIntArray(ids, ',');
    

    Order.destroy({
        where: {
            id: {
                [Op.in]: orderIds
            }
        }
    }).then(async orders => {
        await HandlingUnit.destroy({
            where: {
                orders_id: {
                    [Op.in]: orderIds
                }
            }
        });
        res.status(200).send({
            status: 1,
            msg: 'ok',
            data: orders
        });
    }).catch(err => {
        res.status(500).send({
            'description': 'Can not access orders table',
            'error': err
        });
    });
};

////
//
exports.plannedunplanned = (req, res) => {
    var filter = req.params.filter;
    var where;
    switch (filter) {
        case 'all':
            where = {};
            break;
            // case 'Planned': where = { load_id: { [Op.gt]: 0 } }; break
            // case 'Unplanned':  where = { load_id: { [Op.or]: { [Op.lt]: 0, [Op.eq]: null } } }; break
        case 'Planned':
            where = { isPlanned: 1 };
            break;
        case 'Unplanned':
            where = { isPlanned: 0 };
            break;
    }

    findAll(where, res);
};

exports.freezedunfreezed = (req, res) => {
    var filter = req.params.filter;
    var where;
    switch (filter) {
        case 'all':
            where = {};
            break;
            // case 'Planned': where = { load_id: { [Op.gt]: 0 } }; break
            // case 'Unplanned':  where = { load_id: { [Op.or]: { [Op.lt]: 0, [Op.eq]: null } } }; break
        case 'Freezed':
            where = { isfreezed: 1 };
            break;
        case 'Unfreezed':
            where = { isfreezed: 0 };
            break;
    }

    findAll(where, res);
};

exports.statusfilter = (req, res) => {
    var filter = req.params.filter;
    var where;
    switch (filter) {
        case 'all':
            where = {};
            break;
            // case 'Planned': where = { load_id: { [Op.gt]: 0 } }; break
            // case 'Unplanned':  where = { load_id: { [Op.or]: { [Op.lt]: 0, [Op.eq]: null } } }; break
        case 'At Depot':
            where = { status: 2 };
            break;
        case 'Arrived':
            where = { status: 3 };
            break;
        case 'In Transit':
            where = { status: 4 };
            break;
        case 'At Pickup':
            where = { status: 5 };
            break;
        case 'Delay':
            where = { status: 6 };
            break;
        case 'At Dropoff':
            where = { status: 7 };
            break;
    }

    findAll(where, res);

    // Order.findAll({
    // 	where: where
    // })
    // .then(orders => {
    // 	res.status(200).send({
    // 		status: 1,
    // 		msg: 'ok',
    // 		data: orders
    // 	})
    // }).catch(err => {
    // 	res.status(500).send({
    // 		'description': 'Can not access orders table',
    // 		'error': err
    // 	});
    // })
};

exports.changeonwaystatus = async (req, res) => {
    
    let id = req.params.id;
    let orders = req.body.orders;
    let status = req.body.statusid;
    let lid = req.body.loadid;
    let ata, ataId ; 
    if(req.body.ata) { ata = req.body.ata.time; ataId = req.body.ata.orderid; }
    let durations; 
    if(req.body.durations) { durations = req.body.durations; }
    let orderETA = [];
    let st = await Status.findOne({where: {id:status}});
    let load = await Load.findOne({ where: {id:lid} }).catch(err => { res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body }); });
    let curSt = load.status;
    let ords = load.orders.split(',').map(function (item) { return parseInt(item, 10); });

    console.log(ords, id);
    if(!ords.includes(parseInt(id,10))){
        console.log("!!!");
        res.status(409).send({ status: 0, msg: `load ${lid} not include order by id ${id}`, data: req.body, orders:ords });
        return;
    }

    let stopLocations = load.stopLocations;

    if(stopLocations){
        for (const [i, el] of stopLocations.entries()) {
            if(el.type.type == "order" && el.type.data.id == id ) { 
                el.type.data.statusId = st.id;
                el.type.data.statusColor = st.color;
                el.type.data.statusName = st.name;
                el.type.data.timeInfo.loads[lid].ata = status == 5 || status == 0 ? null : ata;
                el.type.data.timeInfo.loadsArr.forEach(load => {
                    if (load.id == lid) {
                        load.ata = status == 5 || status == 0 ? null : ata;
                    }
                });
                
            }
            if(durations){
                orderETA.push({
                    id: el.type.data.id,
                    type: el.type.type,
                    dur: durations[i]
                });
            }
        }
    }

    if(durations) { 
        // for (const order of orderETA) {
        //     if (order.id != ataId) { orderETA.shift(); }
        //     if (order.id == ataId) { orderETA.shift(); break; }
        // }
        await Calculations.calcETA2( { loadId: lid, orderETA }, {ataId, ata, status} ); 
    }
    // let newOrders = await Order.findAndCountAll({ where: { id: { [Op.in]: orders } }});
    // for (const order of newOrders.rows) {
    //     let timeInfo = order.timeInfo;
    //     timeInfo.loads[lid].ata = status == 5 || status == 0 ? null : ata;
    //     timeInfo.loadsArr.forEach(item => {
    //         if (item.id == lid) {
    //             item.ata = status == 5 || status == 0 ? null : ata;
    //         }
    //     });
    //     await Order.update({
    //         status: status,
    //         timeInfo: timeInfo
    //     }, { where: {id: order.id}});
    // }
    // await Load.update({ stopLocations:stopLocations },{ where: {id:lid}}).catch(err =>{
    //     res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
    // });
    const newLoad = await Load.findOne({
        where: {
            id: lid
        }
    });
    res.status(200).send({
        status: 1,
        msg: "ok",
        data: {
            id: orders,
            status: status,
            Load: lid
        }
    });
};

exports.setETA = async (req, res) => {
    Order.update(
        {size:req.body.eta,}, 
        { where: { id: req.params.id }
        }).then(order => {
            res.status(201).send({
                status: 1,
                msg: 'updated',
                data: order
            });
        }).catch(err => {
            res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
        });
};

////
//
exports.byids = async (req, res) => {
    try {
        const ids = req.params.ids;
        let where = req.query;
        let noTimeWindow = where.noTimeWindow;
        delete where.noTimeWindow;
        const orderIds = await Helpers.splitToIntArray(ids, ',');
        let tables = ['orders', 'consignees'];
        let query = Helpers.createSelectQueryWithJoinConsignee(tables,orderIds.join(','),AutoplanAttributes);
        const orders = await seq.query(query, { type: seq.QueryTypes.SELECT });
        for (const o of orders) {
            if (noTimeWindow == 1) {
                if (o.deliverydateFrom) {
                    o.deliverydateFrom = '2018-01-01T00:00:00Z';
                }
                if (o.pickupdateFrom) {
                    o.pickupdateFrom = '2018-01-01T00:00:00Z';
                }
                if (o.deliverydateTo) {
                    o.deliverydateTo = '2030-01-01T00:00:00Z';
                }
                if (o.pickupdateTo) {
                    o.pickupdateTo = '2030-01-01T00:00:00Z';
                }
            }
        }
        res.status(200).send({
            status: 1,
            msg: 'ok',
            data: {
                orders: orders,
            }
        });
        
    } catch (error) {
        res.status(500).json({
            msg: "Can not access orders table",
            error
        });
    }
    
};

exports.byIdsAndCoordsFillCoords = (req, res) => {
    var ids = req.params.ids;
    var idArr = ids.split(',');
    Order.findAll({
            where: {
                id: {
                    [Op.in]: idArr
                }
            }
        })
        .then(orders => {
            var ordersResult = [];
            for (var i = 0; i < idArr.length; i++) {
                for (var j = 0; j < orders.length; j++) {
                    if (idArr[i] == orders[j].id) {
                        if (orders[j].deliveryLon == null || orders[j].deliveryLat == null || orders[j].deliveryLon == '' || orders[j].deliveryLat == '') {
                           //  console.log(2);
                            var oLonLat = alkMap.getOrderLonLatByAddress(orders[j]);
                           //  console.log(oLonLat);
                            if (oLonLat && oLonLat !== false && oLonLat.length > 0) {
                                orders[j].lon = oLonLat[0].Coords.Lon;
                                orders[j].lat = oLonLat[0].Coords.Lat;

                                Order.update({
                                    lon: orders[j].lon,
                                    lat: orders[j].lat
                                }, {
                                    where: { id: orders[j].id }
                                });
                            }
                        }

                        ordersResult.push(orders[j]);
                        break;
                    }
                }
            }

            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: ordersResult
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access orders table',
                'error': err
            });
        });
};

exports.byIdsAndCoords = (req, res) => {
    var ids = req.params.ids;
    var idArr = ids.split(',');
    Order.findAll({
            attributes: ['id', 'delivaryLon', 'deliveryLat'],
            where: {
                id: {
                    [Op.in]: idArr
                }
            }
        })
        .then(orders => {
            var ordersResult = [];
            for (var i = 0; i < idArr.length; i++) {
                for (var j = 0; j < orders.length; j++) {
                    if (idArr[i] == orders[j].id) {
                        ordersResult.push(orders[j]);
                        break;
                    }
                }
            }

            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: ordersResult
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access orders table',
                'error': err
            });
        });
};

exports.byIdsAndCoordsMany = (req, res) => {
    //var borders = req.body.a //.orders
    var idArr = [];

    for (var key in req.body) {
        var arr = Array.isArray(req.body[key]) ? req.body[key] : [req.body[key]];
        arr.forEach( rb => {
            rb.split(',').forEach(rb0 => { idArr.push(rb0); });
        });
    }
    //console.log(idArr)
    if (idArr.length == 0) {
        res.status(200).send(Common([]));
        return;
    }

    Order.findAll({
            attributes: ['id', 'deliveryLon', 'deliveryLat'],
            where: {
                id: {
                    [Op.in]: idArr
                }
            }
        })
        .then(orders => {

            var ordersResult = [];

            for (var key in req.body) {
                var arr = Array.isArray(req.body[key]) ? req.body[key] : [req.body[key]];
                arr.forEach(rb => {
                    var or = [];
                    var ords = rb.split(',');
                    ords.forEach(o => {
                        for (var j = 0; j < orders.length; j++) {
                            if (o == orders[j].id) {
                                or.push(orders[j]);
                                break;
                            }
                        }
                    });
                    ordersResult.push(or);
                });
            }

            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: ordersResult
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access orders table',
                'error': err
            });
        });
};

exports.byidssortedbydeliverydate = (req, res) => {
    var ids = req.params.ids;
        // findAll({
        // 	where: {
        // 		id: { [Op.in]: ids.split(',') }
        // 	}, res);

    Order.findAll({
        where: {
            id: {
                [Op.in]: ids.split(',')
            }
        },
        order: [

            ['deliverydateFrom', 'ASC']
        ]
    }).then(orders => {
        res.status(200).send({
            status: 1,
            msg: 'ok',
            data: orders
        });
    }).catch(err => {
        res.status(500).send({
            'description': 'Can not access orders table',
            'error': err
        });
    });
};

// DELETE After Testing
exports.getAutoPlan = async (req, res) => {
    //console.log(req.body);

    const sortAndPagiantion = await Helpers.sortAndPagination(req);
    
    let where = req.query;
    let noTimeWindow = where.noTimeWindow;
    delete where.noTimeWindow;
    let filterWhere;

    let bool = false;
    if (where.depoid) {
        where[Op.or] = [{depoid: where.depoid}, {depoid: null}];
    }
    delete where.depoid;
    if (where.deliveryDateFrom || where.deliveryDateTo || where.pickupDateFrom || where.pickupDateTo) {
        delete where.date;
        filterWhere = await Helpers.filters(where, Op);
        bool = true;
        if (!filterWhere.bool) {
            res.status(200).send({
                status: 1,
                msg: 'filter error',
                data: {
                    orders: [],
                    count: 0
                }
            });
        }
        delete where.flowType;
    } else {
        
        let start = where.date;
        let end =  moment(start).add(23.9998, 'h').toISOString();
            
        console.log("s", start.toString());
        console.log("e", end.toString());

        if (where.flowType && where.flowType == '1') {
            
            where.pickupdateFrom = {
                [Op.gte]: start,
                [Op.lte]: end
            };
            delete where.flowType;
        }
        if (where.flowType && where.flowType == '2') {
            
            where.deliverydateTo = {
                [Op.gte]: start , 
                [Op.lte]: end
            };
            delete where.flowType;
        }
        delete where.date;
    }

    const orders = await Order.findAndCountAll({
            //  attributes: autoplanattrb,
            where: bool ? filterWhere.where : where,
            include: includeFalse,
            distinct: true,
            ...sortAndPagiantion
    });
    var result = [];
    for(var i in orders.rows) {
        var o = orders.rows[i];
        let full = false;
        if (o.loadtype == '2') {
            full = true;
        }
        if (noTimeWindow == 1) {
            if (o.deliverydateFrom) {
                o.deliverydateFrom = '2018-01-01T00:00:00Z';
            }
            if (o.pickupdateFrom) {
                o.pickupdateFrom = '2018-01-01T00:00:00Z';
            }
            if (o.deliverydateTo) {
                o.deliverydateTo = '2030-01-01T00:00:00Z';
            }
            if (o.pickupdateTo) {
                o.pickupdateTo = '2030-01-01T00:00:00Z';
            }
        }
        result.push({
            id: o.id,
            feet: o.feet,
            weight: o.weight,
            cube: o.cube,
            depoid: o.depoid,
            // pallet: o.pallet,
            // eqType: o.eqType,
            flowType: o.flowType,
            // delivery: o.delivery,
            // pickup: o.pickup,
            // deliveryLatLon: `${o.deliveryLat},${o.deliveryLon}`,
            // pickupLatLon: `${o.pickupLat},${o.pickupLon}`,
            deliveryLat: o.deliveryLat,
            deliveryLon: o.deliveryLon,
            pickupLat: o.pickupLat,
            pickupLon: o.pickupLon,
            deliverydateFrom: o.deliverydateFrom,
            deliverydateTo: o.deliverydateTo,
            pickupdateFrom: o.pickupdateFrom,
            pickupdateTo: o.pickupdateTo,
            servicetime: o.servicetime,
            full:full,
            driverId: o.consigneeid && o.consignee ? o.consignee.driverId ? o.consignee.driverId : null : null
            // Accessorials: o.Accessorials
        });
        //  console.log(result);
    }
    res.status(200).send({
        status: 1,
        msg: 'ok',
        data: {
            orders: result,
            count: orders.count
        }
    });
};

exports.getAutoplanCount = async (req, res) => {
    try {


        let { filters, params } = req.body;


        const sortAndPagiantion = await Helpers.sortAndPagination2(params);
    
        let where = {
            ...filters,
            ...params
        };
        let filterWhere, orders;
        if (where.depoid && where.depoid == where.depotId) {
            delete where.depotId;
        } else if (where.depoid && where.depoid != where.depotId) {
            return res.json({
                status: 1,
                msg: 'filter error',
                data: {
                    count: 0
                }
            });
        } else if (!where.depoid) {
            where[Op.or] = [{depoid: where.depotId}, {depoid: null}];
            delete where.depotId;
        }

        let bool = false;
        
        if (where.deliveryDateFrom || where.deliveryDateTo || where.pickupDateFrom || where.pickupDateTo) {
            delete where.date;
            filterWhere = await Helpers.filters(where, Op);
            bool = true;
            if (!filterWhere.bool) {
                res.status(200).send({
                    status: 1,
                    msg: 'filter error',
                    data: {
                        count: 0
                    }
                });
            }
            delete where.flowType;
        } else {
            
            let start = where.date;
            let end =  moment(start).add(23.9998, 'h').toISOString();
                
            console.log("s", start.toString());
            console.log("e", end.toString());

            if (where.flowType && where.flowType == '1') {
                
                where.pickupdateFrom = {
                    [Op.gte]: start,
                    [Op.lte]: end
                };
                delete where.flowType;
            }
            if (where.flowType && where.flowType == '2') {
                
                where.deliverydateTo = {
                    [Op.gte]: start , 
                    [Op.lte]: end
                };
                delete where.flowType;
            }
            delete where.date;
        }
        orders = await Order.count({
            attributes: ['id'],
            where: bool ? filterWhere.where : where,
            include: includeFalse,
            distinct: true,
            ...sortAndPagiantion
        });
        let count = sortAndPagiantion.limit < orders ? sortAndPagiantion.limit : orders;
        res.json({
            status: 1,
            msg: 'OK',
            data: {
                count
            }
        });
    } catch (error) {
        res.json(await Helpers.errorMsg('Error in get orders count'));
    }
};

exports.getAutoPlanTwo = async (req, res) => {
    //console.log(req.body);

    const sortAndPagiantion = await Helpers.sortAndPagination(req);
    console.log(sortAndPagiantion);
    
    let where = req.query;
    let filterWhere;
    let bool = false;
    if (where.depoid) {
        where[Op.or] = [{depoid: where.depoid}, {depoid: null}];
    }
    delete where.depoid;
    if (where.deliveryDateFrom || where.deliveryDateTo || where.pickupDateFrom || where.pickupDateTo) {
        delete where.date;
        filterWhere = await Helpers.filters(where, Op);
        bool = true;
        if (!filterWhere.bool) {
            res.status(200).send({
                status: 1,
                msg: 'filter error',
                data: {
                    orders: [],
                    count: 0
                }
            });
        }
    } else {
        if (where.flowType && where.flowType == '1') {
            where.pickupdateFrom = {
                [Op.startsWith]: where.date
            };
        }
        if (where.flowType && where.flowType == '2') {
            where.deliverydateTo = {
                [Op.startsWith]: where.date
            };
        }
        delete where.date;
    }

    const orders = await Order.findAndCountAll({
        //  attributes: autoplanattrb,
        where: bool ? filterWhere.where : where,
        include: includeFalse,
        distinct: true,
        ...sortAndPagiantion
    });
    var result = [];
    for(var i in orders.rows) {
        var o = orders.rows[i];
        let full = false;
        if (o.loadtype == '2') {
            full = true;
        }
        result.push({
            id: o.id,
            feet: o.feet,
            weight: o.weight,
            cube: o.cube,

            // pallet: o.pallet,
            // eqType: o.eqType,
            flowType: o.flowType,

            // delivery: o.delivery,
            // pickup: o.pickup,

            // deliveryLatLon: `${o.deliveryLat},${o.deliveryLon}`,
            // pickupLatLon: `${o.pickupLat},${o.pickupLon}`,

            deliveryLat: o.deliveryLat,
            deliveryLon: o.deliveryLon,
            pickupLat: o.pickupLat,
            pickupLon: o.pickupLon,

            deliverydateFrom: o.deliverydateFrom,
            deliverydateTo: o.deliverydateTo,

            pickupdateFrom: o.pickupdateFrom,
            pickupdateTo: o.pickupdateTo,
            servicetime: o.servicetime,
            full
            // Accessorials: o.Accessorials
        });
        //  console.log(result);
    }
    res.status(200).send({
        status: 1,
        msg: 'ok',
        data: {
            orders: result,
            count: orders.count
        }
    });
};


exports.distance = async (req, res) => {
  if(req.body.pickupStreetAddress && req.body.pickupCity && req.body.deliveryStreetAddress && req.body.deliveryCity) {
    const pickupLatLon = await osrm.GeoCode(`${req.body.pickupStreetAddress}, ${req.body.pickupCity}`);
    const deliveryLatLon = await osrm.GeoCode(`${req.body.deliveryStreetAddress}, ${req.body.deliveryCity}`);
    if (pickupLatLon.length && deliveryLatLon.length) {
      const LatLons = `${pickupLatLon[0].lat},${pickupLatLon[0].lon};${deliveryLatLon[0].lat},${deliveryLatLon[0].lon};`;
      const{ distDur, status }= await osrm.GetDistDur(LatLons);

      res.status(200).send({
        status: 1,
        msg: 'ok',
        data: {
          distance: status ? distDur.distance: 0
        }
      });
    } else {
      res.status(200).send({
        status: 0
      });
    }

  } else {
    res.status(200).send({
      status: 0
    });
  }
};

exports.changeStatus = async (req, res) => {
        console.log(req.body);
        const oid = req.params.id;
        const sid = req.body.statusid;
        const lid = req.body.loadid;

        Order.update({

            status: req.params.sid

        },{
            where: {id:oid}
        }).then( oresp => {
            // Some other update for load
            res.status(200).send({
                status: oresp,
                msg: 'ok'
            });

        }).catch(err => {
            res.status(500).send({ 
                status: oresp,
                msg: err

            });
        });
        
};

exports.editAll = async (data) => {
    try {
        let orders;
        let { serviceTime, pieceTime } = data;
        let query = await Helpers.createEditQuery(serviceTime*1, pieceTime*1);
        orders = await seq.query(query, { type: seq.QueryTypes.UPDATE }).catch(err => {
            console.log(err);
            
        });
        return {orders};
    } catch (error) {
        return {
            status: 0,
            msg: "Error"
        };
    }
};

exports.image = async (req, res, next) => {
    req.urlBasedDirectory = 'images';
    next();
};

exports.orderUpload = async (req, res) => {
    console.log('upload started');
    try {
        const uid = uuidv1();
        let fileArr = [], type = 2, info, classKey;
        info = await Helpers.getRemoteInfoForKey(req);
        if (!info) {
            console.log('fail on remote Info:');
        }
        classKey = new ClassApiKey({data: {host: info.host}});
        let { key } = await classKey.getBy({
            host: info.host,
            userId: req.user.id
        }).catch(err => {
            console.log('fail key checking', err.message);
        });
        let { timezone, date, depotId, equipmentTypeId, RefreshProducts } = req.body;
        let depo = depotId ? await Depo.findOne({ where: { id: depotId }}) : null;
        let settings = req.user.id ? await Settings.findOne({ where: { userId: req.user.id } }) : null;
        if (!depo || !settings) {
            console.log('null depo or settings');
        }
        let b = req.body.changedFile ? Buffer.from(req.body.changedFile) : null;
        let s = b ? b.toString('base64') : null;
        if (!s) {
            console.log('changedFile: ', req.body.changedFile);
        }
        // console.log(req.body.changedFile);
        let fileName = req.body.fileName;
        if (req.files && req.files.files) {
            if (Array.isArray(req.files.files)) {
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
                            Data: Buffer.from(file.data).toString('base64')
                        });
                    }
                }
            } else {
                let file = req.files.files;
                let ext = path.extname(file.name);
                ext == ".csv" ? type = 0 :
                    ext == ".edf" ? type = 1 : type = 2;
                if (type == 0 || type == 1) {
                    fileArr.push({
                        FileType: type,
                        FileName: file.name,
                        Data: Buffer.from(file.data).toString('base64')
                    });
                }
                fileName = file.name;
            }
        } else {
            fileArr.push({
                FileType: req.body.fileType,
                FileName: fileName,
                Data: req.body.changedFile ? s : 'null'
            });
        }
        console.log('pased file reading stage');
        if (req.body.saveFields != 0 && req.body.fileHeaders && req.user.id) {
            await Settings.update({fileHeaders: JSON.parse(req.body.fileHeaders)}, {
                where: {
                    userId: req.user.id
                }
            });
        }
        
        let obj = {
            "UUID": uid,
            "RefreshProducts": RefreshProducts == 1 ? true : false,
            "Country": settings.dataValues.country,
            "CountryCode": settings.dataValues.countryCode,
            "EquipmentTypeId": equipmentTypeId,
            "Date": date,
            "TimeZoneOffset": timezone,
            "Depot": depo.dataValues,
            "Endpoints": {
                "Consignees": `${info.host}/apis/v1/consignees`,
                "Products": `${info.host}/apis/v1/products`,
                "HandlingTypes": `${info.host}/apis/v1/handlingtypes`,
                "PieceTypes": `${info.host}/apis/v1/piecetypes`,
                "Order": `${info.host}/apis/v1/orders`,
                "Upload": `${info.host}/apis/v1/uploads`
            },
            "Keys": {
                "Consignees": key.Key,
                "Products": key.Key,
                "HandlingTypes": key.Key,
                "PieceTypes": key.Key,
                "Order": key.Key,
                "Upload": key.Key
            },
            "Files": fileArr
        };
        let sendFile,
        url = 'http://192.168.1.109:4774/upload';
        // url = `${env.uploadHost}${env.uploadPort}/upload`;
        console.log(url);
        if (fileArr.length) {
            const upClass = new UploadClass({ data: {UUID: uid}});
            await upClass.create();
            sendFile = await axios.post(url, obj, {
                headers: {
                    'content-type': 'application/json'
                },
                // maxBodyLength: 1000000000
            }).catch(err => {
                console.log('error', err.message);
            });
            console.log('post success');
        } else {
            return res.status(409).json({
                status: 0,
                msg: 'file doesn\'t exist'
            });
            
        }

        
        res.json({
            status: 1,
            data: sendFile.data,
            UUID: uid,
        });
    } catch (error) {
        console.log('ERROR!', error.message);
        res.json({
            status: 0,
            error
        });
    }
};

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

exports.orderUnPlan = async (req, res) => {
    try {
        let { orderIds } = req.body;
        let result = [];
        for (const orderId of orderIds) {
            let order = await Order.findAndCountAll({ where: { id: orderId } });
            let loadTempIds = order.rows[0].loadTempIds,
            loadIds = order.rows[0].loadIds, info = order.rows[0].timeInfo;
            let newLoad;
            if (loadIds && loadIds.length) {
                for (const id of loadIds) {
                    delete info.loads[id];
                }
                newLoad = Load_Controller.dropOrderFromLoads({
                    loadIds,
                    orderId,
                    user: req.user,
                    order
                });
            }
            if (loadTempIds && loadTempIds.length) {
                for (const id of loadTempIds) {
                    delete info.loadTemps[id];
                }
                newLoad = LoadTemp_Controller.dropOrderFromLoadTemps({
                    loadTempIds,
                    orderId,
                    user: req.user,
                    order
                });
            }
            
            
            
            await Order.update({
                isPlanned: 0,
                confirmed: 0,
                flowTypes: [],
                loadIds: [],
                loadTempIds: [],
                timeInfo: {}
            }, {
                where: { id: orderId }
            });


            if (newLoad && newLoad.status) {
                result.push({
                    status: newLoad.status,
                    msg: newLoad.msg
                });
            } else {
                result.push({
                    status: 0
                });
            }
        }
        res.json({
            status: 1,
            data: result
        });
    } catch (error) {
        res.status(409).json({
            status: 0,
            msg: error.message
        });
    }
};

exports.uploadCreate = async (req, res) => {
    // console.log(req.body);
    //  type --> feet, weight, volume
    // let totalfeet = getTotals(req.body.handlingUnits, type);
    // let totalweight;
    // let totalvolume;
    try {
        const errors = await Errors.createOrderError(req.body.orders);
        if (errors.error) {
            res.status(409).json({
                status: errors.error,
                msg: errors.msg
            });
        } else {
            let apikey = req.headers['x-api-key'], key, userId, id;
            if (apikey) {
                key = new ClassApiKey({data: {apikey}});
                userId = await key.getBy({
                    Key: apikey
                });
            } else {
                console.log('no API key');
            }
            if (userId) {
                id = userId.key.userId;
            }
            let createdOrders = [], errorArr = [];
            let warning, message, warningArray = [];
            const settings = await Settings.findOne({
                where: {
                    userId: id
                }
            }).catch(err => {
                console.log('Settings not found: ', err.message);
            });
            let i = 0, upload = false;
            if (req.body.Automated) {
                upload = true;
            }
            for (const order of req.body.orders) {
                // let poOrder;
                // poOrder = await Order.findAndCountAll({ where: {po: order.po }});
                
                let pickupLatLon = {
                    lat: 0,
                    lon: 0
                }, deliveryLatLon = {
                    lat: 0,
                    lon: 0
                };
                let LatLons;
                let points = [], cons, consignee;
                cons = order.consigneeName ? await Consignees.findOne({
                    where: {
                        [Op.and]: [
                            sequelize.where(
                                sequelize.fn('lower', sequelize.col('name')),
                                sequelize.fn('lower', order.consigneeName.toLowerCase())
                            )
                        ]
                    }
                }) : null;
                if (!order.deliveryZip || !order.deliveryCity || !order.deliveryStreetAddress || !order.deliveryState ) {
                    errorArr.push({
                        po: order.po,
                        status: 0,
                        msg: "invalid delivery address"
                    });
                }
                if (!order.deliveryLat && !order.deliveryLon && !cons && upload) {
                    LatLons = await Helpers.orderLatLon({
                        pickupAddr: !order.pickupLat && !order.pickupLon ? `${order.pickupZip}+${order.pickupCity}+${order.pickupStreetAddress}+${order.pickupState}` : null,
                        deliveryAddr: !order.deliveryLat && !order.deliveryLon ? `${order.deliveryZip}+${order.deliveryCity}+${order.deliveryStreetAddress}+${order.deliveryState}` : null
                    });
                    points.push({
                        address: {
                            lat: LatLons.deliveryLatLon.data.results[0].geometry.location.lat,
                            lon: LatLons.deliveryLatLon.data.results[0].geometry.location.lng,
                            zip: order.deliveryZip,
                            city: order.deliveryCity,
                            state: order.deliveryState,
                            country: order.deliveryCountry,
                            countryCode: order.deliveryCountryCode,
                            streetAddress: order.deliveryStreetAddress
                        }
                    });
                    consignee = await Consignee.createInTimeOrderCreate({
                        name: order.consigneeName,
                        companyLegalName: order.deliveryCompanyName,
                        serviceTime: order.serviceTime ? order.serviceTime : 0,
                        points: points

                    });
                    // console.log('-----', consignee);
                } else if (!order.deliveryLat && !order.deliveryLon && !cons && !upload) {
                    LatLons = await Helpers.orderLatLon({
                        pickupAddr: !order.pickupLat && !order.pickupLon ? `${order.pickupZip}+${order.pickupCity}+${order.pickupStreetAddress}+${order.pickupState}` : null,
                        deliveryAddr: !order.deliveryLat && !order.deliveryLon ? `${order.deliveryZip}+${order.deliveryCity}+${order.deliveryStreetAddress}+${order.deliveryState}` : null
                    });
                } else if (!order.deliveryLat && !order.deliveryLon && cons) {
                    for (const point of cons.dataValues.points) {
                        if (point.address.zip == order.deliveryZip && point.address.city == order.deliveryCity && point.address.state == order.deliveryState && point.address.country == order.deliveryCountry && point.address.countryCode == order.deliveryCountryCode && point.address.streetAddress == order.deliveryStreetAddress) {
                            order.deliveryLon = point.address.lon;
                            order.deliveryLat = point.address.lat;
                        }
                    }
                }
                // console.log(LatLons);
                if (order.pickupLon && order.pickupLat) {
                    pickupLatLon.lat = order.pickupLat;
                    pickupLatLon.lon = order.pickupLon;
                } else {
                    pickupLatLon.lat = LatLons.pickupLatLon.data.results[0].geometry.location.lat;
                    pickupLatLon.lon = LatLons.pickupLatLon.data.results[0].geometry.location.lng;
                }
                if (order.deliveryLon && order.deliveryLat) {
                    deliveryLatLon.lat = order.deliveryLat;
                    deliveryLatLon.lon = order.deliveryLon;
                } else {
                    deliveryLatLon.lat = LatLons.deliveryLatLon.data.results[0].geometry.location.lat;
                    deliveryLatLon.lon = LatLons.deliveryLatLon.data.results[0].geometry.location.lng;
                }
                
                // console.log(LatLons.pickupLatLon.data.results[0].geometry.location);
                // console.log(LatLons.deliveryLatLon.data.results[0].geometry.location);
                let consignees;
                if (order.consigneeId) {
                    consignees = await Consignees.findOne({
                        where: {
                            id: order.consigneeId
                        }
                    });
                } else if (upload && cons) {
                    consignees = cons;
                } else if (upload && !cons) {
                    consignees = consignee.data;
                }
                //  = order.consigneeId ?  : null;
                let vendors = order.vendorId ? await Vendors.findOne({
                    where: {
                        id: order.vendorId
                    }
                }) : null;
                warning = false, message = "ok";
                const { distDur, msg, status } = await Warnings.createOrder({
                    pickupLat: pickupLatLon.lat,
                    pickupLon: pickupLatLon.lon,
                    deliveryLat: deliveryLatLon.lat,
                    deliveryLon: deliveryLatLon.lon
                });
                if (!status) {
                    warning = true,
                    message = msg;
                }

                if (order.products && order.products.length) {
                    let newOrder = await Order.create({
                        // Load type
                        loadtype: order.loadtype ? order.loadtype : 0,
                        // load_id: order.load_id,

                        flowType: order.flowType,
                        depoid: order.depoid,

                        // Pickup
                        pickupCompanyName: order.pickupCompanyName,
                        pickupState: order.pickupState,
                        pickupStreetAddress: order.pickupStreetAddress,
                        pickupLocationtypeid: order.pickupLocationtype,
                        // --
                        pickupCountry: order.pickupCountry,
                        pickupCountryCode: order.pickupCountryCode,
                        pickupCity: order.pickupCity,
                        pickupZip: order.pickupZip,
                        pickupAccessorials: order.pickupAccessorials,
                        // --
                        pickupdateFrom: new Date(order.pickupdateFrom),
                        pickupdateTo: new Date(order.pickupdateTo),
                        // --
                        pickupLon: pickupLatLon.lon,
                        pickupLat: pickupLatLon.lat,

                        vendorid: order.vendorId ? order.vendorId : 0,
                        consigneeid: consignees ? consignees.dataValues.id : 0,
                        // Delivery
                        deliveryCompanyName: order.deliveryCompanyName,
                        deliveryState: order.deliveryState,
                        deliveryStreetAddress: order.deliveryStreetAddress,
                        deliveryLocationtypeid: order.deliveryLocationtype,
                        // --
                        deliveryCountry: order.deliveryCountry,
                        deliveryCountryCode: order.deliveryCountryCode,
                        deliveryCity: order.deliveryCity,
                        deliveryZip: order.deliveryZip,
                        deliveryAccessorials: order.deliveryAccessorials,
                        // --
                        deliverydateFrom: new Date(order.deliverydateFrom),
                        deliverydateTo: new Date(order.deliverydateTo),
                        // --
                        deliveryLon: deliveryLatLon.lon,
                        deliveryLat: deliveryLatLon.lat,
            
                        // Equipment Type
                        eqType: order.eqType,
            
                        // References
                        bol: order.bol,
                        pro: order.pro,
                        po: order.po,
            
                        // Rating
                        currency: order.currency,
                        rate: order.rate,
            
                        // Notes
                        notes: order.notes,
            
                        //// Statuses
                        isPlanned: 0,
                        confirmed: 0,
                        status: 0,  // order.status,
                        statusInternal: 1,
                        isfreezed: 0,
            
                        //// Dimentions
                        pallet: null,
            
                        // Other
                        companyid: 0, // order.companyid ,
                        carrierid: 0, // order.carrierid ,
                        customerid: 0, // order.customerid ,
            
                        //// Other
                        // servicetime: 900,
                        custDistance: status ? distDur.distance : 0,
                        custDuration: status ? distDur.duration : 0,
                        bh: order.bh,
                        delivery: `${order.deliveryStreetAddress}, ${order.deliveryCity}, ${order.deliveryState} ${order.deliveryZip}, ${order.deliveryCountry}`,
                        pickup: `${order.pickupStreetAddress}, ${order.pickupCity}, ${order.pickupState} ${order.pickupZip}, ${order.pickupCountry}`,
                        loadTempIds: [],
                        loadIds: [],
                        flowTypes: [],
                        timeInfo: {
                            loadTemps: {},
                            loads: {},
                            loadsArr: []
                        },
                        pieceCount: order.pieceCount ? order.pieceCount : 0,
                    }).catch(err => {
                        console.log('Error Order create: ', err.message);
                    });
                    res.status(200).json({
                        status: 1,
                        warnings: warningArray,
                        warning: warningArray.length ? true : false,
                        msg: 'Order created',
                        data: [newOrder.dataValues],
                        errors: errorArr,
                        error: errorArr.length ? true : false,
                    });
                    // .then(async newOrder => {
                            if (!status) {
                                warningArray.push({
                                    warning,
                                    orderId: newOrder.id,
                                    message
                                });
                            }
                            let handlingUnits;
                            handlingUnits = await saveHandlingUnits(order.products, newOrder.id, req);
                            if (!handlingUnits) {
                                console.log('Error HandlingUnit: ');
                            }
                            const orderTypes = {
                                stackable: 0,
                                turnable: 0,
                                hazmat: 0
                            };
                            if (!handlingUnits.handlingUnit) {
                                console.log('error Handling', newOrder.id, );
                                return res.status(500).json({ status: 0, msg: 'handling error'});
                            }
                            let cube = 0, feet = 0, weight = 0, specialneeds = [], quantity = 0;
                            for (const item of handlingUnits.handlingUnit) {
                                if (item.stackable) orderTypes.stackable = 1;
                                if (item.turnable) orderTypes.turnable = 1;
                                if (item.hazmat) orderTypes.hazmat = 1;
                                if (item.Length && item.Width && item.Height) {
                                    let val = item.Length * item.Width * item.Height;
                                    cube += (val*item.Quantity);
                                } else if (item.volume > 0) {
                                    cube += (item.volume*item.Quantity);
                                }
                                feet += item.Length ? (item.Length*item.Quantity) : 0;
                                
                                weight += item.Weight && item.Quantity ? (item.Weight * item.Quantity) : 0;
                                quantity += item.Quantity;
                                specialneeds.push({
                                    id: item.id,
                                    specialneeds: item.specialneeds
                                });
                            }
                            let servicetime = 0, pieceTime = 0;
                            if (order.flowType == 1) {
                                servicetime = order.serviceTime ? order.serviceTime 
                                    : vendors ? vendors.serviceTime 
                                    : settings ? settings.defaultServiceTime : 0;
                            } else if (order.flowType == 2) {
                                if (order.serviceTime) {
                                    servicetime = order.serviceTime;
                                } else if(consignees) {
                                    if (consignees.serviceTime) {
                                        servicetime = consignees.dataValues.serviceTime;
                                    } else {
                                        if (settings) {
                                            servicetime = settings.defaultServiceTime;
                                        }
                                    }
                                } else {
                                    if (settings) {
                                        servicetime = settings.dataValues.defaultServiceTime;
                                    }
                                }
                                if (order.pieceTime) {
                                    pieceTime = order.pieceTime;
                                } else {
                                    if (settings) {
                                        pieceTime = settings.dataValues.pieceTime ? settings.dataValues.pieceTime : 0;
                                    }
                                }
                            } else if (order.flowType == 3) {
                                servicetime = order.serviceTime ? order.serviceTime
                                    : settings ? settings.defaultServiceTime : 0;
                            }
                            // servicetime = parseInt(servicetime, 10);
                            await Order.update({
                                orderTypes: orderTypes,
                                cube: cube,
                                feet: feet,
                                pieceCount: quantity,
                                weight: weight,
                                specialneeds: specialneeds,
                                servicetime: servicetime + (pieceTime * order.pieceCount),
                                pieceTime: pieceTime
                            },{
                                where: {
                                    id: newOrder.id
                                }
                            }).catch(err => {
                                console.log('Error Order edit: ', err.message);
                            });
                            const updateOrder = await Order.findOne({
                                where: {
                                    id: newOrder.id
                                }
                            });
                            if (newOrder.loadtype && newOrder.loadtype == "2" && order.createLoad) {
                                
                                const loadTemp = await creatTempLoadsfromOrder(newOrder);
                                createdOrders.push({
                                    ...updateOrder.dataValues,
                                    'products': handlingUnits.handlingUnit,
                                    loadTemp
                                });
                            } else {
                                createdOrders.push({
                                    ...updateOrder.dataValues,
                                    'products': handlingUnits.handlingUnit
                                });
                            }
                        // }).catch(err => {
                        //     console.log('55555', err.message);
                        //     errorArr.push({ status: 0, msg: err.message, err: err, data: order });
                        // });
                } else {
                    errorArr.push({
                        status: 0,
                        msg: "Add products to the order."
                    });
                }
            }
            // console.log('error Arr', errorArr);
            
        }
    } catch (error) {
        console.log('ERROR: ', error.message);
        res.status(500).json({ status: 0, msg: error.message});
    }
};

exports.uploadEdit = async (req, res) => {
    try {
        let orders = [], upload = false;
        if (req.body.Automated) {
            upload = true;
        }
        orders.push(req.body);
        const errors = await Errors.createOrderError(orders);
        if (errors.error) {
            // console.log('error ----- here');
            res.status(409).json({
                status: errors.error,
                msg: errors.msg
            });
        } else {
            let pickupLatLon = {
                lat: 0,
                lon: 0
            }, deliveryLatLon = {
                lat: 0,
                lon: 0
            };
            let points = [], cons, consignee;
            cons = req.body.consigneeName ? await Consignees.findOne({
                where: {
                    [Op.and]: [
                        sequelize.where(
                            sequelize.fn('lower', sequelize.col('name')),
                            sequelize.fn('lower', req.body.consigneeName.toLowerCase())
                        )
                    ]
                }
            }) : null;
            let LatLons, userId, userKeyData;
            if (!req.body.deliveryLat && !req.body.deliveryLon && !cons && upload) {
                LatLons = await Helpers.orderLatLon({
                    pickupAddr: !req.body.pickupLat && !req.body.pickupLon ? `${req.body.pickupZip}+${req.body.pickupCity}+${req.body.pickupStreetAddress}+${req.body.pickupState}` : null,
                    deliveryAddr: !req.body.deliveryLat && !req.body.deliveryLon ? `${req.body.deliveryZip}+${req.body.deliveryCity}+${req.body.deliveryStreetAddress}+${req.body.deliveryState}` : null
                });
                points.push({
                    address: {
                        lat: LatLons.deliveryLatLon.data.results[0].geometry.location.lat,
                        lon: LatLons.deliveryLatLon.data.results[0].geometry.location.lng,
                        zip: req.body.deliveryZip,
                        city: req.body.deliveryCity,
                        state: req.body.deliveryState,
                        country: req.body.deliveryCountry,
                        countryCode: req.body.deliveryCountryCode,
                        streetAddress: req.body.deliveryStreetAddress
                    }
                });
                consignee = await Consignee.createInTimeOrderCreate({
                    name: req.body.consigneeName,
                    companyLegalName: req.body.deliveryCompanyName,
                    serviceTime: req.body.serviceTime ? req.body.serviceTime : 0,
                    points: points

                });
                // console.log('-----', consignee);
            } else if (!req.body.deliveryLat && !req.body.deliveryLon && !cons && !upload) {
                LatLons = await Helpers.orderLatLon({
                    pickupAddr: !req.body.pickupLat && !req.body.pickupLon ? `${req.body.pickupZip}+${req.body.pickupCity}+${req.body.pickupStreetAddress}+${req.body.pickupState}` : null,
                    deliveryAddr: !req.body.deliveryLat && !req.body.deliveryLon ? `${req.body.deliveryZip}+${req.body.deliveryCity}+${req.body.deliveryStreetAddress}+${req.body.deliveryState}` : null
                });
            } else if (!req.body.deliveryLat && !req.body.deliveryLon && cons) {
                for (const point of cons.dataValues.points) {
                    if (point.address.zip == req.body.deliveryZip && point.address.city == req.body.deliveryCity && point.address.state == req.body.deliveryState && point.address.country == req.body.deliveryCountry && point.address.countryCode == req.body.deliveryCountryCode && point.address.streetAddress == req.body.deliveryStreetAddress) {
                        req.body.deliveryLon = point.address.lon;
                        req.body.deliveryLat = point.address.lat;
                    }
                }
            }
            if (req.body.pickupLon && req.body.pickupLat) {
                pickupLatLon.lat = req.body.pickupLat;
                pickupLatLon.lon = req.body.pickupLon;
            } else {
                pickupLatLon.lat = LatLons.pickupLatLon.data.results[0].geometry.location.lat;
                pickupLatLon.lon = LatLons.pickupLatLon.data.results[0].geometry.location.lng;
            }
            if (req.body.deliveryLon && req.body.deliveryLat) {
                deliveryLatLon.lat = req.body.deliveryLat;
                deliveryLatLon.lon = req.body.deliveryLon;
            } else {
                deliveryLatLon.lat = LatLons.deliveryLatLon.data.results[0].geometry.location.lat;
                deliveryLatLon.lon = LatLons.deliveryLatLon.data.results[0].geometry.location.lng;
            }
            // deliveryLatLon.lat = LatLons.deliveryLatLon.data.results[0].geometry.location.lat;
            // deliveryLatLon.lon = LatLons.deliveryLatLon.data.results[0].geometry.location.lng;
            // pickupLatLon.lat = LatLons.pickupLatLon.data.results[0].geometry.location.lat;
            // pickupLatLon.lon = LatLons.pickupLatLon.data.results[0].geometry.location.lng;
            let apikey = req.headers['x-api-key'], key;
            if (apikey) {
                key = new ClassApiKey({data: {apikey}});
                userKeyData = await key.getBy({
                    Key: apikey
                });
            }
            if (userKeyData) {
                userId = userKeyData.key.userId;
            }
            let settings, id, orderObj,
                consignees, vendors, warning, message, changeOrder, order;
            //
            settings = await Settings.findOne({
                where: {
                    userId: userId
                }
            });
            // consignee = req.body.consigneeId ? await Consignees.findOne({
            //     where: {
            //         id: req.body.consigneeId
            //     }
            // }) : null;
            if (req.body.consigneeId) {
                consignees = await Consignees.findOne({
                    where: {
                        id: req.body.consigneeId
                    }
                });
            } else if (upload) {
                consignees = consignee.data;
            }
            vendors = req.body.vendorId ? await Vendors.findOne({
                where: {
                    id: req.body.vendorId
                }
            }) : null;
            // Get data for single 
            warning = false, message = "Order Edited";
            const { distDur, msg, status } = await Warnings.editOrder(req.body);
            if (!status) {
                warning = true,
                message = msg;
            }
            id = req.params.id;
            orderObj = {
                id: id,
                // Load type
                loadtype: req.body.loadtype ? req.body.loadtype : 0,
                // load_id: req.body.load_id,
                flowType: req.body.flowType,
                // depoid: req.body.deliveryDepoId,
                depoid: req.body.depoid ? req.body.depoid*1 : 0,

                // Pickup
                pickupCompanyName: req.body.pickupCompanyName,
                pickupState: req.body.pickupState,
                pickupStreetAddress: req.body.pickupStreetAddress,
                pickupLocationtypeid: req.body.pickupLocationtype,
                // --
                pickupCountry: req.body.pickupCountry,
                pickupCountryCode: req.body.pickupCountryCode,
                pickupCity: req.body.pickupCity,
                pickupZip: req.body.pickupZip,
                pickupAccessorials: req.body.pickupAccessorials,
                // --
                pickupdateFrom: new Date(req.body.pickupdateFrom),
                pickupdateTo: new Date(req.body.pickupdateTo),
                // --
                pickupLon: pickupLatLon.lon,
                pickupLat: pickupLatLon.lat,

                vendorid: req.body.vendorId ? req.body.vendorId*1 : 0,
                consigneeid: consignees ? consignees.dataValues.id : 0,
                // Delivery
                deliveryCompanyName: req.body.deliveryCompanyName,
                deliveryState: req.body.deliveryState,
                deliveryStreetAddress: req.body.deliveryStreetAddress,
                deliveryLocationtypeid: req.body.deliveryLocationtype,
                // --
                deliveryCountry: req.body.deliveryCountry,
                deliveryCountryCode: req.body.deliveryCountryCode,
                deliveryCity: req.body.deliveryCity,
                deliveryZip: req.body.deliveryZip,
                deliveryAccessorials: req.body.deliveryAccessorials,
                // --
                deliverydateFrom: new Date(req.body.deliverydateFrom),
                deliverydateTo: new Date(req.body.deliverydateTo),
                // --
                deliveryLon: deliveryLatLon.lon,
                deliveryLat: deliveryLatLon.lat,

                // Equipment Type
                eqType: req.body.eqType,

                // References
                bol: req.body.bol,
                pro: req.body.pro,
                po: req.body.po,

                // Rating
                currency: req.body.currency,
                rate: req.body.rate,

                // Notes
                notes: req.body.notes,

                //// Dimentions
                pallet: null,

                // Other
                companyid: 0, // req.body.companyid ,
                carrierid: 0, // req.body.carrierid ,
                customerid: 0, // req.body.customerid ,

                //// Other
                custDistance: status ? distDur.distance : 0,
                custDuration: status ? distDur.duration : 0,
                bh: req.body.bh,
                delivery: `${req.body.deliveryStreetAddress}, ${req.body.deliveryCity}, ${req.body.deliveryState} ${req.body.deliveryZip}, ${req.body.deliveryCountry}`,
                pickup: `${req.body.pickupStreetAddress}, ${req.body.pickupCity}, ${req.body.pickupState} ${req.body.pickupZip}, ${req.body.pickupCountry}`,
                pieceCount: req.body.pieceCount ? req.body.pieceCount : 0,
                pieceTime: req.body.pieceTime ? req.body.pieceTime : 0
            };
            changeOrder = await Order.update({
                ...orderObj
            }, {
                where: {id: id}
            });
            order = await Order.findOne({
                where: {
                    id: id
                }
            });
            if (changeOrder[0]) {
                res.status(200).json({
                    status: 1,
                    warning,
                    msg: message,
                    data: [{
                        ...order.dataValues
                    }],
                    error: false,
                });
            } else {
                res.status(200).json({
                    status: 1,
                    msg: 'Order doesn\'t changed',
                    data: {}
                });
            }
            let cube = 0, feet = 0, weight = 0, specialneeds = [], handlingUnits, quantity = 0;
            let orderTypes = { stackable: 0, turnable: 0, hazmat: 0 };
            if (req.body.removeProductIds && req.body.removeProductIds.length) { await removeHandlingUnits(req.body.removeProductIds); }
            if (req.body.products && req.body.products.length) {
                handlingUnits = await saveHandlingUnits(req.body.products, id, req);
                for (const item of handlingUnits.handlingUnit) {
                    if (item.stackable) orderTypes.stackable = 1;
                    if (item.turnable) orderTypes.turnable = 1;
                    if (item.hazmat) orderTypes.hazmat = 1;
                    if (item.Length && item.Width && item.Height) {
                        let val = item.Length * item.Width * item.Height;
                        cube += (val*item.Quantity);
                    } else 
                    if(item.volume > 0) {
                        cube += (item.volume*item.Quantity);
                    }

                    feet += item.Length ? (item.Length*item.Quantity) : 0;                
                    weight += item.Weight && item.Quantity ? (item.Weight * item.Quantity) : 0;
                    quantity += item.Quantity;
                    specialneeds.push({ id: item.id, specialneeds: item.specialneeds });
                }
            }
            let servicetime;
            if (req.body.flowType == 1) {
                servicetime = req.body.serviceTime ? req.body.serviceTime 
                    : vendors ? vendors.serviceTime 
                    : settings ? settings.defaultServiceTime : 0;
            } else if (req.body.flowType == 2) {
                if (req.body.serviceTime) {
                    servicetime = req.body.serviceTime;
                } else if(consignees) {
                    if (consignees.serviceTime) {
                        servicetime = consignees.dataValues.serviceTime;
                    } else {
                        if (settings) {
                            servicetime = settings.defaultServiceTime;
                        }
                    }
                }  else {
                    if (settings) {
                        servicetime = settings.defaultServiceTime;
                    }
                }
            } else if (req.body.flowType == 3) {
                servicetime = req.body.serviceTime ? req.body.serviceTime
                    : settings ? settings.defaultServiceTime : 0;
            }
            servicetime = parseInt(servicetime, 10);
            await Order.update({
                cube,
                feet,
                weight,
                pieceCount: quantity,
                specialneeds: specialneeds,
                orderTypes: orderTypes,
                servicetime
            }, {
                where: {id: id}
            });
        }
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: 0,
            error,
            msg: "catch error"
        });
    }
    
};

exports.getLoads = async (req, res) => {
    try {
        let { loadTempIds, loadIds } = req.query, arrLoadIds, arrLoadTempIds, loads, loadTemps, data = {};
        arrLoadIds = loadIds && loadIds.length ? await Helpers.splitToIntArray(loadIds, ',') : null;
        arrLoadTempIds = loadTempIds && loadTempIds.length ? await Helpers.splitToIntArray(loadTempIds, ',') : null;

        if (arrLoadIds) {
            loads = await Load.findAndCountAll({
                attributes: ['id', 'nickname'],
                where: {id: { [Op.in]: arrLoadIds}}
            });
            data.loads = loads.rows;
        }
        if (arrLoadTempIds) {
            loadTemps = await LoadTemp.findAndCountAll({
                attributes: ['id', 'nickname'],
                where: {
                    id: { [Op.in]: arrLoadTempIds},
                    disabled: 0
                }
            });
            data.loadTemps = loadTemps.rows;
        }
        res.json({
            status: 1,
            data
        });

    } catch (error) {
        console.log('Error: ', error.message);
        res.status(409).json(await Helpers.errorMsg(error.message));
    }
};

exports.scriptAddress = async (req, res) => {
    try {
        let orders;
        orders = await Order.findAndCountAll();
        for (const order of orders.rows) {
            if (!order.delivery) {
                console.log(order.id);
                await Order.update({
                    delivery: `${order.deliveryStreetAddress}, ${order.deliveryCity}, ${order.deliveryState} ${order.deliveryZip}, ${order.deliveryCountry}`,
                }, {where: {id: order.id}});
            }
            if (!order.pickup) {
                
                await Order.update({
                    pickup: `${order.pickupStreetAddress}, ${order.pickupCity}, ${order.pickupState} ${order.pickupZip}, ${order.pickupCountry}`,
                }, {where: {id: order.id}});
            }
        }
        res.json({
            status:1
        });
    } catch (error) {
        console.log(error);
    }
};

exports.scriptLatLon = async (req, res) => {
    const sortAndPagiantion = await Helpers.sortAndPagination(req);
    const where = req.query;
    const data = await Helpers.filters(where, Op);
    const orders = await Order.findAndCountAll({where: data.where, ...sortAndPagiantion});
    let i = 0;
    for (const order of orders.rows) {
        let pickupAddress = `${order.pickupZip}+${order.pickupCity}+${order.pickupStreetAddress}+${order.pickupState}`;
        let deliveryAddress = `${order.deliveryZip}+${order.deliveryCity}+${order.deliveryStreetAddress}+${order.deliveryState}`;
        let pickupData = !order.pickupLat && !order.pickupLon ? await Osmap.GeoLoc(pickupAddress) : null;
        let deliveryData = !order.deliveryLat && !order.deliveryLon ? await Osmap.GeoLoc(deliveryAddress) : null;
        let pickupLat,
        pickupLon,
        deliveryLat,
        deliveryLon;
        try {
            if (pickupData) {
                pickupLat = pickupData.data.results[0].geometry.location.lat;
                pickupLon = pickupData.data.results[0].geometry.location.lng;
            }
            if (deliveryData) {
                deliveryLat = deliveryData.data.results[0].geometry.location.lat,
                deliveryLon = deliveryData.data.results[0].geometry.location.lng;
            }
            
        } catch (error) {
            console.log('id', order.id);
            
        }
        if (pickupData) {
            await Order.update({
                pickupLat,
                pickupLon
            }, {
                where: {
                    id: order.id
                }
            }).then(o => {
                console.log(i, o);
                i++;
            }).catch(err => {
                console.log(order.id, err);
            });
        }
        if (deliveryData) {
            await Order.update({
                deliveryLat,
                deliveryLon,
            }, {
                where: {
                    id: order.id
                }
            }).then(o => {
                console.log(i, o);
                i++;
            }).catch(err => {
                console.log(order.id, err);
            });
        }
        
        
    }
    res.json({
        msg: "ok",
        status: 1
    });
};

exports.scriptEditCube = async (req, res) => {
    try {
        let orders, handlingUnit;
        orders = await Order.findAndCountAll({});
        let i = 0;
        for (const order of orders.rows) {
            i++;
            handlingUnit = await HandlingUnit.findAndCountAll({
                attributes: ['id'],
                where: {
                    orders_id: order.id 
                }
            });
            console.log(i, order.id);
            
            if (handlingUnit.count == 1) {
                await HandlingUnit.update({
                    HandlingType_id: 11,
                    Quantity: order.pieceCount,
                    Weight: order.pieceCount ? order.weight/order.pieceCount : 0,
                    volume: order.pieceCount ? order.cube/order.pieceCount : 0
                }, {
                    where: {
                        id: handlingUnit.rows[0].dataValues.id
                    }
                });
            } else if (handlingUnit.count == 0) {
                await HandlingUnit.create({
                    orders_id: order.id,
                    HandlingType_id: 11,
                    Quantity: order.pieceCount,
                    Weight: order.pieceCount ? order.weight/order.pieceCount*1 : 0,
                    volume: order.pieceCount ? order.cube*1/order.pieceCount*1 : 0
                });
            }
        }
        res.json({
            status: 1,
            msg: "ok"
        });
    } catch (error) {
        res.status(409).json({
            status: 0,
            msg: "Error",
            error
        });
    }
};