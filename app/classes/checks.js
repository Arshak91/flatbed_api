
class Checks  {

    static async waitingTime(data) {

        let { orders, distDur, flowType, startTime } = data;
        let { legs } = distDur;
        let newOrders = [], waitingTime;
        let totalWaiting = 0;
        if (flowType == 1) {
            newOrders.push({
                order: orders[0],
                servicetime: orders[0].servicetime
            });
            for (const [o, order] of orders.entries()) {
                if (o > 0 && orders[o].pickupLat != orders[o - 1].pickupLat && orders[o].pickupLon != orders[o - 1].pickupLon) {
                    newOrders.push({
                        order: orders[o],
                        servicetime: orders[o].servicetime
                    });
                } else if (o > 0 && orders[o].pickupLat == orders[o - 1].pickupLat && orders[o].pickupLon == orders[o - 1].pickupLon) {
                    newOrders[o-1].servicetime += newOrders[o].servicetime;
                }
            }
        } else if (flowType == 2) {
            newOrders.push({
                order: orders[0],
                servicetime: orders[0].servicetime
            });
            for (const [o, order] of orders.entries()) {
                if (o > 0 && orders[o].deliveryLat != orders[o - 1].deliveryLat && orders[o].deliveryLon != orders[o - 1].deliveryLon) {
                    newOrders.push({
                        order: orders[o],
                        servicetime: orders[o].servicetime
                    });
                } else if (o > 0 && orders[o].deliveryLat == orders[o - 1].deliveryLat && orders[o].deliveryLon == orders[o - 1].deliveryLon) {
                    newOrders[newOrders.length-1].servicetime += orders[o].servicetime;
                }
            }
        }
        const Helper = require('../classes/helpers');   // this must be changes as inherit class 
        for (const [o, order] of newOrders.entries()) {
           
                let obj =  { distDur, o, order, startTime, flowType };
                waitingTime = await Helper.checkWindow(obj);
                       
            totalWaiting += waitingTime;
            // console.log(legs[o]);
            startTime += ((legs[o].duration + waitingTime + order.servicetime) * 1000);
            // startTime += (order.servicetime * 1000);
            console.log('waitingTime', order.id, waitingTime);
            
        }

        return totalWaiting;
    }
    static async timeInfo(datas) {
        let timeInfo = {
            id: 0,
            waiting: 0,
            arTime: 0,
            leaveTime: 0,
            eta: 0,
            ata: 0
        }, obj = {}, arr = [];
        let { flowType, allleg, tEta, loadId, duration, shiftVal, recharge } = datas;
        
        let waiting = 0, arTime = 0, leaveTime = 0, servicetime, ata = 0, wait = 0;
        if (flowType == 2) {
            servicetime = allleg.servicetime ? allleg.servicetime : 0;
            if (tEta < new Date(allleg.deliverydateFrom).getTime()) {
                waiting = new Date(allleg.deliverydateFrom).getTime() - tEta;
                if (duration + waiting >= (shiftVal*1000)) {
                    wait = ((shiftVal * 1000) - duration) + (recharge * 1000);
                } else {
                    wait = waiting;
                }
                arTime = tEta + wait;
                leaveTime = tEta + wait + (allleg.servicetime*1000);
                ata = allleg.timeInfo && allleg.timeInfo.loads && allleg.timeInfo.loads[loadId] && allleg.timeInfo.loads[loadId].ata ? allleg.timeInfo.loads[loadId].ata : null;
            } else if (tEta >= new Date(allleg.deliverydateFrom).getTime()) {
                waiting = 0;
                arTime = tEta;
                leaveTime = tEta + (servicetime*1000);
                ata = allleg.timeInfo && allleg.timeInfo.loads && allleg.timeInfo.loads[loadId] && allleg.timeInfo.loads[loadId].ata ? allleg.timeInfo.loads[loadId].ata : null;
            }
        } else if (flowType == 1) {
            servicetime = allleg.servicetime ? allleg.servicetime : 0;
            if (tEta < new Date(allleg.pickupdateFrom).getTime()) {
                waiting = new Date(allleg.pickupdateFrom).getTime() - tEta;
                if (duration + waiting >= (shiftVal*1000)) {
                    wait = ((shiftVal * 1000) - duration) + (recharge * 1000);
                } else {
                    wait = waiting;
                }
                arTime = tEta + wait;
                leaveTime = tEta + wait + (allleg.servicetime*1000);
                ata = allleg.timeInfo && allleg.timeInfo.loads && allleg.timeInfo.loads[loadId] && allleg.timeInfo.loads[loadId].ata ? allleg.timeInfo.loads[loadId].ata : null;
            } else if (tEta >= new Date(allleg.pickupdateFrom).getTime()) {
                waiting = 0;
                arTime = tEta;
                leaveTime = tEta + (servicetime*1000);
                ata = allleg.timeInfo && allleg.timeInfo.loads && allleg.timeInfo.loads[loadId] && allleg.timeInfo.loads[loadId].ata ? allleg.timeInfo.loads[loadId].ata : null;
            }
        }
        timeInfo.waiting = wait/1000;
        timeInfo.arTime = new Date(arTime);
        timeInfo.leaveTime = new Date(leaveTime);
        timeInfo.eta = new Date(tEta);
        timeInfo.id = loadId;
        timeInfo.ata = ata;
        obj[loadId] = timeInfo;
        arr.push({
            ...timeInfo
        });
        return { arr, obj };
    }
    static async checkByLoadType(data) {
        try {
            let  { loadType, timeInfo, info, obj, arr, order, loadId, flowType } = data;
            let loadIds, loadTempIds, flowTypes;
            loadTempIds = order.loadTempIds ? order.loadTempIds : [];
            loadIds = order.loadIds ? order.loadIds : [];
            flowTypes = order.flowTypes ? order.flowTypes : [];

            if (loadType == 0) {
                if (!loadTempIds.includes(loadId)) {
                    loadTempIds.push(loadId);
                }
                if (timeInfo) {
                    info.loadTemps = timeInfo.loadTemps ? {
                        ...timeInfo.loadTemps,
                        ...obj
                    } : { ...obj };
                } else {
                    info.loadTemps = {
                        ...obj
                    };
                }
            } else {
                if (!loadIds.includes(loadId)) {
                    loadIds.push(loadId);
                }
                if (!flowTypes.includes(flowType)) {
                    flowTypes.push(flowType);
                }
                if (timeInfo && Object.keys(timeInfo).length) {
                    info.loadTemps = timeInfo.loadTemps;
                    info.loads = timeInfo.loads ? {
                        ...timeInfo.loads,
                        ...obj
                    } : { ...obj };
                    info.loadsArr = timeInfo.loadsArr.length > 0 ? timeInfo.loadsArr : [];
                    if (info.loadsArr.length > 0) {
                        for (const [l, load] of info.loadsArr.entries()) {
                            if (load.id == arr[0].id) {
                                info.loadsArr[l] = arr[0];
                                // info.loadsArr = info.loadsArr.concat(arr);
                            }
                        }
                    } else {
                        info.loadsArr = info.loadsArr.concat(arr);
                    }
                    
                } else {
                    info.loadTemps = timeInfo.loadTemps;
                    info.loads = {
                        ...obj
                    };
                    info.loadsArr = info.loadsArr.concat(arr);
                }
            }
            return {status: 1, newInfo: info, loadTempIds, loadIds, flowTypes};
        } catch (error) {
            return {
                status: 0,
                msg: "bug in loadType"
            };
        }
    }
    static async checkSameLocOrders(data) {
        try {
            let { orders, flowType } = data;
            let newOrders = [];
            if (flowType == 1) {
                newOrders.push({
                    order: orders[0],
                    servicetime: orders[0].servicetime
                });
                for (const [o, order] of orders.entries()) {
                    if (o > 0 && order.pickupLat != orders[o - 1].pickupLat && order.pickupLon != orders[o - 1].pickupLon) {
                        newOrders.push({
                            order: order,
                            servicetime: order.servicetime
                        });
                    } else if (o > 0 && order.pickupLat == orders[o - 1].pickupLat && order.pickupLon == orders[o - 1].pickupLon) {
                        newOrders[newOrders.length-1].servicetime += order.servicetime;
                    }
                }
            } else if (flowType == 2) {
                newOrders.push({
                    order: orders[0],
                    servicetime: orders[0].servicetime
                });
                for (const [o, order] of orders.entries()) {
                    if (o > 0 && order.deliveryLat != orders[o - 1].deliveryLat && order.deliveryLon != orders[o - 1].deliveryLon) {
                        newOrders.push({
                            order: order,
                            servicetime: order.servicetime
                        });
                    } else if (o > 0 && order.deliveryLat == orders[o - 1].deliveryLat && order.deliveryLon == orders[o - 1].deliveryLon) {
                        newOrders[newOrders.length-1].servicetime += order.servicetime;
                    }
                }
            }
            return {
                status: 1,
                newOrders
            };
        } catch (error) {
            return await Helper.errorMsg(error.message);
        }
    }
    // STOP
    static async waitingTime2(data) {

        let { newOrders, distDur, flowType, startTime, l } = data;
        let { legs } = distDur;
        let waitingTime;
        let totalWaiting = 0;
        const Helper = require('../classes/helpers');   // this must be changes as inherit class 
        let obj =  { distDur, o: l, order: newOrders, startTime, flowType };
        waitingTime = await Helper.checkWindow(obj);
                    
        totalWaiting += waitingTime;

        return totalWaiting;
    }
}
module.exports = Checks;