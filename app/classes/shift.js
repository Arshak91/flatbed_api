
const Shift = require('../mongoModels/ShiftModel');

module.exports = class ShiftClass {

    constructor(params) {
        this.data = params ? params.data : undefined;        
    }

	// create
	async create(data){
		try{
			const shift = new Shift({
				shiftName: data.shiftName,
				shift: data.shift,
				break_time: data.break_time,
				drivingtime: data.drivingtime,
				max_shift: data.max_shift,
				rest: data.rest,
				recharge: data.recharge,
				status: data.status,
				createdAt: Date.now(),
    			updatedAt: Date.now()
			})

			await shift.save()

			shift.id = shift._id.toString()
			await shift.save()

			return shift
		}
		catch(ex){
			console.log('- error shift create ', ex)
			return null
		}
	}

	// edit
	async edit(id, data){
		try{
			const shift = await Shift.findById(id);

			if(!shift){
				return null
			}

			shift.shiftName = data.shiftName,
			shift.shift = data.shift,
			shift.break_time = data.break_time,
			shift.drivingtime = data.drivingtime,
			shift.max_shift = data.max_shift,
			shift.rest = data.rest,
			shift.recharge = data.recharge,
			shift.status = data.status
			shift.updatedAt = Date.now()

			shift.save()

			return shift
		}
		catch(ex){
			console.log('- error shift error ', ex)
			return null
		}
	}

	// delete
	async delete(id){
        const ids = id.split(',')
        await Shift.deleteMany({ _id: { $in: ids } }, err => {
            if(err){
                // throw err
                return null
            }

            return 1
        })
	}


};

