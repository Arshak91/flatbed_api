const db = require('../config/db.config.js');
const Helper = require('../classes/helpers');
const Osmap = require('./osmap.controller');
const Errors = require('../errors/consigneeErrors');
const Search = require('../lib/search');
const Op = db.Sequelize.Op;
const Consignees = db.consignee;

const includeFalse = [{ all: true, nested: false }];

exports.get = async (req, res) => {

    let id = req.params.id;
    
    Consignees.findOne({
        where: {id:id},
        include: includeFalse
    }).then(consignees => {
        res.status(200).send({
            status: 1,
            msg: "ok", 
            data: consignees
        });
    }).catch(err => {
        res.status(500).send({
            status: 0,
            msg: err,
            data:req.params
        });        
    });

};

exports.getAll = async (req, res) => {
    let sortAndPagination = await Helper.sortAndPagination(req);
    let where = req.query, { text, fields } = req.query, search, obj = {}, attr;
    delete where.text;
    delete where.fields;
    search = text ? await Search.searchConsignee(text, fields) : {};
    const data = await Helper.filters(where, Op);
    if (fields) {
        attr = fields.split(',');
        obj = {
            attributes: attr,
            where: {
                ...data.where,
                ...search
            },
            ...sortAndPagination
        };
    } else {
        obj = {
            where: {
                ...data.where,
                ...search
            },
            ...sortAndPagination,
            include: includeFalse,
            distinct: true,
        };
    }

    Consignees.findAndCountAll(obj)
    .then( consignees => {
        res.status(200).send({
            status: 1,
            msg: 'ok',
            data: {
                consignees: consignees.rows,
                total: consignees.count
            }
        });
    }).catch(err => {
        res.status(500).send({
            status: 0,
            msg: 'Can not access drivers table',
            err: err
        });
    });
        
};

exports.delete = async (req, res) => {
   
    let ids = req.body.ids; 
    if (!ids || ids.length == 0 ) {
        res.status(500).send({
            status: 0,
            msg: 'no ids for delete'
        });
        return;
    }
    
    Consignees.destroy({
        where: {
            id: {
                [Op.in]: ids
            }
        }
    }).then(count => {
        res.status(200).send({
            status: 1,
            msg: 'deleted',
            "Count": count,
            
        });
    }).catch(err => {
        res.status(500).send({ 
            status: 0,
            msg: "fail on Consignee table",
            "error": err
        });
    });
    
};

exports.create = async (req, res) => {
    let obj = {
		...req.body,
		id: 1
	};
    const errors = await Errors.createAndEditError(obj);
    if (!errors.status) {
        res.status(409).send({
            status: errors.status,
            msg: errors.msg
        });
	} else {
        let { points } = errors;
        let driverId = req.body.driverId ? req.body.driverId : 0;
        if(isNaN(driverId) ){driverId=0;}

        let stime =  req.body.serviceTime ? req.body.serviceTime*60 :0 ;
        if(isNaN(stime) ){stime=0;}
        await Consignees.create({
            name: req.body.name, 
            companyLegalName: req.body.companyLegalName, 
            email: req.body.email,
            address: req.body.address ? req.body.address : "",
            address2: req.body.address2 ? req.body.address2 : "",
            phone1: req.body.phone1,
            phone2: req.body.phone2,
            contactPerson: req.body.contactPerson ? req.body.contactPerson : "",
            points: points,
            rating: req.body.rating,
            notes: req.body.notes ? req.body.notes : "",
            serviceTime: stime,
            driverId: driverId
        }).then( iresp => {
            res.status(200).send({
                status: 1,
                msg: "OK",
                data: iresp
            });
        }).catch(err => {
            res.status(409).send({
                status: 0,
                msg: err.original.sqlMessage,
                "Error": err
            });
        });
    }
    
};

exports.createInTimeOrderCreate = async (data) => {
    try {
        let consignee;
        let { name, companyLegalName, serviceTime, points } = data;
        consignee =  await Consignees.create({
            name: name, 
            companyLegalName: companyLegalName, 
            points: points,
            serviceTime: serviceTime ? serviceTime : 0,
            driverId: 0
        }).catch(err => {
            console.log(err);
        });
        return {
            status: 1,
            data: consignee
        };
    } catch (error) {
        return {
            status: 0,
            msg: error.original.sqlMessage,
        };
    }
};

exports.edit = async (req, res) => {
    let obj = {
        ...req.body,
        ...req.params
    };
    const errors = await Errors.createAndEditError(obj);
    if (!errors.status) {
        res.status(409).send({
            status: errors.status,
            msg: errors.msg
        });
	} else {
        let { points } = errors;
        let driverId = req.body.driverId ? req.body.driverId : 0;
        if(isNaN(driverId) ){driverId=0;}

        let stime =  req.body.serviceTime ? req.body.serviceTime*60 :0 ;
        if(isNaN(stime) ){stime=0;}
        Consignees.update({
            name: req.body.name, 
            companyLegalName: req.body.companyLegalName, 
            email: req.body.email,
            address: req.body.address ? req.body.address : "",
            address2: req.body.address2 ? req.body.address2 : "",
            phone1: req.body.phone1,
            phone2: req.body.phone2,
            contactPerson: req.body.contactPerson,
            points: points,
            rating: req.body.rating,
            notes: req.body.notes,
            serviceTime: stime,
            driverId: driverId

        }, {
            where: { id: req.params.id }
        }).then( uresp => {
                res.status(200).send({
                    status: 1,
                    msg: "OK",
                    "updated": uresp
                });
        }).catch(err => {
            res.status(409).send({
                status: 0,
                msg: err.original.sqlMessage,
                "Error": err
            });
        });
    }
};

exports.editDriver = async (req, res) => {
    try {
        let { driverId, consigneeIds } = req.body;
        let consignee;
        consignee = await Consignees.update({
            driverId: driverId
        }, {
            where: {
                id: {
                    [Op.in]: consigneeIds
                }
            }
        });
        res.json({
            status: 1,
            msg: "ok",
            consignee
        });
    } catch (error) {
        res.status(409).json({
            status: 0,
            msg: "Error"
        });
    }
};

exports.script = async (req, res) => {
    const consignees = await Consignees.findAll({
        where: {
            id: {
                [Op.in]: [223, 1893, 2186]
            }
        }
    });
    let lat, lon, i = 0, consigneIds = [];
    for (const consignee of consignees) {
        let points = [];
        for (const point of consignee.points) {
            let address = `${point.address.zip}+${point.address.city}+${point.address.streetAddress}+${point.address.state}`;
            const LatLon = !point.address.lat && !point.address.lon ? await Osmap.GeoLoc(address) : null;
            if (LatLon && LatLon.data.status != "OK") {
                consigneIds.push(consignee.id);
            }
            lat = LatLon ? LatLon.data.status == "OK" ? LatLon.data.results[0].geometry.location.lat : 0 : point.address.lat;
            lon = LatLon ? LatLon.data.status == "OK" ? LatLon.data.results[0].geometry.location.lng : 0 : point.address.lon;
            point.address.lat = lat;
            point.address.lon = lon;
            points.push(point);
        }
        await Consignees.update({
            points
        },{
            where: {
                id: consignee.id
            }
        });
        console.log(i);
        i++;
    }
    console.log(consigneIds);
    res.json({
        msg: "ok",
        status: 1
    });
};

