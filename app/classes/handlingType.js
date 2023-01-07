const HandlingType = require('../mongoModels/HandlingTypeModel');

module.exports = class HandlingTypeClass {
	// create
	async create(data){
		try{
			// create
			const handlingType = new HandlingType({
				Type: data.Type
			})
			await handlingType.save()

			// set id
			handlingType.id = handlingType._id.toString()
			await handlingType.save()

			return handlingType
		}
		catch(ex){
			console.log('- error handlingType create: ', ex)
			return null
		}
	}

	// edit
	async edit(id, data){
		try{
			const handlingType = await HandlingType.findById(id);

			if(!handlingType){
				return null
			}
			handlingType.Type = data.Type

			await handlingType.save()

			return handlingType
		}
		catch(ex){
			console.log('- error handlingType error: ', ex)
			return null
		}
	}

	// delete
	async delete(ids){
        ids = ids.split(',')
        await HandlingType.deleteMany({ _id: { $in: ids } }, err => {
            if(err){
                // throw err
                return null
            }

            return 1
        })
	}
};

