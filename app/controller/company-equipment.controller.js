const Helper = require('../classes/helpers');
const db = require('../config/db.config.js');
const Errors = require('../errors/assetsErrors');

const CompanyEquipment = db.companyequipment;
const Op = db.Sequelize.Op;

// read
exports.getall = async (req, res) => {
	let group=['id'];
	if(req.params.field){
		group = [`${req.params.field}`];
	}
	let sortAndPagination = await Helper.sortAndPagination(req);
	let where = req.query;
	CompanyEquipment.findAndCountAll({
		where: where,
		group:group,
		...sortAndPagination,
		include: [{ all: true, nested: true }],
	})
	.then(companyEquipment => {
		res.status(200).send({
			status: 1,
			msg: 'Ok',
			data: {
				companyEquipment: companyEquipment.rows,
				total: companyEquipment.count.length
			}
		});
	}).catch(err => {
		res.status(500).send({
			'description': 'Can not access companyEquipment table',
			'error': err
		});
	});
};

exports.getallWithOrWithoutTrailer = async (req, res) => {
	try {
		let where = {};
		if (req.body.equipmentType == 'Trailer') {
			where = {
				type: 'Trailer'
			};
		} else {
			where = {
				[Op.or]: [{
					type: 'Truck'
				}, {
					type: 'Tractor'
				}]
				
			};
		}
		CompanyEquipment.findAll({
			include: [{
				model: db.equipment,
				where
			}],
			group: ['equipmentId']
		}).then(companyEquipment => {
			res.status(200).send({
				status: 1,
				msg: 'Ok!',
				data: companyEquipment
			});
		}).catch(err => {
			res.status(500).send({
				'description': 'Can not access companyEquipment table',
				'error': err
			});
		});
	} catch (error) {
		res.status(500).send({
			'error': error
		});
	}
};

// getOne
exports.get = (req, res) => {
	var id = req.params.id;
	CompanyEquipment.findOne({
		where: {
			id: id
		},
		include: [{ all: true, nested: true }],
	})
	.then(carrierEquipment => {
		res.status(200).send({
			status: 1,
			msg: 'Ok',
			data: carrierEquipment
		});
	}).catch(err => {
		res.status(500).send({
			'description': 'Can not access companyEquipment table',
			'error': err.msg
		});
	});
};

// create
exports.create = async (req, res) => {
	try {
		const errors = await Errors.createAndEditError(req.body);
		if (!errors.status) {
			res.status(409).send({
				status: errors.status,
				msg: errors.msg
			});
		} else {
			let comEquipment;
			comEquipment = await CompanyEquipment.create({
				companyId: req.body.companyId ? req.body.companyId : 1,
				name: req.body.name,
				equipmentId: req.body.equipmentId,
				platNumber: req.body.platNumber,
				attachment: req.body.attachment,
				licenses: req.body.licenses,
				VIN: req.body.VIN,
				brand: req.body.brand,
				cabinType: req.body.cabinType,
				inspaction: req.body.inspaction,            //  yes / no 
				yom: req.body.yom,                         //  year of manufacture 
				model: req.body.model,
				exploitation: req.body.exploitation,
				info: req.body.info,
				depoid: req.body.depotId	
			});
			if (comEquipment) {
				res.status(200).send({
					status: 1,
					msg: 'Ok',
					data: comEquipment
				});
			} else {
				res.status(409).send({
					status: 0,
					msg: 'Error',
					data: []
				});
			}
		}
		
	} catch (err) {
		res.status(409).send({
			status: 0,
			msg: err.message,
			err: err,
		});
	}
};

// update
exports.edit = async (req, res) => {
	const errors = await Errors.createAndEditError(req.body);
	if (!errors.status) {
		res.status(409).send({
			status: errors.status,
			msg: errors.msg
		});
	} else {
		let id = req.params.id;
		
		CompanyEquipment.update({
			companyId: req.body.companyId ? req.body.companyId : 1,
			equipmentId: req.body.equipmentId,
			name: req.body.name,
			platNumber: req.body.platNumber,
			attachment: req.body.attachment,
			licenses: req.body.licenses,
			VIN: req.body.VIN,
			brand: req.body.brand,
			cabinType: req.body.cabinType,
			inspaction: req.body.inspaction,            //  yes / no 
			yom: req.body.yom,                         //  year of manufacture 
			model: req.body.model,
			exploitation: req.body.exploitation,
			info: req.body.info,
			depoid: req.body.depotId
		},
		{
			where: {
				id: id
			}
		}
		).then(carrierEquipment => {
			res.status(200).send({
				status: 1,
				msg: 'Ok',
				data: carrierEquipment
			});
		}).catch(err => {
			res.status(500).send({ status: 0, msg: err.message, err: err, data: req.body });
		});
	}
	
};

// delete
exports.delete = (req, res) => {
	var ids = req.body.ids;
	if(!ids || !ids.length){
		res.status(200).send({
			status: 0,
			msg: 'no ids for delete'
		});
		return;
	}

	CompanyEquipment.destroy({
		where: {
			id: { [Op.in]: ids }
		}
	}).then(companyEquipment => {
		res.status(200).send({
			status: 1,
			msg: 'Ok',
			data: companyEquipment
		});
	}).catch(err => {
		res.status(500).send({
			'description': 'Can not access companyEquipment table',
			'error': err
		});
	});
};

