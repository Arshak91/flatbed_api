const db = require('../config/db.config.js');
const Settings = db.settings;

// const Equipment = db.equipment;
const Equipment = require('../mongoModels/EquipmentModel');
const Warnings = require('../warnings/orderWarnings');
const ZipCode = require('../mongoModels/ZipCodesModel');
const CapacityBoard = require('../mongoModels/CapacityBoardModel');
const Helper = require('./helpers');
const osrm = require('../controller/osmap.controller');
const EquipmentClass = require('./equipment');
const PlaningOrder = require('../mongoModels/PlaningOrders');
const PlanningModel = require('../mongoModels/PlanningModel.js');
const constants = require('../constants');
const Load = require('./load.js');
const Cities = require('../mongoModels/CitiesModel');
// get flat rate function
function getFlatRate(distance, perMaleRate) {
    return (distance / 1609) * perMaleRate;
};

// get per male rate function
function getPerMaleRate(distance, flatRate) {
    return flatRate / (distance / 1609);
};
// load price type
const LoadPriceType = {
    flatRate: 1,
    perMileRate: 2
};
async function getStartAddress(o) {
    const geoLoc = o.pickupZip ? await Helper.getGeoLoc(null, o.pickupZip) : o.pickupCity && o.pickupState ? await Helper.getGeoLoc(`${o.pickupCity}, ${o.pickupState}`) : false;
    if (!geoLoc) {
        return false;
    }
    let lat, lon;
    let LatLon = await osrm.OSRMGeoLoc(`${geoLoc.Longitude},${geoLoc.Latitude}`);
    lat = LatLon.data.waypoints[0].location[1];
    lon = LatLon.data.waypoints[0].location[0];
    return {
        lat: lat ? lat : 0,
        lon: lon ? lon : 0,
        country: o.pickupCountry,
        countryCode: o.pickupCountryCode,
        state: geoLoc.StateShort ? geoLoc.StateShort : o.pickupState,
        stateLong: geoLoc.StateLong ? geoLoc.StateLong : o.pickupState,
        city: o.pickupCity,
        zip: o.pickupZip ? o.pickupZip : '',
        cityId: o.pickupCityId,
        street: o.pickupStreetAddress,
        accessorials: o.pickupAccessorials ? o.pickupAccessorials : 0,
        // nsew: String,               // N / S / E / W
        timeWindowFrom: o.pickupdateFrom,
        timeWindowTo: o.pickupdateTo,

        company: o.pickupCompanyName
    };

    // const pLatLon = await getLatLonByZip(o.pickupCountry, o.pickupZip)
    // // console.log(pLatLon)

    // return {
    //     lat: pLatLon.lat, // o.pickupLat,
    //     lon: pLatLon.lon, // o.pickupLon,
    //     country: o.pickupCountry,
    //     state: o.pickupState,
    //     zip: o.pickupZip,
    //     city: o.pickupCity,
    //     street: o.vendorAddressId,
    //     accessorials: o.pickupAccessorials,
    //     // nsew: String,               // N / S / E / W    
    //     timeWindowFrom: new Date(o.pickupdateFrom),
    //     timeWindowTo: new Date(o.pickupdateTo)
    // }
}

