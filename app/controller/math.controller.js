const uuidv1 = require('uuid/v1');
const axios = require('axios');
const moment = require('moment');
const generate = require('project-name-generator');
const dateFormat = require('dateformat');
const db = require('../config/db.config.js');
const env = process.env.SERVER == 'local' ? require('../config/env.local') : require('../config/env');
const Helper = require('../classes/helpers');

// const Op = db.Sequelize.Op;

// const Shift = db.shift;

const Shift = require('../mongoModels/ShiftModel');


// const Job = db.job;
// const Drivers = db.driver;
// const Settings = db.settings;

const Job = require('../mongoModels/JobModel')


const shiftattributes = ["shift", "break_time", "max_shift","rest", "recharge","drivingtime"];
// const request = require('request');

const Planning = require('../mongoModels/PlanningModel');

const CapacityBoard = require('../mongoModels/CapacityBoardModel');
const LoadBoard = require('../mongoModels/LoadBoardModel');


exports.mathReport = async (req, res) =>{
    
    let resp;
    if(!req.params){
        res.status(400).send({msg:"No Parameters"});
    }
    
    let action = req.params.action;
    let pid = req.params.pid;
    console.log(req.params);
    // let uuid = await Job.findOne({where: {id:pid } } );
    let uuid = await Job.findById(pid);
    console.log(uuid.UUID);
    if(!uuid.UUID){
        res.status(500).send({
            msg:'Fail',
            "Error": ` No found Plan with this id\` ID:${pid} `
        });
        return;
    }
    const url  = `${env.engineHost}:${env.enginePort}/${action}?execid=${uuid.UUID}`;
    // console.log(url);
    
    if(action == "log"){
        resp = await axios.get(url, {
            headers: {
                'x-ads-key': '28DF6A13265BA58C9B400819E7104943'
            }
        }).catch(err  => {
            
            res.status(500).send({
                msg:'Fail',
                "Error": err
            });
            
        }); 
        if(resp){
           
            res.status(200).send({
                msg:'OK',
                "Log": resp.data
            }); 

        }


    } else if(action == "status"){
        // const testUrl = "http://ads.lessplatform.com/status";
        resp = await axios.post(url, {
            headers: {
                'x-ads-key': '28DF6A13265BA58C9B400819E7104943'
            }
        }).catch(err => {
            res.status(err.response.status).send({
                msg:'Fail',
                "Error": err
            });
         });  
         // 0: Started
         // 1: Running
         // 2: Failed
         // 3: Finished

         if(resp){
            
            let arr = [];
            let eta = 0;
            let etas = [];
            let finalstatus;
            resp.data.forEach(element => {
                console.log("Algo Response -> Status:", element.ThreadOutcome.Status, "ETA: ", element.ThreadOutcome.ETA, "Job ID: ", pid);
                let status = element.ThreadOutcome.Status;
                let ETA = element.ThreadOutcome.ETA;
                    arr.push(status);
                    etas.push(ETA);                
            });
            
            if (arr.includes(0)) {
                    finalstatus = 'Started';
                    eta = Math.max(...etas);
            } else if (arr.includes(1) ) {
                    finalstatus = 'Running';
                    eta = Math.max(...etas);
            } else if ( arr.includes(2) ) {
                    finalstatus = 'Failed';
                    eta = Math.max(...etas);
            } else {
                    finalstatus = 'Finished';
                    eta = Math.max(...etas);
            }
            console.log("Final -> Status:", finalstatus, "ETA: ", Math.max(...etas), "Job ID: ", pid);
            res.status(200).send({
                msg:'OK',
                "Status": finalstatus,
                "ETA": eta
            });

        }


    }




} ;



// ---------------------- //
// F L A T B E D
// ---------------------- //


exports.executeLoadBoards = async (req, res) => {
    // match loads with anywhere delivery capacities
    if(req.body.autoPlanType == 'byPickupDate'){
        return await matchLoadsWithAnywhereDeliveryCapacities(req, res);
    }

    // algo
    const remoteInfo = await getRemoteInfoFlatbed(req);

    let ordersUrl = "/loadboards/engine/orders?";

    if(req.body && req.body.selectedOrdersIds && req.body.selectedOrdersIds.length>0){
        if(req.body.selectedOrdersIds.length<=3){
            return statusFalse(res, 'Please select min 3 loads.')
        }
        const loadIds = req.body.selectedOrdersIds.join(',')
        ordersUrl = `/loadboards/engine/orders/${loadIds}?`;
    }

    executeFlatbed(req, res, remoteInfo, ordersUrl);
}

