const db = require('../config/db.config.js');
const Settings = db.settings;

// const Equipment = db.equipment;
const Equipment = require('../mongoModels/EquipmentModel');
const Warnings = require('../warnings/orderWarnings');
const ZipCode = require('../mongoModels/ZipCodesModel');
const LoadBoard = require('../mongoModels/LoadBoardModel');
const Helper = require('./helpers');
const moment = require('moment');
const osrm = require('../controller/osmap.controller');

const EquipmentClass = require('./equipment');
const PlanningModel = require('../mongoModels/PlanningModel.js');
const Calculation = require('./flatbedCalc');
const Cities = require('../mongoModels/CitiesModel');
const constants = require('../constants');
const PlaningOrder = require('../mongoModels/PlaningOrders');
const Order = db.order;
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
        zip: o.pickupZip,
        cityId: o.pickupCityId,
        street: o.pickupStreetAddress,
        accessorials: o.pickupAccessorials ? o.pickupAccessorials : 0,
        // nsew: String,               // N / S / E / W
        timeWindowFrom: o.pickupdateFrom,
        timeWindowTo: o.pickupdateTo,

        company: o.pickupCompanyName
    };
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
}



// async function getStartAddress(o){
//     const pLatLon = await getLatLonByZip(o.pickupCountry, o.pickupZip)
//     // console.log(pLatLon)

//     return {
//         lat: pLatLon.lat, // o.pickupLat,
//         lon: pLatLon.lon, // o.pickupLon,
//         country: o.pickupCountry,
//         state: o.pickupState,
//         zip: o.pickupZip,
//         city: o.pickupCity,
//         street: o.vendorAddressId, // deliveryStreetAddress,
//         accessorials: o.pickupAccessorials,
//         //accessorials: o.accessorials,
//         // nsew: String,               // N / S / E / W    
//         timeWindowFrom: new Date(o.pickupdateFrom),
//         timeWindowTo: new Date(o.pickupdateTo)
//     }
// }

// async function getEndAddress(o){
//     const dLatLon = await getLatLonByZip(o.deliveryCountry, o.deliveryZip)

//     return {
//         lat: dLatLon.lat, // o.deliveryLat,
//         lon: dLatLon.lon, // o.deliveryLon,
//         country: o.deliveryCountry,
//         state: o.deliveryState,
//         zip: o.deliveryZip,
//         city: o.deliveryCity,
//         accessorials: o.deliveryAccessorials,
//         street: o.consigneeAddressId,
//         timeWindowFrom: new Date(o.deliverydateFrom),
//         timeWindowTo: new Date(o.deliverydateTo)
//         // nsew: String,               // N / S / E / W    
//     }
// }

// async function getLatLonByZip(country, zip){
//     const filter = {
//         Country: country.toUpperCase(),
//         PostalCode: zip
//     }

//     if(filter.Country.toUpperCase() == 'CA'){
//         filter.PostalCode.zip = zip.substr(0,3)
//     }

//     const zipCode = await ZipCode.findOne(filter)

//     if(zipCode){
//         return {
//             lat: zipCode.Latitude,
//             lon: zipCode.Longitude
//         }
//     }

//     return {
//         lat: 0,
//         lon: 0
//     }

//     // const { data } = await osrm.GeoLocByZip(zip)
//     // lat = data.results[0].geometry.location.lat;
//     // lon = data.results[0].geometry.location.lng;
//     // return {
//     //     lat,
//     //     lon
//     // }
// }