async function getEndAddress(o) {
    const geoLoc = o.deliveryZip ? await Helper.getGeoLoc(null, o.deliveryZip) : o.deliveryCity && o.deliveryState ? await Helper.getGeoLoc(`${o.deliveryCity}, ${o.deliveryState}`) : false;
    if (!geoLoc) {
        return false;
    }
    let lat, lon;
    let LatLon = await osrm.OSRMGeoLoc(`${geoLoc.Longitude},${geoLoc.Latitude}`);
    lat = LatLon.data.waypoints[0].location[1];
    lon = LatLon.data.waypoints[0].location[0];
    return {
        lat: lat ? lat : 0,
        lon: lon ? lon : 0,
        country: o.deliveryCountry,
        countryCode: o.deliveryCountryCode,
        state: geoLoc.StateShort ? geoLoc.StateShort : o.deliveryState,
        stateLong: geoLoc.StateLong ? geoLoc.StateLong : o.deliveryState,
        city: o.deliveryCity,
        zip: o.deliveryZip,
        cityId: o.deliveryCityId,

        street: o.deliveryStreetAddress,
        accessorials: o.deliveryAccessorials ? o.deliveryAccessorials : 0,
        // nsew: String,               // N / S / E / W
        timeWindowFrom: o.deliverydateFrom,
        timeWindowTo: o.deliverydateTo,

        company: o.deliveryCompanyName
    };

    // const dLatLon = await getLatLonByZip(o.deliveryCountry, o.deliveryZip)

    // return {
    //     lat: dLatLon.lat, // o.deliveryLat,
    //     lon: dLatLon.lon, // o.deliveryLon,
    //     country: o.deliveryCountry,
    //     state: o.deliveryState,
    //     zip: o.deliveryZip,
    //     city: o.deliveryCity,
    //     street: o.consigneeAddressId,
    //     accessorials: o.deliveryAccessorials,
    //     timeWindowFrom: new Date(o.deliverydateFrom),
    //     timeWindowTo: new Date(o.deliverydateTo)
    //     // nsew: String,               // N / S / E / W    
    // }
}

async function getLatLonByZip(country, zip) {
    const filter = {
        Country: country.toUpperCase(),
        PostalCode: zip
    }

    if (filter.Country.toUpperCase() == 'CA') {
        filter.PostalCode.zip = zip.substr(0, 3);
    }

    const zipCode = await ZipCode.findOne(filter);

    if (zipCode) {
        return {
            lat: zipCode.Latitude,
            lon: zipCode.Longitude
        };
    }

    return {
        lat: 0,
        lon: 0
    };
}



// DAT upload
async function getStartUpload(cityState, date, timezone) {
    const cityStateArr = cityState.split(',');
    const city = cityStateArr.length > 0 ? cityStateArr[0].trim() : undefined
    const state = cityStateArr.length > 1 ? cityStateArr[1].trim() : undefined

    const geoLoc = await Helper.getGeoLoc(cityState);
    if (!geoLoc) {
        return false;
    }

    date = Helper.getDateObjectDATUpload(date, timezone);
    let lat, lon;
    let LatLon = await osrm.OSRMGeoLoc(`${geoLoc.Longitude},${geoLoc.Latitude}`);
    if (LatLon && LatLon.data) {
        lat = LatLon.data.waypoints[0].location[1];
        lon = LatLon.data.waypoints[0].location[0];
    }

    return {
        lat: lat ? lat : 0,
        lon: lon ? lon : 0,
        country: geoLoc.CountryShort, // zipCode.Country,
        state: geoLoc.StateShort ? geoLoc.StateShort : state,
        stateLong: geoLoc.StateLong ? geoLoc.StateLong : state,
        // zip: zipCode.PostalCode,
        city: geoLoc.CityLong ? geoLoc.CityLong : city,
        // timeWindowFrom: date.from+'Z',
        // timeWindowTo: date.to+'Z'
        timeWindowFrom: date.from + 'Z',
        timeWindowTo: date.to + 'Z'
    };
}
async function getEndUpload(cityState, date, start, deliveryCompany, timezone) {
    if (cityState.toLowerCase() == 'anywhere') {
        return undefined;
    }

    const cityStateArr = cityState.split(',');
    const city = cityStateArr.length > 0 ? cityStateArr[0].trim() : undefined;
    const state = cityStateArr.length > 1 ? cityStateArr[1].trim() : undefined;

    const geoLoc = await Helper.getGeoLoc(cityState);
    if (!geoLoc) {
        return false;
    }




    let lat, lon;
    let LatLon = await osrm.OSRMGeoLoc(`${geoLoc.Longitude},${geoLoc.Latitude}`);

    if (LatLon && LatLon.data) {
        lat = LatLon.data.waypoints[0].location[1];
        lon = LatLon.data.waypoints[0].location[0];
    }

    const distData = {
        pickupLat: start.lat,
        pickupLon: start.lon,
        deliveryLat: lat,
        deliveryLon: lon
    };

    const { distDur, msg, ddStatus } = await Warnings.createOrder(distData);

    const distanceResult = ddStatus ? distDur.distance : 0;

    let dayRange = 0;
    let stopCount = 0;

    let x = (distDur.duration / 1609) / 14;

    if (x > 1) {
        dayRange = x;
        let y = x - Math.floor(x);
        stopCount = x * 10 + (x * 0.3);
        if (y >= 0.8) stopCount += 0.3;
    }

    const days = Math.round(dayRange + Math.round(stopCount / 24));

    date = Helper.getDateObjectDATUploadDelivery(date, days, timezone);

    return {
        lat: lat ? lat : 0,
        lon: lon ? lon : 0,
        country: geoLoc.CountryShort, // zipCode.Country,
        state: geoLoc.StateShort ? geoLoc.StateShort : state,
        stateLong: geoLoc.StateLong ? geoLoc.StateLong : state,
        // zip: zipCode.PostalCode,
        city: geoLoc.CityLong ? geoLoc.CityLong : city,
        company: deliveryCompany,
        // timeWindowFrom: date.from+'Z',
        // timeWindowTo: date.to+'Z'
        timeWindowFrom: date.from + 'Z',
        timeWindowTo: date.to + 'Z'
    };
}

