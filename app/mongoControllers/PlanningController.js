const Planning = require('../mongoModels/PlanningModel');

const LoadBoard = require('../mongoModels/LoadBoardModel');
const CapacityBoard = require('../mongoModels/CapacityBoardModel');

const Helpers = require('../classes/helpers');

// const db = require('../config/db.config.js');
// const Job = db.job;

const Job = require('../mongoModels/JobModel');
const PlanningModel = require('../mongoModels/PlanningModel');
const User = require('../mongoModels/UserModel');
const Calculation = require('../classes/flatbedCalc');
const moment = require('moment');


function getFilterObject(query, userId){
    const filter = {
        'owner.id': userId
    }

    // match date
    if(query.matchDate){
        const matchDate = Helpers.getFlatbedDatesFromEndFormatted(query.matchDate);
        filter['autoPlanDate'] = { 
            $gte: matchDate.from,
            $lt: matchDate.to
        };
    }

    // start time
    if(query.startTime){
        const startTime = Helpers.getFlatbedDatesFromEndFormatted(query.startTime);
        filter['startTime'] = {
            $gte: startTime.from
        };
    }

    // end time
    if(query.endTime){
        const endTime = Helpers.getFlatbedDatesFromEndFormatted(query.endTime);
        filter['endTime'] = {
            $lt: endTime.to
        };
    }

    // // orders count
    // if(query.orders){
    //     filter['orders'] = orders
    // }

    // size - weight
    if(query.sizeType){
        if(query.sizeMin && !query.sizeMax){
            filter[query.sizeType] = { $gte: Number(query.sizeMin) }
        }
        else if(!query.sizeMin && query.sizeMax){
            filter[query.sizeType] = { $lte: Number(query.sizeMax) }
        }
        else if(query.sizeMin && query.sizeMax){
            filter[query.sizeType] = { $gte: Number(query.sizeMin), $lte: Number(query.sizeMax) }
        }
    }

    // mile
    if(query.mileMin && !query.mileMax){
        filter['totalDistance'] = { $gte: query.mileMin*1609 };
    }else if(!query.mileMin && query.mileMax){
        filter['totalDistance'] = { $lte: query.mileMax*1609 };
    }else if(query.mileMin && query.mileMax){
        filter['totalDistance'] = { $gte: query.mileMin*1609, $lte: query.mileMax*1609 };
    }
    
    // duration
    if(query.durationMin && !query.durationMax){
        filter['totalDuration'] = { $gte: Number(query.durationMin) }
    }else if(!query.durationMin && query.durationMax){
        filter['totalDuration'] = { $lte: Number(query.durationMax) }
    }else if(query.durationMin && query.durationMax){
        filter['totalDuration'] = { $gte: Number(query.durationMin), $lte: Number(query.durationMax) }
    }

    return filter
}

function getSortObject(query){
    let orderBy = query.orderBy ? query.orderBy : '_id';
    const order = query.order && query.order == 'asc' ? 1 : -1;

    if(orderBy == 'id'){
        orderBy = '_id'
    }

    const sort = {}
    sort[orderBy] = order
    return sort
}

exports.getAll = async (req, res) => {
    try {
        if(!req.user || !req.user.id){
            return res.json({
                status: 1,
                msg: 'ok',
                data: {
                    loads: [], // plannings,
                    total: 0
                }
            });
        }

        let page = req.query.page ? Math.max(0, req.query.page*1) : Math.max(0, 1);
        let perPage = req.query.limit ? req.query.limit*1 : 10;


        // const filter = {
        //     'owner.id': req.user.id
        // }
        // console.log('- query: ', req.query)
        const filter = getFilterObject(req.query, req.user.id)
        // console.log('- filter match: ', filter)

        const sort = getSortObject(req.query); // [['_id', -1]]
        // console.log('\n', ' - sort match:', sort)
        
        Planning.find(filter).sort(sort).limit(perPage).skip(perPage * (page - 1))
            .then(async (plannings) => {
                let ct = await Planning.countDocuments(filter);

                // plannings.forEach(p=>{
                //     p.ordersDatas = []
                //     p.orders = []      
                //     console.log(p)
                // })

                const planns = []
                for(let i = 0; i < ct; i++){
                    if(plannings[i]){
                        plannings[i]['ordersDatas'] = []
                        planns.push(plannings[i])
                    }
                    // console.log(plannings[i])
                }

                //console.log(ct);
                res.json({
                    status: 1,
                    msg: 'ok',
                    data: {
                        loads: planns, // plannings,
                        total: ct
                    }
                });
            });
    } catch (error) {
        console.log(error)
        res.json({error});
    }
};