// DAT upload
async function getStartUpload(cityState, date, timezone) {
    const cityStateArr = cityState.split(',');
    const city = cityStateArr.length > 0 ? cityStateArr[0].trim() : undefined;
    const state = cityStateArr.length > 1 ? cityStateArr[1].trim() : undefined;
    // let shortState;
    // if (state) {
    //     shortState = await Helper.findState({state});
    // }
    let geoLoc;
    geoLoc = await Helper.getGeoLoc(cityState);

    if (!geoLoc) {
        return false;
    }


    let lat, lon;
    let LatLon = await osrm.OSRMGeoLoc(`${geoLoc.Longitude},${geoLoc.Latitude}`);
    lat = LatLon.data.waypoints[0].location[1];
    lon = LatLon.data.waypoints[0].location[0];

    date = Helper.getDateObjectDATUpload(date, timezone);

    return {
        lat: lat ? lat : 0,
        lon: lon ? lon : 0,
        country: geoLoc.CountryShort, // zipCode.Country,
        state: geoLoc.StateShort ? geoLoc.StateShort : state,
        stateLong: geoLoc.StateLong ? geoLoc.StateLong : state,
        // zip: zipCode.PostalCode,
        city: geoLoc.CityLong ? geoLoc.CityLong : city,
        // timeWindowFrom: date.from + 'Z',
        // timeWindowTo: date.to + 'Z'
        timeWindowFrom: date.from + 'Z',
        timeWindowTo: date.to + 'Z'
    };
}
async function getEndUpload(cityState, start, date, deliveryCompany, timezone) {
    const cityStateArr = cityState.split(',');
    const city = cityStateArr.length > 0 ? cityStateArr[0].trim() : undefined;
    const state = cityStateArr.length > 1 ? cityStateArr[1].trim() : undefined;

    // get lat lon
    // const filter = {
    //     Country: { $in: ['US', 'CA']},
    //     LocationName: new RegExp(`^${city}$`, 'i')
    // }

    // let zipCode = await ZipCode.findOne(filter)

    // if(!zipCode){
    //     zipCode = await getGeoLoc(cityState)
    //     if(!zipCode){
    //         return false
    //     }
    // }

    const geoLoc = await Helper.getGeoLoc(cityState)
    if (!geoLoc) {
        return false
    }

    let lat, lon;
    let LatLon = await osrm.OSRMGeoLoc(`${geoLoc.Longitude},${geoLoc.Latitude}`);
    lat = LatLon.data.waypoints[0].location[1];
    lon = LatLon.data.waypoints[0].location[0];


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
        // timeWindowFrom: date.from + 'Z',
        // timeWindowTo: date.to + 'Z'
        timeWindowFrom: date.from + 'Z',
        timeWindowTo: date.to + 'Z'
    };
}

async function createPlaningOrder(order, orderId, userId) {
    const planingOrder = new PlaningOrder();
    planingOrder.loadId = orderId;
    planingOrder.creator = userId;
    await planingOrder.save();
}

async function updatePlaningOrder(orderId) {
    const planingOrder = await PlaningOrder.findOne({ loadId: orderId });
    const load = await LoadBoard.findById(orderId);
    planingOrder.status = constants.OrderStatusType.changed;
    planingOrder.changes.push(load.order);
    planingOrder.updateDate = new Date();

    await planingOrder.save();
}

