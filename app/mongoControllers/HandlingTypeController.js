const HandlingType = require('../mongoModels/HandlingTypeModel');
const HandlingTypeClass = require('../classes/handlingType');

exports.getAll = async (req, res) => {
    try{
        let page = req.query.page ? Math.max(0, req.query.page*1) : Math.max(0, 1);
        let perPage = req.query.limit ? req.query.limit*1 : 10;

        const handlingTypes = await HandlingType.find().sort( [['Type', 1]] )
            .limit(perPage).skip(perPage * (page - 1))
        
        let ct = await HandlingType.countDocuments();

        res.json({
            status: 1,
            msg: 'ok',
            data: {
                handlingtypes: handlingTypes,
                total: ct
            }
        });
    }catch(err){
        res.status(500).send({
            status: 0,
            msg: err.message,
            error: err,
            description: 'Can not access HandlingTypes table'
        });
    }
};

exports.getOne = async (req, res) => {
    try{
        const handlingType = await HandlingType.findById(req.params.id)

        if(!handlingType){
            return res.status(500).json({ status: 0, msg: 'No data' });
        }

        res.json({
            status: 1,
            msg: 'ok',
            data: handlingType
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

    const handlingTypeClass = new HandlingTypeClass()

    const handlingType = await handlingTypeClass.create(data)
    
    if(handlingType == null){
        return res.send({
            status: 0,
            msg: 'HandlingType create error.',
            data: data
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: handlingType
    })
};

exports.edit = async (req, res) => {
    const data = req.body

    const handlingTypeClass = new HandlingTypeClass()

    const handlingType = await handlingTypeClass.edit(req.params.id, data)
    
    if(handlingType == null){
        return res.send({
            status: 0,
            msg: 'HandlingType edit error.',
            data: data
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: handlingType
    })
};

exports.delete = async (req, res) => {
    const ids = req.query.ids;
    if (!ids || ids.trim() == '') {
        return req.status(200).send({ status: 0, msg: 'no ids for delete' });
    }

    const handlingTypeClass = new HandlingTypeClass()

    const handlingType = await handlingTypeClass.delete(ids)
    
    if(handlingType == null){
        return res.send({
            status: 0,
            msg: 'HandlingType delete error.',
            data: ids
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: ids
    })
};