exports.executeCapacityBoards = async (req, res) => {
    // match capacities with anywhere delivery 
    if(req.body.autoPlanType == 'byPickupDate'){
        return await matchCapsWithAnywhereDelivery(req, res)
    }

    // match algo
    const remoteInfo = await getRemoteInfoFlatbed(req);

    let ordersUrl = "/capacityboards/engine/orders?";

    if(req.body && req.body.selectedOrdersIds && req.body.selectedOrdersIds.length>0){
        if(req.body.selectedOrdersIds.length<=3){
            return statusFalse(res, 'Please select min 3 capacities.')
        }
        const capIds = req.body.selectedOrdersIds.join(',')
        ordersUrl = `/capacityboards/engine/orders/${capIds}?`;
    }

    executeFlatbed(req, res, remoteInfo, ordersUrl);
}

// for loads to match with anywhere delivery caps
async function matchLoadsWithAnywhereDeliveryCapacities(req, res){
    // get dates
    // const date = Helper.getFlatbedDatesFromEndFormatted(moment(req.body.date)._i)
    const dateRange = req.query.dateRange;
    let timezone = req.body.timezone;
    const date = Helper.getFlatbedDatesFromEndFormatted(moment(req.body.date)._i, timezone, dateRange);

    // filter for caps
    const filterCaps = req.body.selectedCapacitiesIds && req.body.selectedCapacitiesIds.length > 0 ? {} : {
        "order.start.timeWindowFrom": { 
            $gte: date.from,
            $lt: date.to
        },
        "order.end": null,
        "publishedBy.userId": req.user.id
    };

    if(req.body.selectedCapacitiesIds && req.body.selectedCapacitiesIds.length > 0){
        filterCaps['_id'] = { $in : req.body.selectedCapacitiesIds };
        filterCaps["publishedBy.userId"] = req.user.id;
    }
    // filter for loads
    const filterLoads = {
        "order.start.timeWindowFrom": { 
            $gte: date.from,
            $lt: date.to
        }
    };
    if(req.body.selectedLoadsIds && req.body.selectedLoadsIds.length > 0){
        filterLoads['_id'] = { $in : req.body.selectedLoadsIds };
    }

    return await matchWithAnywhereDelivery(req, res, filterLoads, filterCaps)
}

// for cap with anywhere delivery
async function matchCapsWithAnywhereDelivery(req, res){
    // get dates
    // const date = Helper.getFlatbedDatesFromEndFormatted(moment(req.body.date)._i)
    const dateRange = req.query.dateRange;
    let timezone = req.query.timezone;
    const date = Helper.getFlatbedDatesFromEndFormatted(moment(req.body.date)._i, timezone, dateRange);

    // filter for caps
    const filterCaps = {
        "order.start.timeWindowFrom": { 
            $gte: date.from,
            $lt: date.to
        },
        "order.end": null,
        "publishedBy.userId": req.user.id
    }
    if(req.body.selectedOrdersIds && req.body.selectedOrdersIds.length > 0){
        filter['_id'] = { $in : req.body.selectedOrdersIds.split(',') }
    }

    // filter for loads
    const filterLoads = {
        "order.start.timeWindowFrom": { 
            $gte: date.from,
            $lt: date.to
        }
    }

    return await matchWithAnywhereDelivery(req, res, filterLoads, filterCaps)
}

// matching with anywhere delivery
async function matchWithAnywhereDelivery(req, res, filterLoads, filterCaps){
    // create job
    const job = await openJob(req)

    // get all caps with anywhere delivery by date
    // console.log('- cb filter: ', filterCaps)
    const capacityBoards = await CapacityBoard.find(filterCaps)
    // console.log('- cb: ', capacityBoards.length)

    // check capacityBoards
    if(capacityBoards && capacityBoards.length == 0){
        job.status = 5;
        await job.save()
        return res.json({ data: { doneStatus: job.status } });
    }

    // get all loads by date
    const loadBoards = await LoadBoard.find(filterLoads)

    // check loadBoards
    if(loadBoards && loadBoards.length == 0){
        job.status = 5;
        await job.save();
        return res.json({ data: { doneStatus: 5 } });
    }

    // group by start city, zip filtered by weight and size
    const matches = getMatchedDataWithAnywhereDelivery(capacityBoards, loadBoards, job.UUID, req.user);

    // save matches (plannings)
    let doneCount = await saveMatches(matches);

    // update job status
    job.status = 4;
    job.loadsCount = doneCount;
    await job.save();

    // res
    return res.json({
        status: 2,
        msg: `Match ${doneCount} matchies.`,
        data: {
            doneStatus: 'Done.',
            uuid: job.UUID, // uid,
            jobId: job._id
        }
    });
}

