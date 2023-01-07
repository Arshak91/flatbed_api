const Accessorial = require('../mongoModels/AccessorialModel');

module.exports = class AccessorialClass {
	// create
	async create(data){
		try{
			// create
			const accessorial = new Accessorial({
				ServiceOption: data.ServiceOption
			})
			await accessorial.save()

			// set id
			accessorial.id = accessorial._id.toString()
			await accessorial.save()

			return accessorial
		}
		catch(ex){
			console.log('- error accessorial create: ', ex)
			return null
		}
	}

	// edit
	async edit(id, data){
		try{
			const accessorial = await Accessorial.findById(id);

			if(!accessorial){
				return null
			}
			accessorial.ServiceOption = data.ServiceOption

			await accessorial.save()

			return accessorial
		}
		catch(ex){
			console.log('- error accessorial error: ', ex)
			return null
		}
	}

	// delete
	async delete(ids){
        ids = ids.split(',')
        await Accessorial.deleteMany({ _id: { $in: ids } }, err => {
            if(err){
                // throw err
                return null
            }

            return 1
        })
	}
};

