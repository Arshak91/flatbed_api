const Settings = require('../mongoModels/SettingsModel');
const SettingsCl = require('../classes/settings');
const Helper = require('../classes/helpers');
// const AccessorialClass = require('../classes/accessorial');


exports.get = async (req, res) => {
    try {
        // filter
        let userId;
        userId = req.user.id ? req.user.id : null;
        if(!userId){
            return res.json({ status: 1, msg: 'no setting', data: {} });
        }
        const filter = { userId: userId }

        // params
        const attrs = req.query.fields ? req.query.fields.split(',') : []; // attributes;
        const params = {}
        attrs.forEach(attr => {
            params[attr] = 1
        });

        console.log('- ', filter)
        console.log('- ', params)

        // get from db
        const settings = await Settings.findOne(filter, params)

        if(!settings){
            return res.json({ status: 1, msg: 'no setting', data: {} });
        }

        res.json({
            status: 1,
            msg: 'find setting',
            data: settings._doc
        });
    } catch (error) {
        console.log(error)
        res.status(409).json({
            status: 0,
            error
        });
    }
};


// exports.getAll = async (req, res) => {
//     try{
//         let page = req.query.page ? Math.max(0, req.query.page*1) : Math.max(0, 1);
//         let perPage = req.query.limit ? req.query.limit*1 : 10;

//         const accessorials = await Accessorial.find().sort( [['ServiceOption', 1]] )
//             .limit(perPage).skip(perPage * (page - 1))
        
//         let ct = await Accessorial.countDocuments();

//         res.json({
//             status: 1,
//             msg: 'ok',
//             data: {
//                 accessorials: accessorials,
//                 total: ct
//             }
//         });
//     }catch(err){
//         res.status(500).send({
//             status: 0,
//             msg: err.message,
//             error: err,
//             description: 'Can not access Accessorials table'
//         });
//     }
// };

// exports.getOne = async (req, res) => {
//     try{
//         const accessorial = await Accessorial.findById(req.params.id)

//         if(!accessorial){
//             return res.status(500).json({ status: 0, msg: 'No data' });
//         }
//         res.json({
//             status: 1,
//             msg: 'ok',
//             data: accessorial
//         });
//     }catch(err){
//         return res.status(500).json({
//             status: 0,
//             msg: err.message
//         });
//     }
// }

// exports.create = async (req, res) => {
//     const data = req.body

//     const accessorialClass = new AccessorialClass()

//     const accessorial = await accessorialClass.create(data)
    
//     if(accessorial == null){
//         return res.send({
//             status: 0,
//             msg: 'Accessorial create error.',
//             data: data
//         })
//     }

//     res.send({
//         status: 1,
//         msg: 'ok',
//         data: accessorial
//     })
// };

exports.edit = async (req, res) => {
    const filterTypeEnum = { load: 1, capacity: 2, matching: 3 };
    let user = req.user, data = req.body, x = req.query;

    const item = await Settings.findOne({ userId: user._id });

    console.log(user._id);
    const job = {
        [filterTypeEnum.load]: () => !!data.filters.loadsFilters && (data.filters.loadsFilters !== {}) && item && data.filters.loadsFilters ? item.filters.loadsFilters = data.filters.loadsFilters : null, 
        [filterTypeEnum.capacity]: () => !!data.filters.capacityFilters && (data.filters.capacityFilters !== {}) && item && data.filters.capacityFilters ? item.filters.capacityFilters = data.filters.capacityFilters : null, 
        [filterTypeEnum.matching]: () => !!data.filters.matchingFilters && (data.filters.matchingFilters !== {}) && item && data.filters.matchingFilters ? item.filters.matchingFilters = data.filters.matchingFilters : null, 
    }

    job[x.filterType]();
    
    await Settings.findOneAndUpdate({ userId: user._id }, item, {new: true});
    
    await res.send({
        status: 1,
        msg: 'ok',
        data: item
    });
};
exports.addFilter = async (req, res) => {
    let user = req.user, data = req.body, settings, filterObj;
    filterObj = await Helper.loadFilterForPush({Filters: data, userId: user.id});
    const cl = new SettingsCl({Filters: filterObj, userId: user.id});

    settings = await cl.Filter();
    
    if(!settings){
        return res.status(409).json({
            status: 0,
            msg: 'Settings edit error.'
        });
    }

    res.json({
        status: 1,
        msg: 'ok',
        data: settings._doc
    });
};

exports.removeFilter = async (req, res) => {
    let user = req.user, data = req.body, settings, filterObj;
    filterObj = await Helper.loadFilterForPull({Filters: data});
    const cl = new SettingsCl({Filters: filterObj, userId: user.id});

    settings = await cl.Filter();
    
    if(!settings){
        return res.status(409).json({
            status: 0,
            msg: 'Settings edit error.'
        });
    }

    res.json({
        status: 1,
        msg: 'ok',
        data: settings._doc
    });
};

// exports.delete = async (req, res) => {
//     const ids = req.query.ids;
//     if (!ids || ids.trim() == '') {
//         return req.status(200).send({ status: 0, msg: 'no ids for delete' });
//     }

//     const accessorialClass = new AccessorialClass()

//     const accessorial = await accessorialClass.delete(ids)
    
//     if(accessorial == null){
//         return res.send({
//             status: 0,
//             msg: 'Accessorial delete error.',
//             data: ids
//         })
//     }

//     res.send({
//         status: 1,
//         msg: 'ok',
//         data: ids
//     })
// };