async function createPlaningOrder(order, orderId, userId) {
    const planingOrder = new PlaningOrder();
    planingOrder.capacityId = orderId;
    planingOrder.creator = userId;
    planingOrder.isCapacity = true;
    await planingOrder.save();
}

async function updatePlaningOrder(orderId) {
    const planingOrder = await PlaningOrder.findOne({ capacityId: orderId });
    const capacity = await CapacityBoard.findById(orderId);
    planingOrder.status = constants.OrderStatusType.changed;
    planingOrder.changes.push(capacity.order);
    planingOrder.updateDate = new Date();

    await planingOrder.save();
}

async function checkingDeletedCapacity(capacityId, userId) {
    const planingOrder = await PlaningOrder.findOne({ creator: userId, isCapacity: true });

    let filter = {};
    filter['stops._id'] = new ObjectID(capacityId);

    const matchingList = await PlanningModel.find(filter);

    console.log(matchingList, 'list');

    if (matchingList) {
        console.log(matchingList.length);
    }

}

module.exports = class CapacityBoardClass {

    // create
    async create(data, user) {
        let createdOrders = [];
        let warning, message;
        for (const order of data.orders) {
            warning = false, message = "ok";
            let start, end = null, dist, ddStat;

            const startCity = await Cities.findById(order.pickupCityId);
            if (startCity) order.pickupCity = startCity.city;

            start = await getStartAddress(order);
            if (start === false) {
                return {
                    status: 0,
                    warning: true,
                    msg: 'Can not identify pickup location'
                };
            }
            start.state = order.pickupState;
            start.locationType = order.pickupLocationType;
            start.accessorial = order.pickupAccessorials;
            if (!order.deliveryAddress) {
                const endCity = await Cities.findById(order.deliveryCityId);
                if (endCity) order.deliveryCity = endCity.city;


                end = await getEndAddress(order);
                if (end) {
                    let distData = {
                        pickupLat: start.lat,
                        pickupLon: start.lon,
                        deliveryLat: end.lat,
                        deliveryLon: end.lon
                    };
                    end.state = order.deliveryState;
                    end.locationType = order.deliveryLocationType;
                    end.accessorial = order.deliveryAccessorials;
                    let { distDur, msg, ddStatus } = await Warnings.createOrder(distData);
                    if (!ddStatus) {
                        warning = true;
                        message = msg;
                    }

                    dist = distDur, ddStat = ddStatus;
                }

            }
            const equipment = {
                _id: order.eqId ? order.eqId : 0,
                id: order.eqId ? order.eqId : 0,
                size: order.eqSize ? order.eqSize : 0,
                weight: order.eqWeight ? order.eqWeight : 0,
            };
            let equipment0, capacityBoardName;
            if (order.eqId) {
                equipment0 = await Equipment.findById(order.eqId);
                if (equipment0) {
                    equipment['typeName'] = equipment0.typeName;
                    equipment['code'] = equipment0.code;
                    equipment['name'] = equipment0.typeName ? `${equipment0.code} - ${equipment0.typeName}` : equipment0.code;
                } else {
                    equipment['name'] = order.eqId ? order.eqId : 0;
                }
            }
            capacityBoardName = await Helper.generateLoadOrCapacityName({
                code: equipment.code,
                type: 'C'
            });
            let perMileRate = Number(order.perMileRate);
            if (isNaN(perMileRate)) {
                perMileRate = 0;
            }
            const distanceResult = ddStat ? dist.distance : 0;

            // get next unique number
            let nextNumber = await CapacityBoard.find({}, { number: 1 }).sort({ number: -1 }).limit(1);
            nextNumber = nextNumber.number ? nextNumber.number + 1 : 1;

            const capacityBoard = new CapacityBoard({
                number: nextNumber,
                order: {
                    equipment: equipment,
                    name: capacityBoardName,
                    // product: o.productDescription,        // Object,
                    locationtype: order.locationtype,
                    availableSize: order.SizeAvailable ? order.SizeAvailable : 0,
                    usedSize: order.SizeUsed ? order.SizeUsed * 1 : 0,
                    availableWeight: order.WeightAvailable ? order.WeightAvailable : 0,
                    usedWeight: order.WeightUsed ? order.WeightUsed * 1 : 0,
                    loadPriceType: order.loadPriceType,
                    flatRate: order.loadPriceType === LoadPriceType.flatRate ? order.flatRate * 1 : getFlatRate(distanceResult, perMileRate),
                    perMileRate: order.loadPriceType === LoadPriceType.perMileRate ? perMileRate : getPerMaleRate(distanceResult, order.flatRate),
                    perMileRateTotal: perMileRate && distanceResult ? perMileRate * (distanceResult / 1609) : 0,

                    start: start, // getStartAddress(order),
                    end: end ? end : null, // getEndAddress(order),

                    distance: distanceResult ? distanceResult : 0, // ddStatus ? distDur.distance : 0,           // (calculate)
                    postedDate: new Date(),

                    notes: order.notes,
                    servicetime: order.servicetime ? order.servicetime : 1

                    // contact: {
                    //     telephone: String,
                    //     email: String,
                    //     person: String
                    // }
                },
                publishedBy: {
                    userType: user.type, // broker, shipper, carrier
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    username: user.username
                    // dbName: String,
                    // phone: String,
                    // contactPerson: String,
                    // email: String
                },
            });

            await capacityBoard.save();
            await createPlaningOrder(capacityBoard.order, capacityBoard._id, user.id);

            createdOrders.push(capacityBoard);
        }

        return {
            status: 1,
            warning,
            msg: warning ? message : "ok",
        };
    }

    async createForMobile(data, user) {
        let obj = {}, warning, message, start, end = null, dist, ddStat;

        const startCity = await Cities.findById(data.start.cityId);
        const endCity = await Cities.findById(data.end.cityId);

        if (startCity) data.start.city = startCity.city;
        if (endCity) data.end.city = endCity.city;


        start = await Helper.getAddressForMobile(data.start);
        end = data.end ? await Helper.getAddressForMobile(data.end) : null;
        if (start === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify pickup location'
            };
        }
        start.locationType = data.start.locationType;
        start.accessorial = data.start.accessorial;
        if (data.end) {
            const distData = {
                pickupLat: start.lat,
                pickupLon: start.lon,
                deliveryLat: end.lat,
                deliveryLon: end.lon
            };
            const { distDur, msg, ddStatus } = await Warnings.createOrder(distData);
            if (!ddStatus) {
                warning = true,
                    message = msg;
            }
            dist = distDur;
            ddStat = ddStatus;
        }
        end.locationType = data.end.locationType;
        end.accessorial = data.end.accessorial;
        let perMileRate = Number(data.perMileRate);
        if (isNaN(perMileRate)) {
            perMileRate = 0;
        }
        const distanceResult = ddStat ? dist.distance : 0;
        let nextNumber = await CapacityBoard.find({}, { number: 1 }).sort({ number: -1 }).limit(1);
        nextNumber = nextNumber.number ? nextNumber.number + 1 : 1;
        obj = {
            number: nextNumber,
            order: {
                ...data,
                start: start,
                end: end,
                locationType: data.locationType,
                loadPriceType: data.loadPriceType,
                distance: distanceResult ? distanceResult : 0,
                flatRate: data.loadPriceType === LoadPriceType.flatRate ? data.flatRate * 1 : getFlatRate(distanceResult, data.perMileRate),
                perMileRate: data.loadPriceType === LoadPriceType.perMileRate ? data.perMileRate : getPerMaleRate(distanceResult, data.flatRate),
                perMileRateTotal: perMileRate && distanceResult ? perMileRate * (distanceResult / 1609) : 0,
                postedDate: new Date()
            },
            publishedBy: {
                userType: user.type, // broker, shipper, carrier
                userId: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                phone: user.phone
            }
        };
        const capacityBoard = new CapacityBoard(obj);
        await createPlaningOrder(capacityBoard.order, capacityBoard._id, user.id);

        await capacityBoard.save();
        return {
            status: 1,
            warning,
            msg: warning ? message : "ok"
        };
    }

    // upload crate DAT
    async createUploadDAT(data, user, timezone) {
        // size
        let size = data.size && data.size != '—' ? Number(data.size) : 0
        if (size == 0 || isNaN(size)) {
            return 'Incorrect size';
        }
        // console.size('- size: ', size)

        // weight
        let weight = data.weight && data.weight != '—' ? Number(data.weight) : 0
        if (weight == 0 || isNaN(weight)) {
            return 'Incorrect weight';
        }

        // start end
        const start = await getStartUpload(data.fromCityState, data.pickupdateFrom, timezone);
        if (start === false) {
            return 'Can not identify pickup location';
        }
        const end = await getEndUpload(data.toCityState, data.pickupdateFrom, start, data.deliveryCompany, timezone); // pickupdateFrom changed to pickupdateTo
        if (end === false) {
            return 'Can not identify delivery location'
        }

        // equipment
        const equipment = {
            code: data.equipmentCode,
            name: data.equipmentCode,
            feet: data.size,
            weight: data.weight
        };
        let equipment0 = await Equipment.findOne({ code: new RegExp(`^${data.equipmentCode}$`, 'i') });
        if (equipment0) {
            equipment['_id'] = equipment0._id.toString()
            equipment['id'] = equipment0._id.toString()
            equipment['typeName'] = equipment0.typeName
            if (equipment0.typeName) {
                equipment.name = `${equipment.code} - ${equipment.typeName}`;
            }
        } else {
            // create new equipment
            equipment0 = await new EquipmentClass().create({ code: data.equipmentCode });
            if (equipment0) {
                equipment['_id'] = equipment0._id.toString();
                equipment['id'] = equipment0.id
            }
        }
        // let equipment = await Equipment.findOne({ code: data.equipmentCode })
        // if(!equipment){
        //     equipment = { 
        //         code: data.equipmentCode
        //     }
        // }
        // equipment.name = equipment.typeName ? `${equipment.code} - ${equipment.typeName}` : equipment.code

        // distance
        const { distDur, ddStatus } = !end ? { ddStatus: false } : await Warnings.createOrder({
            pickupLat: start.lat,
            pickupLon: start.lon,
            deliveryLat: end.lat,
            deliveryLon: end.lon
        });
        const distanceResult = ddStatus ? distDur.distance : 0;

        let nextNumber = await CapacityBoard.findOne({}, { number: 1 }).sort({ number: -1 }).limit(1)
        nextNumber = nextNumber && nextNumber.number ? nextNumber.number + 1 : 1
        const name = await Helper.generateLoadOrCapacityName({
            code: equipment0.code,
            type: 'C'
        });
        const capacityBoard = new CapacityBoard({
            number: nextNumber,
            name: name,
            type: 0,
            order: {
                equipment: equipment,
                name: name,
                availableSize: equipment.feet,
                usedSize: 0,
                availableWeight: equipment.weight,
                usedWeight: 0,

                flatRate: 0,
                perMileRate: 0,
                perMileRateTotal: 0 * distanceResult,

                start: start,
                end: end,

                distance: distanceResult,
                postedDate: new Date(),

                notes: data.notes,
                servicetime: 1200
                // contact: {
                //     telephone: String,
                //     email: String,
                //     person: String
                // }
            },
            publishedBy: {
                userType: user.type, // broker, shipper, carrier
                userId: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                company: user.company,
                phone: user.phone
                // dbName: String,
                // phone: String,
                // contactPerson: String,
                // email: String
            },
        });

        // console.log(' --- ', capacityBoard)

        await createPlaningOrder(capacityBoard.order, capacityBoard._id, user.id);

        await capacityBoard.save();

        return capacityBoard;
    }

    // edit
    async edit(id, data) {
        let editOrders = [];
        let warning, message, warningArray = [];
        for (const order of data.orders) {
            warning = false, message = "ok";
            let orderObj;
            let start, end = null, dist, ddStat;

            const startCity = await Cities.findById(order.pickupCityId);
            if (startCity) order.pickupCity = startCity.city;

            start = await getStartAddress(order);
            if (start === false) {
                return {
                    status: 0,
                    warning: true,
                    msg: 'Can not identify pickup location'
                };
            }
            start.state = order.pickupState;
            start.locationType = order.pickupLocationType;
            start.accessorial = order.pickupAccessorials;
            if (!order.deliveryAddress) {

                const endCity = await Cities.findById(order.pickupCityId);
                if (endCity) order.pickupCity = endCity.city;

                end = await getEndAddress(order);

                const distData = {
                    pickupLat: start.lat,
                    pickupLon: start.lon,
                    deliveryLat: end.lat,
                    deliveryLon: end.lon
                };
                end.state = order.deliveryState;
                end.locationType = order.deliveryLocationType;
                end.accessorial = order.deliveryAccessorials;
                const { distDur, msg, ddStatus } = await Warnings.createOrder(distData);
                if (!ddStatus) {
                    warning = true,
                        message = msg;
                }
                dist = distDur, ddStat = ddStatus;
            }


            const equipment = {
                _id: order.eqId ? order.eqId : 0,
                id: order.eqId ? order.eqId : 0,
                size: order.eqSize ? order.eqSize : 0,
                weight: order.eqWeight ? order.eqWeight : 0
            };
            if (order.eqId) {
                const equipment0 = await Equipment.findById(order.eqId);
                if (equipment0) {
                    equipment['typeName'] = equipment0.typeName;
                    equipment['code'] = equipment0.code;
                    equipment['name'] = equipment0.typeName ? `${equipment0.code} - ${equipment0.typeName}` : equipment0.code;
                } else {
                    equipment['name'] = order.eqId;
                }
            }

            let perMileRate = Number(order.perMileRate);
            if (isNaN(perMileRate)) {
                perMileRate = 0;
            }
            const distanceResult = ddStat ? dist.distance : 0;
            const capacityBoardName = await Helper.generateLoadOrCapacityName({
                code: equipment.code,
                type: 'C'
            });
            let cBoard = await CapacityBoard.findOne({ _id: id });
            orderObj = {
                equipment: equipment,
                name: capacityBoardName,
                locationtype: order.locationtype,
                availableSize: order.SizeAvailable ? order.SizeAvailable : 0,
                usedSize: order.SizeUsed ? order.SizeUsed * 1 : 0,
                availableWeight: order.WeightAvailable ? order.WeightAvailable : 0,
                usedWeight: order.WeightUsed ? order.WeightUsed * 1 : 0,
                loadPriceType: order.loadPriceType,
                flatRate: order.loadPriceType === LoadPriceType.flatRate ? order.flatRate * 1 : getFlatRate(distanceResult, perMileRate),
                perMileRate: order.loadPriceType === LoadPriceType.perMileRate ? perMileRate : getPerMaleRate(distanceResult, order.flatRate),
                perMileRateTotal: perMileRate && distanceResult ? perMileRate * (distanceResult / 1609) : 0,

                start: start,
                end: end,

                distance: distanceResult ? distanceResult : 0,
                postedDate: cBoard.order.postedDate,

                notes: order.notes,
                servicetime: order.servicetime ? order.servicetime : 1
            };
            const capacityBoard = await CapacityBoard.findOneAndUpdate({ _id: id }, {
                order: orderObj
            }, { new: true });
            await updatePlaningOrder(id);
            let planning;
            planning = await PlanningModel.find({
                orderIdsArr: { $in: [id] }
            });
            if (planning) {
                await Helper.editGroupStops({
                    orderId: id,
                    plannings: planning
                }, true);
            }

            editOrders.push(capacityBoard);
        }

        return {
            status: 1,
            warnings: warningArray,
            warning: warningArray.length ? true : false,
            msg: 'ok',
            capacityBoard: editOrders[0]
        };
    }

    async editForMobile(id, data) {
        let obj = data, warning, message, start, end = null, dist, ddStat;

        const startCity = await Cities.findById(data.start.cityId);

        if (startCity) data.start.city = startCity.city;

        start = await Helper.getAddressForMobile(data.start);

        if (start === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify pickup location'
            };
        }
        start.locationType = data.start.locationType;
        start.accessorial = data.start.accessorial;

        if (obj.end) {
            const endCity = await Cities.findById(data.end.cityId);
            if (endCity) data.end.city = endCity.city;

            end = await Helper.getAddressForMobile(data.end);
            const distData = {
                pickupLat: start.lat,
                pickupLon: start.lon,
                deliveryLat: end.lat,
                deliveryLon: end.lon
            };
            const { distDur, msg, ddStatus } = await Warnings.createOrder(distData);
            if (!ddStatus) {
                warning = true,
                    message = msg;
            }
            dist = distDur;
            ddStat = ddStatus;
            end.locationType = data.end.locationType;
            end.accessorial = data.end.accessorial;
        }
        let perMileRate = Number(data.perMileRate);
        if (isNaN(perMileRate)) {
            perMileRate = 0;
        }
        const distanceResult = ddStat ? dist.distance : 0;
        obj.order = {
            ...data,
            start: start,
            end: end,
            locationType: data.locationType,
            loadPriceType: data.loadPriceType,
            distance: distanceResult ? distanceResult : 0,
            flatRate: data.loadPriceType === LoadPriceType.flatRate ? data.flatRate * 1 : getFlatRate(distanceResult, data.perMileRate),
            perMileRate: data.loadPriceType === LoadPriceType.perMileRate ? data.perMileRate : getPerMaleRate(distanceResult, data.flatRate),
            perMileRateTotal: perMileRate && distanceResult ? perMileRate * (distanceResult / 1609) : 0
        };

        const capacityBoard = await CapacityBoard.findOneAndUpdate({ _id: id }, {
            order: obj.order
        }, { new: true });
        await updatePlaningOrder(id);

        let planning;
        planning = await PlanningModel.find({
            orderIdsArr: { $in: [id] }
        });
        if (planning) {
            await Helper.editGroupStops({
                orderId: id,
                plannings: planning
            }, true);
        }
        return {
            status: 1,
            warning,
            msg: warning ? message : "ok"
        };
    }

    // delete
    async delete(ids, user) {

        if (!!ids.length) {
            const list = await PlaningOrder.find({ capacityId: { $in: ids } }).populate('capacityId');
            console.log(list[0]);
            if (list.length) {
                await Promise.all(list.map(async item => {

                    const matches = await PlanningModel.find({ 'stops._id': item.capacityId._id });

                    if (matches.length) {
                        console.log('gtavvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv');
                        await Promise.all(matches.map(async item => {
                            if (item.stops.length <= 2) {
                                let filter = {};
                                await PlanningModel.deleteOne({ _id: item._id }, function (err) {
                                    if (err) return err;
                                });
                            }
                        }));
                    }
                    item.capacityId.deleted = true;
                    item.status = constants.OrderStatusType.deleted;
                    item.updateDate = new Date();
                    await item.capacityId.save();
                    await item.save();
                    return 1
                }));
            } else {
                const capacityList = await CapacityBoard.find({ _id: { $in: ids } });
                if (!!capacityList.length) {
                    await Promise.all(capacityList.map(async item => {
                        item.deleted = true;
                        await item.save();
                    }));
                }
            }
        } else {

            const list = await CapacityBoard.find({ 'publishedBy.userId': user.id });

            if (list.length) {
                await Promise.all(list.map(async item => {
                    
                    const matches = await PlanningModel.find({ 'stops._id': item.capacityId._id });

                    if (matches.length) {
                        await Promise.all(matches.map(async item => {
                            if (item.stops.length <= 2) {
                                PlanningModel.deleteOne({ _id: item._id }, function (err) {
                                    if (err) return err;
                                });
                            }
                        }));
                    }

                    await PlanningModel.deleteOne({ _id: item._id }, function (err) {
                        if (err) return err;
                    });

                }));
            }
            
            await PlaningOrder.deleteMany({ creator: user.id }, err => {
                return -1
            })
        }
        // await checkingDeletedCapacity(ids)
    }
};


