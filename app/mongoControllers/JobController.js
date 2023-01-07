const Job = require('../mongoModels/JobModel');
// const AccessorialClass = require('../classes/accessorial');

exports.get = async (req, res) => {
    try{
        const job = await Job.findById(req.params.id)

        res.status(200).send({
            status: 1,
            msg: 'ok',
            data: job
        });
    }catch(err){
        console.log('- ex: ', err)
        res.status(500).send({
            'description': 'Can not access jobs table',
            'error': err.msg
        });
    }
};


exports.status = async (req, res) => {
    // console.log('- job status: ', req.body.uuid)

    try{
        const job = await Job.findOne({ UUID: req.body.uuid });

        if(!job){
            return res.json({ status: 0, msg: 'no job', data: { status: 0 } });
        }

        if(job){
            res.status(200).send({
                status: 1,
                msg: job.errorMessage,
                data: {
                    msg: job.errorMessage,
                    status: job.status,
                    job
                }
            });
        }
    }catch(err){
        console.log('- ex: ', err);
        res.status(500).send({
            'description': 'Can not access jobs table',
            'msg': 'Can not access jobs table',
            'error': err.msg
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

// exports.edit = async (req, res) => {
//     const data = req.body

//     const accessorialClass = new AccessorialClass()

//     const accessorial = await accessorialClass.edit(req.params.id, data)
    
//     if(accessorial == null){
//         return res.send({
//             status: 0,
//             msg: 'Accessorial edit error.',
//             data: data
//         })
//     }

//     res.send({
//         status: 1,
//         msg: 'ok',
//         data: accessorial
//     })
// };

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
