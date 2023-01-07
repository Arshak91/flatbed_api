const Accessorial = require('../mongoModels/AccessorialModel');
const AccessorialClass = require('../classes/accessorial');

exports.getAll = async (req, res) => {
    try{
        let page = req.query.page ? Math.max(0, req.query.page*1) : Math.max(0, 1);
        let perPage = req.query.limit ? req.query.limit*1 : 10;

        const accessorials = await Accessorial.find().sort( [['ServiceOption', 1]] )
            .limit(perPage).skip(perPage * (page - 1))
        
        let ct = await Accessorial.countDocuments();

        res.json({
            status: 1,
            msg: 'ok',
            data: {
                accessorials: accessorials,
                total: ct
            }
        });
    }catch(err){
        res.status(500).send({
            status: 0,
            msg: err.message,
            error: err,
            description: 'Can not access Accessorials table'
        });
    }
};

exports.getOne = async (req, res) => {
    try{
        const accessorial = await Accessorial.findById(req.params.id)

        if(!accessorial){
            return res.status(500).json({ status: 0, msg: 'No data' });
        }
        res.json({
            status: 1,
            msg: 'ok',
            data: accessorial
        });
    }catch(err){
        return res.status(500).json({
            status: 0,
            msg: err.message
        });
    }
}

exports.create = async (req, res) => {
    const data = req.body

    const accessorialClass = new AccessorialClass()

    const accessorial = await accessorialClass.create(data)
    
    if(accessorial == null){
        return res.send({
            status: 0,
            msg: 'Accessorial create error.',
            data: data
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: accessorial
    })
};

exports.edit = async (req, res) => {
    const data = req.body

    const accessorialClass = new AccessorialClass()

    const accessorial = await accessorialClass.edit(req.params.id, data)
    
    if(accessorial == null){
        return res.send({
            status: 0,
            msg: 'Accessorial edit error.',
            data: data
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: accessorial
    })
};

exports.delete = async (req, res) => {
    const ids = req.query.ids;
    if (!ids || ids.trim() == '') {
        return req.status(200).send({ status: 0, msg: 'no ids for delete' });
    }

    const accessorialClass = new AccessorialClass()

    const accessorial = await accessorialClass.delete(ids)
    
    if(accessorial == null){
        return res.send({
            status: 0,
            msg: 'Accessorial delete error.',
            data: ids
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: ids
    })
};




// const db = require('../config/db.config.js');
// const AccessorialsOld = db.accessorials;
// exports.fill = async (req, res) => {
//     AccessorialsOld.findAll()
//     .then(async models => {

//         const accessorialClass = new AccessorialClass()

//         let errors = []
//         let created = []
        
//         for(let i = 0; i < models.length; i++){
//             const data = {
//                 ServiceOption: models[i].ServiceOption
//             }
            
//             console.log('-', data)

//             const accessorial = await accessorialClass.create(data)
            
//             if(accessorial == null){
//                 errors.push({ id: models[i].id, data })
//             }else{
//                 created.push(accessorial)
//             }
//         };

//         res.json({
//             created,
//             errors
//         })
//     }).catch(err => {
//         res.json({ err })
//     })
// }