exports.getOne = async (req, res) => {
    let { id } = req.params, planning;
    planning = await PlanningModel.findById(id);
    if (planning) {
        res.json({
            status: 1,
            msg: "ok",
            data: planning
        });
    } else {
        res.json({
            status: 0,
            msg: "Planning doesn't exist",
            data: []
        });
    }
};


exports.delete = async (req, res) => {

    try{
        let { loadIds } = req.body;
        // console.log(' -- loadIds', loadIds);
        let filter = {
            'owner.id': req.user.id
        }, plannings;
        if (loadIds && loadIds.length > 0) {
            filter['_id'] = {$in : loadIds};
        }
        
        plannings = await Planning.deleteMany(filter).catch(err => {
            console.log('Error: ', err.Message);
        });
        res.send({
            status: 1,
            msg: 'Planning(s) deleted!',
            data: plannings.deletedCount
        });
    }catch(ex){
        console.log(ex);
        res.send({
            status: 0,
            msg: 'error',
            data: ex
        });
    }
};




// exports.creatTempLoads = async (req, res) => {
//     try {
//         console.log(req.body);
        
//         let uuid = req.body[0].UUID,
//         status = [],
//         eta = [],
//         percentage = [],
//         loadOrderIds = [],
//         drivingminutes = [],
//         totalRunTime = [],
//         totalDistance = [],
//         totalDuration = [],
//         Infeasible = [],
//         loads = [],
//         InfeasibleCount = 0,
//         loadsCount = 0,
//         flag = false,
//         jobUpdate;
        
//         for (const load of req.body) {
//             if (load.Status == 3) {
//                 flag = true;
//                 let { data } = await Algopost.createLoadTemp(load);
//                 status.push(data.status);
//                 eta.push(data.eta);
//                 percentage.push(data.percentage);
//                 loadOrderIds.push(data.loadOrderIds);
//                 drivingminutes.push(data.drivingminutes);
//                 totalRunTime.push(data.totalRunTime);
//                 totalDistance.push(data.totalDistance);
//                 totalDuration.push(data.totalDuration);
//                 Infeasible = Infeasible.concat(data.Infeasible);
//                 loads = loads.concat(data.loads);
//                 InfeasibleCount += data.Infeasible.length;
//                 loadsCount += data.loads.length;
//             } else {
//                 status.push(load.Status);
//                 eta.push(load.ETA);
//                 percentage.push(load.percentage);
//                 InfeasibleCount += load.InfeasibleCount;
//                 Infeasible = Infeasible.concat(load.Infeasibles);
//             }
            
//         }
//         if (flag) {
//             jobUpdate = await Job.update({
//                 status,
//                 eta,
//                 percentage,
//                 loadOrderIds,
//                 drivingminutes,
//                 totalRunTime,
//                 totalDistance,
//                 totalDuration,
//                 Infeasible,
//                 InfeasibleCount,
//                 loads,
//                 loadsCount
//             }, {
//                 where: {
//                     UUID: uuid
//                 }
//             });
//         } else {
//             jobUpdate = await Job.update({
//                 totalRunTime: [0],
//                 status,
//                 eta,
//                 percentage,
//                 Infeasible,
//                 InfeasibleCount
//             }, {
//                 where: {
//                     UUID: uuid
//                 }
//             });
//         }
        
//         res.json({
//             status: true,
//             msg: 'ok',
//             data: jobUpdate
//         });
        
        
//     } catch (error) {
//         res.status(500).json({
//             msg: 'Error!!!',
//             error
//         });
//     }
// };

