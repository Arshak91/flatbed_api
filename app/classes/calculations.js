const Helper = require('./helpers');
const Checks = require('./checks');
const { NorderAttrb } = require('../classes/joinColumns.js');
const moment = require('moment');

const db = require('../config/db.config.js');
const osrm = require('../controller/osmap.controller');


const Op = db.Sequelize.Op;
const Load = db.load;
const LoadTemp = db.loadTemp;
const Order = db.order;
const seq = db.sequelize;
const Statuses = db.status;
const Depo = db.depo;
const OrderAttr = [
    ...NorderAttrb,
    // 'transporttypes.color',
    'statuses.color as statusColor',
    'statuses.id as statusId',
    'statuses.name as statusName',
    'statuses.statustype as statusType',
    'transporttypes.name as LoadType'
];

module.exports = class Calculations {
    static async stops(data, flag) {
        try {
            const { loadType, loads } = data;
            let str , type = [], dstr,
            date = new Date(loads.startTime).getTime();
            dstr = await this.getLatLonStringByFlowType(data);
            str = await Helper.joinLatLon(dstr.str);
            let { distDur, status, code, msg } = await osrm.GetDistDur(str);
            let { brTime, shiftVal, rest, recharge } = await Helper.checkShift({ load: loads });

            if (code != "Ok") {
                return {
                    status: 0,
                    msg
                };
            }
            if (!status) {
                return {
                    status: 0,
                    msg: "MAP ERROR"
                };
            }
            let str1 = data.loads.flowType == 2 || data.loads.flowType == 1 ? `${data.loads.depo.dataValues.lat},${data.loads.depo.dataValues.lon};`: ''; // depo latlon
            if (str1 == '') {
                return {
                    status: 0,
                    msg: "depo lat lon doesn't exist"
                };
            }
            let { orders, repOrders } = await this.addDataOrdersLatLonByFlowType(data);

            let groupConcatOrderIds = await Helper.groupConcatOrderIds(repOrders);
            if (!groupConcatOrderIds.status) {
                return {
                    status: 0,
                    msg: groupConcatOrderIds.msg
                };
            }

            let { legs } = distDur;
            let warnings = [], time = date, distTime = 0, fullDur = 0, rech = 0, brRest = 0, k = 0, k1 = 0, k2 = 0, sleepTime = 0;
            for (const [l, leg] of legs.entries()) {
                time += (leg.duration*1000);
                distTime += (leg.duration);
                let wrn = await this.addWarrningsByFlowType(data, orders[l], time);
                warnings = warnings.concat( wrn );
                if (data.loads.flowType == 2) {
                    if (time < new Date(orders[l].deliverydateFrom).getTime()) {
                        time += (new Date(orders[l].deliverydateFrom).getTime() - time);
                        distTime += ((new Date(orders[l].deliverydateFrom).getTime() - time)/1000);
                    }
                } else if (data.loads.flowType == 1) {
                    if (time < new Date(orders[l].pickupdateFrom).getTime()) {
                        time += (new Date(orders[l].pickupdateFrom).getTime() - time);
                        distTime += ((new Date(orders[l].pickupdateFrom).getTime() - time)/1000);
                    }
                }
                // Events
                if (data.loads.events && data.loads.events.length) {

                    // data, leg, date, str1, type
                    type = await this.addEvents(data, legs[l], date, str1, type);
                    
                } // event
                if (data.loads.flowType == 2 && (!orders[l].deliveryLat || !orders[l].deliveryLon)) {
                    return {
                        status: 0,
                        msg: "orderLatLon doesn't exist"
                    };
                } else if (data.loads.flowType == 1 && (!orders[l].pickupLat || !orders[l].pickupLon)) {
                    return {
                        status: 0,
                        msg: "orderLatLon doesn't exist"
                    };
                }
                // time += (orders[l].servicetime*1000);
                if (distTime >= brTime) {
                    if (k > 0 && distTime < shiftVal && legs[l+1] && (distTime + legs[l+1].duration > shiftVal)) {
                        time += (((distTime - time) + recharge)*1000);
                        distTime = 0;
                        rech = recharge;
                    } else if (k == 0 && distTime > shiftVal) {
                        distTime += (rest * Math.floor(distTime / shiftVal));
                        time += ((distTime + recharge)*1000);
                        rech = (recharge * (distTime / shiftVal));
                        distTime = 0;
                    }else if (k == 0) {
                        distTime += rest;
                        brRest = rest;
                        time += (rest * 1000);
                    }
                    k++;
                    if (distTime == 0) {
                        k = 0;
                    }
                }
                if (distTime == 0) {
                    distTime = time;
                }
                time += (orders[l].servicetime * 1000);
                str1 = await this.addSingleOrderLatlonByFlowType(str1, orders[l], data.loads);
            }
            
            for (const order of orders) {
                let bool = true;
                if (groupConcatOrderIds.newArr.length > 0) {
                    for ( const [r, repOrder] of groupConcatOrderIds.newArr.entries() ) {
                        if ( repOrder.includes(order.id) ) {
                            type.push({
                                type: 'order',
                                data: order,
                                orders: repOrder
                            });
                            bool = false;
                        }
                        if (bool && (r == groupConcatOrderIds.newArr.length - 1) && (!groupConcatOrderIds.newArr[groupConcatOrderIds.newArr.length -1].includes(order.id))) {
                            type.push({
                                type: 'order',
                                data: order,
                                orders: [order.id]
                            });
                        }
                    }
                } else {
                    type.push({
                        type: 'order',
                        data: order,
                        orders: [order.id]
                    });
                }
                
            }
            let latLonStr = await Helper.joinLatLon(str1);
            const allStops = await osrm.GetDistDur(latLonStr);

            if (allStops.code != "Ok") {
                return {
                    status: 0,
                    msg: allStops.msg
                };
            }

            let alllegs = allStops.distDur.legs, orderType = type;
            let newAllLegs = [], Etatime;
            let warningsArr = {};
            let tEta;
            let warning = 0;
            let info = {
                loads: {},
                loadTemps: {},
                loadsArr: []
            }, arr = [], totalDuration, statuses, fixDuration = 0, bool = false;
            statuses = await Statuses.findOne({ where: {id: 0}});
            console.log('loadTemp', loads.shiftId,  loads.shift.shiftName);
            // let { brTime, shiftVal, rest, recharge } = await this.checkShift({ load: loads });
            if (alllegs.length == 1) {
                alllegs[0]['type'] = orderType[0];
                totalDuration = (alllegs[0]['duration']*1);
                if (totalDuration >= brTime) {
                    // if (k1 > 0 && totalDuration < (shiftVal*1000) && alllegs[0].duration && (totalDuration + (alllegs[0].duration*1000) > shiftVal*1000)) {
                    //     fullDur += (totalDuration + (recharge*1000));
                    //     totalDuration = 0;
                    //     sleepTime += recharge;
                    // } else 
                    if (k1 == 0 && (totalDuration - fullDur) > shiftVal) {
                        totalDuration += (rest * Math.floor(totalDuration / shiftVal));
                        fullDur += (totalDuration - fullDur);
                        sleepTime += (recharge * Math.floor(totalDuration / shiftVal));
                        totalDuration = 0;
                    }else if (k1 == 0 && (totalDuration - fullDur) > brTime) {
                       totalDuration += rest;
                    }
                    k1++;
                    if (totalDuration == 0) {
                        k1 = 0;
                    }
                }
                if (totalDuration == 0) {
                    totalDuration = fullDur;
                }
                if (!alllegs[0]['type'].data.timeInfo) {
                    arr.push({
                        status: 0,
                        msg: "timeInfo null",
                        id: alllegs[0]['type'].data.id
                    });
                    alllegs[0]['type'].data.timeInfo = {};
                }
                if (alllegs[0]['type'].orders.length == 1) {
                    // totalDuration = (alllegs[0]['duration']*1);
                    tEta = (totalDuration*1000) + new Date(data.loads.dataValues.startTime).getTime();
                    let { obj, arr } = await Checks.timeInfo({
                        flowType: data.loads.flowType, allleg: alllegs[0]['type'].data, tEta, loadId: data.loads.id,
                        duration: totalDuration*1000,
                        shiftVal,
                        recharge
                    });
                    // Check by LoadType
                    let {status, newInfo, loadTempIds, loadIds, flowTypes } = await Checks.checkByLoadType({
                        loadType, timeInfo: alllegs[0]['type'].data.timeInfo, info, obj, arr, order: alllegs[0]['type'].data, loadId: loads.id, flowType: loads.flowType
                    });
                    if (status) {
                        alllegs[0]['type'].data.timeInfo.loads = newInfo.loads;
                        alllegs[0]['type'].data.timeInfo.loadTemps = newInfo.loadTemps;
                        alllegs[0]['type'].data.timeInfo.loadsArr = newInfo.loadsArr;
                        alllegs[0]['type'].data.statusId = statuses.dataValues.id;
                        alllegs[0]['type'].data.statusName = statuses.dataValues.name;
                        alllegs[0]['type'].data.statusType = statuses.dataValues.statustype;
                        alllegs[0]['type'].data.statusColor = statuses.dataValues.color;
                    }
                    await Order.update({
                        status: statuses.dataValues.id,
                        loadTempIds: loadTempIds,
                        loadIds: loadIds,
                        flowTypes: flowTypes,
                        timeInfo: newInfo,
                        isPlanned: 1
                    }, {
                        where: { id: {
                            [Op.in]: alllegs[0]['type'].orders
                        } }
                    }).catch(err => {
                        return {
                            status: 0,
                            message: err.message,
                            msg: "Error order update",
                            id: alllegs[0]['type'].orders
                        };
                    });
                    totalDuration += loadType == 0 ? newInfo.loadTemps[loads.id].waiting : newInfo.loads[loads.id].waiting;
                    totalDuration += orders.servicetime;
                } else if (alllegs[0]['type'].orders.length > 1) {
                    let orderIds = alllegs[0]['type'].orders;
                    // totalDuration = (alllegs[0]['duration']*1);
                    for (const [o, order] of orderIds.entries()) {
                        let orderServiceTime = await Order.findOne({ where: {id: order}});
                        tEta = (totalDuration*1000) + new Date(data.loads.dataValues.startTime).getTime();
                        
                        let { obj, arr } = await Checks.timeInfo({
                            flowType: data.loads.flowType, allleg: orderServiceTime.dataValues, tEta, loadId: data.loads.id,
                            duration: totalDuration*1000,
                            shiftVal,
                            recharge
                        });
                        // Check by LoadType
                        let timeInfo = await Order.findOne({ where: { id: order }});
                        let {status, newInfo, loadTempIds, loadIds, flowTypes }  = await Checks.checkByLoadType({
                            loadType, timeInfo: timeInfo.dataValues.timeInfo, info, obj, arr, order: alllegs[0]['type'].data, loadId: loads.id, flowType: loads.flowType
                        });
                        if (status) {
                            alllegs[0]['type'].data.timeInfo.loads = newInfo.loads;
                            alllegs[0]['type'].data.timeInfo.loadTemps = newInfo.loadTemps;
                            alllegs[0]['type'].data.timeInfo.loadsArr = newInfo.loadsArr;
                            alllegs[0]['type'].data.statusId = statuses.dataValues.id;
                            alllegs[0]['type'].data.statusName = statuses.dataValues.name;
                            alllegs[0]['type'].data.statusType = statuses.dataValues.statustype;
                            alllegs[0]['type'].data.statusColor = statuses.dataValues.color;
                        }
                        await Order.update({
                            status: statuses.dataValues.id,
                            loadTempIds: loadTempIds,
                            loadIds: loadIds,
                            flowTypes: flowTypes,
                            timeInfo: newInfo,
                            isPlanned: 1
                        }, {
                            where: { id: order }
                        }).catch(err => {
                            return {
                                status: 0,
                                message: err.message,
                                msg: "Error order update",
                                id: alllegs[0]['type'].orders
                            };
                        });
                        totalDuration += loadType == 0 ? newInfo.loadTemps[loads.id].waiting : newInfo.loads[loads.id].waiting;
                        totalDuration += orderServiceTime.dataValues.servicetime;
                    }
                }
                
                if (warnings.length > 0) {
                    for (const elem of warnings) {
                        if (alllegs[0]['type'].data.id == elem.orderId ) {
                            warning = 1;
                            alllegs[0]['type'].warningStatus = elem.status;
                            warningsArr[alllegs[0]['type'].data.id] = elem.status.name;
                        } else {
                            alllegs[0]['type'].warningStatus = null;
                        }
                    }
                } else {
                    alllegs[0]['type'].warningStatus = null;
                }
                newAllLegs.push(alllegs[0]);
            } else if(alllegs.length > 1) {
                totalDuration = 0;
                for (const [i, leg] of alllegs.entries()) {
                    totalDuration += (alllegs[i]['duration']*1);

                    alllegs[i]['type'] = orderType[i];
                    
                    if (!alllegs[i]['type'].data.timeInfo) {
                        arr.push({
                            status: 0,
                            msg: "timeInfo null",
                            id: alllegs[i]['type'].data.id
                        });
                        alllegs[i]['type'].data.timeInfo = {};
                    }
                    if (totalDuration >= brTime && (totalDuration - fullDur) >= brTime) {
                        if (k2 > 0 && (totalDuration - fullDur) < shiftVal && alllegs[i+1] && ((totalDuration - fullDur) + (alllegs[i+1].duration) > shiftVal)) {
                            fullDur += ((totalDuration - fullDur) + recharge);
                            totalDuration = 0;
                            sleepTime += recharge;
                        } else if (k2 > 0 && (totalDuration - fullDur) > shiftVal) {                            
                            sleepTime += (Math.floor(totalDuration / shiftVal) * recharge);
                            fullDur += ((totalDuration - fullDur) + recharge);
                            totalDuration = 0;
                        }else if (k2 == 0 && ((totalDuration - fullDur) >= brTime) && (totalDuration - fullDur) < shiftVal) {
                           totalDuration += rest;
                        } else if (k2 == 0 && (totalDuration - fullDur) > shiftVal) {
                            totalDuration += rest;
                            totalDuration += recharge;
                            fullDur += (totalDuration - fullDur);
                        }
                        k2++;
                        if (totalDuration == 0) {
                            k2 = 0;
                        }
                    }
                    if (totalDuration == 0) {
                        totalDuration = fullDur;
                    }
                    if (alllegs[i]['type'].orders.length == 1) {
                        tEta = (totalDuration*1000) + new Date(data.loads.dataValues.startTime).getTime();
                        let { obj, arr } = await Checks.timeInfo({
                            flowType: data.loads.flowType, allleg: alllegs[i]['type'].data, tEta, loadId: data.loads.id,
                            duration: totalDuration*1000,
                            shiftVal,
                            recharge
                        });
                        // Check by LoadType
                        // let timeInfo = await Order.findOne({ where: { id: order }});
                        let {status, newInfo, loadTempIds, loadIds, flowTypes } = await Checks.checkByLoadType({
                            loadType, timeInfo: alllegs[i]['type'].data.timeInfo, info, obj, arr, order: alllegs[i]['type'].data, loadId: loads.id, flowType: loads.flowType
                        });
                        if (status) {
                            alllegs[i]['type'].data.timeInfo.loads = newInfo.loads;
                            alllegs[i]['type'].data.timeInfo.loadTemps = newInfo.loadTemps;
                            alllegs[i]['type'].data.timeInfo.loadsArr = newInfo.loadsArr;
                            alllegs[i]['type'].data.statusId = statuses.dataValues.id;
                            alllegs[i]['type'].data.statusName = statuses.dataValues.name;
                            alllegs[i]['type'].data.statusType = statuses.dataValues.statustype;
                            alllegs[i]['type'].data.statusColor = statuses.dataValues.color;
                        }
                        
                        await Order.update({
                            status: statuses.dataValues.id,
                            loadTempIds: loadTempIds,
                            loadIds: loadIds,
                            flowTypes: flowTypes,
                            timeInfo: newInfo,
                            isPlanned: 1
                        }, {
                            where: { id: {
                                [Op.in]: alllegs[i]['type'].orders
                            } }
                        }).catch(err => {
                            arr.push({
                                status: 0,
                                message: err.message,
                                msg: "Error order update",
                                id: alllegs[i]['type'].orders
                            });
                        });
                        totalDuration += loadType == 0 ? newInfo.loadTemps[loads.id].waiting : newInfo.loads[loads.id].waiting;
                        totalDuration += alllegs[i]['type'].data.servicetime;
                    } else if (alllegs[i]['type'].orders.length > 1) {
                        let orderIds = alllegs[i]['type'].orders;
                        for (const [o, order] of orderIds.entries()) {
                            let orderServiceTime = await Order.findOne({ where: {id: order}});

                            tEta = (totalDuration*1000) + new Date(data.loads.dataValues.startTime).getTime();
                            
                            let { obj, arr } = await Checks.timeInfo({
                                flowType: data.loads.flowType, allleg: orderServiceTime.dataValues, tEta, loadId: data.loads.id,
                                duration: totalDuration*1000,
                                shiftVal,
                                recharge
                            });
                            // Check by LoadType
                            let timeInfo = await Order.findOne({ where: { id: order }});
                            let {status, newInfo, loadTempIds, loadIds, flowTypes } = await Checks.checkByLoadType({
                                loadType, timeInfo: timeInfo.dataValues.timeInfo, info, obj, arr, order: alllegs[i]['type'].data, loadId: loads.id, flowType: loads.flowType
                            });
                            if (o == 0) {
                                if (status) {
                                    alllegs[i]['type'].data.timeInfo.loads = newInfo.loads;
                                    alllegs[i]['type'].data.timeInfo.loadTemps = newInfo.loadTemps;
                                    alllegs[i]['type'].data.timeInfo.loadsArr = newInfo.loadsArr;
                                    alllegs[i]['type'].data.statusId = statuses.dataValues.id;
                                    alllegs[i]['type'].data.statusName = statuses.dataValues.name;
                                    alllegs[i]['type'].data.statusType = statuses.dataValues.statustype;
                                    alllegs[i]['type'].data.statusColor = statuses.dataValues.color;
                                }
                            }
                            await Order.update({
                                status: statuses.dataValues.id,
                                loadTempIds: loadTempIds,
                                loadIds: loadIds,
                                flowTypes: flowTypes,
                                timeInfo: newInfo,
                                isPlanned: 1
                            }, {
                                where: { id: order }
                            }).catch(err => {
                                console.log('catch Error', err);
                                arr.push({
                                    status: 0,
                                    message: err.message,
                                    msg: "Error order update",
                                    id: alllegs[i]['type'].orders
                                });
                            });
                            totalDuration += loadType == 0 ? newInfo.loadTemps[loads.id].waiting : newInfo.loads[loads.id].waiting;
                            totalDuration += orderServiceTime.dataValues.servicetime;
                        }
                    }
                    fixDuration += totalDuration;
                    if (warnings.length) {
                        warnings.forEach(elem => {
                            if (alllegs[i]['type'].data.id == elem.orderId ) {
                                warning = 1;
                                alllegs[i]['type'].warningStatus = elem.status;
                                warningsArr[alllegs[i]['type'].data.id] = elem.status.name;
                            } else {
                                alllegs[i]['type'].warningStatus = null;
                            }
                        });
                    } else {
                        alllegs[i]['type'].warningStatus = null;
                    }
                    newAllLegs.push(alllegs[i]);
                }
                for (const leg of alllegs) {
                    if (leg.type.data.statusId == null) {
                        leg.type.data.statusId = 0;
                    }
                }
            }
            let newLoad;
            if (loadType == 0) {
                await LoadTemp.update({
                    status: statuses.dataValues.id,
                    stopLocations: newAllLegs,
                    busy: 0,
                    warning: warning,
                    warningData: warningsArr
                }, {
                    where: {
                        id: data.loads.id
                    }
                });
                newLoad = await LoadTemp.findOne({
                    where: {
                        id: data.loads.id
                    }
                });
            } else {
                await Load.update({
                    status: statuses.dataValues.id,
                    stopLocations: newAllLegs,
                    warning: warning,
                    warningData: warningsArr
                }, {
                    where: {
                        id: data.loads.id
                    }
                });
                newLoad = await Load.findOne({
                    where: {
                        id: data.loads.id
                    }
                });
            }
            return {
                allStops: newLoad.stopLocations,
                sleepTime,
                totalDuration,
                status: 1,
                msg: "OK",
                warning
            };

        } catch (error) {
            console.log(error);
            return {
                status: 0,
                msg: error.message
            };
        }
    }

    static async calcETA2(data, ordersData=null) {
        try {
            const { loadId, orderETA } = data;

            const load = await Load.findOne({
                where: {
                    id: loadId
                }
            });
            let orders;
            // let orderId =ordersData ? ordersData.orders : [];
            const orderIds = await Helper.splitToIntArray(load.orders, ',');

            orders = load.orders;
            let allOrders;
            if (orderIds.length) {
                const query = await Helper.createSelectQueryWithJoin(['orders'], orders);
                allOrders = await seq.query(query, { type: seq.QueryTypes.SELECT });
            }
            let startTime = new Date(load.startTime).getTime();
            let stopLocations = load.stopLocations;
            let newStops = [];
            newStops = await this.updateStops1({ load, stopLocations, orderETA, startTime}, ordersData);
            await Load.update({
                stopLocations: newStops
            }, {
                where: {
                    id: loadId
                }
            });

            return loadId;
        } catch (error) {
            return {
                status: 0,
                msg: error.message
            };
        }
    }

    static blockCalcForLoad(load){

        let datetime = new Date(load.startTime);
        // get hours and minutes for left margin
        let hours = datetime.getHours();
        let minutes = datetime.getMinutes()/60;
            hours = hours + minutes;
        // get duration for block width
        let durationhours = Math.round(load.totalDuration/3600);
        // if( load.planType == "Auto" ){ durationhours = Math.round(load.totalDuration/60);  }
        // get block Day name 
        let day = datetime.toDateString().split(' ')[0];
        // if(durationhours > 24) { console.log(`${load.startTime}: - ${load.id} - ${load.totalDuration} - ${durationhours} - ${load.planType} `); }
        // width and left argin calculation  
        let width =  ( (durationhours * 100) / 24 ).toFixed(2);
        let left = ( ( hours * 100 ) / 24 ).toFixed(2);
        let block =  { "day": day, "width": width , "left": left };
    
         // console.log(`${load.startTime} :  ${driver.id} - ${load.id} - ${day}`);
         // console.log(block);
    
        return block;
    }
    static async dailyBlockCalcForLoad(load){
        let start = new Date(load.startTime).getTime(), emptyDur = 0, stopLastPoint, depo;
        if (load.flowType == 2 && load.return == 0) {
            depo = await Depo.findOne({ where: {id: load.depoId}});
            stopLastPoint = load.stopLocations[load.stopLocations.length-1].type.data;
            let LatLon = `${stopLastPoint.deliveryLat},${stopLastPoint.deliveryLon};${depo.lat},${depo.lon}`;
            const { distDur } = await osrm.GetDistDur(LatLon);
            console.log(distDur);
            emptyDur = distDur.duration;
        }
        // console.log(`${stopLastPoint.deliveryLat},${stopLastPoint.deliveryLon}`);        
        let startMili0 = start - 3600000;
        let startMili = start - 3600000;
        let datetime = new Date(startMili), block = [];
        let endDate = new Date(datetime.getTime() + ((load.totalDuration - emptyDur)*1000) + 7200000);
        let endMom = moment(endDate, 'ddd MMM DD gggg HH Z').format('YYYY-MM-DDTHH:00');
        let endTimeBySec = new Date(endMom).getTime()/1000;
        let startMom = moment(datetime, 'ddd MMM DD gggg HH Z').format('YYYY-MM-DDTHH:00');
        let startTimeBySec = new Date(startMom).getTime()/1000;
        let hoursArr = [];
        let hour = Math.ceil((endTimeBySec - startTimeBySec) / 3600);
        let stepTime, datetime2;
        for (let i = 0; i <= hour; i++) {
            datetime2 = new Date(startMili);
            stepTime = moment.utc(datetime2, 'ddd MMM DD gggg HH Z').format('HH:00');
            hoursArr.push(stepTime);
            startMili += 3600000;
        }
        datetime2 = new Date(startMili);
        stepTime = moment.utc(datetime2, 'ddd MMM DD gggg HH Z').format('HH:00');
        hoursArr.push(stepTime);
        startMili += 3600000;
        let totalDurHours = (startMili - startMili0) / 3600000;
        // get hours and minutes for left margin
        let startHours = datetime.getTime()/3600000;
        let startLeft = (start/3600000) - startHours;
        let day = datetime.toDateString().split(' ')[0];
        for (const [s, stop] of load.stopLocations.entries()) {
            let hours, hoursByPerc, left, serviceTime, waitingTime;
            if (s > 0) {
                let befLeaveTime = new Date(load.stopLocations[s-1].type.data.timeInfo.loads[load.id].leaveTime).getTime()/3600000;
                let arrTime = new Date(stop.type.data.timeInfo.loads[load.id].arTime).getTime()/3600000;
                let eta = new Date(stop.type.data.timeInfo.loads[load.id].eta).getTime()/3600000;
                let leaveTime = new Date(stop.type.data.timeInfo.loads[load.id].leaveTime).getTime()/3600000;
                let waitTime = stop.type.data.timeInfo.loads[load.id].waiting;
                hours = (eta - befLeaveTime);
                hoursByPerc = parseFloat((hours * 100) / totalDurHours).toFixed(1);
                serviceTime = parseFloat(((leaveTime - arrTime) * 100) / totalDurHours).toFixed(1);
                waitingTime = parseFloat(((waitTime / 3600) * 100) / totalDurHours).toFixed(1);
            } else {
                let arrTime = new Date(stop.type.data.timeInfo.loads[load.id].arTime).getTime()/3600000;
                let eta = new Date(stop.type.data.timeInfo.loads[load.id].eta).getTime()/3600000;
                let leaveTime = new Date(stop.type.data.timeInfo.loads[load.id].leaveTime).getTime()/3600000;
                let waitTime = stop.type.data.timeInfo.loads[load.id].waiting;
                hours = eta - startHours;
                hoursByPerc = parseFloat( ( hours * 100) / totalDurHours).toFixed(1);
                left = parseFloat( ( startLeft * 100 ) / totalDurHours ).toFixed(1);
                serviceTime = parseFloat(((leaveTime - arrTime) * 100) / totalDurHours).toFixed(1);
                waitingTime = parseFloat(((waitTime / 3600) * 100) / totalDurHours).toFixed(1);
            }
            block.push({
                index: s+1,
                drivingTime: hoursByPerc,
                serviceTime: serviceTime,
                waitingTime,
                left: left,
                day: day,
            });
        }
    
        return {
            block,
            hours: hoursArr
        };
    }

    static async emptymileage(data){
    
        let { orderIds } = data;
       let oids = data.load.orders;
       let arroids = Helper.splitToIntArray(orderIds, ",");
       let lastOrder;
       let firstOrder;
       let meters;
       let start = data.start;
       let end = data.end;
      
       
       if(data.load.flowType == 1){

            data.order.forEach(o => {
                if(o.id == arroids[0]) {  firstOrder = o; }
            });

            let dlatlon = start.Lat + ',' + start.Lon;
            let olatlon = firstOrder.pickupLat + ',' + firstOrder.pickupLon;
            let LatLon = `${dlatlon};${olatlon}`;
            
            const { distDur } = await osrm.GetDistDur(LatLon);
            meters = distDur.legs[0].distance;

       } // LP2D

        if(data.load.flowType == 2){
            data.order.forEach(o => {
                if(o.id == arroids[arroids.length -1]) {
                    lastOrder = o;
                } else if(o.id == arroids[arroids.length -2]) {
                    lastOrder = o;
                }
            });
            
            let dlatlon = end.Lat + ',' + end.Lon;
            let olatlon = lastOrder.deliveryLat + ',' + lastOrder.deliveryLon;
            if(data.ret == 0){
                let LatLon = `${olatlon};${dlatlon}`;
                // console.log("calc",LatLon);
                const { distDur } = await osrm.GetDistDur(LatLon);
                meters = distDur.legs[0].distance;
            } else{
                meters = 0;
            }
       } // D2E
       
       // let emptymile =  meters/1600;
       return meters;

    }

    /* -- */

    static async getLatLonStringByFlowType(data){
        let obj;
        let str='';
        
        if (data.loads.flowType == 2) {
            // console.log("------------------------------------------", data.loads.depo.dataValues.lat , data.loads.depo.dataValues.lon);
            //  console.log("------------------------------------------", load.depo.dataValues.lat , load.depo.dataValues.lon);
            // str += `${JSON.parse(load.start).Lat},${JSON.parse(load.start).Lon};`;
            str += `${data.loads.depo.dataValues.lat},${data.loads.depo.dataValues.lon};`;
            //  console.log(str);
        }
        if (data.loads.flowType == 1) {
            // console.log("------------------------------------------", data.loads.depo.dataValues.lat , data.loads.depo.dataValues.lon);
            str += `${data.loads.depo.dataValues.lat},${data.loads.depo.dataValues.lon};`;
        }
        for (let i = 0; i < data.orders.length; i++) {
            if (data.loads.flowType == 2) {
                str += `${data.orders[i].deliveryLat},${data.orders[i].deliveryLon};`;
            }
            if (data.loads.flowType == 1) {
                str += `${data.orders[i].pickupLat},${data.orders[i].pickupLon};`;
            }
        }
        obj = {str};
        return obj;
    }

    static async addDataOrdersLatLonByFlowType(data){

        let orders = [], repOrders = [];
        if (data.loads.flowType == 2) {
            orders.push(data.orders[0]);
            for (let i = 1; i < data.orders.length; i++) {
                if (data.orders[i].deliveryLon !== data.orders[i-1].deliveryLon && data.orders[i].deliveryLat !== data.orders[i-1].deliveryLat) {
                    orders.push(data.orders[i]);
                } else {
                    repOrders.push([data.orders[i-1].id, data.orders[i].id]);
                }
                
            }
        }
        if (data.loads.flowType == 1) {
            orders.push(data.orders[0]);
            for (let i = 1; i < data.orders.length; i++) {
                if (data.orders[i].pickupLon !== data.orders[i-1].pickupLon && data.orders[i].pickupLat !== data.orders[i-1].pickupLat) {
                    orders.push(data.orders[i]);
                } else {
                    repOrders.push([data.orders[i-1].id, data.orders[i].id]);
                }
                
            }
        }
        return {orders, repOrders};

    }

    static async addWarrningsByFlowType(data,order,date){
        const lateETA = await Statuses.findOne({ where: { id: 3 } });
        const overTime = await Statuses.findOne({ where: { id: 14 } });
        const departTime = await Statuses.findOne({ where: { id: 16 } });
        let wobj = [], startTime = new Date(data.loads.startTime).getTime(), maxShift = 0;
        if (data.loads.shift.max_shift > data.loads.shift.shift) {
            maxShift = (data.loads.shift.max_shift + (Math.floor(data.loads.shift.max_shift / data.loads.shift.shift) * data.loads.shift.recharge))*1000;
        } else {
            maxShift = data.loads.shift.max_shift * 1000;
        }
        let dateTime = date;
        if (data.loads.flowType == 2) {            
             //  changed || to &&
            if (dateTime > new Date(order.deliverydateTo).getTime()) {
                console.log('loadId: ', data.loads.id, 'orderId: ', order.id, 'warning: ', lateETA.dataValues.name);
                wobj.push({ orderId: order.id, status: lateETA });
            } else if ((startTime + maxShift) < new Date(order.deliverydateFrom).getTime()) {
                console.log(new Date(order.deliverydateFrom).getTime());
                console.log('loadId: ', data.loads.id, 'orderId: ', order.id, 'warning: ', overTime.dataValues.name);
                wobj.push({ orderId: order.id, status: overTime });
            } else if (dateTime + (order.servicetime*1000) > (new Date(order.deliverydateTo).getTime() + 60000)) {
                console.log('loadId: ', data.loads.id, 'orderId: ', order.id, 'warning: ', departTime.dataValues.name);
                wobj.push({ orderId: order.id, status: departTime });
            }
        }
        if (data.loads.flowType == 1) {
            if (dateTime > new Date(order.pickupdateTo).getTime()) {
                console.log('loadId: ', data.loads.id, 'orderId: ', order.id, 'warning: ', lateETA.dataValues.name);
                wobj.push({ orderId: order.id, status: lateETA });
            } else if ((startTime + (data.loads.shift.shift*1000)) < new Date(order.pickupdateFrom).getTime()) {
                console.log('loadId: ', data.loads.id, 'orderId: ', order.id, 'warning: ', overTime.dataValues.name);
                wobj.push({ orderId: order.id, status: overTime });
            } else if (dateTime + (order.servicetime*1000) > (new Date(order.deliverydateTo).getTime() + 60000)) {
                console.log('loadId: ', data.loads.id, 'orderId: ', order.id, 'warning: ', departTime.dataValues.name);
                wobj.push({ orderId: order.id, status: departTime });
            }
        }
        return wobj;
    }

    static async addSingleOrderLatlonByFlowType(str1, order, loads){
        if (loads.flowType == 2) {
            str1 += `${order.deliveryLat},${order.deliveryLon};`;
        }
        if (loads.flowType == 1) {
            str1 += `${order.pickupLat},${order.pickupLon};`;
        }
        return str1;
    }

    static async addEvents(data, leg, date, str1, type){
        for (const event of data.loads.events) {
                    
            if (leg && date < new Date(event.event_start_time).getTime() && new Date(event.event_start_time).getTime() < date + (leg.duration*1000)) {
                console.log("1", str1);
                str1 += `${event.lat},${event.lon};`;
                type.push({
                    type: 'event',
                    data: event
                });
            }
            leg ? date += (leg.duration*1000) : '';
        }
        return type;
    }

    static async updateStops1(data, ordersData = null) {
        try {
            let { load, stopLocations, orderETA, startTime } = data;
            let newStops = [], timeInfo, ord, status;
            if (ordersData && ordersData.status) {
                status = await Statuses.findOne({ where: { id: ordersData.status}});
            }
            let stTime = startTime;
            for (let [s, stop] of stopLocations.entries()) {
                if (stop.type.orders.length > 1) {
                    for (const order of stop.type.orders) {
                        ord = await Order.findOne({where: { id: order}});
                        stop.duration = orderETA[s].dur;
                        stop.type.data.timeInfo.loads[load.id].eta = new Date((stTime + (orderETA[s].dur*1000)));

                        let { arrTime, waiting } = await Helper.checkArTime({ eta: stTime + (stop.duration*1000), order: stop.type.data, flowType: load.flowType});

                        stop.type.data.timeInfo.loads[load.id].arTime = new Date(arrTime);
                        stop.type.data.timeInfo.loads[load.id].waiting = !waiting ? 0 : waiting/1000;
                        stop.type.data.timeInfo.loads[load.id].leaveTime = new Date((arrTime + (stop.type.data.servicetime*1000)));

                        if (ordersData && ordersData.ataId == order) {
                            stop.type.data.timeInfo.loads[load.id].ata = ordersData.status == 5 || ordersData.status == 0 ? null : ordersData.ata;
                            stop.type.data.statusColor = status.dataValues.color;
                            stop.type.data.statusId = ordersData.status;
                            stop.type.data.statusName = status.dataValues.name;
                            stop.type.data.statusType = status.dataValues.statustype;
                        }
                        // else if (!ordersData) {
                        //     stop.type.data.timeInfo.loads[load.id].ata = null;
                        // }
                        // else {
                        //     stop.type.data.statusColor = status.dataValues.color;
                        //     stop.type.data.statusId = ordersData.status;
                        //     stop.type.data.statusName = status.dataValues.name;
                        //     stop.type.data.statusType = status.dataValues.statustype;
                        // }

                        for (const item of stop.type.data.timeInfo.loadsArr) {
                            if (item.id == load.id) {
                                if (ordersData && ordersData.ataId == order) {
                                    item.ata = ordersData.status == 5 || ordersData.status == 0 ? null : ordersData.ata;
                                    // stop.type.data.statusColor = status.dataValues.color;
                                    // stop.type.data.statusId = ordersData.status;
                                    // stop.type.data.statusName = status.dataValues.name;
                                    // stop.type.data.statusType = status.dataValues.statustype;
                                }
                                // else if (!ordersData) { item.ata = null; }
                                item.eta = new Date((stTime + (orderETA[s].dur*1000)));
                                item.arTime = new Date(arrTime);
                                item.waiting = !waiting ? 0 : waiting/1000;
                                item.leaveTime = new Date((arrTime + (stop.type.data.servicetime*1000)));
                            }
                        }
                        timeInfo = {
                            ...ord.dataValues.timeInfo
                        };
                        timeInfo.loads[load.id] = stop.type.data.timeInfo.loads[load.id];
                        timeInfo.loadsArr = stop.type.data.timeInfo.loadsArr;
                        let obj;

                        if (ordersData && ordersData.ataId == ord.dataValues.id) {
                            obj = {
                                timeInfo,
                                status: ordersData.status
                            };
                        } else {
                            obj = {
                                timeInfo
                            };
                        }

                        await Order.update(obj, { where: { id: order}});
                        stTime += waiting;
                        stTime += (ord.servicetime*1000);
                    }
                } else if(stop.type.orders.length == 1) {
                    ord = await Order.findOne({where: { id: stop.type.orders[0]}});
                    stop.duration = orderETA[s].dur;
                    stop.type.data.timeInfo.loads[load.id].eta = new Date((stTime + (orderETA[s].dur*1000)));

                    let { arrTime, waiting } = await Helper.checkArTime({ eta: (stTime + (orderETA[s].dur*1000)), order: stop.type.data, flowType: load.flowType});
                    
                    stop.type.data.timeInfo.loads[load.id].arTime = new Date(arrTime);
                    stop.type.data.timeInfo.loads[load.id].waiting = !waiting ? 0 : waiting/1000;
                    stop.type.data.timeInfo.loads[load.id].leaveTime = new Date((arrTime + (stop.type.data.servicetime * 1000)));

                    if (ordersData && ordersData.ataId == ord.dataValues.id) {
                        stop.type.data.timeInfo.loads[load.id].ata = ordersData.status == 5 || ordersData.status == 0 ? null : ordersData.ata;
                        stop.type.data.statusColor = status.dataValues.color;
                        stop.type.data.statusId = ordersData.status;
                        stop.type.data.statusName = status.dataValues.name;
                        stop.type.data.statusType = status.dataValues.statustype;
                    }
                    // else if (!ordersData) {
                    //     stop.type.data.timeInfo.loads[load.id].ata = null;
                    // }

                    for (const item of stop.type.data.timeInfo.loadsArr) {
                        if (item.id == load.id) {
                            if (ordersData && ordersData.ataId == ord.dataValues.id) {
                                item.ata = ordersData.status == 5 || ordersData.status == 0 ? null : ordersData.ata;
                                // stop.type.data.statusColor = status.dataValues.color;
                                // stop.type.data.statusId = ordersData.status;
                                // stop.type.data.statusName = status.dataValues.name;
                                // stop.type.data.statusType = status.dataValues.statustype;
                            }
                            // else if(!ordersData) { item.ata = null; }
                            item.eta = new Date((stTime + (stop.duration*1000)));
                            item.arTime = new Date(arrTime);
                            item.waiting = !waiting ? 0 : waiting/1000;
                            item.leaveTime = new Date((arrTime + new Date(stop.type.data.servicetime).getTime()));
                        }
                    }
                    timeInfo = {
                        ...ord.dataValues.timeInfo
                    };
                    timeInfo.loads[load.id] = stop.type.data.timeInfo.loads[load.id];
                    timeInfo.loadsArr = stop.type.data.timeInfo.loadsArr;
                    let obj;
                    if (ordersData && ordersData.ataId == ord.dataValues.id) {
                        obj = {
                            timeInfo,
                            status: ordersData.status
                        };
                    } else {
                        obj = {
                            timeInfo
                        };
                    }
                    await Order.update(obj, { where: {id: stop.type.orders[0]}});
                    stTime += waiting;
                    stTime += (ord.servicetime*1000);
                }
                stTime += (orderETA[s].dur*1000);
                newStops.push(stop);
            }
            return newStops;
        } catch (error) {
            console.log('----', error);
            return {
                status: 0,
                msg: error.message
            };
        }
    }

    static async soloCalc(data) {
        try {
            let { id, legs, points, date, params, depot, shift } = data, distTime = 0, warnings = [];
            let point = await Helper.fixLatLonByFlowType(points, params.flowType),
            time = await Helper.getMilisecond(date), loadType = 1;

            let str1 = params.flowType == 2 || params.flowType == 1 ? `${depot.lat},${depot.lon};`: '';
            let deliverydateFrom, pickupdateFrom, type = [], rech = 0, brRest = 0, k = 0,
            textFrom, textTo, startTime = await Helper.getMilisecond(params.loadStartTime);
            let brTime = shift.break_time, shiftVal = shift.shift, rest = shift.rest, recharge = shift.recharge;
            let { orders, repOrders } = await this.addDataOrdersLatLonByFlowType({
                loads: {
                    flowType: params.flowType
                },
                orders: point
            });
            let groupConcatOrderIds = await Helper.groupConcatOrderIds(repOrders);
            if (!groupConcatOrderIds.status) {
                return {
                    status: 0,
                    msg: groupConcatOrderIds.msg
                };
            }
            for (const [l, leg] of legs.entries()) {
                textFrom = `${orders[l].date} ${orders[l].from}`;
                textTo = `${orders[l].date} ${orders[l].to}`;
                time += (leg.duration*1000);
                distTime += (leg.duration);
                // if (l == 0) {
                //     console.log('data: ', data, 'order: ', orders[l], 'date: ', time);
                // }
                let wrn = await this.addWarrningsByFlowType({
                    loads: {
                        id: id,
                        shift,
                        flowType: params.flowType,
                        startTime
                    }
                }, {
                    id: orders[l].id,
                    deliverydateTo: textTo,
                    deliverydateFrom: textFrom,
                    servicetime: orders[l].serviceTime
                }, time);
                warnings = warnings.concat( wrn );
                if (params.flowType == 2) {
                    deliverydateFrom = await Helper.getMilisecond(textFrom);
                    if (time < deliverydateFrom) {
                        time += (deliverydateFrom - time);
                        distTime += ((deliverydateFrom - time)/1000);
                    }
                } else if (params.flowType == 1) {
                    pickupdateFrom = await Helper.getMilisecond(textFrom);
                    if (time < pickupdateFrom) {
                        time += (pickupdateFrom - time);
                        distTime += ((pickupdateFrom - time)/1000);
                    }
                }
                if (params.flowType == 2 && (!orders[l].deliveryLat || !orders[l].deliveryLon)) {
                    return {
                        status: 0,
                        msg: "orderLatLon doesn't exist"
                    };
                } else if (params.flowType == 1 && (!orders[l].pickupLat || !orders[l].pickupLon)) {
                    return {
                        status: 0,
                        msg: "orderLatLon doesn't exist"
                    };
                }
                // time += (orders[l].servicetime*1000);
                if (distTime >= brTime) {
                    if (k > 0 && distTime < shiftVal && legs[l+1] && (distTime + legs[l+1].duration > shiftVal)) {
                        time += (((distTime - time) + recharge)*1000);
                        distTime = 0;
                        rech = recharge;
                    } else if (k == 0 && distTime > shiftVal) {
                        distTime += (rest * Math.floor(distTime / shiftVal));
                        time += ((distTime + recharge)*1000);
                        rech = (recharge * (distTime / shiftVal));
                        distTime = 0;
                    }else if (k == 0) {
                        distTime += rest;
                        brRest = rest;
                        time += (rest * 1000);
                    }
                    k++;
                    if (distTime == 0) {
                        k = 0;
                    }
                }
                if (distTime == 0) {
                    distTime = time;
                }
                time += (orders[l].servicetime * 1000);
                str1 = await this.addSingleOrderLatlonByFlowType(str1, {
                    deliveryLat: orders[l].findPoint.latitude,
                    deliveryLon: orders[l].findPoint.longitude,
                    pickupLat: orders[l].findPoint.latitude,
                    pickupLon: orders[l].findPoint.longitude,
                }, {
                    flowType: params.flowType
                });
            }

            for (const order of orders) {
                let bool = true;
                if (groupConcatOrderIds.newArr.length > 0) {
                    for ( const [r, repOrder] of groupConcatOrderIds.newArr.entries() ) {
                        if ( repOrder.includes(order.id) ) {
                            type.push({
                                type: 'order',
                                data: order,
                                orders: repOrder
                            });
                            bool = false;
                        }
                        if (bool && (r == groupConcatOrderIds.newArr.length - 1) && (!groupConcatOrderIds.newArr[groupConcatOrderIds.newArr.length -1].includes(order.id))) {
                            type.push({
                                type: 'order',
                                data: order,
                                orders: [order.id]
                            });
                        }
                    }
                } else {
                    type.push({
                        type: 'order',
                        data: order,
                        orders: [order.id]
                    });
                }
                
            }

            let latLonStr = await Helper.joinLatLon(str1);
            const allStops = await osrm.GetDistDur(latLonStr);

            if (allStops.code != "Ok") {
                return {
                    status: 0,
                    msg: allStops.msg
                };
            }
            let pointsArr = [];
            let alllegs = allStops.distDur.legs, orderType = type;
            let newAllLegs = [], k1 = 0, k2 = 0, fullDur = 0, sleepTime = 0;
            let warningsArr = {};
            let tEta;
            let warning = 0;
            let info = {
                loads: {},
                loadTemps: {},
                loadsArr: []
            }, arr = [], totalDuration, statuses;
            statuses = await Statuses.findOne({ where: {id: 0}});

            if (alllegs.length == 1) {
                alllegs[0]['type'] = orderType[0];
                totalDuration = (alllegs[0]['duration']*1);
                if (totalDuration >= brTime) {
                    // if (k1 > 0 && totalDuration < (shiftVal*1000) && alllegs[0].duration && (totalDuration + (alllegs[0].duration*1000) > shiftVal*1000)) {
                    //     fullDur += (totalDuration + (recharge*1000));
                    //     totalDuration = 0;
                    //     sleepTime += recharge;
                    // } else 
                    if (k1 == 0 && (totalDuration - fullDur) > shiftVal) {
                        totalDuration += (rest * Math.floor(totalDuration / shiftVal));
                        fullDur += (totalDuration - fullDur);
                        sleepTime += (recharge * Math.floor(totalDuration / shiftVal));
                        totalDuration = 0;
                    }else if (k1 == 0 && (totalDuration - fullDur) > brTime) {
                       totalDuration += rest;
                    }
                    k1++;
                    if (totalDuration == 0) {
                        k1 = 0;
                    }
                }
                if (totalDuration == 0) {
                    totalDuration = fullDur;
                }
                if (!alllegs[0]['type'].data.timeInfo) {
                    arr.push({
                        status: 0,
                        msg: "timeInfo null",
                        id: alllegs[0]['type'].data.id
                    });
                    alllegs[0]['type'].data.timeInfo = {};
                }
                if (alllegs[0]['type'].orders.length == 1) {
                    tEta = (totalDuration*1000) + startTime;
                    let from1 = await Helper.getMilisecond(`${alllegs[0]['type'].data.date} ${alllegs[0]['type'].data.from}`);
                    let to1 = await Helper.getMilisecond(`${alllegs[0]['type'].data.date} ${alllegs[0]['type'].data.to}`);
                    let { obj, arr } = await Checks.timeInfo({
                        flowType: params.flowType,
                        allleg: {
                            ...alllegs[0]['type'].data,
                            servicetime: alllegs[0]['type'].data.serviceTime,
                            deliverydateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                            deliverydateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                            pickupdateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                            pickupdateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),  
                        },
                        tEta,
                        loadId: id,
                        duration: totalDuration*1000,
                        shiftVal,
                        recharge
                    });
                    // Check by LoadType
                    let {status, newInfo, loadTempIds, loadIds, flowTypes } = await Checks.checkByLoadType({
                        loadType: 1, timeInfo: alllegs[0]['type'].data.timeInfo, info, obj, arr, order: alllegs[0]['type'].data, loadId: id, flowType: params.flowType
                    });
                    if (status) {
                        pointsArr.push({
                            date: newInfo.loads[id].eta,
                            id: alllegs[0]['type'].data.id
                        });
                        delete alllegs[0]['type'].data.deliveryLon;
                        delete alllegs[0]['type'].data.deliveryLat;
                        delete alllegs[0]['type'].data.pickupLon;
                        delete alllegs[0]['type'].data.pickupLat;
                    }
                    totalDuration += loadType == 0 ? newInfo.loadTemps[id].waiting : newInfo.loads[id].waiting;
                    totalDuration += alllegs[0]['type'].data.serviceTime;
                } else if (alllegs[0]['type'].orders.length > 1) {
                    let orderIds = alllegs[0]['type'].orders;
                    for (const [o, order] of orderIds.entries()) {
                        tEta = (totalDuration*1000) + new Date(data.loads.dataValues.startTime).getTime();
                        let oneOrder = points.filter(point => point.id == order);
                        let from1 = await Helper.getMilisecond(`${oneOrder.date} ${oneOrder.from}`);
                        let to1 = await Helper.getMilisecond(`${oneOrder.date} ${oneOrder.to}`);
                        let { obj, arr } = await Checks.timeInfo({
                            flowType: data.loads.flowType,
                            allleg: {
                                ...oneOrder,
                                servicetime: oneOrder.serviceTime,
                                deliverydateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                deliverydateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                pickupdateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                pickupdateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),   
                            },
                            tEta,
                            loadId: data.loads.id,
                            duration: totalDuration*1000,
                            shiftVal,
                            recharge
                        });
                        // Check by LoadType
                        let {status, newInfo, loadTempIds, loadIds, flowTypes }  = await Checks.checkByLoadType({
                            loadType, timeInfo: oneOrder.timeInfo, info, obj, arr, order: alllegs[0]['type'].data, loadId: loads.id, flowType: loads.flowType
                        });
                        if (status) {
                            pointsArr.push({
                                date: newInfo.loads[id].eta,
                                id: oneOrder.id
                            });
                            delete alllegs[0]['type'].data.deliveryLon;
                            delete alllegs[0]['type'].data.deliveryLat;
                            delete alllegs[0]['type'].data.pickupLon;
                            delete alllegs[0]['type'].data.pickupLat;
                        }
                        totalDuration += loadType == 0 ? newInfo.loadTemps[id].waiting : newInfo.loads[id].waiting;
                        totalDuration += oneOrder.serviceTime;
                    }
                }
                
                if (warnings.length > 0) {
                    for (const elem of warnings) {
                        if (alllegs[0]['type'].data.id == elem.orderId ) {
                            warning = 1;
                            alllegs[0]['type'].warningStatus = elem.status;
                            warningsArr[alllegs[0]['type'].data.id] = elem.status.name;
                        } else {
                            alllegs[0]['type'].warningStatus = null;
                        }
                    }
                } else {
                    alllegs[0]['type'].warningStatus = null;
                }
                newAllLegs.push(alllegs[0]);
            } else if(alllegs.length > 1) {
                totalDuration = 0;
                for (const [i, leg] of alllegs.entries()) {
                    totalDuration += (alllegs[i]['duration']*1);

                    alllegs[i]['type'] = orderType[i];
                    
                    if (!alllegs[i]['type'].data.timeInfo) {
                        arr.push({
                            status: 0,
                            msg: "timeInfo null",
                            id: alllegs[i]['type'].data.id
                        });
                        alllegs[i]['type'].data.timeInfo = {};
                    }
                    if (totalDuration >= brTime && (totalDuration - fullDur) >= brTime) {
                        if (k2 > 0 && (totalDuration - fullDur) < shiftVal && alllegs[i+1] && ((totalDuration - fullDur) + (alllegs[i+1].duration) > shiftVal)) {
                            fullDur += ((totalDuration - fullDur) + recharge);
                            totalDuration = 0;
                            sleepTime += recharge;
                        } else if (k2 > 0 && (totalDuration - fullDur) > shiftVal) {                            
                            sleepTime += (Math.floor(totalDuration / shiftVal) * recharge);
                            fullDur += ((totalDuration - fullDur) + recharge);
                            totalDuration = 0;
                        }else if (k2 == 0 && ((totalDuration - fullDur) >= brTime) && (totalDuration - fullDur) < shiftVal) {
                           totalDuration += rest;
                        } else if (k2 == 0 && (totalDuration - fullDur) > shiftVal) {
                            totalDuration += rest;
                            totalDuration += recharge;
                            fullDur += (totalDuration - fullDur);
                        }
                        k2++;
                        if (totalDuration == 0) {
                            k2 = 0;
                        }
                    }
                    if (totalDuration == 0) {
                        totalDuration = fullDur;
                    }
                    if (alllegs[i]['type'].orders.length == 1) {
                        tEta = (totalDuration*1000) + (startTime*1);
                        let from1 = await Helper.getMilisecond(`${alllegs[i]['type'].data.date} ${alllegs[i]['type'].data.from}`);
                        let to1 = await Helper.getMilisecond(`${alllegs[i]['type'].data.date} ${alllegs[i]['type'].data.to}`);
                        let { obj, arr } = await Checks.timeInfo({
                            flowType: params.flowType,
                            allleg: {
                                ...alllegs[i]['type'].data,
                                servicetime: alllegs[i]['type'].data.serviceTime,
                                deliverydateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                deliverydateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                pickupdateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                pickupdateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),    
                            },
                            tEta,
                            loadId: id,
                            duration: totalDuration*1000,
                            shiftVal,
                            recharge
                        });
                        // Check by LoadType
                        // let timeInfo = await Order.findOne({ where: { id: order }});
                        let {status, newInfo, loadTempIds, loadIds, flowTypes } = await Checks.checkByLoadType({
                            loadType,
                            timeInfo: alllegs[i]['type'].data.timeInfo,
                            info,
                            obj,
                            arr,
                            order: alllegs[i]['type'].data,
                            loadId: id,
                            flowType: params.flowType
                        });
                        if (status) {
                            pointsArr.push({
                                date: newInfo.loads[id].eta,
                                id: alllegs[i]['type'].data.id
                            });
                            delete alllegs[i]['type'].data.deliveryLon;
                            delete alllegs[i]['type'].data.deliveryLat;
                            delete alllegs[i]['type'].data.pickupLon;
                            delete alllegs[i]['type'].data.pickupLat;
                        }
                        totalDuration += loadType == 0 ? newInfo.loadTemps[id].waiting : newInfo.loads[id].waiting;
                        totalDuration += alllegs[i]['type'].data.serviceTime;
                    } else if (alllegs[i]['type'].orders.length > 1) {
                        let orderIds = alllegs[i]['type'].orders;
                        for (const [o, order] of orderIds.entries()) {
                            
                            let oneOrder = points.filter(point => point.id == order);
                            tEta = (totalDuration*1000) + (startTime*1);
                            let from1 = await Helper.getMilisecond(`${oneOrder.date} ${oneOrder.from}`);
                            let to1 = await Helper.getMilisecond(`${oneOrder.date} ${oneOrder.to}`);
                            let { obj, arr } = await Checks.timeInfo({
                                flowType: data.loads.flowType,
                                allleg: {
                                    ...oneOrder,
                                    servicetime: oneOrder.serviceTime,
                                    deliverydateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                    deliverydateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                    pickupdateFrom: moment(from1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),
                                    pickupdateTo: moment(to1, 'x').format('YYYY-MM-DDTHH:mm:ss.SSS'),      
                                },
                                tEta,
                                loadId: data.loads.id,
                                duration: totalDuration*1000,
                                shiftVal,
                                recharge
                            });
                            // Check by LoadType
                            let {status, newInfo, loadTempIds, loadIds, flowTypes } = await Checks.checkByLoadType({
                                loadType, timeInfo: oneOrder.timeInfo, info, obj, arr, order: alllegs[i]['type'].data, loadId: id, flowType: params.flowType
                            });
                            if (o == 0) {
                                if (status) {
                                    pointsArr.push({
                                        date: newInfo.loads[id].eta,
                                        id: oneOrder.id
                                    });
                                    delete alllegs[i]['type'].data.deliveryLon;
                                    delete alllegs[i]['type'].data.deliveryLat;
                                    delete alllegs[i]['type'].data.pickupLon;
                                    delete alllegs[i]['type'].data.pickupLat;
                                }
                            }
                            totalDuration += loadType == 0 ? newInfo.loadTemps[id].waiting : newInfo.loads[id].waiting;
                            totalDuration += oneOrder.serviceTime;
                        }
                    }
                    if (warnings.length) {
                        warnings.forEach(elem => {
                            if (alllegs[i]['type'].data.id == elem.orderId ) {
                                warning = 1;
                                alllegs[i]['type'].warningStatus = elem.status;
                                warningsArr[alllegs[i]['type'].data.id] = elem.status.name;
                            } else {
                                alllegs[i]['type'].warningStatus = null;
                            }
                        });
                    } else {
                        alllegs[i]['type'].warningStatus = null;
                    }
                    newAllLegs.push(alllegs[i]);
                }
                for (const leg of alllegs) {
                    if (leg.type.data.statusId == null) {
                        leg.type.data.statusId = 0;
                    }
                }
            }

            return pointsArr;

        } catch (error) {
            console.log(error.message);
            return await Helper.errorMsg(error.message);
        }
    }


};