// open job
async function openJob(req){
    const uid = uuidv1();
    const params = {
        selectedOrdersIds: req.body.selectedOrdersIds
    }
    const jobName = `${generate().dashed}-${dateFormat(new Date(), "dd-mm-yyyy")}`;
    const job = await Job.create({
        name: jobName,
        UUID: uid,
        params: params,
    });
    return job
}

// get matched data from loadboards and capacityboards
function getMatchedDataWithAnywhereDelivery(capacityBoards, loadBoards, uid, user){
    let matches = [], stopLocations = [], obj1 = {}, obj2 = {};
    capacityBoards.forEach((cb, a) => {
        loadBoards.forEach(async (lb, b) => {
            stopLocations.push({
                lat: cb.order.start.lat,
                lon: cb.order.start.lon,
                orderId: [cb.id],
                orders: {},
                ordersMobile: [],
            });
            obj1 = cb;
            obj1._doc.action = 2;
            obj1._doc.IsCapacity = true;
            stopLocations[stopLocations.length-1].ordersMobile.push(obj1._doc);
            stopLocations[stopLocations.length-1].orders[cb.id] = {...obj1._doc};
            // check start city country
            if(lb.order.start.city == cb.order.start.city && lb.order.start.country == cb.order.start.country
                && lb.order.size <= cb.order.availableSize && lb.order.weight <= cb.order.availableWeight){
                let cbLat = cb.order.start.lat;
                let cbLon = cb.order.start.lon;
                if (lb.order.start.lat == cbLat && lb.order.start.lon == cbLon) {
                    obj1 = lb;
                    obj1._doc.action = 0;
                    obj1._doc.IsCapacity = false;
                    stopLocations[stopLocations.length-1].orderId.push(lb.id);
                    stopLocations[stopLocations.length-1].ordersMobile.push({...obj1._doc});
                    stopLocations[stopLocations.length-1].orders[lb.id] = {...obj1._doc};
                } else {
                    stopLocations.push({
                        lat: lb.order.start.lat,
                        lon: lb.order.start.lon,
                        orderId: [lb.id],
                        orders: {},
                        ordersMobile: [],
                    });
                    obj2 = lb;
                    obj2._doc.action = 0;
                    obj2._doc.IsCapacity = false;
                    stopLocations[stopLocations.length-1].ordersMobile.push({...obj2._doc});
                    stopLocations[stopLocations.length-1].orders[lb.id] = {...obj2._doc};
                }
                stopLocations.push({
                    lat: lb.order.end.lat,
                    lon: lb.order.end.lon,
                    orderId: [lb.id],
                    orders: {},
                    ordersMobile: [],
                });
                obj2 = lb;
                obj2._doc.action = 1;
                obj2._doc.IsCapacity = false;
                stopLocations[stopLocations.length-1].orders[lb.id] = {...obj2._doc};
                stopLocations[stopLocations.length-1].ordersMobile.push({...obj2._doc});
                let size = lb.order.size ? lb.order.size : 0;
                let weight = lb.order.weight ? lb.order.weight : 0;

                matches.push({
                    autoPlanDate: Date.now(),

                    owner: {
                        name: user.name,
                        id: user.id,
                        type: user.type,
                    },

                    UUID: uid,

                    equipment: {
                        id: cb._id.toString(),
                        code: cb.code,
                        feet : cb.order.availableSize + cb.order.usedSize,
                        weight : cb.order.availableWeight + cb.order.usedWeight,
                    },

                    // orderIDs: cb. data.orderIDs,
                    orders: `${cb._id},${lb._id}`, // data.OrderSIDs,
                    orderIdsArr: [cb._id, lb._id],
                    stops: [
                        // [ cb.order.start.lat, cb.order.start.lon ],
                        // [ lb.order.start.lat, lb.order.start.lon ],
                        // [ lb.order.end.lat, lb.order.end.lon ]

                        [ cb.order.start.lon, cb.order.start.lat ],
                        [ lb.order.start.lon, lb.order.start.lat ],
                        [ lb.order.end.lon, lb.order.end.lat ]
                    ],

                    startTime:  moment(cb.order.start.timeWindowFrom).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z',
                    endTime:  moment(lb.order.end.timeWindowTo).format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z',

                    feet: size, // data.TotalWeight, // 20,
                    weight: weight, // data.TotalWeight,

                    totalDistance: lb.order.distance ? lb.order.distance : 0,
                    totalDuration: lb.order.duration ? lb.order.duration : 0,

                    status: 1, 
                    stopLocations: stopLocations,
                    // loadCost: Number,
                    // loadCostPerMile: Number,

                    // comment: "",
                    
                    // feelRates: 0,
                    // permileRates: 0,
                    // permileRatesTotal: 0,

                    planType: 'Match By Pickup Date', // { type: Sequelize.ENUM, values: ['Manual', 'Auto'] },

                    changed: [{}],

                    delete: 0,

                    // Load: data
                });
            }
            stopLocations = [];
        });
    });
    return matches;
}