// orders: [
//     {
//       id: null,
//       flowType: 3,
//       depoid: null,
//       pickupCompanyName: '',
//       pickupDepoName: '',
//       pickupState: '',
//       pickupCity: '',
//       pickupCountry: 'ca',
//       pickupStreetAddress: '',
//       pickupZip: '',
//       pickupLocationtype: null,
//       pickupDate: '',
//       pickupdateFrom: '',
//       pickupdateTo: '',
//       pickupLat: '',
//       pickupLon: '',
//       pickupAccessorials: null,
//       vendorId: null,
//       vendorAddressId: null,
//       consigneeId: null,
//       consigneeAddressId: null,
//       deliveryCompanyName: '',
//       deliveryDepoName: '',
//       deliveryState: '',
//       deliveryCity: '',
//       deliveryCountry: 'ca',
//       deliveryStreetAddress: '',
//       deliveryZip: '',
//       deliveryLocationtype: null,
//       deliveryDate: '',
//       deliverydateFrom: '',
//       deliverydateTo: '',
//       deliveryLat: '',
//       deliveryLon: '',
//       deliveryAccessorials: null,
//       deliveryDepoId: null,
//       distance: 0,
//       eqType: '',
//       distributionModel: '',
//       bol: '',
//       pro: '',
//       po: '',
//       notes: '',
//       products: [Array]
//     }
//   ]
// }
// [
//   {
//     id: null,
//     HandlingType_id: null,
//     Quantity: '',
//     piecetype_id: null,
//     productdescription: '',
//     Weight: '123',
//     weightType: 'Feet',
//     WeightFull: '9456',
//     weightFullType: 'Feet',
//     Length: '',
//     Width: '',
//     Height: '',
//     unit: 'IN',
//     sku: '',
//     volume: '',
//     brand: '',
//     specialneeds: '',
//     mintemperature: '',
//     maxtemperature: '',
//     density: '',
//     stackable: false,
//     turnable: false,
//     sku: '',
//     volume: '',
//     brand: '',
//     specialneeds: '',
//     mintemperature: '',
//     maxtemperature: '',
//     density: '',
//     stackable: false,
//     turnable: false,
//     images: [],
//     removedImages: []
//   }
// ]