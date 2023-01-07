// const db = require('../config/db.config.js');
// const Equipment_Old = db.equipment;
// const op = db.Sequelize.Op;
// const seq = db.sequelize;
const Equipment = require('../mongoModels/EquipmentModel');

module.exports = class EquipmentClass {

    constructor(params) {
        this.data = params ? params.data : undefined;        
    }

	// create
	async create(data){
		try{
			const equipment = new Equipment({
				typeName: data.typeName,
				code: data.code
			})
			equipment.id = equipment._id.toString()
			await equipment.save()

			return equipment
		}
		catch(ex){
			console.log('- error equipment create ', ex)
			return null
		}
	}

	// edit
	async edit(id, data){
		try{
			const equipment = await Equipment.findById(id);

			if(!equipment){
				return null
			}
			equipment.typeName = data.typeName
			equipment.code = data.code

			equipment.save()

			return equipment
		}
		catch(ex){
			console.log('- error equipment error ', ex)
			return null
		}
	}

	// delete
	async delete(id){
        const ids = id.split(',')
        await Equipment.deleteMany({ _id: { $in: ids } }, err => {
            if(err){
                // throw err
                return null
            }

            return 1
        })
	}


    // async create_Old(){
    //     let maxVolume = this.data.internalLength * this.data.internalWidth * this.data.internalHeight; 
    //     let equipment = await Equipment_Old.create({
    //         type: this.data.type,
	// 		trailerType: this.data.trailerType,
	// 		name: this.data.name,
	// 		horsePower: this.data.horsePower,
	// 		value: this.data.value,
	// 		valueUnit: this.data.valueUnit,
			
	// 		trailerSize: this.data.trailerSize,
	// 		externalLength: this.data.externalLength,
	// 		externalWidth: this.data.externalWidth,
	// 		externalHeight: this.data.externalHeight,

	// 		internalLength: this.data.internalLength,
	// 		internalWidth: this.data.internalWidth,
	// 		internalHeight: this.data.internalHeight,
	// 		maxweight: this.data.maxweight,
	// 		maxVolume: this.data.maxVolume ? this.data.maxVolume : maxVolume,
	// 		eqType: this.data.eqType
    //     });
        
    //     return equipment;

    // }


};