// save matches
async function saveMatches(matches){
    let doneCount = 0;
    for(let i = 0; i < matches.length; i++){
        try{
            const planning = new Planning(matches[i]);
            
            await planning.save();

            doneCount++;
        }catch(ex){
            console.log('- ex: ', ex);
        }
    }
    return doneCount;
}


//  /////////////////   //
//
//  A L G O R I T H M
//

// async function executeFlatbed(req, res, remoteInfo, ordersUrl){
const executeFlatbed = async (req, res, remoteInfo, ordersUrl) => {
    try {
        // get shift
        let shiftName;
        if (req.body.noHos) {
            shiftName = "Team";
        } else {
            shiftName = "Weekly";
        }
        const shift = await Shift.findOne({
            shiftName: shiftName
        });
        if (!shift) {
            return statusFalse(res, 'Shift does not exist');
        }

        // init datas
        // const { endPoint } =  remoteInfo;

        const uid = uuidv1();
        let date = moment(req.body.date)._i; // moment(req.body.date)._i;
        //let loadStartTime = new Date(req.body.loadStartTime); // date
        let maxCount = req.body.maxCount || 99999; //req.body.maxCount;
        let dateRange = {
            min: req.body.before,
            max: req.body.after
        };
        let maxStops = req.body.maxStop || 10; //req.body.maxStop;
        let timezone = req.body.timezone; //req.body.maxStop;
        // let timelimit = 100000; // req.body.timeLimit;
        // let selectedOrders = []; // req.body.selectedOrders;
        let flowType = 3; // req.body.flowType;
        // let dreturn = 0; // req.body.return;
        // let Return = 0;
        // let loadMinimize = 1; // req.body.loadMinimize;
        // let fixedDriverCalc = false; // req.body.fixedDriverCalc;
        let noHos = req.body.noHos;
        let mobile = req.body.mobile ? 1 : 0;
        
        // init equipment
        let equipment = await getEquipments(req.user, date, dateRange, timezone);

        // append shift inqo equipments  -  this is temp logic !!!!
        for(let i=0; i < equipment.length; i++){
            equipment[i].shift = shift;
        }
        console.log('----- eq: ', equipment.length);


        // init params
        const params = {
            flatBedCalc: true,
            singleRouteCalc: false,
            dryRun: false,
            seqMode: false,
            // loadMinimize: loadMinimize, // == 1 ? true : false,
            fixedDriverCalc: false, // fixedDriverCalc, // == 1 ? true : false,
            date: date,
            // loadStartTime: loadStartTime,
            depoId: 0, // depotId,
            flowType: 3, // flowType,
            maxStops: maxStops,
            timeLimit: 100000, // timelimit ,
            selectedOrders: [], //selectedOrders,
            selectedOrdersIds: req.body.selectedOrdersIds,
            priorityCalc: true,
            Return: 0, // Return,
            shiftId: 1, // shiftId,
            cubeCalc: true,
            deliveryCalc: flowType == 2 ? true: false,
            DPC: 0,
            noHos: noHos
        };

        let order = await Helper.getOrders({
            loadFilters: req.body.loadFilters,
            capacityFilters: req.body.capacityFilters,
            selectedLoadsIds: req.body.selectedLoadsIds,
            selectedCapacitiesIds: req.body.selectedCapacitiesIds,
            userId: req.user.id,
            limit: maxCount,
            date,
            dateRange,
            timezone,
            mobile,
            user: req.user
        });
        // init link
        const link = `${remoteInfo.host}${ordersUrl}date=${date}&maxCount=${maxCount}&userId=${req.user.id}&dateRange=${dateRange}&timezone=${timezone}`; //&maxStops=${maxStops}`;
        console.log('----- link: ', link);

        // init obj
        const obj = {
            "execid": uid,
            "PostServer": remoteInfo.endPoint,
            "params": params,
            "shift": shift,
            "equipment": equipment,
            // "link": link,
            "Orders": order,
            "MapServer": `${env.mapHost}${env.mapPort}/table/v1/driving/`,
            "Returnees": JSON.stringify({
                noHos
            })
        };
        //const name = generate().dashed;
        //const now = new Date();
        //const jobDate = dateFormat(now, "dd-mm-yyyy");
        //const jobName = `${name}-${jobDate}`;

        // create job
        const job = await Job.create({
            name: `${generate().dashed}-${dateFormat(new Date(), "dd-mm-yyyy")}`, // jobName,
            UUID: uid,
            params: params,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        // check job
        if(!job){
            return statusFalse(res, 'Job does not create successfully')
        }
        if (!order.length) {
            const noOrdersJob = await Job.findOneAndUpdate({ UUID: job.UUID }, {
                errorMessage: 'Order array contains no data.',
                status: 2,
                updatedAt: Date.now()
            }, {new: true});
            return res.json({
                status: 0,
                msg: noOrdersJob.errorMessage,
                data: {
                    status: noOrdersJob.status,
                    job: noOrdersJob
                }
            });
        }

        // request to engine
        sendReqToEnginePDP(obj).then(async engine => {
            await handleEngineResponse(engine, job, res);
        }).catch(err=>{
            console.log('---- err: ', err);
            return statusFalse(res, err.msg);
        });
    } catch (err) {
        res.status(500).json({
            'description': 'Can not access',
            'error': err.msg ,
        });
    }
};



// get remote info flatbed
// function getRemoteInfoFlatbed(req){
const getRemoteInfoFlatbed = (req) => {    
    let host, endPoint;
    let api="";
    let uri = `${api}/autoplan/flatbed?userId=${req.user.id}`, forward = false;
    console.log('host', req.headers['x-forwarded-host']);
    let myURL;
    if(req.headers.referer) {
        myURL = new URL(req.headers.referer);
    } else {
        myURL = req.headers['x-forwarded-host'];
        forward = true;
    }
    if(req.headers.host == "localhost:8081" || req.headers.host == "localhost:8080" || req.headers.host == "192.168.88.87:8080"){
        let port = req.headers.host.split(':')[1];
        endPoint = `${env.engineHost}:${port}${uri}`;
        host = `${env.engineHost}:${port}`;
    } else if (req.headers.type == "postman") {
        endPoint = `${myURL.origin}` + uri;
        host = `${myURL.origin}`;
    } else {
        if (forward) {
            endPoint = `https://${myURL}` + uri;
            host = `https://${myURL}`;
        } else {
            endPoint = `${myURL.origin}${uri}`;
            host = `${myURL.origin}`;
        }
        
        //companyName = myURL.hostname.split('.')[0];

        // endPoint = `${env.engineHost}${uri}`
        // host = `${env.engineHost}`
    }

    // console.log(' -------- myURL: ', myURL)

    let info = {
        host,
        userName:req.user.username,
        email:req.user.email,
        userType:req.user.type,
        userAgent:req.headers['user-agent'],
        endPoint,
    };
    return info;
}

// get equipments
// async function getEquipments(user, _date, dateRange){
const getEquipments = async (user, _date, dateRange, timezone) => {
    let date = Helper.getFlatbedDatesFromEndFormatted(_date, timezone, dateRange);

    const filter = {
        "order.start.timeWindowFrom": { 
            $gte: date.from,
            $lte: date.to
        },
        "order.end": { $exists: true },
        "order.end.timeWindowFrom": { $exists: true }
    }

    // get capacities by user id for carrier
    if(user.type != 'shipper' && user.type != 'broker'){
        filter["publishedBy.userId"] = user.id
    }

    // console.log('--- ', filter)

    const params = {
        '_id': 1,
        'order.availableSize': 1,
        'order.availableWeight': 1,
        'order.usedSize': 1,
        'order.usedWeight': 1,
        'order.equipment': 1
    };
    const capacityBoards = await CapacityBoard.find(filter, params).sort('_id');
    
    const equipments = [];

    capacityBoards.forEach(cb => {
        equipments.push({
            Id: cb._id,
            // typeId : cb._id,
            carCount : 1,
            feet : cb.order.availableSize + cb.order.usedSize,
            cube : 0,
            weight : cb.order.availableWeight + cb.order.usedWeight,
            shift: {}
        });
    });

    // console.log(' - eq', equipments)

    return equipments;
};

// request to engine
const sendReqToEnginePDP = async (obj) => {
    try {
        console.log("Flatbed: ", JSON.stringify(obj));
        const url = `${env.engineHost}:${env.enginePort}/dispatch/flatbed/singular`;
      
        // console.log(url)
        const res = await axios.post(url, obj);
        // console.log('res!!', res);
        return res;
    } catch (error) {
        console.error(error.message);
        return false;
    }
};

// handle engine response
const handleEngineResponse = async (engine, job, res) => {
    let engineData = engine;
    if(engineData === false){
        console.log(' -- engine false')
        return statusFalse(res, 'Engine connection error.')
    }
    
    if (engineData && engineData.data.Data == 'Started.') {
        console.log(' -- engine started')
        const startJob = await Job.updateOne({ UUID: job.UUID }, {
            status: 0,
            loadsCount: 0,
            errorMessage: "Please continue!!",
            updatedAt: Date.now()
        });
        let ETA;
        setTimeout(async () => {
            ETA = await Helper.getStatusAutoplan(job.UUID);
            if(ETA == 'Done.'){
                engineData.data.doneStatus = 'Done.'
            }
            engineData.data.uuid = job.UUID
            engineData.data.jobId = job._id // job.id
            res.json({
                status: 1,
                data: engineData.data,
                job: startJob,
                jobId: job._id, // job.id,
                ETA,
                jobStart: {
                    data: engineData.data,
                    job: startJob,
                    jobId: job._id, // job.id,
                    ETA,
                }
            });
        }, 5000);
    } else if (engineData && engineData.data.Data == 'Running.') {
        console.log(' -- engine running');
        const runJob = await Job.updateOne({ UUID: job.UUID }, { status: 1, updatedAt: Date.now() });
        let ETA;
        setTimeout(async () => {
            ETA = await Helper.getStatusAutoplan(job.UUID);
            res.json({
                status: 1,
                data: engineData.data,
                job: runJob,
                jobId: job._id, // job.id,
                ETA,
                jobStart: {
                    status: 1,
                    data: engineData.data,
                    job: runJob,
                    jobId: job._id, // job.id,
                    ETA,
                }
            });
        }, 5000);
    } else if(engineData && engineData.data.Data == 'Finished.') {
         console.log(' -- engine finished !!!');
        await Job.updateOne({ UUID: job.UUID }, { status: 3, updatedAt: Date.now() });
        let warning = false;
        const finishJob = await Job.findOne({ UUID: job.UUID });
        if (finishJob.Infeasible && finishJob.Infeasible.length > 0) {
            warning = true;
        }
        engineData.data.doneStatus = 3;
        res.json({
            status: 1,
            warning,
            data: engineData.data,
            job: finishJob,
            jobId: job._id, // job.id,
            ETA: 0,
            jobStart: {
                status: 1,
                warning,
                data: engineData.data,
                job: finishJob,
                jobId: job._id, // job.id,
                ETA: 0,
            }
        });
    }
    else if (engine && engine.data.Data == 'Order link contains no data.'){
         console.log(' -- engine no orders')
        const noOrdersJob = await Job.updateOne({ UUID: job.UUID }, { status: 5, updatedAt: Date.now() });
        engine.data.doneStatus = 5
        res.json({
            status: 0,
            data: engine.data,
            job: noOrdersJob,
            jobId: job._id, // job.id
            jobStart: {
                status: 0,
                data: engine.data,
                job: noOrdersJob,
                jobId: job._id, // job.id
            }
        });
    }
    else if(engine && !engine.data.Data) {
        console.log(' -- engine status 2 !!!')
        const failJob = await Job.updateOne({ UUID: job.UUID }, { status: 2, updatedAt: Date.now() });
        engine.data.doneStatus = false
        // res.status(409).json({
        res.json({
            status: 0,
            msg: engine.data.Message,
            jobId: job._id, // job.id,
            data: engine.data,
            jobStart: {
                status: 0,
                msg: engine.data.Message,
                jobId: job._id, // job.id,
                data: engine.data,
            }
        });
    }
}

const statusFalse = (res, msg) => {
    return res.json({
        status: 0,
        msg: msg,
        data: {
            status: 0,
            msg: msg
        }
    });
};
