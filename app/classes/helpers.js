const moment = require('moment');
const uuidv1 = require('uuid/v1');
const axios = require('axios');
const { URL } = require('url');
const bcrypt = require('bcryptjs');
const db = require('../config/db.config.js');
const mdb = require('../config/mongo.config');
const env = process.env.SERVER == 'local' ? require('../config/env.local') : require('../config/env');
const Checks = require('../classes/checks');
const { NorderAttrb } = require('../classes/joinColumns.js');
const Osmap = require('../controller/osmap.controller');
const ClassLoad = require('../classes/load');
const DriverClass = require('../classes/driver');
const Clients = require('../mongoModels/ClinetsModel');
const clientController = require('../mongoControllers/ClientsController');
const Mailer = require('../classes/mailer');
const LoadBoard = require('../mongoModels/LoadBoardModel');
const CapacityBoard = require('../mongoModels/CapacityBoardModel');
const fillters = require('../controller/fillters');
const Calculation = require('./flatbedCalc');
const Settings = require('../mongoModels/SettingsModel');
let { states } = require('../lib/states');
const User = db.user;
const UserRole = db.user_role;
const UserTypes = db.user_types;
const Op = db.Sequelize.Op;
const Job = db.job;
const Load = db.load;
const LoadTemp = db.loadTemp;
const Driver = db.driver;
const seq = db.sequelize;
const Order = db.order;
const Depo = db.depo;
const Shift = db.shift;
const Hunit = db.handlingUnit;
const Consignee = db.consignee;
const Vendors = db.vendors;
const FlowType = db.flowTypes;

const fs = require('fs');
const includeFalse = [{ all: true, nested: false }];
const includeTrue = [{ all: true, nested: true }];
const OrderAttr = [
    ...NorderAttrb,
    'statuses.color as statusColor',
    'statuses.id as statusId',
    'statuses.name as statusName',
    'statuses.statustype as statusType',
    'transporttypes.name as LoadType'
];

const GeoLoc = require('../mongoModels/GeoLocModel');
const osrm = require('../controller/osmap.controller');
const PlanningModel = require('../mongoModels/PlanningModel.js');