module.exports = class LoadBoardClass {

    async create(data, user) {
        let createdOrders = [];
        let warning, message;
        // const settings = await Settings.findOne({
        //     where: {
        //         userId: user.id
        //     }
        // });
        warning = false, message = "ok";
        const startCity = await Cities.findById(data.pickupCityId);
        if (startCity) data.pickupCity = startCity.city;
        const start = await getStartAddress(data);
        if (start === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify pickup location'
            };
        }
        start.state = data.pickupState;
        start.locationType = data.pickupLocationType;
        start.accessorial = data.pickupAccessorials;
        const endCity = await Cities.findById(data.deliveryCityId);
        if (endCity) data.deliveryCity = endCity.city;
        const end = await getEndAddress(data);
        if (end === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify delivery location'
            };
        }
        end.state = data.deliveryState;
        end.locationType = data.deliveryLocationType;
        end.accessorial = data.deliveryAccessorials;
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
        };
        const equipment = {
            _id: data.eqId,
            id: data.eqId
            // weight: order.eqWeight
        };
        let equipment0, loadBoardName;
        if (data.eqId) {
            equipment0 = await Equipment.findById(data.eqId);
            if (equipment0) {
                equipment['typeName'] = equipment0.typeName;
                equipment['code'] = equipment0.code;
                equipment['name'] = equipment0.typeName && equipment0.code ? `${equipment0.code} - ${equipment0.typeName}` : "";
            } else {
                equipment['name'] = data.eqId;
            }
        }
        loadBoardName = await Helper.generateLoadOrCapacityName({
            code: equipment.code,
            type: 'L'
        });
        let perMileRate = Number(data.perMileRate);
        if (isNaN(perMileRate)) {
            perMileRate = 0;
        }
        const distanceResult = ddStatus ? distDur.distance : 0;
        let nextNumber = await LoadBoard.find({}, { number: 1 }).sort({ number: -1 }).limit(1);
        nextNumber = nextNumber.number ? nextNumber.number + 1 : 1;
        const loadBoard = new LoadBoard({
            
            number: nextNumber,
            type: data.isPrivate ? data.isPrivate : 0,
            loadType: data.loadType ? data.loadType : "Partial",
            order: {
                // orderId: 0,
                name: loadBoardName,
                locationType: data.locationType,
                equipment: equipment,
                // product: o.productDescription,        // Object,

                size: data.Size ? Number(data.Size) : 0,
                weight: data.Weight ? Number(data.Weight) : 0,

                // size: Number,
                // weight: Number,   
                // poolNoPool: String,     
                loadPriceType: data.loadPriceType,
                flatRate: data.loadPriceType === LoadPriceType.flatRate ? data.flatRate * 1 : getFlatRate(distanceResult, perMileRate),
                perMileRate: data.loadPriceType === LoadPriceType.perMileRate ? perMileRate : getPerMaleRate(distanceResult, data.flatRate),
                perMileRateTotal: perMileRate * (distanceResult / 1609),

                start: start, // getStartAddress(order),
                end: end, // getEndAddress(order),

                distance: distanceResult ? distanceResult : 0, // ddStatus ? distDur.distance : 0,           // (calculate)
                postedDate: new Date(),

                HandlingType_id: data.HandlingType_id ? data.HandlingType_id : "0",
                Quantity: data.Quantity ? data.Quantity : 0,

                notes: data.notes,
                servicetime: data.servicetime ? data.servicetime : 1

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


        await createPlaningOrder(loadBoard, loadBoard._id, user._id);

        console.log(loadBoard._id);
        await loadBoard.save();

        createdOrders.push(loadBoard);


        return {
            status: 1,
            warning,
            msg: warning ? message : 'ok'
        };
    }

    async createForMobile(data, user) {
        let warning, message, start, end = null;
        const startCity = await Cities.findById(data.order.start.cityId);
        const endCity = await Cities.findById(data.order.end.cityId);

        if (startCity) data.order.start.city = startCity.city;
        if (endCity) data.order.end.city = endCity.city;

        start = await Helper.getAddressForMobile(data.order.start);
        end = await Helper.getAddressForMobile(data.order.end);
        if (start === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify pickup location'
            };
        }
        start.state = data.order.start.state;
        start.locationType = data.order.start.locationType;
        start.accessorial = data.order.start.accessorial;
        if (end === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify delivery location'
            };
        }
        end.state = data.order.end.state;
        end.locationType = data.order.end.locationType;
        end.accessorial = data.order.end.accessorial;
        const distData = {
            pickupLat: start.lat,
            pickupLon: start.lon,
            deliveryLat: end.lat,
            deliveryLon: end.lon
        };
        const { distDur, msg, ddStatus } = await Warnings.createOrder(distData);
        //console.log(' - dd', distDur,ddStatus)
        if (!ddStatus) {
            warning = true,
                message = msg;
        }
        let perMileRate = data.order.perMileRate;
        if (isNaN(perMileRate)) {
            perMileRate = 0;
        }
        const distanceResult = ddStatus ? distDur.distance : 0;
        const equipment = {
            ...data.order.equipment,
            id: data.order.equipment._id
        };
        // get next unique number
        let nextNumber = await LoadBoard.find({}, { number: 1 }).sort({ number: -1 }).limit(1);
        nextNumber = nextNumber.number ? nextNumber.number + 1 : 1;
        const loadBoard = new LoadBoard({
            number: nextNumber,
            type: data.type ? data.type : 0,
            loadPriceType: data.order.loadPriceType,
            loadType: data.loadType ? data.loadType : "Partial",
            order: {
                ...data.order,
                equipment: equipment,
                locationType: data.order.locationType,
                flatRate: data.order.loadPriceType === LoadPriceType.flatRate ? data.order.flatRate * 1 : getFlatRate(distanceResult, data.order.perMileRate),
                perMileRate: data.order.loadPriceType === LoadPriceType.perMileRate ? data.order.perMileRate : getPerMaleRate(distanceResult, data.order.flatRate),
                perMileRateTotal: perMileRate * (distanceResult / 1609),
                start: start,
                end: end,
                distance: distanceResult ? distanceResult : 0,
                postedDate: new Date(),
            },
            publishedBy: {
                userType: user.type, // broker, shipper, carrier
                userId: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                phone: user.phone
            },
        });
        await createPlaningOrder(loadBoard, loadBoard._id, user._id);
        console.log(loadBoard, 'loadboard ----------------------------------------------------');
        await loadBoard.save();
        return {
            status: 1,
            warning,
            msg: warning ? message : 'ok'
        };
    }

    // upload crate DAT
    async createUploadDAT(data, user, timezone) {
        // size
        let size = data.size && data.size != '—' ? Number(data.size) : 0
        if (size == 0 || isNaN(size)) {
            return 'Incorrect size'
        }
        // console.size('- size: ', size)

        // weight
        let weight = data.weight && data.weight != '—' ? Number(data.weight) : 0
        if (weight == 0 || isNaN(weight)) {
            return 'Incorrect weight'
        }

        // start end
        const start = await getStartUpload(data.fromCityState, data.pickupdateFrom, timezone);
        if (start === false) {
            return 'Can not identify pickup location'
        }

        const end = await getEndUpload(data.toCityState, start, data.pickupdateFrom, data.deliveryCompany, timezone);
        if (end === false) {
            return 'Can not identify delivery location'
        }

        // equipment
        const equipment = {
            code: data.equipmentCode,
            name: data.equipmentCode
        }
        let equipment0 = await Equipment.findOne({ code: new RegExp(`^${data.equipmentCode}$`, 'i') })
        if (equipment0) {
            equipment['_id'] = equipment0._id.toString()
            equipment['id'] = equipment0._id.toString()
            equipment['typeName'] = equipment0.typeName
            if (equipment0.typeName) {
                equipment.name = `${equipment.code} - ${equipment.typeName}`
            }
        } else {
            // create new equipment
            equipment0 = await new EquipmentClass().create({ code: data.equipmentCode })
            if (equipment0) {
                equipment['_id'] = equipment0._id.toString()
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
        const distData = {
            pickupLat: start.lat,
            pickupLon: start.lon,
            deliveryLat: end.lat,
            deliveryLon: end.lon
        }
        const { distDur, msg, ddStatus } = await Warnings.createOrder(distData);
        const distanceResult = ddStatus ? distDur.distance : 0;
        // console.log(' - dd', distDur,ddStatus)

        // rate
        let rate = data.rate == "—" ? undefined : Number(data.rate)
        if (isNaN(rate)) {
            rate = undefined
        }

        // next unique number
        let nextNumber = await LoadBoard.findOne({}, { number: 1 }).sort({ number: -1 }).limit(1)
        // console.log('- nextNumber: ', nextNumber)
        nextNumber = nextNumber && nextNumber.number ? nextNumber.number + 1 : 1
        const name = await Helper.generateLoadOrCapacityName({
            code: equipment0.code,
            type: 'L'
        });
        // model
        const loadBoard = new LoadBoard({
            number: nextNumber,
            type: 0,

            loadType: data.loadType ? data.loadType : "Partial",
            order: {
                equipment: equipment,
                name: name,
                size: size,
                weight: weight,

                flatRate: rate,
                perMileRate: !!rate ? getPerMaleRate(distanceResult, rate) : 0,
                perMileRateTotal: rate || 0,

                start: start,
                end: end,

                distance: distanceResult,
                postedDate: new Date(),

                notes: data.notes,
                servicetime: 1200,
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
                username: user.username,
                company: user.company,
                email: user.email,
                phone: user.phone
                // dbName: String,
                // phone: String,
                // contactPerson: String,
                // email: String
            },
        })

        // console.log(' --- ', loadBoard)


        await loadBoard.save()
        await createPlaningOrder(loadBoard.order, loadBoard._id, user.id);

        // console.log('- done: ', loadBoard._id)

        return loadBoard
    }


    // edit
    async edit(id, data) {
        let editOrders = [];
        let warning, message;
        // console.log(' - data', data)
        if (!data.orders) {
            return {
                status: 0,
                msg: 'data.orders missing'
            };
        }

        const orders = Array.isArray(data.orders) ? data.orders : [data.orders];
        for (let order of orders) {
            warning = false, message = "ok";
            const startCity = await Cities.findById(order.pickupCityId);
            if (startCity) order.pickupCity = startCity.city;
            const start = await getStartAddress(order);
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

            const endCity = await Cities.findById(order.deliveryCityId);
            if (endCity) order.pickupCity = endCity.city;

            const end = await getEndAddress(order);
            if (end === false) {
                return {
                    status: 0,
                    warning: true,
                    msg: 'Can not identify delivery location'
                };
            }
            end.state = order.deliveryState;
            end.locationType = order.deliveryLocationType;
            end.accessorial = order.deliveryAccessorials;
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

            const equipment = {
                _id: order.eqId,
                id: order.eqId,
                size: order.eqSize,
                // weight: order.eqWeight
            };
            // if(order.eqId){
            //     const equipment0 = await Equipment.findOne({ _id: order.eqId })
            //     if(equipment0){
            //         equipment['typeName'] = equipment0.typeName
            //         equipment['code'] = equipment0.code
            //     }
            // }
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
            const distanceResult = ddStatus ? distDur.distance : 0;
            const loadBoardName = await Helper.generateLoadOrCapacityName({
                code: equipment.code,
                type: 'L'
            });
            const loadBoard = await LoadBoard.findById(id);
            loadBoard.type = order.isPrivate ? order.isPrivate : 0;
            loadBoard.loadType = order.loadType ? order.loadType : "Partial",
                loadBoard.order = {
                    company: {
                        id: 0,
                        deliveryCompanyName: order.deliveryCompanyName,
                        pickupCompanyName: order.pickupCompanyName
                    },
                    name: loadBoardName,
                    equipment: equipment,
                    locationType: order.locationType,
                    size: order.Size ? Number(order.Size) : 0,
                    weight: order.Weight ? Number(order.Weight) : 0,
                    loadPriceType: order.loadPriceType,
                    flatRate: order.loadPriceType === LoadPriceType.flatRate ? order.flatRate * 1 : getFlatRate(distanceResult, perMileRate),
                    perMileRate: order.loadPriceType === LoadPriceType.perMileRate ? perMileRate : getPerMaleRate(distanceResult, order.flatRate),
                    perMileRateTotal: perMileRate && distanceResult ? perMileRate * (distanceResult / 1609) : 0,

                    start: start,
                    end: end,

                    distance: distanceResult ? distanceResult : 0,
                    postedDate: loadBoard.order.postedDate,
                    servicetime: order.servicetime ? order.servicetime : 1,


                    HandlingType_id: order.HandlingType_id ? order.HandlingType_id : "0",
                    Quantity: order.Quantity ? order.Quantity : 0,

                    notes: order.notes

                };
            await LoadBoard.findOneAndUpdate({ _id: id }, loadBoard, { new: true });
            let planning;
            planning = await PlanningModel.find({
                orderIdsArr: { $in: [id] }
            });
            if (planning) {
                await Helper.editGroupStops({
                    orderId: id,
                    plannings: planning
                }, false);
            }

            editOrders.push(loadBoard);
        }

        await updatePlaningOrder(id);

        return {
            status: 1,
            warning,
            msg: warning ? message : 'ok',
            load: editOrders[0]
        };
    }

    async editForMobile(id, data) {
        let warning, message, start, end = null;

        const startCity = await Cities.findById(data.order.start.cityId);
        const endCity = await Cities.findById(data.order.end.cityId);

        if (startCity) data.order.start.city = startCity.city;
        if (endCity) data.order.end.city = endCity.city;

        start = await Helper.getAddressForMobile(data.order.start);
        end = await Helper.getAddressForMobile(data.order.end);
        if (start === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify pickup location'
            };
        }
        start.state = data.order.start.state;
        start.locationType = data.order.start.locationType;
        start.accessorial = data.order.start.accessorial;
        if (end === false) {
            return {
                status: 0,
                warning: true,
                msg: 'Can not identify delivery location'
            };
        }
        end.state = data.order.end.state;
        end.locationType = data.order.end.locationType;
        end.accessorial = data.order.end.accessorial;
        const distData = {
            pickupLat: start.lat,
            pickupLon: start.lon,
            deliveryLat: end.lat,
            deliveryLon: end.lon
        };
        const { distDur, msg, ddStatus } = await Warnings.createOrder(distData);
        //console.log(' - dd', distDur,ddStatus)
        if (!ddStatus) {
            warning = true,
                message = msg;
        }
        let perMileRate = data.order.perMileRate;
        if (isNaN(perMileRate)) {
            perMileRate = 0;
        }
        const distanceResult = ddStatus ? distDur.distance : 0;
        // get next unique number
        let orderObj = {
            ...data.order,
            perMileRate: data.order.loadPriceType === LoadPriceType.perMileRate ? data.order.perMileRate : getPerMaleRate(distanceResult, data.order.flatRate),
            flatRate: data.order.loadPriceType === LoadPriceType.flatRate ? data.order.flatRate : getFlatRate(distanceResult, data.order.perMileRate),
            perMileRateTotal: perMileRate * (distanceResult / 1609),
            start: start,
            locationType: data.order.locationType,
            end: end,
            loadPriceType: data.order.loadPriceType,
            distance: distanceResult ? distanceResult : 0,
        };
        let type = data.type ? data.type : 0;
        const loadBoard = await LoadBoard.findOneAndUpdate({ _id: id }, {
            type,
            loadType: data.loadType ? data.loadType : "Partial",
            order: orderObj
        }, { new: true });
        let planning;
        planning = await PlanningModel.find({
            orderIdsArr: { $in: [id] }
        });
        if (planning) {
            await Helper.editGroupStops({
                orderId: id,
                plannings: planning
            }, false);
        }

        await updatePlaningOrder(id);

        return {
            status: 1,
            warning,
            msg: warning ? message : 'ok'
        };
    }

    // delete
    async delete(ids, user) {
        if (!!ids.length) {
            const list =  await PlaningOrder.find({ loadId: { $in: ids } }).populate('loadId');
            console.log(list[0]);
            if (list.length) {
                await Promise.all(list.map(async item => {

                    const matches = await PlanningModel.find({ 'orderIdsArr': {$in: [item.loadId._id.toString()]} });

                    if (matches.length) {
                        await Promise.all(matches.map(async item => {
                            if (item.stops.length <= 2) {
                                await PlanningModel.deleteOne({ _id: item._id }, function (err) {
                                    if (err) return err;
                                });
                            }
                        }));
                    }

                    item.loadId.deleted = true;
                    item.status = constants.OrderStatusType.deleted;
                    item.updateDate = new Date();
                    await item.loadId.save();
                    await item.save();
                }));
            } else {

                const list = await LoadBoard.find({ 'publishedBy.userId': user.id });

                if (!!list.length) {
                    await Promise.all(list.map(async item => {

                        const matches = await PlanningModel.find({ 'orderIdsArr': {$in: [item._id]} });
                        console.log(item._id, 'item._id');
                        console.log(matches, 'matches');
                        if (matches.length) {
                            await Promise.all(matches.map(async x => {
                                if (x.stops.length <= 2) {
                                    PlanningModel.deleteOne({ _id: x._id }, function (err) {
                                        if (err) return err;
                                    });
                                }
                            }));
                            await PlanningModel.deleteOne({ _id: x._id }, function (err) {
                                if (err) return err;
                            });
                        }
                    }));
                } 
                // else {

                //     await LoadBoard.deleteMany({ 'publishedBy.userId': user.id }, err => {
                //         if (err) {
                //             // throw err
                //             return -1;
                //         }
                //         return 1;
                //     });

                //     await PlaningOrder.deleteMany({ creator: user.id }, err => {
                //         return -1
                //     })
                // }
            }
        }
    };
}
