const Upload = require('../mongoModels/UploadModel');
const getResponse = require('../helper/index');

module.exports = class UploadClass {
    constructor(params) {
        this.data = params.data;
        this.id = params.id;
    }

    async create() {
        let upload, error;
        upload = await Upload.create(this.data).catch(err => {
            error = err;
        });
        if (!upload && error) {
            return getResponse(0, error.message);
        } else if(!upload && !error) {
            return getResponse(0, "such upload not created");
        } else {
            return getResponse(1, "upload created", upload);
        }
    }
    async edit() {
        let upload, error;
        upload = await Upload.findOneAndUpdate({_id: this.id}, this.data, {new: true}).catch(err => {
            error = err;
        });
        if (!upload && error) {
            return getResponse(0, error.message);
        } else if(!upload && !error) {
            return getResponse(0, "such upload not edited");
        } else {
            return getResponse(1, "upload updated", upload);
        }
    }
    async getOne() {
        let id = this.id, upload, error;
        upload = await Upload.findOne({
            _id: id
        }).catch(err => {
            error = err;
        });
        if (!upload && error) {
            return getResponse(0, error.message);
        } else if(!upload && !error) {
            return getResponse(0, "such upload doesn't exist");
        } else {
            return getResponse(1, `${upload.type}s uploaded: ${upload.OrderCount}! Errors: ${upload.IncompleteOrderCount}.`, upload);
        }
    }
    async getBy(data) {
        let upload, error;
        upload = await Upload.findOne(data).catch(err => {
            error = err;
        });
        if (!upload && error) {
            return getResponse(0, error.message);
        } else if(!upload && !error) {
            return getResponse(0, "such upload doesn't exist");
        } else {
            return getResponse(1, "success", upload);
        }
    }
    async getAll() {
        let upload, count, error;
        let page = this.data.page ? Math.max(0, this.data.page*1) : Math.max(0, 1);
        let perPage = this.data.limit ? this.data.limit*1 : 10;        
        upload = await Upload.find().sort('_id').limit(perPage).skip(perPage * (page - 1)).catch(err => {
            error = err;
        });
        count = await Upload.find().sort('_id').limit(perPage).skip(perPage * (page - 1)).countDocuments();
        if (!upload && error) {
            return getResponse(0, error.message);
        } else if(!upload && !error) {
            return getResponse(0, "such upload doesn't exist");
        } else {
            return getResponse(1, "success", {upload, count});
        }
        
    }
    async deleteOne() {
        let id = this.data.id, upload, error;
        upload = await Upload.findOneAndRemove({ _id: id }).catch(err => {
            error = err;
        });
        if (!upload && error) {
            return getResponse(0, error.message);
        } else if(!upload && !error) {
            return getResponse(0, "such upload doesn't exist");
        } else {
            return getResponse(1, "upload deleted", upload);
        }
    }
};
