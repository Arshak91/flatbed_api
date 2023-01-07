
const Shift = require('../mongoModels/ShiftModel');
const ShiftClass = require('../classes/shift');

function getSortObject(query){
    let orderBy = query.orderBy ? query.orderBy : '_id';
    const order = query.order && query.order == 'asc' ? 1 : -1;
    
    const sort = {}
    sort[orderBy] = order
    return sort
}

exports.getAll = async (req, res) => {
    let page = req.query.page ? Math.max(0, req.query.page*1) : Math.max(0, 1);
    let perPage = req.query.limit ? req.query.limit*1 : 10;

    const sort = getSortObject(req.query);
    
    Shift.find().sort(sort)
        .limit(perPage).skip(perPage * (page - 1))
        .then(async (shifts) => {
            let ct = await Shift.countDocuments();

            res.json({
                status: 1,
                msg: 'ok',
                data: shifts
                // data: {
                //     shifts: shifts,
                //     total: ct
                // }
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access shifts table',
                'error': err
            });    
        });
};

exports.getOne = async (req, res) => {
    const filter = {
        '_id': req.params.id
    }
    Shift.findOne(filter)
        .then(async (shift) => {
            res.json({
                status: 1,
                msg: 'ok',
                data: shift
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access shifts table',
                'error': err
            });    
        });
}

exports.create = async (req, res) => {
    // const data = req.body

    const data = {
        shiftName: 'Daily',
        shift: 50400,
        break_time: 28800,
        drivingtime: 39600,
        max_shift: 50400,
        rest: 1800,
        recharge: 0,
        status: 1
    }

    const shiftClass = new ShiftClass()

    const shift = await shiftClass.create(data)

    if(shift == null){
        res.send({
            status: 0,
            msg: 'shift create error'
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: shift
    })
}

exports.edit = async (req, res) => {
    const data = req.body

    const shiftClass = new ShiftClass()

    const shift = await shiftClass.edit(req.params.id, data)
    
    if(shift == null){
        res.send({
            status: 0,
            msg: 'shift edit error'
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: shift
    })
}


exports.delete = async (req, res) => {
    const ids = req.query.id;
    if (!ids || ids.trim() == '') {
        return req.status(200).send({ status: 0, msg: 'no id for delete' });
    }

    const shiftClass = new ShiftClass()

    const shift = await shiftClass.delete(req.body.id)
    
    if(shift == null){
        res.send({
            status: 0,
            msg: 'shift delete error'
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: req.body.id
    })
}