exports.createPlannings = async (req, res) => {


    // console.log(' ----- type:', req.query.type)

    console.log(' - /autoplan/flatbed\n', req.body)

    if(!Array.isArray(req.body)){
        console.log(' -- body is not array');
        return res.json({
            status: 0,
            msg: 'Incorrect body type',
        });
    }

    let owner = undefined;
    console.log('--', req.query.userId);
    let returnees = JSON.parse(req.body[0].Returnees), noHos;
    if (returnees.noHos) {
        noHos = returnees.noHos;
    } else {
        noHos = returnees.noHos;
    }
    if(req.query.userId){
        let user = await User.findById(req.query.userId);
        if(user){
            owner = { 
                name: user.username,
                id: user.id,
                type: user.type
            };
        }else{
            owner = {
                id: req.query.userId
            };
        }
    }

    // const user = req.user || { 
    //     name: 'Brocker',
    //     id: 1,
    //     type: 1, // 1 - Brocker/Shipper, 2 - Carrier 
    // }

    let uuid = undefined;
    let doneCount = 0;
    // let foreachCount = 0
    for (let i = 0; i < req.body.length; i++) {
        if(!req.body[i].Loads){
            // console.log(' -- body -- ', req.body[i])
            
            // exception
            if(req.body[i].Exception){
                // console.log('--- exception: ', req.body[i].Exception)
                await Job.updateOne({ UUID: req.body[i].UUID }, { 
                    status: 2, 
                    errorMessage: req.body[i].Exception.Message, 
                    updatedDate: Date.now() 
                });
            }
            
            continue;
        }
        
        uuid = req.body[i].UUID;
        // console.log('\n --- inst ----- ', req.body[i])
        // console.log('\n --- B uuid ----- ', req.body[i].UUID, i)
        for(let j = 0; j < req.body[i].Loads.length; j++){
            const data = req.body[i].Loads[j];
        
            // foreachCount++
            // console.log('\n --- L uuid ----- ', data.UUID, j, data.OrderSIDs)

            // console.log('\n --- load --- ', data, '\n')

            // console.log(' - geoline --', data.GeoLine)

            // console.log('\n - coords ', data.GeoLine.coordinates)

            if(!data.OrderSIDs || !Array.isArray(data.OrderSIDs) || data.OrderSIDs.length < 2){
                // console.log('-- continue')
                continue;
            }

            // check right loads
            let capCnt = 0;
            let incorrectEquipment = false;
            data.OrderSIDs.forEach(oSId => {
                if(oSId.indexOf('cap__') != -1){
                    capCnt++;

                    if(oSId.replace('cap__', '') != data.Equipment.Id){
                        incorrectEquipment = true;
                    }
                }
            });
            if(capCnt != 1 || incorrectEquipment){
                // console.log('-- capCnt')
                continue;
            }

            // console.log('\n --- load --- ', data, '\n')

            // get loads, cap _ids , get start and end datetimes
            // let startId = data.OrderSIDs[0]
            // let endId = data.OrderSIDs[data.OrderSIDs.length-1]
            
            let dataIds = [], loadIds = [], capIds = [];
            data.OrderSIDs.forEach(o => {
                let id = o.replace('load__', '');
                if(id.indexOf('cap__') != -1){
                    id = id.replace('cap__', '');
                    capIds.push(id);
                }else{
                    loadIds.push(id);
                }
                dataIds.push(id);
                // dataIds.push(o.replace('cap__', '').replace('load__', ''))
            });
            // const dataIds = data.OrderSIDs ? data.OrderSIDs.join(',') : undefined

            // console.log(' - lIds ', loadIds)
            // console.log(' - cIds ', capIds)
            // console.log(' - dIds ', dataIds)

            const loadBoards = loadIds.length > 0 ? await LoadBoard.find({ _id: { $in: loadIds } }) : [];
            const capacityBoard = capIds.length > 0 ? await CapacityBoard.find({ _id: { $in: capIds } }) : [];

            // console.log(' - loadboard', loadBoards)
            // console.log(' - capacityboard', capacityBoard)
            let size = 0, weight = 0;
            let startAt = undefined, endAt = undefined;
            loadBoards.forEach(lb => {
                size += lb.order.size ? lb.order.size : 0;
                weight += lb.order.weight ? lb.order.weight : 0;

                if(dataIds[0] == lb._id){
                    startAt = lb.order.start.timeWindowFrom;
                }
                if(dataIds[dataIds.length - 1] == lb._id){
                    endAt = lb.order.end.timeWindowTo;
                }
            });
            capacityBoard.forEach(cb => {
                // size += cb.order.size ? cb.order.size : 0
                // weight += cb.order.weight ? cb.order.weight : 0

                if(dataIds[0] == cb._id){
                    startAt = cb.order.start.timeWindowFrom;
                }
                if(dataIds[dataIds.length - 1] == cb._id){
                    endAt = cb.order.end.timeWindowTo;
                }
            });
            let arr = dataIds;
            dataIds = dataIds.join(',');
            
            // for test
            // console.log('\n --- load --- ', data, '\n')

            // 
            let autoPlanDate;
            try{
                autoPlanDate = req.body[i].AutoPlanDate ? moment(req.body[i].AutoPlanDate, "YYYY-MM-DDTHH:mm:ss.SSS").format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z' : moment.utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
            }catch(ex){
                console.log('error autoPlanDate: ', ex);
            }
            if(!autoPlanDate || autoPlanDate.getFullYear < 2000){
                autoPlanDate = new Date();
            }

            // create model
            let stops;
            stops = await Helpers.groupStops(data);
            let calcClass = new Calculation({data: {stopLocations: stops.stopLocations, noHos}});
            let { totalDur, distDur }= await calcClass.calculation();
            let planningData;
            planningData = {
                autoPlanDate: autoPlanDate, // req.body[i].AutoPlanDate,

                owner: owner,

                UUID: req.body[i].UUID,

                equipment: data.Equipment,

                // carrier: {}, // Carrier,
                // shiftId: 60, // ete 2 hogi 120, ete 1 urisha   // 

                orderIDs: data.OrderIDs,
                ordersCount: data.OrderSIDs.length, 
                orders: dataIds, // data.OrderSIDs,

                stops: data.GeoLine.coordinates, // [{}], // stopLocations: String, // { type: Sequelize.JSON },

                // startTime: moment(startAt).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z', // data.InitStartTime, 
                // endTime: moment(endAt).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z', // new Date(),

                startTime: moment.utc(startAt).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z',
                endTime: moment.utc(endAt).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z',

                feet: size, // data.TotalWeight, // 20,
                weight: weight, // data.TotalWeight,

                totalDistance: distDur.distance,
                totalDuration: totalDur/60,

                status: 1, 

                // loadCost: Number,
                // loadCostPerMile: Number,

                // comment: "",
                
                // feelRates: 0,
                // permileRates: 0,
                // permileRatesTotal: 0,

                planType: 'Auto', // { type: Sequelize.ENUM, values: ['Manual', 'Auto'] },

                changed: [{}],

                delete: 0,

                Load: data,
                stopLocations: stops.stopLocations,
                orderIdsArr: stops.ids,
                noHos
            };
            

            // console.log(' -- planningData ', planningData)
            // const planning = new Planning(planningData);
            await PlanningModel.create(planningData);
            //console.log(' -- planning 0 ', planning)
            //break;
            // console.log(' -- planning: ', planning)
            // await planning.save()
            //console.log(' -- planning 1 ', planning)

            doneCount++;
        }
    }

    // update job status
    if(uuid){
        // console.log(' - foreachCount: ', foreachCount, uuid)
        // await Job.update({
        //     status: 4,
        //     loadsCount: doneCount
        // }, {
        //     where: {
        //         UUID: uuid
        //     }
        // })
        await Job.updateOne({ UUID: uuid }, {
            status: 4,
            loadsCount: doneCount,
            errorMessage: `Matched count: ${doneCount}`,
            updatedDate: Date.now()
        });
    }

    console.log(' -- end');
    return res.json({
        status: 1,
        msg: 'ok',
        // data: planning
    });
};