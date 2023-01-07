const Settings = require('../mongoModels/SettingsModel');
const Helper = require('./helpers');

module.exports = class ShiftClass {

    constructor(params) {
		this.data = params.data ? params.data : undefined;
		this.Filters = params.Filters ? params.Filters : undefined;
        this.ids = params.ids ? params.ids : undefined;
        this.userId = params.userId ? params.userId : undefined;
    }

	// edit
	async edit(){
		try{
            let data = this.data, userId = this.userId;
			let settings;
			settings = await Settings.findOneAndUpdate({ userId: userId }, data, {new: true});
			if(!settings){
				return null;
			}
			return settings;
		}
		catch(ex){
			console.log('- error shift error ', ex);
			return null;
		}
	}
	async Filter(){
		let Filters = this.Filters, userId = this.userId;
		
		let settings;
		settings = await Settings.findOneAndUpdate({ userId: userId }, {
				...Filters,
			}, {new: true}).catch(err => {
			console.log(err);
		});
		return settings;
	}

	// delete
	async delete(){
        const ids = this.ids.split(',');
        await Settings.deleteMany({ _id: { $in: ids } }, err => {
            if(err){
                // throw err
                return null;
            }

            return 1;
        });
	}


};