module.exports = class Helper {


    // Query 
    static selectQueryProducts() {
        let query = "SELECT ";
        query += "upload.a.`Invoice Number` as po, ";
        query += "upload.bi.`Total Cases`, dc.id as consigneeId, dc.companyLegalName, dc.points, dc.serviceTime, ";
        query += `JSON_ARRAYAGG(
            JSON_OBJECT(
             'sku', upload.a.\`Item Number\`,
             'Quantity', upload.a.\`Quantity Shipped\`,
             'weight', upload.p.Weight,
             'handlingTypeId', (SELECT demo2.HandlingTypes.id FROM demo2.HandlingTypes WHERE LOWER(demo2.HandlingTypes.Type) = LOWER(upload.p.Unit)),
             'handlingType', upload.p.Unit,
             'piecetype', upload.p.Class,
             'piecetypeId', (SELECT demo2.piecetypes.id FROM demo2.piecetypes where LOWER(demo2.piecetypes.piecetype) = LOWER(upload.p.Class) ),
             'brand', upload.p.Brand,
             'productdescription', CONCAT(upload.p.Manufacturer," ", upload.p.\`Name\`)
             )
        ) as products `;
        query += "FROM upload.`all` as a ";
        query += "LEFT JOIN upload.byinvoce as bi ON upload.a.`Invoice Number` = REGEXP_REPLACE(upload.bi.`Invoice Number`,'[a-z]+', '') ";
        query += "LEFT JOIN upload.legacyProducts as p ON p.ID = a.`Item Number` ";
        query += "LEFT JOIN demo2.consignees as dc ON dc.`name` = upload.bi.`Ship To Number` ";
        
        query += "WHERE 1 ";
        query += "AND upload.bi.`Total Cases` > 0 ";
        
        query += "GROUP BY  upload.a.`Invoice Number`";
        return query;
    }

    static createSelectQuery(table, val, attb) {
        let fls = "*";
        if (attb) {
            fls  = attb.join(',');
        }
        let query = `SELECT ${fls} FROM ${table} WHERE ${table}.id IN (${val}) ORDER BY FIND_IN_SET(id, '${val}')`;
        return query;
    }
    static createCountQuery(table) {
        let query = `SELECT COUNT(*) FROM ${table};`;
        return query;
    }
    static createSelectQueryByLike(table, where, size, orderArr, offset, limit, page = null) {
        const orders = table[0];
        const customers = table[1];
        let fls = "*";
        let str = 'WHERE';
        for (const key in where) {
            switch (key) {
                case 'perMile':
                    str += ` ${orders}.permileRate = ${where[key]} AND`;
                    break;
                case 'totalRateMin':
                    str += ` ${orders}.rate >= ${where[key]*1} AND`;
                    break;
                case 'totalRateMax':
                    str += ` ${orders}.rate <= ${where[key]*1} AND`;
                    break;
                case 'id':
                    str += ` ${orders}.id LIKE '${where[key]}' AND`;
                    break;
                case 'deliverydateFrom':
                    str += ` ${orders}.deliverydateFrom LIKE '${where[key]}%' AND`;
                    break;
                case 'pickupdateFrom':
                    str += ` ${orders}.pickupdateFrom LIKE '${where[key]}%' AND`;
                    break;
                case 'pickup':
                    str += ` ${orders}.pickup LIKE '%${where[key]}%' AND`;
                    break;
                case 'delivery':
                    str += ` ${orders}.delivery LIKE '%${where[key]}%' AND`;
                    break;
                case 'loadtype':
                str += ` ${orders}.loadtype LIKE '${where[key]}' AND`;
                    break;
                case 'date':
                    let date = where.date;
                    let dtTo = new Date(date);
                    dtTo.setDate(dtTo.getDate() + 1);
                    dtTo = dtTo.toISOString().split('T')[0];
                    str += ` ${orders}.createdAt <= '%${dtTo}%' AND`;
                    break;
                case 'customerName':
                    str += ` ${customers}.customerName LIKE '${where[key]}' AND`;
                    break;
                default:
                    str += ` ${orders}.${key} LIKE '%${where[key]}' AND`;
                    break;
            }
        }        
        // if (size) {
        //     str += ` (feet LIKE '%${size}' OR weight LIKE '%${size}' OR cube LIKE '%${size}' OR pallet LIKE '%${size}')`
        // } else 
        if (Object.keys(where).length) {
            str = str.slice(0, -3);
        } else {
            str = str.slice(0, -5);
        }
        let query = `SELECT ${fls} FROM ${customers} left join ${orders} ON (${customers}.id = ${orders}.customerid) ${str} ORDER BY ${orders}.${orderArr[0]}, '${orderArr[1]}' ${page ? `LIMIT ${limit} OFFSET ${offset}` : ''} `;
        //console.log(query);
        return query;
    
    }
    static createSelectQueryWithJoin(tables, val, attb) {
        let fls = "*";
        if (attb) {
            fls  = attb.join(',');
        }        
        let orders = tables[0];
        let customers = tables[1] ? tables[1] : false;
        let statuses;
        tables[2] ? statuses = tables[2] : statuses = false;
        let query = `SELECT ${fls} FROM ${orders} 
            ${customers ? `LEFT JOIN ${customers} ON ${orders}.customerid = ${customers}.id ` : ''}
            ${statuses ? `LEFT JOIN ${statuses} ON ${orders}.status = ${statuses}.id` : ''}
            WHERE ${orders}.id IN (${val}) ORDER BY FIND_IN_SET(${orders}.id, '${val}')`;
        // console.log(query);
        return query;
    
    }
    static createSelectQueryWithJoinConsignee(tables, val, attb) {
        let fls = "*";
        if (attb) {
            fls  = attb.join(',');
        }        
        let orders = tables[0];
        let consignee = tables[1] ? tables[1] : false;
        let query = `SELECT ${fls} FROM ${orders} 
            ${consignee ? `LEFT JOIN ${consignee} ON ${orders}.consigneeid = ${consignee}.id ` : ''}
            WHERE ${orders}.id IN (${val}) ORDER BY FIND_IN_SET(${orders}.id, '${val}')`;
        // console.log(query);
        return query;
    
    }
    static createSelectQueryWithJoin3(tables, val, attb) {
        let fls = "*";
        if (attb) {
            fls  = attb.join(',');
        }        
        let orders = tables[0];
        let customers = tables[1];
        let statuses = tables[2];
        let query = `SELECT ${fls} FROM ${orders} 
                    LEFT JOIN ${customers} ON ${orders}.customerid = ${customers}.id 
                    LEFT JOIN ${statuses} ON ${orders}.status = ${statuses}.id  
                    WHERE ${orders}.id 
                    IN (${val}) 
                    ORDER BY FIND_IN_SET(${orders}.id, '${val}')`;
         // console.log(query);
        return query;
    
    }
    static createSelectQueryWithJoin4(tables, val, attb) {
        let fls = "*";
        if (attb) {
            fls  = attb.join(',');
        }        
        let orders = tables[0];
        let customers = tables[1];
        let statuses = tables[2];
        let loadTypes = tables[3];
        let query = `SELECT ${fls} FROM ${orders} 
                    LEFT JOIN ${customers} ON ${orders}.customerid = ${customers}.id 
                    LEFT JOIN ${statuses} ON ${orders}.status = ${statuses}.id
                    LEFT JOIN ${loadTypes} ON ${orders}.loadtype = ${loadTypes}.id  
                    WHERE ${orders}.id 
                    IN (${val}) 
                    ORDER BY FIND_IN_SET(${orders}.id, '${val}')`;
         // console.log(query);
        return query;
    
    }

    static createEditQuery(serviceTime, pieceTime) {
        let query = `UPDATE orders SET orders.servicetime = ${serviceTime} + ( orders.pieceCount * ${pieceTime}), orders.pieceTime = ${pieceTime}
        where orders.id > 0;`;
        return query;
    }
    
    static async getOne(data) {
        const { key, value, table } = data;
        let loadTemp;        
        loadTemp = await table.findOne({
            where: {
                [key]: value
            },
            include: includeFalse
        }).catch(err => {
            console.log('catch find ', err);
        });
        return loadTemp;
    }
    static async getAll(data) {
        const { key, value, table } = data;
        let result;        
        result = await table.findAndCountAll({
            where: {
                [key]: value
            },
            include: includeFalse
        });
        return result;
    }
    // string spliter 
    static splitToIntArray(text, dl) {
        let array = text.split(dl).map(function (item) {
            return parseInt(item, 10);
        });
        return array;
    }
    // nominatim 
    static checkAndGetLatLon(load, orders) {
    
        let points = '';
        let count = orders.length;
    
        for (let i = 0; i < count; i++) {
            const el = orders[i];
    
            if (load.depo > 0) {
                points += `${load.depo.lat},${load.depo.lon};`;
            }
            if (count == 1) {
                points += `${el.deliveryLat},${el.deliveryLon};`;
            }
    
            if (el.flowType == 0) {
                points += `${el.pickupLat},${el.pickupLon};`;
    
            } else {
                points += `${el.deliveryLat},${el.deliveryLon};`;
            }
    
    
        }
        //console.log(points);
        return points.slice(0, -1);
    }
    static async getLatLon(loadTemp, orders) {
        try {
            // let lastPort;
            // const depoIds = JSON.parse(loadTemp.depoId);
            // const portIds = JSON.parse(loadTemp.portIds);
            // const port = Port.findOne({
            //     where: {
            //         id: portIds[0]
            //     }
            // });
            // if (portIds.length == 2) {
            //     lastPort = Port.findOne({
            //         where: {
            //             id: portIds[1]
            //         }
            //     });
            // }
            // const lastDepo = Depo.findOne({
            //     where: {
            //         id: depoIds[depoIds.length-1]
            //     }
            // });
            const depo = loadTemp.depoId ? await seq.query(this.createSelectQuery('depos', loadTemp.depoId), { type: seq.QueryTypes.SELECT }) : '';

            let points = '';
            let newPoints;
            if (loadTemp.flowType == 2) {
                points += `${depo[0].lat},${depo[0].lon};`;
                for (const order of orders) {
                    points += `${order.deliveryLat},${order.deliveryLon};`;
                }
                newPoints = await this.joinLatLon(points);
                if (loadTemp.return == 0) {
                    newPoints += `${depo[0].lat},${depo[0].lon};`;
                }
            } else if (loadTemp.flowType == 1) {
                points += `${depo[0].lat},${depo[0].lon};`;
                for (const order of orders) {
                    points += `${order.pickupLat},${order.pickupLon};`;
                }
                newPoints = await this.joinLatLon(points);
                newPoints += `${depo[0].lat},${depo[0].lon};`;
            }
            // else if (loadTemp.flowType == 4) {
            //     points += `${depo[0].lat},${depo[0].lon};`;
            //     points += `${lastDepo.lat},${lastDepo.lon};`;
            // } else if (loadTemp.flowType == 6) {
            //     points += `${lastDepo.lat},${lastDepo.lon};`;
            //     points += `${port.lat},${port.lon};`;
            // } else if (loadTemp.flowType == 7) {
            //     points += `${port.lat},${port.lon};`;
            //     points += `${lastPort.lat},${lastPort.lon};`;
            // } else if (loadTemp.flowType == 8) {
            //     points += `${port.lat},${port.lon};`;
            //     points += `${depo[0].lat},${depo[0].lon};`;
            // }
            return newPoints;
        } catch (error) {
            return error;
        }
        
    }
    // get date formated
    static getDateFormated(date){

        date = date ? new Date(date) : new Date();

        var yyyy = date.getFullYear();
        var dd = date.getDate();
        var mm = date.getMonth() + 1;

        if (dd < 10) {
        dd = '0' + dd;
        } 
        if (mm < 10) {
        mm = '0' + mm;
        } 
        
        date = dd + '/' + mm + '/' + yyyy;
        return date;
    }
    // get date from end formatted for flatbed orders
    static getFlatbedDatesFromEndFormatted(date, timezone, dateRange = null){
        let utc = timezone ? timezone : 0;
        let inputDate = moment(date);
        let format = moment.utc(inputDate._i, inputDate._f).format("YYYY-MM-DDTHH:mm:ss.SSS");
        let date1, date2, dtTo;
        if (dateRange) {
            date1 = moment(format).subtract(dateRange.min, 'days').subtract(utc, 'hours').format("YYYY-MM-DDTHH:mm:ss.SSS")+'Z';
            dtTo = moment(format).add(dateRange.max, 'days').subtract(utc, 'hours').subtract(1, 'second').format("YYYY-MM-DDTHH:mm:ss.SSS")+'Z';
        } else {
            date1 = moment(format).subtract(utc, 'hours').format("YYYY-MM-DDTHH:mm:ss.SSS")+'Z';
            date2 = moment(format).subtract(utc, 'hours');
            dtTo = moment(date2.add(moment.duration(1, 'days')).subtract(1, 'second'), 'x').format("YYYY-MM-DDTHH:mm:ss.SSS")+'Z';
        }
        let from = moment(date1, "YYYY-MM-DDTHH:mm:ss.SSS")._i;
        let to = moment(dtTo, "YYYY-MM-DDTHH:mm:ss.SSS")._i;
        return {
            from,
            to
        };
    }
    static getFlatbedDatesFromEndFormattedWithHours(date, reverseDay = false){
        
        date = date ? new Date(date) : new Date();
        
        let yyyy = date.getFullYear();
        let dd = date.getDate();
        let mm = date.getMonth() + 1;
        let hh  = date.getHours();
        let MM  = date.getMinutes();

        if (dd < 10) {
            dd = '0' + dd;
        } 
        if (mm < 10) {
            mm = '0' + mm;
        }
        if(hh < 10){ hh = `0${hh}` }
        if(MM < 10){ MM = `0${MM}` }
        
        date = `${yyyy}-${mm}-${dd} ${hh}:${MM}`;

        let from, to

        if(!reverseDay){
            from = new Date(date)
            to = new Date(`${yyyy}-${mm}-${dd}`)
            to.setDate(to.getDate()+1);
        }else{
            from = new Date(`${yyyy}-${mm}-${dd}`)
            to = new Date(date)
        }

        // const from = new Date(date)
        // const to = new Date(date)

        // to.setDate(to.getDate()+1);

        return {
            from,
            to
        };
    }
    // get files paths
    static getPaths(directory, fileName, userId, location = null){
        console.log(location);
        
        // get user id based directory for carriers, shippers
        var userIdBasedDir = userId;

        var dir = `resources/${userIdBasedDir}/${directory}`;

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        //  Delete after testing
        let paths;
        if (location) {
            let host;
            if (location.host == 'localhost:4200') {
                host = "localhost:8080";
            } else {
                host = location.host;
            }
            paths = {
                urls: {
                    Path: `${location.protocol}//${host}/${directory}/pdf/${fileName}`,
                },
        
                filePath: `${dir}/${fileName}`
            };
        } else {
            paths = {
                urls: {
                    localPath: `http://localhost:8080/api/${directory}/pdf/${fileName}`,
                    // Path: `http://${host}/api/${directory}/pdf/${fileName}`,
                },
        
                filePath: `${dir}/${fileName}`
            };
        }

        return paths;
    }
    static async updateJob(data, uid){
        try {
        
            let orderIds = [];
            let drivingMinutes = [];
            for (const load of data.Loads) {
                orderIds = orderIds.concat(load.OrderIDs);
                drivingMinutes.push(load.DrivingMinutes);
            }
            const jsonOrderId = JSON.stringify(orderIds);
            const jsondrivingMinutes = JSON.stringify(drivingMinutes);
            const job = await Job.update({
                status: data.Status,
                eta: data.ETA,
                percentage: data.Percentage,
                loadOrderIds: jsonOrderId,
                drivingminutes: jsondrivingMinutes,
                totalRunTime: data.RuntimeSeconds
            }, {
                where: {
                    UUID: uid
                }
            });
            return job;
        } catch (error) {
            return error;
        }
    }
    static async updateLastLocation (data) {
        try {
            const { loadId, location } = data;
            let updateLoc;

            const load = await Load.findOne({
                where: {
                    id: loadId
                }
            });
            if (load) {
                updateLoc = await Load.update({
                    lastlocatoins: location
                }, {
                    where: {
                        id: loadId
                    }
                });
                return {
                    status: 1,
                    msg: "ok",
                    updateLoc
                };
            } else {
                return {
                    status: 0,
                    msg: "such Load doesn't exist"
                };
            }
        } catch (error) {
            return {
                status: 0,
                msg: "error"
            };
        }

    }
    static async getStatusAutoplan(uid) {
        let statusUrl  = `${env.engineHost}:${env.enginePort}/status?execid=${uid}`;
        const result = await axios.get(statusUrl);
        // console.log('-- ETA', result)
        const dataLength = result.data.length;

        // count dones
        let doneCount = 0
        result.data.forEach(d => {
            if(d.Status == 'Done.'){
                doneCount++
            }
        })
        if(doneCount == result.data.length){
            return 'Done.'
            // return {
            //     status: 1,
            //     doneCount
            // };
        }

        // old
        const { ETA } = result.data[dataLength-1].ThreadOutcome;
        
        return ETA;
    }
    static async findLoads(data) {

    }

    static async filters(where, Op, data = null, week = null) {
        let bool = true;
        let type;
        if (data && data == "loadTemp") {
            let ids = {
                loadTempIds: {}
            }, obj = {};
            if (where.id || where.bol || where.po || where.pro || where.customersIds) {
                ids = await this.loadFiltersById(where);
            }
            obj = await this.loadFilters(where, week);
            where = {
                ...where,
                ...obj,
                ...ids.loadTempIds
            };
        }
        if (data && data == "load") {
            let ids = {
                loadIds: {}
            }, obj = {};
            if (where.id || where.bol || where.po || where.pro || where.customersIds) {
                ids = await this.loadFiltersById(where, 'load');
            }
            obj = await this.loadFilters(where, week);
            where = {
                ...where,
                ...obj,
                ...ids.loadIds
            };
        }

        if (data && data == "order") {
            let obj;
            obj = await this.orderFilters(where);
            where = {
                ...where,
                ...obj
            };
            
        }

        if (data && data == 'driver') {
            let sday, arr = [], drivers, from;
            if (where.date) {
                sday = await this.getWeekDay(where.date);
                drivers = await Driver.findAndCountAll({ where: { status:1 }, include: includeFalse });
                
                for (const driver of drivers.rows) {
                    from = driver.schedule.dataValues[sday] && driver.schedule.dataValues[sday].from ? driver.schedule.dataValues[sday].from : null;
                    if (from) {
                        arr.push(driver.id);
                    }
                }
                where.id = {
                    [Op.in]: arr
                };
                delete where.date;
            }
        }
        if (where.startDate) {
            let endMil = new Date(where.startDate).getTime() + 86399999;
            let start = where.startDate, end = new Date(endMil).toISOString();
            where.startTime = {
                [Op.gte]: start,
                [Op.lte]: end
            };
            delete where.startDate;
        }
        // if (where.startDateFromTime) {
            
        // }
        // if (where.startDateToTime) {
            
        // }
        if (where.finish) {
            where.finishRequest = {
                [Op.ne]: where.finish
            };
            delete where.finish;
        }
        if (where.start_time) {
            where.startTime = {
                [Op.startsWith]: where.start_time
            };
            delete where.start_time;
        }
        if (where.onlyFinish) {
            where.finishRequest = 2;
            delete where.onlyFinish;
        } else {
            delete where.onlyFinish;
        }
        if (where.rating && (where.rating == 'A' || where.rating == 'B' || where.rating == 'C')) {
            let conIds = [];
            let consignees = await Consignee.findAll({
                where: {
                    rating: where.rating
                }
            });
            for (const consignee of consignees) {
                conIds.push(consignee.id);
            }
            where.consigneeid = {
                [Op.in]: conIds
            };
            delete where.rating;
        } else if(where.rating && (where.rating != 'A' || where.rating != 'B' || where.rating != 'C')) {
            bool = false;
            delete where.rating;
        } else {
            delete where.rating;
        }
        if (where.name) {
            where.name = {
                [Op.startsWith]: where.name
            };
        }
        
        if ((where.sizeMin || where.sizeMax) && !where.sizeType) {
            bool = false;
        }
        if(where.sizeType) {
            type = where.sizeType;
        }
        if (where.driverAssigned == 0) {
            where.driverId = null;
        } else if (where.driverAssigned == 1) {
            where.driverId = {
                [Op.gte]: 1
            };
        }
        delete where.sizeType;
        delete where.driverAssigned;
        if ((where.sizeMin && where.sizeMax) && (where.sizeMax*1 > where.sizeMin*1)) {
            where[type] = {
                [Op.between]: [where.sizeMin*1, where.sizeMax*1]
            };
            delete where.sizeMin;
            delete where.sizeMax;
        } else if(where.sizeMin && !where.sizeMax) {
            where[type] = {
                [Op.gte]: where.sizeMin
            };
            delete where.sizeMin;
        } else if (where.sizeMax && !where.sizeMin) {
            where[type] = {
                [Op.lte]: where.sizeMax
            };
            delete where.sizeMax;
        } else if (where.sizeMax*1 <= where.sizeMin*1) {
            delete where.sizeMin;
            delete where.sizeMax;
            bool = false;
        }

        if ((where.totalRateMin && where.totalRateMax) && (where.totalRateMax*1 > where.totalRateMin*1)) {
            where.rate = {
                [Op.between]: [where.totalRateMin*1, where.totalRateMax*1]
            };
            delete where.totalRateMin;
            delete where.totalRateMax;
        } else if(where.totalRateMin && !where.totalRateMax) {
            where.rate = {
                [Op.gte]: where.totalRateMin*1
            };
            delete where.totalRateMin;
        } else if (where.totalRateMax && !where.totalRateMin) {
            where.rate = {
                [Op.lte]: where.totalRateMax*1
            };
            delete where.totalRateMax;
        } else if (where.totalRateMax*1 <= where.totalRateMin*1) {
            delete where.totalRateMin;
            delete where.totalRateMax;
            bool = false;
        }
        
        
        if ((where.deliveryDateFrom && where.deliveryDateTo) && (where.deliveryDateTo > where.deliveryDateFrom)) {
            where.deliverydateFrom = {
                [Op.gte]: where.deliveryDateFrom
            };
            where.deliverydateTo = {
                [Op.lte]: where.deliveryDateTo
            };
            delete where.deliveryDateTo;
            delete where.deliveryDateFrom;
        } else if(where.deliveryDateFrom && !where.deliveryDateTo) {
            where.deliverydateFrom = {
                [Op.gte]: where.deliveryDateFrom
            };
            delete where.deliveryDateFrom;
        } else if (where.deliveryDateTo && !where.deliveryDateFrom) {
            where.deliverydateTo = {
                [Op.lte]: where.deliveryDateTo
            };
            delete where.deliveryDateTo;
        } else if (where.deliveryDateTo <= where.deliveryDateFrom) {
            delete where.deliveryDateTo;
            delete where.deliveryDateFrom;
            bool = false;
        }

        if ((where.pickupDateFrom && where.pickupDateTo) && (where.pickupDateTo > where.pickupDateFrom)) {
            
            where.pickupdateFrom = {
                [Op.gte]: where.pickupDateFrom
            };
            where.pickupdateTo = {
                [Op.lte]: where.pickupDateTo
            };
            delete where.pickupDateTo;
            delete where.pickupDateFrom;
        } else if(where.pickupDateFrom && !where.pickupDateTo) {
            where.pickupdateFrom = {
                [Op.gte]: where.pickupDateFrom
            };
            delete where.pickupDateFrom;
        } else if (where.pickupDateTo && !where.pickupDateFrom) {
            where.pickupdateTo = {
                [Op.lte]: where.pickupDateTo
            };
            delete where.pickupDateTo;
        } else if (where.pickupDateTo <= where.pickupDateFrom) {
            delete where.pickupDateTo;
            delete where.pickupDateFrom;
            bool = false;
        }

        if ((where.mileMin && where.mileMax) && (where.mileMax*1 > where.mileMin*1)) {
            where.totalDistance = {
                [Op.between]: [where.mileMin*1, where.mileMax*1]
            };
            delete where.mileMin;
            delete where.mileMax;
        } else if(where.mileMin && !where.mileMax) {
            where.totalDistance = {
                [Op.gte]: where.mileMin*1
            };
            delete where.mileMin;
        } else if (where.mileMax && !where.mileMin) {
            where.totalDistance = {
                [Op.lte]: where.mileMax*1
            };
            delete where.mileMax;
        } else if (where.mileMax*1 <= where.mileMin*1) {
            delete where.mileMin;
            delete where.mileMax;
            bool = false;
        }

        if ((where.stopsMin && where.stopsMax) && (where.stopsMax*1 > where.stopsMin*1)) {
            where.stops = {
                [Op.between]: [where.stopsMin*1, where.stopsMax*1]
            };
            delete where.stopsMin;
            delete where.stopsMax;
        } else if(where.stopsMin && !where.stopsMax) {
            where.stops = {
                [Op.gte]: where.stopsMin*1
            };
            delete where.stopsMin;
        } else if (where.stopsMax && !where.stopsMin) {
            where.stops = {
                [Op.lte]: where.stopsMax*1
            };
            delete where.stopsMax;
        } else if ((where.stopsMin && where.stopsMax) && (where.stopsMax*1 == where.stopsMin*1)) {
            where.stops = where.stopsMin*1;
            delete where.stopsMin;
            delete where.stopsMax;
        } else if (where.stopsMax*1 < where.stopsMin*1) {
            delete where.stopsMin;
            delete where.stopsMax;
            bool = false;
        }

        if ((where.loadCostMin && where.loadCostMax) && (where.loadCostMax*1 > where.loadCostMin*1)) {
            
            where.loadCost = {
                [Op.between]: [where.loadCostMin*1, where.loadCostMax*1]
            };
            delete where.loadCostMin;
            delete where.loadCostMax;
            // console.log(where);
        } else if(where.loadCostMin && !where.loadCostMax) {
            where.loadCost = {
                [Op.gte]: where.loadCostMin*1
            };
            delete where.loadCostMin;
        } else if (where.loadCostMax && !where.loadCostMin) {
            where.loadCost = {
                [Op.lte]: where.loadCostMax*1
            };
            delete where.loadCostMax;
        } else if (where.loadCostMax*1 <= where.loadCostMin*1) {
            delete where.loadCostMin;
            delete where.loadCostMax;
            bool = false;
        }
        if (where.orderIds) {
            let arr = [];
            const orderIds = where.orderIds.split(',');
            // console.log('ids', orderIds);
            
            for (const orderId of orderIds) {
                arr.push({
                    [Op.and]: [{
                        [Op.like]: `%${orderId}%`
                    }]
                });
            }
            for (const i in arr) {
                where.orders = {
                    [Op.and]: arr[i]
                };
            }
            delete where.orderIds;
        }
        if (where.handlingUnit) {
            const handlingUnit = where.handlingUnit.split(',');
            const obj = {};
            for (const item of handlingUnit) {
                item == 'stackable' ? obj[item] = 1 : '';
                item == 'turnable' ? obj[item] = 1 : '';
                item == 'hazmat' ? obj[item] = 1 : '';
            }
            
            where.orderTypes = obj;
            delete where.handlingUnit;
        }
        if (where.statuses) {
            let statuses = where.statuses.split(',');
            statuses = statuses.map( el => { return parseInt(el,10); });
            where.status = { [Op.in]: statuses };

            delete where.statuses;
            // console.log(where.status);
        }
        if (where.specialNeeds) {
            let sid = where.specialNeeds;
            let orders = await this.getHandlingUnitBySpecialNeeds(sid).catch(err => {console.log(err);});
            let arr = [];
            for (const id of orders){
                arr.push(id.orders_id);
            }
            where.id = arr.join(",");
            delete where.specialNeeds;

           //  console.log(where);
        }
        if (where.deliveryCompanyName) {
            where.deliveryCompanyName = {
                [Op.like]: `%${where.deliveryCompanyName}%`
            };
        }
        if (where.pickupCompanyName) {
            where.pickupCompanyName = {
                [Op.like]: `%${where.pickupCompanyName}%`
            };
        }
        for (const key in where) {

            switch (key) {
                case 'perMileMin':
                    // where.permileRate = where[key];
                    delete where.perMileMin;
                    break;
                case 'perMileMax':
                    // where.permileRate = where[key];
                    delete where.perMileMax;
                    break;
                case 'id':
                    if (data != "load" && data != "loadTemp" && data != "driver") {
                        const ids = await this.splitToIntArray(where[key], ',');
                        where.id = {
                            [Op.in]: ids
                        };
                    }
                    
                    // where.id = {
                    //     [Op.like]: where[key]
                    // };
                    break;
                case 'pickup':
                    where.pickup = {
                        [Op.substring]: where[key]
                    };
                    break;
                case 'delivery':
                    where.delivery = {
                        [Op.substring]: where[key]
                    };
                    break;
                case 'loadtype':
                    where.loadtype = {
                        [Op.like]: where[key]
                    };
                    break;
                case 'date':
                    let date = where.date;
                    let dtTo = new Date(date);
                    dtTo.setDate(dtTo.getDate() + 1);
                    dtTo = dtTo.toISOString().split('T')[0];
                    where.createdAt = {
                        [Op.lte]: dtTo
                    };
                    delete where.date;
                    break;
                default:
                    break;
            }
        }
        return { where, bool};
    }

    static async loadFiltersById(data, load=null) {
        try {
            let ids = [], loadIds = [], loadTempIds = [], orders, orderWhere = {}, consIds;
            for (const key in data) {
                switch (key) {
                    case 'po':
                        orderWhere.po = data.po;
                        delete data.po;
                        break;
                    case 'pro':
                        orderWhere.pro = data.pro;
                        delete data.pro;
                        break;
                    case 'bol':
                        orderWhere.bol = data.bol;
                        delete data.bol;
                        break;
                    case 'customersIds':
                        consIds = await this.splitToIntArray(data.customersIds, ',');
                        orderWhere.consigneeid = {
                            [Op.in]: consIds
                        };
                        delete data.customersIds;
                        break;
                    default:
                        break;
                }
            }
            if (orderWhere.po || orderWhere.pro || orderWhere.bol) {
                orders = await Order.findAndCountAll({
                    where: orderWhere
                });
                for (const order of orders.rows) {
                    if (load) {
                        loadIds = loadIds.concat(order.loadIds);
                    } else {
                        loadTempIds = loadTempIds.concat(order.loadTempIds);
                    }
                }
            }
            if (orderWhere.consigneeid) {
                let orders = await Order.findAndCountAll({ where: orderWhere, attributes: ['id', 'loadTempIds', 'loadIds']});
                for (const order of orders.rows) {
                    if (load) {
                        loadIds = loadIds.concat(order.dataValues.loadIds);
                    } else {
                        loadTempIds = loadTempIds.concat(order.dataValues.loadTempIds);
                    }
                    
                }
            }
            if (data.id) {
                ids = await this.splitToIntArray(data.id, ',');
            }
            if (load) {
                loadIds = loadIds.concat(ids);
            } else {
                loadTempIds = loadTempIds.concat(ids);
            }
            return {
                status: 1,
                loadIds: {
                    id: {
                        [Op.in]: loadIds
                    }
                },
                loadTempIds: {
                    id: {
                        [Op.in]: loadTempIds
                    }
                }
            };

        } catch (error) {
            return {
                status: 0,
                msg: error.message
            };
        }
    }
    static async loadFilters(data, week = null, loadTemp = null) {
        try {
            let where = {};
            let from, to, start, end, driverIds;
            if (week) {
                from = data.thisWeekFrom;
                to = data.thisWeekTo;
            } else {
                from = data.from;
                to = data.to;
            }
            delete data.from;
            delete data.to;
            delete data.thisWeekFrom;
            delete data.thisWeekTo;
            if (from) {
                start = {
                    [Op.gte]: from
                };
            }
            if (to) {
                end = {
                    [Op.lte]: to
                };
            }
            if (start || end) {
                where.startTime = {
                    ...start,
                    ...end
                };
            }
            if (data.driversIds) {
                driverIds = await this.splitToIntArray(data.driversIds, ',');
                where.driverId = {
                    [Op.in]: driverIds
                };
                delete data.driversIds;
            }
            delete data.today;
            delete data.delivery;
            return where;
        } catch (error) {
            return {
                status: 0,
                msg: error.message
            };
        }
    }
    static async orderFilters(data) {
        let delivery, where = {};
        let from, to;
        from = data.from;
        to = data.to;
        delete data.from;
        delete data.to;
        delete data.thisWeekFrom;
        delete data.thisWeekTo;
        if (data.dashboard) {
            delivery = data.dashboard;
            delete data.dashboard;
        } else {
            delivery = 0;
            delete data.dashboard;
        }
        if (from || (data.today && data.today != 0)) {
            if (delivery) {
                where.deliveryDateFrom = from;
            } else {
                where.pickupDateFrom = from;
            }
        }
        if (to || (data.today && data.today != 0)) {
            if (delivery) {
                where.deliveryDateTo = to;
            } else {
                where.pickupDateTo = to;
            }
        }
        if (data.customersIds) {
            let consIds = await this.splitToIntArray(data.customersIds, ',');
            where.consigneeid = {
                [Op.in]: consIds
            };
        }
        delete data.today;
        delete data.customersIds;
        return where;
    }
    static async sortAndPagination(req){
        // console.log(req.query);
        const orderBy = req.query.orderBy;
        delete req.query.orderBy;
        
        const order = req.query.order ? req.query.order : 'desc';
        delete req.query.order;
        
        const orderArr = [];
        if (orderBy) { orderArr.push([orderBy, order]);}
        
        const page = req.query.page ? parseInt(req.query.page) : 1;
        delete req.query.page;
    
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        delete req.query.limit;
    
        const offset = (page - 1) * limit;

        return { order: orderArr, offset,limit };
    } 
    static async sortAndPagination2(data){
        // console.log(req.query);
        const orderBy = data.orderBy;
        delete data.orderBy;
        
        const order = data.order ? data.order : 'desc';
        delete data.order;
        
        const orderArr = [];
        if (orderBy) { orderArr.push([orderBy, order]);}
        
        const page = data.page ? parseInt(data.page) : 1;
        delete data.page;
    
        const limit = data.limit ? parseInt(data.limit) : 10;
        delete data.limit;
    
        const offset = (page - 1) * limit;

        return { order: orderArr, offset,limit };
    } 
    static async joinOrders(currentLoads, oids, OrderAttr) {
        let tables = ['orders', 'Customers', 'statuses' ,'transporttypes'];
        let query = await this.createSelectQueryWithJoin4(tables, oids, OrderAttr), orders;
        orders = await seq.query(query, { type: seq.QueryTypes.SELECT });
        if (orders) {
            if (currentLoads.orders && currentLoads.orders.length > 0) {
                oids = currentLoads.orders.split(',');
                orders.forEach(o => {
                    oids.forEach(oid => {
                        if (o.id == oid) {
                            currentLoads.dataValues.ordersDatas.push(o);
                        }
                    });
                });
            }
            return {
                loads: currentLoads,
            }; 
        } else {
            return {
                err: "Error",
                status: 0
            };
        }
    }
    static async getAddress(flowType, ret, orderIds, depoId) {
        try {
            let address = {};
            let oids = orderIds.join(',');
            let tables = ['orders', 'Customers', 'statuses' ,'transporttypes'];
            let query = await this.createSelectQueryWithJoin4(tables, oids, OrderAttr);
            const orders = await seq.query(query, { type: seq.QueryTypes.SELECT });
            const depo = await Depo.findOne({
                where: {
                    id: depoId
                }
            });
            if (flowType == 1) {
                let data = orders[0];
                address.startAddress = `${data.pickupStreetAddress}, ${data.pickupCity}, ${data.pickupZip}, ${data.pickupCountry}`;
                address.endAddress = depo.address;
            } else if (flowType == 2 && ret == 0) {
                address.startAddress = depo.address;
                address.endAddress = depo.address;
            } else if (flowType == 2 && ret == 1) {
                let data = orders[orders.length-1];
                address.endAddress = `${data.deliveryStreetAddress}, ${data.deliveryCity}, ${data.deliveryZip}, ${data.deliveryCountry}`;
                address.startAddress = depo.address;
            }
            return address;
        } catch (error) {
            return {
                error
            };
        }
        
    }
    static async joinLatLon(points) {
        points.slice(0,-1);
        const arr = [];
        const str = points.split(';');
        let strlast = str[str.length -1];
        // let newStr = '';

        for (let i = 0; i < str.length; i++) {
                  
            if (!arr.includes(str[i]) && str[i] !== '' || (arr.includes(str[i]) && str[i] != str[i-1])) {
                arr.push(str[i]);
            }
        }
        // for (let i = 1; i < str.length; i++) {
        //     console.log(i);
        //     if (str[i] != str[i-1]) {
        //         newStr += `${str[i-1]};`;
        //     }
        // }
        if(arr[arr.length-1] != strlast){
            arr.push(strlast);
        }
            
        return arr.join(';');
    }
    static async getHandlingUnitBySpecialNeeds(sid){
        const hu = Hunit.findAll({
            where: {specialneeds: sid},
        });
        return hu;
    }
    static async checkWindow(data) {
        try {
            const { distDur, o, order, startTime, flowType } = data;
            const { legs } = distDur;
            let dur = legs[o].duration * 1000;
            let from; 
            let to;
            let waiting;
            if (flowType == 1) {
                from = new Date(order.order.pickupdateFrom).getTime();
                to = new Date(order.order.pickupdateTo).getTime();
            } else if (flowType == 2) {
                from = new Date(order.order.deliverydateFrom).getTime();
                to = new Date(order.order.deliverydateTo).getTime();
            }
            if ((startTime + dur) < from) {
                waiting = (from - (startTime + dur))/1000;
            } else {
                waiting = 0;
            }
            return waiting;
        } catch (error) {
            return error;
        }
        
    }

    static async calcTotalDuration(data) {
        let { load, news, distDur, totalDuration, shift } = data;
        let waitingTime, startTime = new Date(load.startTime).getTime();
        waitingTime = await Checks.waitingTime({
            orders: news,
            distDur,
            flowType: load.flowType,
            startTime
        });
        
        for (const order of news) {
            totalDuration += order.servicetime;
            console.log('serviceTime', order.id, order.servicetime);
            
        }
        
        totalDuration += waitingTime;
        if (shift && totalDuration >= shift.break_time) {
            totalDuration += shift.rest;
        } else if (load.shiftId && totalDuration >= load.shift.break_time) {
            totalDuration += load.shift.rest;
        }
        
        return totalDuration;
    }

    // Algo 
    static async getSingleLoadSequence(req, load){
        // console.log(load.dataValues.carTypes);
        load = load.dataValues;
        let orders = load.orders;
        // load = await LoadTemp.findOne({ where: { id: 1414 } });
        let uuid = load.UUID;
        if(!uuid) { uuid = uuidv1(); }

        let depoId = load.depoId;
        let dep = await Depo.findOne({ where: { id: depoId } });
        let lat = dep.dataValues.lat;
        let lon = dep.dataValues.lon;
        let depo = {  "lat": lat, "lon": lon };
        
        let equipment = [
            {
                "carCount": "1",
                "feet": load.carTypes[0].value,
                "weight": load.carTypes[0].maxweight,
                "cube": load.carTypes[0].maxVolume
            }
        ];

        let shiftId = load.shiftId;
        let shif = await Shift.findOne({ where: { id: shiftId } });
        let shift = {
            "shift": shif.dataValues.shift,
            "break_time": shif.dataValues.break_time,
            "max_shift": shif.dataValues.max_shift,
            "rest": shif.dataValues.rest,
            "recharge": shif.dataValues.recharge,
            "drivingtime": shif.dataValues.drivingtime
        };

        let date = moment.utc(load.startTime).format('YYYY-MM-DD');
        let loadStartTime = load.startTime;
        let maxStops = load.orders.split(',').length;
        let timeLimit = 60;
        let selectedOrders = load.orders.split(',');
        let flowType = load.flowType;
        let oVRP = load.return;

        let dryRun = true;
        let loadMinimize = true;
        let singleRouteCalc = true;
        
        let PostServer = this.getRemoteInfo(req).endPoint;
        let url = this.getRemoteInfo(req).host + "/orders/byids/" + load.orders;
        let MapUrl = env.mapHost + env.mapPort + '/table/v1/driving/';

        let data = {
            "execid": uuid,
            "PostServer": PostServer,
            "MapServer": MapUrl,
            "params": {
                "date": date,
                "loadStartTime": loadStartTime,
                "depoId": depoId,
                "flowType": flowType,
                "maxStops": maxStops,
                "timeLimit": timeLimit,
                "selectedOrders": selectedOrders,
                "oVRP": oVRP,
                "shiftId": shiftId,
                "dryRun": dryRun,
                "loadMinimize": loadMinimize,
                "singleRouteCalc": singleRouteCalc,
                "seqMode": true
            },
            "depo": depo,
            "shift": shift,
            "equipment": equipment,
            "link": url
        };

        console.log( JSON.stringify(data) );
        let eResp = await this.sendReqToEngine(data);
        console.log("Engine: ", eResp.data.Message);
        console.log("Engine Status: ", eResp.status);
        if(eResp.status != 200 ){
            console.log(orders);
            return orders;
        }else {
            console.log(eResp.data);
            return eResp;
        }

    }

    static getRemoteInfo(req){    
        let host, endPoint;
        let api="";
        let uri = api+"/autoplan", companyName;
        const myURL = req.headers.referer ? new URL(req.headers.referer) : '';
        if(req.headers.host == "192.168.88.87:8080"){
            // endPoint =  "http://test.beta.lessplatform.com"+ uri;
            // host = "http://test.beta.lessplatform.com";
            endPoint =  "http://192.168.88.87:8080"+ uri;
            host = "http://192.168.88.87:8080";
        } else if (req.headers.type == "postman") {
            endPoint = `${myURL.origin}` + uri;
            host = `${myURL.origin}`;
            // companyName = myURL.hostname.split('.')[0];
        } else {
            endPoint = `${myURL.origin}` + uri;
            host = `${myURL.origin}`;
            companyName = myURL.hostname.split('.')[0];
        }
        let info = {
            host,
            userName: req.user ? req.user.username : null,
            email: req.user ? req.user.email : null,
            userType: req.user ? req.user.type : null,
            userAgent: req.headers['user-agent'],
            endPoint,
            companyName
        };
        return info;
    }

    static getRemoteInfoForKey(req) {
        let host, endPoint;
        let api="";
        let uri = api+"/autoplan", companyName;
        const myURL = req.headers['x-forwarded-host'];
        if(req.headers.host == "192.168.88.87:8080"){
            // endPoint =  "http://test.beta.lessplatform.com"+ uri;
            // host = "http://test.beta.lessplatform.com";
            endPoint =  "http://192.168.88.87:8080"+ uri;
            host = "http://192.168.88.87:8080";
        } else if (req.headers.host == "localhost:8080") {
            endPoint =  "http://localhost:8080"+ uri;
            host = "http://localhost:8080";
        } else {
            endPoint = `http://${myURL}` + uri;
            host = `http://${myURL}`;
        }
        let info = {
            host,
            userName: req.user ? req.user.username : null,
            email: req.user ? req.user.email : null,
            userType: req.user ? req.user.type : null,
            userAgent: req.headers['user-agent'],
            endPoint,
            companyName
        };
        return info;
    }

    static async sendReqToEngine (obj){
        try {
            let url;
            let headers = {
                "x-ads-key": "28DF6A13265BA58C9B400819E7104943",
            };    
            url  = `${env.engineHost}:${env.enginePort}/dispatch/vrp/singular`;
            const res = await axios.post(url, obj, headers);
            return res;
            
        } catch (error) {
            console.error(error);
            return;
        }  
    }


    // Custom For Customer 

    static packSizeParserSingleForLegacy(PackSize){
        
        let re = /\D+/g; // get only string character
        let size;
        let mesh;
                      
        if(PackSize){

            let match = PackSize.match(re);
            let npackname = PackSize.toLowerCase().replace(' ', ";").replace("/", ";").replace("x",";");
            
            if( !match ) { size = 0; }
            if ( match ) {

                mesh = match[match.length-1].toLowerCase();   
                
                let fpackname = npackname.replace(mesh.trim(),'');
                let parts = fpackname.split(";");

                if(parts[parts.length -1] == ''){ parts.pop(); }
                //-
                if(parts.length == 1) {
                    size = parseInt(parts[0]);
                }
                if(parts.length == 2 ) {
                    let c = parseInt(parts[0], 10);
                    let w = parseFloat(parts[1]);
                    size = c*w;   
                }
                if (parts.length > 2 ){
                    size = 0; 
                }
                //-
            }
            let obj = { size:size, unit:mesh };
            return obj;

        } else { 
            let obj = { size:0, unit:"" };
            return obj; 
        } 
    }

    static packSizeParserForLegacy(data) { // test

        let re = /\D+/g;
        // let units = [ "lb", "oz", "ct",  "ml", "gl", "l", "lt", "can", "ea", "kg", "gm", "gr" ];
        let weight;
        let fweight;
        data.forEach( el => {

            let packname = el.PackSize;
                
            if( packname ){

                let match = packname.match(re);
                let npackname = packname.toLowerCase().replace(' ', ";").replace("/", ";").replace("x",";");
               // console.log(npackname);
                if( !match ) { weight = 0; }
                if ( match ) {

                    let mesh = match[match.length-1].toLowerCase();   
                    let fpackname = npackname.replace(mesh.trim(),'');
                    let parts = fpackname.split(";");

                    if(parts[parts.length -1] == ''){ parts.pop(); }
                        if(parts.length == 1) {
                            weight = parseInt(parts[0]);
                        }
                        if(parts.length == 2 ) {
                            let c = parseInt(parts[0], 10);
                            let w = parseFloat(parts[1]);
                            weight = c*w;
                        }
                        if (parts.length > 2 ){
                            weight = 0;
                        }
                        // ----
                        if(el.Weight == 0){
                            fweight = weight;
                        }
                        return fweight;
                      
                }

                
            }                

        });

    }

    static async addfieldsInOrdersDatas(data) {
        let { load } = data;
        let tables = ['orders', 'Customers', 'statuses' ,'transporttypes'];
        let query = this.createSelectQueryWithJoin4(tables, load.orders, OrderAttr);
        const orders = await seq.query(query, { type: seq.QueryTypes.SELECT });
        if (load && load.orders.length > 0) {
            // let oids = load.dataValues.orders.split(',');
            let oids = await this.splitToIntArray(load.orders, ',');
            for (const o of orders) {
                // let { vendor, consignee } = await Helper.addfieldsInOrdersDatas({o})
                let vendor = {}, consignee = {};
                if (o.vendorid) {
                    vendor = await Vendors.findOne({ where: { id: o.vendorid}});
                }
                if (o.consigneeid) {
                    consignee = await Consignee.findOne({ where: { id: o.consigneeid}});
                }
                oids.forEach(oid => {
                    if (o.id == oid) {
                        load.ordersDatas.push({...o, vendor, consignee});
                    }
                });
            }
        }
        
        return {
            status: 1,
            load
        };
    }

    static async checkLoadsByUUID(data) {
        let { table, loadTemps } = data;
        console.log(data);
        let rest;
        for (const loadTemp of loadTemps) {
            if (loadTemp.UUID) {
                rest = await this.getAll({
                    table,
                    key: "UUID",
                    value: loadTemp.UUID
                });
                if (!rest.count) {
                    await Job.destroy({
                        where: {
                            UUID: loadTemp.UUID
                        }
                    });
                }
            } else {
                console.log(`${loadTemp.id} LoadTemp don't have UUID`);
            }
            
        }
        return {status: 1};
    }

    static async changed(data) {
        let { table, user, type, loadId, object } = data;
        let rest = await table.update({
            ...object,
            changed: {
                change: true,
                user: {
                    id: user.id,
                    username: user.username
                },
                changeTime: new Date(Date.now()),
                type
            }
        }, {
            where: {
                id: loadId
            }
        });
        console.log(rest);
        return rest;
        
    }

    static async checkHoursCon(datas) {
        let error = true, address = false, msg = "ok";
        for (const data of datas) {
            if (data.address.zip && data.address.city && data.address.streetAddress && data.address.state) {
                address = true;
            }
            if (data.Monday.workingHours.to || data.Monday.workingHours.from || data.Monday.deliveryHours.to || data.Monday.deliveryHours.from) {
                error = false;
            }
            if (data.Tuesday.workingHours.to || data.Tuesday.workingHours.from || data.Tuesday.deliveryHours.to || data.Tuesday.deliveryHours.from) {
                error = false;
            }
            if (data.Wednesday.workingHours.to || data.Wednesday.workingHours.from || data.Wednesday.deliveryHours.to || data.Wednesday.deliveryHours.from) {
                error = false;
            }
            if (data.Thursday.workingHours.to || data.Thursday.workingHours.from || data.Thursday.deliveryHours.to || data.Thursday.deliveryHours.from) {
                error = false;
            }
            if (data.Friday.workingHours.to || data.Friday.workingHours.from || data.Friday.deliveryHours.to || data.Friday.deliveryHours.from) {
                error = false;
            }
            if (data.Saturday.workingHours.to || data.Saturday.workingHours.from || data.Saturday.deliveryHours.to || data.Saturday.deliveryHours.from) {
                error = false;
            }
            if (data.Sunday.workingHours.to || data.Sunday.workingHours.from || data.Sunday.deliveryHours.to || data.Sunday.deliveryHours.from) {
                error = false;
            }
        }
        
        if (!error) {
            msg = "Error";
        }
        return {
            error,
            address,
            msg
        };
    }
    static async checkHoursVen(datas) {
        let error = true, address = false, msg = "ok";
        for (const data of datas) {
            if (data.address.zip && data.address.city && data.address.streetAddress && data.address.state) {
                address = true;
            }
            if (data.Monday.workingHours.to || data.Monday.workingHours.from || data.Monday.pickupHours.to || data.Monday.pickupHours.from) {
                error = false;
            }
            if (data.Tuesday.workingHours.to || data.Tuesday.workingHours.from || data.Tuesday.pickupHours.to || data.Tuesday.pickupHours.from) {
                error = false;
            }
            if (data.Wednesday.workingHours.to || data.Wednesday.workingHours.from || data.Wednesday.pickupHours.to || data.Wednesday.pickupHours.from) {
                error = false;
            }
            if (data.Thursday.workingHours.to || data.Thursday.workingHours.from || data.Thursday.pickupHours.to || data.Thursday.pickupHours.from) {
                error = false;
            }
            if (data.Friday.workingHours.to || data.Friday.workingHours.from || data.Friday.pickupHours.to || data.Friday.pickupHours.from) {
                error = false;
            }
            if (data.Saturday.workingHours.to || data.Saturday.workingHours.from || data.Saturday.pickupHours.to || data.Saturday.pickupHours.from) {
                error = false;
            }
            if (data.Sunday.workingHours.to || data.Sunday.workingHours.from || data.Sunday.pickupHours.to || data.Sunday.pickupHours.from) {
                error = false;
            }
        }
        
        if (!error) {
            msg = "Error";
        }
        return {
            error,
            address,
            msg
        };
    }

    static async findLatLon(points) {
        let lat, lon;
        let errors = [], pointArr = [];
        for (const [p, point] of points.entries()) {
            if (point.address.zip && point.address.city && point.address.streetAddress && point.address.state) {
                let address = `${point.address.zip}+${point.address.city}+${point.address.streetAddress}+${point.address.state}`;
                const { data } = await Osmap.GeoLoc(address);
                if (data.status == 'ZERO_RESULTS') {
                    lat = null;
                    lon = null;
                    errors.push({
                        index: p,
                        msg: "The mentioned address is not correct."
                    });
                } else if (data.status == 'REQUEST_DENIED') {
                    lat = null;
                    lon = null;
                    errors.push({
                        index: p,
                        msg: data.error_message
                    });
                } else {
                    lat = data.results[0].geometry.location.lat;
                    lon = data.results[0].geometry.location.lng;
                }
            } else {
                errors.push({
                    index: p,
                    msg: "The mentioned address is not correct."
                });
            }
            point.address.lat = lat;
            point.address.lon = lon;
            pointArr.push(point);
            
        }
        
        return { lat, lon, errors, pointArr };
    }

    static getOrderImagePath(directory, fileName, refHost){
        const dir = `./resources/0/${directory}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        let paths, fullHost;
        if (refHost == "http://localhost:4200") {
            fullHost = "http://localhost:8080";
        } else {
            fullHost = refHost;
        }
        paths = {
            urls: {
                Path: `${fullHost}/${directory}/${fileName}`
            },
            filePath: `${dir}/${fileName}`
        };
        console.log('dir', dir);
        console.log('path', `${fullHost}/${directory}/${fileName}`);
        
        return paths;
    }
    static async orderLatLon(datas) {
        try {
            let { pickupAddr, deliveryAddr } = datas;
            let pickupLatLon = pickupAddr ? await Osmap.GeoLoc(pickupAddr) : null;
            let deliveryLatLon = deliveryAddr ? await Osmap.GeoLoc(deliveryAddr) : null;
            return {
                pickupLatLon,
                deliveryLatLon
            };

        } catch (error) {
            return {
                status: 0,
                error
            };
        }
    }

    static async checkOrdersByLoadFlowType(data) {
        try {
            let { orderIds, flowType } = data;
            let flowTypes, orders, status = 1, msg = 'ok';
            let orderIdsArr = await this.splitToIntArray(orderIds, ',');
            flowTypes = await FlowType.findAndCountAll({
                where: { status: 1 }
            });
            orders = await Order.findAndCountAll({
                where: {
                    id: { [Op.in]: orderIdsArr }
                }
            });
            for (const order of orders.rows) {
                if (order.flowTypes && order.flowTypes.length) {
                    if (order.flowTypes.includes(flowType)) {
                        status = 0;
                        msg = "You cannot confirm the loadTemp as its orders are already in the confirmed Load with the same flow type.";
                        break;
                    }
                    if (flowType == 3) {
                        status = 0;
                        msg = "You cannot confirm the loadTemp.";
                        break;
                    }
                    if (order.flowTypes.includes(3) && flowType) {
                        status = 0;
                        msg = "You cannot confirm the loadTemp as E2E FlowType.";
                        break;
                    }
                }
                
            }
            return {
                status,
                msg
            };
        } catch (error) {
            return {
                status: 0,
                msg: error.Message
            };
        }
    }

    static async unplannedOrders(data, load=null) {
        try {
            let { loadArr } = data;
            let orderArr, OIds, flowTypeArr, info;
            for (const item of loadArr) {
                OIds = await this.splitToIntArray(item.orderIds, ',');
                let isPlanOrders = await Order.findAndCountAll({
                    where: { id: { [Op.in]: OIds } }
                });
                for (const order of isPlanOrders.rows) {
                    let obj = {};
                    orderArr = load ? order.loadIds : order.loadTempIds;
                    info = order.timeInfo;
                    flowTypeArr = order.flowTypes;
                    let index = orderArr.indexOf(item.id);
                    if (index > -1) {
                        orderArr.splice(index, 1);
                    }
                    if (load) {
                        delete info.loads[item.id];
                        let loadIndex = [];
                        for (const loadItem of info.loadsArr) {
                            if (loadItem.id != item.id) {
                                loadIndex.push(loadItem);
                            }
                        }
                        info.loadsArr = loadIndex;
                        let flowIndex = flowTypeArr.indexOf(item.flowType);
                        if (flowIndex > -1) {
                            flowTypeArr.splice(flowIndex, 1);
                        }
                        
                        obj = {
                            loadIds: orderArr,
                            flowTypes: flowTypeArr,
                            timeInfo: info,
                            status: 0,
                            confirmed: 0,
                            // isPlanned: 0
                        };
                    } else {
                        delete info.loadTemps[item.id];
                        obj = {
                            loadTempIds: orderArr,
                            timeInfo: info,
                            isPlanned: 0
                        };
                    }
                    await Order.update(obj, { where: { id: order.id }});
                }
                
            }
            return {
                status: 1,
                msg: "ok"
            };
        } catch (error) {
            return {
                status: 0,
                msg: error.Message
            };
        }
        
    }

    static async confirmOrder(data) {
        try {
            let { newLoad } = data;
            const orderIds = await this.splitToIntArray(newLoad.orders, ',');
            let isPlanOrders = await Order.findAndCountAll({
                where: { id: { [Op.in]: orderIds } }
            });
            let orderArr, flowTypes;
            for (const order of isPlanOrders.rows) {
                orderArr = order.loadIds;
                flowTypes = order.flowTypes;
                orderArr.push(newLoad.id);
                flowTypes.push(newLoad.flowType);
                
                
                let isPlanned = 0;
                if (flowTypes.includes(3) || flowTypes.includes(1) || flowTypes.includes(2)) {
                    isPlanned = 1;
                }
                
                await Order.update({
                    loadIds: orderArr,
                    flowTypes,
                    confirmed: 1,
                    isPlanned
                }, { where: { id: order.id }});
            }
            return {
                status: 1
            };
        } catch (error) {
            return {
                status: 0,
                error
            };
        }
    }

    static async groupConcatOrderIds(data) {
        try {
            let newArr;
            newArr = data.reduce((acc, cur) => {
                const accLastArr = acc[acc.length - 1] || [];
                if (accLastArr[accLastArr.length - 1] === cur[0]) {
                    acc[acc.length - 1] = accLastArr.concat(cur.slice(1));
                } else {
                    acc.push(cur);
                }
                return acc;
            }, []);
            return {
                status: 1,
                newArr,
                msg: "Ok"
            };
        } catch (error) {
            return {
                status: 0,
                newArr: [],
                msg: "catch Error reduce"
            };
        }
    }

    static async errorMsg(text) {
        return {
            status: 0,
            msg: text
        };
    }

    static async getWeekDay(date) {
        try {
            let sday;
            let weekDate = moment(date)._i;
            const thedate = new Date(weekDate);
            let day = thedate.getDay();
            if(day == 1) { sday = "monday";   }
            if(day == 2) { sday = "tuesday";  }
            if(day == 3) { sday = "wednesday";}
            if(day == 4) { sday = "thursday"; }
            if(day == 5) { sday = "friday";   }
            if(day == 6) { sday = "saturday"; }
            if(day == 0) { sday = "sunday";   }
            return sday;
        } catch (error) {
            return {
                status: 0,
                msg: error.message
            };
        }
    }

    static async checkArTime(data) {
        try {
            let { eta, order, flowType } = data;
            let arrTime = 0, waiting = 0;
            if (flowType == 2) {
                if (new Date(order.deliverydateFrom).getTime() > eta) {
                    arrTime = new Date(order.deliverydateFrom).getTime();
                    waiting = (new Date(order.deliverydateFrom).getTime() - eta);
                } else {
                    arrTime = eta;
                }
            } else if (flowType == 1) {
                if (new Date(order.pickupdateFrom).getTime() > eta) {
                    arrTime = new Date(order.pickupdateFrom).getTime();
                    waiting = (new Date(order.pickupdateFrom).getTime() - eta);
                } else {
                    arrTime = eta;
                }
            }
            return {
                status: 1,
                arrTime,
                waiting
            };
        } catch (error) {
            return {
                status: 0
            };
        }
    }

    static async addDriver(data) {
        try {
            let drivers, addedDrivers = [], addedLoads = [], sday, startMill, timeFEta, driverStart, warnings = [];
            drivers = await Driver.findAndCountAll({ where: { status: 1 }, include: includeTrue});
            for (const item of data) {
                if (!data.driverId) {
                    let lt = item.startTime, fEta = item.stopLocations[0].type.data.timeInfo.loadTemps[item.id].eta, drFrom;
                    sday = await this.getWeekDay(lt);
                    let st = moment.utc(item.startTime).format('YYYY-MM-DDTHH:mm:ss.SSS');
                    let date = st.split('T')[0];
                    let drTime;
                    startMill = await this.convertMilisecond(`${st}Z`);
                    timeFEta = await this.convertMilisecond(fEta);
                    for (const driver of drivers.rows) {
                        if (!item.driverId && !addedDrivers.includes(driver.id) && driver.assetId && driver.scheduleid && driver.schedule && driver.schedule[sday] && driver.schedule[sday].from && driver.shiftId && driver.shift) {
                            drTime = driver.schedule[sday].from.split('T');
                            drFrom = `${date}T${drTime[1]}`;
                            driverStart = await this.convertMilisecond(drFrom);
                            let driverFrom = driverStart, driverTo = (driverStart + (driver.shift.dataValues.shift*1000));
                            if (driverFrom <= startMill && driverTo >= (startMill + (item.totalDuration*1000))){
                                console.log('loadId', item.id);
                                console.log('sDay', sday);
                                let capCalc, warningData;
                                warningData = item.warningData ? item.warningData : {};
                                capCalc = this.capacityCalc({driver, load: item});
                                let loadTemps = await LoadTemp.findOne({ where: {id: item.id}})
                                let ld = new ClassLoad({data: {
                                    ...loadTemps.dataValues,
                                    driverId: driver.id,
                                    assetsId: driver.assetId,
                                    equipmentId: driver.companyEquipment.equipmentId,
                                    warning: !capCalc ? 1 : 0,
                                    warningData: {
                                        ...loadTemps.dataValues.warningData,
                                        ...warningData
                                    },
                                    id: item.id
                                },temp:1});
                                await ld.edit();
                                if (!capCalc) {
                                    warnings.push({
                                        loadId: item.id,
                                        msg: "capacity Warning"
                                    });
                                }
                                addedDrivers.push(driver.id);
                                // addedLoads.push(item.id);
                                break;
                            }
                        }
                    }
                }
                
            }
            return {
                status: 1,
                addedDrivers
            };
        } catch (error) {
            return await this.errorMsg('error add Driver');
        }
    }
    static async convertMilisecond(data) {
        try {
            let date = data;
            let timeArr = date.split('T');
            // let millisecond = (Number(timeArr[1].split(':')[0])*60*60*1000)+(Number(timeArr[1].split(':')[1])*60*1000)+(Number(timeArr[1].split(':')[2].split('.')[0])*1000)+(Number(timeArr[1].split('.')[1].slice(0, -1)*1));
            let millisecond = new Date(date).getTime();
            return millisecond;
        } catch (error) {
            return await this.errorMsg('Error convert');
        }
    }

    static async capacityCalc(data) {
        try {
            let { driver, load } = data, success = false;
            let volume = driver.assetId && driver.companyEquipment && driver.companyEquipment.equipmentId && driver.companyEquipment.equipment 
                        ? driver.companyEquipment.equipment.maxVolume : 0;
            let cube = load.cube;
            if (volume >= cube) {
                success = true;
            }
            return success;
        } catch (error) {
            return await this.errorMsg('error in capacity Calc');
        }
    }

    static async createUserDriver(obj) {
        try {
            let pass = 'demopass', user, msg, existUser;
            existUser = await User.findOne({ where: {email: obj.data.email}});
            if (existUser) {
                await User.update({
                    password: bcrypt.hashSync(pass, 8)
                }, {
                    where: {
                        email: obj.data.email
                    }
                });
                user = await User.findOne({
                    where: {
                        email: obj.data.email
                    }
                });
            } else {
                user = await User.create({
                    name: obj.data.fname,
                    email: obj.data.email,
                    password: bcrypt.hashSync(pass, 8)
                });
            }
            
            
            let clientUser, newUser, userData;
            clientUser = await Clients.findOne({ Email: obj.user.email });
            if(!clientUser) {
                newUser = await clientController.create({
                    ...obj.user,
                });
            }
            if (!existUser) {
                await Clients.findOneAndUpdate({
                    Email: obj.user.email
                }, {
                    $push: {Users: { Type: "driver", user: user.dataValues} }
                }, { new: true });
            }
            
            if ((clientUser || newUser) && !existUser) {
                userData = user.dataValues;
                await UserTypes.create({
                    userId: userData.id,
                    types: 'driver'
                });
                await UserRole.create({
                    roleId: 1,
                    userId: userData.id
                });
            }
            let subject = 'Less Platform driver registration';
            let text = `
                Welcome aboard, ${obj.data.fname}!\r\n
                First tap on the link below and install our app from Google Play.\r\n
                http://bit.ly/LessPlatformDriverApp\r\n
                \r\n
            Then login using your credentials:\r\n
            Email: ${obj.data.email}\r\n
            Password: ${pass}\r\n
            \r\n
            \r\n
            Please, make sure to keep it safe and don't share it with anyone.\r\n
            If you didn't try to sign up, don't worry. You can safely ignore this email.`;
            await Mailer.sendMail(user.email, subject, text);
            msg = 'A message is sent to the driver\'s email that contains his password.';
            let driver = await Driver.findOne({ where: { id: obj.id}});
            let cl = new DriverClass({data: {
                id: obj.id,
                ...driver.dataValues,
                mobileActive: 1
            }});
            await cl.edit();
            return {
                status: 1,
                msg,
            };
        } catch (error) {
            return await this.errorMsg(error.message);
        }
    }
    // STOP
    static async calcTotalDuration2(data) {
        let { load, news, distDur, shift } = data;
        let waitingTime, startTime = new Date(load.startTime).getTime(), tDur = 0, fullDur = 0;
        let { legs } = distDur;

        let sameOrders = await Checks.checkSameLocOrders({
            orders: news,
            flowType: load.flowType
        });
        let i = 0, bool = false;
        let rech = 0, waitTime = 0;
        let { brTime, shiftVal, rest, recharge, status } = await this.checkShift({ shift, load });
        if (!status) {
            console.log('error in check Shift');
        }
        for (const [l, leg] of distDur.legs.entries()) {
            
            if (sameOrders.newOrders[l]) {
                waitingTime = await Checks.waitingTime2({
                    newOrders: sameOrders.newOrders[l],
                    distDur,
                    flowType: load.flowType,
                    startTime,
                    l
                });
                startTime += ((rech + leg.duration + waitingTime + sameOrders.newOrders[l].servicetime) * 1000);
                tDur += leg.duration;
                tDur += waitingTime;
                waitTime = waitingTime;
                tDur += sameOrders.newOrders[l].servicetime;
            } else {
                tDur += leg.duration;
            }
            
            
            if (tDur >= brTime) {
                if (tDur - fullDur > shiftVal) {
                    bool = false;
                }
                if ((i > 0 && tDur < shiftVal && distDur.legs[l+1] && (tDur + distDur.legs[l+1].duration) > shiftVal) || (i > 0 && !bool && tDur > shiftVal)) {
                    fullDur += ((tDur - fullDur) + recharge);
                    tDur = 0;
                    rech += recharge;
                    bool = true;
                } else if (i == 0 && (tDur - fullDur) > shiftVal) {
                    tDur += (rest * Math.floor(tDur / shiftVal));
                    tDur += (recharge * Math.floor(tDur / shiftVal));
                    fullDur += (tDur - fullDur);
                    tDur = 0;
                }else if (i == 0 && (tDur - fullDur) >= brTime && (tDur - fullDur) < shiftVal) {
                   tDur += rest;
                } else if (i == 0 && (tDur - fullDur) >= shiftVal) {
                    tDur += rest;
                    tDur += recharge;
                }
                i++;

                if (tDur == 0) {
                    i = 0;
                }
            }
            if (tDur == 0) {
                tDur = fullDur;
            }
            
        }
        // fullDur = tDur;
        return {
            totalDuration: tDur,
            recharge: rech
        };
    }

    static async checkShift(data) {
        try {
            let { shift, load } = data;
            let brTime, shiftVal, rest, recharge;
            if (shift) {
                rest = shift.rest; brTime = shift.break_time; shiftVal = shift.shift; recharge = shift.recharge;
            } else if (load.shiftId) {
                rest = load.shift.rest; brTime = load.shift.break_time; shiftVal = load.shift.shift; recharge = load.shift.recharge;
            }
            return { brTime, shiftVal, rest, recharge, status: 1 };
        } catch (error) {
            console.log('checkShift', error.message);
            return await this.errorMsg('checkShift catch error');
        }
    }
    static async getMilisecond(text) {
        let miliSeconds = moment(text, 'DD/MM/YYYY HH:mm A').format('x');
        return miliSeconds;
    }
    static async fixLatLonByFlowType(points, flowtype) {
        let arr = points;
        for (const [i, item] of arr.entries()) {
            arr[i].deliveryLon = flowtype == 2 ? item.findPoint.longitude : 0;
            arr[i].deliveryLat = flowtype == 2 ? item.findPoint.latitude : 0;
            arr[i].pickupLon = flowtype == 1 ? item.findPoint.longitude : 0;
            arr[i].pickupLat = flowtype == 1 ? item.findPoint.latitude : 0;
        }
        return arr;

    }

    static async getGeoLoc(cityState, zip){
        // get from db
        let filter = undefined;
        if(cityState){
            filter = { CityState: new RegExp(`^${cityState}$`, 'i') };
        }else if(zip) {
            filter = { PostalCode: new RegExp(`^${zip}$`, 'i') };
        }
        if(!filter){
            return undefined;
        }

        let geoLoc = await GeoLoc.findOne(filter);

        if(geoLoc){
            return geoLoc;
        }

        // get from google
        const { data } = cityState ? await osrm.GeoLoc(cityState) : await osrm.GeoLoc(zip);

        if(!data || !data.results || !(data.results.length > 0) ){
            // console.log('- cityState: ', cityState, data)
            return false;
        }

        const r = data.results[0];

        let countryLong = undefined;
        let countryShort = undefined;
        let stateLong = undefined;
        let stateShort = undefined;
        let cityLong = undefined;
        let cityShort = undefined;
        let postalCode = undefined;

        if(r.address_components){
            for(let i=0; i<r.address_components.length; i++){
                if(!r.address_components[i].types){
                    continue;
                }
                if(r.address_components[i].types.includes("country") ){
                    countryLong = r.address_components[i].long_name;
                    countryShort = r.address_components[i].short_name;
                }else if( r.address_components[i].types.includes('administrative_area_level_1') ){
                    stateLong = r.address_components[i].long_name;
                    stateShort = r.address_components[i].short_name;
                }else if( r.address_components[i].types.includes('locality') ){
                    cityLong = r.address_components[i].long_name;
                    cityShort = r.address_components[i].short_name;
                }else if( r.address_components[i].types.includes('postal_code') ){
                    // postalCode = r.address_components[i].long_name
                    postalCode = r.address_components[i].short_name;
                }
            }
        }

        if(!r.geometry || !r.geometry.location){
            return false;
        }

        // save new GeoLoc
        geoLoc = new GeoLoc({
            Latitude: r.geometry.location.lat,
            Longitude: r.geometry.location.lng,
            CountryLong: countryLong,
            CountryShort: countryShort,
            StateLong: stateLong,
            StateShort: stateShort,
            CityLong: cityLong,
            CityShort: cityShort,
            CityState: cityState,
            PostalCode: postalCode
        });

        await geoLoc.save();

        return geoLoc;
    }

    
    static getDateObjectDATUpload(date, timezone){
        try{
            let inputDate = moment(date);
            let format = moment(inputDate._i, inputDate._f).format("YYYY-MM-DDTHH:mm:ss.SSS");

            let date1 = moment(format).set({hour:0,minute:0,second:0,millisecond:0}).subtract(timezone, 'hours').format("YYYY-MM-DDTHH:mm:ss.SSS");
            let date2 = moment(format).subtract(timezone, 'hours');
            const dtTo = moment(date2.add(moment.duration(1, 'days')).subtract(1, 'second'), 'x').format("YYYY-MM-DDTHH:mm:ss.SSS");   
            return { from: date1, to: dtTo };
        }catch(ex){
            console.log('- date convert exception: ', ex);
            return date;
        }
    }
    static getDateObjectDATUploadDelivery(date, dayRange, timezone){
        try{
            let inputDate = moment(date);
            let format = moment(inputDate._i, inputDate._f).format("YYYY-MM-DDTHH:mm:ss.SSS");
            let date1 = moment(format).subtract(timezone, 'hours').format("YYYY-MM-DDTHH:mm:ss.SSS");


            let date2 = moment(format).subtract(timezone, 'hours');
            const dtFrom = moment(date2.add(moment.duration(dayRange, 'days')), 'x').format("YYYY-MM-DDTHH:mm:ss.SSS");
            // const dtTo = moment(dtFrom.add(moment.duration(1, 'days')).subtract(1, 'second'), 'x').format("YYYY-MM-DDTHH:mm:ss.SSS");
            // const dtTo = moment(dtFrom).set({hour:0,minute:0,second:0,millisecond:0}).subtract(1, 'second').subtract(timezone, 'hours').format("YYYY-MM-DDTHH:mm:ss.SSS");

            const dtTo = moment(date2.add(moment.duration(1, 'days')), 'x').subtract(1, 'second').format("YYYY-MM-DDTHH:mm:ss.SSS");   

            return { from: dtFrom, to: dtTo };
        }catch(ex){
            console.log('- date convert exception: ', ex);
            return date;
        }
    }

    static async getAddressForMobile(data){
        const geoLoc = data.zip ? await this.getGeoLoc(null, data.zip) : data.city && data.state ? await this.getGeoLoc(`${data.city}, ${data.state}`) : false;
        if(!geoLoc){
            console.log('Map Error');
            return false;
        }
        let lat, lon;
        let LatLon = await osrm.OSRMGeoLoc(`${geoLoc.Longitude},${geoLoc.Latitude}`);
        lat = LatLon.data.waypoints[0].location[1];
        lon = LatLon.data.waypoints[0].location[0];
        let obj = {
            lat: lat ? lat : 0,
            lon: lon ? lon : 0,
            country: data.country,
            countryCode: data.countryCode,
            state: data.state,
            city: data.city,
            cityId: data.cityId,
            zip: data.zip,
            street: data.street,
            accessorials: data.accessorials ? data.accessorials : 0,
            timeWindowFrom: data.timeWindowFrom,
            timeWindowTo: data.timeWindowTo,
            company: data.company
        };
        return obj;
    }

    static async generateLoadOrCapacityName(data) {
        let { code, type } = data, count, strCount, str = "";
        
        if (type == 'L') {
            count = await LoadBoard.countDocuments({
                'order.equipment.code': code
            });
        } else if (type == 'C') {
            count = await CapacityBoard.countDocuments({
                'order.equipment.code': code
            });
        }
        strCount = 6 - (((count+1)+"").length);
        if (strCount > 0) {
            for (let index = 0; index < strCount; index++) {
                str += '0';
            }
        }
        
        let name = `${type}${code}${str}${count+1}`;
        return name;
    }

    static async groupStops(data) {
        let orderIds = data.Legs, arr = [], stopLocations = [], orderIdsObj = [], orderBool = 1, ids = [];
        for (const [i, item] of orderIds.entries()) {
            if (i !== 0 || i !== orderIds.length-1) {
                arr.push({
                    IsCapacity: item.IsCapacity,
                    orderId: item.OrderSSID,
                    action: item.Action,
                    lat: item.Position.Latitude,
                    lon: item.Position.Longitude
                });
            }
            
        }
        let order;
        if (arr[0].IsCapacity) {
            order = await CapacityBoard.findById(arr[0].orderId);
        } else {
            order = await LoadBoard.findById(arr[0].orderId);
        }
        
        stopLocations.push({
            ...arr[0],
            orderId: [arr[0].orderId],
            orders: {},
            ordersMobile: [],
        });
        order._doc.action = arr[0].action;
        order._doc.IsCapacity = arr[0].IsCapacity;
        stopLocations[0].orders[arr[0].orderId] = {...order };
        stopLocations[0].ordersMobile.push(order);
        orderIdsObj.push({ id: arr[0].orderId, IsCapacity: arr[0].IsCapacity });
        for (let i = 1; i < arr.length; i++) {
            for (const idObj of orderIdsObj) {
                if (arr[i].IsCapacity == idObj.IsCapacity && arr[i].orderId == idObj.id) {
                    orderBool = 0;
                }
            }
            if (orderBool) {
                orderIdsObj.push({ id: arr[i].orderId, IsCapacity: arr[i].IsCapacity });
            }
            orderBool == false;
            let lat = stopLocations[stopLocations.length-1].lat;
            let lon = stopLocations[stopLocations.length-1].lon;
            let action = stopLocations[stopLocations.length-1].action;
            if (arr[i].IsCapacity) {
                order = await CapacityBoard.findById(arr[i].orderId);
            } else {
                order = await LoadBoard.findById(arr[i].orderId);
            }
            if (lat == arr[i].lat && lon == arr[i].lon) {
                stopLocations[stopLocations.length-1].orderId.push(arr[i].orderId);
                order._doc.action = arr[i].action;
                order._doc.IsCapacity = arr[i].IsCapacity;
                stopLocations[stopLocations.length-1].orders[arr[i].orderId] = {...order};
                stopLocations[stopLocations.length-1].ordersMobile.push(order);
            } else {
                stopLocations.push({
                    ...arr[i],
                    orderId: [arr[i].orderId],
                    orders: {},
                    ordersMobile: []
                });
                order._doc.action = arr[i].action;
                order._doc.IsCapacity = arr[i].IsCapacity;
                stopLocations[stopLocations.length-1].orders[arr[i].orderId] = {...order};
                stopLocations[stopLocations.length-1].ordersMobile.push(order);
            }
        }
        for (const obj of orderIdsObj) {
            ids.push(obj.id);
        }
        return {
            stopLocations,
            ids
        };
    }

    static async joinStops(data) {
        let newStops = data, joinStops = [];
        for (const [s, stop] of newStops.entries()) {
            if(s == 0) {
                joinStops.push(stop);
            } else {
                if (stop.lat == joinStops[joinStops.length-1].lat && stop.lon == joinStops[joinStops.length-1].lon) {
                    joinStops[joinStops.length-1].orderId = joinStops[joinStops.length-1].orderId.concat(stop.orderId);
                    joinStops[joinStops.length-1].orders[stop.orderId[0]] = stop.orders[stop.orderId[0]];
                    joinStops[joinStops.length-1].ordersMobile.push(stop.orders[stop.orderId[0]]);
                } else {
                    joinStops.push(stop);
                }
            }
        }
        return joinStops;
    }

    static async pushInNewStops(data, flag) {
        let newStop = {}, orders = {}, ordersMobile = [];
        let { order, i, stop, orderId, action } = data;
        orders[stop.orderId[i]] = !flag ? {
            ...stop.orders[stop.orderId[i]],
            order: order.order
        } : {
            ...stop.orders[stop.orderId[i]],
        };
        !flag ? ordersMobile.push({
            ...stop.orders[stop.orderId[i]],
            order: order.order
        }) : ordersMobile.push({
            ...stop.orders[stop.orderId[i]],
        });
        newStop = {
            IsCapacity: stop.orders[stop.orderId[i]].IsCapacity,
            action: stop.orders[stop.orderId[i]].action,
            lat: action == 2 || action == 0 ? order.order.start.lat : order.order.end.lat,
            lon: action == 2 || action == 0 ? order.order.start.lon : order.order.end.lon,
            orderId: [orderId],
            orders,
            ordersMobile
        };
        return newStop;
    }

    static async countSizeWeight(data) {
        let loads, size = 0, weight = 0;
        loads = await LoadBoard.find({
            "_id": {
                $in: data
            }
        });
        for (const load of loads) {
            size += load.order.size;
            weight += load.order.weight;
        }
        return {
            size, weight
        };
    }
    static async editGroupStops(data, IsCapacity) {
        let { orderId, plannings } = data, order, stops, newStops = [], joinStops = [], loadIds = [], planningSizeWeight;
        for (let planning of plannings) {
            stops = planning.stopLocations;
            if (IsCapacity) {
                order = await CapacityBoard.findById(orderId);
            } else {
                order = await LoadBoard.findById(orderId);
                loadIds = planning.orderIdsArr;
                planningSizeWeight = await this.countSizeWeight(loadIds);
            }        
            for (let stop of stops) {
                if (stop.orders[orderId] && stop.orders[orderId].IsCapacity == IsCapacity) {
                    if (stop.orderId.length == 1) {
                        stop.orders[orderId].order = order.order;
                        if (stop.action == 2 || stop.action == 0) {
                            stop.lat = order.order.start.lat;
                            stop.lon = order.order.start.lon;
                        } else {
                            stop.lat = order.order.end.lat;
                            stop.lon = order.order.end.lon;
                        }
                        for (const st of stop.ordersMobile) {
                            if (st._id == orderId) {
                                st.order = order.order;
                            }
                        }
                        newStops.push(stop);
                    } else {
                        for (let i = 0; i < stop.orderId.length; i++) {
                            
                            let obj;
                            if (stop.orderId[i] == orderId) {
                                
                                if (stop.orders[stop.orderId[i]].action == 2 || stop.orders[stop.orderId[i]].action == 0) {
                                    obj = await this.pushInNewStops({
                                        order,
                                        i,
                                        stop,
                                        orderId: stop.orderId[i],
                                        action: stop.orders[stop.orderId[i]].action
                                    }, false);
                                    newStops.push(obj);
                                    
                                } else {
                                    obj = await this.pushInNewStops({
                                        order,
                                        i,
                                        stop,
                                        orderId: stop.orderId[i],
                                        action: stop.orders[stop.orderId[i]].action
                                    }, false);
                                    newStops.push(obj);
                                }
                                
                            } else {
                                obj = await this.pushInNewStops({
                                    order,
                                    i,
                                    stop,
                                    orderId: stop.orderId[i],
                                    action: stop.orders[stop.orderId[i]].action
                                }, true);
                                newStops.push(obj);
                            }
                        }
                    }
                } else {
                    newStops.push(stop);
                }
            }
            joinStops = await this.joinStops(newStops);
            let calcClass = new Calculation({data: {stopLocations: joinStops, noHos: planning.noHos}});
            let {totalDur, distDur }= await calcClass.calculation();
            await PlanningModel.findOneAndUpdate({_id: planning._doc._id}, {
                stopLocations: joinStops,
                feet: planningSizeWeight && planningSizeWeight.size ? planningSizeWeight.size : planning.feet,
                weight: planningSizeWeight && planningSizeWeight.weight ? planningSizeWeight.weight : planning.weight,
                totalDistance: distDur.distance,
                totalDuration: totalDur/60,
            }, {new: true}).catch(err => {
                console.log('Error: ', err);
            });
        }
    }

    static async getLimit(limit) {
        let loadLimit = 0, capacityLimit = 0;
        if (limit >= 400) {
            loadLimit = 200;
            capacityLimit = 200;
        } else if (limit < 400 && limit > 200) {
            limit = limit / 2;
            loadLimit = Math.floor(limit);
            capacityLimit = Math.floor(limit);
        } else {
            loadLimit = limit;
            capacityLimit = limit;
        }
        return {
            loadLimit,
            capacityLimit
        };
    }

    static async checkFilterForMobile(data) {
        let { mobile, capacityFilters, loadFilters } = data;
        let capFilter = {}, capBool = false, lFilter = {}, loadBool = false;
        if (mobile) {
            if (!capacityFilters) {
                capFilter = capacityFilters;
            } else {
                for (const key in capacityFilters) {
                    if (capacityFilters[key] || (capacityFilters[key] != false && capacityFilters[key] != "")) {
                        capFilter[key] = capacityFilters[key];
                        capBool = true;
                    }
                }
            }
            if (!loadFilters) {
                lFilter = loadFilters;
            } else {
                for (const key in loadFilters) {
                    if (loadFilters[key] || (loadFilters[key] != false && loadFilters[key] != "")) {
                        lFilter[key] = loadFilters[key];
                        loadBool = true;
                    }
                }
            }
        } else {
            capBool = true;
            loadBool = true;
            capFilter = capacityFilters;
            lFilter = loadFilters;
        }
        return {
            capFilter: capBool ? capFilter : null,
            lFilter: loadBool ? lFilter : null
        };
    }

    static async capLoadWhere(data) {
        let dateWindow, loadQuery, capacityQuery;
        let { date, timezone, dateRange, selectedCapacitiesIds, capacityFilters, selectedLoadsIds, loadFilters, userId, userType, mobile, limits } = data;
        let filters = await this.checkFilterForMobile({
            mobile,
            capacityFilters,
            loadFilters,
            userId,
            userType
        });
        dateWindow = this.getFlatbedDatesFromEndFormatted(date, timezone, dateRange);
        // CapacityBoard Where
        if (selectedCapacitiesIds.length && !filters.capFilter) {
            capacityQuery = {
                ...await fillters.getCapFilterObject({ ids: selectedCapacitiesIds }),
                "order.end": { $exists: true },
                "order.end.timeWindowFrom": { $exists: true }
            };
        } else if (filters.capFilter) {
            capacityQuery = {
                ...await fillters.getCapFilterObject(filters.capFilter),
                "order.end": { $exists: true },
                "order.end.timeWindowFrom": { $exists: true }
            };
        } else {
            capacityQuery = {
                "order.start.timeWindowFrom": { 
                    $gte: dateWindow.from,
                    $lte: dateWindow.to
                },
                "order.end": { $exists: true },
                "order.end.timeWindowFrom": { $exists: true }
            };
        }
        // LoadBoard Where
        if (selectedLoadsIds.length && !filters.lFilter) {
            loadQuery = await fillters.getLoadFilterObject({
                ids: selectedLoadsIds
            });

        } else if (filters.lFilter) {
            loadQuery = await fillters.getLoadFilterObject(filters.lFilter);
        } else {
            loadQuery = {
                "order.start.timeWindowFrom": { 
                    $gte: dateWindow.from,
                    $lte: dateWindow.to
                },
                "order.end": { $exists: true },
                "order.end.timeWindowFrom": { $exists: true }
            };
        }
        if (userType == 'shipper') {
            loadQuery = {
                ...loadQuery,
                "publishedBy.userId": userId
            };
        } else {
            capacityQuery = {
                ...capacityQuery,
                "publishedBy.userId": userId
            };
        }
        return {
            loadQuery,
            capacityQuery
        };
        
    }
    static async getLoadAndCapacities(data) {
        let { selectedCapacitiesIds, capacityFilters, selectedLoadsIds, loadFilters, limits, date, timezone, dateRange, userId, mobile, userType } = data;
        
        let loadBoards, capacityBoards, capLoadWhere;
        capLoadWhere = await this.capLoadWhere({
            date, timezone, dateRange, selectedCapacitiesIds, capacityFilters, selectedLoadsIds, loadFilters, userId, userType, mobile, limits
        });
        // Find CapacityBoards
        capacityBoards = await CapacityBoard.find(capLoadWhere.capacityQuery).limit(limits.capacityLimit);
        // Find LoadBoards
        loadBoards = await LoadBoard.find(capLoadWhere.loadQuery).limit(limits.loadLimit);
        return {
            loadBoards,
            capacityBoards
        };
    }
    static async joinCapacityLoadBoards(data) {
        let { capacityBoards, loadBoards } = data, orders = [];
        let idIndex = 1;
        for (const cb of capacityBoards) {
            if(cb.order.end){ // || !cb.order.end.timeWindowFrom || !cb.order.end.timeWindowTo){
                orders.push({
                    "id": idIndex++, // cb.number, // cb._id,
                    "sid": `cap__${cb._id}`,
                    "ssid": cb._id,
                    "IsCapacity": true,
                    "feet": cb.order.availableSize,
                    "weight": cb.order.availableWeight,
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
                    "servicetime": cb.order.servicetime ? cb.order.servicetime : 1
                });
            }
            
        }
        for (const lb of loadBoards) {
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
                "servicetime": lb.order.servicetime ? lb.order.servicetime : 1
            });
        }
        const date = new Date();
        date.setFullYear(1970);
        const fakeData = [
            {
                "id": idIndex++, // lb.number, // lb._id,
                "sid": `load__1`,
                "ssid": '1',
                "IsCapacity": false,
                "feet": 12,
                "weight": 22,
                "cube": 0,
                "flowType": 3,
                "priority": 1,
                "deliveryLat": 41.01,
                "deliveryLon": 28.9603,
                "pickupLat":  41.01,
                "pickupLon": 28.9603,
                "deliverydateFrom": date,
                "deliverydateTo": date,
                "pickupdateFrom": date,
                "pickupdateTo": date,
                "servicetime": 1
            },
            {
                "id": idIndex++, // lb.number, // lb._id,
                "sid": `load__1`,
                "ssid": '1',
                "IsCapacity": false,
                "feet": 12,
                "weight": 22,
                "cube": 0,
                "flowType": 3,
                "priority": 1,
                "deliveryLat": 41.01,
                "deliveryLon": 28.9603,
                "pickupLat":  41.01,
                "pickupLon": 28.9603,
                "deliverydateFrom": date,
                "deliverydateTo": date,
                "pickupdateFrom": date,
                "pickupdateTo": date,
                "servicetime": 1
            }
        ];
        fakeData.map(item => orders.push(item));
        return orders;
    }
    static async getOrders(data, flag) {
        let { loadFilters, capacityFilters, selectedLoadsIds, selectedCapacitiesIds, userId, limit, date, timezone, dateRange, mobile, user } = data;
        let limits, datas, bool = false, userType = user.type;
        limits = await this.getLimit(limit);
        datas = await this.getLoadAndCapacities({
            selectedCapacitiesIds, capacityFilters, selectedLoadsIds, loadFilters, limits, date, timezone, dateRange, userId, mobile, userType
        });
        if (limits.loadLimit > datas.loadBoards.length) {
            limits.capacityLimit += (limits.loadLimit - datas.loadBoards.length);
            bool = true;
        } else if (limits.capacityLimit > datas.capacityBoards.length) {
            limits.loadLimit += (limits.capacityLimit - datas.capacityBoards.length);
            bool = true;
        }
        if (bool) {
            datas = await this.getLoadAndCapacities({
                selectedCapacitiesIds, capacityFilters, selectedLoadsIds, loadFilters, limits, date, timezone, dateRange, userId, mobile, userType
            });
        }
        
        let dataArr = await this.joinCapacityLoadBoards(datas);
        return dataArr;

    }

    static async findState(data) {
        let { state } = data, shortState;
        for (const item of states) {
            if (item.name == state) {
                shortState = item.abbreviation;
            }
        }
        return shortState;
    }
    static async rangeDates(data) {
        let { start, end } = data;
        let startFrom = moment(start.timeWindowFrom, 'YYYY-MM-DDTHH:mm:ss.SSS'), startTo = moment(start.timeWindowTo, 'YYYY-MM-DDTHH:mm:ss.SSS');
        let endFrom = moment(end.timeWindowFrom, 'YYYY-MM-DDTHH:mm:ss.SSS'), endTo = moment(end.timeWindowTo, 'YYYY-MM-DDTHH:mm:ss.SSS');
        let startRange = startTo.diff(startFrom)/86400000;
        let endRange = endTo.diff(endFrom)/86400000;
        let startEndRange = endFrom.diff(startFrom)/86400000;
        return {
            startRange,
            endRange,
            startEndRange
        };
    }

    static async loadFilterForPush(data) {
        let { Filters } = data, filterObj = {};
        let dateNow = moment().format('x');
        if (Filters.loadsFilters && Object.keys(Filters.loadsFilters).length) {
			filterObj["listFilters.loadsFilters"] = {
				filter: Filters.loadsFilters.filter,
				name: Filters.loadsFilters.name,
				id: dateNow
			};
		}
		if (Filters.capacityFilters && Object.keys(Filters.capacityFilters).length) {
			filterObj["listFilters.capacityFilters"] = {
				filter: Filters.capacityFilters.filter,
				name: Filters.capacityFilters.name,
				id: dateNow
			};
		}
		if (Filters.matchingFilters && Object.keys(Filters.matchingFilters).length) {
			filterObj["listFilters.matchingFilters"] = {
				filter: Filters.matchingFilters.filter,
				name: Filters.matchingFilters.name,
				id: dateNow
			};
        }
        // await this.checkSettingsByFilter(filterObj);
        return {
            $push: filterObj
        };
    }

    static async loadFilterForPull(data) {
        let { Filters } = data, filterObj = {};
        filterObj[`listFilters.${Filters.field}`] = {
            id: Filters.id
        };
        return {
            $pull: filterObj
        };
    }
    // static async checkSettingsByFilter(data) {

    // }

}; // End of Class

