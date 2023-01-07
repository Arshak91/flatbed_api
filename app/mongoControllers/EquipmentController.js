//const { readShort } = require('pdfkit/js/data');
const Equipment = require('../mongoModels/EquipmentModel');
const EquipmentClass = require('../classes/equipment');


function getSortObject(query){
    let orderBy = query.orderBy ? query.orderBy : '_id';
    const order = query.order && query.order == 'asc' ? 1 : -1;
    
    const sort = {}
    sort[orderBy] = order
    return sort
}
exports.set = async (req, res) => {
    const list = await Equipment.find();
    await Promise.all(list.map(async item => {
        if (item.code && item.code.length > 1) {
            item.groupType = 2;
        } else item.groupType = 1;
        await item.save();
    }));
    return res.send({ msg: 'success', status: 1 });
}
exports.getAll = async (req, res) => {
    try {
        let page = req.query.page ? Math.max(0, req.query.page*1) : Math.max(0, 1);
        let perPage = req.query.limit ? req.query.limit*1 : 10;
    
        const sort = getSortObject(req.query); // [['_id', -1]]
        // console.log('\n', ' - sort match:', sort)
        let filter = {};
        filter.enable = true;
        const groupType = +req.query.groupType;
        if (!!groupType && groupType === 1) {
            filter.groupType = +req.query.groupType;
        };

        const equipmentList = await Equipment.find(filter).sort(sort).limit(perPage).skip(perPage * (page - 1));
        const list = [];
        await Promise.all(equipmentList.map(item => list.push({
            _id: item._id,
            id: item._id,
            name: `${item.code} - ${item.typeName}`,
            typeName: item.typeName,
            code: item.code,
            groupType: item.groupType
        })));
    
        const count = await Equipment.countDocuments(filter);
    
        return res.send({
            status: 1,
            msg: 'Equipments list',
            data: {
                equipments: list,
                total: count
            }
        });
    } catch (err) {
        console.log(err);
    }
};

exports.getOne = async (req, res) => {
    const filter = {
        '_id': req.params.id
    }
    Equipment.findOne(filter)
        .then(async (equipment) => {
            res.json({
                status: 1,
                msg: 'ok',
                data: equipment
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access equipments table',
                'error': err
            });    
        });
}

exports.getAllForFilter = async (req, res) => {
    //attributes: ['id', 'name', 'type', 'value', 'maxweight' ]

    Equipment.find({}, { name: 1, code: 1, typeName: 1, _id: 1, value: 1, maxweight: 1 }).sort( [['code', 1]] )
        .then(async (equipments) => {
            const eqs = [];
            equipments.forEach(eq =>{
                eqs.push({
                    _id: eq._id,
                    id: eq._id,
                    name: `${eq.code} - ${eq.typeName}`,
                    typeName: eq.typeName,
                    code: eq.code,
                    // id: eq.id,
                    // name: `${eq.type} - ${eq.name}`,
                    // size: eq.value,
                    // weight: eq.maxweight
                });
            });
            res.status(200).send({
                status: 1,
                msg: 'ok',
                data: {
                    equipments: eqs
                }
            });
        }).catch(err => {
            res.status(500).send({
                'description': 'Can not access equipments table',
                'error': err
            });    
        });
};


exports.create = async (req, res) => {
    const data = req.body

    const equipmentClass = new EquipmentClass()

    const equipment = await equipmentClass.create(data)
    
    if(equipment == null){
        res.send({
            status: 0,
            msg: 'equipment create error'
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: equipment
    })
}

exports.edit = async (req, res) => {
    const data = req.body

    const equipmentClass = new EquipmentClass()

    const equipment = await equipmentClass.edit(req.params.id, data)
    
    if(equipment == null){
        res.send({
            status: 0,
            msg: 'equipment edit error'
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: equipment
    })
}


exports.delete = async (req, res) => {
    const ids = req.query.id;
    if (!ids || ids.trim() == '') {
        return req.status(200).send({ status: 0, msg: 'no id for delete' });
    }

    const equipmentClass = new EquipmentClass()

    const equipment = await equipmentClass.delete(req.body.id)
    
    if(equipment == null){
        res.send({
            status: 0,
            msg: 'equipment delete error'
        })
    }

    res.send({
        status: 1,
        msg: 'ok',
        data: req.body.id
    })
}